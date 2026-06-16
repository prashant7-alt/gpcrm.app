import { useState, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '../supabase'

const BottomButtons = forwardRef(function BottomButtons({ onAdd }, ref) {

  const [modal,      setModal]      = useState(null)
  const [form,       setForm]       = useState({})
  const [submitting, setSubmitting] = useState(false)

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  useImperativeHandle(ref, () => ({
    openApplicantModal() { setForm({}); setModal('applicant') }
  }))

  async function createStudentAccount(applicantData, applicantId) {
    if (!applicantData.email || !applicantData.phone) return null
    try {
      // Save admin session — signUp will overwrite it
      const { data: { session: adminSession } } = await supabase.auth.getSession()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    applicantData.email.toLowerCase().trim(),
        password: applicantData.phone.trim(),
        options:  { data: { name: applicantData.name, role: 'student', phone: applicantData.phone } },
      })

      // Restore admin session immediately
      if (adminSession) {
        await supabase.auth.setSession({
          access_token:  adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
      }

      // Surface the real error so we know exactly what failed
      if (authError) return { error: authError.message }

      const authUserId = authData?.user?.id
      if (!authUserId) return { error: 'No user ID returned from signUp' }

      const { error: profileError } = await supabase.from('profiles').insert({
        id:           authUserId,
        name:         applicantData.name,
        email:        applicantData.email.toLowerCase().trim(),
        phone:        applicantData.phone,
        role:         'student',
        applicant_id: applicantId,
      })

      if (profileError) return { userId: authUserId, error: 'Profile error: ' + profileError.message }

      return { userId: authUserId }
    } catch (err) {
      return { error: err.message }
    }
  }

  const submitApplicant = async () => {
    if (!form.name || submitting) return
    setSubmitting(true)
    try {
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

      if (error) throw error

      let result = null
      if (form.email && form.phone) {
        result = await createStudentAccount(form, applicant.id)
      }

      const savedEmail = form.email
      const savedPhone = form.phone
      setModal(null)
      setForm({})
      onAdd?.()

      if (!result) {
        alert('✅ Applicant added!\n(No email/phone — no portal login created)')
      } else if (result.userId && !result.error) {
        alert(
          '✅ Applicant added!\n\n' +
          '🔑 Student portal login created:\n' +
          'Email: ' + savedEmail + '\n' +
          'Password: ' + savedPhone
        )
      } else if (result.userId && result.error) {
        alert(
          '✅ Applicant added!\n\n' +
          '⚠️ Auth account created but profile failed:\n' + result.error
        )
      } else {
        // Show the real error from Supabase
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
      title: form.title, assigned: form.assigned || '',
      due_date: form.due_date || '', priority: form.priority || 'Normal', status: 'pending',
    })
    setModal(null); setForm({}); alert('✅ Task added!')
  }

  const submitPayment = async () => {
    if (!form.student_name || !form.amount) return
    await supabase.from('payments').insert({
      student_name: form.student_name, amount: parseFloat(form.amount),
      method: form.method || 'Cash', status: 'pending',
      date: new Date().toISOString().split('T')[0],
    })
    setModal(null); setForm({}); alert('✅ Payment added!')
  }

  return (
    <>
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, zIndex: 50 }}>
        <button onClick={() => { setForm({}); setModal('applicant') }} style={{ padding: '10px 20px', background: '#16a34a', border: 'none', borderRadius: 24, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>👤 Applicant</button>
        <button onClick={() => { setForm({}); setModal('task') }} style={{ padding: '10px 20px', background: '#2563eb', border: 'none', borderRadius: 24, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>+ Task</button>
        <button onClick={() => { setForm({}); setModal('payment') }} style={{ padding: '10px 20px', background: '#f59e0b', border: 'none', borderRadius: 24, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>💰 Payment</button>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

            {modal === 'applicant' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add New Applicant</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>
                {[
                  { label: 'Full Name *', key: 'name',    placeholder: 'Ram Sharma' },
                  { label: 'Email',       key: 'email',   placeholder: 'ram@email.com' },
                  { label: 'Phone',       key: 'phone',   placeholder: '98XXXXXXXX' },
                  { label: 'Course',      key: 'course',  placeholder: 'BSc Computer Science' },
                  { label: 'Country',     key: 'country', placeholder: 'UK, Australia...' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                ))}
                {form.email && form.phone && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803d', marginBottom: 12 }}>
                    🔑 Portal login will be created — Password: <strong>{form.phone}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitApplicant} disabled={submitting} style={{ padding: '9px 18px', background: submitting ? '#86efac' : '#16a34a', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                    {submitting ? 'Adding…' : 'Add Applicant'}
                  </button>
                </div>
              </>
            )}

            {modal === 'task' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add New Task</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>
                {[
                  { label: 'Task Title *', key: 'title',    placeholder: 'Follow up with student' },
                  { label: 'Assigned To',  key: 'assigned', placeholder: 'Nabin, Sonika...' },
                  { label: 'Due Date',     key: 'due_date', placeholder: '', type: 'date' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type || 'text'} placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>Priority</label>
                  <select value={form.priority || 'Normal'} onChange={e => set('priority', e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit' }}>
                    <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitTask} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Add Task</button>
                </div>
              </>
            )}

            {modal === 'payment' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add Payment</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>
                {[
                  { label: 'Student Name *', key: 'student_name', placeholder: 'Ram Sharma' },
                  { label: 'Amount (Rs) *',  key: 'amount',       placeholder: '5000', type: 'number' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input type={f.type || 'text'} placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>Payment Method</label>
                  <select value={form.method || 'Cash'} onChange={e => set('method', e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit' }}>
                    <option>Cash</option><option>eSewa</option><option>Khalti</option><option>Bank Transfer</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitPayment} style={{ padding: '9px 18px', background: '#f59e0b', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Add Payment</button>
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