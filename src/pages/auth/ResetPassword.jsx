import { useState, useEffect, useRef } from 'react'
import theme from '../../theme'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../../supabase'

// Capture the landing URL at module load — before supabase-js's detectSessionInUrl
// pass strips the token params out of the address bar.
const LANDING_URL = window.location.href

export default function ResetPassword() {
  const navigate = useNavigate()
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [message,         setMessage]         = useState('')
  const [isError,         setIsError]         = useState(false)
  const [sessionReady,    setSessionReady]    = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    // Run the verification exactly once. A `cancelled` flag is deliberately NOT
    // used here: under React StrictMode the first mount's cleanup would flip it
    // and the guarded second mount would never re-run, leaving the page stuck on
    // "Verifying". This is a one-shot token exchange — let it finish.
    if (ranRef.current) return
    ranRef.current = true

    const fail = msg => { setIsError(true); setMessage(msg) }

    const url    = new URL(LANDING_URL)
    const search = url.searchParams
    const hash   = new URLSearchParams(url.hash.replace(/^#\/?/, ''))
    const get    = k => search.get(k) || hash.get(k)

    const code         = get('code')
    const tokenHash    = get('token_hash') || get('token')
    const type         = get('type')
    const accessToken  = get('access_token')
    const refreshToken = get('refresh_token')
    const urlError     = get('error_description') || get('error')

    ;(async () => {
      try {
        // 1. Supabase handed back an explicit error (expired / already-used link)
        if (urlError) {
          fail('Reset link problem: ' + decodeURIComponent(urlError.replace(/\+/g, ' ')))
          return
        }

        // 2. token_hash flow — verifyOtp, works across browsers/devices
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: type || 'recovery',
            token_hash: tokenHash,
          })
          if (error) { fail('Could not verify reset link: ' + error.message); return }
          setSessionReady(true)
          return
        }

        // 3. implicit flow — session tokens delivered directly in the URL hash
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken, refresh_token: refreshToken,
          })
          if (error) { fail('Could not verify reset link: ' + error.message); return }
          setSessionReady(true)
          return
        }

        // 4. PKCE ?code= flow — supabase-js auto-exchanges it; give that a beat,
        //    then fall back to an explicit exchange so real errors surface.
        if (code) {
          await new Promise(r => setTimeout(r, 1500))
          let { data: { session } } = await supabase.auth.getSession()
          if (session) { setSessionReady(true); return }

          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) { fail('Could not verify reset link: ' + error.message); return }
          setSessionReady(true)
          return
        }

        fail('This page was opened without a valid reset link. Use the ' +
             '"Forgot password?" link on the login page to request one.')
      } catch (e) {
        fail('Could not verify your reset link: ' + (e?.message || String(e)))
      }
    })()
  }, [])

  async function handleReset() {
    if (!newPassword || newPassword.length < 8) {
      setIsError(true)
      setMessage('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setIsError(true)
      setMessage('Passwords do not match')
      return
    }

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    setLoading(false)

    if (error) {
      setIsError(true)
      setMessage('Error: ' + error.message)
    } else {
      setIsError(false)
      setMessage('✅ Password updated successfully! Redirecting to login...')
      await supabase.auth.signOut()
      localStorage.clear()
      setTimeout(() => navigate('/student-login'), 2500)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
    fontSize: 14, color: theme.textStrong, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    background: theme.white,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.surfaceAlt,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: 16,
    }}>
      <div style={{
        background: theme.white,
        borderRadius: 16,
        padding: 40,
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      }}>

        {/* logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: theme.status.success.main,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            color: theme.white,
          }}>
            <KeyRound size={24} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textStrong, margin: 0 }}>
            Set New Password
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 6 }}>
            Enter your new password below
          </p>
        </div>

        {/* not ready yet */}
        {!sessionReady && !message && (
          <div style={{
            background: theme.status.warning.bg, border: `1px solid ${theme.status.warning.border}`,
            borderRadius: 8, padding: '12px 14px',
            fontSize: 13, color: theme.status.warning.text, marginBottom: 20,
          }}>
            ⏳ Verifying your reset link... please wait.
          </div>
        )}

        {/* message */}
        {message && (
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            fontSize: 13, marginBottom: 18,
            background: isError ? theme.status.danger.bg : theme.status.success.bg,
            color:      isError ? theme.status.danger.text : theme.status.success.text,
            border: `1px solid ${isError ? theme.status.danger.border : theme.status.success.border}`,
          }}>
            {message}
          </div>
        )}

        {/* form */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: theme.textLight, textTransform: 'uppercase',
            marginBottom: 5, letterSpacing: '0.04em',
          }}>
            New Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Enter new password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 12,
                top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor: 'pointer', color: theme.textMuted,
                display: 'flex', alignItems: 'center',
              }}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: theme.textLight, textTransform: 'uppercase',
            marginBottom: 5, letterSpacing: '0.04em',
          }}>
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleReset}
          disabled={loading || !sessionReady}
          style={{
            width: '100%', padding: 13,
            background: loading || !sessionReady ? theme.textMuted : theme.status.success.main,
            border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 700, color: theme.white,
            cursor: loading || !sessionReady ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span
            onClick={() => navigate('/student-login')}
            style={{
              fontSize: 13, color: theme.textLight,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Back to Login
          </span>
        </div>
      </div>
    </div>
  )
}