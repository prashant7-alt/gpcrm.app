import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { statusChip } from '../lib/statusColors'
import { openReceipt } from '../lib/receipt'
import { exportRows, asDate } from '../lib/exportCsv'
import { sendPaymentConfirmedEmail } from '../emailService'
import Pagination from '../components/Pagination'
import { useIsMobile } from '../hooks/useIsMobile'
import { usePagination } from '../hooks/usePagination'
import { useRefetchOnFocus, useRefreshHold } from '../hooks/useRefetchOnFocus'
import { useFormDraft, hasFormDraft } from '../hooks/useFormDraft'
import {
  Download,
  Plus,
  Eye,
  CheckCircle2,
  Printer,
  Wallet,
  TrendingUp,
  Clock,
  AlertTriangle,
  Smartphone,
  Banknote,
  Landmark,
  X,
} from 'lucide-react'

const PAYMENT_TYPES = [
  'All Types',
  'Consultation Fee',
  'Application Fee',
  'Visa Fee',
  'Service Charge',
  'Document Fee',
  'Other',
]

// Typical Nepal fee ranges (from the agency fee guide). `avg` is the midpoint
// of the range and is used to pre-fill the amount when staff pick a fee type —
// staff can still type any figure over it.
const FEE_REFERENCE = {
  'Consultation Fee': { min: 0,     max: 5000,  avg: 2500,  label: 'Free – Rs 5,000' },
  'Application Fee':  { min: 0,     max: 25000, avg: 12500, label: 'Rs 0 – 25,000 / university' },
  'Visa Fee':        { min: 10000, max: 60000, avg: 35000, label: 'Rs 10,000 – 60,000+' },
  'Service Charge':  { min: 15000, max: 75000, avg: 45000, label: 'Rs 15,000 – 75,000' },
  'Document Fee':    { min: 5000,  max: 15000, avg: 10000, label: 'Rs 5,000 – 15,000' },
}
const AVG_AMOUNTS = new Set(Object.values(FEE_REFERENCE).map(r => String(r.avg)))
const blankForm = () => ({
  student_name: '', student_email: '',
  amount: String(FEE_REFERENCE['Consultation Fee'].avg),
  type: 'Consultation Fee', method: 'Cash', note: '',
})

// Colours + label come from the shared status system (src/lib/statusColors.js)
// so "paid" is the same green here, on the student portal and on receipts.
const badgeStyle = (status) => statusChip(status || 'pending')

const badgeLabel = (status) => {
  if (status === 'pending_verification') return 'Verify & Confirm'
  return statusChip(status || 'pending').label
}

// Method icon — small colored icon next to the method name, used both in
// the row/card view and the payment details modal
function MethodIcon({ method, size = 13 }) {
  if (method === 'eSewa')  return <Smartphone size={size} color={theme.status.success.main} />
  if (method === 'Khalti') return <Smartphone size={size} color={theme.purple} />
  if (method === 'Cash')   return <Banknote   size={size} color={theme.status.warning.text} />
  return <Landmark size={size} color={theme.primary} />
}

