import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Navbar  from './components/Navbar/Navbar'

import Login from './pages/auth/login'

import StudentDashboard    from './pages/student/StudentDashboard'
import StudentAppointments from './pages/student/StudentAppointments'
import StudentProfile      from './pages/student/StudentProfile'
import StudentVisaStatus   from './pages/student/StudentVisaStatus'
import StudentDocuments    from './pages/student/StudentDocuments'
import StudentPayments     from './pages/student/StudentPayments'
import StudentChat         from './pages/student/StudentChat'

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
import StaffChat    from './pages/StaffChat'

// eSewa payment redirect pages — public, no auth wrapper
import EsewaSuccess from './pages/payment/EsewaSuccess'
import EsewaFailure from './pages/payment/EsewaFailure'

const SIDEBAR_WIDTH = 230

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

// Admin only
function AdminRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/login" replace />
  return children
}

// Admin + Staff
function AdminOrStaffRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role === 'student') return <Navigate to="/student/dashboard" replace />
  if (profile.role !== 'admin' && profile.role !== 'staff') return <Navigate to="/login" replace />
  return children
}

// Staff only — admin cannot access
function StaffOnlyRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role !== 'staff') return <Navigate to="/dashboard" replace />
  return children
}

// Student only
function StudentRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role === 'admin' || profile.role === 'staff') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* public */}
        <Route path="/login" element={<Login />} />
        <Route path="/"      element={<Navigate to="/login" replace />} />

        {/* eSewa redirect pages — public, no role check */}
        <Route path="/payment/success" element={<EsewaSuccess />} />
        <Route path="/payment/failure" element={<EsewaFailure />} />

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
        <Route path="/student/chat" element={
          <StudentRoute><StudentChat /></StudentRoute>
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

        {/* ── staff only route ── */}
        <Route path="/chat" element={
          <StaffOnlyRoute><Layout><StaffChat /></Layout></StaffOnlyRoute>
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