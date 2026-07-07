import { useRef, useEffect } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { supabase } from '../../supabase'
import theme from '../../theme'

// ── Sidebar menus per role ─────────────────────────────────────────────────

const adminMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',  label: 'Reports'  }] },
  { section: 'Team',       links: [{ to: '/staff',        label: 'Staff'        }, { to: '/documents',label: 'Documents'}, { to: '/chat',     label: 'Chat'     }] },
  { section: 'System',     links: [{ to: '/settings',     label: 'Settings'     }] },
]

const staffMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }] },
  { section: 'Documents',  links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat',     label: 'Chat'     }] },
]

// Manager — same as staff but also sees Reports
const managerMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',  label: 'Reports'  }] },
  { section: 'Documents',  links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat',     label: 'Chat'     }] },
]

// Counselor — students, appointments, tasks, chat
const counselorMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Students',   links: [{ to: '/students',     label: 'Students'     }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Team',       links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Visa Officer — students, appointments, documents, tasks, chat
const visaOfficerMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Documents',  links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat',     label: 'Chat'     }] },
]

// Finance Officer — payments, reports, students (view only), tasks
const financeMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',  label: 'Reports'  }] },
  { section: 'Reference',  links: [{ to: '/students',     label: 'Students'     }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Team',       links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Document Handler — documents, students, tasks, chat
const documentMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Students',   links: [{ to: '/students',     label: 'Students'     }] },
  { section: 'Work',       links: [{ to: '/documents',    label: 'Documents'    }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Team',       links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Receptionist — applications, students, visitors, appointments, payments, tasks
const receptionistMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }] },
  { section: 'Team',       links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Marketing — applications, reports, tasks, chat
const marketingMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }] },
  { section: 'Analytics',  links: [{ to: '/reports',      label: 'Reports'      }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Team',       links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Other — minimal: dashboard, tasks, chat
const otherMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Work',       links: [{ to: '/tasks',        label: 'Tasks'        }] },
  { section: 'Team',       links: [{ to: '/chat',         label: 'Chat'         }] },
]

const MENUS = {
  admin:            adminMenu,
  staff:            staffMenu,
  manager:          managerMenu,
  counselor:        counselorMenu,
  visa_officer:     visaOfficerMenu,
  finance_officer:  financeMenu,
  document_handler: documentMenu,
  receptionist:     receptionistMenu,
  marketing:        marketingMenu,
  other:            otherMenu,
}

// ── Role display labels + colours ──────────────────────────────────────────
const ROLE_META = {
  admin:            { label: 'Administrator',    badge: 'Admin Panel',        badgeBg: '#dbeafe', badgeColor: '#1d4ed8', avatarBg: '#1a1f3a' },
  staff:            { label: 'Staff Member',     badge: 'Staff Panel',        badgeBg: '#ede9fe', badgeColor: '#7c3aed', avatarBg: '#7c3aed' },
  manager:          { label: 'Manager',          badge: 'Manager Panel',      badgeBg: '#cffafe', badgeColor: '#0e7490', avatarBg: '#0e7490' },
  counselor:        { label: 'Counselor',        badge: 'Counselor Panel',    badgeBg: '#d1fae5', badgeColor: '#065f46', avatarBg: '#065f46' },
  visa_officer:     { label: 'Visa Officer',     badge: 'Visa Panel',         badgeBg: '#fce7f3', badgeColor: '#9d174d', avatarBg: '#9d174d' },
  finance_officer:  { label: 'Finance Officer',  badge: 'Finance Panel',      badgeBg: '#dcfce7', badgeColor: '#15803d', avatarBg: '#15803d' },
  document_handler: { label: 'Document Handler', badge: 'Documents Panel',    badgeBg: '#fef9c3', badgeColor: '#854d0e', avatarBg: '#854d0e' },
  receptionist:     { label: 'Receptionist',     badge: 'Reception Panel',    badgeBg: '#fee2e2', badgeColor: '#991b1b', avatarBg: '#991b1b' },
  marketing:        { label: 'Marketing',        badge: 'Marketing Panel',    badgeBg: '#fef3c7', badgeColor: '#92400e', avatarBg: '#92400e' },
  other:            { label: 'Staff',            badge: 'Staff Panel',        badgeBg: '#f3f4f6', badgeColor: '#374151', avatarBg: '#374151' },
}

const PAGE_LABELS = {
  dashboard: 'Dashboard', applications: 'Applicants', students: 'Students',
  visitors: 'Visitors',   appointments: 'Appointments', tasks: 'Tasks',
  documents: 'Documents', payments: 'Payments', staff: 'Staff',
  reports: 'Reports',     settings: 'Settings', chat: 'Chat',
}

const SIDEBAR_WIDTH = 230

export default function Navbar({ menuOpen, setMenuOpen }) {
  const location     = useLocation()
  const navigate     = useNavigate()
  const drawerRef    = useRef(null)
  const toggleBtnRef = useRef(null)

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const role    = profile.role || 'staff'

  const menu     = MENUS[role]     || otherMenu
  const roleMeta = ROLE_META[role] || ROLE_META.other

  const key   = location.pathname.replace('/', '').toLowerCase()
  const title = PAGE_LABELS[key] || 'Dashboard'

  const displayName = profile.name || roleMeta.label
  const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

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
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
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

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <img src="/src/assets/images/logo.png" alt="Logo"
            style={{ width: 79, height: 90, borderRadius: 8, objectFit: 'contain' }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Consultancy CRM</div>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: '#e5e7eb', flexShrink: 0 }} />

        {/* Page title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#0f327dcf', lineHeight: 1.2 }}>
            {title}
          </div>
        </div>

        {/* Role badge — visible in header */}
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          background: roleMeta.badgeBg, color: roleMeta.badgeColor,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {roleMeta.badge}
        </div>

        {/* Avatar */}
        <div
          onClick={() => role === 'admin' && navigate('/settings')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: role === 'admin' ? 'pointer' : 'default' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: roleMeta.avatarBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{displayName}</div>
            <div style={{ fontSize: 10.5, color: '#9ca3af' }}>{roleMeta.label}</div>
          </div>
        </div>
      </header>

      {/* ── Sidebar drawer ── */}
      <nav ref={drawerRef} style={{
        position: 'fixed',
        top: 64, left: 0,
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
        {/* Role badge in sidebar */}
        <div style={{
          padding: '10px 14px 6px',
          borderBottom: `1px solid ${theme.border || '#e5e7eb'}`,
        }}>
          <span style={{
            display: 'inline-block',
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