import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, RefreshCw, HelpCircle, FlaskConical, Zap } from 'lucide-react'
import { functionHeaders } from '../../supabase'
import theme from '../../theme'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

// The "simulate payment" helper bypasses the real gateway. It must NEVER be
// reachable in a production build — only show it during local development.
const ALLOW_SIMULATE = import.meta.env.DEV

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
        headers: await functionHeaders(),
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
    if (!ALLOW_SIMULATE) return
    const pid = payment_id || JSON.parse(localStorage.getItem('pending_khalti_txn') || '{}').payment_id
    if (!pid) {
      alert('No payment ID found. Go back to payments and try again.')
      return
    }
    setSimulating(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/khalti-verify`, {
        method:  'POST',
        headers: await functionHeaders(),
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
      minHeight: '100vh', background: theme.pageBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif", padding: 20,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        background: theme.cardBg, border: `1px solid ${theme.border}`,
        borderRadius: 16, padding: 48, textAlign: 'center',
        maxWidth: 440, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>

        {/* Verifying */}
        {status === 'verifying' && (
          <>
            <Loader2 size={44} style={{ color: theme.primary, marginBottom: 16, animation: 'spin 0.9s linear infinite' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, marginBottom: 8 }}>
              Verifying payment...
            </h2>
            <p style={{ fontSize: 14, color: theme.textLight }}>
              Confirming your Khalti payment, please wait.
            </p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <CheckCircle2 size={54} style={{ color: theme.status.success.main, marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.status.success.text, marginBottom: 8 }}>
              Payment Successful!
            </h2>
            <p style={{ fontSize: 14, color: theme.textLight, marginBottom: 6 }}>
              Your Khalti payment has been confirmed and recorded.
            </p>
            {paymentInfo?.amount && (
              <div style={{
                background: theme.status.success.bg, border: `1px solid ${theme.status.success.border}`,
                borderRadius: 10, padding: '12px 16px', margin: '16px 0', textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 4 }}>Amount paid</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: theme.status.success.text }}>
                  Rs {(paymentInfo.amount / 100).toLocaleString()}
                </div>
              </div>
            )}
            {/* ✅ window.location.href avoids ProtectedRoute auth flash */}
            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                width: '100%', padding: '12px 0', marginTop: 8,
                background: theme.status.success.main, border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: theme.white, cursor: 'pointer',
              }}
            >
              View My Payments →
            </button>
          </>
        )}

        {/* Pending — sandbox locked */}
        {status === 'pending' && (
          <>
            <RefreshCw size={44} style={{ color: theme.status.warning.main, marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.status.warning.text, marginBottom: 8 }}>
              Payment Pending
            </h2>
            <p style={{ fontSize: 14, color: theme.textLight, marginBottom: 20 }}>
              Khalti returned but payment isn't confirmed yet.
              This is normal in sandbox — use the simulate button below to test.
            </p>

            {paymentInfo && (
              <div style={{
                background: theme.pageBg, border: `1px solid ${theme.border}`,
                borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 4 }}>Reference</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDark, wordBreak: 'break-all' }}>
                  {paymentInfo.pidx || 'N/A'}
                </div>
                {paymentInfo.khaltiStatus && (
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                    Khalti status: {paymentInfo.khaltiStatus}
                  </div>
                )}
              </div>
            )}

            {ALLOW_SIMULATE && (
              <div style={{
                background: theme.status.warning.bg, border: `1px solid ${theme.status.warning.border}`,
                borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.status.warning.text, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <FlaskConical size={13} /> Sandbox Test Mode (dev build only)
                </div>
                <div style={{ fontSize: 12, color: theme.status.warning.text, marginBottom: 12, lineHeight: 1.6 }}>
                  Real Khalti payments auto-confirm. In sandbox,
                  use this button to simulate confirmation for testing.
                </div>
                <button
                  onClick={simulateSuccess}
                  disabled={simulating}
                  style={{
                    width: '100%', padding: '10px 0',
                    background: simulating ? theme.textMuted : theme.status.warning.main,
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 700, color: theme.white,
                    cursor: simulating ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {simulating ? 'Processing...' : <><Zap size={14} /> Simulate Successful Payment</>}
                </button>
              </div>
            )}

            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                width: '100%', padding: '10px 0',
                background: theme.pageBg, border: `1px solid ${theme.border}`,
                borderRadius: 8, fontSize: 13, color: theme.textLight,
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
            <HelpCircle size={44} style={{ color: theme.textMuted, marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.textMid, marginBottom: 8 }}>
              No payment reference
            </h2>
            <p style={{ fontSize: 14, color: theme.textLight, marginBottom: 20 }}>
              This page should only be reached after a Khalti payment.
            </p>
            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                padding: '10px 24px', background: theme.navy,
                border: 'none', borderRadius: 8,
                color: theme.white, fontSize: 14, cursor: 'pointer',
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