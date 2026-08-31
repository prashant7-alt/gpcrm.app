import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { useIsMobile } from '../hooks/useIsMobile'
import { User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Percent } from 'lucide-react'
import { COUNTRIES, COUNTRY_CODES, DEFAULT_VISA_RATES, fetchVisaRates } from '../lib/visaRates'

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
  fontSize: 13, color: theme.textStrong, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: theme.white,
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: theme.textLight, textTransform: 'uppercase',
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
  const [infoMsg,     setInfoMsg]     = useState(null)   // { type: 'ok' | 'err', text }

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw,           setShowPw]         = useState(false)
  const [pwMessage,       setPwMessage]       = useState(null)   // { type, text }
  const [pwLoading,       setPwLoading]       = useState(false)

  // Visa Rates (admin-editable, powers the country cards on the Students page)
  const isAdmin = (storedProfile.role || '') === 'admin'
  const [rates,       setRates]       = useState(DEFAULT_VISA_RATES)
  const [ratesMsg,    setRatesMsg]    = useState(null)   // { type, text }
  const [savingRates, setSavingRates] = useState(false)

  useEffect(() => { loadAccount() }, [])
  useEffect(() => { if (isAdmin) fetchVisaRates().then(setRates) }, [isAdmin])

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
    setInfoMsg(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        name:      name.trim(),
        phone_new: phone.trim(),
      })
      .eq('id', profileId)

    setSavingInfo(false)

    if (error) {
      setInfoMsg({ type: 'err', text: error.message })
      return
    }

    const updated = { ...storedProfile, name: name.trim() }
    localStorage.setItem('profile', JSON.stringify(updated))

    setInfoMsg({ type: 'ok', text: 'Account details updated!' })
    setTimeout(() => setInfoMsg(null), 3000)
  }

  async function changePassword() {
    setPwMessage(null)

    if (!newPassword || newPassword.length < 8) {
      setPwMessage({ type: 'err', text: 'Password must be at least 8 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'err', text: 'Passwords do not match' })
      return
    }

    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwLoading(false)

    if (error) {
      setPwMessage({ type: 'err', text: error.message })
    } else {
      setPwMessage({ type: 'ok', text: 'Password updated successfully!' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function saveRates() {
    setSavingRates(true)
    setRatesMsg(null)

    const rows = COUNTRIES.map(c => {
      const n = Number(rates[c])
      return {
        country: c,
        rate: Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)),
        updated_at: new Date().toISOString(),
        updated_by: profileId || null,
      }
    })

    const { error } = await supabase
      .from('visa_rates')
      .upsert(rows, { onConflict: 'country' })

    setSavingRates(false)

    if (error) {
      setRatesMsg({ type: 'err', text: error.message })
      return
    }
    setRatesMsg({ type: 'ok', text: 'Visa rates saved. The Students page picks them up on next load.' })
    setTimeout(() => setRatesMsg(null), 4000)
  }

  const tabs = [
    { key: 'account',  label: 'My Account',      Icon: User },
    { key: 'password', label: 'Change Password', Icon: Lock },
    ...(isAdmin ? [{ key: 'visarates', label: 'Visa Rates', Icon: Percent }] : []),
  ]

  const sectionCard = {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: isMobile ? 16 : 24,
    marginBottom: 20,
  }

  if (loading) return (
    <div style={{ padding: 40, color: theme.textLight, fontSize: 13 }}>
      Loading settings...
    </div>
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 640 }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textStrong, margin: '0 0 4px' }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
          Manage your account details and password
        </p>
      </div>

      <div style={{
        display: 'flex', gap: 4,
        marginBottom: 20,
        background: theme.surfaceAlt, borderRadius: 10,
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
              background: activeTab === tab.key ? theme.white : 'transparent',
              color: activeTab === tab.key ? theme.textStrong : theme.textLight,
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
            <User size={16} color={theme.primary} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
              My Account
            </h2>
          </div>
          <p style={{ fontSize: 13, color: theme.textLight, margin: '0 0 20px' }}>
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
            <input value={email} disabled style={{ ...inputStyle, background: theme.pageBg, color: theme.textLight }} />
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
              Email is tied to your login and can't be changed here.
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Role</label>
            <div style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 20,
              background: theme.status.success.bg, color: theme.status.success.text, fontSize: 12, fontWeight: 600,
              textTransform: 'capitalize',
            }}>
              {role || 'Staff'}
            </div>
          </div>

          {infoMsg && (
            <div style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 7,
              background: infoMsg.type === 'ok' ? theme.status.success.bg : theme.status.danger.bg,
              color:      infoMsg.type === 'ok' ? theme.status.success.text : theme.status.danger.text,
              border: `1px solid ${infoMsg.type === 'ok' ? theme.status.success.border : theme.status.danger.border}`,
            }}>
              {infoMsg.type === 'ok'
                ? <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                : <AlertCircle size={15} style={{ flexShrink: 0 }} />}
              {infoMsg.text}
            </div>
          )}

          <button
            onClick={saveAccount}
            disabled={savingInfo}
            style={{
              padding: '10px 22px',
              background: savingInfo ? theme.textMuted : theme.textStrong,
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, color: theme.white,
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
            <Lock size={16} color={theme.primary} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
              Change Password
            </h2>
          </div>
          <p style={{ fontSize: 13, color: theme.textLight, margin: '0 0 24px' }}>
            Update your login password. You will stay logged in after changing.
          </p>

          {pwMessage && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              marginBottom: 16, fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 7,
              background: pwMessage.type === 'ok' ? theme.status.success.bg : theme.status.danger.bg,
              color:      pwMessage.type === 'ok' ? theme.status.success.text : theme.status.danger.text,
              border: `1px solid ${pwMessage.type === 'ok' ? theme.status.success.border : theme.status.danger.border}`,
            }}>
              {pwMessage.type === 'ok'
                ? <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                : <AlertCircle size={15} style={{ flexShrink: 0 }} />}
              {pwMessage.text}
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
                    background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted,
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
                background: pwLoading ? theme.textMuted : theme.textStrong,
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: theme.white,
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
            borderTop: `1px solid ${theme.border}`,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: theme.textMuted, textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Current Account
            </div>
            <div style={{ fontSize: 13, color: theme.textMid, wordBreak: 'break-word' }}>
              <strong>{name || storedProfile.name}</strong> — {email}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 6,
              padding: '2px 10px', borderRadius: 20,
              background: theme.status.success.bg, color: theme.status.success.text,
              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
            }}>
              {role}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'visarates' && isAdmin && (
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Percent size={16} color={theme.primary} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
              Visa Success Rates
            </h2>
          </div>
          <p style={{ fontSize: 13, color: theme.textLight, margin: '0 0 20px' }}>
            Shown on the country cards on the Students page. Enter the current student-visa
            success rate (%) for each destination — update these whenever official figures change.
          </p>

          {ratesMsg && (
            <div style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 7,
              background: ratesMsg.type === 'ok' ? theme.status.success.bg : theme.status.danger.bg,
              color:      ratesMsg.type === 'ok' ? theme.status.success.text : theme.status.danger.text,
              border: `1px solid ${ratesMsg.type === 'ok' ? theme.status.success.border : theme.status.danger.border}`,
            }}>
              {ratesMsg.type === 'ok'
                ? <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                : <AlertCircle size={15} style={{ flexShrink: 0 }} />}
              {ratesMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            {COUNTRIES.map(country => (
              <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={`https://flagcdn.com/w40/${COUNTRY_CODES[country]}.png`}
                  alt={country}
                  style={{ width: 28, height: 19, objectFit: 'cover', borderRadius: 3, boxShadow: '0 0 0 1px rgba(0,0,0,0.08)', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: theme.textStrong }}>
                  {country}
                </span>
                <div style={{ position: 'relative', width: 96 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={rates[country] ?? ''}
                    onChange={e => setRates(r => ({ ...r, [country]: e.target.value }))}
                    style={{ ...inputStyle, textAlign: 'right', paddingRight: 28 }}
                  />
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, color: theme.textMuted, pointerEvents: 'none',
                  }}>
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={saveRates}
            disabled={savingRates}
            style={{
              padding: '10px 22px',
              background: savingRates ? theme.textMuted : theme.textStrong,
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, color: theme.white,
              cursor: savingRates ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              width: isMobile ? '100%' : 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <CheckCircle2 size={15} />
            {savingRates ? 'Saving...' : 'Save Rates'}
          </button>
        </div>
      )}

    </div>
  )
}