import { useRef, useEffect, useState } from 'react'
import { useLocation, useNavigate, NavLink } from 'react-router-dom'
import { supabase } from '../../supabase'
import theme from '../../theme'
import { useIsMobile } from '../../hooks/useIsMobile'
import StaffProfileModal from '../StaffProfileModal'
import {
  LayoutDashboard, FileText, Users, UserCheck,
  CalendarDays, CheckSquare, CreditCard, BarChart3,
  UserCog, FolderOpen, MessageCircle, Settings as SettingsIcon,
  LogOut,
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
// Admin no longer carries Visitors / Appointments / Tasks — those live in the
// Reception panel (and Tasks in every staff panel). Admin oversees pipeline,
// finance, team and system settings.
const adminMenu = [
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }] },
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
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks', label: 'Tasks' }] },
  { section: 'Documents',   links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat', label: 'Chat' }] },
]

// Reception panel owns Visitors + Appointments + Tasks.
const receptionistMenu = [
  { section: 'Overview',    links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',    links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Team',        links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Counselor guides students through their journey — no applications/visa desk,
// no finance. Students + Appointments + Tasks + Chat.
const counselorMenu = [
  { section: 'Overview',    links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',    links: [{ to: '/students',     label: 'Students'     }] },
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Team',        links: [{ to: '/chat',         label: 'Chat'         }] },
]

// Visa Officer works the application + document pipeline for visa processing.
const visaOfficerMenu = [
  { section: 'Overview',    links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',    links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }] },
  { section: 'Operations',  links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Documents',   links: [{ to: '/documents',    label: 'Documents'    }, { to: '/chat',     label: 'Chat'     }] },
]

const MENUS = {
  admin:            adminMenu,
  staff:            staffMenu,
  finance_officer:  financeMenu,
  document_handler: documentMenu,
  receptionist:     receptionistMenu,
  counselor:        counselorMenu,
  visa_officer:     visaOfficerMenu,
}

// ── Role display config ───────────────────────────────────────────────────
const ROLE_META = {
  admin:            { label: 'Administrator',    badge: ' Admin Panel',     badgeBg: theme.status.info.bg, badgeColor: theme.primary, avatarBg: theme.navy },
  staff:            { label: 'Staff Member',     badge: ' Staff Panel',     badgeBg: theme.purpleLight, badgeColor: theme.purple, avatarBg: theme.purple },
  finance_officer:  { label: 'Finance Officer',  badge: ' Finance Panel',   badgeBg: theme.status.success.bg, badgeColor: theme.status.success.text, avatarBg: theme.status.success.text },
  document_handler: { label: 'Document Handler', badge: ' Documents Panel', badgeBg: theme.status.warning.bg, badgeColor: theme.status.warning.text, avatarBg: theme.status.warning.text },
  receptionist:     { label: 'Receptionist',     badge: ' Reception Panel', badgeBg: theme.pinkLight, badgeColor: theme.pink, avatarBg: theme.pink },
  counselor:        { label: 'Counselor',        badge: ' Counselor Panel', badgeBg: theme.accentLight, badgeColor: theme.accent, avatarBg: theme.accent },
  visa_officer:     { label: 'Visa Officer',     badge: ' Visa Panel',      badgeBg: theme.blueLight, badgeColor: theme.blue, avatarBg: theme.blue },
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
  const accountRef    = useRef(null)
  const isMobile      = useIsMobile()

  const [profile, setProfile] = useState(() => JSON.parse(localStorage.getItem('profile') || '{}'))
  const [myStaffRow,     setMyStaffRow]     = useState(null) // matching `staff` table row, if one exists
  const [showMyProfile,  setShowMyProfile]  = useState(false)
  const [accountOpen,    setAccountOpen]    = useState(false) // top-right avatar dropdown (profile + logout)

  const role     = profile.role || 'staff'
  const menu     = MENUS[role]     || staffMenu
  const roleMeta = ROLE_META[role] || ROLE_META.staff

  const key   = location.pathname.replace('/', '').toLowerCase()
  const title = PAGE_LABELS[key] || 'Dashboard'

  const displayName = profile.name || roleMeta.label
  const initials     = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const myPhoto       = profile.avatar_url || myStaffRow?.avatar_url || null

  const drawerWidth = isMobile ? MOBILE_SIDEBAR_WIDTH : DESKTOP_SIDEBAR_WIDTH

  // Look up the matching `staff` table row (if any) so "My Profile" can also
  // show/edit phone + joining date — some accounts (e.g. the original admin)
  // may not have one, and the modal handles that gracefully either way.
  useEffect(() => {
    let cancelled = false
    if (!profile.email) return
    supabase.from('staff').select('*').ilike('email', profile.email).maybeSingle()
      .then(({ data }) => { if (!cancelled) setMyStaffRow(data || null) })
    return () => { cancelled = true }
  }, [profile.email])

  async function saveMyProfile(fields) {
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ name: fields.name, phone_new: fields.phone })
      .eq('id', profile.id)
    if (profErr) throw profErr

    if (myStaffRow) {
      await supabase.from('staff').update({ name: fields.name, phone: fields.phone || null }).eq('id', myStaffRow.id)
      setMyStaffRow(prev => prev && { ...prev, name: fields.name, phone: fields.phone })
    }

    const updated = { ...profile, name: fields.name }
    localStorage.setItem('profile', JSON.stringify(updated))
    setProfile(updated)
  }

  async function saveMyAvatar(url) {
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
    if (error) throw error

    if (myStaffRow) {
      // Non-admins are usually blocked by RLS from writing the `staff`
      // table directly, so this often silently updates 0 rows (no error —
      // Postgres just applies the WHERE/RLS filter and moves on). The admin
      // Staff page already falls back to `profiles.avatar_url` when this
      // happens, so it's not fatal — this just logs it for visibility.
      const { data } = await supabase.from('staff').update({ avatar_url: url }).eq('id', myStaffRow.id).select()
      if (!data || data.length === 0) {
        console.warn('Could not sync avatar to the staff table row (likely blocked by RLS) — admin view falls back to the profiles table copy.')
      } else {
        setMyStaffRow(prev => prev && { ...prev, avatar_url: url })
      }
    }

    const updated = { ...profile, avatar_url: url }
    localStorage.setItem('profile', JSON.stringify(updated))
    setProfile(updated)
  }

  useEffect(() => {
    // Desktop: sidebar stays put — only the hamburger toggles it.
    // Mobile: it's an overlay, so tapping outside closes it.
    if (!isMobile) return
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
  }, [menuOpen, setMenuOpen, isMobile])

  // Close the top-right account dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!accountOpen) return
    function handleClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [accountOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    localStorage.removeItem('profile')
    navigate('/team-portal-x7k2f9')   // obscure staff login path (see App.jsx)
  }

  return (
    <>
      {/* ── Top header ── */}
      <header style={{
        height: 64,
        background: theme.navbarBg,
        borderBottom: `1px solid ${theme.palette.navyLine}`,
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
            border: '1px solid rgba(255,255,255,0.22)',
            background: menuOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 5, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 18, height: 2, borderRadius: 2,
              background: theme.textOnDark, transition: 'all 0.2s',
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
          <img src="/logo.png" alt="Logo"
            style={{
              width:  isMobile ? 40 : 79,
              height: isMobile ? 46 : 90,
              borderRadius: 8, objectFit: 'contain',
            }} />
          {!isMobile && (
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.textOnDark }}>Global Pathway</div>
              <div style={{ fontSize: 10, color: theme.textOnDarkMuted }}>Consultancy CRM</div>
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
        )}

        {/* Page title — smaller and centred; scales down so it never forces
            horizontal scroll */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 15 : 20,
            fontWeight: 700, color: theme.textOnDark, lineHeight: 1.2,
            textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </div>
        </div>

        {/* Avatar — click opens an account dropdown (My Profile / Log out).
            On phone, show just the circle to save width; name/role tuck away. */}
        <div ref={accountRef} style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => setAccountOpen(v => !v)}
            title="Account"
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            {myPhoto ? (
              <img src={myPhoto} alt={displayName} style={{
                width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
              }} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: roleMeta.avatarBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11, color: theme.white, flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            {!isMobile && (
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textOnDark }}>{displayName}</div>
                <div style={{ fontSize: 10.5, color: theme.textOnDarkMuted }}>{roleMeta.label}</div>
              </div>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ flexShrink: 0, transition: 'transform 0.15s', transform: accountOpen ? 'rotate(180deg)' : 'none' }}>
              <path d="M6 9l6 6 6-6" stroke={theme.textOnDarkMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {accountOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0,
              minWidth: 190,
              background: theme.white,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
              overflow: 'hidden',
              zIndex: 300,
            }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textStrong, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 11, color: theme.textLight, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile.email || roleMeta.label}
                </div>
              </div>

              <button
                onClick={() => { setAccountOpen(false); setShowMyProfile(true) }}
                style={{
                  width: '100%', padding: '10px 14px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: theme.textMid, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}
                onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <UserCog size={15} strokeWidth={2} /> My Profile
              </button>

              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '10px 14px', textAlign: 'left',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: `1px solid ${theme.border}`,
                  fontSize: 13, fontWeight: 600, color: theme.status.danger.main, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}
                onMouseEnter={e => e.currentTarget.style.background = theme.status.danger.bg}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={15} strokeWidth={2} /> Log out
              </button>
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
        // body has zoom:1.08 (index.css). `bottom:0` on a fixed element stops
        // ~8% short of the screen here, leaving a background strip below the
        // sidebar. Divide the zoom back out of the height, and extend the navy
        // downward with a box-shadow so there is never a visible seam.
        top: 64, left: 0,
        height: 'calc(100vh / 1.08 - 64px)',
        width: drawerWidth,
        background: theme.sidebarBg,
        borderRight: `1px solid ${theme.palette.navyLine}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
        transform: menuOpen ? 'translateX(0)' : `translateX(-${drawerWidth}px)`,
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        boxShadow: `0 40vh 0 0 ${theme.sidebarBg}${isMobile && menuOpen ? ', 2px 0 16px rgba(0,0,0,0.18)' : ''}`,
      }}>

        {/* Role badge */}
        <div style={{
          padding: '10px 14px 6px',
          borderBottom: `1px solid ${theme.palette.navyLine}`,
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

        {/* Nav links — one flat list (no section headings). Top-aligned; if the
            list is taller than the sidebar the .sidebar-nav-scroll bar appears
            and you scroll to the rest (like the classic sidebar). */}
        <div className="sidebar-nav-scroll" style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: isMobile ? '10px 10px' : '14px 10px 18px',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: isMobile ? 4 : 6,
        }}>
          {menu.flatMap(group => group.links).map(link => {
            const Icon = ICONS[link.to] || LayoutDashboard
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => { if (isMobile) setMenuOpen(false) }}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: isMobile ? '12px 12px' : '11px 12px',
                  borderRadius: 23,
                  textDecoration: 'none', fontSize: 14,
                  transition: 'all 0.12s',
                  color:      isActive ? theme.white : theme.textOnDark,
                  background: isActive ? theme.primary : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  flexShrink: 0,
                })}
              >
                <Icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span>{link.label}</span>
              </NavLink>
            )
          })}
        </div>
        {/* Logout moved to the top-right account menu (avatar dropdown). */}
      </nav>

      {/* "My Profile" popup — view/edit your own info, photo is device-local */}
      {showMyProfile && (
        <StaffProfileModal
          staff={{
            id:        myStaffRow?.id || null,
            name:      profile.name  || myStaffRow?.name  || '',
            email:     profile.email || myStaffRow?.email || '',
            role:      myStaffRow?.role || roleMeta.label,
            phone:     myStaffRow?.phone || '',
            joined:    myStaffRow?.joined || '',
            avatarUrl: myPhoto,
          }}
          showJoined={!!myStaffRow}
          title="My Profile"
          onClose={() => setShowMyProfile(false)}
          onSave={saveMyProfile}
          onPhotoChange={saveMyAvatar}
        />
      )}
    </>
  )
}