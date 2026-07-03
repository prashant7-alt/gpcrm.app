import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

const QR_SRC = '/qr.png'

const SUPABASE_URL  = 'https://txwpmjtixdbebnbqorju.supabase.co'
const MERCHANT_CODE = 'EPAYTEST'

const METHOD_OPTIONS = ['SUPABASE FOR TEST', 'eSewa', 'Khalti', 'Bank Transfer']
const TYPE_OPTIONS   = [
  'SUPABASE FOR TEST Fee', 'Application Fee', 'Visa Fee',
  'Document Fee', 'College Fee', 'Other',
]
const QR_METHODS = ['eSewa', 'Khalti', 'Bank Transfer']

const statusStyle = (s) => {
  if (s === 'paid')     return { bg: '#dcfce7', color: '#15803d' }
  if (s === 'pending')  return { bg: '#fef9c3', color: '#a16207' }
  if (s === 'rejected') return { bg: '#fee2e2', color: '#b91c1c' }
  return                       { bg: '#f3f4f6', color: '#6b7280' }
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase', marginBottom: 5,
}

export default function StudentPayments() {
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
    if (!profile.id) { navigate('/login'); return }
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_name', profile.name || '')
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

    if (QR_METHODS.includes(form.method)) {
      setQrLoadError(false)
      setStep(2)
    } else {
      alert('✅ Thank you for testing!')
      resetModal()
      load()
    }
  }

  async function submitReference() {
    if (!form.reference.trim()) return alert('Enter your transaction reference number')
    setSaving(true)
    await supabase
      .from('payments')
      .update({ reference: form.reference.trim() })
      .eq('id', createdId)
    setSaving(false)
    alert('✅ Reference submitted! Admin will verify and confirm your payment.')
    resetModal()
    load()
  }

  // ── real eSewa instant payment ──
  async function payWithEsewaNow() {
    try {
      if (!createdId) {
        alert('Payment record not found. Please try again.')
        return
      }

      const transactionUuid = `GP-${createdId}-${Date.now()}`
      const amount = Number(form.amount)

      const sigRes = await fetch(`${SUPABASE_URL}/functions/v1/esewa-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_amount:     amount,
          transaction_uuid: transactionUuid,
          product_code:     MERCHANT_CODE,
        }),
      })

      const result = await sigRes.json()
      const { signature } = result

      if (!signature) {
        alert('Failed to generate payment signature. Try again.')
        return
      }

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

      // ── save transaction info so we can verify status regardless of which page eSewa sends us to ──
      localStorage.setItem('pending_esewa_txn', JSON.stringify({
        transaction_uuid: transactionUuid,
        payment_id:       createdId,
        amount:           amount,
      }))

      document.body.appendChild(esewaForm)
      esewaForm.submit()

    } catch (err) {
      alert('eSewa payment error: ' + err.message)
    }
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

  return (
    <StudentLayout>
      <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

        {/* ── HEADER ──────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 24,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              My Payments
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              View your payment history and request a new payment
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 18px', background: '#16a34a',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Request Payment
          </button>
        </div>

        {/* ── STAT CARDS ───────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14, marginBottom: 24,
        }}>
          {[
            { label: 'Total Payments', value: payments.length,                   bg: '#eff6ff', icon: '🧾' },
            { label: 'Amount Paid',    value: `Rs ${totalPaid.toLocaleString()}`, bg: '#f0fdf4', icon: '✅' },
            { label: 'Pending',        value: totalPending,                       bg: '#fefce8', icon: '⏳' },
          ].map(c => (
            <div key={c.label} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 10, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: c.bg, fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                  {c.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── PAYMENTS TABLE ────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr 1fr 1.5fr',
            padding: '10px 18px',
            background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
          }}>
            {['Type', 'Amount', 'Method', 'Status', 'Date', 'Reference'].map(h => (
              <span key={h} style={{
                fontSize: 11, fontWeight: 600, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{h}</span>
            ))}
          </div>

          {loading && (
            <p style={{ padding: 24, fontSize: 13, color: '#6b7280' }}>Loading...</p>
          )}

          {!loading && payments.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💳</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                No payments yet
              </div>
              <div style={{ fontSize: 13 }}>
                Click <strong>+ Request Payment</strong> to get started
              </div>
            </div>
          )}

          {payments.map((p, i) => (
            <div key={p.id} style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1.5fr 1fr 1fr 1.5fr',
              padding: '14px 18px', alignItems: 'center',
              borderBottom: i < payments.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                {p.type || p.note || '—'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Rs {(p.amount || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 13, color: '#374151' }}>{p.method || '—'}</div>
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600, display: 'inline-block',
                background: statusStyle(p.status).bg,
                color:      statusStyle(p.status).color,
              }}>
                {p.status || 'pending'}
              </span>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {p.date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—')}
              </div>
              <div style={{
                fontSize: 12, color: '#9ca3af',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {p.reference || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* ════════════════════════════════════════════════
            REQUEST PAYMENT MODAL
            ════════════════════════════════════════════════ */}
        {showModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
          }}>
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 14, padding: 28, width: 440,
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              fontFamily: "'Segoe UI', Arial, sans-serif",
              maxHeight: '90vh', overflowY: 'auto',
            }}>

              {/* ── STEP 1: Payment details ─────────────── */}
              {step === 1 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                      Request a Payment
                    </h3>
                    <button onClick={resetModal} style={{
                      background: 'none', border: 'none', fontSize: 20,
                      cursor: 'pointer', color: '#9ca3af',
                    }}>✕</button>
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
                      {METHOD_OPTIONS.map(m => (
                        <button
                          key={m}
                          onClick={() => set('method', m)}
                          style={{
                            padding: '8px 16px', borderRadius: 8,
                            border: form.method === m ? '2px solid #16a34a' : '2px solid #e5e7eb',
                            background: form.method === m ? '#f0fdf4' : '#f9fafb',
                            color: form.method === m ? '#15803d' : '#374151',
                            fontWeight: form.method === m ? 700 : 400,
                            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {m === 'eSewa' ? '🟢 eSewa'
                            : m === 'Khalti' ? '🟣 Khalti'
                            : m === 'Bank Transfer' ? '🏦 Bank'
                            : '💵 Cash'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {QR_METHODS.includes(form.method) && (
                    <div style={{
                      background: '#eff6ff', border: '1px solid #bfdbfe',
                      borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                      fontSize: 12, color: '#1e40af',
                    }}>
                      📱 After submitting, you'll see options to pay via <strong>{form.method}</strong>.
                    </div>
                  )}

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

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={resetModal} style={{
                      padding: '9px 18px', background: '#f9fafb',
                      border: '1px solid #e5e7eb', borderRadius: 8,
                      fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                    }}>Cancel</button>
                    <button onClick={submitRequest} disabled={saving} style={{
                      padding: '9px 20px',
                      background: saving ? '#9ca3af' : '#16a34a',
                      border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: '#fff',
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    }}>
                      {saving ? 'Submitting…'
                        : QR_METHODS.includes(form.method) ? 'Next →'
                        : 'Submit Request'}
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 2: QR code + reference + real eSewa option ─────────── */}
              {step === 2 && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                      Pay via {form.method}
                    </h3>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                      Send <strong style={{ color: '#111827' }}>Rs {Number(form.amount).toLocaleString()}</strong> to Global Pathway Consultancy
                    </p>
                  </div>

                  {/* ── REAL eSewa instant pay button — only shows when method is eSewa ── */}
                  {form.method === 'eSewa' && (
                    <button
                      onClick={payWithEsewaNow}
                      style={{
                        width: '100%', padding: '12px 16px',
                        background: '#60BB46', border: 'none', borderRadius: 10,
                        fontSize: 14, fontWeight: 700, color: '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                        marginBottom: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      ⚡ Pay instantly with eSewa
                    </button>
                  )}

                  {form.method === 'eSewa' && (
                    <div style={{
                      textAlign: 'center', fontSize: 11, color: '#9ca3af',
                      marginBottom: 16, marginTop: -8,
                    }}>
                      — or scan the QR code and enter your reference manually below —
                    </div>
                  )}

                  {/* ── QR Code ── */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                    <div style={{
                      border: '3px solid #e5e7eb', borderRadius: 12, padding: 12,
                      background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    }}>
                      {qrLoadError ? (
                        <div style={{
                          width: 180, height: 180,
                          background: '#f3f4f6', borderRadius: 8,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          gap: 8,
                        }}>
                          <span style={{ fontSize: 36 }}>📷</span>
                          <span style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: '0 12px' }}>
                            QR code not found.<br />
                           img src <code style={{ fontSize: 10, color: '#374151' }}>{QR_SRC}</code> may be missing.<br />
                            Place your qr.png in the <code style={{ fontSize: 10, color: '#374151' }}>/public</code> folder.
                          </span>
                        </div>
                      ) : (
                        <img
                          src={QR_SRC}
                          alt="Payment QR Code"
                          onError={() => setQrLoadError(true)}
                          style={{ width: 180, height: 180, objectFit: 'contain', display: 'block' }}
                        />
                      )}
                    </div>
                  </div>

                  <div style={{
                    background: '#f9fafb', border: '1px solid #e5e7eb',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 18,
                    fontSize: 12, color: '#374151',
                  }}>
                    {form.method === 'eSewa' && (
                      <>
                        <strong>eSewa steps:</strong> Open eSewa app → Scan QR →
                        Enter Rs {Number(form.amount).toLocaleString()} → Pay →
                        Copy the <em>transaction ID</em> below
                      </>
                    )}
                    {form.method === 'Khalti' && (
                      <>
                        <strong>Khalti steps:</strong> Open Khalti app → Scan QR →
                        Enter Rs {Number(form.amount).toLocaleString()} → Pay →
                        Copy the <em>transaction ID</em> below
                      </>
                    )}
                    {form.method === 'Bank Transfer' && (
                      <>
                        <strong>Bank Transfer steps:</strong> Scan QR or use account details →
                        Transfer Rs {Number(form.amount).toLocaleString()} →
                        Copy the <em>transaction/voucher number</em> below
                      </>
                    )}
                  </div>

                  <div style={{ marginBottom: 22 }}>
                    <label style={labelStyle}>Transaction Reference Number *</label>
                    <input
                      placeholder="e.g. TXN123456789"
                      value={form.reference}
                      onChange={e => set('reference', e.target.value)}
                      style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
                      You can find this in your {form.method} app after payment
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setStep(1)} style={{
                      padding: '9px 18px', background: '#f9fafb',
                      border: '1px solid #e5e7eb', borderRadius: 8,
                      fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                    }}>← Back</button>
                    <button onClick={submitReference} disabled={saving} style={{
                      padding: '9px 20px',
                      background: saving ? '#9ca3af' : '#16a34a',
                      border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, color: '#fff',
                      cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    }}>
                      {saving ? 'Submitting…' : 'Submit Reference ✓'}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </StudentLayout>
  )
}