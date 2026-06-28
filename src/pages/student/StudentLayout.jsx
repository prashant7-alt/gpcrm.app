import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'

const SIDEBAR_BG      = '#950b0b2a'
const SIDEBAR_BORDER  = '#e5e7eb'
const ACTIVE_BG       = '#dcfce7'
const ACTIVE_TEXT     = '#15803d'
const INACTIVE_TEXT   = '#374151'

const navLinks = [
  { to: '/student/dashboard',    label: 'Dashboard'       },
  { to: '/student/appointments', label: 'Appointments'    },
  { to: '/student/profile',      label: 'My Profile'      },
  { to: '/student/visa-status',  label: 'Visa Status'     },
  { to: '/student/documents',    label: 'Documents'       },
  { to: '/student/payments',     label: 'Payments'        },
  { to: '/student/chat',         label: 'Chat with Staff' }, // ← NEW
]

export default function StudentLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/login')
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 230,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        position: 'fixed',
        top: 0, left: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 0',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 16px',
          borderBottom: '1px solid #111722',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img
            src="/src/assets/images/logo.png"
            alt="Global Pathway"
            style={{ width: 70, height: 50, borderRadius: 10, objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>Student Portal</div>
          </div>
        </div>

        {/* Nav Links */}
        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {navLinks.map(link => {
            const isActive = location.pathname === link.to
            return (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', borderRadius: 10,
                  border: 'none', textAlign: 'left',
                  fontSize: 16, marginBottom: 32,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: isActive ? ACTIVE_BG   : 'transparent',
                  color:      isActive ? ACTIVE_TEXT : INACTIVE_TEXT,
                  fontWeight: isActive ? 600          : 400,
                }}
              >
                <span style={{ fontSize: 18 }}>{link.icon}</span>
                {link.label}
              </button>
            )
          })}
        </div>

        {/* User + Logout */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#111827',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profile.name || 'Student'}
              </div>
              <div style={{
                fontSize: 11, color: '#6b7280',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profile.email || ''}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '7px 0',
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, marginLeft: 230, padding: 28 }}>
        {children}
      </main>
    </div>
  )
}