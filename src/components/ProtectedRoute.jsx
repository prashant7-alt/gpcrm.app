import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import theme from '../theme'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase'

// ── loading screen while checking session ──
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: theme.pageBg, fontFamily: 'inherit',
    }}>
      <div style={{ textAlign: 'center', color: theme.textLight }}>
        <Loader2 size={30} style={{ marginBottom: 12, animation: 'spin 0.9s linear infinite' }} />
        <div style={{ fontSize: 14 }}>Loading...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// Last-known profile from localStorage — used only as an offline fallback so a
// flaky network on return from a payment redirect doesn't kick the user out.
function safeCachedProfile() {
  try {
    const raw = localStorage.getItem('profile')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── checks LIVE session + profile with Supabase, not just localStorage ──
function useAuth() {
  const [authState, setAuthState] = useState('loading') // loading | authed | unauthed
  const [profile,   setProfile]   = useState(null)

  useEffect(() => {
    let cancelled = false

    // Only ever drop the app's own cached profile. NEVER localStorage.clear() —
    // that also wipes Supabase's own sb-*-auth-token, so a transient null
    // session (mobile tab suspend, a slow rehydrate after returning from an
    // eSewa/Khalti redirect) turned into a permanent logout with lost progress.
    function forgetProfile() {
      try { localStorage.removeItem('profile') } catch { /* private mode */ }
    }

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        forgetProfile()
        if (!cancelled) { setProfile(null); setAuthState('unauthed') }
        return
      }
      await loadProfile(session.user.id)
    }

    async function loadProfile(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        // Network hiccup / offline — keep whatever we already had rather than
        // bouncing the user to login. A real "profile deleted" case is handled
        // by the `!data` branch below.
        if (!profile) {
          const cached = safeCachedProfile()
          if (cached) { setProfile(cached); setAuthState('authed'); return }
        }
        return
      }

      if (!data) {
        // Profile row genuinely gone (user was deleted) — force logout.
        await supabase.auth.signOut()
        forgetProfile()
        setProfile(null)
        setAuthState('unauthed')
        return
      }

      try { localStorage.setItem('profile', JSON.stringify(data)) } catch { /* ignore */ }
      setProfile(data)
      setAuthState('authed')
    }

    checkSession()

    // Listen for auth changes. Act ONLY on an explicit sign-out — a bare
    // `!session` also arrives on INITIAL_SESSION and after tab resume, and
    // must not be treated as a logout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        if (event === 'SIGNED_OUT') {
          forgetProfile()
          setProfile(null)
          setAuthState('unauthed')
        } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
          await loadProfile(session.user.id)
        }
      }
    )

    // Re-verify on focus, but gently: only downgrade if Supabase itself reports
    // no session (token already gone), and never wipe storage here.
    async function onFocus() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled && !session) { setProfile(null); setAuthState('unauthed') }
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return { authState, profile }
}

/**
 * Usage (unchanged from before):
 *   <ProtectedRoute roles={['admin', 'staff']}>...</ProtectedRoute>
 *
 * - Verifies a LIVE Supabase session (not just localStorage).
 * - Verifies the user's profile row still exists (catches deleted users).
 * - Verifies profile.role is in the allowed `roles` list.
 */
export default function ProtectedRoute({ roles, children }) {
  const { authState, profile } = useAuth()

  if (authState === 'loading') return <LoadingScreen />
  if (authState === 'unauthed') {
    // Route each role to its own sign-in page.
    const studentOnly = Array.isArray(roles) && roles.length === 1 && roles[0] === 'student'
    // Staff login path is intentionally obscure (see App.jsx) and unlinked.
    return <Navigate to={studentOnly ? '/student-login' : '/team-portal-x7k2f9'} replace />
  }

  if (roles && !roles.includes(profile?.role)) {
    // Logged in, but wrong role for this route — send them somewhere sane.
    if (profile?.role === 'student') return <Navigate to="/student/dashboard" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}