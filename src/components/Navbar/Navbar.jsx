import { useRef, useEffect } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { supabase } from '../../supabase'
import theme from '../../theme'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  LayoutDashboard, FileText, Users, UserCheck,
  CalendarDays, CheckSquare, CreditCard, BarChart3,
  UserCog, FolderOpen, MessageCircle, Settings as SettingsIcon,
} from 'lucide-react'

// ── Icon per route (lucide-react) ─────────────────────────────────────────
const ICONS = {
  '/dashboard':    LayoutDashboard,
  '/applications': FileText,
  '/students':     Users,
  '/visitors':     UserCheck,
  '/appointments': CalendarDays,
  '/tasks':        CheckSquare,
  '/payments':     CreditCard,
  '/reports':      BarChart3,
  '/staff':        UserCog,
  '/documents':    FolderOpen,
  '/chat':         MessageCircle,
  '/settings':     SettingsIcon,
}

// ── Sidebar menu per role ─────────────────────────────────────────────────
const adminMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',  label: 'Reports'  }] },
  { section: 'Team',       links: [{ to: '/staff',        label: 'Staff'        }, { to: '/documents',label: 'Documents'}, { to: '/chat', label: 'Chat' }] },
  { section: 'System',     links: [{ to: '/settings',     label: 'Settings'     }] },
]

const staffMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }] },
  { section: 'Documents',  links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat',     label: 'Chat'     }] },
]

const financeMenu = [
  { section: 'Overview',    links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Finance',     links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',      label: 'Reports'      }] },
  { section: 'Pipeline',    links: [{ to: '/students',     label: 'Students'     }] },
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',        label: 'Tasks'        }] },
  { section: 'Team',        links: [{ to: '/chat',         label: 'Chat'         }] },
]

const documentMenu = [
  { section: 'Overview',    links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }] },
  { section: 'Documents',   links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat', label: 'Chat' }] },
]

