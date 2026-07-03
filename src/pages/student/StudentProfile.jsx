import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#e5e7eb' }
  let score = 0
  if (pw.length >= 8)          score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: 'Too short', color: '#ef4444' },
    { label: 'Weak',      color: '#f97316' },
    { label: 'Fair',      color: '#eab308' },
    { label: 'Good',      color: '#22c55e' },
    { label: 'Strong',    color: '#16a34a' },
  ]
  return { score, ...map[score] }
}

// ── Shared input style ────────────────────────────────────────────────────────
const inp = (disabled) => ({
  width: '100%',
  padding: '10px 13px',
  border: `1px solid ${disabled ? '#f3f4f6' : '#d1d5db'}`,
  borderRadius: 9,
  fontSize: 13,
  color: '#111827',
  background: disabled ? '#f9fafb' : '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color .15s',
})

const lbl = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 5,
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, icon, children }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '16px 22px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StudentProfile() {

  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  // personal info edit
  const [editMode,   setEditMode]   = useState(false)
  const [editName,   setEditName]   = useState('')
  const [editPhone,  setEditPhone]  = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg,    setInfoMsg]    = useState('')

  // password change
  const [pwForm,   setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [showPw,   setShowPw]   = useState({ current: false, next: false, confirm: false })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg,    setPwMsg]    = useState({ text: '', ok: false })

  const strength = getStrength(pwForm.next)

  useEffect(() => { load() }, [])

  async function load() {
    const stored = JSON.parse(localStorage.getItem('profile') || '{}')
    if (!stored.id) { setLoading(false); return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', stored.id)
      .single()

    setProfile(prof)
    setEditName(prof?.name || '')
    setEditPhone(prof?.phone_new || prof?.phone || '')
    setLoading(false)
  }

  // ── Save personal info ─────────────────────────────────────────────────────
  async function saveInfo() {
    if (!editName.trim()) return
    setSavingInfo(true)
    setInfoMsg('')

    const { error } = await supabase
      .from('profiles')
      .update({
        name:      editName.trim(),
        phone_new: editPhone.trim(),
      })
      .eq('id', profile.id)

    setSavingInfo(false)

    if (error) {
      setInfoMsg('❌ ' + error.message)
    } else {
      setProfile(p => ({ ...p, name: editName.trim(), phone_new: editPhone.trim() }))
      localStorage.setItem('profile', JSON.stringify({ ...profile, name: editName.trim() }))
      setInfoMsg('✅ Profile updated!')
      setEditMode(false)
      setTimeout(() => setInfoMsg(''), 3000)
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function changePassword() {
    setPwMsg({ text: '', ok: false })

    if (!pwForm.current)
      return setPwMsg({ text: 'Enter your current password.', ok: false })
    if (pwForm.next.length < 8)
      return setPwMsg({ text: 'New password must be at least 8 characters.', ok: false })
    if (pwForm.next !== pwForm.confirm)
      return setPwMsg({ text: 'Passwords do not match.', ok: false })

    setSavingPw(true)

    // verify current password first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email:    profile.email,
      password: pwForm.current,
    })

    if (signInErr) {
      setSavingPw(false)
      return setPwMsg({ text: '❌ Current password is incorrect.', ok: false })
    }

    // update to new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: pwForm.next,
    })

    setSavingPw(false)

    if (updateErr) {
      setPwMsg({ text: '❌ ' + updateErr.message, ok: false })
    } else {
      setPwMsg({ text: '✅ Password changed successfully!', ok: true })
      setPwForm({ current: '', next: '', confirm: '' })
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StudentLayout>
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
          Loading profile…
        </div>
      </StudentLayout>
    )
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <StudentLayout>
      <div style={{
        fontFamily: "'Segoe UI', Arial, sans-serif",
        maxWidth: 720,
        margin: '0 auto',
      }}>

        {/* Page heading */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            My Profile
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Manage your personal information and account security
          </p>
        </div>

        {/* ══════════════════════════════════════
            PERSONAL INFORMATION
            ══════════════════════════════════════ */}
        <Section
          icon="👤"
          title="Personal Information"
          subtitle="Your registered details — name and phone can be updated"
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            marginBottom: 16,
          }}>

            {/* Full Name */}
            <div>
              <label style={lbl}>Full Name</label>
              <input
                value={editMode ? editName : (profile?.name || '—')}
                onChange={e => setEditName(e.target.value)}
                disabled={!editMode}
                style={inp(!editMode)}
              />
            </div>

            {/* Email — always read only */}
            <div>
              <label style={lbl}>Email Address</label>
              <input
                value={profile?.email || '—'}
                disabled
                style={inp(true)}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                Email cannot be changed. Contact admin.
              </div>
            </div>

            {/* Phone */}
            <div>
              <label style={lbl}>Phone Number</label>
              <input
                value={editMode ? editPhone : (profile?.phone_new || profile?.phone || '—')}
                onChange={e => setEditPhone(e.target.value)}
                disabled={!editMode}
                placeholder="98XXXXXXXX"
                style={inp(!editMode)}
              />
            </div>

            {/* Course — read only */}
            <div>
              <label style={lbl}>Course</label>
              <input
                value={profile?.course || '—'}
                disabled
                style={inp(true)}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                Contact admin to update course.
              </div>
            </div>

          </div>

          {/* info message */}
          {infoMsg && (
            <div style={{
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 14,
              background: infoMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
              color:      infoMsg.startsWith('✅') ? '#15803d' : '#b91c1c',
              border: `1px solid ${infoMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {infoMsg}
            </div>
          )}

          {/* action buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {editMode ? (
              <>
                <button
                  onClick={() => { setEditMode(false); setInfoMsg('') }}
                  style={{
                    padding: '8px 18px',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 13,
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveInfo}
                  disabled={savingInfo}
                  style={{
                    padding: '8px 18px',
                    background: savingInfo ? '#9ca3af' : '#1a56db',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: savingInfo ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {savingInfo ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                style={{
                  padding: '8px 18px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1a56db',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </Section>

        {/* ══════════════════════════════════════
            CHANGE PASSWORD
            ══════════════════════════════════════ */}
        <Section
          icon="🔒"
          title="Change Password"
          subtitle="Keep your account secure — use a strong unique password"
        >
          <div style={{ maxWidth: 420 }}>

            {/* current password */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw.current ? 'text' : 'password'}
                  placeholder="Enter your current password"
                  value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  style={{ ...inp(false), paddingRight: 42 }}
                />
                <button
                  onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 14,
                    color: '#9ca3af', padding: 0,
                  }}
                >
                  {showPw.current ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* new password */}
            <div style={{ marginBottom: 6 }}>
              <label style={lbl}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw.next ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
                  style={{ ...inp(false), paddingRight: 42 }}
                />
                <button
                  onClick={() => setShowPw(s => ({ ...s, next: !s.next }))}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 14,
                    color: '#9ca3af', padding: 0,
                  }}
                >
                  {showPw.next ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* strength meter — only shows while typing */}
            {pwForm.next && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 99,
                      background: i < strength.score ? strength.color : '#e5e7eb',
                      transition: 'background .2s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>
                  {strength.label}
                  <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
                    — use uppercase, numbers &amp; symbols
                  </span>
                </div>
              </div>
            )}

            {/* confirm password */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw.confirm ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                  style={{
                    ...inp(false),
                    paddingRight: 42,
                    borderColor:
                      pwForm.confirm && pwForm.next !== pwForm.confirm
                        ? '#ef4444'
                        : undefined,
                  }}
                />
                <button
                  onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 14,
                    color: '#9ca3af', padding: 0,
                  }}
                >
                  {showPw.confirm ? '🙈' : '👁️'}
                </button>
              </div>

              {/* match / no match indicator */}
              {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                  ✕ Passwords do not match
                </div>
              )}
              {pwForm.confirm && pwForm.next === pwForm.confirm && (
                <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
                  ✓ Passwords match
                </div>
              )}
            </div>

            {/* feedback message */}
            {pwMsg.text && (
              <div style={{
                padding: '9px 14px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                background: pwMsg.ok ? '#f0fdf4' : '#fef2f2',
                color:      pwMsg.ok ? '#15803d' : '#b91c1c',
                border: `1px solid ${pwMsg.ok ? '#bbf7d0' : '#fecaca'}`,
              }}>
                {pwMsg.text}
              </div>
            )}

            <button
              onClick={changePassword}
              disabled={savingPw}
              style={{
                padding: '10px 22px',
                background: savingPw ? '#9ca3af' : '#1a56db',
                border: 'none',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                cursor: savingPw ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: savingPw ? 'none' : '0 2px 8px rgba(26,86,219,.25)',
              }}
            >
              {savingPw ? 'Updating…' : '🔒 Update Password'}
            </button>

          </div>
        </Section>

        {/* ══════════════════════════════════════
            CONTACT ADMIN BANNER
            ══════════════════════════════════════ */}
        <div style={{
          background: '#fff',
          border: '1px solid #fecaca',
          borderRadius: 14,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 3 }}>
              Need to update your email, course or country?
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
              Email, course and country changes must be processed by your counsellor.
              Contact Global Pathway and they will update your profile.
            </div>
          </div>
          <a
            href="mailto:crm.gpnepal@gmail.com"
            style={{
              padding: '8px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#b91c1c',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            📧 Contact Admin
          </a>
        </div>

      </div>
    </StudentLayout>
  )
}