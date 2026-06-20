import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// layout components (admin side)
import Navbar  from './components/Navbar/Navbar'

// auth page — note lowercase 'login' to match the actual filename
import Login from './pages/auth/login'

// student portal pages — each one already includes StudentLayout internally
import StudentDashboard    from './pages/student/StudentDashboard'
import StudentAppointments from './pages/student/StudentAppointments'
import StudentProfile      from './pages/student/StudentProfile'
import StudentVisaStatus   from './pages/student/StudentVisaStatus'
import StudentDocuments    from './pages/student/StudentDocuments'
import StudentPayments     from './pages/student/StudentPayments'

// admin pages
import Dashboard    from './pages/Dashboard'
import Applications from './pages/Applications'
import Students     from './pages/Students'
import Visitors     from './pages/Visitors'
import Payments     from './pages/Payments'
import Staff        from './pages/Staff'
import Documents    from './pages/Documents'
import Reports      from './pages/Reports'
import Appointments from './pages/Appointments'
import Tasks        from './pages/Tasks'
import Settings     from './pages/Settings'

// keep this in sync with SIDEBAR_WIDTH in Navbar.jsx
const SIDEBAR_WIDTH = 230

// ─────────────────────────────────────────────────────────────────────────────
// Admin layout — navbar + push sidebar (content shifts right, no overlay)
// ─────────────────────────────────────────────────────────────────────────────
function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main style={{
        marginTop: 64,
        marginLeft: menuOpen ? SIDEBAR_WIDTH : 0,
        padding: 24,
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {children}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminRoute — only lets admin role through, otherwise redirect
// ─────────────────────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/student/dashboard" replace />
  return children
}

// ─────────────────────────────────────────────────────────────────────────────
// StudentRoute — only lets student role through, otherwise redirect
// ─────────────────────────────────────────────────────────────────────────────
function StudentRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/dashboard" replace />
  return children
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* public login page */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ── student routes — each page brings its own sidebar layout ── */}
        <Route path="/student/dashboard" element={
          <StudentRoute><StudentDashboard /></StudentRoute>
        } />
        <Route path="/student/appointments" element={
          <StudentRoute><StudentAppointments /></StudentRoute>
        } />
        <Route path="/student/profile" element={
          <StudentRoute><StudentProfile /></StudentRoute>
        } />
        <Route path="/student/visa-status" element={
          <StudentRoute><StudentVisaStatus /></StudentRoute>
        } />
        <Route path="/student/documents" element={
          <StudentRoute><StudentDocuments /></StudentRoute>
        } />
        <Route path="/student/payments" element={
          <StudentRoute><StudentPayments /></StudentRoute>
        } />

        {/* ── admin routes — wrapped in shared Layout (navbar + push sidebar) ── */}
        <Route path="/dashboard" element={
          <AdminRoute><Layout><Dashboard /></Layout></AdminRoute>
        } />
        <Route path="/applications" element={
          <AdminRoute><Layout><Applications /></Layout></AdminRoute>
        } />
        <Route path="/students" element={
          <AdminRoute><Layout><Students /></Layout></AdminRoute>
        } />
        <Route path="/visitors" element={
          <AdminRoute><Layout><Visitors /></Layout></AdminRoute>
        } />
        <Route path="/payments" element={
          <AdminRoute><Layout><Payments /></Layout></AdminRoute>
        } />
        <Route path="/staff" element={
          <AdminRoute><Layout><Staff /></Layout></AdminRoute>
        } />
        <Route path="/documents" element={
          <AdminRoute><Layout><Documents /></Layout></AdminRoute>
        } />
        <Route path="/reports" element={
          <AdminRoute><Layout><Reports /></Layout></AdminRoute>
        } />
        <Route path="/appointments" element={
          <AdminRoute><Layout><Appointments /></Layout></AdminRoute>
        } />
        <Route path="/tasks" element={
          <AdminRoute><Layout><Tasks /></Layout></AdminRoute>
        } />
        <Route path="/settings" element={
          <AdminRoute><Layout><Settings /></Layout></AdminRoute>
        } />

        {/* unknown routes go back to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}