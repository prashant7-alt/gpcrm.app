import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

const statusStyle = (status) => {
  if (status === 'confirmed') return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'rejected')  return { bg: '#fee2e2', color: '#b91c1c' }
  if (status === 'completed') return { bg: '#dbeafe', color: '#1d4ed8' }
  if (status === 'cancelled') return { bg: '#f3f4f6', color: '#6b7280' }
  return { bg: '#fef9c3', color: '#a16207' }
}

export default function StudentAppointments() {

  const navigate = useNavigate()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form,         setForm]         = useState({
    type: '', date: '', time: '', note: '',
  })

  useEffect(() => {
    if (!profile.id) { navigate('/login'); return }
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('student_email', profile.email)
      .order('created_at', { ascending: false })
    setAppointments(data || [])
    setLoading(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  async function bookAppointment() {
    if (!form.type) return alert('Please select appointment type')
    if (!form.date) return alert('Please select a date')
    if (!form.time) return alert('Please select a time')

    setSaving(true)
    const { error } = await supabase.from('appointments').insert({
      student_name:  profile.name,
      student_email: profile.email,
      type:          form.type,
      date:          form.date,
      time:          form.time,
      note:          form.note || '',
      status:        'pending',
    })
    setSaving(false)

    if (error) return alert('Error: ' + error.message)
    setForm({ type: '', date: '', time: '', note: '' })
    setShowModal(false)
    load()
  }

  // stat counts
  const pending   = appointments.filter(a => a.status === 'pending').length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const completed = appointments.filter(a => a.status === 'completed').length

  return (
    <StudentLayout>
      <div style={{ maxWidth: 800 }}>

        {/* header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 24,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              My Appointments
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Book and track your appointments with the consultancy
            </p>
          </div>
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

        {/* stat cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14, marginBottom: 24,
        }}>
          {[
            { label: 'Pending',   value: pending,   bg: '#fef9c3', color: '#a16207', top: '#ca8a04' },
            { label: 'Confirmed', value: confirmed, bg: '#dcfce7', color: '#15803d', top: '#16a34a' },
            { label: 'Completed', value: completed, bg: '#dbeafe', color: '#1d4ed8', top: '#2563eb' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderTop: `3px solid ${s.top}`,
              borderRadius: 10, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* appointments table */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, overflow: 'hidden',
        }}>

          {/* table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 2fr',
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

          {loading && (
            <p style={{ padding: 24, fontSize: 13, color: '#6b7280' }}>Loading...</p>
          )}

          {!loading && appointments.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                No appointments yet
              </div>
              <div style={{ fontSize: 13 }}>
                Click + Book Appointment to get started
              </div>
            </div>
          )}

          {appointments.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 2fr',
                padding: '14px 18px', alignItems: 'center',
                borderBottom: i < appointments.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                {a.type || '—'}
              </div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                {a.date
                  ? new Date(a.date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })
                  : '—'}
              </div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                {a.time || '—'}
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 20, display: 'inline-block',
                fontSize: 11, fontWeight: 600,
                background: statusStyle(a.status).bg,
                color:      statusStyle(a.status).color,
              }}>
                {a.status || 'pending'}
              </span>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {a.note || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* book appointment modal */}
        {showModal && (
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 14, padding: 28, width: 420,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 22,
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                  Book Appointment
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: 20, cursor: 'pointer', color: '#9ca3af',
                  }}
                >
                  x
                </button>
              </div>

              {/* type */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Appointment Type *</label>
                <select
                  value={form.type}
                  onChange={e => set('type', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select type...</option>
                  <option>Counseling Session</option>
                  <option>Document Review</option>
                  <option>Visa Guidance</option>
                  <option>Application Update</option>
                  <option>General Query</option>
                </select>
              </div>

              {/* date */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Preferred Date *</label>
                <input
                  type="date"
                  value={form.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('date', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* time */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Preferred Time *</label>
                <select
                  value={form.time}
                  onChange={e => set('time', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select time...</option>
                  <option>9:00 AM</option>
                  <option>10:00 AM</option>
                  <option>11:00 AM</option>
                  <option>12:00 PM</option>
                  <option>1:00 PM</option>
                  <option>2:00 PM</option>
                  <option>3:00 PM</option>
                  <option>4:00 PM</option>
                  <option>5:00 PM</option>
                </select>
              </div>

              {/* note */}
              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>Note (optional)</label>
                <textarea
                  placeholder="What would you like to discuss?"
                  value={form.note}
                  onChange={e => set('note', e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 18px', background: '#f9fafb',
                    border: '1px solid #e5e7eb', borderRadius: 8,
                    fontSize: 13, color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={bookAppointment}
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    background: saving ? '#9ca3af' : '#16a34a',
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {saving ? 'Booking...' : 'Book Now'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </StudentLayout>
  )
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 5,
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
}