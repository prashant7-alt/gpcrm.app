import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

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

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/login')
  }

  const statusColor = (status) => {
    if (status === 'confirmed') return { bg: '#dcfce7', color: '#15803d' }
    if (status === 'rejected')  return { bg: '#fee2e2', color: '#b91c1c' }
    if (status === 'completed') return { bg: '#dbeafe', color: '#1d4ed8' }
    return { bg: '#fef9c3', color: '#a16207' }
  }

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── top navbar — same as dashboard ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
        height: 58,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>

        {/* logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: '#16a34a',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 17,
          }}>
            🌐
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              Global Pathway
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Student Portal</div>
          </div>
        </div>

        {/* nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { label: 'Dashboard',    path: '/student/dashboard' },
            { label: 'Appointments', path: '/student/appointments' },
            { label: 'Profile',      path: '/student/profile' },
          ].map(link => {
            const active = window.location.pathname === link.path
            return (
              <div
                key={link.path}
                onClick={() => navigate(link.path)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#15803d' : '#374151',
                  background: active ? '#dcfce7' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {link.label}
              </div>
            )
          })}
        </div>

        {/* right — user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {profile.name}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{profile.email}</div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: '#16a34a',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            {initials}
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '7px 14px',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 8, fontSize: 12,
              fontWeight: 600, color: '#dc2626',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── main content ── */}
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '28px 24px 60px',
      }}>

        {/* page header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 700,
              color: '#111827', margin: '0 0 4px',
            }}>
              My Appointments
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Book and track your appointments with the consultancy
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 18px',
              background: '#16a34a',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Book Appointment
          </button>
        </div>

        {/* appointments list */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
        }}>

          {/* table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 2fr',
            padding: '10px 18px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
          }}>
            {['Type', 'Date', 'Time', 'Status', 'Note'].map(h => (
              <span key={h} style={{
                fontSize: 11, fontWeight: 600,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {h}
              </span>
            ))}
          </div>

          {loading && (
            <p style={{ padding: 24, fontSize: 13, color: '#6b7280' }}>
              Loading...
            </p>
          )}

          {!loading && appointments.length === 0 && (
            <div style={{
              padding: 60,
              textAlign: 'center',
              color: '#9ca3af',
            }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: '#6b7280', marginBottom: 6,
              }}>
                No appointments yet
              </div>
              <div style={{ fontSize: 13 }}>
                Click <strong>+ Book Appointment</strong> to get started
              </div>
            </div>
          )}

          {appointments.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 2fr',
                padding: '14px 18px',
                borderBottom: i < appointments.length - 1
                  ? '1px solid #f3f4f6' : 'none',
                alignItems: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                {a.type || '—'}
              </div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                {a.date || '—'}
              </div>
              <div style={{ fontSize: 13, color: '#374151' }}>
                {a.time || '—'}
              </div>
              <span style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: statusColor(a.status).bg,
                color: statusColor(a.status).color,
                display: 'inline-block',
              }}>
                {a.status || 'pending'}
              </span>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {a.note || '—'}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ── book appointment modal ── */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 14, padding: 28,
              width: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 22,
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700,
                color: '#111827', margin: 0,
              }}>
                Book Appointment
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 20, cursor: 'pointer', color: '#9ca3af',
                }}
              >
                ✕
              </button>
            </div>

            {/* type */}
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

            {/* date */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Preferred Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* time */}
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
                  padding: '9px 18px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8, fontSize: 13,
                  color: '#374151', cursor: 'pointer',
                  fontFamily: 'inherit',
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
                  fontSize: 13, fontWeight: 600,
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {saving ? 'Booking...' : 'Book Now'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 5,
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 13,
  color: '#111827',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
}