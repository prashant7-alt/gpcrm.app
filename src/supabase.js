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
 * Headers for calling an Edge Function that now requires the caller's session.
 * Returns a plain object with Content-Type + Authorization (Bearer <access_token>).
 * If there is no session the Authorization header is omitted and the function
 * will reject the request with 401.
 */
export async function functionHeaders(extra = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { 'Content-Type': 'application/json', ...extra }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return headers
}
