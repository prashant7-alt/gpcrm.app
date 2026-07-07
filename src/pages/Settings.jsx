import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'

const ALL_SLOTS = [
  '9:00 AM','9:30 AM','10:00 AM','10:30 AM',
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM',
  '1:00 PM','1:30 PM','2:00 PM','2:30 PM',
  '3:00 PM','3:30 PM','4:00 PM','4:30 PM','5:00 PM',
]

const ALL_COUNTRIES = [
  'Korea','Australia','Japan','UK',
  'USA','Canada','Finland','Others',
]

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

const sectionCard = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 24,
  marginBottom: 20,
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', padding: '14px 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div
        onClick={onChange}
        style={{
          width: 44, height: 24, borderRadius: 99,
          background: checked ? '#16a34a' : '#d1d5db',
          position: 'relative', cursor: 'pointer',
          transition: 'background 0.2s', flexShrink: 0,
          marginLeft: 16,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 3, left: checked ? 23 : 3,
          width: 18, height: 18,
          borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}

export default function Settings() {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  // ── form state ──
  const [consultancyName,    setConsultancyName]    = useState('')
  const [consultancyEmail,   setConsultancyEmail]   = useState('')
  const [consultancyPhone,   setConsultancyPhone]   = useState('')
  const [consultancyAddress, setConsultancyAddress] = useState('')
  const [consultancyWebsite, setConsultancyWebsite] = useState('')

  const [notifyLogin,       setNotifyLogin]       = useState(true)
  const [notifyAppointment, setNotifyAppointment] = useState(true)
  const [notifyPayment,     setNotifyPayment]     = useState(true)

  const [activeSlots,     setActiveSlots]     = useState([])
  const [activeCountries, setActiveCountries] = useState([])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMessage,       setPwMessage]       = useState('')
  const [pwLoading,       setPwLoading]       = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    setLoading(true)
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (data) {
      setConsultancyName(data.consultancy_name    || '')
      setConsultancyEmail(data.consultancy_email  || '')
      setConsultancyPhone(data.consultancy_phone  || '')
      setConsultancyAddress(data.consultancy_address || '')
      setConsultancyWebsite(data.consultancy_website || '')
      setNotifyLogin(data.notify_login_created         ?? true)
      setNotifyAppointment(data.notify_appointment_confirmed ?? true)
      setNotifyPayment(data.notify_payment_confirmed   ?? true)
      setActiveSlots(data.appointment_slots   || [])
      setActiveCountries(data.active_countries || [])
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('settings')
      .update({
        consultancy_name:              consultancyName.trim(),
        consultancy_email:             consultancyEmail.trim(),
        consultancy_phone:             consultancyPhone.trim(),
        consultancy_address:           consultancyAddress.trim(),
        consultancy_website:           consultancyWebsite.trim(),
        notify_login_created:          notifyLogin,
        notify_appointment_confirmed:  notifyAppointment,
        notify_payment_confirmed:      notifyPayment,
        appointment_slots:             activeSlots,
        active_countries:              activeCountries,
        updated_at:                    new Date().toISOString(),
      })
      .eq('id', 1)

    setSaving(false)
    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPwMessage('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage('Passwords do not match')
      return
    }
    setPwLoading(true)
    setPwMessage('')

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPwMessage('Error: ' + error.message)
    } else {
      setPwMessage('✅ Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwLoading(false)
  }

  function toggleSlot(slot) {
    setActiveSlots(prev =>
      prev.includes(slot) ? prev.filter(s => s !== slot) : [...prev, slot]
    )
  }

  function toggleCountry(country) {
    setActiveCountries(prev =>
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    )
  }

  const tabs = [
    { key: 'profile',       label: 'Consultancy Profile' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'slots',         label: 'Appointment Slots' },
    { key: 'countries',     label: 'Active Countries' },
    { key: 'password',      label: 'Change Password' },
  ]

  if (loading) return (
    <div style={{ padding: 40, color: '#6b7280', fontSize: 13 }}>
      Loading settings...
    </div>
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 760 }}>

      {/* ── header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Settings
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Manage your consultancy preferences
          </p>
        </div>

        {/* save button — only show on non-password tabs */}
        {activeTab !== 'password' && (
          <button
            onClick={saveSettings}
            disabled={saving}
            style={{
              padding: '9px 22px',
              background: saved ? '#15803d' : saving ? '#9ca3af' : '#111827',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.2s',
            }}
          >
            {saved ? '✅ Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* ── tabs ── */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        marginBottom: 20,
        background: '#f3f4f6', borderRadius: 10,
        padding: 4,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#111827' : '#6b7280',
              boxShadow: activeTab === tab.key
                ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════
          TAB 1 — CONSULTANCY PROFILE
          ══════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div style={sectionCard}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 18px' }}>
            Consultancy Profile
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            This information appears throughout the CRM and in student emails.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Consultancy Name *</label>
              <input
                value={consultancyName}
                onChange={e => setConsultancyName(e.target.value)}
                placeholder="Global Pathway Pvt. Ltd."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                value={consultancyEmail}
                onChange={e => setConsultancyEmail(e.target.value)}
                placeholder="info@globalpathway.com.np"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                value={consultancyPhone}
                onChange={e => setConsultancyPhone(e.target.value)}
                placeholder="01-XXXXXXX"
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Address</label>
              <input
                value={consultancyAddress}
                onChange={e => setConsultancyAddress(e.target.value)}
                placeholder="Kathmandu, Nepal"
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Website</label>
              <input
                value={consultancyWebsite}
                onChange={e => setConsultancyWebsite(e.target.value)}
                placeholder="https://globalpathway.com.np"
                style={inputStyle}
              />
            </div>
          </div>

          {/* preview card */}
          <div style={{
            marginTop: 24, padding: 16,
            background: '#f9fafb', border: '1px solid #e5e7eb',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af',
              textTransform: 'uppercase', marginBottom: 10 }}>
              Preview
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {consultancyName || 'Your Consultancy Name'}
            </div>
            {consultancyEmail && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                ✉️ {consultancyEmail}
              </div>
            )}
            {consultancyPhone && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                📞 {consultancyPhone}
              </div>
            )}
            {consultancyAddress && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                📍 {consultancyAddress}
              </div>
            )}
            {consultancyWebsite && (
              <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 2 }}>
                🌐 {consultancyWebsite}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 2 — NOTIFICATIONS
          ══════════════════════════════════════ */}
      {activeTab === 'notifications' && (
        <div style={sectionCard}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Email Notification Preferences
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Control which events trigger automatic emails to students.
            Emails are sent via Resend.
          </p>

          <Toggle
            checked={notifyLogin}
            onChange={() => setNotifyLogin(!notifyLogin)}
            label="New Student Login Created"
            description="Send email with credentials when a new applicant account is created"
          />
          <Toggle
            checked={notifyAppointment}
            onChange={() => setNotifyAppointment(!notifyAppointment)}
            label="Appointment Confirmed"
            description="Send confirmation email when admin accepts a student's appointment"
          />
          <Toggle
            checked={notifyPayment}
            onChange={() => setNotifyPayment(!notifyPayment)}
            label="Payment Confirmed"
            description="Send receipt email when admin marks a payment as paid"
          />

          <div style={{
            marginTop: 20, padding: '12px 14px',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 8, fontSize: 12, color: '#1e40af',
          }}>
            ℹ️ Toggling these off here saves the preference — you also need to check
            the actual send call in your code to read this setting before sending.
            These toggles tell you the admin's preference; your email functions should
            read from the settings table before calling the Resend API.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 3 — APPOINTMENT SLOTS
          ══════════════════════════════════════ */}
      {activeTab === 'slots' && (
        <div style={sectionCard}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Appointment Time Slots
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Check the slots you want to offer for appointment bookings.
            Students will only see checked slots when booking.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
          }}>
            {ALL_SLOTS.map(slot => {
              const active = activeSlots.includes(slot)
              return (
                <div
                  key={slot}
                  onClick={() => toggleSlot(slot)}
                  style={{
                    padding: '10px 14px',
                    border: active ? '2px solid #16a34a' : '2px solid #e5e7eb',
                    borderRadius: 8,
                    background: active ? '#f0fdf4' : '#f9fafb',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? '#15803d' : '#374151',
                    textAlign: 'center',
                    transition: 'all 0.12s',
                    userSelect: 'none',
                  }}
                >
                  {active ? '✓ ' : ''}{slot}
                </div>
              )
            })}
          </div>

          <div style={{
            marginTop: 16, fontSize: 12, color: '#6b7280',
          }}>
            {activeSlots.length} of {ALL_SLOTS.length} slots active
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 4 — ACTIVE COUNTRIES
          ══════════════════════════════════════ */}
      {activeTab === 'countries' && (
        <div style={sectionCard}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Active Destination Countries
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
            Select which destination countries your consultancy currently
            handles. Active countries appear on the Students page and
            in student application forms.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
          }}>
            {ALL_COUNTRIES.map(country => {
              const active = activeCountries.includes(country)
              const flags = {
                Korea: '🇰🇷', Australia: '🇦🇺', Japan: '🇯🇵',
                UK: '🇬🇧', USA: '🇺🇸', Canada: '🇨🇦',
                Finland: '🇫🇮', Others: '🌍',
              }
              return (
                <div
                  key={country}
                  onClick={() => toggleCountry(country)}
                  style={{
                    padding: '14px 10px',
                    border: active ? '2px solid #1d4ed8' : '2px solid #e5e7eb',
                    borderRadius: 10,
                    background: active ? '#eff6ff' : '#f9fafb',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.12s',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>
                    {flags[country] || '🌍'}
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: active ? 700 : 400,
                    color: active ? '#1d4ed8' : '#374151',
                  }}>
                    {country}
                  </div>
                  {active && (
                    <div style={{
                      fontSize: 10, color: '#16a34a',
                      fontWeight: 700, marginTop: 4,
                    }}>
                      Active
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
            {activeCountries.length} of {ALL_COUNTRIES.length} countries active
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB 5 — CHANGE PASSWORD
          ══════════════════════════════════════ */}
      {activeTab === 'password' && (
        <div style={sectionCard}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Change Password
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
            Update your admin login password. You will stay logged in after changing.
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

          <div style={{ maxWidth: 380 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password"
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
              }}
            >
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
            <div style={{ fontSize: 13, color: '#374151' }}>
              <strong>{profile.name}</strong> — {profile.email}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 6,
              padding: '2px 10px', borderRadius: 20,
              background: '#dcfce7', color: '#15803d',
              fontSize: 11, fontWeight: 600,
            }}>
              {profile.role}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}