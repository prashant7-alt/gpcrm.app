import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// layout components (admin side)
import Navbar  from './components/Navbar/Navbar'

// auth page
import Login from './pages/auth/login'

// student portal pages
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

const SIDEBAR_WIDTH = 230

// ─────────────────────────────────────────────────────────────────────────────
// Layout — your original layout, untouched
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
// AdminRoute — admin only
// ─────────────────────────────────────────────────────────────────────────────
function AdminRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/login" replace />
  return children
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminOrStaffRoute — both admin and staff can access
// ─────────────────────────────────────────────────────────────────────────────
function AdminOrStaffRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role === 'student') return <Navigate to="/student/dashboard" replace />
  if (profile.role !== 'admin' && profile.role !== 'staff') {
    return <Navigate to="/login" replace />
  }
  return children
}

// ─────────────────────────────────────────────────────────────────────────────
// StudentRoute — student only
// ─────────────────────────────────────────────────────────────────────────────
function StudentRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role === 'admin' || profile.role === 'staff') {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/"      element={<Navigate to="/login" replace />} />

        {/* ── student routes ── */}
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

        {/* ── admin + staff shared routes ── */}
        <Route path="/dashboard" element={
          <AdminOrStaffRoute><Layout><Dashboard /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/applications" element={
          <AdminOrStaffRoute><Layout><Applications /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/students" element={
          <AdminOrStaffRoute><Layout><Students /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/visitors" element={
          <AdminOrStaffRoute><Layout><Visitors /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/payments" element={
          <AdminOrStaffRoute><Layout><Payments /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/documents" element={
          <AdminOrStaffRoute><Layout><Documents /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/appointments" element={
          <AdminOrStaffRoute><Layout><Appointments /></Layout></AdminOrStaffRoute>
        } />
        <Route path="/tasks" element={
          <AdminOrStaffRoute><Layout><Tasks /></Layout></AdminOrStaffRoute>
        } />

        {/* ── admin only routes ── */}
        <Route path="/staff" element={
          <AdminRoute><Layout><Staff /></Layout></AdminRoute>
        } />
        <Route path="/reports" element={
          <AdminRoute><Layout><Reports /></Layout></AdminRoute>
        } />
        <Route path="/settings" element={
          <AdminRoute><Layout><Settings /></Layout></AdminRoute>
        } />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}