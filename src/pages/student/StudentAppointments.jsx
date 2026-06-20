import { useState, useEffect } from 'react'
// useState   → manages appointments list, loading flag, modal visibility, form fields, saving flag
// useEffect  → runs the initial data load once when the component mounts

import { useNavigate } from 'react-router-dom'
// useNavigate → redirects to /login if the student isn't authenticated

import { supabase } from '../../supabase'
// supabase → pre-configured client for reading/inserting appointments

import StudentLayout from './StudentLayout'
// StudentLayout → shared wrapper that provides the student sidebar/navbar shell
//                 this page only needs to render its own content inside it


export default function StudentAppointments() {

  const navigate = useNavigate()

  // Read the logged-in student's profile from localStorage
  // (saved there at login time so we don't need to fetch it on every page)
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  // '{}' fallback prevents JSON.parse(null) crashing if nothing is stored


  // ── STATE ──────────────────────────────────────────────────
  const [appointments, setAppointments] = useState([])    // list of appointment rows from DB
  const [loading,      setLoading]      = useState(true)  // true while fetching from Supabase
  const [showModal,    setShowModal]    = useState(false)  // controls booking modal visibility
  const [saving,       setSaving]       = useState(false)  // true while insert is in-flight (prevents double-submit)
  const [form,         setForm]         = useState({
    type: '', date: '', time: '', note: '',                // all fields start empty
  })


  // ── ON MOUNT: auth guard + initial data load ───────────────
  useEffect(() => {
    if (!profile.id) {
      navigate('/login')  // no profile in storage → not logged in → redirect
      return
    }
    load()  // profile exists → fetch this student's appointments
  }, [])
  // empty dependency array [] → runs only once after first render


  // ── FETCH APPOINTMENTS ─────────────────────────────────────
  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('student_email', profile.email)       // only fetch THIS student's appointments
      .order('created_at', { ascending: false }) // newest first

    setAppointments(data || [])  // fallback to empty array if data is null
    setLoading(false)
  }
  // Called on mount AND after a successful booking to refresh the list


  // ── FORM FIELD HELPER ──────────────────────────────────────
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  // Spreads existing form state and overwrites only the changed field
  // e.g. set('date', '2026-07-01') → { type: '...', date: '2026-07-01', time: '...', note: '...' }


  // ── BOOK APPOINTMENT ──────────────────────────────────────
  async function bookAppointment() {
    // Client-side validation before hitting the network
    if (!form.type) return alert('Please select appointment type')
    if (!form.date) return alert('Please select a date')
    if (!form.time) return alert('Please select a time')

    setSaving(true)  // disable the Book Now button to prevent double-submit

    const { error } = await supabase.from('appointments').insert({
      student_name:  profile.name,   // denormalized — stored directly so admin can read it
      student_email: profile.email,  // used to filter appointments per student
      type:          form.type,
      date:          form.date,
      time:          form.time,
      note:          form.note || '',   // optional field, default to empty string
      status:        'pending',         // all new bookings start as pending (admin confirms/rejects)
    })

    setSaving(false)

    if (error) return alert('Error: ' + error.message)  // surface DB error if insert failed

    // Reset form and close modal on success
    setForm({ type: '', date: '', time: '', note: '' })
    setShowModal(false)
    load()  // re-fetch the list so the new appointment appears immediately
  }


  // ── STATUS BADGE COLOR HELPER ──────────────────────────────
  const statusColor = (status) => {
    if (status === 'confirmed') return { bg: '#dcfce7', color: '#15803d' }  // green
    if (status === 'rejected')  return { bg: '#fee2e2', color: '#b91c1c' }  // red
    if (status === 'completed') return { bg: '#dbeafe', color: '#1d4ed8' }  // blue
    return { bg: '#fef9c3', color: '#a16207' }  // yellow — default for 'pending'
  }
  // Returns a { bg, color } object used directly as inline styles on the badge


  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <StudentLayout>  {/* wraps everything in the student shell (sidebar, navbar) */}
      <div>

        {/* ── PAGE HEADER ─────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 24,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              My Appointments
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Book and track your appointments
            </p>
          </div>

          {/* Opens the booking modal */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 18px', background: '#16a34a',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + Book Appointment
          </button>
        </div>


        {/* ── APPOINTMENTS TABLE ───────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, overflow: 'hidden',  // clips row hover backgrounds at corners
        }}>

          {/* Table header row — CSS grid with 5 columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 2fr',  // Type gets most space, Status least
            padding: '10px 18px',
            background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
          }}>
            {['Type', 'Date', 'Time', 'Status', 'Note'].map(h => (
              <span key={h} style={{
                fontSize: 11, fontWeight: 600, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {h}
              </span>
            ))}
          </div>

          {/* Loading state */}
          {loading && (
            <p style={{ padding: 24, fontSize: 13, color: '#6b7280' }}>Loading...</p>
          )}

          {/* Empty state — shown when fetch is done but no rows returned */}
          {!loading && appointments.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                No appointments yet
              </div>
              <div style={{ fontSize: 13 }}>
                Click <strong>+ Book Appointment</strong> to get started
              </div>
            </div>
          )}

          {/* Data rows — one grid row per appointment */}
          {appointments.map((a, i) => (
            <div key={a.id} style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 2fr',  // must match header columns
              padding: '14px 18px',
              // Draw a divider under every row EXCEPT the last one
              borderBottom: i < appointments.length - 1 ? '1px solid #f3f4f6' : 'none',
              alignItems: 'center',
            }}
              // Inline hover effect — no CSS class needed
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{a.type || '—'}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{a.date || '—'}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{a.time || '—'}</div>

              {/* Colored pill badge — color determined by statusColor() helper */}
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: statusColor(a.status).bg,
                color:      statusColor(a.status).color,
                display: 'inline-block',
              }}>
                {a.status || 'pending'}
              </span>

              <div style={{ fontSize: 12, color: '#9ca3af' }}>{a.note || '—'}</div>
            </div>
          ))}
        </div>


        {/* ════════════════════════════════
            BOOKING MODAL
            Only rendered when showModal === true
            ════════════════════════════════ */}
        {showModal && (
          // Backdrop — clicking it closes the modal (standard UX pattern)
          <div onClick={() => setShowModal(false)} style={{
            position: 'fixed', inset: 0,           // covers the entire viewport
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 200,
          }}>

            {/* Modal card — stopPropagation prevents backdrop click from firing
                when the user clicks INSIDE the modal */}
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 14, padding: 28, width: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}>

              {/* Modal header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 22,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                  Book Appointment
                </h3>
                <button onClick={() => setShowModal(false)} style={{
                  background: 'none', border: 'none',
                  fontSize: 20, cursor: 'pointer', color: '#9ca3af',
                }}>✕</button>
              </div>

              {/* Appointment type — dropdown, required */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Appointment Type *</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
                  <option value="">Select type...</option>
                  <option>Counseling Session</option>
                  <option>Document Review</option>
                  <option>Visa Guidance</option>
                  <option>Application Update</option>
                  <option>General Query</option>
                </select>
              </div>

              {/* Preferred date — browser native date picker */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Preferred Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Preferred time — fixed hourly slots (no free-text to keep data clean) */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Preferred Time *</label>
                <select value={form.time} onChange={e => set('time', e.target.value)} style={inputStyle}>
                  <option value="">Select time...</option>
                  <option>9:00 AM</option>
                  <option>10:00 AM</option>
                  <option>11:00 AM</option>
                  <option>12:00 PM</option>
                  <option>1:00 PM</option>
                  <option>2:00 PM</option>
                  <option>3:00 PM</option>
                  <option>4:00 PM</option>
                </select>
              </div>

              {/* Optional note — textarea so student can write more than one line */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Note (optional)</label>
                <textarea
                  placeholder="What would you like to discuss?"
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  // resize:'vertical' allows user to drag the textarea taller but not wider
                />
              </div>

              {/* Footer buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={{
                  padding: '9px 18px', background: '#f9fafb',
                  border: '1px solid #e5e7eb', borderRadius: 8,
                  fontSize: 13, color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Cancel
                </button>

                {/* Submit — grayed out and locked while Supabase insert is running */}
                <button onClick={bookAppointment} disabled={saving} style={{
                  padding: '9px 20px',
                  background: saving ? '#9ca3af' : '#16a34a',  // gray while saving
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>
                  {saving ? 'Booking...' : 'Book Now'}  {/* label changes while saving */}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </StudentLayout>
  )
}


// ── SHARED STYLES (defined outside component so they aren't recreated on every render) ──

const labelStyle = {
  display: 'block', fontSize: 12,
  fontWeight: 600, color: '#374151', marginBottom: 5,
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
}
// boxSizing:'border-box' → padding is included in the 100% width calculation
//                          (prevents inputs from overflowing their container)