import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase, functionHeaders } from '../../supabase'
import StudentLayout from './StudentLayout'
import theme from '../../theme'
import { statusChip } from '../../lib/statusColors'
import { openReceipt } from '../../lib/receipt'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus'
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

const SUPABASE_URL  = 'https://txwpmjtixdbebnbqorju.supabase.co'
const MERCHANT_CODE = 'EPAYTEST'

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

  useEffect(() => {
    if (!profile.id) { navigate('/student-login'); return }
    load()
  }, [])
  useRefetchOnFocus(load)

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

  async function submitRequest() {
    if (!form.amount || Number(form.amount) <= 0)
      return alert('Enter a valid amount')
    setSaving(true)

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
        status:        'pending',
        date:          new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    setSaving(false)
    if (error) return alert('Error: ' + error.message)

    setCreatedId(data.id)

    if (DIGITAL_METHODS.includes(form.method)) {
      setQrLoadError(false)
      setStep(2)
    } else {
      alert('Payment request submitted!')
      resetModal()
      load()
    }
  }

  // ── eSewa instant pay ─────────────────────────────────────────────────────
  async function payWithEsewaNow() {
    try {
      if (!createdId) { alert('Payment record not found.'); return }

      // Random suffix (no hyphen) guarantees a unique transaction_uuid every
      // time, even on rapid repeat clicks.
      const transactionUuid = `GP-${createdId}-${Date.now()}${Math.floor(Math.random() * 100000)}`
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
      const { signature } = result
      if (!signature) { alert('Failed to generate payment signature.'); return }

      const esewaForm = document.createElement('form')
      esewaForm.method = 'POST'
      esewaForm.action = 'https://rc-epay.esewa.com.np/api/epay/main/v2/form'

      const fields = {
        amount,
        tax_amount:              0,
        total_amount:            amount,
        transaction_uuid:        transactionUuid,
        product_code:            MERCHANT_CODE,
        product_service_charge:  0,
        product_delivery_charge: 0,
        success_url: `${window.location.origin}/payment/success`,
        failure_url: `${window.location.origin}/payment/failure`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature,
      }

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type  = 'hidden'
        input.name  = key
        input.value = String(value)
        esewaForm.appendChild(input)
      })

      document.body.appendChild(esewaForm)
      esewaForm.submit()

    } catch (err) {
      alert('eSewa error: ' + err.message)
    }
  }

  // ── Khalti instant pay ────────────────────────────────────────────────────
  async function payWithKhaltiNow() {
    try {
      if (!createdId) { alert('Payment record not found.'); return }

      const amountRupees = Number(form.amount)
      // ✅ FIXED: Khalti's API works in paisa (1 Rs = 100 paisa). The edge
      // function was rejecting small rupee amounts as "too small" because
      // it was receiving raw rupees and validating them as if they were
      // already paisa (e.g. Rs 600 arrived as "600 paisa" = Rs 6, which
      // failed Khalti's Rs 10 minimum). Convert before sending.
      const amountPaisa = Math.round(amountRupees * 100)
      const return_url  = `${window.location.origin}/payment/khalti-success`

      const res = await fetch(`${SUPABASE_URL}/functions/v1/khalti-initiate`, {
        method: 'POST',
        headers: await functionHeaders(),
        body: JSON.stringify({
          payment_id:   createdId,
          amount:       amountPaisa,
          student_name: profile.name,
          return_url,
        }),
      })

      const result = await res.json()

      if (!result.success || !result.payment_url) {
        // Surface the real reason when the edge function provides one,
        // instead of only the generic fallback message.
        const detail = result.error || result.message || result.detail
        alert(detail ? `Khalti initiation failed: ${detail}` : 'Khalti initiation failed. Please try again.')
        return
      }

      window.location.href = result.payment_url

    } catch (err) {
      alert('Khalti error: ' + err.message)
    }
  }

  async function submitReference() {
    if (!form.reference.trim()) return alert('Enter your transaction reference number')
    setSaving(true)
    const ref = form.reference.trim()
    const { error } = await supabase
      .from('payments')
      .update({ reference: ref })
      .eq('id', createdId)
    setSaving(false)
    if (error) { alert('Could not submit reference: ' + error.message); return }
    setPayments(prev => prev.map(p => (p.id === createdId ? { ...p, reference: ref } : p)))
    alert('Reference submitted! Admin will verify and confirm your payment.')
    resetModal()
  }

  function resetModal() {
    setShowModal(false)
    setStep(1)
    setCreatedId(null)
    setQrLoadError(false)
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
                      onChange={e => set('amount', e.target.value)}
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

                  {/* eSewa button */}
                  {form.method === 'eSewa' && (
                    <>
                      <button onClick={payWithEsewaNow} style={{
                        width: '100%', padding: '12px 16px',
                        background: '#60BB46', border: 'none', borderRadius: 10,
                        fontSize: 14, fontWeight: 700, color: theme.white,
                        cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                        <Zap size={16} fill={theme.white} /> Pay instantly with eSewa
                      </button>
                      <div style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, marginBottom: 16, marginTop: -8 }}>
                        — or scan the QR code and enter your reference below —
                      </div>
                    </>
                  )}

                  {/* Khalti button */}
                  {form.method === 'Khalti' && (
                    <>
                      <button onClick={payWithKhaltiNow} style={{
                        width: '100%', padding: '12px 16px',
                        background: '#5C2D91', border: 'none', borderRadius: 10,
                        fontSize: 14, fontWeight: 700, color: theme.white,
                        cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}>
                        <Zap size={16} fill={theme.white} /> Pay instantly with Khalti
                      </button>
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
                    <button onClick={() => setStep(1)} style={{
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