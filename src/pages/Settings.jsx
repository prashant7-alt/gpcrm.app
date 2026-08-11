import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { User, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase',
  marginBottom: 5, letterSpacing: '0.04em',
}

export default function Settings() {
  const isMobile = useIsMobile()
  const storedProfile = JSON.parse(localStorage.getItem('profile') || '{}')

  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('account')

  const [profileId,   setProfileId]   = useState(storedProfile.id || null)
  const [email,       setEmail]       = useState(storedProfile.email || '')
  const [role,        setRole]        = useState(storedProfile.role || '')
  const [name,        setName]        = useState(storedProfile.name || '')
  const [phone,       setPhone]       = useState('')
  const [savingInfo,  setSavingInfo]  = useState(false)
  const [infoMsg,     setInfoMsg]     = useState('')

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw,           setShowPw]         = useState(false)
  const [pwMessage,       setPwMessage]       = useState('')
  const [pwLoading,       setPwLoading]       = useState(false)

  useEffect(() => { loadAccount() }, [])

  async function loadAccount() {
    setLoading(true)
    if (storedProfile.id) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', storedProfile.id)
        .maybeSingle()

      if (data) {
        setProfileId(data.id)
        setName(data.name || '')
        setEmail(data.email || storedProfile.email || '')
        setRole(data.role || storedProfile.role || '')
        setPhone(data.phone_new || data.phone || '')
      }
    }
    setLoading(false)
  }

  async function saveAccount() {
    if (!name.trim()) return alert('Name is required')
    if (!profileId)   return alert('Could not find your profile record')

    setSavingInfo(true)
    setInfoMsg('')

    const { error } = await supabase
      .from('profiles')
      .update({
        name:      name.trim(),
        phone_new: phone.trim(),
      })
      .eq('id', profileId)

    setSavingInfo(false)

    if (error) {
      setInfoMsg('❌ ' + error.message)
      return
    }

    const updated = { ...storedProfile, name: name.trim() }
    localStorage.setItem('profile', JSON.stringify(updated))

    setInfoMsg('✅ Account details updated!')
    setTimeout(() => setInfoMsg(''), 3000)
  }

  async function changePassword() {
    setPwMessage('')

    if (!newPassword || newPassword.length < 6) {
      setPwMessage('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('Passwords do not match')
      return
    }

    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)

    if (error) {
      setPwMessage('Error: ' + error.message)
    } else {
      setPwMessage('✅ Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const tabs = [
    { key: 'account',  label: 'My Account',      Icon: User },
    { key: 'password', label: 'Change Password', Icon: Lock },
  ]

  const sectionCard = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: isMobile ? 16 : 24,
    marginBottom: 20,
  }

  if (loading) return (
    <div style={{ padding: 40, color: '#6b7280', fontSize: 13 }}>
      Loading settings...
    </div>
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 640 }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Manage your account details and password
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 4,
        marginBottom: 20,
        background: '#f3f4f6', borderRadius: 10,
        padding: 4,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '9px 16px',
              borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#111827' : '#6b7280',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <tab.Icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'account' && (
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <User size={16} color="#1a56db" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
              My Account
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Update your name and phone number. Changes appear in the sidebar and across the CRM immediately.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Full Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Phone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input value={email} disabled style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280' }} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
              Email is tied to your login and can't be changed here.
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Role</label>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 20,
              background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 600,
              textTransform: 'capitalize',
            }}>
              {role || 'Staff'}
            </div>
          </div>

          {infoMsg && (
            <div style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              background: infoMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
              color:      infoMsg.startsWith('✅') ? '#15803d' : '#b91c1c',
              border: `1px solid ${infoMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {infoMsg}
            </div>
          )}

          <button
            onClick={saveAccount}
            disabled={savingInfo}
            style={{
              padding: '10px 22px',
              background: savingInfo ? '#9ca3af' : '#111827',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, color: '#fff',
              cursor: savingInfo ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              width: isMobile ? '100%' : 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <CheckCircle2 size={15} />
            {savingInfo ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {activeTab === 'password' && (
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Lock size={16} color="#1a56db" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
              Change Password
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            Update your login password. You will stay logged in after changing.
          </p>

          {pwMessage && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              marginBottom: 16, fontSize: 13,
              background: pwMessage.startsWith('✅') ? '#dcfce7' : '#fee2e2',
              color:      pwMessage.startsWith('✅') ? '#15803d' : '#b91c1c',
              border: `1px solid ${pwMessage.startsWith('✅') ? '#86efac' : '#fca5a5'}`,
            }}>
              {pwMessage}
            </div>
          )}

          <div style={{ maxWidth: isMobile ? '100%' : 380 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 42 }}
                />
                <button
                  onClick={() => setShowPw(s => !s)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                    display: 'flex', padding: 0,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              onClick={changePassword}
              disabled={pwLoading}
              style={{
                width: '100%', padding: 12,
                background: pwLoading ? '#9ca3af' : '#111827',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: '#fff',
                cursor: pwLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Lock size={15} />
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>

          <div style={{
            marginTop: 32, paddingTop: 20,
            borderTop: '1px solid #e5e7eb',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: '#9ca3af', textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Current Account
            </div>
            <div style={{ fontSize: 13, color: '#374151', wordBreak: 'break-word' }}>
              <strong>{name || storedProfile.name}</strong> — {email}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 6,
              padding: '2px 10px', borderRadius: 20,
              background: '#dcfce7', color: '#15803d',
              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
            }}>
              {role}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}