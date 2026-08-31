import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (added 2026-08-27)
// This endpoint permanently deletes a user (profile row + auth user). It was
// previously PUBLIC and UNAUTHENTICATED — anyone could POST { user_id } and wipe
// any / every account.
//
// Now:
//  - Caller must present a valid Supabase session (Authorization: Bearer <jwt>).
//  - Caller must be admin / staff / receptionist (the roles that manage records).
//  - A caller cannot delete their own account through this endpoint.
//  - Deleting another admin requires the caller to be an admin.
//  - CORS restricted to ALLOWED_ORIGINS when that secret is set.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const CAN_DELETE = ["admin", "staff", "receptionist"];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow =
    ALLOWED_ORIGINS.length === 0 ? (origin || "*")
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

    const { user_id } = await req.json();
    if (!user_id) return json({ success: false, message: "user_id is required" }, 400);
    if (user_id === caller.id) {
      return json({ success: false, message: "You cannot delete your own account here" }, 400);
    }

    // Guard: only an admin may delete another admin.
    const { data: target } = await admin.from("profiles").select("role").eq("id", user_id).maybeSingle();
    if (target?.role === "admin" && caller.role !== "admin") {
      return json({ success: false, message: "Only an admin can delete an admin account" }, 403);
    }

    const { error: profileError } = await admin.from("profiles").delete().eq("id", user_id);
    if (profileError) return json({ success: false, message: profileError.message }, 400);

    const { error: authError } = await admin.auth.admin.deleteUser(user_id);
    if (authError) return json({ success: false, message: authError.message }, 400);

    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: err instanceof Error ? err.message : String(err) }, 500);
  }
});
