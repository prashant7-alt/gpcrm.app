import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase, functionHeaders } from '../../supabase'
import StudentLayout from './StudentLayout'
import theme from '../../theme'
import { statusChip } from '../../lib/statusColors'
import { openReceipt } from '../../lib/receipt'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useRefetchOnFocus, useRefreshHold } from '../../hooks/useRefetchOnFocus'
import {
  Receipt,
  CheckCircle2,
  Hourglass,
  CreditCard,
  Banknote,
  Circle,
  X,
  Zap,
  Camera,
  Check,
  ArrowRight,
  ArrowLeft,
  Printer,
} from 'lucide-react'

const QR_SRC = '/qr.png'            // generic / Khalti
const QR_SRC_ESEWA = '/qr-esewa.png' // eSewa merchant QR

const SUPABASE_URL   = 'https://txwpmjtixdbebnbqorju.supabase.co'
const MERCHANT_CODE  = 'EPAYTEST'
const ESEWA_FORM_URL = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'

// Bank Transfer removed — Cash, eSewa, Khalti only
const METHOD_OPTIONS  = ['Cash', 'eSewa', 'Khalti']
const TYPE_OPTIONS    = [
  'Consultation Fee', 'Application Fee', 'Visa Fee',
  'Document Fee', 'College Fee', 'Other',
]
const DIGITAL_METHODS = ['eSewa', 'Khalti']

// Icon + color per payment method, used both in the picker and the pay-now buttons
const METHOD_META = {
  Cash:   { Icon: Banknote, color: theme.textMid },
  eSewa:  { Icon: Circle,   color: '#60BB46' },
  Khalti: { Icon: Circle,   color: '#5C2D91' },
}

// Same shared status colours as the staff Payments page.
const statusStyle = (s) => statusChip(s || 'pending')

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
  fontSize: 13, color: theme.textStrong, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: theme.white,
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: theme.textLight, textTransform: 'uppercase', marginBottom: 5,
}

