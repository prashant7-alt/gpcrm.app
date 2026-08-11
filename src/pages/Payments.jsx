import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { sendPaymentConfirmedEmail } from '../emailService'
import { useIsMobile } from '../hooks/useIsMobile'
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

function receiptNumber(payment) {
  const idPart = (payment.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return `GP-${idPart}`
}

function buildReceiptHTML(payment) {
  const rcpt   = receiptNumber(payment)
  const amount = Number(payment.amount || 0).toLocaleString()
  const date   = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : payment.date || new Date(payment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const time = payment.paid_at
    ? new Date(payment.paid_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : ''
  const ref = payment.txn_ref || payment.reference || '—'
  const esc = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${rcpt}</title>
<style>
  @page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f5;padding:40px 20px;color:#18181b}
  .sheet{max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
  .band{height:6px;background:linear-gradient(90deg,#1a56db 0%,#16a34a 100%)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding:32px 36px 24px;border-bottom:1px solid #e4e4e7}
  .brand{display:flex;align-items:center;gap:12px}
  .brand-mark{width:46px;height:46px;border-radius:12px;background:#1a56db;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px}
  .brand-name{font-size:16px;font-weight:800;color:#18181b}.brand-sub{font-size:11.5px;color:#71717a;margin-top:2px}
  .receipt-tag{text-align:right}.receipt-tag .label{font-size:10.5px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em}
  .receipt-tag .num{font-size:17px;font-weight:800;color:#18181b;margin-top:3px}
  .status-pill{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:3px 11px;border-radius:20px;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700}
  .body{padding:30px 36px 8px}
  .amount-block{text-align:center;padding:22px 0 26px;border-bottom:1px dashed #d4d4d8;margin-bottom:22px}
  .amount-block .label{font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
  .amount-block .value{font-size:38px;font-weight:800;color:#18181b;margin-top:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 24px;margin-bottom:28px}
  .field .label{font-size:10.5px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .field .value{font-size:14px;font-weight:600;color:#18181b}.field .value.muted{font-weight:400;color:#52525b}
  .note-box{background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:14px 16px;margin-bottom:24px;font-size:12.5px;color:#52525b}
  .footer{padding:22px 36px 32px;border-top:1px solid #e4e4e7;text-align:center}
  .footer .thanks{font-size:13px;font-weight:700;color:#18181b;margin-bottom:4px}
  .footer .small{font-size:11px;color:#a1a1aa;line-height:1.6}
  .actions{max-width:620px;margin:18px auto 0;display:flex;gap:10px;justify-content:flex-end}
  .actions button{padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:none}
  .btn-print{background:#1a56db;color:#fff}.btn-close{background:#f4f4f5;color:#52525b;border:1px solid #e4e4e7}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}.actions{display:none}}
</style></head><body>
<div class="sheet"><div class="band"></div>
<div class="header">
  <div class="brand"><div class="brand-mark">GP</div><div><div class="brand-name">Global Pathway</div><div class="brand-sub">Consultancy CRM</div></div></div>
  <div class="receipt-tag"><div class="label">Receipt No.</div><div class="num">${esc(rcpt)}</div><div class="status-pill">✓ Paid</div></div>
</div>
<div class="body">
  <div class="amount-block"><div class="label">Amount Received</div><div class="value">Rs ${esc(amount)}</div></div>
  <div class="grid">
    <div class="field"><div class="label">Received From</div><div class="value">${esc(payment.student_name)}</div></div>
    <div class="field"><div class="label">Payment Type</div><div class="value">${esc(payment.type||'Payment')}</div></div>
    <div class="field"><div class="label">Payment Method</div><div class="value">${esc(payment.method||'—')}</div></div>
    <div class="field"><div class="label">Date${time?' & Time':''}</div><div class="value">${esc(date)}${time?` <span class="muted">· ${esc(time)}</span>`:''}</div></div>
    <div class="field"><div class="label">Transaction Reference</div><div class="value muted">${esc(ref)}</div></div>
    <div class="field"><div class="label">Student Email</div><div class="value muted">${esc(payment.student_email||'—')}</div></div>
  </div>
  ${payment.note?`<div class="note-box"><strong style="color:#18181b;">Note:</strong> ${esc(payment.note)}</div>`:''}
</div>
<div class="footer"><div class="thanks">Thank you for your payment</div><div class="small">System-generated receipt from Global Pathway Consultancy CRM.<br/>For queries, contact your counselor.</div></div>
</div>
<div class="actions"><button class="btn-close" onclick="window.close()">Close</button><button class="btn-print" onclick="window.print()">🖨 Print Receipt</button></div>
</body></html>`
}

const badgeStyle = (status) => {
  if (status === 'paid')                 return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'pending')              return { bg: '#fef9c3', color: '#a16207' }
  if (status === 'pending_verification') return { bg: '#dbeafe', color: '#1d4ed8' }
  if (status === 'overdue')              return { bg: '#fee2e2', color: '#b91c1c' }
  return { bg: '#f3f4f6', color: '#6b7280' }
}

const badgeLabel = (status) => {
  if (status === 'pending_verification') return 'Verify & Confirm'
  if (status === 'paid')    return 'Paid'
  if (status === 'pending') return 'Pending'
  if (status === 'overdue') return 'Overdue'
  return status || 'pending'
}

// Method icon — small colored icon next to the method name, used both in
// the row/card view and the payment details modal
function MethodIcon({ method, size = 13 }) {
  if (method === 'eSewa')  return <Smartphone size={size} color="#16a34a" />
  if (method === 'Khalti') return <Smartphone size={size} color="#7c3aed" />
  if (method === 'Cash')   return <Banknote   size={size} color="#ca8a04" />
  return <Landmark size={size} color="#2563eb" />
}

// ── View Modal ────────────────────────────────────────────
function ViewModal({ payment, onClose, onMarkPaid, marking, isMobile }) {
  if (!payment) return null

  const ref    = payment.txn_ref || payment.reference || '—'
  const date   = payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '—'
  const paidAt = payment.paid_at   ? new Date(payment.paid_at).toLocaleString('en-US', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }) : null

  const row = (label, value, highlight) => (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #f3f4f6' }}>
      <span style={{ fontSize:12, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight: highlight ? 700 : 500, color: highlight ? '#111827' : '#374151', textAlign:'right', maxWidth:'60%' }}>{value}</span>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16,
        width: isMobile ? '100%' : 480, maxHeight:'90vh', overflowY:'auto',
        boxSizing: 'border-box',
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)', fontFamily:"'Segoe UI',Arial,sans-serif",
      }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#111827', margin:0 }}>Payment Details</h3>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>#{(payment.id||'').slice(0,8).toUpperCase()}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, background:badgeStyle(payment.status).bg, color:badgeStyle(payment.status).color }}>
              {badgeLabel(payment.status)}
            </span>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', lineHeight:1, display:'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Amount hero */}
        <div style={{ padding:'24px', background:'#f9fafb', textAlign:'center', borderBottom:'1px solid #e5e7eb' }}>
          <div style={{ fontSize:11, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Amount</div>
          <div style={{ fontSize:36, fontWeight:800, color:'#111827' }}>Rs {Number(payment.amount||0).toLocaleString()}</div>
          {payment.method && (
            <div style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', background:'#fff', border:'1px solid #e5e7eb', borderRadius:20, fontSize:12, color:'#374151', fontWeight:600 }}>
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

        {/* Khalti/eSewa verification info */}
        {payment.status === 'pending_verification' && (
          <div style={{ margin:'16px 24px 0', padding:'12px 16px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, fontSize:12, color:'#1e40af' }}>
            <strong>Payment received via {payment.method}</strong><br/>
            The gateway has confirmed this payment. Click <strong>"Confirm & Send Email"</strong> to mark as paid and notify the student.
          </div>
        )}

        {/* Actions */}
        <div style={{
          padding:'20px 24px 24px', display:'flex', gap:10,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          justifyContent:'flex-end',
        }}>
          <button onClick={onClose} style={{ padding:'9px 18px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, color:'#6b7280', cursor:'pointer', fontFamily:'inherit', width: isMobile ? '100%' : 'auto' }}>
            Close
          </button>

          {(payment.status === 'pending' || payment.status === 'pending_verification') && (
            <button
              onClick={() => { onMarkPaid(payment.id); onClose() }}
              disabled={marking}
              style={{
                padding:'9px 20px',
                background: payment.status === 'pending_verification' ? '#1d4ed8' : '#16a34a',
                border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff',
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
              onClick={() => { onClose(); setTimeout(() => {
                const html = buildReceiptHTML(payment)
                const win  = window.open('','_blank','width=720,height=900')
                if (win) { win.document.open(); win.document.write(html); win.document.close(); win.focus() }
              }, 100) }}
              style={{ padding:'9px 20px', background:'#1d4ed8', border:'none', borderRadius:8, fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:'inherit', width: isMobile ? '100%' : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
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
  const [showModal,    setShowModal]    = useState(false)
  const [viewPayment,  setViewPayment]  = useState(null)
  const [markingPaid,  setMarkingPaid]  = useState(null)
  const [form, setForm] = useState({
    student_name:'', amount:'', type:'Consultation Fee', method:'Cash', note:'',
  })

  useEffect(() => { loadPayments() }, [])

  async function loadPayments() {
    const { data, error } = await supabase
      .from('payments').select('*').order('created_at', { ascending: false })
    if (error) console.error('Error loading payments:', error)
    setPayments(data || [])
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
    { label:'Total Collected', value:`Rs ${totalCollected.toLocaleString()}`, color: theme.primaryblack || '#111827', top: '#2563eb', Icon: Wallet       },
    { label:'This Month',      value:`Rs ${thisMonth.toLocaleString()}`,      color: theme.black       || '#111827', top: '#16a34a', Icon: TrendingUp   },
    { label:'Pending',         value:`Rs ${totalPending.toLocaleString()}`,   color: '#a16207',                       top: '#ca8a04', Icon: Clock         },
    { label:'Overdue',         value:`Rs ${totalOverdue.toLocaleString()}`,   color: '#b91c1c',                       top: '#dc2626', Icon: AlertTriangle },
  ]

  const filtered = payments.filter(p => {
    const matchSearch = p.student_name?.toLowerCase().includes(search.toLowerCase())
    const matchType   = typeFilter==='All Types' || p.type===typeFilter
    const matchStatus = statusFilter==='All'     || p.status===statusFilter
    return matchSearch && matchType && matchStatus
  })

  async function handleAddPayment(e) {
    e.preventDefault()
    const { error } = await supabase.from('payments').insert({
      student_name:form.student_name, amount:Number(form.amount),
      type:form.type, method:form.method, note:form.note, status:'pending',
    })
    if (error) { alert('Error saving payment: '+error.message); return }
    setForm({ student_name:'', amount:'', type:'Consultation Fee', method:'Cash', note:'' })
    setShowModal(false)
    loadPayments()
  }

  async function markPaid(id) {
    setMarkingPaid(id)
    const payment = payments.find(p => p.id === id)

    const { error } = await supabase
      .from('payments')
      .update({ status:'paid', paid_at: payment?.paid_at || new Date().toISOString() })
      .eq('id', id)

    if (error) { alert('Could not update: '+error.message); setMarkingPaid(null); return }

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
          if (res.success) console.log('✅ Email sent to', studentEmail)
          else             console.warn('⚠️ Email failed:', res.error)
        })
      }
    }

    setMarkingPaid(null)
    loadPayments()
  }

  function printReceipt(payment) {
    const html = buildReceiptHTML(payment)
    const win  = window.open('','_blank','width=720,height=900')
    if (!win) { alert('Please allow pop-ups to print receipts.'); return }
    win.document.open(); win.document.write(html); win.document.close(); win.focus()
  }

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
          <p style={{ fontSize:13, color:theme.textLight, marginTop:4 }}>Manage and confirm student payments</p>
        </div>
        <div style={{ display:'flex', gap:10, flexDirection: isMobile ? 'column' : 'row' }}>
          <button style={{ padding:'8px 16px', background:theme.cardBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, fontWeight:500, color:theme.textMid, cursor:'pointer', width: isMobile ? '100%' : 'auto', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <Download size={15} />
            Export
          </button>
          <button onClick={() => setShowModal(true)} style={{ padding:'8px 16px', background:theme.primary, border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer', width: isMobile ? '100%' : 'auto', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <Plus size={15} />
            Add Payment
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 10 : 14, marginBottom:24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background:theme.cardBg, border:`1px solid ${theme.border}`, borderTop:`3px solid ${s.top}`, borderRadius:10, padding: isMobile ? '12px 14px' : '16px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:11, color:theme.textLight }}>{s.label}</div>
              <s.Icon size={15} color={s.top} strokeWidth={2.2} />
            </div>
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
              <span key={h} style={{ fontSize:11, fontWeight:600, color:theme.textMuted, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</span>
            ))}
          </div>
        )}

        {loading && <p style={{ padding:20, color:theme.textLight, fontSize:13 }}>Loading...</p>}

        {!loading && filtered.length===0 && (
          <div style={{ padding:60, textAlign:'center', color:theme.textLight }}>
            <div style={{ fontSize:14, fontWeight:600, color:theme.textMid }}>No payments found</div>
          </div>
        )}

        {filtered.map((p,i) => (
          isMobile ? (
            // ── Mobile card ──
            <div key={p.id} style={{
              padding: '14px 16px',
              borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
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
                      background: p.status === 'pending_verification' ? '#dbeafe' : '#dcfce7',
                      border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      color: p.status === 'pending_verification' ? '#1d4ed8' : '#15803d',
                      cursor: markingPaid === p.id ? 'not-allowed' : 'pointer',
                      opacity: markingPaid === p.id ? 0.6 : 1,
                      display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    }}
                  >
                    {markingPaid === p.id ? 'Processing...' : (<><CheckCircle2 size={13} /> {p.status === 'pending_verification' ? 'Confirm' : 'Mark Paid'}</>)}
                  </button>
                )}

                {p.status === 'paid' && (
                  <button onClick={() => printReceipt(p)} style={{ flex: 1, minWidth: 90, padding: '7px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', fontFamily: 'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                    <Printer size={13} /> Receipt
                  </button>
                )}
              </div>
            </div>
          ) : (
            // ── Desktop row ──
            <div key={p.id}
              style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1.5fr 1fr 1.4fr 1fr 2fr', padding:'13px 16px', borderBottom:i<filtered.length-1?`1px solid ${theme.border}`:'none', alignItems:'center' }}
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
                      background: p.status==='pending_verification' ? '#dbeafe' : '#dcfce7',
                      border:'none', borderRadius:6, fontSize:12, fontWeight:600,
                      color: p.status==='pending_verification' ? '#1d4ed8' : '#15803d',
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
                    <span style={{ fontSize:12, color:'#16a34a', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      <CheckCircle2 size={13} /> Paid
                    </span>
                    <button onClick={()=>printReceipt(p)} style={{ padding:'5px 10px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, fontSize:12, fontWeight:600, color:'#1d4ed8', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
                      <Printer size={13} /> Receipt
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        ))}
      </div>

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
              <h2 style={{ fontSize:16, fontWeight:700, color:theme.textDark, margin:0 }}>Add Payment</h2>
              <button onClick={()=>setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:theme.textLight, display:'flex' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddPayment}>
              <Field label="Student Name"><input required placeholder="e.g. Aarav Sharma" value={form.student_name} onChange={e=>setForm({...form,student_name:e.target.value})} style={inputStyle(theme)}/></Field>
              <Field label="Amount (NPR)"><input required type="number" placeholder="e.g. 15000" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} style={inputStyle(theme)}/></Field>
              <Field label="Payment Type">
                <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={inputStyle(theme)}>
                  {PAYMENT_TYPES.filter(t=>t!=='All Types').map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Payment Method">
                <select value={form.method} onChange={e=>setForm({...form,method:e.target.value})} style={inputStyle(theme)}>
                  <option>Cash</option><option>eSewa</option><option>Khalti</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </Field>
              <Field label="Note (optional)"><input placeholder="Any extra info..." value={form.note} onChange={e=>setForm({...form,note:e.target.value})} style={inputStyle(theme)}/></Field>
              <div style={{ display:'flex', gap:10, marginTop:20, flexDirection: isMobile ? 'column-reverse' : 'row' }}>
                <button type="button" onClick={()=>setShowModal(false)} style={{ flex:1, padding:'10px', background:theme.pageBg, border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textMid, cursor:'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex:1, padding:'10px', background:theme.primary, border:'none', borderRadius:8, fontSize:13, fontWeight:600, color:'#fff', cursor:'pointer' }}>Save Payment</button>
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
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 }}>{label}</label>
      {children}
    </div>
  )
}

function inputStyle(theme) {
  return { width:'100%', padding:'9px 12px', border:`1px solid ${theme.border}`, borderRadius:8, fontSize:13, color:theme.textDark, background:theme.pageBg, outline:'none', boxSizing:'border-box' }
}