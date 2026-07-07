import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabase'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

export default function KhaltiSuccess() {
  const [searchParams] = useSearchParams()
  const [status,       setStatus]      = useState('verifying')
  const [paymentInfo,  setPaymentInfo] = useState(null)
  const [simulating,   setSimulating]  = useState(false)
  const navigate = useNavigate()

  // pidx and purchase_order_id come from Khalti redirect URL
  const pidx       = searchParams.get('pidx')
  const payment_id = searchParams.get('purchase_order_id')
  const txnId      = searchParams.get('transaction_id')

  useEffect(() => {
    // If Khalti redirected here with a pidx, try real verification first
    if (pidx) {
      verify()
    } else {
      // No pidx — came here directly (shouldn't happen in normal flow)
      setStatus('no_pidx')
    }
  }, [])

  // ── REAL VERIFY: calls khalti-verify Edge Function ────────
  async function verify() {
    setStatus('verifying')
    try {
      const res    = await fetch(`${SUPABASE_URL}/functions/v1/khalti-verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pidx }),
      })
      const result = await res.json()

      if (result.completed) {
        // Real payment confirmed — mark as paid
        await markPaid({
          txn_ref: pidx,
          amount:  result.amount,
        })
        setStatus('success')
        setTimeout(() => navigate('/student/payments'), 3000)
      } else {
        // Khalti returned but payment not completed
        // (sandbox locked / pending) — show simulate option
        setPaymentInfo({ pidx, payment_id, status: result.status })
        setStatus('pending')
      }
    } catch (err) {
      console.error('Verify error:', err)
      setPaymentInfo({ pidx, payment_id })
      setStatus('pending')
    }
  }

  // ── SIMULATE: marks payment as paid without real Khalti confirm ──
  // Used for sandbox testing when test accounts are locked
  async function simulateSuccess() {
    if (!payment_id) {
      alert('No payment ID found. Go back to payments and try again.')
      return
    }
    setSimulating(true)
    try {
      await markPaid({
        txn_ref: pidx || `SIM-${Date.now()}`,
        amount:  null, // amount already in payments table
      })
      setStatus('success')
      setTimeout(() => navigate('/student/payments'), 3000)
    } catch (err) {
      alert('Simulation failed: ' + err.message)
    }
    setSimulating(false)
  }

  // ── MARK PAID in Supabase payments table ──────────────────
  async function markPaid({ txn_ref, amount }) {
    const updateData = {
      status:  'paid',
      method:  'Khalti',
      txn_ref: txn_ref,
      paid_at: new Date().toISOString(),
    }
    // Only update amount if we got it from real verification
    if (amount) updateData.amount = amount

    const { error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', payment_id)

    if (error) throw new Error(error.message)
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif", padding: 20,
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 16, padding: 48, textAlign: 'center',
        maxWidth: 440, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>

        {/* ── Verifying ── */}
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Verifying payment...
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              Please wait while we confirm your Khalti payment.
            </p>
          </>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
              Payment successful!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
              Your Khalti payment has been confirmed and recorded.
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>
              Redirecting to your payments page...
            </p>
          </>
        )}

        {/* ── Pending / Sandbox locked — show simulate option ── */}
        {status === 'pending' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
              Payment pending
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Khalti returned but payment is not yet confirmed.
              This happens when sandbox test accounts are locked.
            </p>

            {/* Payment info box */}
            {paymentInfo && (
              <div style={{
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  Payment reference
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827',
                  wordBreak: 'break-all' }}>
                  {paymentInfo.pidx || 'N/A'}
                </div>
                {paymentInfo.status && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                    Khalti status: {paymentInfo.status}
                  </div>
                )}
              </div>
            )}

            {/* Simulate button — for sandbox testing */}
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 10, padding: '14px 16px', marginBottom: 20,
              textAlign: 'left',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                🧪 Sandbox Test Mode
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12, lineHeight: 1.5 }}>
                Since sandbox accounts are locked, you can simulate
                a successful payment to test the admin side receiving it.
                This button is for testing only — in production,
                real Khalti payments auto-confirm.
              </div>
              <button
                onClick={simulateSuccess}
                disabled={simulating || !payment_id}
                style={{
                  width: '100%', padding: '10px 0',
                  background: simulating ? '#9ca3af' : '#d97706',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: simulating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {simulating ? 'Simulating...' : '⚡ Simulate Successful Payment'}
              </button>
              {!payment_id && (
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 6 }}>
                  ⚠️ No payment ID in URL — go back and try again from the student payments page
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/student/payments')}
              style={{
                width: '100%', padding: '10px 0',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, color: '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Back to Payments
            </button>
          </>
        )}

        {/* ── No pidx — came here directly ── */}
        {status === 'no_pidx' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
              No payment reference found
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              This page should be reached after completing a Khalti payment.
            </p>
            <button
              onClick={() => navigate('/student/payments')}
              style={{
                padding: '10px 24px',
                background: '#111827', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, cursor: 'pointer',
              }}
            >
              Go to Payments
            </button>
          </>
        )}

        {/* ── Failed ── */}
        {status === 'failed' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>
              Payment verification failed
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Contact your counsellor with your Khalti transaction ID.
            </p>
            <button
              onClick={() => navigate('/student/payments')}
              style={{
                padding: '10px 24px',
                background: '#111827', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, cursor: 'pointer',
              }}
            >
              Go back
            </button>
          </>
        )}

      </div>
    </div>
  )
}