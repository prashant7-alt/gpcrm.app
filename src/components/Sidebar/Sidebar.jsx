import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, UserCheck,
  CalendarClock, CheckSquare, FileText,
  Globe, BookOpen, ClipboardList,
  DollarSign, BarChart2, Settings, LogOut,
} from 'lucide-react'

const NAV = [
  {
    section: 'OVERVIEW',
    links: [
      { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
    ],
  },
  {
    section: 'PIPELINE',
    links: [
      { to: '/applications', label: 'Applicants',   Icon: Users        },
      { to: '/students',     label: 'Students',     Icon: GraduationCap },
      { to: '/visitors',     label: 'Walk-ins',     Icon: UserCheck    },
    ],
  },
  {
    section: 'OPERATIONS',
    links: [
      { to: '/appointments', label: 'Appointments', Icon: CalendarClock },
      { to: '/tasks',        label: 'Tasks',        Icon: CheckSquare  },
      { to: '/documents',    label: 'Documents',    Icon: FileText     },
    ],
  },
  {
    section: 'PROGRAMS',
    links: [
      { to: '/abroad',       label: 'Abroad Section', Icon: Globe      },
      { to: '/classes',      label: 'Classes & Tests', Icon: BookOpen  },
    ],
  },
  {
    section: 'FINANCE & HR',
    links: [
      { to: '/payments',     label: 'Payments',     Icon: DollarSign   },
      { to: '/staff',        label: 'Staff',        Icon: ClipboardList },
    ],
  },
  {
    section: 'ANALYTICS',
    links: [
      { to: '/reports',      label: 'Reports',      Icon: BarChart2    },
      { to: '/settings',     label: 'Settings',     Icon: Settings     },
    ],
  },
]

const S = {
  bg:         '#1a1f3a',
  active:     'rgba(255,255,255,0.12)',
  hover:      'rgba(255,255,255,0.06)',
  label:      'rgba(255,255,255,0.35)',
  textNormal: 'rgba(255,255,255,0.70)',
  textActive: '#ffffff',
  section:    'rgba(255,255,255,0.28)',
  border:     'rgba(255,255,255,0.08)',
}

export default function Sidebar() {
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 220,
      height: '100vh',
      background: S.bg,
      position: 'fixed',
      top: 0, left: 0,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      overflowY: 'auto',
    }}>

      {/* ── logo ── */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: `1px solid ${S.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <img
          src="/src/assets/images/logo.png"
          alt="Logo"
          style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, objectFit: 'cover' }}
        />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
            Global Pathway
          </div>
          <div style={{ fontSize: 10, color: S.label, marginTop: 2, letterSpacing: '0.03em' }}>
            CRM PLATFORM
          </div>
        </div>
      </div>

      {/* ── nav ── */}
      <div style={{ flex: 1, padding: '8px 10px' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 4 }}>
            <div style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: S.section,
              letterSpacing: '0.09em',
              padding: '12px 10px 4px',
            }}>
              {group.section}
            </div>

            {group.links.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 10px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? S.textActive : S.textNormal,
                  background: isActive ? S.active : 'transparent',
                  marginBottom: 1,
                  transition: 'all 0.12s',
                })}
                onMouseEnter={e => {
                  if (!e.currentTarget.classList.contains('active'))
                    e.currentTarget.style.background = S.hover
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.classList.contains('active'))
                    e.currentTarget.style.background = 'transparent'
                }}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* ── sign out ── */}
      <div style={{
        padding: '12px 10px',
        borderTop: `1px solid ${S.border}`,
      }}>
        <button
          onClick={() => navigate('/login')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            color: S.textNormal,
            fontSize: 13,
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = S.hover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={15} strokeWidth={1.8} />
          Sign out
        </button>
      </div>

    </aside>
  )
} 