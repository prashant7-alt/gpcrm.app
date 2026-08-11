import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

export default function KhaltiSuccess() {
  const [searchParams] = useSearchParams()
  const [status,      setStatus]      = useState('verifying')
  const [paymentInfo, setPaymentInfo] = useState(null)
  const [simulating,  setSimulating]  = useState(false)

  const pidx       = searchParams.get('pidx')
  const payment_id = searchParams.get('purchase_order_id')

  useEffect(() => {
    if (pidx) { verify() }
    else      { setStatus('no_pidx') }
  }, [])

  async function verify() {
    setStatus('verifying')
    try {
      const res    = await fetch(`${SUPABASE_URL}/functions/v1/khalti-verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pidx, payment_id }),
      })
      const result = await res.json()
      console.log('[Khalti] verify result:', result)

      if (result.completed) {
        setPaymentInfo({ amount: result.amount, pidx })
        setStatus('success')
      } else {
        setPaymentInfo({ pidx, payment_id, khaltiStatus: result.status })
        setStatus('pending')
      }
    } catch (err) {
      console.error('[Khalti] verify error:', err)
      setPaymentInfo({ pidx, payment_id })
      setStatus('pending')
    }
  }

  async function simulateSuccess() {
    const pid = payment_id || JSON.parse(localStorage.getItem('pending_khalti_txn') || '{}').payment_id
    if (!pid) {
      alert('No payment ID found. Go back to payments and try again.')
      return
    }
    setSimulating(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/khalti-verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          pidx:       pidx || `SIM-${Date.now()}`,
          payment_id: pid,
          simulate:   true,   // ← tells edge function to skip Khalti API and just mark paid
        }),
      })
      const result = await res.json()
      if (result.completed || result.simulated) {
        localStorage.removeItem('pending_khalti_txn')
        setStatus('success')
      } else {
        alert('Simulation failed: ' + JSON.stringify(result))
      }
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setSimulating(false)
  }

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

        {/* Verifying */}
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Verifying payment...
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              Confirming your Khalti payment, please wait.
            </p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
              Payment Successful!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>
              Your Khalti payment has been confirmed and recorded.
            </p>
            {paymentInfo?.amount && (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '12px 16px', margin: '16px 0', textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Amount paid</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>
                  Rs {(paymentInfo.amount / 100).toLocaleString()}
                </div>
              </div>
            )}
            {/* ✅ window.location.href avoids ProtectedRoute auth flash */}
            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                width: '100%', padding: '12px 0', marginTop: 8,
                background: '#5C2D91', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
              }}
            >
              View My Payments →
            </button>
          </>
        )}

        {/* Pending — sandbox locked */}
        {status === 'pending' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
              Payment Pending
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              Khalti returned but payment isn't confirmed yet.
              This is normal in sandbox — use the simulate button below to test.
            </p>

            {paymentInfo && (
              <div style={{
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Reference</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', wordBreak: 'break-all' }}>
                  {paymentInfo.pidx || 'N/A'}
                </div>
                {paymentInfo.khaltiStatus && (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                    Khalti status: {paymentInfo.khaltiStatus}
                  </div>
                )}
              </div>
            )}

            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'left',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                🧪 Sandbox Test Mode
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginBottom: 12, lineHeight: 1.6 }}>
                Real Khalti payments auto-confirm. In sandbox,
                use this button to simulate confirmation for testing.
              </div>
              <button
                onClick={simulateSuccess}
                disabled={simulating}
                style={{
                  width: '100%', padding: '10px 0',
                  background: simulating ? '#9ca3af' : '#d97706',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: simulating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {simulating ? 'Processing...' : '⚡ Simulate Successful Payment'}
              </button>
            </div>

            <button
              onClick={() => { window.location.href = '/student/payments' }}
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

        {/* No pidx */}
        {status === 'no_pidx' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
              No payment reference
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              This page should only be reached after a Khalti payment.
            </p>
            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                padding: '10px 24px', background: '#111827',
                border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, cursor: 'pointer',
              }}
            >
              Go to Payments
            </button>
          </>
        )}

      </div>
    </div>
  )
}