import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [message,         setMessage]         = useState('')
  const [isError,         setIsError]         = useState(false)
  const [sessionReady,    setSessionReady]    = useState(false)

  useEffect(() => {
    // Supabase sends the token in the URL hash
    // onAuthStateChange catches the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true)
        }
      }
    )

    // also check if session already exists from the link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    if (!newPassword || newPassword.length < 6) {
      setIsError(true)
      setMessage('Password must be at least 6 characters')
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
      setTimeout(() => navigate('/login'), 2500)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, color: '#111827', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    background: '#fff',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: 16,
    }}>
      <div style={{
        background: '#fff',
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
            background: '#16a34a',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 24,
          }}>
            🔑
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>
            Set New Password
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Enter your new password below
          </p>
        </div>

        {/* not ready yet */}
        {!sessionReady && (
          <div style={{
            background: '#fef9c3', border: '1px solid #fde047',
            borderRadius: 8, padding: '12px 14px',
            fontSize: 13, color: '#a16207', marginBottom: 20,
          }}>
            ⏳ Verifying your reset link... please wait.
          </div>
        )}

        {/* message */}
        {message && (
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            fontSize: 13, marginBottom: 18,
            background: isError ? '#fee2e2' : '#dcfce7',
            color:      isError ? '#b91c1c' : '#15803d',
            border: `1px solid ${isError ? '#fca5a5' : '#86efac'}`,
          }}>
            {message}
          </div>
        )}

        {/* form */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: '#6b7280', textTransform: 'uppercase',
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
              style={{
                position: 'absolute', right: 12,
                top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                fontSize: 16, cursor: 'pointer', color: '#9ca3af',
              }}
            >
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: '#6b7280', textTransform: 'uppercase',
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
            background: loading || !sessionReady ? '#9ca3af' : '#16a34a',
            border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 700, color: '#fff',
            cursor: loading || !sessionReady ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span
            onClick={() => navigate('/login')}
            style={{
              fontSize: 13, color: '#6b7280',
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