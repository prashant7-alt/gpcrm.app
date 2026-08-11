import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

// ✅ NO useNavigate to /student/payments — that requires auth
// Instead we show a button so the student manually goes back after logging in

export default function EsewaSuccess() {
  const [searchParams] = useSearchParams()
  const [status,  setStatus]  = useState('verifying')
  const [details, setDetails] = useState(null)

  useEffect(() => { verify() }, [])

  async function verify() {
    try {
      const encodedData = searchParams.get('data')
      if (!encodedData) { setStatus('failed'); return }

      // eSewa sends base64-encoded JSON
      const decoded   = atob(encodedData)
      const esewaData = JSON.parse(decoded)

      console.log('[eSewa] decoded data:', esewaData)

      const uuid = esewaData.transaction_uuid || ''

      // Our uuid format is: GP-{paymentId}-{timestamp}
      // e.g. GP-123-1718000000000
      const withoutPrefix = uuid.startsWith('GP-') ? uuid.slice(3) : uuid
      const lastHyphen    = withoutPrefix.lastIndexOf('-')
      const paymentId     = lastHyphen !== -1 ? withoutPrefix.slice(0, lastHyphen) : null

      console.log('[eSewa] paymentId extracted:', paymentId)

      if (!paymentId) { setStatus('failed'); return }

      // Call edge function — it uses service role key so no auth needed
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-esewa-payment`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_uuid: esewaData.transaction_uuid,
          total_amount:     esewaData.total_amount,
          payment_id:       paymentId,
        }),
      })

      const result = await res.json()
      console.log('[eSewa] verify result:', result)

      if (result.success) {
        localStorage.removeItem('pending_esewa_txn')
        setDetails({ amount: esewaData.total_amount, ref: esewaData.transaction_uuid })
        setStatus('success')
      } else {
        console.error('[eSewa] verify failed:', result)
        setStatus('failed')
      }
    } catch (err) {
      console.error('[eSewa] error:', err)
      setStatus('failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif", padding: 20,
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
        padding: 48, textAlign: 'center', maxWidth: 420, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>

        {status === 'verifying' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Verifying payment...</h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
              Please wait while we confirm your eSewa payment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
              Payment Successful!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>
              Your eSewa payment has been confirmed and recorded.
            </p>
            {details && (
              <div style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '12px 16px', margin: '16px 0',
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Amount paid</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>
                  Rs {Number(details.amount).toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Transaction ID</div>
                <div style={{ fontSize: 12, color: '#374151', wordBreak: 'break-all' }}>{details.ref}</div>
              </div>
            )}
            {/* ✅ Use window.location.href instead of navigate — avoids auth flash redirect */}
            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                width: '100%', padding: '12px 0', marginTop: 8,
                background: '#16a34a', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
              }}
            >
              View My Payments →
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>
              Verification Failed
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
              We couldn't confirm your payment. Please contact your counsellor
              with your eSewa transaction ID.
            </p>
            <button
              onClick={() => { window.location.href = '/student/payments' }}
              style={{
                width: '100%', padding: '12px 0',
                background: '#111827', border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Go Back to Payments
            </button>
          </>
        )}

      </div>
    </div>
  )
}