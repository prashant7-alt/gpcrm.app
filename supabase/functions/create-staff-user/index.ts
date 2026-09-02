import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (added 2026-08-27)
// This endpoint creates real login accounts. It was previously PUBLIC and
// UNAUTHENTICATED with a caller-supplied `role`, meaning anyone on the internet
// could POST { role: "admin" } and mint themselves an admin account.
//
// Now:
//  - The caller must present a valid Supabase session (Authorization: Bearer <jwt>).
//  - The caller's role is looked up server-side from `profiles`.
//  - Creating a `student` login requires the caller to be admin / staff / receptionist.
//  - Creating ANY non-student (staff) login requires the caller to be admin.
//  - `role` is validated against a strict allow-list.
//  - CORS is restricted to ALLOWED_ORIGINS when that secret is set.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

const STAFF_ROLES   = ['admin', 'staff', 'finance_officer', 'document_handler', 'receptionist', 'counselor', 'visa_officer']
const ALL_ROLES     = [...STAFF_ROLES, 'student']
const CAN_ADD_STUDENT = ['admin', 'staff', 'receptionist']

// Local dev origins are always allowed — a CORS grant to the developer's own
// machine can't be exploited by a remote page. Production stays locked to
// ALLOWED_ORIGINS.
const isLocalhost = (o: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow =
    isLocalhost(origin) ? origin
    : ALLOWED_ORIGINS.length === 0 ? (origin || '*')
    : ALLOWED_ORIGINS.includes(origin) ? origin
    : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

/** Resolve the calling user from the Bearer token and return their role. */
async function getCaller(req: Request): Promise<{ role: string; id: string } | { error: string; status: number }> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return { error: 'Missing Authorization header', status: 401 }

  const { data: { user }, error } = await admin.auth.getUser(jwt)
  if (error || !user) return { error: 'Invalid or expired session', status: 401 }

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile?.role) return { error: 'Caller has no profile / role', status: 403 }

  return { role: profile.role, id: user.id }
}

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const caller = await getCaller(req)
    if ('error' in caller) return json({ success: false, message: caller.error }, caller.status)

    const { email, password, name, role } = await req.json()

    if (!email || !password || !name || !role) {
      return json({ success: false, message: 'Missing required fields' }, 400)
    }
    if (!ALL_ROLES.includes(role)) {
      return json({ success: false, message: 'Invalid role' }, 400)
    }
    if (String(password).length < 8) {
      return json({ success: false, message: 'Password must be at least 8 characters' }, 400)
    }

    // Authorisation check
    if (role === 'student') {
      if (!CAN_ADD_STUDENT.includes(caller.role)) {
        return json({ success: false, message: 'Not permitted to create student accounts' }, 403)
      }
    } else if (caller.role !== 'admin') {
      return json({ success: false, message: 'Only an admin can create staff accounts' }, 403)
    }

    // Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: String(email).toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })
    if (authError) return json({ success: false, message: authError.message }, 400)

    // Insert profile row
    const { error: profileError } = await admin.from('profiles').insert({
      id: authData.user.id,
      name,
      email: String(email).toLowerCase(),
      role,
    })
    if (profileError) {
      // roll back the orphaned auth user so a retry can succeed
      await admin.auth.admin.deleteUser(authData.user.id).catch(() => {})
      return json({ success: false, message: 'Profile creation failed: ' + profileError.message }, 500)
    }

    return json({ success: true, user_id: authData.user.id })
  } catch (err) {
    return json({ success: false, message: err instanceof Error ? err.message : String(err) }, 500)
  }
})
