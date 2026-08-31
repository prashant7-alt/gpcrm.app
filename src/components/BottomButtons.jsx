import { useState, forwardRef, useImperativeHandle } from 'react'
import theme from '../theme'
import { supabase, functionHeaders } from '../supabase'
import { sendWelcomeEmail } from '../emailService'
import { useRefreshHold } from '../hooks/useRefetchOnFocus'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

const BottomButtons = forwardRef(function BottomButtons({ onAdd }, ref) {

  const [modal,      setModal]      = useState(null)
  const [form,       setForm]       = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Pause every page's auto-refresh while an add modal is open here.
  useRefreshHold(!!modal)

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  useImperativeHandle(ref, () => ({
    openApplicantModal() {
      setForm({})
      setModal('applicant')
    }
  }))

  // Creates the student portal login via the hardened create-staff-user Edge
  // Function (server-side auth + role check). The password is set by staff in
  // the form — never derived from the phone number, never emailed.
  async function createStudentAccount(applicantData, applicantId) {
    if (!applicantData.email || !applicantData.password) return null

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-staff-user`, {
        method:  'POST',
        headers: await functionHeaders(),
        body: JSON.stringify({
          email:    applicantData.email.toLowerCase().trim(),
          password: applicantData.password,
          name:     applicantData.name,
          role:     'student',
        }),
      })

      const result = await res.json()
      if (!result.success) return { error: result.message || 'Login creation failed' }

      const authUserId = result.user_id
      if (!authUserId) return { error: 'No user ID returned' }

      const { error: linkError } = await supabase
        .from('profiles')
        .update({ applicant_id: applicantId })
        .eq('id', authUserId)

      if (linkError) return { userId: authUserId, error: 'Profile link error: ' + linkError.message }

      return { userId: authUserId }

    } catch (err) {
      return { error: err.message }
    }
  }

  const submitApplicant = async () => {
    if (!form.name || submitting) return
    if (form.email && form.password && form.password.length < 8) {
      alert('Login password must be at least 8 characters (or leave it blank to skip creating a portal login).')
      return
    }
    setSubmitting(true)

    try {
      // ── check duplicate email before creating anything ──
      if (form.email) {
        const cleanEmail = form.email.toLowerCase().trim()

        const { data: existingApplicant, error: applicantCheckError } = await supabase
          .from('applicants')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle()

        if (applicantCheckError) {
          alert('❌ Error checking existing applicants: ' + applicantCheckError.message)
          setSubmitting(false)
          return
        }

        if (existingApplicant) {
          alert(`❌ An applicant with email "${form.email}" already exists.\n\nPlease use a different email address.`)
          setSubmitting(false)
          return
        }

        const { data: existingProfile, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle()

        if (profileCheckError) {
          alert('❌ Error checking existing accounts: ' + profileCheckError.message)
          setSubmitting(false)
          return
        }

        if (existingProfile) {
          alert(`❌ A user account with email "${form.email}" already exists.\n\nThis person may already have a student portal login.`)
          setSubmitting(false)
          return
        }
      }

      const { data: applicant, error } = await supabase
        .from('applicants')
        .insert({
          name:    form.name,
          email:   form.email   || '',
          phone:   form.phone   || '',
          course:  form.course  || '',
          country: form.country || '',
          status:  'New',
        })
        .select()
        .single()

      if (error) {
        // Catches the case where the DB unique constraint rejects it even
        // if the check above somehow missed it (race condition safety net).
        if (error.code === '23505') {
          alert(`❌ An applicant with email "${form.email}" already exists.`)
          setSubmitting(false)
          return
        }
        throw error
      }

      let result = null
      if (form.email && form.password) {
        result = await createStudentAccount(form, applicant.id)
      }

      const savedEmail    = form.email
      const savedName     = form.name
      const savedPassword = form.password

      setModal(null)
      setForm({})
      onAdd?.()

      if (!result) {
        alert('✅ Applicant added!\n(No login password set — no portal login created. You can add one later from the Applications page.)')

      } else if (result.userId && !result.error) {
        // Welcome email delivers the login email + password to the student.
        sendWelcomeEmail({
          student_name:     savedName,
          student_email:    savedEmail,
          student_password: savedPassword,
        }).then(res => {
          if (res.success) {
            console.log('✅ Welcome email sent to', savedEmail)
          } else {
            console.warn('⚠️ Welcome email failed:', res.error)
          }
        })

        alert(
          '✅ Applicant added!\n\n' +
          '🔑 Student portal login created:\n' +
          'Email:    ' + savedEmail + '\n' +
          'Password: ' + savedPassword + '\n\n' +
          '📧 A welcome email with these login details has been sent to the student.'
        )

      } else if (result.userId && result.error) {
        alert(
          'Applicant added!\n\n' +
          '⚠️ Auth account created but profile failed:\n' + result.error
        )

      } else {
        alert(
          '✅ Applicant added!\n\n' +
          '❌ Portal login FAILED:\n' + (result.error || 'Unknown error') + '\n\n' +
          'FIX: In Supabase → Authentication → Sign In / Providers\n' +
          'Turn ON "Allow new users to sign up" then save.'
        )
      }

    } catch (err) {
      alert('❌ Error saving applicant: ' + err.message)

    } finally {
      setSubmitting(false)
    }
  }

  const submitTask = async () => {
    if (!form.title) return

    await supabase.from('tasks').insert({
      title:    form.title,
      assigned: form.assigned || '',
      due_date: form.due_date || '',
      priority: form.priority || 'Normal',
      status:   'pending',
    })

    setModal(null); setForm({}); alert('✅ Task added!')
  }

  const submitPayment = async () => {
    if (!form.student_name || !form.amount) return

    await supabase.from('payments').insert({
      student_name: form.student_name,
      amount:       parseFloat(form.amount),
      method:       form.method || 'Cash',
      status:       'pending',
      date:         new Date().toISOString().split('T')[0],
    })

    setModal(null); setForm({}); alert('✅ Payment added!')
  }

  return (
    <>
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

            {/* ── APPLICANT MODAL ── */}
            {modal === 'applicant' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>Add New Applicant</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textLight }}>✕</button>
                </div>

                {[
                  { label: 'Full Name *', key: 'name',    placeholder: 'Ram Sharma' },
                  { label: 'Email',       key: 'email',   placeholder: 'ram@email.com' },
                  { label: 'Phone',       key: 'phone',   placeholder: '98XXXXXXXX' },
                  { label: 'Login Password (min 8 — leave blank to skip portal login)', key: 'password', placeholder: 'Set student password', type: 'text' },
                  { label: 'Course',      key: 'course',  placeholder: 'BSc Computer Science' },
                  { label: 'Country',     key: 'country', placeholder: 'UK, Australia...' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                {form.email && form.password && (
                  <div style={{ background: theme.status.success.bg, border: `1px solid ${theme.status.success.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: theme.status.success.text, marginBottom: 12 }}>
                    ✅ Portal login will be created for <strong>{form.email}</strong>
                    <br />
                    📧 A welcome email (no password) will be sent to the student. Share the password directly.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textLight, cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={submitApplicant}
                    disabled={submitting}
                    style={{
                      padding: '9px 18px',
                      background: submitting ? theme.status.success.border : theme.status.success.main,
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: theme.white,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Adding…' : 'Add Applicant'}
                  </button>
                </div>
              </>
            )}

            {/* ── TASK MODAL ── */}
            {modal === 'task' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>Add New Task</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textLight }}>✕</button>
                </div>

                {[
                  { label: 'Task Title *', key: 'title',    placeholder: 'Follow up with student' },
                  { label: 'Assigned To',  key: 'assigned', placeholder: 'Nabin, Sonika...' },
                  { label: 'Due Date',     key: 'due_date', placeholder: '', type: 'date' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', marginBottom: 5 }}>Priority</label>
                  <select
                    value={form.priority || 'Normal'}
                    onChange={e => set('priority', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textLight, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitTask} style={{ padding: '9px 18px', background: theme.primary, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer' }}>Add Task</button>
                </div>
              </>
            )}

            {/* ── PAYMENT MODAL ── */}
            {modal === 'payment' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>Add Payment</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textLight }}>✕</button>
                </div>

                {[
                  { label: 'Student Name *', key: 'student_name', placeholder: 'Ram Sharma' },
                  { label: 'Amount (Rs) *',  key: 'amount',       placeholder: '5000', type: 'number' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', marginBottom: 5 }}>Payment Method</label>
                  <select
                    value={form.method || 'Cash'}
                    onChange={e => set('method', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option>Cash</option><option>eSewa</option><option>Khalti</option><option>Bank Transfer</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textLight, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitPayment} style={{ padding: '9px 18px', background: theme.status.warning.main, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer' }}>Add Payment</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
})

export default BottomButtons