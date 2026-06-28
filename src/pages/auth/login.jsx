import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email)    { setError('Please enter email');    return }
    if (!password) { setError('Please enter password'); return }
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth
      .signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    localStorage.setItem('profile', JSON.stringify(profile))

    // admin and staff both go to /dashboard
    // student goes to /student/dashboard
    if (profile?.role === 'student') {
      navigate('/student/dashboard')
    } else {
      navigate('/dashboard')
    }

    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    background: '#f9fafb', border: '1px solid #e5e7eb',
    borderRadius: 8, fontSize: 13, color: '#374151',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 16, padding: 40, width: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44 }}></div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 8 }}>
            Global Pathway
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            CRM System
          </p>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          Welcome Back
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          Sign in to continue
        </p>
        

        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5',
            color: '#b91c1c', padding: '10px 14px',
            borderRadius: 8, fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: '#6b7280', textTransform: 'uppercase', marginBottom: 5,
            }}>
              Email
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              color: '#6b7280', textTransform: 'uppercase', marginBottom: 5,
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 42 }}
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
                {showPass ? '👁' : '👁'}
              </button>
            </div>
          </div>
         
<div
  onClick={async () => {
    const email = prompt('Enter your email address:')
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password',
    })
    if (error) alert('Error: ' + error.message)
    else alert('Password reset email sent! Check your inbox.')
  }}
  style={{
    textAlign: 'center', marginTop: 12,
    fontSize: 13, color: '#1a56db',
    cursor: 'pointer', textDecoration: 'underline',
  }}
>
  Forgot password?
</div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 12,
              background: loading ? '#9ca3af' : '#16a34a',
              border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  )
}