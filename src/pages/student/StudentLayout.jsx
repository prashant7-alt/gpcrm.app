import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'

const navLinks = [
  { to: '/student/dashboard',    label: 'Dashboard',    icon: '🏠' },
  { to: '/student/profile',      label: 'My Profile',   icon: '👤' },
  { to: '/student/appointments', label: 'Appointments', icon: '📅' },
  { to: '/student/payments',     label: 'Payments',     icon: '💳' },
  { to: '/student/documents',    label: 'Documents',    icon: '📁' },
  { to: '/student/pipeline',     label: 'Visa Status',  icon: '🌐' },
  { to: '/student/chat',         label: 'Chat Officer', icon: '💬' },
]

export default function StudentLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'S'

  async function logout() {
    await supabase.auth.signOut()
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>

      {/* ── sidebar ── */}
      <aside style={{
        width: 230,
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
      }}>

        {/* logo */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}>
            🌐
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              Global Pathway
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              Student Portal
            </div>
          </div>
        </div>

        {/* nav links */}
        <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          {navLinks.map(link => {
            const active = location.pathname === link.to
            return (
              <div
                key={link.to}
                onClick={() => navigate(link.to)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 10px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  marginBottom: 2,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#15803d' : '#374151',
                  background: active ? '#dcfce7' : 'transparent',
                }}
              >
                <span style={{ fontSize: 15 }}>{link.icon}</span>
                {link.label}
              </div>
            )
          })}
        </div>

        {/* user at bottom */}
        <div style={{
          padding: '12px 14px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#111827',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {profile.name || 'Student'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Student</div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 16,
              cursor: 'pointer',
              color: '#9ca3af',
            }}
          >
            🚪
          </button>
        </div>

      </aside>

      {/* ── page content ── */}
      <main style={{
        flex: 1,
        marginLeft: 230,
        padding: 26,
      }}>
        {children}
      </main>

    </div>
  )
}