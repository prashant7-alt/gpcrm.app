import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../supabase'
import theme from '../../theme'
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

// Same navy / blue system as the staff sidebar (src/theme.js)
const SIDEBAR_BG      = theme.sidebarBg
const SIDEBAR_BORDER  = theme.palette.navyLine
const ACTIVE_BG       = theme.primary
const ACTIVE_TEXT     = theme.white
const INACTIVE_TEXT   = theme.textOnDark

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
  const [accountOpen, setAccountOpen] = useState(false) // avatar dropdown (My Profile / Log out)
  const accountRef = useRef(null)

  // Close the account dropdown on any outside click.
  useEffect(() => {
    if (!accountOpen) return
    function handleClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [accountOpen])

  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const key   = location.pathname.split('/').pop()
  const title = PAGE_LABELS[key] || 'Student Portal'

  const drawerWidth = isMobile ? MOBILE_SIDEBAR_WIDTH : DESKTOP_SIDEBAR_WIDTH

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/student-login')
  }

  function goTo(to) {
    navigate(to)
    if (isMobile) setMenuOpen(false)
  }

  // Dropdown shown from the avatar / user block. `placement` = 'down' | 'up'.
  const accountMenu = (placement) => {
    const itemStyle = {
      width: '100%', padding: '10px 14px', textAlign: 'left',
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 13, color: theme.textMid, fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 9,
    }
    return (
      <div style={{
        position: 'absolute', right: 0,
        [placement === 'up' ? 'bottom' : 'top']: 'calc(100% + 8px)',
        minWidth: 190, background: theme.white,
        border: `1px solid ${theme.border}`, borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)', overflow: 'hidden', zIndex: 300,
      }}>
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.name || 'Student'}
          </div>
          <div style={{ fontSize: 11, color: theme.textLight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {profile.email || ''}
          </div>
        </div>
        <button
          onClick={() => { setAccountOpen(false); goTo('/student/profile') }}
          style={itemStyle}
          onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <User size={15} strokeWidth={2} /> My Profile
        </button>
        <button
          onClick={handleLogout}
          style={{ ...itemStyle, borderTop: `1px solid ${theme.border}`, color: theme.status.danger.main, fontWeight: 600 }}
          onMouseEnter={e => e.currentTarget.style.background = theme.status.danger.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <LogOut size={15} strokeWidth={2} /> Log out
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.pageBg,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── Mobile top header — hamburger + page title ── */}
      {isMobile && (
        <header style={{
          height: 56,
          background: theme.navbarBg,
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
              border: '1px solid rgba(255,255,255,0.22)',
              background: menuOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: 'block', width: 16, height: 2, borderRadius: 2,
                background: theme.textOnDark, transition: 'all 0.2s',
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
            src="/logo.png"
            alt="Global Pathway"
            style={{ width: 32, height: 36, borderRadius: 7, objectFit: 'contain', flexShrink: 0 }}
          />

          <div style={{
            fontSize: 16, fontWeight: 700, color: theme.textOnDark,
            flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </div>

          <div ref={accountRef} style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => setAccountOpen(v => !v)}
              title="Account"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: theme.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: theme.white, cursor: 'pointer',
              }}
            >
              {initials}
            </div>
            {accountOpen && accountMenu('down')}
          </div>
        </header>
      )}

      {/* ── Desktop account avatar — top-right, same idea as the staff/admin
             navbar. Mobile uses the avatar in the top header above instead. ── */}
      {!isMobile && (
        <div ref={accountRef} style={{ position: 'fixed', top: 14, right: 24, zIndex: 150 }}>
          <div
            onClick={() => setAccountOpen(v => !v)}
            title="Account"
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '5px 10px 5px 6px', borderRadius: 999,
              background: theme.white,
              border: `1px solid ${theme.border}`,
              boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
              cursor: 'pointer', maxWidth: 230,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: theme.white, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ lineHeight: 1.2, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: theme.textStrong,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {profile.name || 'Student'}
              </div>
              <div style={{ fontSize: 10.5, color: theme.textLight }}>Student</div>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ flexShrink: 0, transition: 'transform 0.15s', transform: accountOpen ? 'rotate(180deg)' : 'none' }}>
              <path d="M6 9l6 6 6-6" stroke={theme.textLight} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {accountOpen && accountMenu('down')}
        </div>
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
        // body has zoom:1.08 (index.css). With `bottom:0` the fixed sidebar
        // stops ~8% short of the screen, leaving a strip of page background
        // below it. Size it with the zoom divided back out instead, and paint
        // a tall navy box-shadow downward so there is never a visible seam.
        top: isMobile ? 56 : 0,
        height: isMobile ? 'calc(100vh / 1.08 - 56px)' : 'calc(100vh / 1.08)',
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 0',
        zIndex: 100,
        transform: isMobile
          ? (menuOpen ? 'translateX(0)' : `translateX(-${drawerWidth}px)`)
          : 'none',
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: `0 40vh 0 0 ${SIDEBAR_BG}${isMobile && menuOpen ? ', 2px 0 16px rgba(0,0,0,0.18)' : ''}`,
      }}>

        {/* Logo — desktop only; mobile shows it in the top header instead */}
        {!isMobile && (
          <div style={{
            padding: '18px 16px',
            borderBottom: `1px solid ${SIDEBAR_BORDER}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <img
              src="/logo.png"
              alt="Global Pathway"
              style={{ width: 70, height: 50, borderRadius: 10, objectFit: 'contain', flexShrink: 0, background: theme.white, padding: 2 }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.textOnDark }}>Global Pathway</div>
              <div style={{ fontSize: 11, color: theme.textOnDarkMuted, marginTop: 1 }}>Student Portal</div>
            </div>
          </div>
        )}

        {/* Nav Links — top-aligned; if the list is taller than the sidebar the
            .sidebar-nav-scroll bar appears and you scroll to the rest. */}
        <div className="sidebar-nav-scroll" style={{
          flex: 1, minHeight: 0,
          padding: isMobile ? '10px 8px' : '14px 0 18px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isMobile ? 'space-evenly' : 'flex-start',
          gap: isMobile ? 0 : 6,
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

        {/* User identity — the account menu (My Profile / Log out) lives on the
            avatar: top-right on desktop, top-header on mobile. */}
        <div style={{
          padding: isMobile ? '10px 12px' : '12px 14px',
          borderTop: `1px solid ${SIDEBAR_BORDER}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: theme.white, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: theme.textOnDark,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {profile.name || 'Student'}
            </div>
            <div style={{
              fontSize: 11, color: theme.textOnDarkMuted,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {profile.email || ''}
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──
           Desktop keeps extra top padding so page content (and any top-right
           action button) clears the fixed account avatar pill above. */}
      <main style={{
        marginLeft: isMobile ? 0 : DESKTOP_SIDEBAR_WIDTH,
        marginTop: isMobile ? 56 : 0,
        padding: isMobile ? 12 : '68px 28px 28px',
      }}>
        {children}
      </main>
    </div>
  )
}