import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

    let finalProfile = { ...profile }

    if (profile.role === 'student' && !profile.applicant_id) {
      const { data: applicant } = await supabase
        .from('applicants')
        .select('id')
        .ilike('email', profile.email.trim())
        .maybeSingle()

      if (applicant) {
        await supabase
          .from('profiles')
          .update({ applicant_id: applicant.id })
          .eq('id', profile.id)
        finalProfile.applicant_id = applicant.id
      }
    }

    localStorage.setItem('profile', JSON.stringify(finalProfile))
    setLoading(false)

    if (finalProfile.role === 'student') {
      navigate('/student/dashboard')
    } else {
      navigate('/dashboard')
    }
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

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      background: '#f8fafc',
    }}>

      {/* ── left panel — hidden on mobile, compact banner instead ── */}
      {isMobile ? (
        <div style={{
          background: 'linear-gradient(135deg, #0f4c2a 0%, #16a34a 60%, #22c55e 100%)',
          padding: '28px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <img
              src="/src/assets/images/logo.png"
              alt="Logo"
              style={{ width: 24, height: 24, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              Global Pathway
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
              Consultancy CRM System
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          width: '45%',
          background: 'linear-gradient(160deg, #4c240f 0%, #4016a3 60%, #22c55e 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 52px',
          position: 'relative',
          overflow: 'hidden',
        }}>

          {/* background circles */}
          <div style={{
            position: 'absolute', top: -80, right: -80,
            width: 300, height: 300, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: -60,
            width: 240, height: 240, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />
          <div style={{
            position: 'absolute', top: '40%', right: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }} />

          {/* logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 14,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: 16,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
              <img
                src="/src/assets/images/logo.png"
                alt="Logo"
                style={{ width: 150, height: 150,borderRadius: 100, objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none' }}
              />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              Global Pathway
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              Consultancy CRM System
            </div>
          </div>

          {/* center content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 36, fontWeight: 800, color: '#fff',
              lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px',
            }}>
              Your Gateway to<br />Global Education
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, marginBottom: 36 }}>
              Managing student journeys from initial inquiry to successful departure abroad. Trusted by counselors, students, and staff.
            </div>

            {/* feature pills */}
            {[
              '  Application & Pipeline Tracking',
              '  Appointment Management',
              ' Document Verification',
              ' Payment & Fee Tracking',
              '  Visa Status Pipeline',
            ].map(f => (
              <div key={f} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 10,
              }}>
                <div style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.9)',
                  background: 'rgba(255,255,255,0.12)',
                  padding: '6px 14px', borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.2)',
                }}>
                  {f}
                </div>
              </div>
            ))}
          </div>

          {/* bottom */}
          <div style={{
            position: 'relative', zIndex: 1,
            fontSize: 12, color: 'rgba(255,255,255,0.5)',
          }}>
            © 2026 Global Pathway Consultancy. All rights reserved.
          </div>
        </div>
      )}

      {/* ── right panel — login form ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '32px 20px' : '48px 40px',
        background: '#fff',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* heading */}
          <div style={{ marginBottom: isMobile ? 26 : 36 }}>
            <div style={{
              fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#0f172a',
              letterSpacing: '-0.5px', marginBottom: 6,
            }}>
              Welcome back
            </div>
            <div style={{ fontSize: 14, color: '#64748b' }}>
              Sign in to access your portal
            </div>
          </div>

          {/* error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              color: '#dc2626', padding: '11px 14px',
              borderRadius: 10, fontSize: 13, marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>

            {/* email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: '#374151', marginBottom: 6,
              }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus={!isMobile}
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1.5px solid #e2e8f0', borderRadius: 10,
                  fontSize: 14, color: '#0f172a', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  background: '#f8fafc',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* password */}
            <div style={{ marginBottom: 10 }}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: '#374151', marginBottom: 6,
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px',
                    border: '1.5px solid #e2e8f0', borderRadius: 10,
                    fontSize: 14, color: '#0f172a', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                    background: '#f8fafc',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#16a34a'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 12,
                    top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 16, color: '#94a3b8',
                    padding: 4,
                  }}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* forgot password */}
            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <span
                onClick={handleForgotPassword}
                style={{
                  fontSize: 13, color: '#16a34a',
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                Forgot password?
              </span>
            </div>

            {/* submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading
                  ? '#86efac'
                  : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.2px',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(22,163,74,0.35)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>

          </form>

          

        <br />

          {/* bottom note */}
          <div style={{
            textAlign: 'center', fontSize: 12, color: '#94a3b8', lineHeight: 1.6,
          }}>
            Having trouble signing in?<br />
            Contact your administrator for access.
          </div>
          

        </div>
      </div>
    </div>
  )
}