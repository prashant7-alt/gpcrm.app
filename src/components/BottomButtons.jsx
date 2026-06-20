// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────

import { useState, forwardRef, useImperativeHandle } from 'react'
// useState            → local state for modal visibility, form fields, and loading flag
// forwardRef          → lets a parent pass a `ref` into this component
//                       (normally refs only work on DOM elements, not custom components)
// useImperativeHandle → lets this component decide WHAT the parent can do via that ref
//                       (instead of exposing the whole DOM node, we expose specific functions)

import { supabase } from '../supabase'
// supabase → pre-configured Supabase client for DB inserts and auth operations


// ─────────────────────────────────────────────────────────────
// COMPONENT — wrapped in forwardRef so parent can call
//             openApplicantModal() from outside via a ref
// ─────────────────────────────────────────────────────────────

const BottomButtons = forwardRef(function BottomButtons({ onAdd }, ref) {
  // Props:
  //   onAdd → callback the parent gave us; called after a successful insert
  //           so the parent can refresh its list without polling
  // ref   → forwarded ref from the parent (used with useImperativeHandle below)


  // ── STATE ─────────────────────────────────────────────────
  const [modal,      setModal]      = useState(null)   // which modal is open: 'applicant' | 'task' | 'payment' | null
  const [form,       setForm]       = useState({})     // key-value bag of every input in the currently open modal
  const [submitting, setSubmitting] = useState(false)  // true while the applicant form is being saved (prevents double-submit)


  // ── HELPER: update a single field in the form object ──────
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  // Spreads existing form fields and overwrites only the changed key
  // e.g. set('email', 'a@b.com') → { ...prev, email: 'a@b.com' }


  // ── EXPOSE A PUBLIC METHOD TO THE PARENT VIA REF ──────────
  useImperativeHandle(ref, () => ({
    openApplicantModal() {
      setForm({})            // clear any previous form data
      setModal('applicant')  // show the applicant modal
    }
    // Parent usage: bottomButtonsRef.current.openApplicantModal()
    // Only this one method is exposed — the parent can't touch internal state directly
  }))


  // ─────────────────────────────────────────────────────────
  // FUNCTION: createStudentAccount
  // Creates a Supabase Auth user + a matching row in `profiles`
  // Called only when both email AND phone are present on the applicant
  // ─────────────────────────────────────────────────────────
  async function createStudentAccount(applicantData, applicantId) {

    // Guard: skip entirely if email or phone is missing
    if (!applicantData.email || !applicantData.phone) return null

    try {
      // 1. Save the current admin session BEFORE calling signUp
      //    Reason: supabase.auth.signUp() replaces the active session with
      //    the newly created student's session — we need to restore admin after
      const { data: { session: adminSession } } = await supabase.auth.getSession()

      // 2. Create a new Auth user for the student
      //    Email  → the applicant's email (lowercased + trimmed for consistency)
      //    Password → the applicant's phone number (simple default the student can change)
      //    options.data → extra metadata stored on the auth user object
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    applicantData.email.toLowerCase().trim(),
        password: applicantData.phone.trim(),
        options:  { data: { name: applicantData.name, role: 'student', phone: applicantData.phone } },
      })

      // 3. Immediately restore the admin session so the rest of the app
      //    keeps working as the admin (not as the newly created student)
      if (adminSession) {
        await supabase.auth.setSession({
          access_token:  adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        })
      }

      // 4. If Supabase returned an auth error (e.g. signups disabled), surface it
      if (authError) return { error: authError.message }

      // 5. Extract the new user's UUID from the response
      const authUserId = authData?.user?.id
      if (!authUserId) return { error: 'No user ID returned from signUp' }
      // Optional chaining (?.) prevents crash if authData or user is undefined

      // 6. Insert a matching row in our custom `profiles` table
      //    This links the Auth user (by id) to our app's applicant record
      const { error: profileError } = await supabase.from('profiles').insert({
        id:           authUserId,          // same UUID as Auth user → ties tables together
        name:         applicantData.name,
        email:        applicantData.email.toLowerCase().trim(),
        phone:        applicantData.phone,
        role:         'student',
        applicant_id: applicantId,         // foreign key → links back to the applicants table
      })

      // 7. Return partial success if auth worked but profile insert failed
      if (profileError) return { userId: authUserId, error: 'Profile error: ' + profileError.message }

      // 8. Full success — return just the userId
      return { userId: authUserId }

    } catch (err) {
      // Catches unexpected JS errors (network failures, etc.)
      return { error: err.message }
    }
  }


  // ─────────────────────────────────────────────────────────
  // FUNCTION: submitApplicant
  // Inserts a new row into `applicants`, then optionally
  // creates a student portal login via createStudentAccount
  // ─────────────────────────────────────────────────────────
  const submitApplicant = async () => {

    // Guard: name is required; also block if already submitting (prevent double-click)
    if (!form.name || submitting) return
    setSubmitting(true) // lock the submit button while async work runs

    try {
      // 1. Insert the applicant row into Supabase
      //    .select().single() returns the newly created row (with its generated `id`)
      const { data: applicant, error } = await supabase
        .from('applicants')
        .insert({
          name:    form.name,
          email:   form.email   || '',  // default to empty string if not provided
          phone:   form.phone   || '',
          course:  form.course  || '',
          country: form.country || '',
          status:  'New',               // every new applicant starts as 'New'
        })
        .select()
        .single()

      if (error) throw error  // jump to catch block with the Supabase error

      // 2. Conditionally create the student portal account
      //    Only if both email AND phone were provided (both required for Auth)
      let result = null
      if (form.email && form.phone) {
        result = await createStudentAccount(form, applicant.id)
      }

      // 3. Save email/phone before clearing form
      //    (we need them for the success alert, but setForm({}) happens next)
      const savedEmail = form.email
      const savedPhone = form.phone

      // 4. Close modal and reset form
      setModal(null)
      setForm({})
      onAdd?.()  // notify parent to refresh its data list
                 // ?.() = optional call — safe if parent didn't pass onAdd

      // 5. Show appropriate feedback based on what happened
      if (!result) {
        // No email/phone → no portal account attempted
        alert(' Applicant added!\n(No email/phone — no portal login created)')

      } else if (result.userId && !result.error) {
        // Full success: auth account + profile both created
        alert(
          ' Applicant added!\n\n' +
          ' Student portal login created:\n' +
          'Email: ' + savedEmail + '\n' +
          'Password: ' + savedPhone  // phone is the initial password
        )

      } else if (result.userId && result.error) {
        // Partial success: auth account created but profile insert failed
        alert(
          'Applicant added!\n\n' +
          ' Auth account created but profile failed:\n' + result.error
        )

      } else {
        // Auth account creation failed entirely — show Supabase's error
        // and give the admin a hint about the most common cause
        alert(
          ' Applicant added!\n\n' +
          ' Portal login FAILED:\n' + (result.error || 'Unknown error') + '\n\n' +
          'FIX: In Supabase → Authentication → Sign In / Providers\n' +
          'Turn ON "Allow new users to sign up" then save.'
        )
      }

    } catch (err) {
      // Catches the `throw error` from the applicant insert step
      alert('❌ Error saving applicant: ' + err.message)

    } finally {
      setSubmitting(false) // always unlock the button, whether success or failure
    }
  }


  // ─────────────────────────────────────────────────────────
  // FUNCTION: submitTask
  // Simple insert into the `tasks` table — no auth side-effects
  // ─────────────────────────────────────────────────────────
  const submitTask = async () => {
    if (!form.title) return  // title is the only required field

    await supabase.from('tasks').insert({
      title:    form.title,
      assigned: form.assigned || '',     // who the task is assigned to (optional)
      due_date: form.due_date || '',     // date string from <input type="date"> (optional)
      priority: form.priority || 'Normal', // defaults to 'Normal' if not selected
      status:   'pending',               // every new task starts as pending
    })

    setModal(null); setForm({}); alert('✅ Task added!')
  }


  // ─────────────────────────────────────────────────────────
  // FUNCTION: submitPayment
  // Simple insert into the `payments` table
  // ─────────────────────────────────────────────────────────
  const submitPayment = async () => {
    if (!form.student_name || !form.amount) return  // both fields are required

    await supabase.from('payments').insert({
      student_name: form.student_name,
      amount:       parseFloat(form.amount),  // convert string from input → number
      method:       form.method || 'Cash',    // payment method, defaults to Cash
      status:       'pending',                // new payments always start as pending
      date:         new Date().toISOString().split('T')[0], // today's date as "YYYY-MM-DD"
    })

    setModal(null); setForm({}); alert('✅ Payment added!')
  }


  // ─────────────────────────────────────────────────────────
  // RENDER
  // The component renders ONLY the modal overlay — the trigger
  // buttons that open the modals live in the parent component.
  // The applicant modal can also be opened externally via ref.
  // ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Only render the overlay when a modal is active */}
      {modal && (
        // Semi-transparent full-screen backdrop; clicking it does NOT close modal
        // (user must use Cancel or ✕ button — prevents accidental dismissal)
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>

          {/* White modal card — same container for all three modal types */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>


            {/* ══════════════════════════════════
                APPLICANT MODAL
                Shown when modal === 'applicant'
                ══════════════════════════════════ */}
            {modal === 'applicant' && (
              <>
                {/* Header row: title + close button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add New Applicant</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>

                {/* Render 5 text inputs from a config array — avoids repeating JSX 5 times */}
                {[
                  { label: 'Full Name *', key: 'name',    placeholder: 'Ram Sharma' },
                  { label: 'Email',       key: 'email',   placeholder: 'ram@email.com' },
                  { label: 'Phone',       key: 'phone',   placeholder: '98XXXXXXXX' },
                  { label: 'Course',      key: 'course',  placeholder: 'BSc Computer Science' },
                  { label: 'Country',     key: 'country', placeholder: 'UK, Australia...' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    {/* Controlled input: value driven by form state; onChange updates that key */}
                    <input
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}           // '' fallback prevents uncontrolled→controlled warning
                      onChange={e => set(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                {/* Green info banner — only appears when BOTH email and phone are filled in
                    Previews the password the student will receive (their phone number) */}
                {form.email && form.phone && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803d', marginBottom: 12 }}>
                     Portal login will be created — Password: <strong>{form.phone}</strong>
                  </div>
                )}

                {/* Footer: Cancel + Submit buttons */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={submitApplicant}
                    disabled={submitting}  // prevents double-submit while async runs
                    style={{
                      padding: '9px 18px',
                      background: submitting ? '#86efac' : '#16a34a',  // lighter green while loading
                      border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: '#fff',
                      cursor: submitting ? 'not-allowed' : 'pointer',  // visual feedback
                    }}
                  >
                    {submitting ? 'Adding…' : 'Add Applicant'}  {/* label changes while saving */}
                  </button>
                </div>
              </>
            )}


            {/* ══════════════════════════════════
                TASK MODAL
                Shown when modal === 'task'
                ══════════════════════════════════ */}
            {modal === 'task' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add New Task</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>

                {/* Three text/date inputs driven from config array */}
                {[
                  { label: 'Task Title *', key: 'title',    placeholder: 'Follow up with student' },
                  { label: 'Assigned To',  key: 'assigned', placeholder: 'Nabin, Sonika...' },
                  { label: 'Due Date',     key: 'due_date', placeholder: '', type: 'date' }, // type:'date' gives browser date picker
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type || 'text'}  // defaults to 'text' unless overridden (e.g. 'date')
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                {/* Priority dropdown — not in the map array because it's a <select>, not an <input> */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>Priority</label>
                  <select
                    value={form.priority || 'Normal'}  // controlled select; default 'Normal'
                    onChange={e => set('priority', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit' }}
                  >
                    <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setModal(null)} style={{ padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={submitTask} style={{ padding: '9px 18px', background: '#2563eb', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Add Task</button>
                </div>
              </>
            )}


            {/* ══════════════════════════════════
                PAYMENT MODAL
                Shown when modal === 'payment'
                ══════════════════════════════════ */}
            {modal === 'payment' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add Payment</h3>
                  <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
                </div>

                {/* Two inputs: student name (text) and amount (number) */}
                {[
                  { label: 'Student Name *', key: 'student_name', placeholder: 'Ram Sharma' },
                  { label: 'Amount (Rs) *',  key: 'amount',       placeholder: '5000', type: 'number' }, // type:'number' shows numeric keyboard on mobile
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}

                {/* Payment method dropdown — Nepal-specific options (eSewa, Khalti are local wallets) */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 5 }}>Payment Method</label>
                  <select
                    value={form.method || 'Cash'}  // controlled; defaults to 'Cash'
                    onChange={e => set('method', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit' }}
                  >
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