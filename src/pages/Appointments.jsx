import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { statusChip } from '../lib/statusColors'
import BottomButtons from '../components/BottomButtons'
import { advanceApplicantStage } from '../lib/pipelineStages' // adjust path if needed
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'

// Colours from the shared status system (src/lib/statusColors.js):
// confirmed/completed = green, pending = amber, rejected = red.
const statusStyle = (status) => statusChip(status || 'pending')

export default function Appointments() {
  const isMobile = useIsMobile()

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
  useRefetchOnFocus(load)

  // ── Realtime — auto-refresh whenever any appointment is inserted,
  // updated, or deleted (e.g. a student books a new one, or another
  // admin accepts/rejects/reschedules one). No manual refresh needed.
  useEffect(() => {
    const channel = supabase
      .channel('appointments-admin')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'appointments',
      }, () => {
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function load() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false })
    setAppointments(data || [])
    setLoading(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Patch one appointment in local state right away, so the badge/actions
  // update on click without waiting for a refetch (or a manual refresh).
  const patchLocal = (id, fields) =>
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, ...fields } : a)))

  // Change an appointment's status: update the UI optimistically, write to
  // the DB, and roll back + report if the write fails.
  async function setStatus(appt, newStatus, { confirm } = {}) {
    if (confirm && !window.confirm(confirm)) return
    const prevStatus = appt.status
    patchLocal(appt.id, { status: newStatus })

    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appt.id)

    if (error) {
      patchLocal(appt.id, { status: prevStatus })
      alert('Could not update the appointment: ' + error.message)
      return false
    }
    return true
  }

  // ── ACCEPT appointment ──
  const acceptAppointment = (appt) => setStatus(appt, 'confirmed')

  // ── REJECT appointment ──
  const rejectAppointment = (appt) =>
    setStatus(appt, 'rejected', { confirm: 'Reject this appointment?' })

  // ── MARK as completed ──
  async function completeAppointment(appt) {
    const ok = await setStatus(appt, 'completed')
    if (!ok) return

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
    const id = rescheduleId
    const patch = {
      date:   rescheduleForm.date,
      time:   rescheduleForm.time,
      status: 'confirmed', // auto-confirm after reschedule
    }
    const before = appointments.find(a => a.id === id)
    patchLocal(id, patch)          // reflect it in the list right away
    setRescheduleId(null)

    const { error } = await supabase.from('appointments').update(patch).eq('id', id)
    if (error) {
      if (before) patchLocal(id, { date: before.date, time: before.time, status: before.status })
      alert('Could not reschedule: ' + error.message)
    }
  }

  // ── ADMIN — schedule a brand new appointment for a student ──
  async function scheduleAppointment() {
    if (!form.student_name || !form.date || !form.time || !form.type) {
      alert('Please fill required fields')
      return
    }
    const { data, error } = await supabase.from('appointments').insert({
      student_name:  form.student_name,
      student_email: form.student_email,
      type:          form.type,
      date:          form.date,
      time:          form.time,
      note:          form.note,
      status:        'confirmed', // admin-created = auto confirmed
    }).select().single()

    if (error) { alert('Could not schedule: ' + error.message); return }

    // Drop the new row straight into the list — no refetch needed.
    if (data) setAppointments(prev => [data, ...prev])
    setForm({ student_name: '', student_email: '', type: '', date: '', time: '', note: '' })
    setShowModal(false)
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

  const tableCols = '2fr 1.5fr 1.5fr 1fr 1.5fr 2fr'

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 12 : 0,
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? 18 : 20, fontWeight: 700,
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
            color: theme.white, cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          + Schedule Appointment
        </button>
      </div>

      {/* filter tabs — horizontal scroll on phone instead of wrapping into a tall block */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: isMobile ? 4 : 0,
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
              flexShrink: 0,
              whiteSpace: 'nowrap',
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
        maxWidth: isMobile ? '100%' : 380,
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

      {/* table / cards */}
      <div style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>

        {/* table header — desktop only */}
        {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: tableCols,
            padding: '10px 16px',
            background: theme.pageBg,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            {['Student','Type','Date & Time','Status','Note','Actions'].map(h => (
              <span key={h} style={{
                fontSize: 11, fontWeight: 700,
                color: theme.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {h}
              </span>
            ))}
          </div>
        )}

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
          isMobile ? (
            // ── Mobile card ──
            <div key={a.id} style={{
              padding: '14px 16px',
              borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.textDark }}>
                    {a.student_name || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, wordBreak: 'break-all' }}>
                    {a.student_email || '—'}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  background: statusStyle(a.status).bg,
                  color: statusStyle(a.status).color,
                }}>
                  {a.status || 'pending'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMid, flexWrap: 'wrap' }}>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Type: </b>{a.type || '—'}</span>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>When: </b>{a.date || '—'} {a.time || ''}</span>
              </div>

              {a.note && (
                <div style={{ fontSize: 12, color: theme.textLight }}>
                  <b style={{ color: theme.textMuted, fontWeight: 600 }}>Note: </b>{a.note}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {a.status === 'pending' && (
                  <>
                    <button
                      onClick={() => acceptAppointment(a)}
                      style={{
                        flex: 1, minWidth: 90,
                        padding: '7px 10px',
                        background: theme.status.success.bg,
                        border: 'none', borderRadius: 6,
                        fontSize: 12, fontWeight: 600,
                        color: theme.status.success.text, cursor: 'pointer',
                      }}
                    >
                       Accept
                    </button>
                    <button
                      onClick={() => rejectAppointment(a)}
                      style={{
                        flex: 1, minWidth: 90,
                        padding: '7px 10px',
                        background: theme.status.danger.bg,
                        border: 'none', borderRadius: 6,
                        fontSize: 12, fontWeight: 600,
                        color: theme.status.danger.text, cursor: 'pointer',
                      }}
                    >
                       Reject
                    </button>
                  </>
                )}

                {a.status === 'confirmed' && (
                  <button
                    onClick={() => completeAppointment(a)}
                    style={{
                      flex: 1, minWidth: 90,
                      padding: '7px 10px',
                      background: theme.status.info.bg,
                      border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: 600,
                      color: theme.primary, cursor: 'pointer',
                    }}
                  >
                     Complete
                  </button>
                )}

                {a.status !== 'completed' && (
                  <button
                    onClick={() => openReschedule(a)}
                    style={{
                      flex: 1, minWidth: 90,
                      padding: '7px 10px',
                      background: theme.pageBg,
                      border: `1px solid ${theme.border}`,
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
          ) : (
            // ── Desktop row ──
            <div key={a.id} style={{
              display: 'grid',
              gridTemplateColumns: tableCols,
              padding: '13px 16px',
              borderBottom: i < filtered.length - 1
                ? `1px solid ${theme.border}` : 'none',
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
                      onClick={() => acceptAppointment(a)}
                      style={{
                        padding: '5px 10px',
                        background: theme.status.success.bg,
                        border: 'none', borderRadius: 6,
                        fontSize: 12, fontWeight: 600,
                        color: theme.status.success.text, cursor: 'pointer',
                      }}
                    >
                       Accept
                    </button>
                    <button
                      onClick={() => rejectAppointment(a)}
                      style={{
                        padding: '5px 10px',
                        background: theme.status.danger.bg,
                        border: 'none', borderRadius: 6,
                        fontSize: 12, fontWeight: 600,
                        color: theme.status.danger.text, cursor: 'pointer',
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
                      background: theme.status.info.bg,
                      border: 'none', borderRadius: 6,
                      fontSize: 12, fontWeight: 600,
                      color: theme.primary, cursor: 'pointer',
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
                      border: `1px solid ${theme.border}`,
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
          )
        ))}
      </div>

      {/* ── reschedule modal ── */}
      {rescheduleId && (
        <div
          onClick={() => setRescheduleId(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(75, 40, 40, 0.4)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center', zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.white,
              border: `1px solid ${theme.border}`,
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 380,
              boxSizing: 'border-box',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
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
                  fontFamily: 'inherit', boxSizing: 'border-box',
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
                  fontFamily: 'inherit', boxSizing: 'border-box',
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
              flexDirection: isMobile ? 'column-reverse' : 'row',
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
                  width: isMobile ? '100%' : 'auto',
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
                  color: theme.white, cursor: 'pointer',
                  width: isMobile ? '100%' : 'auto',
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
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center', zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.white,
              border: `1px solid ${theme.border}`,
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >

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
                    fontFamily: 'inherit', boxSizing: 'border-box',
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
                  fontFamily: 'inherit', boxSizing: 'border-box',
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

            {/* date + time — stack on phone instead of squeezing side by side */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 10, marginBottom: 14,
            }}>
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
                    fontFamily: 'inherit', boxSizing: 'border-box',
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
                    fontFamily: 'inherit', boxSizing: 'border-box',
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
                  resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
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
                  width: isMobile ? '100%' : 'auto',
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
                  color: theme.white, cursor: 'pointer',
                  width: isMobile ? '100%' : 'auto',
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