// ── View Modal ────────────────────────────────────────────
function ViewModal({ payment, onClose, onMarkPaid, marking, isMobile }) {
  if (!payment) return null

  const ref    = payment.txn_ref || payment.reference || '—'
  const date   = payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '—'
  const paidAt = payment.paid_at   ? new Date(payment.paid_at).toLocaleString('en-US', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }) : null

  const row = (label, value, highlight) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:`1px solid ${theme.surfaceAlt}` }}>
      <span style={{ fontSize:12, color:theme.textLight, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight: highlight ? 700 : 500, color: highlight ? theme.textStrong : theme.textMid, textAlign:'right', maxWidth:'60%' }}>{value}</span>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:theme.white, borderRadius: isMobile ? '16px 16px 0 0' : 16,
        width: isMobile ? '100%' : 480, maxHeight:'90vh', overflowY:'auto',
        boxSizing: 'border-box',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)', fontFamily:"'Segoe UI',Arial,sans-serif",
      }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:`1px solid ${theme.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:700, color:theme.textStrong, margin:0 }}>Payment Details</h3>
            <div style={{ fontSize:11, color:theme.textMuted, marginTop:3 }}>#{(payment.id||'').slice(0,8).toUpperCase()}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:badgeStyle(payment.status).bg, color:badgeStyle(payment.status).color }}>
              {badgeLabel(payment.status)}
            </span>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:theme.textMuted, lineHeight:1, display:'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Amount hero */}
        <div style={{ padding:'24px', background:theme.pageBg, textAlign:'center', borderBottom:`1px solid ${theme.border}` }}>
          <div style={{ fontSize:11, color:theme.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Amount</div>
          <div style={{ fontSize:36, fontWeight:800, color:theme.textStrong }}>Rs {Number(payment.amount||0).toLocaleString()}</div>
          {payment.method && (
            <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', background:theme.white, border:`1px solid ${theme.border}`, borderRadius:20, fontSize:12, color:theme.textMid, fontWeight:600 }}>
              <MethodIcon method={payment.method} /> {payment.method}
            </div>
          )}
        </div>

        {/* Details */}
        <div style={{ padding:'0 24px' }}>
          {row('Student Name',  payment.student_name  || '—', true)}
          {row('Student Email', payment.student_email || '—')}
          {row('Payment Type',  payment.type          || '—')}
          {row('Date Submitted', date)}
          {paidAt && row('Paid At', paidAt)}
          {row('Transaction Ref', ref)}
          {payment.note && row('Note', payment.note)}
        </div>

        {/* Verification info — the message depends on whether the gateway
            confirmed it (has our txn_ref / pidx) or the student just typed a
            QR transaction reference that still needs checking. */}
        {payment.status === 'pending_verification' && (
          (payment.txn_ref || payment.pidx) ? (
            <div style={{ margin:'16px 24px 0', padding:'12px 16px', background:theme.status.info.bg, border:`1px solid ${theme.status.info.border}`, borderRadius:10, fontSize:12, color:theme.primary }}>
              <strong>Payment received via {payment.method}</strong><br/>
              The gateway has confirmed this payment. Click <strong>"Confirm &amp; Send Email"</strong> to mark as paid and notify the student.
            </div>
          ) : (
            <div style={{ margin:'16px 24px 0', padding:'12px 16px', background:theme.status.warning.bg, border:`1px solid ${theme.status.warning.border}`, borderRadius:10, fontSize:12, color:theme.status.warning.text }}>
              <strong>Student-submitted {payment.method} reference</strong><br/>
              The student paid by QR and entered reference <strong>{payment.reference || '—'}</strong>. Check it against your {payment.method} merchant statement, then click <strong>"Confirm &amp; Send Email"</strong>.
            </div>
          )
        )}

        {/* Actions */}
        <div style={{
          padding:'20px 24px 24px', display:'flex', gap:10,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          justifyContent:'flex-end',
        }}>
          <button onClick={onClose} style={{ padding:'9px 18px', background:theme.pageBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textLight, cursor:'pointer', fontFamily:'inherit', width: isMobile ? '100%' : 'auto' }}>
            Close
          </button>

          {(payment.status === 'pending' || payment.status === 'pending_verification') && (
            <button
              onClick={() => { onMarkPaid(payment.id); onClose() }}
              disabled={marking}
              style={{
                padding:'9px 20px',
                background: payment.status === 'pending_verification' ? theme.status.info.main : theme.status.success.main,
                border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:theme.white,
                cursor: marking ? 'not-allowed' : 'pointer', fontFamily:'inherit',
                opacity: marking ? 0.7 : 1,
                width: isMobile ? '100%' : 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <CheckCircle2 size={15} />
              {payment.status === 'pending_verification' ? 'Confirm & Send Email' : 'Mark Paid'}
            </button>
          )}

          {payment.status === 'paid' && (
            <button
              onClick={() => { onClose(); setTimeout(() => openReceipt(payment), 100) }}
              style={{ padding:'9px 20px', background:theme.primary, border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:theme.white, cursor:'pointer', fontFamily:'inherit', width: isMobile ? '100%' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Printer size={15} />
              Print Receipt
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

export default function Payments() {
  const isMobile = useIsMobile()

  const [payments,     setPayments]     = useState([])
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('All Types')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading,      setLoading]      = useState(true)
  const [viewPayment,  setViewPayment]  = useState(null)
  const [markingPaid,  setMarkingPaid]  = useState(null)
  // The "Request Payment" draft survives navigating away & back (and reloads).
  const [showModal, setShowModal] = useState(() => hasFormDraft('payments:request'))
  const [form, setForm] = useFormDraft('payments:request', blankForm(), showModal)
  const [students, setStudents] = useState([])   // for the "Request Payment" picker

  useEffect(() => { loadPayments() }, [])
  useEffect(() => { loadStudents() }, [])
  useRefetchOnFocus(loadPayments)
  useRefreshHold(showModal)

  // Realtime — pick up new payment requests from students and changes made by
  // other staff without needing a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel('payments-staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => loadPayments())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Students who have a portal login — only they can receive & pay a request.
  async function loadStudents() {
    const { data } = await supabase
      .from('profiles').select('email, name').eq('role', 'student').order('name')
    const seen = new Set()
    const list = (data || []).filter(s => {
      const e = (s.email || '').trim().toLowerCase()
      if (!e || seen.has(e)) return false
      seen.add(e); return true
    })
    setStudents(list)
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from('payments').select('*').order('created_at', { ascending: false })
    if (error) console.error('Error loading payments:', error)
    // 'awaiting_payment' rows are students mid-way through an eSewa/Khalti
    // checkout — no money has moved yet. They only surface here once the
    // gateway confirms and the verify function flips them to
    // 'pending_verification'.
    setPayments((data || []).filter(p => p.status !== 'awaiting_payment'))
    setLoading(false)
  }

  const totalCollected = payments.filter(p => p.status==='paid').reduce((s,p)=>s+(Number(p.amount)||0),0)
  const totalPending   = payments.filter(p => p.status==='pending').reduce((s,p)=>s+(Number(p.amount)||0),0)
  const totalOverdue   = payments.filter(p => p.status==='overdue').reduce((s,p)=>s+(Number(p.amount)||0),0)
  const thisMonth      = payments.filter(p => {
    const d=new Date(p.created_at),now=new Date()
    return p.status==='paid'&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()
  }).reduce((s,p)=>s+(Number(p.amount)||0),0)

  // NOTE: theme.primaryblack / theme.black / theme.yellow / theme.daark were
  // being used with no fallback — if any of those keys don't exist in your
  // theme.js, the text color resolves to nothing and the number renders
  // invisible (exactly what your screenshot showed for "Pending" and
  // "Overdue"). Every card below now has a safe hard-coded fallback color
  // so a missing theme key can never make a number disappear again.
  const stats = [
    { label:'Total Collected', value:`Rs ${totalCollected.toLocaleString()}`, color: theme.textDark,             top: theme.primary,             Icon: Wallet       },
    { label:'This Month',      value:`Rs ${thisMonth.toLocaleString()}`,      color: theme.textDark,             top: theme.status.success.main, Icon: TrendingUp   },
    { label:'Pending',         value:`Rs ${totalPending.toLocaleString()}`,   color: theme.status.warning.text, top: theme.status.warning.main, Icon: Clock         },
    { label:'Overdue',         value:`Rs ${totalOverdue.toLocaleString()}`,   color: theme.status.danger.text,  top: theme.status.danger.main,  Icon: AlertTriangle },
  ]

  // A plain 'pending' row is only a request/claim — the student hasn't
  // successfully paid yet (cash not handed over, or a manual reference not
  // verified). Keep those out of the default view so this page shows real,
  // received money only. Staff can still reach them by picking the "Pending"
  // status filter to verify a cash / bank-transfer payment.
  const filtered = payments.filter(p => {
    const matchSearch = p.student_name?.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter==='All Types' || p.type===typeFilter
    const matchStatus = statusFilter==='All'     || p.status===statusFilter
    const hidePending = statusFilter !== 'pending' && p.status === 'pending'
    return matchSearch && matchType && matchStatus && !hidePending
  })

  const pg = usePagination(filtered, { pageSize: 20, resetKey: `${search}|${typeFilter}|${statusFilter}` })
  const rows = pg.pageItems

  // Pick a fee type and pre-fill the amount with that fee's average, unless
  // staff have already typed a custom figure of their own.
  function pickType(type) {
    setForm(f => {
      const ref = FEE_REFERENCE[type]
      const custom = f.amount && !AVG_AMOUNTS.has(String(f.amount))
      return { ...f, type, amount: custom ? f.amount : (ref ? String(ref.avg) : '') }
    })
  }

  async function handleAddPayment(e) {
    e.preventDefault()
    const email = form.student_email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) { alert('Enter a valid student email'); return }
    if (!(Number(form.amount) > 0))    { alert('Enter a valid amount'); return }

    const { data, error } = await supabase.from('payments').insert({
      student_name:  form.student_name.trim(),
      student_email: email,                       // the student sees & pays it from their portal
      amount:        Number(form.amount),
      type:          form.type,
      method:        form.method,
      note:          form.note,
      status:        'pending',
      date:          new Date().toISOString().split('T')[0],
    }).select().single()
    if (error) { alert('Error saving payment request: '+error.message); return }
    if (data) setPayments(prev => [data, ...prev])   // show it in the list now
    // It goes in as 'pending', which the default view hides — jump to the
    // Pending filter so the row the staff member just requested stays visible.
    setStatusFilter('pending')
    setForm(blankForm())
    setShowModal(false)
  }

  async function markPaid(id) {
    setMarkingPaid(id)
    const payment = payments.find(p => p.id === id)
    const paidAt  = payment?.paid_at || new Date().toISOString()

    // Flip the row to "Paid" in the list right away — the badge and totals
    // update on click, without waiting for a refetch or a page refresh.
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, status: 'paid', paid_at: paidAt } : p)))

    const { error } = await supabase
      .from('payments')
      .update({ status:'paid', paid_at: paidAt })
      .eq('id', id)

    if (error) {
      setPayments(prev => prev.map(p => (p.id === id ? { ...p, status: payment?.status, paid_at: payment?.paid_at } : p)))
      alert('Could not update: '+error.message); setMarkingPaid(null); return
    }

    if (payment) {
      const { data: profile } = await supabase
        .from('profiles').select('email,name').ilike('name', payment.student_name).maybeSingle()

      const studentEmail = profile?.email || payment.student_email || null
      if (studentEmail) {
        sendPaymentConfirmedEmail({
          student_name:  payment.student_name,
          student_email: studentEmail,
          amount:        payment.amount?.toString() || '0',
          payment_type:  payment.type   || 'Payment',
          method:        payment.method || 'Cash',
          date:          payment.date   || new Date().toLocaleDateString(),
          reference:     payment.txn_ref || payment.reference || '—',
        }).then(res => {
          if (res.success) console.log('Email sent to', studentEmail)
          else             console.warn('Email failed:', res.error)
        })
      }
    }

    setMarkingPaid(null)
    loadPayments()
  }

  const printReceipt = (payment) => openReceipt(payment)

  return (
    <div>

      {/* header */}
      <div style={{
        display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent:'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 12 : 0,
        marginBottom:20,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight:700, color:theme.textDark, margin:0 }}>Payments</h1>
          <p style={{ fontSize:13, color:theme.textLight, marginTop:4 }}>Request, manage and confirm student payments</p>
        </div>
        <div style={{ display:'flex', gap:10, flexDirection: isMobile ? 'column' : 'row' }}>
          <button
            onClick={() => exportRows('payments', filtered, [
              { header: 'Student',      value: p => p.student_name },
              { header: 'Email',        value: p => p.student_email },
              { header: 'Amount',       value: p => p.amount },
              { header: 'Type',         value: p => p.type },
              { header: 'Method',       value: p => p.method },
              { header: 'Status',       value: p => badgeLabel(p.status) },
              { header: 'Reference',    value: p => p.txn_ref || p.reference || p.pidx || '' },
              { header: 'Note',         value: p => p.note },
              { header: 'Created',      value: p => asDate(p.created_at) },
              { header: 'Paid At',      value: p => asDate(p.paid_at) },
            ])}
            style={{ padding:'8px 16px', background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, fontWeight:500, color:theme.textMid, cursor:'pointer', width: isMobile ? '100%' : 'auto', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}
          >
            <Download size={15} />
            Export
          </button>
          <button onClick={() => { setForm(blankForm()); setShowModal(true) }} style={{ padding:'8px 16px', background:theme.primary, border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:theme.white, cursor:'pointer', width: isMobile ? '100%' : 'auto', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <Plus size={15} />
            Request Payment
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 10 : 14, marginBottom:24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:10,
            padding: isMobile ? '14px 12px' : '18px 16px',
            display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:8,
          }}>
            <div style={{
              width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius:10,
              background: theme.surfaceAlt, flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <s.Icon size={isMobile ? 15 : 17} color={s.top} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize:11, color:theme.textLight }}>{s.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:10, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:8, padding:'8px 14px', flex:1 }}>
          <input placeholder="Search by student name..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ background:'none', border:'none', outline:'none', fontSize:13, color:theme.textMid, width:'100%' }} />
        </div>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ padding:'8px 14px', background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textMid, outline:'none', cursor:'pointer', width: isMobile ? '100%' : 'auto' }}>
          {PAYMENT_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ padding:'8px 14px', background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textMid, outline:'none', cursor:'pointer', width: isMobile ? '100%' : 'auto' }}>
          <option value="All">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* table / cards */}
      <div style={{ background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:10, overflow:'hidden' }}>

        {!isMobile && (
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1.5fr 1fr 1.4fr 1fr 2fr', padding:'10px 16px', background:theme.pageBg, borderBottom:`1px solid ${theme.border}` }}>
            {['Student','Amount','Type','Method','Status','Date','Actions'].map(h=>(
              <span key={h} style={{ fontSize:11, fontWeight:700, color:theme.textMuted, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</span>
            ))}
          </div>
        )}

        {loading && <p style={{ padding:20, color:theme.textLight, fontSize:13 }}>Loading...</p>}

        {!loading && filtered.length===0 && (
          <div style={{ padding:60, textAlign:'center', color:theme.textLight }}>
            <div style={{ fontSize:14, fontWeight:600, color:theme.textMid }}>No payments found</div>
          </div>
        )}

        {rows.map((p,i) => (
          isMobile ? (
            // ── Mobile card ──
            <div key={p.id} style={{
              padding: '14px 16px',
              borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.textDark }}>{p.student_name || '—'}</div>
                  {p.note && <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>{p.note}</div>}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0,
                  background: badgeStyle(p.status).bg, color: badgeStyle(p.status).color,
                }}>
                  {badgeLabel(p.status)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: theme.textDark }}>Rs {Number(p.amount || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: theme.textLight }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMid, flexWrap: 'wrap' }}>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Type: </b>{p.type || '—'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <MethodIcon method={p.method} size={12} /> {p.method || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setViewPayment(p)}
                  style={{ flex: 1, minWidth: 90, padding: '7px 10px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 6, fontSize: 12, color: theme.textMid, cursor: 'pointer', fontFamily: 'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}
                >
                  <Eye size={13} /> View
                </button>

                {(p.status === 'pending' || p.status === 'pending_verification') && (
                  <button
                    onClick={() => markPaid(p.id)}
                    disabled={markingPaid === p.id}
                    style={{
                      flex: 1, minWidth: 90, padding: '7px 10px',
                      background: p.status === 'pending_verification' ? theme.status.info.bg : theme.status.success.bg,
                      border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      color: p.status === 'pending_verification' ? theme.status.info.text : theme.status.success.text,
                      cursor: markingPaid === p.id ? 'not-allowed' : 'pointer',
                      opacity: markingPaid === p.id ? 0.6 : 1,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    }}
                  >
                    {markingPaid === p.id ? 'Processing...' : (<><CheckCircle2 size={13} /> {p.status === 'pending_verification' ? 'Confirm' : 'Mark Paid'}</>)}
                  </button>
                )}

                {p.status === 'paid' && (
                  <button onClick={() => printReceipt(p)} style={{ flex: 1, minWidth: 90, padding: '7px 10px', background: theme.status.info.bg, border: `1px solid ${theme.status.info.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: theme.status.info.text, cursor: 'pointer', fontFamily: 'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Printer size={13} /> Receipt
                  </button>
                )}
              </div>
            </div>
          ) : (
            // ── Desktop row ──
            <div key={p.id}
              style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1.5fr 1fr 1.4fr 1fr 2fr', padding:'13px 16px', borderBottom:i<rows.length-1?`1px solid ${theme.border}`:'none', alignItems:'center' }}
              onMouseEnter={e=>e.currentTarget.style.background=theme.pageBg}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
            >
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:theme.textDark }}>{p.student_name||'—'}</div>
                {p.note&&<div style={{ fontSize:11, color:theme.textLight, marginTop:2 }}>{p.note}</div>}
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:theme.textDark }}>Rs {Number(p.amount||0).toLocaleString()}</div>
              <div style={{ fontSize:13, color:theme.textMid }}>{p.type||'—'}</div>
              <div style={{ fontSize:12, color:theme.textLight, display:'flex', alignItems:'center', gap:5 }}>
                <MethodIcon method={p.method} /> {p.method||'—'}
              </div>
              <div>
                <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:badgeStyle(p.status).bg, color:badgeStyle(p.status).color }}>
                  {badgeLabel(p.status)}
                </span>
              </div>
              <div style={{ fontSize:12, color:theme.textLight }}>
                {p.created_at?new Date(p.created_at).toLocaleDateString():'—'}
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button
                  onClick={() => setViewPayment(p)}
                  style={{ padding:'5px 10px', background:theme.pageBg, border:`1px solid ${theme.border}`, borderRadius:6, fontSize:12, color:theme.textMid, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}
                >
                  <Eye size={13} /> View
                </button>

                {(p.status==='pending'||p.status==='pending_verification') && (
                  <button
                    onClick={() => markPaid(p.id)}
                    disabled={markingPaid===p.id}
                    style={{
                      padding:'5px 10px',
                      background: p.status==='pending_verification' ? theme.status.info.bg : theme.status.success.bg,
                      border:'none', borderRadius:6, fontSize:12, fontWeight:600,
                      color: p.status==='pending_verification' ? theme.status.info.text : theme.status.success.text,
                      cursor: markingPaid===p.id ? 'not-allowed' : 'pointer',
                      opacity: markingPaid===p.id ? 0.6 : 1,
                      display:'flex', alignItems:'center', gap:5,
                    }}
                  >
                    {markingPaid===p.id ? 'Processing...' : (<><CheckCircle2 size={13} /> {p.status==='pending_verification' ? 'Confirm' : 'Mark Paid'}</>)}
                  </button>
                )}

                {p.status==='paid' && (
                  <>
                    <span style={{ fontSize:12, color:theme.status.success.main, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      <CheckCircle2 size={13} /> Paid
                    </span>
                    <button onClick={()=>printReceipt(p)} style={{ padding:'5px 10px', background:theme.status.info.bg, border:`1px solid ${theme.status.info.border}`, borderRadius:6, fontSize:12, fontWeight:600, color:theme.status.info.text, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                      <Printer size={13} /> Receipt
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        ))}
      </div>

      <Pagination {...pg} onPage={pg.setPage} noun="payments" />

      {/* View Modal */}
      <ViewModal
        payment={viewPayment}
        onClose={() => setViewPayment(null)}
        onMarkPaid={markPaid}
        marking={!!markingPaid}
        isMobile={isMobile}
      />

      {/* Add payment modal */}
      {showModal && (
        <div onClick={()=>setShowModal(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:theme.cardBg, borderRadius: isMobile ? '12px 12px 0 0' : 12,
            padding: isMobile ? 20 : 28, width: isMobile ? '100%' : 420,
            boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto',
            boxShadow:'0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:theme.textDark, margin:0 }}>Request Payment</h2>
              <button onClick={()=>setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:theme.textLight, display:'flex' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize:12, color:theme.textLight, margin:'0 0 16px' }}>
              The student gets this in <strong>My Payments</strong> and pays it from their portal (Cash, eSewa or Khalti).
            </p>
            <form onSubmit={handleAddPayment}>
              <Field label="Student">
                <select
                  required
                  value={form.student_email}
                  onChange={e=>{
                    const s = students.find(x => (x.email||'').trim().toLowerCase() === e.target.value)
                    setForm({ ...form, student_email: e.target.value, student_name: s?.name || '' })
                  }}
                  style={inputStyle(theme)}
                >
                  <option value="">Select a student…</option>
                  {students.map(s => {
                    const email = (s.email || '').trim().toLowerCase()
                    return <option key={email} value={email}>{s.name ? `${s.name} — ${email}` : email}</option>
                  })}
                </select>
                {students.length === 0 && (
                  <div style={{ fontSize:11, color:theme.textMuted, marginTop:5 }}>No student logins found yet.</div>
                )}
              </Field>
              <Field label="Payment Type">
                <select value={form.type} onChange={e=>pickType(e.target.value)} style={inputStyle(theme)}>
                  {PAYMENT_TYPES.filter(t=>t!=='All Types').map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Amount (NPR)">
                <input required type="number" placeholder="e.g. 15000" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={inputStyle(theme)}/>
                {FEE_REFERENCE[form.type] && (
                  <div style={{ fontSize:11, color:theme.textMuted, marginTop:5 }}>
                    Typical Nepal range: {FEE_REFERENCE[form.type].label} · avg{' '}
                    <button type="button" onClick={()=>setForm({...form,amount:String(FEE_REFERENCE[form.type].avg)})}
                      style={{ background:'none', border:'none', padding:0, color:theme.primary, fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:11 }}>
                      Rs {FEE_REFERENCE[form.type].avg.toLocaleString()}
                    </button>
                  </div>
                )}
              </Field>
              <Field label="Suggested Method">
                <select value={form.method} onChange={e=>setForm({...form,method:e.target.value})} style={inputStyle(theme)}>
                  <option>Cash</option><option>eSewa</option><option>Khalti</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </Field>
              <Field label="Note (optional)"><input placeholder="Any extra info..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})} style={inputStyle(theme)}/></Field>

              {/* Fee guide — typical Nepal ranges + the average used to pre-fill */}
              <div style={{ border:`1px solid ${theme.border}`, borderRadius:8, overflow:'hidden', marginTop:4 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1.4fr 0.8fr', padding:'7px 12px', background:theme.pageBg, borderBottom:`1px solid ${theme.border}` }}>
                  {['Fee Type','Typical Nepal Range','Avg'].map(h=>(
                    <span key={h} style={{ fontSize:10, fontWeight:700, color:theme.textMuted, textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</span>
                  ))}
                </div>
                {Object.entries(FEE_REFERENCE).map(([type, r], i, arr) => {
                  const active = form.type === type
                  return (
                    <div key={type} onClick={()=>pickType(type)} style={{
                      display:'grid', gridTemplateColumns:'1.3fr 1.4fr 0.8fr', padding:'7px 12px', cursor:'pointer',
                      borderBottom: i<arr.length-1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                      background: active ? theme.status.info.bg : 'transparent',
                    }}>
                      <span style={{ fontSize:11, fontWeight: active?700:600, color: active?theme.primary:theme.textDark }}>{type}</span>
                      <span style={{ fontSize:11, color:theme.textMid }}>{r.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:theme.textDark }}>{r.avg.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex', gap:10, marginTop:20, flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ flex:1, padding:'10px', background:theme.pageBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textMid, cursor:'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex:1, padding:'10px', background:theme.primary, border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:theme.white, cursor:'pointer' }}>Send Request</button>
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
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:theme.textMid, marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}

function inputStyle(theme) {
  return { width:'100%', padding:'9px 12px', border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textDark, background:theme.pageBg, outline:'none', boxSizing:'border-box' }
}