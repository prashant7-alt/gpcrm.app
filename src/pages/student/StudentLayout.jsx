import { useNavigate, useLocation } from 'react-router-dom'
// useNavigate  → programmatically changes the route (used for nav buttons + logout redirect)
// useLocation  → reads the current URL path so we can highlight the active nav link

import { supabase } from '../../supabase'
// supabase → pre-configured client; used here only to sign the user out on logout


// ─────────────────────────────────────────────────────────────────────────────
// StudentLayout — persistent sidebar shell shared by every student page
// Usage: wrap any student page's content with <StudentLayout>...</StudentLayout>
// The sidebar stays fixed; only the right-side content area changes per page
// ─────────────────────────────────────────────────────────────────────────────


// ── THEME TOKENS ─────────────────────────────────────────────────────────────
// Centralised here so restyling the sidebar only requires changing these values
const SIDEBAR_BG      = '#950b0b2a'  // semi-transparent red-tinted sidebar background
const SIDEBAR_BORDER  = '#e5e7eb'    // right border color
const ACTIVE_BG       = '#dcfce7'    // light green background for the active nav item
const ACTIVE_TEXT     = '#15803d'    // dark green text for the active nav item
const INACTIVE_TEXT   = '#374151'    // default dark gray text for inactive nav items
const NAV_FONT_SIZE   = 18           // declared but not currently used in JSX (leftover)
const NAV_ICON_SIZE   = 20           // declared but not currently used in JSX (leftover)


// ── NAVIGATION MENU DEFINITION ───────────────────────────────────────────────
// Array drives the sidebar links — add/remove/reorder items here only
const navLinks = [
  { to: '/student/dashboard',    label: 'Dashboard'    },
  { to: '/student/appointments', label: 'Appointments' },
  { to: '/student/profile',      label: 'My Profile'   },
  { to: '/student/visa-status',  label: 'Visa Status'  },
  { to: '/student/documents',    label: 'Documents'    },
  { to: '/student/payments',     label: 'Payments'     },
]
// Note: link.icon is referenced in JSX but not defined here → renders as undefined (nothing shown)


export default function StudentLayout({ children }) {
  // children → whatever page content is passed between <StudentLayout>...</StudentLayout> tags
  //            rendered in the <main> area on the right side

  const navigate = useNavigate()
  const location = useLocation()  // { pathname: '/student/appointments', ... }

  // Read the student's profile from localStorage (cached at login)
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  // '{}' fallback prevents JSON.parse(null) from throwing if nothing is stored


  // ── AVATAR INITIALS ───────────────────────────────────────
  const initials = profile.name
    ? profile.name
        .split(' ')           // "Ram Sharma" → ["Ram", "Sharma"]
        .map(w => w[0])       // → ["R", "S"]
        .join('')             // → "RS"
        .toUpperCase()        // ensure uppercase
        .slice(0, 2)          // max 2 characters (handles middle names)
    : '?'                     // fallback if no name in profile


  // ── LOGOUT ────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()        // invalidate the Supabase session server-side
    localStorage.removeItem('profile')   // clear cached profile so ProtectedRoute blocks access
    navigate('/login')                   // send user back to login page
  }


  // ─────────────────────────────────────────────────────────
  // RENDER
  // Layout is a flex row: fixed sidebar on the left, scrollable main on the right
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',         // always fills the full screen height
      background: '#f9fafb',      // light gray page background (behind both sidebar and content)
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ════════════════════════════════
          SIDEBAR
          Fixed to the left edge — doesn't
          scroll with the page content
          ════════════════════════════════ */}
      <aside style={{
        width: 230,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        position: 'fixed',        // stays in place while content scrolls
        top: 0, left: 0,
        height: '100vh',          // full viewport height
        display: 'flex',
        flexDirection: 'column',  // logo → nav links → user/logout stacked vertically
        padding: '18px 0',
      }}>

        {/* ── LOGO SECTION ──────────────────────────────── */}
        <div style={{
          padding: '18px 16px',
          borderBottom: '1px solid #111722',  // dark divider under the logo
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img
            src="/src/assets/images/logo.png"
            alt="Global Pathway"
            style={{
              width: 70, height: 50, borderRadius: 10,
              objectFit: 'contain',  // keeps aspect ratio without cropping
              flexShrink: 0,         // prevents image from squishing when text is long
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Global Pathway</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>Student Portal</div>
          </div>
        </div>


        {/* ── NAV LINKS ─────────────────────────────────── */}
        {/* flex:1 makes this section grow to fill available space between logo and footer */}
        <div style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {/* overflowY:'auto' → scrollbar appears if many links don't fit the screen */}

          {navLinks.map(link => {
            // Compare current URL to this link's path to determine active state
            const isActive = location.pathname === link.to
            // Uses exact match — /student/dashboard is only active on that exact path

            return (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}  // navigate on click (not <a> tag)
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', borderRadius: 10,
                  border: 'none', textAlign: 'left',
                  fontSize: 16, marginBottom: 32,   // large gap between nav items
                  cursor: 'pointer', fontFamily: 'inherit',

                  // Active vs inactive styling driven by isActive flag
                  background: isActive ? ACTIVE_BG    : 'transparent',
                  color:      isActive ? ACTIVE_TEXT  : INACTIVE_TEXT,
                  fontWeight: isActive ? 600           : 400,
                }}
              >
                {/* Icon slot — link.icon is undefined in navLinks above, so nothing renders here */}
                <span style={{ fontSize: 18 }}>{link.icon}</span>
                {link.label}
              </button>
            )
          })}
        </div>


        {/* ── USER INFO + LOGOUT (pinned to bottom of sidebar) ── */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e5e7eb' }}>

          {/* Avatar row: initials circle + name + email */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>

            {/* Green circle with initials */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {initials}
            </div>

            {/* Name + email — overflow:hidden prevents long text from breaking the layout */}
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: '#111827',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                // ellipsis (...) truncates long names that would overflow the sidebar width
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

          {/* Logout button — red-tinted to signal a destructive action */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '7px 0',
              background: '#fef2f2',           // very light red background
              border: '1px solid #fca5a5',     // soft red border
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              color: '#dc2626',                // red text
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Logout
          </button>
        </div>

      </aside>


      {/* ════════════════════════════════
          PAGE CONTENT AREA
          Sits to the right of the fixed sidebar
          marginLeft matches sidebar width exactly
          ════════════════════════════════ */}
      <main style={{
        flex: 1,
        marginLeft: 230,   // must match sidebar width so content doesn't slide under it
        padding: 28,
      }}>
        {children}
        {/* Whatever is passed between <StudentLayout>...</StudentLayout> renders here */}
      </main>

    </div>
  )
}