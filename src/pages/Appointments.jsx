import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'
import { advanceApplicantStage } from '../lib/pipelineStages' // adjust path if needed

const statusStyle = (status) => {
  if (status === 'confirmed') return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'rejected')  return { bg: '#fee2e2', color: '#b91c1c' }
  if (status === 'completed') return { bg: '#dbeafe', color: '#1d4ed8' }
  return { bg: '#fef9c3', color: '#a16207' } // pending
}

export default function Appointments() {

  const [appointments, setAppointments] = useState([])
  const [search,       setSearch]       = useState('')
  const [filter,       setFilter]       = useState('All')
  const [loading,      setLoading]      = useState(true)

  // modal for admin to schedule new appointment
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    student_name: '', student_email: '',
    type: '', date: '', time: '', note: ''
  })

  // modal for reschedule
  const [rescheduleId, setRescheduleId] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })
    setAppointments(data || [])
    setLoading(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // ── ACCEPT appointment ──
  async function acceptAppointment(id) {
    await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', id)
    load()
  }

  // ── REJECT appointment ──
  async function rejectAppointment(id) {
    if (!window.confirm('Reject this appointment?')) return
    await supabase
      .from('appointments')
      .update({ status: 'rejected' })
      .eq('id', id)
    load()
  }

  // ── MARK as completed ──
  // NEW: takes the full appointment object (not just id) so we know its
  // type/student_email/student_name for the pipeline auto-advance below.
  async function completeAppointment(appt) {
    await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appt.id)

    // Auto-advance the applicant to "Counseling" once their counseling
    // session is marked complete. Only fires for that specific
    // appointment type — completing a "Document Review" or other type
    // won't touch the pipeline stage.
    if (appt.type === 'Counseling Session') {
      await advanceApplicantStage(
        supabase,
        { email: appt.student_email, name: appt.student_name },
        'Counseling'
      )
    }

    load()
  }

  // ── OPEN reschedule modal ──
  function openReschedule(appt) {
    setRescheduleId(appt.id)
    setRescheduleForm({ date: appt.date || '', time: appt.time || '' })
  }

  // ── SAVE reschedule ──
  async function saveReschedule() {
    if (!rescheduleForm.date || !rescheduleForm.time) {
      alert('Please pick date and time')
      return
    }
    await supabase
      .from('appointments')
      .update({
        date:   rescheduleForm.date,
        time:   rescheduleForm.time,
        status: 'confirmed', // auto-confirm after reschedule
      })
      .eq('id', rescheduleId)

    setRescheduleId(null)
    load()
  }

  // ── ADMIN — schedule a brand new appointment for a student ──
  async function scheduleAppointment() {
    if (!form.student_name || !form.date || !form.time || !form.type) {
      alert('Please fill required fields')
      return
    }
    await supabase.from('appointments').insert({
      student_name:  form.student_name,
      student_email: form.student_email,
      type:          form.type,
      date:          form.date,
      time:          form.time,
      note:          form.note,
      status:        'confirmed', // admin-created = auto confirmed
    })

    setForm({ student_name: '', student_email: '', type: '', date: '', time: '', note: '' })
    setShowModal(false)
    load()
  }

  // filters
  const filtered = appointments.filter(a => {
    const matchSearch = a.student_name?.toLowerCase()
      .includes(search.toLowerCase())
    const matchFilter = filter === 'All' || a.status === filter
    return matchSearch && matchFilter
  })

  // counts for tabs
  const counts = {
    All:       appointments.length,
    pending:   appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    rejected:  appointments.filter(a => a.status === 'rejected').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  }

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 700,
            color: theme.textDark, margin: 0,
          }}>
         
          </h1>
          <p style={{
            fontSize: 13, color: theme.textLight,
            marginTop: 4,
          }}>
            
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '9px 18px',
            background: theme.primary,
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            color: '#fff', cursor: 'pointer',
          }}
        >
          + Schedule Appointment
        </button>
      </div>

      {/* filter tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {Object.entries(counts).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '7px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
              border: `1px solid ${filter === key ? theme.primary : theme.border}`,
              background: filter === key ? theme.primaryLight : theme.cardBg,
              color: filter === key ? theme.primaryText : theme.textMid,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {key} ({count})
          </button>
        ))}
      </div>

      {/* search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: '8px 14px',
        marginBottom: 16,
        maxWidth: 380,
      }}>
        <span style={{ color: theme.textMuted }}></span>
        <input
          placeholder="Search by student name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'none', border: 'none',
            outline: 'none', fontSize: 13,
            color: theme.textMid, width: '100%',
          }}
        />
      </div>

      {/* table */}
      <div style={{
        background: theme.cardBg,
        border: `3px solid ${theme.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>

        {/* table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1.5fr 2fr',
          padding: '10px 16px',
          background: theme.pageBg,
          borderBottom: `3px solid ${theme.border}`,
        }}>
          {['Student','Type','Date & Time','Status','Note','Actions'].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 600,
              color: theme.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {loading && (
          <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>
            Loading...
          </p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 60, textAlign: 'center',
            color: theme.textLight,
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
              No appointments found
            </div>
          </div>
        )}

        {filtered.map((a, i) => (
          <div key={a.id} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1.5fr 2fr',
            padding: '13px 16px',
            borderBottom: i < filtered.length - 1
              ? `3px solid ${theme.border}` : 'none',
            alignItems: 'center',
          }}
            onMouseEnter={e =>
              e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e =>
              e.currentTarget.style.background = 'transparent'}
          >
            {/* student */}
            <div>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: theme.textDark,
              }}>
                {a.student_name || '—'}
              </div>
              <div style={{
                fontSize: 11, color: theme.textLight,
                marginTop: 2,
              }}>
                {a.student_email || '—'}
              </div>
            </div>

            {/* type */}
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {a.type || '—'}
            </div>

            {/* date + time */}
            <div>
              <div style={{ fontSize: 13, color: theme.textMid }}>
                {a.date || '—'}
              </div>
              <div style={{ fontSize: 12, color: theme.textLight }}>
                {a.time || '—'}
              </div>
            </div>

            {/* status badge */}
            <div>
              <span style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: statusStyle(a.status).bg,
                color: statusStyle(a.status).color,
              }}>
                {a.status || 'pending'}
              </span>
            </div>

            {/* note */}
            <div style={{
              fontSize: 12, color: theme.textLight,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {a.note || '—'}
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>

              {/* show Accept/Reject only if pending */}
              {a.status === 'pending' && (
                <>
                  <button
                    onClick={() => acceptAppointment(a.id)}
                    style={{
                      padding: '5px 10px',
                      background: '#dcfce7',
                      border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: 600,
                      color: '#15803d', cursor: 'pointer',
                    }}
                  >
                     Accept
                  </button>
                  <button
                    onClick={() => rejectAppointment(a.id)}
                    style={{
                      padding: '5px 10px',
                      background: '#fee2e2',
                      border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: 600,
                      color: '#b91c1c', cursor: 'pointer',
                    }}
                  >
                     Reject
                  </button>
                </>
              )}

              {/* show Complete only if confirmed */}
              {a.status === 'confirmed' && (
                <button
                  onClick={() => completeAppointment(a)}
                  style={{
                    padding: '5px 10px',
                    background: '#dbeafe',
                    border: 'none', borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    color: '#1d4ed8', cursor: 'pointer',
                  }}
                >
                   Complete
                </button>
              )}

              {/* reschedule — always available except completed */}
              {a.status !== 'completed' && (
                <button
                  onClick={() => openReschedule(a)}
                  style={{
                    padding: '5px 10px',
                    background: theme.pageBg,
                    border: `3px solid ${theme.border}`,
                    borderRadius: 6,
                    fontSize: 12, color: theme.textMid,
                    cursor: 'pointer',
                  }}
                >
                  Reschedule
                </button>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* ── reschedule modal ── */}
      {rescheduleId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(75, 40, 40, 0.4)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: '#fff',
            border: `1px solid ${theme.border}`,
            borderRadius: 14, padding: 28, width: 380,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{
              fontSize: 16, fontWeight: 700,
              color: theme.textDark, marginBottom: 20,
            }}>
              Reschedule Appointment
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                New Date
              </label>
              <input
                type="date"
                value={rescheduleForm.date}
                onChange={e => setRescheduleForm(prev => ({
                  ...prev, date: e.target.value
                }))}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                New Time
              </label>
              <select
                value={rescheduleForm.time}
                onChange={e => setRescheduleForm(prev => ({
                  ...prev, time: e.target.value
                }))}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  fontFamily: 'inherit',
                }}
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
              </select>
            </div>

            <div style={{
              display: 'flex', gap: 10,
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setRescheduleId(null)}
                style={{
                  padding: '9px 18px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveReschedule}
                style={{
                  padding: '9px 18px',
                  background: theme.primary,
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                Save & Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── admin schedule new appointment modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: '#fff',
            border: `1px solid ${theme.border}`,
            borderRadius: 14, padding: 28, width: 440,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700,
                color: theme.textDark, margin: 0,
              }}>
                Schedule Appointment
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 18, cursor: 'pointer',
                  color: theme.textLight,
                }}
              >
                ✕
              </button>
            </div>

            {[
              { label: 'Student Name *',  key: 'student_name',  placeholder: 'Ram Sharma' },
              { label: 'Student Email *', key: 'student_email', placeholder: 'ram@email.com' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', fontSize: 11,
                  fontWeight: 600, color: theme.textLight,
                  textTransform: 'uppercase', marginBottom: 5,
                }}>
                  {f.label}
                </label>
                <input
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8, fontSize: 13,
                    color: theme.textMid, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}

            {/* type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                Type *
              </label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">Select type...</option>
                <option>Counseling Session</option>
                <option>Document Review</option>
                <option>Visa Guidance</option>
                <option>Application Update</option>
                <option>General Query</option>
              </select>
            </div>

            {/* date + time */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block', fontSize: 11,
                  fontWeight: 600, color: theme.textLight,
                  textTransform: 'uppercase', marginBottom: 5,
                }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8, fontSize: 13,
                    color: theme.textMid, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block', fontSize: 11,
                  fontWeight: 600, color: theme.textLight,
                  textTransform: 'uppercase', marginBottom: 5,
                }}>
                  Time *
                </label>
                <select
                  value={form.time}
                  onChange={e => set('time', e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8, fontSize: 13,
                    color: theme.textMid, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Select...</option>
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
            </div>

            {/* note */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                Note (optional)
              </label>
              <textarea
                placeholder="Reason or details..."
                value={form.note}
                onChange={e => set('note', e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  resize: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{
              display: 'flex', gap: 10,
              justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '9px 18px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={scheduleAppointment}
                style={{
                  padding: '9px 18px',
                  background: theme.primary,
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomButtons onAdd={load} />
    </div>
  )
}