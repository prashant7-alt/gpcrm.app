import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Fail loudly in dev instead of silently creating a broken client.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit flow: this is a backend-less SPA, so there is no server to do the
    // PKCE code<->verifier exchange. PKCE also broke password recovery — the
    // verifier is single-slot in localStorage, so a second "forgot password"
    // click (or a mail scanner pre-opening the link) invalidated the real one.
    // Implicit delivers the session tokens straight in the URL hash instead.
    flowType: 'implicit',
  },
})

/**
 * Headers for calling an Edge Function that requires the caller's session.
 * Returns Content-Type + Authorization (Bearer <access_token>).
 *
 * The access token is only valid for ~1 hour. On a long-open admin tab it
 * expires, and the Edge Function then rejects the call with "Invalid or expired
 * session". So: if the stored token is missing or within 2 minutes of expiry,
 * force a refresh here first, using the refresh token, before handing the header
 * out. If the refresh token itself is dead, the Authorization header is omitted
 * and the caller should tell the user to sign in again.
 */
export async function functionHeaders(extra = {}) {
  let { data: { session } } = await supabase.auth.getSession()

  const expiresInMs = session?.expires_at ? session.expires_at * 1000 - Date.now() : -1
  if (!session || expiresInMs < 120_000) {
    const { data } = await supabase.auth.refreshSession()
    if (data?.session) session = data.session
  }

  const headers = { 'Content-Type': 'application/json', ...extra }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}
