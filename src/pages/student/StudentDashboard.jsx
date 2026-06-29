import { useState, useEffect } from 'react'
// useState   → manages payments list, tasks list, and loading flag
// useEffect  → triggers data load once after the component first renders

import { useNavigate } from 'react-router-dom'
// useNavigate → programmatically redirects to /login if student isn't authenticated

import { supabase } from '../../supabase'
// supabase → pre-configured client for querying payments and tasks tables

import StudentLayout from './StudentLayout'
// StudentLayout → shared shell component (student sidebar + navbar)
//                 this page only provides the inner content


export default function StudentDashboard() {

  const navigate = useNavigate()

  // Read cached profile from localStorage (saved there at login)
  // '{}' fallback prevents JSON.parse(null) from throwing if nothing stored
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')


  // ── STATE ──────────────────────────────────────────────────
  const [payments, setPayments] = useState([])   // payment rows belonging to this student
  const [tasks,    setTasks]    = useState([])   // task rows assigned to this student
  const [loading,  setLoading]  = useState(true) // shows loading screen until both queries finish


  // ── ON MOUNT: auth guard + data fetch ─────────────────────
  useEffect(() => {
    if (!profile.id) {
      navigate('/login')  // no stored profile → not logged in → redirect
      return
    }
    loadData()
  }, [])
  // [] → runs only once after the first render, never re-runs


  // ── DATA LOADER ───────────────────────────────────────────
  async function loadData() {
    // Each query is wrapped in its OWN try/catch so that if one table
    // is missing or has a permission error, the other query still runs
    // and the page never goes completely blank

    try {
      // Fetch payments where student_name matches the logged-in student
      // Note: matching by name (not ID) — works as long as names are unique
      const { data: pays } = await supabase
        .from('payments')
        .select('*')
        .eq('student_name', profile.name || '')   // '' fallback if name is undefined
        .order('created_at', { ascending: false }) // newest payment first

      setPayments(pays || [])  // null fallback in case Supabase returns null
    } catch (err) {
      console.log('payments load skipped:', err.message)
      setPayments([])  // fail silently — show empty state rather than crashing
    }

    try {
      // Fetch tasks assigned to this student via the `related_to` field
      const { data: myTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('related_to', profile.name || '')
        .order('created_at', { ascending: false })

      setTasks(myTasks || [])
    } catch (err) {
      console.log('tasks load skipped:', err.message)
      setTasks([])  // same silent-fail pattern
    }

    setLoading(false)  // both queries done (success or fail) → hide loading screen
  }


  // ── PAYMENT BADGE COLOR HELPER ────────────────────────────
  const payBadge = (status) => {
    if (status === 'paid')    return { bg: '#dcfce7', color: '#15803d' }  // green
    if (status === 'pending') return { bg: '#fef9c3', color: '#a16207' }  // yellow
    if (status === 'overdue') return { bg: '#fee2e2', color: '#b91c1c' }  // red
    return { bg: '#f3f4f6', color: '#6b7280' }  // gray — unknown/default status
  }


  // ── LOADING SCREEN ────────────────────────────────────────
  // Shown instead of the main content until loadData() finishes
  if (loading) {
    return (
      <StudentLayout>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading your dashboard...</p>
      </StudentLayout>
    )
  }


  // ─────────────────────────────────────────────────────────
  // MAIN RENDER (only reached after loading === false)
  // ─────────────────────────────────────────────────────────
  return (
    <StudentLayout>

      {/* ── GREETING ──────────────────────────────────────── */}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        Welcome back, {(profile.name || 'Student').split(' ')[0]}
        {/* .split(' ')[0] → takes only the first name, e.g. "Ram Sharma" → "Ram" */}
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
Test checck pls      </p>


      {/* ── 3 STAT CARDS ──────────────────────────────────── */}
      {/* Defined as an array so all three cards share identical JSX structure */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',  // three equal-width columns
        gap: 14, marginBottom: 20,
      }}>
        {[
          {
            label: 'Total Payments',
            value: payments.length,             // count of ALL payment rows
            icon: '', color: 'black',
          },
          {
            label: 'Amount Paid',
            // Only sum payments with status === 'paid' (ignores pending/overdue)
            value: `Rs ${payments
              .filter(p => p.status === 'paid')
              .reduce((sum, p) => sum + (p.amount || 0), 0)  // accumulate amounts
              .toLocaleString()}`,              // formats number with commas e.g. "12,500"
            icon: '', color: 'black',
          },
          {
            label: 'Pending Tasks',
            value: tasks.filter(t => t.status === 'pending').length,  // count only pending
            icon: '', color: 'black',
          },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderTop: `3px solid ${card.top}`,  // colored top accent (card.top not set → undefined → no color)
            borderRadius: 10, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {/* Icon circle */}
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: card.bg,             // card.bg not set → undefined → transparent
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* ── PAYMENT HISTORY CARD ──────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 12, overflow: 'hidden', marginBottom: 20,
      }}>
        {/* Card header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e5e7eb',
          fontSize: 15, fontWeight: 700, color: '#111827',
        }}>
          Payment History
        </div>

        {/* Empty state */}
        {payments.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No payment records yet
          </div>
        ) : (
          // One row per payment
          payments.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 18px',
              // Divider under every row except the last
              borderBottom: i < payments.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>
              <div>
                {/* Amount — optional chaining (?.) guards against null amount */}
                <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 2 }}>
                  Rs {p.amount?.toLocaleString()}
                </div>
                {/* Subtitle: payment method + date (falls back to created_at if date not set) */}
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {p.method} · {p.date || new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
              {/* Status badge — color from payBadge() helper */}
              <span style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: payBadge(p.status).bg, color: payBadge(p.status).color,
              }}>
                {p.status}
              </span>
            </div>
          ))
        )}
      </div>


      {/* ── TASKS / NEXT STEPS CARD ───────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e5e7eb',
          fontSize: 15, fontWeight: 700, color: '#111827',
        }}>
          Your Next Steps
        </div>

        {/* Empty state */}
        {tasks.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No tasks assigned yet
          </div>
        ) : (
          tasks.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 18px',
              borderBottom: i < tasks.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>

              {/* Priority dot — color indicates urgency */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: t.priority === 'High'   ? '#ef4444'  // red for high
                          : t.priority === 'Urgent' ? '#dc2626'  // darker red for urgent
                          : '#16a34a',                            // green for everything else
                flexShrink: 0,  // dot never shrinks when title is long
              }} />

              {/* Task title + optional due date */}
              <div style={{ flex: 1 }}>  {/* flex:1 → takes all remaining width */}
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{t.title}</div>
                {/* Only render due date row if the field exists */}
                {t.due_date && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Due: {new Date(t.due_date).toLocaleDateString()}
                    {/* toLocaleDateString() formats as "6/20/2026" based on browser locale */}
                  </div>
                )}
              </div>

              {/* Task status badge — green if done, yellow if pending */}
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: t.status === 'done' ? '#dcfce7' : '#fef9c3',
                color:      t.status === 'done' ? '#15803d' : '#a16207',
              }}>
                {t.status}
              </span>
            </div>
          ))
        )}
      </div>

    </StudentLayout>
  )
}