export default function StudentPayments() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const [payments, setPayments] = useState([])
  const [loading,  setLoading]  = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [step,      setStep]      = useState(1)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({
    amount: '', type: TYPE_OPTIONS[0], method: 'Cash', note: '', reference: '',
  })
  const [createdId,   setCreatedId]   = useState(null)
  const [qrLoadError, setQrLoadError] = useState(false)

  // eSewa "pay instantly" is a native <form> POST (see step 2). We pre-fetch the
  // signed field set here so tapping the button is a plain, synchronous form
  // submit — mobile browsers block a JS form.submit() that runs after `await`.
  const [esewaFields, setEsewaFields] = useState(null)
  const [esewaErr,    setEsewaErr]    = useState('')
  const [khaltiBusy,  setKhaltiBusy]  = useState(false)
  const [khaltiErr,   setKhaltiErr]   = useState('')

  useEffect(() => {
    if (!profile.id) { navigate('/student-login'); return }
    load()
  }, [])
  useRefetchOnFocus(load)
  useRefreshHold(showModal)

  // Pre-arm the eSewa native form as soon as the student reaches its pay screen.
  useEffect(() => {
    if (showModal && step === 2 && form.method === 'eSewa' && Number(form.amount) > 0) {
      prepareEsewa()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, step, form.method])

  // Realtime — when a counsellor confirms a payment, the badge here flips to
  // "Paid" on its own. No refresh needed.
  useEffect(() => {
    if (!profile.email) return
    const channel = supabase
      .channel('student-payments-' + profile.email)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'payments',
        filter: `student_email=eq.${profile.email}`,
      }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.email])

  async function load() {
    setLoading(true)

    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_email', profile.email || '')
      .order('created_at', { ascending: false })

    setPayments(data || [])
    setLoading(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Creates the payments row on demand and remembers its id, so we never write
  // an unpaid row to the DB just because the student typed an amount. Digital
  // payments only get a row once the student actually starts paying (gateway
  // redirect or reference submit). Re-uses the row if one already exists for
  // this modal session.
  async function ensurePaymentRow(status) {
    if (createdId) {
      // Keep the row in sync with anything the student changed before paying,
      // so the gateway signature / amount checks still line up.
      await supabase
        .from('payments')
        .update({
          amount: parseFloat(form.amount),
          type:   form.type,
          method: form.method,
          note:   form.note || '',
        })
        .eq('id', createdId)
        .neq('status', 'paid')
      return createdId
    }
    const { data, error } = await supabase
      .from('payments')
      .insert({
        student_name:  profile.name,
        student_email: profile.email || '',
        amount:        parseFloat(form.amount),
        type:          form.type,
        method:        form.method,
        note:          form.note || '',
        reference:     '',
        status,
        date:          new Date().toISOString().split('T')[0],
      })
      .select()
      .single()
    if (error) {
      console.error('[payment] ensurePaymentRow insert failed:', error)
      setEsewaErr('Could not create the payment: ' + error.message)
      setKhaltiErr('Could not create the payment: ' + error.message)
      return null
    }
    setCreatedId(data.id)
    return data.id
  }

  async function submitRequest() {
    if (!form.amount || Number(form.amount) <= 0)
      return alert('Enter a valid amount')

    // Digital methods: don't touch the DB yet — move to the pay screen. The row
    // is only created when the student actually pays (see payWith*Now /
    // submitReference), so nothing shows up for staff before a real payment.
    if (DIGITAL_METHODS.includes(form.method)) {
      setCreatedId(null)
      setQrLoadError(false)
      setStep(2)
      return
    }

    // Cash: a legitimate in-person request — record it as pending now.
    setSaving(true)
    const id = await ensurePaymentRow('pending')
    setSaving(false)
    if (!id) { alert('Could not submit the request. Please try again.'); return }

    alert('Payment request submitted!')
    resetModal()
    load()
  }

  // ── eSewa instant pay ─────────────────────────────────────────────────────
  // Prepares (row + signed field set) so the step-2 <form> can be submitted
  // natively. Runs when the student lands on the eSewa pay screen; the actual
  // navigation is a plain form submit, which mobile browsers don't block.
  async function prepareEsewa() {
    setEsewaErr('')
    setEsewaFields(null)
    try {
      const paymentId = await ensurePaymentRow('awaiting_payment')
      if (!paymentId) { setEsewaErr('Could not start the payment. Please try again.'); return }

      // Random suffix (no hyphen) guarantees a unique transaction_uuid every
      // time, even on rapid repeat clicks.
      const transactionUuid = `GP-${paymentId}-${Date.now()}${Math.floor(Math.random() * 100000)}`
      const amount = Number(form.amount) // eSewa's form fields use plain rupees, not paisa

      const sigRes = await fetch(`${SUPABASE_URL}/functions/v1/esewa-sign`, {
        method: 'POST',
        headers: await functionHeaders(),
        body: JSON.stringify({
          total_amount:     amount,
          transaction_uuid: transactionUuid,
          product_code:     MERCHANT_CODE,
        }),
      })

      const result = await sigRes.json()
      if (!result.signature) {
        setEsewaErr(result.error || 'Could not prepare the eSewa payment. Please try again.')
        return
      }

      setEsewaFields({
        amount:                  String(amount),
        tax_amount:              '0',
        total_amount:            String(amount),
        transaction_uuid:        transactionUuid,
        product_code:            MERCHANT_CODE,
        product_service_charge:  '0',
        product_delivery_charge: '0',
        success_url: `${window.location.origin}/payment/success`,
        failure_url: `${window.location.origin}/payment/failure`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: result.signature,
      })
    } catch (err) {
      setEsewaErr('eSewa error: ' + (err?.message || String(err)))
    }
  }

  // ── Khalti instant pay ────────────────────────────────────────────────────
  // Every failure path shows an on-screen message (mobile browsers swallow
  // alert() fast, and a silent return just looks like a dead button).
  async function payWithKhaltiNow() {
    setKhaltiErr('')
    setKhaltiBusy(true)
    try {
      const paymentId = await ensurePaymentRow('awaiting_payment')
      if (!paymentId) {
        setKhaltiErr('Could not start the payment. Please try again.')
        setKhaltiBusy(false)
        return
      }

      const amountRupees = Number(form.amount)
      // Khalti's API works in paisa (1 Rs = 100 paisa).
      const amountPaisa = Math.round(amountRupees * 100)
      const return_url  = `${window.location.origin}/payment/khalti-success`

      const res = await fetch(`${SUPABASE_URL}/functions/v1/khalti-initiate`, {
        method: 'POST',
        headers: await functionHeaders(),
        body: JSON.stringify({
          payment_id:   paymentId,
          amount:       amountPaisa,
          student_name: profile.name,
          return_url,
        }),
      })

      const result = await res.json().catch(() => ({}))

      if (!res.ok || !result.success || !result.payment_url) {
        const detail = result.error || result.message || result.detail || `HTTP ${res.status}`
        setKhaltiErr(`Khalti couldn't start: ${detail}`)
        setKhaltiBusy(false)
        return
      }

      window.location.assign(result.payment_url)
    } catch (err) {
      setKhaltiErr('Khalti error: ' + (err?.message || String(err)))
      setKhaltiBusy(false)
    }
  }

  async function submitReference() {
    if (!form.reference.trim()) return alert('Enter your transaction reference number')
    setSaving(true)
    const ref = form.reference.trim()

    // The student is manually claiming they paid — this needs staff verification,
    // so the row goes in as 'pending'. Create it now if the gateway buttons
    // didn't already (or promote an 'awaiting_payment' row that was).
    const id = await ensurePaymentRow('pending')
    if (!id) { setSaving(false); return }

    const { error } = await supabase
      .from('payments')
      .update({ reference: ref, status: 'pending' })
      .eq('id', id)
    setSaving(false)
    if (error) { alert('Could not submit reference: ' + error.message); return }
    alert('Reference submitted! Admin will verify and confirm your payment.')
    resetModal()
    load()
  }

  function resetModal() {
    setShowModal(false)
    setStep(1)
    setCreatedId(null)
    setQrLoadError(false)
    setEsewaFields(null)
    setEsewaErr('')
    setKhaltiBusy(false)
    setKhaltiErr('')
    setForm({ amount: '', type: TYPE_OPTIONS[0], method: 'Cash', note: '', reference: '' })
  }

  const totalPaid    = payments.filter(p => p.status === 'paid')
    .reduce((s, p) => s + (p.amount || 0), 0)
  const totalPending = payments.filter(p => p.status === 'pending').length

  const tableCols = '1.4fr 0.9fr 1.05fr 0.95fr 0.95fr 1.15fr 96px'

  return (
    <StudentLayout>
      <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

        {/* ── HEADER ── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          gap: isMobile ? 12 : 0,
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textStrong, margin: '0 0 4px' }}>
              My Payments
            </h1>
            <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
              View your payment history and request a new payment
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 18px', background: theme.primary,
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer',
              fontFamily: 'inherit',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            + Request Payment
          </button>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 10 : 14, marginBottom: 24,
        }}>
          {[
            { label: 'Total Payments', value: payments.length,                    bg: theme.status.info.bg,    Icon: Receipt,      iconColor: theme.status.info.text },
            { label: 'Amount Paid',    value: `Rs ${totalPaid.toLocaleString()}`,  bg: theme.status.success.bg, Icon: CheckCircle2, iconColor: theme.status.success.main },
            { label: 'Pending',        value: totalPending,                        bg: theme.status.warning.bg, Icon: Hourglass,    iconColor: theme.status.warning.text },
          ].map(c => (
            <div key={c.label} style={{
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: 10, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: c.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <c.Icon size={20} color={c.iconColor} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: theme.textStrong, lineHeight: 1 }}>
                  {c.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── PAYMENTS TABLE / CARDS ── */}
        <div style={{
          background: theme.white, border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          {!isMobile && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: tableCols,
              padding: '10px 18px',
              background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
            }}>
              {['Type', 'Amount', 'Method', 'Status', 'Date', 'Reference', 'Receipt'].map((h, hi) => (
                <span key={h || hi} style={{
                  fontSize: 11, fontWeight: 700, color: theme.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</span>
              ))}
            </div>
          )}

          {loading && (
            <p style={{ padding: 24, fontSize: 13, color: theme.textLight }}>Loading...</p>
          )}

          {!loading && payments.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>
              <CreditCard size={40} color={theme.inputBorder} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textLight, marginBottom: 6 }}>
                No payments yet
              </div>
              <div style={{ fontSize: 13 }}>
                Click <strong>+ Request Payment</strong> to get started
              </div>
            </div>
          )}

          {payments.map((p, i) => (
            isMobile ? (
              // ── Mobile card ──
              <div key={p.id} style={{
                padding: '14px 18px',
                borderBottom: i < payments.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.textStrong }}>
                    {p.type || p.note || '—'}
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                    fontSize: 11, fontWeight: 600,
                    background: statusStyle(p.status).bg,
                    color:      statusStyle(p.status).color,
                  }}>
                    {statusStyle(p.status).label}
                  </span>
                </div>

                <div style={{ fontSize: 18, fontWeight: 700, color: theme.textStrong }}>
                  Rs {(p.amount || 0).toLocaleString()}
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMid, flexWrap: 'wrap' }}>
                  <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Method: </b>{p.method || '—'}</span>
                  <span style={{ color: theme.textLight }}>
                    {p.date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—')}
                  </span>
                </div>

                {(p.reference || p.pidx) && (
                  <div style={{ fontSize: 12, color: theme.textMuted }}>
                    Ref: {p.reference || p.pidx}
                  </div>
                )}

                {p.status === 'paid' && (
                  <button
                    onClick={() => openReceipt(p)}
                    style={{
                      alignSelf: 'flex-start', marginTop: 2,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', background: theme.primaryLight,
                      border: `1px solid ${theme.border}`, borderRadius: 8,
                      fontSize: 12, fontWeight: 600, color: theme.primary,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <Printer size={13} /> Print receipt
                  </button>
                )}
              </div>
            ) : (
              // ── Desktop row ──
              <div key={p.id} style={{
                display: 'grid',
                gridTemplateColumns: tableCols,
                padding: '14px 18px', alignItems: 'center',
                borderBottom: i < payments.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
              }}
                onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: theme.textStrong }}>
                  {p.type || p.note || '—'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textStrong }}>
                  Rs {(p.amount || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: theme.textMid }}>{p.method || '—'}</div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600, display: 'inline-block',
                  background: statusStyle(p.status).bg,
                  color:      statusStyle(p.status).color,
                }}>
                  {statusStyle(p.status).label}
                </span>
                <div style={{ fontSize: 12, color: theme.textLight }}>
                  {p.date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—')}
                </div>
                <div style={{
                  fontSize: 12, color: theme.textMuted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.reference || p.pidx || '—'}
                </div>
                <div>
                  {p.status === 'paid' && (
                    <button
                      onClick={() => openReceipt(p)}
                      title="Print receipt"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', background: theme.primaryLight,
                        border: `1px solid ${theme.border}`, borderRadius: 7,
                        fontSize: 12, fontWeight: 600, color: theme.primary,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Printer size={13} /> Print
                    </button>
                  )}
                </div>
              </div>
            )
          ))}
        </div>

        {/* ════════════════════════════════════════
            REQUEST PAYMENT MODAL
            ════════════════════════════════════════ */}
        {showModal && createPortal(
          <div
            onClick={resetModal}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 2000,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: theme.white, border: `1px solid ${theme.border}`,
                borderRadius: isMobile ? '14px 14px 0 0' : 14,
                padding: isMobile ? 20 : 28,
                width: isMobile ? '100%' : 440,
                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                fontFamily: "'Segoe UI', Arial, sans-serif",
                maxHeight: '90vh', overflowY: 'auto',
                boxSizing: 'border-box',
              }}
            >

              {/* ── STEP 1 ── */}
              {step === 1 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
                      Request a Payment
                    </h3>
                    <button onClick={resetModal} style={{
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: theme.textMuted,
                      display: 'flex', alignItems: 'center', padding: 0,
                    }}>
                      <X size={20} color={theme.textMuted} />
                    </button>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Payment Type *</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
                      {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Amount (Rs) *</label>
                    <input
                      type="number" min="1"
                      placeholder="e.g. 5000"
                      value={form.amount}
                      onChange={e => { set('amount', e.target.value); setEsewaFields(null); setEsewaErr(''); setKhaltiErr('') }}
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Payment Method *</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {METHOD_OPTIONS.map(m => {
                        const meta = METHOD_META[m]
                        const active = form.method === m
                        return (
                          <button
                            key={m}
                            onClick={() => set('method', m)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 7,
                              padding: '8px 16px', borderRadius: 8,
                              border: active ? `2px solid ${theme.primary}` : `2px solid ${theme.border}`,
                              background: active ? theme.primaryLight : theme.pageBg,
                              color: active ? theme.primary : theme.textMid,
                              fontWeight: active ? 700 : 400,
                              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <meta.Icon size={12} color={meta.color} fill={meta.color} />
                            {m}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={labelStyle}>Note (optional)</label>
                    <textarea
                      placeholder="Any additional details..."
                      value={form.note}
                      onChange={e => set('note', e.target.value)}
                      rows={2}
                      style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                    />
                  </div>

                  <div style={{
                    display: 'flex', gap: 10,
                    flexDirection: isMobile ? 'column-reverse' : 'row',
                    justifyContent: 'flex-end',
                  }}>
                    <button onClick={resetModal} style={{
                      padding: '9px 18px', background: theme.pageBg,
                      border: `1px solid ${theme.border}`, borderRadius: 8,
                      fontSize: 13, color: theme.textLight, cursor: 'pointer', fontFamily: 'inherit',
                      width: isMobile ? '100%' : 'auto',
                    }}>Cancel</button>
                    <button onClick={submitRequest} disabled={saving} style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 20px',
                      background: saving ? theme.textMuted : theme.primary,
                      border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: theme.white,
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      width: isMobile ? '100%' : 'auto',
                    }}>
                      {saving
                        ? 'Submitting…'
                        : DIGITAL_METHODS.includes(form.method)
                          ? <>Next <ArrowRight size={14} /></>
                          : 'Submit Request'}
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 2 ── */}
              {step === 2 && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: '0 0 6px' }}>
                      Pay via {form.method}
                    </h3>
                    <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
                      Send <strong style={{ color: theme.textStrong }}>Rs {Number(form.amount).toLocaleString()}</strong> to Global Pathway
                    </p>
                  </div>

                  {/* eSewa button — a real <form> POST so mobile browsers don't
                      block the redirect (a JS form.submit() after `await` gets
                      swallowed on iOS/Android). */}
                  {form.method === 'eSewa' && (
                    <>
                      <form method="POST" action={ESEWA_FORM_URL} style={{ margin: 0 }}>
                        {esewaFields && Object.entries(esewaFields).map(([k, v]) => (
                          <input key={k} type="hidden" name={k} value={v} readOnly />
                        ))}
                        {/* Ready → real submit button (native POST = mobile-safe).
                            Not ready → a plain button that (re)runs preparation,
                            so the flow never dead-ends on a disabled control. */}
                        <button
                          type={esewaFields ? 'submit' : 'button'}
                          onClick={esewaFields ? undefined : prepareEsewa}
                          style={{
                            width: '100%', padding: '12px 16px',
                            background: esewaFields ? '#60BB46' : (esewaErr ? theme.status.danger.main : theme.textMuted),
                            border: 'none', borderRadius: 10,
                            fontSize: 14, fontWeight: 700, color: theme.white,
                            cursor: 'pointer',
                            fontFamily: 'inherit', marginBottom: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          }}
                        >
                          <Zap size={16} fill={theme.white} />
                          {esewaFields ? 'Pay instantly with eSewa'
                            : esewaErr ? 'Try eSewa again'
                            : 'Preparing eSewa…'}
                        </button>
                      </form>
                      {esewaErr && (
                        <div style={{
                          background: theme.status.danger.bg, border: `1px solid ${theme.status.danger.border}`,
                          borderRadius: 8, padding: '8px 12px', marginBottom: 16, marginTop: -6,
                          fontSize: 12, color: theme.status.danger.text,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        }}>
                          <span>{esewaErr}</span>
                          <button onClick={prepareEsewa} style={{
                            background: 'none', border: 'none', color: theme.status.danger.text,
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
                          }}>Retry</button>
                        </div>
                      )}
                      <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginBottom: 16, marginTop: -8 }}>
                        — or scan the QR code and enter your reference below —
                      </div>
                    </>
                  )}

                  {/* Khalti button */}
                  {form.method === 'Khalti' && (
                    <>
                      <button
                        onClick={payWithKhaltiNow}
                        disabled={khaltiBusy}
                        style={{
                          width: '100%', padding: '12px 16px',
                          background: khaltiBusy ? theme.textMuted : '#5C2D91',
                          border: 'none', borderRadius: 10,
                          fontSize: 14, fontWeight: 700, color: theme.white,
                          cursor: khaltiBusy ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', marginBottom: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                      >
                        <Zap size={16} fill={theme.white} />
                        {khaltiBusy ? 'Opening Khalti…' : 'Pay instantly with Khalti'}
                      </button>
                      {khaltiErr && (
                        <div style={{
                          background: theme.status.danger.bg, border: `1px solid ${theme.status.danger.border}`,
                          borderRadius: 8, padding: '8px 12px', marginBottom: 16, marginTop: -6,
                          fontSize: 12, color: theme.status.danger.text,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        }}>
                          <span>{khaltiErr}</span>
                          <button onClick={payWithKhaltiNow} style={{
                            background: 'none', border: 'none', color: theme.status.danger.text,
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
                          }}>Retry</button>
                        </div>
                      )}
                      <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginBottom: 16, marginTop: -8 }}>
                        — or scan the QR code and enter your reference below —
                      </div>
                    </>
                  )}

                  {/* QR Code */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                    <div style={{
                      border: `3px solid ${theme.border}`, borderRadius: 12, padding: 12,
                      background: theme.white, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    }}>
                      {qrLoadError ? (
                        <div style={{
                          width: isMobile ? 150 : 180, height: isMobile ? 150 : 180, background: theme.surfaceAlt, borderRadius: 8,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                          <Camera size={32} color={theme.textMuted} />
                          <span style={{ fontSize: 11, color: theme.textLight, textAlign: 'center', padding: '0 12px' }}>
                            Add qr.png to your /public folder
                          </span>
                        </div>
                      ) : (
                        <img
                          src={form.method === 'eSewa' ? QR_SRC_ESEWA : QR_SRC}
                          alt={`${form.method} Payment QR Code`}
                          onError={() => setQrLoadError(true)}
                          style={{ width: isMobile ? 150 : 180, height: isMobile ? 150 : 180, objectFit: 'contain', display: 'block' }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div style={{
                    background: theme.pageBg, border: `1px solid ${theme.border}`,
                    borderRadius: 8, padding: '10px 14px', marginBottom: 18,
                    fontSize: 12, color: theme.textMid,
                  }}>
                    {form.method === 'eSewa' && <>Open eSewa app → Scan QR → Pay → Copy the <em>transaction ID</em> below</>}
                    {form.method === 'Khalti' && <>Open Khalti app → Scan QR → Pay → Copy the <em>transaction ID</em> below</>}
                  </div>

                  {/* Reference input */}
                  <div style={{ marginBottom: 22 }}>
                    <label style={labelStyle}>Transaction Reference Number *</label>
                    <input
                      placeholder="e.g. TXN123456789"
                      value={form.reference}
                      onChange={e => set('reference', e.target.value)}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 5 }}>
                      Find this in your {form.method} app after payment
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', gap: 10,
                    flexDirection: isMobile ? 'column-reverse' : 'row',
                    justifyContent: 'flex-end',
                  }}>
                    <button onClick={() => { setStep(1); setEsewaFields(null); setEsewaErr(''); setKhaltiErr(''); setKhaltiBusy(false) }} style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 18px', background: theme.pageBg,
                      border: `1px solid ${theme.border}`, borderRadius: 8,
                      fontSize: 13, color: theme.textLight, cursor: 'pointer', fontFamily: 'inherit',
                      width: isMobile ? '100%' : 'auto',
                    }}><ArrowLeft size={14} /> Back</button>
                    <button onClick={submitReference} disabled={saving} style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 20px',
                      background: saving ? theme.textMuted : theme.primary,
                      border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: theme.white,
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      width: isMobile ? '100%' : 'auto',
                    }}>
                      {saving ? 'Submitting…' : <>Submit Reference <Check size={14} /></>}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>,
          document.body
        )}

      </div>
    </StudentLayout>
  )
}