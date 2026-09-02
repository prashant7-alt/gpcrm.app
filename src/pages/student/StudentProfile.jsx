import { useState, useEffect } from 'react'
import theme from '../../theme'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus'
import {
  User, Lock, Pencil, Eye, EyeOff,
  AlertTriangle, Mail, Check, X, GraduationCap,
} from 'lucide-react'

// Self-reported academic fields the student manages themselves. Kept in one
// place so the form, the loader and the save all stay in sync.
const EDU_FIELDS = [
  { key: 'education_level',  label: 'Highest Qualification', placeholder: "e.g. +2 / High School, Bachelor's" },
  { key: 'grade',            label: 'Grade / GPA',           placeholder: 'e.g. 3.6 / 4.0 or 78%' },
  { key: 'institution',      label: 'School / College',      placeholder: 'Last institution attended' },
  { key: 'field_of_study',   label: 'Field of Study',        placeholder: 'e.g. Science, Management' },
  { key: 'english_test',     label: 'English Test Score',    placeholder: 'e.g. IELTS 7.0, PTE 65' },
  { key: 'preferred_intake', label: 'Preferred Intake',      placeholder: 'e.g. Fall 2026' },
]
const blankEdu = () => Object.fromEntries(EDU_FIELDS.map(f => [f.key, '']))

