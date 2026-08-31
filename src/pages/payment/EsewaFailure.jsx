import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import theme from '../../theme'

export default function EsewaFailure() {
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.removeItem('pending_esewa_txn')
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: theme.pageBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{
        background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 16,
        padding: 48, textAlign: 'center', maxWidth: 420, width: '100%',
      }}>
        <Clock size={44} style={{ color: theme.status.warning.main, marginBottom: 16 }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: theme.status.warning.text }}>
          Payment awaiting confirmation
        </h2>
        <p style={{ fontSize: 14, color: theme.textLight, marginTop: 8 }}>
          Your eSewa payment has been recorded. Your counselor will confirm it shortly.
        </p>
        <button
          onClick={() => navigate('/student/payments')}
          style={{
            marginTop: 20, padding: '10px 24px',
            background: theme.navy, border: 'none', borderRadius: 8,
            color: theme.white, fontSize: 14, cursor: 'pointer',
          }}
        >
          View my payments
        </button>
      </div>
    </div>
  )
}
