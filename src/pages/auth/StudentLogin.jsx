import { useState } from 'react'
import theme from '../../theme'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertTriangle, Check, GraduationCap } from 'lucide-react'
import { supabase } from '../../supabase'
import { useIsMobile } from '../../hooks/useIsMobile'

const SUPPORT_EMAIL = 'crm.gpnepal@gmail.com'
const GMAIL_COMPOSE = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}`

const FEATURES = [
  'Application & visa status',
  'Document uploads',
  'Appointment booking',
  'Payments & receipts',
  'Chat with your counselor',
]

// Student-only sign in. A staff/admin account signing in here is bounced
// straight back to the staff login. The real access boundary is DB RLS —
// this is the separate front door the CRM team asked for.
export default function StudentLogin() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const navigate = useNavigate()
  const isMobile = useIsMobile()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!email)    return setError('Please enter your email')
    if (!password) return setError('Please enter your password')

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
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
      setError('Account not set up. Contact your counselor.')
      setLoading(false)
      return
    }

    // Only students may use this page.
    if (profile.role !== 'student') {
      await supabase.auth.signOut()
      localStorage.removeItem('profile')
      setLoading(false)
      setError('This is the student sign-in. Please use the employee login instead.')
      return
    }

    let finalProfile = { ...profile }

    // Link the profile to its applicant row on first login so the portal can
    // load this student's application data.
    if (!profile.applicant_id) {
      const { data: applicant } = await supabase
        .from('applicants')
        .select('id')
        .ilike('email', (profile.email || '').trim())
        .maybeSingle()

      if (applicant) {
        await supabase.from('profiles').update({ applicant_id: applicant.id }).eq('id', profile.id)
        finalProfile.applicant_id = applicant.id
      }
    }

    localStorage.setItem('profile', JSON.stringify(finalProfile))
    setLoading(false)
    navigate('/student/dashboard')
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
    e.target.style.borderColor = theme.accent
    e.target.style.boxShadow = `0 0 0 3px ${theme.accentLight}`
  }
  const onFieldBlur = e => {
    e.target.style.borderColor = theme.inputBorder
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      background: theme.pageBg,
    }}>

      {/* ── left brand panel — desktop only ── */}
      {isMobile ? (
        <div style={{
          background: theme.navy,
          padding: '20px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `1px solid ${theme.palette.navyLine}`,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: 'rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, border: '1px solid rgba(255,255,255,0.16)',
          }}>
            <GraduationCap size={22} color={theme.white} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.white, letterSpacing: '-0.2px' }}>
              Global Pathway
            </div>
            <div style={{ fontSize: 12, color: theme.textOnDarkMuted, marginTop: 1 }}>
              Student Portal
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          width: '44%', maxWidth: 560,
          background: theme.navy,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '56px 56px',
          borderRight: `1px solid ${theme.palette.navyLine}`,
        }}>

          {/* brand lockup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: 'rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, border: '1px solid rgba(255,255,255,0.16)',
            }}>
              <GraduationCap size={26} color={theme.white} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: theme.white, letterSpacing: '-0.2px' }}>
                Global Pathway
              </div>
              <div style={{ fontSize: 13, color: theme.textOnDarkMuted, marginTop: 2 }}>
                Student Portal
              </div>
            </div>
          </div>

          {/* value statement */}
          <div>
            <h1 style={{
              fontSize: 30, fontWeight: 700, color: theme.white,
              lineHeight: 1.3, letterSpacing: '-0.4px', margin: '0 0 14px',
            }}>
              Track your journey<br />to studying abroad
            </h1>
            <p style={{
              fontSize: 14, color: theme.textOnDarkMuted, lineHeight: 1.7,
              margin: '0 0 28px', maxWidth: 380,
            }}>
              Sign in to follow your application and visa status, upload documents,
              book appointments and stay in touch with your counselor.
            </p>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {FEATURES.map(f => (
                <li key={f} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13.5, color: theme.textOnDark, marginBottom: 12,
                }}>
                  <Check size={16} color={theme.accent} strokeWidth={3} style={{ flexShrink: 0 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* footer */}
          <div style={{ fontSize: 12, color: theme.textOnDarkMuted }}>
            © 2026 Global Pathway. All rights reserved.
          </div>
        </div>
      )}

      {/* ── right — sign-in form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '40px 20px' : '48px 40px',
        background: theme.pageBg,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* heading */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 24, fontWeight: 700, color: theme.textStrong,
              letterSpacing: '-0.3px', margin: '0 0 6px',
            }}>
              Student sign in
            </h2>
            <p style={{ fontSize: 14, color: theme.textLight, margin: 0 }}>
              Access your student portal
            </p>
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
                placeholder="you@example.com"
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
                  fontSize: 13, color: theme.accent, background: 'none',
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
                background: loading ? theme.accentHover : theme.accent,
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600,
                color: theme.white, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = theme.accentHover }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = theme.accent }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

          </form>

          {/* support note */}
          <div style={{
            marginTop: 22, paddingTop: 20,
            borderTop: `1px solid ${theme.border}`,
            textAlign: 'center', fontSize: 12, color: theme.textMuted, lineHeight: 1.6,
          }}>
            Having trouble signing in? Contact{' '}
            <a
              href={GMAIL_COMPOSE}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}
            >
              {SUPPORT_EMAIL}
            </a>
            <div style={{ marginTop: 10 }}>
              <Link to="/" style={{ color: theme.textLight, fontWeight: 500, textDecoration: 'none' }}>
                &larr; Back
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