// Same as the login page — open a Gmail compose tab instead of the OS mail
// client (which is Outlook on Windows for a plain mailto: link).
const SUPPORT_EMAIL = 'crm.gpnepal@gmail.com'
const GMAIL_COMPOSE = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}`

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: theme.border }
  let score = 0
  if (pw.length >= 8)          score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const map = [
    { label: 'Too short', color: theme.status.danger.main },
    { label: 'Weak',      color: theme.status.warning.main },
    { label: 'Fair',      color: theme.status.warning.text },
    { label: 'Good',      color: theme.status.success.main },
    { label: 'Strong',    color: theme.status.success.main },
  ]
  return { score, ...map[score] }
}

// ── Shared input style ────────────────────────────────────────────────────────
const inp = (disabled) => ({
  width: '100%',
  padding: '10px 13px',
  border: `1px solid ${disabled ? theme.surfaceAlt : theme.inputBorder}`,
  borderRadius: 9,
  fontSize: 13,
  color: theme.textStrong,
  background: disabled ? theme.pageBg : theme.white,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color .15s',
})

const lbl = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: theme.textLight,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 5,
}

// ── Section wrapper — icon is now a lucide component, not emoji ─────────────
function Section({ title, subtitle, Icon, iconBg, iconColor, isMobile, children }) {
  return (
    <div style={{
      background: theme.white,
      border: `1px solid ${theme.border}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      marginBottom: 16,
    }}>
      <div style={{
        padding: isMobile ? '14px 16px' : '16px 22px',
        borderBottom: `1px solid ${theme.surfaceAlt}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} color={iconColor} strokeWidth={2.2} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.textStrong }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>{subtitle}</div>
          )}
        </div>
      </div>
      <div style={{ padding: isMobile ? '16px' : '20px 22px' }}>{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StudentProfile() {
  const isMobile = useIsMobile()

  const [profile,  setProfile]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  // personal info edit
  const [editMode,   setEditMode]   = useState(false)
  const [editName,   setEditName]   = useState('')
  const [editPhone,  setEditPhone]  = useState('')
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoMsg,    setInfoMsg]    = useState('')

  // academic background edit (self-reported, student-managed)
  const [eduMode,   setEduMode]   = useState(false)
  const [eduForm,   setEduForm]   = useState(blankEdu)
  const [savingEdu, setSavingEdu] = useState(false)
  const [eduMsg,    setEduMsg]    = useState('')

  // password change
  const [pwForm,   setPwForm]   = useState({ current: '', next: '', confirm: '' })
  const [showPw,   setShowPw]   = useState({ current: false, next: false, confirm: false })
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg,    setPwMsg]    = useState({ text: '', ok: false })

  const strength = getStrength(pwForm.next)

  useEffect(() => { load() }, [])
  useRefetchOnFocus(load)

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
    setEduForm(Object.fromEntries(EDU_FIELDS.map(f => [f.key, prof?.[f.key] || ''])))
    setLoading(false)
  }

  // ── Save academic background ───────────────────────────────────────────────
  async function saveEdu() {
    setSavingEdu(true)
    setEduMsg('')

    const patch = Object.fromEntries(
      EDU_FIELDS.map(f => [f.key, eduForm[f.key].trim() || null])
    )

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)

    setSavingEdu(false)

    if (error) {
      setEduMsg('error:' + error.message)
    } else {
      setProfile(p => ({ ...p, ...patch }))
      setEduMsg('success:Academic background saved!')
      setEduMode(false)
      setTimeout(() => setEduMsg(''), 3000)
    }
  }

  // ── Save personal info ─────────────────────────────────────────────────────
  async function saveInfo() {
    if (!editName.trim()) return
    setSavingInfo(true)
    setInfoMsg('')

    const name  = editName.trim()
    const phone = editPhone.trim()

    const { error } = await supabase
      .from('profiles')
      .update({ name, phone_new: phone })
      .eq('id', profile.id)

    // Mirror the change onto the linked applicant row — every staff screen
    // reads `applicants`, so without this the edit only shows in the portal.
    // RLS restricts this to the student's own row and to name + phone only.
    if (!error) {
      if (profile.applicant_id) {
        await supabase.from('applicants').update({ name, phone }).eq('id', profile.applicant_id)
      } else if (profile.email) {
        await supabase.from('applicants').update({ name, phone }).ilike('email', profile.email.trim())
      }
    }

    setSavingInfo(false)

    if (error) {
      setInfoMsg('error:' + error.message)
    } else {
      setProfile(p => ({ ...p, name, phone_new: phone }))
      localStorage.setItem('profile', JSON.stringify({ ...profile, name }))
      setInfoMsg('success:Profile updated!')
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
      return setPwMsg({ text: 'Current password is incorrect.', ok: false })
    }

    // update to new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: pwForm.next,
    })

    setSavingPw(false)

    if (updateErr) {
      setPwMsg({ text: updateErr.message, ok: false })
    } else {
      setPwMsg({ text: 'Password changed successfully!', ok: true })
      setPwForm({ current: '', next: '', confirm: '' })
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <StudentLayout>
        <div style={{ textAlign: 'center', padding: 60, color: theme.textMuted, fontSize: 14 }}>
          Loading profile…
        </div>
      </StudentLayout>
    )
  }

  const [infoStatus, infoText] = infoMsg ? infoMsg.split(':') : [null, '']
  const infoIsSuccess = infoStatus === 'success'

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
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textStrong, margin: '0 0 4px' }}>
            My Profile
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
            Manage your personal information and account security
          </p>
        </div>

        {/* ══════════════════════════════════════
            PERSONAL INFORMATION
            ══════════════════════════════════════ */}
        <Section
          Icon={User}
          iconBg={theme.purpleLight}
          iconColor={theme.purple}
          title="Personal Information"
          subtitle="Your registered details — name and phone can be updated"
          isMobile={isMobile}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
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
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>
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
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>
                Contact admin to update course.
              </div>
            </div>

          </div>

          {/* info message */}
          {infoMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 14,
              background: infoIsSuccess ? theme.status.success.bg : theme.status.danger.bg,
              color:      infoIsSuccess ? theme.status.success.text : theme.status.danger.text,
              border: `1px solid ${infoIsSuccess ? theme.status.success.border : theme.status.danger.border}`,
            }}>
              {infoIsSuccess
                ? <Check size={15} strokeWidth={2.6} />
                : <X size={15} strokeWidth={2.6} />}
              {infoText}
            </div>
          )}

          {/* action buttons */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            flexDirection: isMobile ? 'column-reverse' : 'row',
          }}>
            {editMode ? (
              <>
                <button
                  onClick={() => { setEditMode(false); setInfoMsg('') }}
                  style={{
                    padding: '8px 18px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    color: theme.textLight,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveInfo}
                  disabled={savingInfo}
                  style={{
                    padding: '8px 18px',
                    background: savingInfo ? theme.textMuted : theme.primary,
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.white,
                    cursor: savingInfo ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    width: isMobile ? '100%' : 'auto',
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
                  background: theme.status.info.bg,
                  border: `1px solid ${theme.status.info.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.primary,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: isMobile ? '100%' : 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Pencil size={14} strokeWidth={2.4} />
                Edit Profile
              </button>
            )}
          </div>
        </Section>

        {/* ══════════════════════════════════════
            ACADEMIC BACKGROUND  (self-reported)
            ══════════════════════════════════════ */}
        <Section
          Icon={GraduationCap}
          iconBg={theme.status.info.bg}
          iconColor={theme.primary}
          title="Academic Background"
          subtitle="Your grades, course and study details — visible to your counsellor"
          isMobile={isMobile}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 14,
            marginBottom: 16,
          }}>
            {EDU_FIELDS.map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}</label>
                <input
                  value={eduMode ? eduForm[f.key] : (profile?.[f.key] || '—')}
                  onChange={e => setEduForm(p => ({ ...p, [f.key]: e.target.value }))}
                  disabled={!eduMode}
                  placeholder={f.placeholder}
                  style={inp(!eduMode)}
                />
              </div>
            ))}
          </div>

          {eduMsg && (() => {
            const ok = eduMsg.startsWith('success:')
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14,
                background: ok ? theme.status.success.bg : theme.status.danger.bg,
                color:      ok ? theme.status.success.text : theme.status.danger.text,
                border: `1px solid ${ok ? theme.status.success.border : theme.status.danger.border}`,
              }}>
                {ok ? <Check size={15} strokeWidth={2.6} /> : <X size={15} strokeWidth={2.6} />}
                {eduMsg.slice(eduMsg.indexOf(':') + 1)}
              </div>
            )
          })()}

          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            flexDirection: isMobile ? 'column-reverse' : 'row',
          }}>
            {eduMode ? (
              <>
                <button
                  onClick={() => {
                    setEduForm(Object.fromEntries(EDU_FIELDS.map(f => [f.key, profile?.[f.key] || ''])))
                    setEduMode(false)
                    setEduMsg('')
                  }}
                  style={{
                    padding: '8px 18px', background: theme.pageBg,
                    border: `1px solid ${theme.border}`, borderRadius: 8,
                    fontSize: 13, color: theme.textLight, cursor: 'pointer',
                    fontFamily: 'inherit', width: isMobile ? '100%' : 'auto',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdu}
                  disabled={savingEdu}
                  style={{
                    padding: '8px 18px',
                    background: savingEdu ? theme.textMuted : theme.primary,
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, color: theme.white,
                    cursor: savingEdu ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', width: isMobile ? '100%' : 'auto',
                  }}
                >
                  {savingEdu ? 'Saving…' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEduMode(true)}
                style={{
                  padding: '8px 18px',
                  background: theme.status.info.bg,
                  border: `1px solid ${theme.status.info.border}`,
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: theme.primary, cursor: 'pointer', fontFamily: 'inherit',
                  width: isMobile ? '100%' : 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Pencil size={14} strokeWidth={2.4} />
                {EDU_FIELDS.some(f => profile?.[f.key]) ? 'Edit Details' : 'Add Details'}
              </button>
            )}
          </div>
        </Section>

        {/* ══════════════════════════════════════
            CHANGE PASSWORD
            ══════════════════════════════════════ */}
        <Section
          Icon={Lock}
          iconBg={theme.status.warning.bg}
          iconColor={theme.status.warning.main}
          title="Change Password"
          subtitle="Keep your account secure — use a strong unique password"
          isMobile={isMobile}
        >
          <div style={{ maxWidth: isMobile ? '100%' : 420 }}>

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
                    cursor: 'pointer', padding: 0,
                    display: 'flex', color: theme.textMuted,
                  }}
                >
                  {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    cursor: 'pointer', padding: 0,
                    display: 'flex', color: theme.textMuted,
                  }}
                >
                  {showPw.next ? <EyeOff size={16} /> : <Eye size={16} />}
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
                      background: i < strength.score ? strength.color : theme.border,
                      transition: 'background .2s',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>
                  {strength.label}
                  <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>
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
                        ? theme.status.danger.main
                        : undefined,
                  }}
                />
                <button
                  onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0,
                    display: 'flex', color: theme.textMuted,
                  }}
                >
                  {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* match / no match indicator */}
              {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.status.danger.main, marginTop: 4 }}>
                  <X size={12} strokeWidth={2.8} />
                  Passwords do not match
                </div>
              )}
              {pwForm.confirm && pwForm.next === pwForm.confirm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.status.success.main, marginTop: 4 }}>
                  <Check size={12} strokeWidth={2.8} />
                  Passwords match
                </div>
              )}
            </div>

            {/* feedback message */}
            {pwMsg.text && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                background: pwMsg.ok ? theme.status.success.bg : theme.status.danger.bg,
                color:      pwMsg.ok ? theme.status.success.text : theme.status.danger.text,
                border: `1px solid ${pwMsg.ok ? theme.status.success.border : theme.status.danger.border}`,
              }}>
                {pwMsg.ok
                  ? <Check size={15} strokeWidth={2.6} />
                  : <X size={15} strokeWidth={2.6} />}
                {pwMsg.text}
              </div>
            )}

            <button
              onClick={changePassword}
              disabled={savingPw}
              style={{
                padding: '10px 22px',
                background: savingPw ? theme.textMuted : theme.primary,
                border: 'none',
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 700,
                color: theme.white,
                cursor: savingPw ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: savingPw ? 'none' : '0 2px 8px rgba(26,86,219,.25)',
                width: isMobile ? '100%' : 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Lock size={14} strokeWidth={2.4} />
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>

          </div>
        </Section>

        {/* ══════════════════════════════════════
            CONTACT ADMIN BANNER
            ══════════════════════════════════════ */}
        <div style={{
          background: theme.white,
          border: `1px solid ${theme.status.danger.border}`,
          borderRadius: 14,
          padding: isMobile ? '16px' : '16px 22px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: 14,
          boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: theme.status.danger.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlertTriangle size={18} color={theme.status.danger.main} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.status.danger.text, marginBottom: 3 }}>
              Need to update your email, course or country?
            </div>
            <div style={{ fontSize: 12, color: theme.textLight, lineHeight: 1.6 }}>
              Email, course and country changes must be processed by your counsellor.
              Contact Global Pathway and they will update your profile.
            </div>
          </div>
          <a
            href={GMAIL_COMPOSE}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '8px 16px',
              background: theme.status.danger.bg,
              border: `1px solid ${theme.status.danger.border}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: theme.status.danger.text,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              width: isMobile ? '100%' : 'auto',
              textAlign: 'center',
              boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Mail size={13} strokeWidth={2.4} />
            Contact Admin
          </a>
        </div>

      </div>
    </StudentLayout>
  )
}