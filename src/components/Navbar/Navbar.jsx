// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────

import { useRef, useEffect } from 'react'
// useRef   → creates a persistent reference to a DOM element (no re-render on change)
// useEffect → runs side-effects after render (here: sets up a click-outside listener)

import { useLocation, useNavigate, NavLink } from 'react-router-dom'
// useLocation → reads the current URL path (e.g. "/dashboard")
// useNavigate → lets us programmatically redirect to another route (e.g. after logout)
// NavLink     → like <a>, but auto-adds an "active" state when its `to` matches the URL

import { supabase } from '../../supabase'
// supabase → our pre-configured Supabase client; used here only for signing the user out

import theme from '../../theme'
// theme → a shared JS object holding design tokens (colors, borders, etc.)
//         so colors stay consistent across the whole app from one place


// ─────────────────────────────────────────────────────────────
// SIDEBAR MENU DEFINITION
// ─────────────────────────────────────────────────────────────

const menu = [
  // Each object is a visual group (section header + its nav links)
  { section: 'Overview',   links: [{ to: '/dashboard',    label: 'Dashboard'    }] },
  { section: 'Pipeline',   links: [{ to: '/applications', label: 'Applications' }, { to: '/students', label: 'Students' }, { to: '/visitors', label: 'Visitors' }] },
  { section: 'Operations', links: [{ to: '/appointments', label: 'Appointments' }, { to: '/tasks',    label: 'Tasks'    }] },
  { section: 'Finance',    links: [{ to: '/payments',     label: 'Payments'     }, { to: '/reports',  label: 'Reports'  }] },
  { section: 'Team',       links: [{ to: '/staff',        label: 'Staff'        }, { to: '/documents',label: 'Documents'}] },
  { section: 'System',     links: [{ to: '/settings',     label: 'Settings'     }] },
]
// Centralising the menu here means you only edit one array to add/remove nav items


// ─────────────────────────────────────────────────────────────
// PAGE TITLE LOOKUP TABLES
// ─────────────────────────────────────────────────────────────

const PAGE_LABELS = {
  // Maps URL segment (key) → large heading text shown in the top navbar
  // e.g. pathname "/applications" → strip "/" → "applications" → "Applicants"
  dashboard: 'Dashboard', applications: 'Applicants', students: 'Students',
  visitors: 'Visitors',   appointments: 'Appointments', tasks: 'Tasks',
  documents: 'Documents', payments: 'Payments', staff: 'Staff',
  reports: 'Reports',     settings: 'Settings',
}

const PAGE_SUB = {
  // Maps URL segment → optional subtitle shown below the main heading
  // Currently empty — add entries like  dashboard: 'Welcome back'  to enable subtitles
}


// ─────────────────────────────────────────────────────────────
// LAYOUT CONSTANT
// ─────────────────────────────────────────────────────────────

// Must match SIDEBAR_WIDTH in App.jsx so the main content area indents by exactly this amount
const SIDEBAR_WIDTH = 230  // pixels


// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export default function Navbar({ menuOpen, setMenuOpen }) {
  // Props:
  //   menuOpen    → boolean — is the sidebar currently visible?
  //   setMenuOpen → state setter from the parent (App.jsx) to show/hide the sidebar

  const location = useLocation()   // current URL object, e.g. { pathname: '/students' }
  const navigate  = useNavigate()  // function to push a new route imperatively
  const drawerRef    = useRef(null) // will be attached to the <nav> sidebar element
  const toggleBtnRef = useRef(null) // will be attached to the hamburger <button>

  // Derive the page key by stripping the leading "/" and lowercasing
  // e.g. "/Applications" → "applications"
  const key      = location.pathname.replace('/', '').toLowerCase()

  // Look up the human-readable title, falling back to 'Dashboard' if unknown
  const title    = PAGE_LABELS[key] || 'Dashboard'

  // Look up an optional subtitle (empty string if none defined)
  const subtitle = PAGE_SUB[key] || ''


  // ── CLICK-OUTSIDE HANDLER ──────────────────────────────────
  useEffect(() => {
    function handleClick(e) {
      if (
        menuOpen &&                                              // only act when sidebar is open
        drawerRef.current && !drawerRef.current.contains(e.target) &&   // click was outside <nav>
        toggleBtnRef.current && !toggleBtnRef.current.contains(e.target) // and outside the toggle btn
      ) {
        setMenuOpen(false) // close the sidebar
      }
    }

    document.addEventListener('mousedown', handleClick) // attach listener to the whole page
    return () => document.removeEventListener('mousedown', handleClick)
    // ↑ cleanup: remove the listener when the component unmounts or deps change
    //   (prevents memory leaks and duplicate listeners)
  }, [menuOpen, setMenuOpen])
  // Re-runs whenever menuOpen or setMenuOpen changes so the closure captures fresh values


  // ── LOGOUT ────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()          // tell Supabase to invalidate the session
    localStorage.removeItem('profile')     // wipe any cached profile data from the browser
    navigate('/login')                     // redirect to the login page
  }


  // ── RENDER ────────────────────────────────────────────────
  return (
    <>
      {/* ════════════════════════════════
          TOP NAVBAR (always visible)
          Fixed at the top of the viewport
          ════════════════════════════════ */}
      <header style={{
        height: 64,                          // fixed height so the sidebar's `top: 64` lines up
        background: '#fff',
        borderBottom: '1px solid #e8eaed',
        position: 'fixed', top: 0, left: 0, right: 0, // pins header across full width
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        zIndex: 200,                         // sits above the sidebar (zIndex 100)
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>

        {/* ── HAMBURGER BUTTON ───────────────────────────── */}
        <button
          ref={toggleBtnRef}               // ref so click-outside logic can ignore this button
          onClick={() => setMenuOpen(v => !v)} // toggle: open→close or close→open
          style={{
            width: 38, height: 38, borderRadius: 8,
            border: '1px solid #a3a7b1',
            background: menuOpen ? '#f3f4f6' : '#fff', // tinted background when sidebar is open
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 5, cursor: 'pointer', flexShrink: 0,
          }}
        >
          {/* Three bars — animate into an "X" when sidebar is open */}
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              display: 'block', width: 18, height: 2, borderRadius: 2,
              background: '#374151', transition: 'all 0.2s',
              transform: menuOpen
                ? i === 0 ? 'translateY(7px) rotate(45deg)'   // top bar → top of X
                : i === 2 ? 'translateY(-7px) rotate(-45deg)' // bottom bar → bottom of X
                : 'scaleX(0)'                                  // middle bar → disappears
                : 'none',                                      // all bars horizontal (closed state)
              opacity: menuOpen && i === 1 ? 0 : 1,            // hide middle bar when open
            }}/>
          ))}
        </button>

        {/* ── LOGO + APP NAME ────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <img src="/src/assets/images/logo.png" alt="Logo"
            style={{ width: 79, height: 90, borderRadius: 8, objectFit: 'contain' }} />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Consultancy CRM</div>
          </div>
        </div>

        {/* ── VERTICAL DIVIDER (visual separator) ─────────── */}
        <div style={{ width: 1, height: 32, background: '#e5e7eb', flexShrink: 0 }} />

        {/* ── PAGE TITLE (dynamic, from PAGE_LABELS) ──────── */}
        <div style={{ flex: 1, minWidth: 0 }}> {/* flex:1 pushes avatar to the right */}
          <div style={{ fontSize: 30, fontWeight: 700, color: '#0f327dcf', lineHeight: 1.2 }}>
            {title}   {/* e.g. "Applicants", "Dashboard" */}
          </div>
          {/* Only render subtitle row if a subtitle exists for this page */}
          {subtitle && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{subtitle}</div>}
        </div>

        {/* ── USER AVATAR / SETTINGS SHORTCUT ─────────────── */}
        <div onClick={() => navigate('/settings')} // clicking avatar goes to Settings page
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          {/* Circular avatar with initials */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: '#1a1f3a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, color: '#fff', flexShrink: 0,
          }}>BBIS</div>
          {/* Name and role text beside the avatar */}
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>BBIS</div>
            <div style={{ fontSize: 10.5, color: '#9ca3af' }}>Global Pathway</div>
          </div>
        </div>
      </header>


      {/* ════════════════════════════════
          SIDEBAR (slide-in drawer)
          Hidden off-screen by default;
          slides in when menuOpen === true
          ════════════════════════════════ */}
      <nav ref={drawerRef} style={{ // ref used by click-outside handler
        position: 'fixed',
        top: 64,          // starts exactly below the navbar
        left: 0,
        width: SIDEBAR_WIDTH,
        height: 'calc(100vh - 64px)', // fills remaining screen height
        background: theme.sidebarBg || '#4f373723', // semi-transparent tinted bg
        borderRight: `1px solid ${theme.border || '#a3a7b1'}`,
        display: 'flex', flexDirection: 'column',
        zIndex: 100,      // below the navbar (200) but above page content

        // SLIDE ANIMATION:
        // When closed → shift the entire sidebar left by its own width (off-screen)
        // When open   → bring it back to translateX(0) (on-screen)
        transform: menuOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
        transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)', // smooth ease-in-out curve
        overflow: 'hidden', // prevents scrollbar flash during animation
      }}>

        {/* ── SCROLLABLE MENU AREA ───────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          {/* Iterate over each menu group (section) */}
          {menu.map(group => (
            <div key={group.section}>

              {/* Section header label (e.g. "PIPELINE") */}
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: theme.textLight || '#9ca3af',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '10px 8px 4px',
              }}>{group.section}</div>

              {/* Nav links inside this section */}
              {group.links.map(link => (
                <NavLink key={link.to} to={link.to}
                  style={({ isActive }) => ({
                    // NavLink passes `isActive` — true when this link's path matches the URL
                    display: 'flex', alignItems: 'center',
                    padding: '9px 10px', borderRadius: 23, // pill shape
                    textDecoration: 'none', fontSize: 13.5, marginBottom: 1,
                    transition: 'all 0.12s',

                    // Active link: blue text + light blue background + bold
                    color:      isActive ? (theme.primaryText  || '#1a56db') : (theme.textMid || '#374151'),
                    background: isActive ? (theme.primaryLight || '#eff6ff') : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  })}
                >{link.label}</NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* ── LOGOUT BUTTON (pinned to bottom of sidebar) ── */}
        <div style={{ borderTop: `1px solid ${theme.border || '#e5e7eb'}`, padding: '10px 10px 14px' }}>
          <button
            onClick={handleLogout} // signs out and redirects to /login
            style={{
              width: '100%', padding: '8px 0',
              background: '#fef2f2',           // light red background
              border: '1px solid #fecaca',     // red border
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: '#dc2626',                // red text
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            // Hover effect — slightly darker red on mouse enter/leave
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