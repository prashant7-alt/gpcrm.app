import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import theme from '../../theme'

// admin sees everything
const adminMenu = [
  {
    section: 'Overview',
    links: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    section: 'Pipeline',
    links: [
      { to: '/applications', label: 'Applications' },
      { to: '/students',     label: 'Students'     },
      { to: '/visitors',     label: 'Visitors'     },
    ],
  },
  {
    section: 'Operations',
    links: [
      { to: '/appointments', label: 'Appointments' },
      { to: '/tasks',        label: 'Tasks'        },
    ],
  },
  {
    section: 'Finance',
    links: [
      { to: '/payments', label: 'Payments' },
      { to: '/reports',  label: 'Reports'  },
    ],
  },
  {
    section: 'Team',
    links: [
      { to: '/staff',     label: 'Staff'     },
      { to: '/documents', label: 'Documents' },
    ],
  },
  {
    section: 'System',
    links: [
      { to: '/settings', label: 'Settings' },
    ],
  },
]

// staff sees limited — no Staff, Reports, Settings
const staffMenu = [
  {
    section: 'Overview',
    links: [{ to: '/dashboard', label: 'Dashboard' }],
  },
  {
    section: 'Pipeline',
    links: [
      { to: '/applications', label: 'Applications' },
      { to: '/students',     label: 'Students'     },
      { to: '/visitors',     label: 'Visitors'     },
    ],
  },
  {
    section: 'Operations',
    links: [
      { to: '/appointments', label: 'Appointments' },
      { to: '/tasks',        label: 'Tasks'        },
    ],
  },
  {
    section: 'Finance',
    links: [
      { to: '/payments', label: 'Payments' },
    ],
  },
  {
    section: 'Documents',
    links: [
      { to: '/documents', label: 'Documents' },
    ],
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')
  const isAdmin  = profile.role === 'admin'
  const menu     = isAdmin ? adminMenu : staffMenu

  async function logout() {
    await supabase.auth.signOut()
    localStorage.clear()
    navigate('/login')
  }

  return (
    <aside style={{
      width: 230,
      height: '100vh',
      background: theme.sidebarBg,
      borderRight: `1px solid ${theme.border}`,
      position: 'fixed',
      top: 0, left: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 100,
    }}>

      {/* logo */}
      <div style={{
        padding: '18px 16px',
        borderBottom: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <img
          src="/src/assets/images/logo.png"
          alt="Global Pathway Logo"
          style={{
            width: 44, height: 44,
            borderRadius: 12, objectFit: 'contain', flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.textDark }}>
            Global Pathway
          </div>
          <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>
            {isAdmin ? 'Admin Panel' : 'Staff Panel'}
          </div>
        </div>
      </div>

      {/* nav links */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '7px 10px' }}>
        {menu.map(group => (
          <div key={group.section}>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: theme.textLight,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '10px 8px 4px',
            }}>
              {group.section}
            </div>

            {group.links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '9px 10px',
                  borderRadius: 23,
                  textDecoration: 'none',
                  fontSize: 13.5,
                  marginBottom: 1,
                  transition: 'all 0.12s',
                  color: isActive ? theme.primaryText : theme.textMid,
                  background: isActive ? theme.primaryLight : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* user at bottom */}
      <div style={{
        padding: '12px 14px',
        borderTop: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: '50%',
          background: isAdmin ? theme.primary : '#7c3aed',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {profile.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: theme.textDark,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {profile.name || 'User'}
          </div>
          <div style={{ fontSize: 11, color: theme.textLight }}>
            {isAdmin ? 'Administrator' : 'Staff Member'}
          </div>
        </div>

        <button
          onClick={logout}
          title="Logout"
          style={{
            background: 'none',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11, fontWeight: 600,
            color: '#dc2626', cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>

    </aside>
  )
}