import { useState } from 'react'
import theme from '../../theme'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { supabase } from '../../supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

export default function Login() {

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const navigate  = useNavigate()
  const isMobile  = useIsMobile()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    if (!email)    return setError('Please enter your email')
    if (!password) return setError('Please enter your password')

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      setError('Wrong email or password')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      setError('Account not set up. Contact admin.')
      setLoading(false)
      return
    }

    // This page is the STAFF / ADMIN entry point only. A student account —
    // even with valid credentials — is signed straight back out and pointed
    // at the student login. (Real enforcement is DB row-level security; this
    // is the front-door separation the CRM team asked for.)
    if (profile.role === 'student') {
      await supabase.auth.signOut()
      localStorage.removeItem('profile')
      setLoading(false)
      setError('This is the employee sign-in. Please use the student login instead.')
      return
    }

    localStorage.setItem('profile', JSON.stringify(profile))
    setLoading(false)
    navigate('/dashboard')
  }

  async function handleForgotPassword() {
    const resetEmail = prompt('Enter your email address:')
    if (!resetEmail) return

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) alert('Error: ' + resetError.message)
    else alert('Password reset email sent! Check your inbox.')
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
    fontSize: 14, color: theme.textStrong, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    background: theme.white,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const onFieldFocus = e => {
    e.target.style.borderColor = theme.primary
    e.target.style.boxShadow = `0 0 0 3px ${theme.primaryLight}`
  }
  const onFieldBlur = e => {
    e.target.style.borderColor = theme.inputBorder
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '24px 16px' : '40px',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      background: `radial-gradient(1200px 600px at 50% -10%, ${theme.palette.blueSoft} 0%, ${theme.pageBg} 55%)`,
    }}>

      <div style={{
        width: '100%', maxWidth: 400,
        background: theme.white,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.08)',
        padding: isMobile ? '32px 24px' : '40px 40px',
      }}>

        {/* brand mark */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: 28,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12,
            background: theme.navy,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', marginBottom: 14,
          }}>
            <img
              src="/logo.png"
              alt="Global Pathway"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: theme.textStrong,
            letterSpacing: '-0.2px',
          }}>
            Global Pathway
          </div>
          <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>
            Employee sign in
          </div>
        </div>

        {/* error */}
        {error && (
          <div style={{
            background: theme.status.danger.bg, border: `1px solid ${theme.status.danger.border}`,
            color: theme.status.danger.text, padding: '10px 13px',
            borderRadius: 8, fontSize: 13, marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>

          {/* email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 13, fontWeight: 600,
              color: theme.textMid, marginBottom: 6,
            }}>
              Email address
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus={!isMobile}
              style={inputStyle}
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
          </div>

          {/* password */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 13, fontWeight: 600,
              color: theme.textMid, marginBottom: 6,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, padding: '11px 44px 11px 14px' }}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 10,
                  top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: theme.textLight,
                  padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* forgot password */}
          <div style={{ textAlign: 'right', marginBottom: 22 }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              style={{
                fontSize: 13, color: theme.primary, background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 500,
                fontFamily: 'inherit', padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>

          {/* submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px',
              background: loading ? theme.palette.blueHover : theme.primary,
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              color: theme.white, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = theme.primaryHover }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = theme.primary }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

        </form>

        {/* other portals */}
        <div style={{
          marginTop: 20, paddingTop: 20,
          borderTop: `1px solid ${theme.border}`,
          textAlign: 'center', fontSize: 13, color: theme.textLight,
        }}>
          Student?{' '}
          <Link
            to="/student-login"
            style={{ color: theme.primary, fontWeight: 600, textDecoration: 'none' }}
          >
            Student login
          </Link>
          <span style={{ margin: '0 8px', color: theme.border }}>|</span>
          <Link
            to="/"
            style={{ color: theme.textLight, fontWeight: 500, textDecoration: 'none' }}
          >
            Back
          </Link>
        </div>

      </div>
    </div>
  )
}
