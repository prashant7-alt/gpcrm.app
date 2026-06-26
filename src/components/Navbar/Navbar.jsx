import { useRef, useEffect } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { supabase } from '../../supabase'
import theme from '../../theme'

// ─────────────────────────────────────────────────────────────
// MENU DEFINITIONS — admin sees everything, staff sees limited
// ─────────────────────────────────────────────────────────────

const adminMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',  label: 'Reports'  }] },
  { section: 'Team',       links: [{ to: '/staff',        label: 'Staff'        }, { to: '/documents',label: 'Documents'}] },
  { section: 'System',     links: [{ to: '/settings',     label: 'Settings'     }] },
]

// staff cannot see Staff, Reports, Settings
const staffMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }] },
  { section: 'Documents',  links: [{ to: '/documents',    label: 'Documents'    }] },
]

// ─────────────────────────────────────────────────────────────
// PAGE TITLE LOOKUP
// ─────────────────────────────────────────────────────────────

const PAGE_LABELS = {
  dashboard: 'Dashboard', applications: 'Applicants', students: 'Students',
  visitors: 'Visitors',   appointments: 'Appointments', tasks: 'Tasks',
  documents: 'Documents', payments: 'Payments', staff: 'Staff',
  reports: 'Reports',     settings: 'Settings',
}

const PAGE_SUB = {}

const SIDEBAR_WIDTH = 230

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export default function Navbar({ menuOpen, setMenuOpen }) {

  const location     = useLocation()
  const navigate     = useNavigate()
  const drawerRef    = useRef(null)
  const toggleBtnRef = useRef(null)

  // get logged in profile from localStorage
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')
  const isAdmin  = profile.role === 'admin'
  const isStaff  = profile.role === 'staff'

  // pick the right menu based on role
  const menu = isAdmin ? adminMenu : staffMenu

  const key      = location.pathname.replace('/', '').toLowerCase()
  const title    = PAGE_LABELS[key] || 'Dashboard'
  const subtitle = PAGE_SUB[key] || ''

  // display name — use profile name or fall back to role label
  const displayName = profile.name || (isAdmin ? 'Admin' : isStaff ? 'Staff' : 'User')
  const roleLabel   = isAdmin ? 'Administrator' : isStaff ? 'Staff Member' : 'User'

  // initials for avatar
  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // click outside closes sidebar
  useEffect(() => {
    function handleClick(e) {
      if (
        menuOpen &&
        drawerRef.current    && !drawerRef.current.contains(e.target) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(e.target)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen, setMenuOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/login')
  }

  return (
    <>
      {/* ── TOP NAVBAR ── */}
      <header style={{
        height: 64,
        background: '#fff',
        borderBottom: '1px solid #e8eaed',
        position: 'fixed', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        zIndex: 200,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>

        {/* hamburger button */}
        <button
          ref={toggleBtnRef}
          onClick={() => setMenuOpen(v => !v)}
          style={{
            width: 38, height: 38, borderRadius: 8,
            border: '1px solid #a3a7b1',
            background: menuOpen ? '#f3f4f6' : '#fff',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 5, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 18, height: 2, borderRadius: 2,
              background: '#374151', transition: 'all 0.2s',
              transform: menuOpen
                ? i === 0 ? 'translateY(7px) rotate(45deg)'
                : i === 2 ? 'translateY(-7px) rotate(-45deg)'
                : 'scaleX(0)'
                : 'none',
              opacity: menuOpen && i === 1 ? 0 : 1,
            }}/>
          ))}
        </button>

        {/* logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <img src="/src/assets/images/logo.png" alt="Logo"
            style={{ width: 79, height: 90, borderRadius: 8, objectFit: 'contain' }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Consultancy CRM</div>
          </div>
        </div>

        {/* divider */}
        <div style={{ width: 1, height: 32, background: '#e5e7eb', flexShrink: 0 }} />

        {/* page title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#0f327dcf', lineHeight: 1.2 }}>
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{subtitle}</div>}
        </div>

        {/* user avatar — shows role label */}
        <div
          onClick={() => isAdmin && navigate('/settings')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isAdmin ? 'pointer' : 'default' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: isAdmin ? '#1a1f3a' : '#7c3aed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{displayName}</div>
            <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{roleLabel}</div>
          </div>
        </div>
      </header>

      {/* ── SIDEBAR DRAWER ── */}
      <nav ref={drawerRef} style={{
        position: 'fixed',
        top: 64,
        left: 0,
        width: SIDEBAR_WIDTH,
        height: 'calc(100vh - 64px)',
        background: theme.sidebarBg || '#4f373723',
        borderRight: `1px solid ${theme.border || '#a3a7b1'}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
        transform: menuOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}>

        {/* role badge at top of sidebar */}
        <div style={{
          padding: '10px 14px 6px',
          borderBottom: `1px solid ${theme.border || '#e5e7eb'}`,
        }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 600,
            background: isAdmin ? '#dbeafe' : '#ede9fe',
            color: isAdmin ? '#1d4ed8' : '#7c3aed',
          }}>
            {isAdmin ? '👑 Admin Panel' : '👤 Staff Panel'}
          </span>
        </div>

        {/* scrollable menu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          {menu.map(group => (
            <div key={group.section}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: theme.textLight || '#9ca3af',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '10px 8px 4px',
              }}>
                {group.section}
              </div>

              {group.links.map(link => (
                <NavLink key={link.to} to={link.to}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center',
                    padding: '9px 10px', borderRadius: 23,
                    textDecoration: 'none', fontSize: 13.5, marginBottom: 1,
                    transition: 'all 0.12s',
                    color:      isActive ? (theme.primaryText  || '#1a56db') : (theme.textMid || '#374151'),
                    background: isActive ? (theme.primaryLight || '#eff6ff') : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  })}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* logout button at bottom */}
        <div style={{ borderTop: `1px solid ${theme.border || '#e5e7eb'}`, padding: '10px 10px 14px' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '8px 0',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
            onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
          >
            Logout
          </button>
        </div>
      </nav>
    </>
  )
}