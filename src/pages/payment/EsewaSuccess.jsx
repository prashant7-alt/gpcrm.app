import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

export default function EsewaSuccess() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const navigate = useNavigate()

  useEffect(() => {
    verify()
  }, [])

  async function verify() {
    try {
      const encodedData = searchParams.get('data')
      if (!encodedData) {
        setStatus('failed')
        return
      }

      const decoded   = atob(encodedData)
      const esewaData = JSON.parse(decoded)
      const uuid       = esewaData.transaction_uuid || ''

      const withoutPrefix = uuid.startsWith('GP-') ? uuid.slice(3) : uuid
      const lastHyphen    = withoutPrefix.lastIndexOf('-')
      const paymentId     = lastHyphen !== -1 ? withoutPrefix.slice(0, lastHyphen) : null

      if (!paymentId) {
        setStatus('failed')
        return
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-esewa-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_uuid: esewaData.transaction_uuid,
          total_amount:     esewaData.total_amount,
          payment_id:       paymentId,
        }),
      })

      const result = await res.json()

      if (result.success) {
        localStorage.removeItem('pending_esewa_txn')   // ← clears the backup tracking once confirmed
        setStatus('success')
        setTimeout(() => navigate('/student/payments'), 3000)
      } else {
        setStatus('failed')
      }
    } catch (err) {
      console.error(err)
      setStatus('failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
        padding: 48, textAlign: 'center', maxWidth: 400, width: '100%',
      }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
              Verifying payment...
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
              Please wait while we confirm your payment with eSewa.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>
              Payment successful!
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
              Your payment has been confirmed. Redirecting to your payments page...
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#b91c1c' }}>
              Payment verification failed
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
              Something went wrong. Please contact your counselor with your eSewa transaction ID.
            </p>
            <button
              onClick={() => navigate('/student/payments')}
              style={{
                marginTop: 20, padding: '10px 24px',
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