// ✅ FIXED: Chat added to receptionistMenu
const receptionistMenu = [
  { section: 'Overview',    links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',    links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }] },
  { section: 'Team',        links: [{ to: '/chat',         label: 'Chat'         }] },
]

const MENUS = {
  admin:            adminMenu,
  staff:            staffMenu,
  finance_officer:  financeMenu,
  document_handler: documentMenu,
  receptionist:     receptionistMenu,
}

// ── Role display config ───────────────────────────────────────────────────
const ROLE_META = {
  admin:            { label: 'Administrator',    badge: ' Admin Panel',     badgeBg: '#dbeafe', badgeColor: '#1d4ed8', avatarBg: '#1a1f3a' },
  staff:            { label: 'Staff Member',     badge: ' Staff Panel',     badgeBg: '#ede9fe', badgeColor: '#7c3aed', avatarBg: '#7c3aed' },
  finance_officer:  { label: 'Finance Officer',  badge: ' Finance Panel',   badgeBg: '#dcfce7', badgeColor: '#15803d', avatarBg: '#15803d' },
  document_handler: { label: 'Document Handler', badge: ' Documents Panel', badgeBg: '#fef9c3', badgeColor: '#854d0e', avatarBg: '#854d0e' },
  receptionist:     { label: 'Receptionist',     badge: ' Reception Panel', badgeBg: '#fce7f3', badgeColor: '#9d174d', avatarBg: '#9d174d' },
}

const PAGE_LABELS = {
  dashboard: 'Dashboard', applications: 'Applicants', students: 'Students',
  visitors: 'Visitors',   appointments: 'Appointments', tasks: 'Tasks',
  documents: 'Documents', payments: 'Payments', staff: 'Staff',
  reports: 'Reports',     settings: 'Settings', chat: 'Chat',
}

// Desktop keeps pushing content (App.jsx Layout adds marginLeft using this).
// Mobile uses its own, slightly wider, overlay width — touch targets need
// more room and it doesn't need to leave space for pushed content.
const DESKTOP_SIDEBAR_WIDTH = 230
const MOBILE_SIDEBAR_WIDTH  = 260

export default function Navbar({ menuOpen, setMenuOpen }) {
  const location     = useLocation()
  const navigate      = useNavigate()
  const drawerRef     = useRef(null)
  const toggleBtnRef  = useRef(null)
  const isMobile      = useIsMobile()

  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')
  const role     = profile.role || 'staff'
  const menu     = MENUS[role]     || staffMenu
  const roleMeta = ROLE_META[role] || ROLE_META.staff

  const key   = location.pathname.replace('/', '').toLowerCase()
  const title = PAGE_LABELS[key] || 'Dashboard'

  const displayName = profile.name || roleMeta.label
  const initials     = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const drawerWidth = isMobile ? MOBILE_SIDEBAR_WIDTH : DESKTOP_SIDEBAR_WIDTH

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
      {/* ── Top header ── */}
      <header style={{
        height: 64,
        background: '#fff',
        borderBottom: '1px solid #e8eaed',
        position: 'fixed', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center',
        padding: isMobile ? '0 10px' : '0 20px',
        gap: isMobile ? 8 : 12,
        zIndex: 200,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>

        {/* Hamburger */}
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
            }} />
          ))}
        </button>

        {/* Logo — shrinks on phone, text stack hides below ~380px to save room */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <img src="/src/assets/images/logo.png" alt="Logo"
            style={{
              width:  isMobile ? 40 : 79,
              height: isMobile ? 46 : 90,
              borderRadius: 8, objectFit: 'contain',
            }} />
          {!isMobile && (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>Consultancy CRM</div>
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{ width: 1, height: 32, background: '#e5e7eb', flexShrink: 0 }} />
        )}

        {/* Page title — scales down so it never forces horizontal scroll */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 17 : 30,
            fontWeight: 700, color: '#0f327dcf', lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </div>
        </div>

        {/* Avatar — on phone, show just the circle to save width; name/role tuck away */}
        <div
          onClick={() => role === 'admin' && navigate('/settings')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: role === 'admin' ? 'pointer' : 'default', flexShrink: 0 }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: roleMeta.avatarBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          {!isMobile && (
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{displayName}</div>
              <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{roleMeta.label}</div>
            </div>
          )}
        </div>
      </header>

      {/* ── Backdrop — mobile only, tap outside the drawer to close it ── */}
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', top: 64, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 90,
          }}
        />
      )}

      {/* ── Sidebar drawer ──
          Desktop: pushes content (App.jsx Layout adds matching marginLeft).
          Mobile:  overlays content on top of the backdrop above; Layout
                   keeps marginLeft at 0 so nothing shifts underneath it. */}
      <nav ref={drawerRef} style={{
        position: 'fixed',
        top: 64, left: 0,
        width: drawerWidth,
        height: 'calc(100vh - 64px)',
        background: theme.sidebarBg || '#ffffff',
        borderRight: `1px solid ${theme.border || '#a3a7b1'}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
        transform: menuOpen ? 'translateX(0)' : `translateX(-${drawerWidth}px)`,
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        boxShadow: isMobile && menuOpen ? '2px 0 16px rgba(0,0,0,0.18)' : 'none',
      }}>

        {/* Role badge */}
        <div style={{
          padding: '10px 14px 6px',
          borderBottom: `1px solid ${theme.border || '#e5e7eb'}`,
        }}>
          <span style={{
            padding: '3px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 600,
            background: roleMeta.badgeBg,
            color: roleMeta.badgeColor,
          }}>
            {roleMeta.badge}
          </span>
        </div>

        {/* Nav links */}
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
              {group.links.map(link => {
                const Icon = ICONS[link.to] || LayoutDashboard
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: isMobile ? '11px 12px' : '9px 12px', // slightly taller tap target on phone
                      borderRadius: 23,
                      textDecoration: 'none', fontSize: 13.5, marginBottom: 1,
                      transition: 'all 0.12s',
                      color:      isActive ? (theme.primaryText  || '#1a56db') : (theme.textMid || '#374151'),
                      background: isActive ? (theme.primaryLight || '#eff6ff') : 'transparent',
                      fontWeight: isActive ? 600 : 400,
                    })}
                  >
                    <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span>{link.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>

        {/* Logout */}
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