import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase'

// ── loading screen while checking session ──
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f9fafb', fontFamily: 'inherit',
    }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 14 }}>Loading...</div>
      </div>
    </div>
  )
}

// ── checks LIVE session + profile with Supabase, not just localStorage ──
function useAuth() {
  const [authState, setAuthState] = useState('loading') // loading | authed | unauthed
  const [profile,   setProfile]   = useState(null)

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        localStorage.clear()
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

      if (error || !data) {
        // Profile row is gone (user was deleted) or unreadable — force logout.
        await supabase.auth.signOut()
        localStorage.clear()
        setProfile(null)
        setAuthState('unauthed')
        return
      }

      localStorage.setItem('profile', JSON.stringify(data))
      setProfile(data)
      setAuthState('authed')
    }

    checkSession()

    // Listen for auth changes (logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        if (event === 'SIGNED_OUT' || !session) {
          localStorage.clear()
          setProfile(null)
          setAuthState('unauthed')
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await loadProfile(session.user.id)
        }
      }
    )

    // Re-verify the profile still exists whenever the tab regains focus —
    // catches the case where an admin deletes the user in another tab/session
    // while this tab is sitting open with an unexpired token.
    function onFocus() { checkSession() }
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
  if (authState === 'unauthed') return <Navigate to="/login" replace />

  if (roles && !roles.includes(profile?.role)) {
    // Logged in, but wrong role for this route — send them somewhere sane.
    if (profile?.role === 'student') return <Navigate to="/student/dashboard" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}