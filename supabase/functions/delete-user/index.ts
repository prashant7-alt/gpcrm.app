import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (added 2026-08-27, hardened 2026-09-02)
// Permanently deletes a user: profile row(s) + the auth login.
//
//  - Caller must present a valid Supabase session (Authorization: Bearer <jwt>).
//  - Caller must be admin / staff / receptionist.
//  - A caller cannot delete their own account here.
//  - Deleting an admin requires the caller to be an admin.
//  - CORS restricted to ALLOWED_ORIGINS when that secret is set.
//
// 2026-09-02: accepts `{ user_id?, email? }`. When the applicant→profile link
// was never made (or the email was typo'd on one side), staff still need the
// login gone. So: resolve by user_id first, then by email via `profiles`, and
// finally scan `auth.users` by email. Deleting a login that doesn't exist is a
// success (the caller wants the end state "this email can't sign in").
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const CAN_DELETE = ["admin", "staff", "receptionist"];

// Local dev origins are always allowed — a CORS grant to the developer's own
// machine can't be exploited by a remote page. Production stays locked to
// ALLOWED_ORIGINS.
const isLocalhost = (o: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow =
    isLocalhost(origin) ? origin
    : ALLOWED_ORIGINS.length === 0 ? (origin || "*")
    : ALLOWED_ORIGINS.includes(origin) ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function getCaller(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return { error: "Missing Authorization header", status: 401 };
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) return { error: "Invalid or expired session", status: 401 };
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role) return { error: "Caller has no profile / role", status: 403 };
  return { role: profile.role, id: user.id };
}

/** Find an auth user id by email by scanning pages of auth.users. */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const needle = email.trim().toLowerCase();
  const perPage = 1000;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === needle);
    if (hit) return hit.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const caller = await getCaller(req);
    if ("error" in caller) return json({ success: false, message: caller.error }, caller.status);
    if (!CAN_DELETE.includes(caller.role)) {
      return json({ success: false, message: "Not permitted to delete accounts" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    let userId: string | null = body?.user_id ?? null;
    const email: string | null = (body?.email ?? "").trim().toLowerCase() || null;

    if (!userId && !email) {
      return json({ success: false, message: "user_id or email is required" }, 400);
    }

    // Resolve a user id from the email if we weren't handed one.
    if (!userId && email) {
      const { data: prof } = await admin
        .from("profiles").select("id").ilike("email", email).maybeSingle();
      userId = prof?.id ?? (await findAuthUserIdByEmail(email));
    }

    if (userId === caller.id) {
      return json({ success: false, message: "You cannot delete your own account here" }, 400);
    }

    // Guard: only an admin may delete another admin.
    if (userId) {
      const { data: target } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (target?.role === "admin" && caller.role !== "admin") {
        return json({ success: false, message: "Only an admin can delete an admin account" }, 403);
      }
    }

    // Remove profile row(s) — by id and, defensively, by email.
    if (userId) {
      const { error } = await admin.from("profiles").delete().eq("id", userId);
      if (error) return json({ success: false, message: "Profile delete failed: " + error.message }, 400);
    }
    if (email) {
      await admin.from("profiles").delete().ilike("email", email);
    }

    // Remove the auth login. A "user not found" here is fine — the goal is that
    // this email can no longer sign in.
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error && !/not.*found/i.test(error.message)) {
        return json({ success: false, message: "Auth delete failed: " + error.message }, 400);
      }
    } else if (email) {
      const scanned = await findAuthUserIdByEmail(email);
      if (scanned) await admin.auth.admin.deleteUser(scanned).catch(() => {});
    }

    return json({ success: true, deleted_user_id: userId });
  } catch (err) {
    return json({ success: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});
