import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function Login() {

  const [view,     setView]     = useState('admin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const navigate = useNavigate()

  function switchView(v) {
    setView(v); setEmail(''); setPassword('')
    setError(''); setSuccess(''); setShowPass(false)
  }

  async function handleAdminLogin(e) {
    e.preventDefault()
    setError('')
    if (!email)    return setError('Enter your email')
    if (!password) return setError('Enter your password')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Wrong email or password'); setLoading(false); return }

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single()

    if (!profile) { setError('Account not found. Contact administrator.'); setLoading(false); return }
    if (profile.role !== 'admin') { setError('Not an admin account. Use Student Login.'); setLoading(false); return }

    localStorage.setItem('profile', JSON.stringify(profile))
    navigate('/dashboard')
    setLoading(false)
  }

  async function handleStudentLogin(e) {
    e.preventDefault()
    setError('')
    if (!email)    return setError('Enter your email')
    if (!password) return setError('Enter your password')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      // Give a more helpful message — could be wrong password OR unconfirmed email
      setError('Wrong email or password. If your account was just created, ask your admin to check setup.')
      setLoading(false)
      return
    }

    // Try to find profile row
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single()

    if (profileError || !profile) {
      // Auth succeeded but no profile row — create one on the fly from auth metadata
      const meta = data.user.user_metadata || {}
      const fallbackProfile = {
        id:    data.user.id,
        name:  meta.name  || data.user.email,
        email: data.user.email,
        role:  meta.role  || 'student',
        phone: meta.phone || '',
      }
      // Try to insert the missing profile
      await supabase.from('profiles').upsert(fallbackProfile)
      localStorage.setItem('profile', JSON.stringify(fallbackProfile))
      if ((meta.role || 'student') === 'student') {
        navigate('/student/dashboard')
      } else {
        setError('Account setup incomplete. Contact administrator.')
      }
      setLoading(false)
      return
    }

    if (profile.role !== 'student') {
      setError('Not a student account. Use Admin Login.')
      setLoading(false)
      return
    }

    localStorage.setItem('profile', JSON.stringify(profile))
    navigate('/student/dashboard')
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: 8, fontSize: 14, color: '#111827', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
  }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }
  const brandColor = view === 'admin' ? '#4F46E5' : '#16a34a'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #f9fafb 50%, #f0fdf4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
        width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden',
      }}>
        {/* logo */}
        <div style={{ padding: '28px 28px 0', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: brandColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 10px', transition: 'background 0.3s',
          }}>
            <img
          src="/src/assets/images/logo.png"
          alt="Global Pathway Logo"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3, marginBottom: 22 }}>Consultancy CRM</div>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', margin: '0 28px 24px', background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
          <button onClick={() => switchView('admin')} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: view === 'admin' ? '#fff' : 'transparent',
            color:      view === 'admin' ? '#4F46E5' : '#6b7280',
            boxShadow:  view === 'admin' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }}>Admin</button>
          <button onClick={() => switchView('student')} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: view === 'student' ? '#fff' : 'transparent',
            color:      view === 'student' ? '#16a34a' : '#6b7280',
            boxShadow:  view === 'student' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }}> Student</button>
        </div>

        <div style={{ padding: '0 28px 28px' }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
              padding: '9px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 7,
            }}> {error}</div>
          )}
          {success && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d',
              padding: '9px 12px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 7,
            }}> {success}</div>
          )}

          {/* ADMIN */}
          {view === 'admin' && (
            <form onSubmit={handleAdminLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" placeholder="admin@globalpathway.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoFocus style={inputStyle} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Enter password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af',
                  }}>{showPass ? '🙈' : '👁 ️'}</button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '11px', background: loading ? '#9ca3af' : '#4F46E5',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>{loading ? 'Signing in...' : ' Sign in as Admin'}</button>
            </form>
          )}

          {/* STUDENT */}
          {view === 'student' && (
            <form onSubmit={handleStudentLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoFocus style={inputStyle} />
              </div>
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Password (your phone number)</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Enter your phone number"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af',
                  }}>{showPass ? '🙈' : '👁 ️'}</button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '11px', background: loading ? '#9ca3af' : '#16a34a',
                border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>{loading ? 'Signing in...' : ' Sign in as Student'}</button>
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
              
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}