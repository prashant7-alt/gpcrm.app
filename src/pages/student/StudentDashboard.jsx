import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'

export default function StudentDashboard() {

  const navigate = useNavigate()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const [studentData, setStudentData] = useState(null)
  const [payments,    setPayments]    = useState([])
  const [tasks,       setTasks]       = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!profile.id) { navigate('/login'); return }
    loadData()
  }, [])

  async function loadData() {
    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('email', profile.email)
      .single()

    const { data: pays } = await supabase
      .from('payments')
      .select('*')
      .eq('student_name', profile.name)
      .order('created_at', { ascending: false })

    const { data: myTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('related_to', profile.name)
      .order('created_at', { ascending: false })

    setStudentData(student || null)
    setPayments(pays     || [])
    setTasks(myTasks     || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/login')
  }

  const stageBadge = (stage) => {
    const map = {
      'Lead':      { bg: '#dbeafe', color: '#1d4ed8' },
      'Inquiring': { bg: '#ede9fe', color: '#6d28d9' },
      'Class':     { bg: '#fef9c3', color: '#a16207' },
      'Abroad':    { bg: '#dcfce7', color: '#15803d' },
    }
    return map[stage] || { bg: '#f3f4f6', color: '#6b7280' }
  }

  const payBadge = (status) => {
    if (status === 'paid')    return { bg: '#dcfce7', color: '#15803d' }
    if (status === 'pending') return { bg: '#fef9c3', color: '#a16207' }
    if (status === 'overdue') return { bg: '#fee2e2', color: '#b91c1c' }
    return { bg: '#f3f4f6', color: '#6b7280' }
  }

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const navLinks = [
    { label: 'Dashboard',    path: '/student/dashboard' },
    { label: 'Appointments', path: '/student/appointments' },
    { label: 'Profile',      path: '/student/profile' },
  ]

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      color: '#6b7280',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      Loading your dashboard...
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── top navbar ── */}
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

        {/* nav links — middle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navLinks.map(link => {
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

        {/* greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700,
            color: '#111827', margin: '0 0 4px',
          }}>
            Welcome back, {profile.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Here is your application status and updates
          </p>
        </div>

        {/* profile card */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#16a34a',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              {profile.name}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>📧 {profile.email}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>📱 {profile.phone || 'Not set'}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>🌍 {profile.country || 'Not set'}</span>
            </div>
          </div>
          {studentData?.stage && (
            <div style={{
              padding: '6px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 600,
              background: stageBadge(studentData.stage).bg,
              color: stageBadge(studentData.stage).color,
              flexShrink: 0,
            }}>
              {studentData.stage}
            </div>
          )}
        </div>

        {/* 3 stat cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 20,
        }}>
          {[
            {
              label: 'Application Stage',
              value: studentData?.stage || 'Lead',
              icon: '📋', bg: '#dbeafe', color: '#1d4ed8', top: '#3b82f6',
            },
            {
              label: 'Fee Paid',
              value: `Rs ${(studentData?.fee_paid || 0).toLocaleString()}`,
              icon: '💰', bg: '#dcfce7', color: '#15803d', top: '#16a34a',
            },
            {
              label: 'Pending Tasks',
              value: tasks.filter(t => t.status === 'pending').length,
              icon: '✅', bg: '#fef9c3', color: '#a16207', top: '#f59e0b',
            },
          ].map(card => (
            <div key={card.label} style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderTop: `3px solid ${card.top}`,
              borderRadius: 10, padding: 16,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: card.bg,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                  {card.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* quick action — book appointment */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>
              📅 Need to talk to a counselor?
            </div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 3 }}>
              Book an appointment and we will confirm it soon
            </div>
          </div>
          <button
            onClick={() => navigate('/student/appointments')}
            style={{
              padding: '8px 18px',
              background: '#16a34a',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Book Appointment
          </button>
        </div>

        {/* payment history */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 20,
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 15, fontWeight: 700, color: '#111827',
          }}>
            💳 Payment History
          </div>
          {payments.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No payment records yet
            </div>
          ) : (
            payments.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '13px 18px',
                borderBottom: i < payments.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 2 }}>
                    Rs {p.amount?.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {p.method} · {p.date || new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span style={{
                  padding: '3px 12px', borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  background: payBadge(p.status).bg,
                  color: payBadge(p.status).color,
                }}>
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* tasks */}
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 15, fontWeight: 700, color: '#111827',
          }}>
            📋 Your Next Steps
          </div>
          {tasks.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No tasks assigned yet
            </div>
          ) : (
            tasks.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 18px',
                borderBottom: i < tasks.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: t.priority === 'High' ? '#ef4444' : '#16a34a',
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                    {t.title}
                  </div>
                  {t.due_date && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      Due: {new Date(t.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: t.status === 'done' ? '#dcfce7' : '#fef9c3',
                  color: t.status === 'done' ? '#15803d' : '#a16207',
                }}>
                  {t.status}
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}