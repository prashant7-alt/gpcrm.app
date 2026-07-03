import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function EsewaFailure() {
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.removeItem('pending_esewa_txn')
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16,
        padding: 48, textAlign: 'center', maxWidth: 420, width: '100%',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15803d' }}>
          Payment submitted
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>
          Your eSewa payment has been recorded. Your counselor will confirm it shortly.
        </p>
        <button
          onClick={() => navigate('/student/payments')}
          style={{
            marginTop: 20, padding: '10px 24px',
            background: '#111827', border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 14, cursor: 'pointer',
          }}
        >
          View my payments
        </button>
      </div>
    </div>
  )
}