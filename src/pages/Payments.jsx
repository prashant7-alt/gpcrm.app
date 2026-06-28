import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { sendPaymentConfirmedEmail } from '../emailService'  // ← NEW

const PAYMENT_TYPES = [
  'All Types',
  'Consultation Fee',
  'Application Fee',
  'Visa Fee',
  'Service Charge',
  'Document Fee',
  'Other',
]

export default function Payments() {

  const [payments,     setPayments]     = useState([])
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All Types')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [form, setForm] = useState({
    student_name: '',
    amount: '',
    type: 'Consultation Fee',
    method: 'Cash',
    note: '',
  })

  useEffect(() => { loadPayments() }, [])

  async function loadPayments() {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error loading payments:', error)
    setPayments(data || [])
    setLoading(false)
  }

  const totalCollected = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const totalOverdue = payments
    .filter(p => p.status === 'overdue')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const thisMonth = payments
    .filter(p => {
      const d = new Date(p.created_at)
      const now = new Date()
      return p.status === 'paid' &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const stats = [
    { label: 'Total Collected', value: `Rs ${totalCollected.toLocaleString()}`, color: theme.primaryblack },
    { label: 'This Month',      value: `Rs ${thisMonth.toLocaleString()}`,      color: theme.black },
    { label: 'Pending',         value: `Rs ${totalPending.toLocaleString()}`,   color: theme.yellow, top: theme.yellow },
    { label: 'Overdue',         value: `Rs ${totalOverdue.toLocaleString()}`,   color: theme.daark },
  ]

  const filtered = payments.filter(p => {
    const matchSearch = p.student_name?.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter === 'All Types' || p.type === typeFilter
    const matchStatus = statusFilter === 'All'     || p.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  const badgeStyle = (status) => {
    if (status === 'paid')    return { bg: theme.primaryLight, color: theme.primaryText }
    if (status === 'pending') return { bg: theme.yellowLight,  color: theme.yellow }
    if (status === 'overdue') return { bg: theme.redLight,     color: theme.red }
    return { bg: '#f3f4f6', color: '#6b7280' }
  }

  async function handleAddPayment(e) {
    e.preventDefault()
    const { error } = await supabase.from('payments').insert({
      student_name: form.student_name,
      amount:       Number(form.amount),
      type:         form.type,
      method:       form.method,
      note:         form.note,
      status:       'pending',
    })
    if (error) { alert('Error saving payment: ' + error.message); return }
    setForm({ student_name: '', amount: '', type: 'Consultation Fee', method: 'Cash', note: '' })
    setShowModal(false)
    loadPayments()
  }

  // ── MARK AS PAID + SEND EMAIL ─────────────────────────────
  async function markPaid(id) {
    // Step 1: update status in Supabase
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid' })
      .eq('id', id)

    if (error) { alert('Could not update: ' + error.message); return }

    // Step 2: find the full payment row to get student details
    const payment = payments.find(p => p.id === id)

    // Step 3: find student email from profiles table using student_name
    if (payment) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .ilike('name', payment.student_name)
        .maybeSingle()

      // Step 4: send payment confirmed email if we found the student's email
      const studentEmail = profile?.email || payment.student_email || null

      if (studentEmail) {
        sendPaymentConfirmedEmail({
          student_name:  payment.student_name,
          student_email: studentEmail,
          amount:        payment.amount?.toString() || '0',
          payment_type:  payment.type   || 'Payment',
          method:        payment.method || 'Cash',
          date:          payment.date   || new Date().toLocaleDateString(),
          reference:     payment.reference || '—',
        }).then(res => {
          if (res.success) {
            console.log('✅ Payment email sent to', studentEmail)
          } else {
            console.warn('⚠️ Payment email failed:', res.error)
          }
        })
      }
    }

    loadPayments()
  }
  // ─────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: 0 }}></h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}></p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '8px 16px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, color: theme.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            Export
          </button>
          <button onClick={() => setShowModal(true)} style={{ padding: '8px 16px', background: theme.primary, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            + Add Payment
          </button>
        </div>
      </div>

      {/* ── stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderTop: `3px solid ${s.top}`, borderRadius: 10, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── search + filter bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '8px 14px', flex: 1 }}>
          <span style={{ color: theme.textMuted }}></span>
          <input
            placeholder="Search by student name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: theme.textMid, width: '100%' }}
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '8px 14px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer' }}>
          {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px 14px', background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer' }}>
          <option value="All">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* ── payments table ── */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1.2fr 1fr 1.5fr', padding: '10px 16px', background: theme.pageBg, borderBottom: `1px solid ${theme.border}` }}>
          {['Student', 'Amount', 'Type', 'Method', 'Status', 'Date', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {loading && <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>Loading...</p>}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.3 }}></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>No payments found</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Add your first payment record</div>
          </div>
        )}

        {filtered.map((p, i) => (
          <div
            key={p.id}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1.2fr 1fr 1.5fr', padding: '13px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textDark }}>{p.student_name || '—'}</div>
              {p.note && <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>{p.note}</div>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.textDark }}>Rs {Number(p.amount || 0).toLocaleString()}</div>
            <div style={{ fontSize: 13, color: theme.textMid }}>{p.type || '—'}</div>
            <div style={{ fontSize: 12, color: theme.textLight, display: 'flex', alignItems: 'center', gap: 4 }}>
              {p.method === 'Cash' && ''}{p.method === 'eSewa' && ''}{p.method === 'Bank' && ''}{p.method === 'Khalti' && ''}
              {' '}{p.method || '—'}
            </div>
            <div>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: badgeStyle(p.status).bg, color: badgeStyle(p.status).color, textTransform: 'capitalize' }}>
                {p.status || 'pending'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {p.status !== 'paid' && (
                <button
                  onClick={() => markPaid(p.id)}
                  style={{ padding: '5px 10px', background: theme.primaryLight, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, color: theme.primaryText, cursor: 'pointer' }}
                >
                  ✓ Mark Paid
                </button>
              )}
              {/* show green tick when paid */}
              {p.status === 'paid' && (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  ✅ Paid
                </span>
              )}
              <button style={{ padding: '5px 10px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 6, fontSize: 12, color: theme.textMid, cursor: 'pointer' }}>
                View
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── add payment modal ── */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: theme.cardBg, borderRadius: 12, padding: 28, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.textDark, margin: 0 }}>Add Payment</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: theme.textLight, lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={handleAddPayment}>
              <Field label="Student Name">
                <input required placeholder="e.g. Aarav Sharma" value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} style={inputStyle(theme)} />
              </Field>
              <Field label="Amount (NPR)">
                <input required type="number" placeholder="e.g. 15000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle(theme)} />
              </Field>
              <Field label="Payment Type">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle(theme)}>
                  {PAYMENT_TYPES.filter(t => t !== 'All Types').map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Payment Method">
                <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={inputStyle(theme)}>
                  <option>Cash</option><option>eSewa</option><option>Khalti</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </Field>
              <Field label="Note (optional)">
                <input placeholder="Any extra info..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle(theme)} />
              </Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, color: theme.textMid, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: theme.primary, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Save Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function inputStyle(theme) {
  return {
    width: '100%', padding: '9px 12px',
    border: `1px solid ${theme.border}`,
    borderRadius: 8, fontSize: 13,
    color: theme.textDark, background: theme.pageBg,
    outline: 'none', boxSizing: 'border-box',
  }
}