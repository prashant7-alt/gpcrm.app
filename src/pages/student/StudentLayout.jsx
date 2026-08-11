import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  LayoutDashboard,
  Calendar,
  User,
  Plane,
  FolderOpen,
  CreditCard,
  MessageSquare,
  LogOut,
} from 'lucide-react'

const SIDEBAR_BG      = '#1792ab'
const SIDEBAR_BORDER  = '#2e3b56'
const ACTIVE_BG       = '#dcfce7'
const ACTIVE_TEXT     = '#15803d'
const INACTIVE_TEXT   = '#374151'

const DESKTOP_SIDEBAR_WIDTH = 230
const MOBILE_SIDEBAR_WIDTH  = 260

const navLinks = [
  { to: '/student/dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/student/appointments', label: 'Appointments',    icon: Calendar        },
  { to: '/student/profile',      label: 'My Profile',      icon: User            },
  { to: '/student/visa-status',  label: 'Visa Status',     icon: Plane           },
  { to: '/student/documents',    label: 'Documents',       icon: FolderOpen      },
  { to: '/student/payments',     label: 'Payments',        icon: CreditCard      },
  { to: '/student/chat',         label: 'Chat with Staff', icon: MessageSquare   },
]

const PAGE_LABELS = {
  dashboard:    'Dashboard',
  appointments: 'Appointments',
  profile:      'My Profile',
  'visa-status':'Visa Status',
  documents:    'Documents',
  payments:     'Payments',
  chat:         'Chat with Staff',
}

export default function StudentLayout({ children }) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const [menuOpen, setMenuOpen] = useState(false)

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const key   = location.pathname.split('/').pop()
  const title = PAGE_LABELS[key] || 'Student Portal'

  const drawerWidth = isMobile ? MOBILE_SIDEBAR_WIDTH : DESKTOP_SIDEBAR_WIDTH

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/login')
  }

  function goTo(to) {
    navigate(to)
    if (isMobile) setMenuOpen(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── Mobile top header — hamburger + page title ── */}
      {isMobile && (
        <header style={{
          height: 56,
          background: '#fff',
          borderBottom: `1px solid ${SIDEBAR_BORDER}`,
          position: 'fixed', top: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 10,
          zIndex: 200,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: '1px solid #d1d5db', background: menuOpen ? '#f3f4f6' : '#fff',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block', width: 16, height: 2, borderRadius: 2,
                background: '#374151', transition: 'all 0.2s',
                transform: menuOpen
                  ? i === 0 ? 'translateY(6px) rotate(45deg)'
                  : i === 2 ? 'translateY(-6px) rotate(-45deg)'
                  : 'scaleX(0)'
                  : 'none',
                opacity: menuOpen && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>

          <img
            src="/src/assets/images/logo.png"
            alt="Global Pathway"
            style={{ width: 32, height: 36, borderRadius: 7, objectFit: 'contain', flexShrink: 0 }}
          />

          <div style={{
            fontSize: 16, fontWeight: 700, color: '#111827',
            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </div>

          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials}
          </div>
        </header>
      )}

      {/* ── Backdrop — mobile only, tap outside the drawer to close it ── */}
      {isMobile && menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', top: 56, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 90,
          }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: drawerWidth,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        position: 'fixed',
        top: isMobile ? 56 : 0,
        left: 0,
        height: isMobile ? 'calc(100vh - 56px)' : '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 0',
        zIndex: 100,
        transform: isMobile
          ? (menuOpen ? 'translateX(0)' : `translateX(-${drawerWidth}px)`)
          : 'none',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: isMobile && menuOpen ? '2px 0 16px rgba(0,0,0,0.18)' : 'none',
      }}>

        {/* Logo — desktop only; mobile shows it in the top header instead */}
        {!isMobile && (
          <div style={{
            padding: '18px 16px',
            borderBottom: '1px solid #e5e7eb',
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
        )}

        {/* Nav Links */}
        <div style={{
          flex: 1,
          padding: isMobile ? '10px 8px' : '12px 0',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isMobile ? 'space-evenly' : 'flex-start',
        }}>
          {navLinks.map(link => {
            const isActive = location.pathname === link.to
            const Icon = link.icon
            return (
              <button
                key={link.to}
                onClick={() => goTo(link.to)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: isMobile ? '13px 12px' : '13px 14px',
                  borderRadius: 10,
                  border: 'none', textAlign: 'left',
                  fontSize: isMobile ? 17 : 16,
                  marginBottom: isMobile ? 0 : 32,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: isActive ? ACTIVE_BG   : 'transparent',
                  color:      isActive ? ACTIVE_TEXT : INACTIVE_TEXT,
                  fontWeight: isActive ? 600          : 400,
                  flexShrink: 0,
                }}
              >
                <Icon size={isMobile ? 19 : 18} strokeWidth={isActive ? 2.3 : 2} style={{ flexShrink: 0 }} />
                {link.label}
              </button>
            )
          })}
        </div>

        {/* User + Logout */}
        <div style={{ padding: isMobile ? '10px 12px' : '12px 14px', borderTop: '1px solid #e5e7eb' }}>
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        marginLeft: isMobile ? 0 : DESKTOP_SIDEBAR_WIDTH,
        marginTop: isMobile ? 56 : 0,
        padding: isMobile ? 12 : 28,
      }}>
        {children}
      </main>
    </div>
  )
}