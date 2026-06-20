import { Navigate } from 'react-router-dom'
// Navigate → a React Router component that immediately redirects to another route
//            using `replace` means the redirect won't be added to browser history
//            (so the user can't hit Back and return to the blocked page)

// ─────────────────────────────────────────────────────────────
// COMPONENT: ProtectedRoute
//
// A route GUARD — wrap any <Route> element with this to block
// users who aren't logged in or have the wrong role.
//
// Usage in App.jsx:
//   <ProtectedRoute role="admin">    <Dashboard />   </ProtectedRoute>
//   <ProtectedRoute role="student">  <StudentHome />  </ProtectedRoute>
// ─────────────────────────────────────────────────────────────

export default function ProtectedRoute({ children, role }) {
  // children → the actual page component to render if access is granted
  // role     → the role string this route requires, e.g. 'admin' or 'student'

  // Read the profile object that was saved to localStorage at login time
  const raw     = localStorage.getItem('profile')          // returns a JSON string or null
  const profile = raw ? JSON.parse(raw) : null
  // If nothing is stored (never logged in / logged out), profile === null

  // ── GUARD 1: Not logged in ─────────────────────────────
  if (!profile) {
    return <Navigate to="/login" replace />
    // No profile in storage → user is not authenticated → send to login page
  }

  // ── GUARD 2: Logged in but accessing the wrong role's area ─
  if (profile.role !== role) {
    // The user IS authenticated, just in the wrong section of the app
    // Redirect them to their OWN home page instead of showing a blank/error screen

    if (profile.role === 'admin')   return <Navigate to="/dashboard"         replace />
    // Admin trying to visit a student route → send back to the admin dashboard

    if (profile.role === 'student') return <Navigate to="/student/dashboard" replace />
    // Student trying to visit an admin route → send back to the student dashboard
  }

  // ── ACCESS GRANTED ─────────────────────────────────────
  return children
  // Profile exists AND role matches → render the protected page as normal
}