import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Navbar              from './components/Navbar/Navbar'
import ProtectedRoute      from './components/ProtectedRoute'

import Login               from './pages/auth/login'
import Dashboard           from './pages/Dashboard'
import Applications        from './pages/Applications'
import Students            from './pages/Students'
import Visitors            from './pages/Visitors'
import Payments            from './pages/Payments'
import Staff               from './pages/Staff'
import Documents           from './pages/Documents'
import Tasks               from './pages/Tasks'
import Reports             from './pages/Reports'
import Settings            from './pages/Settings'
import Appointments        from './pages/Appointments'
import StaffChat           from './pages/StaffChat'

import StudentDashboard    from './pages/student/StudentDashboard'
import StudentAppointments from './pages/student/StudentAppointments'
import StudentProfile      from './pages/student/StudentProfile'
import StudentPayments     from './pages/student/StudentPayments'
import StudentDocuments    from './pages/student/StudentDocuments'
import StudentChat         from './pages/student/StudentChat'

import EsewaSuccess        from './pages/payment/EsewaSuccess'
import EsewaFailure        from './pages/payment/EsewaFailure'

const SIDEBAR_WIDTH = 230

// ── Role constants ─────────────────────────────────────────────────────────
const ALL_STAFF = [
  'admin', 'staff', 'manager',
  'counselor', 'visa_officer',
  'finance_officer', 'document_handler',
  'receptionist', 'marketing', 'other',
]

const CAN_SEE_APPLICATIONS = [
  'admin', 'staff', 'manager',
  'visa_officer', 'receptionist', 'marketing',
]

const CAN_SEE_STUDENTS = [
  'admin', 'staff', 'manager',
  'counselor', 'visa_officer', 'document_handler', 'finance_officer',
]

const CAN_SEE_APPOINTMENTS = [
  'admin', 'staff', 'manager',
  'counselor', 'visa_officer', 'receptionist',
]

const CAN_SEE_VISITORS = [
  'admin', 'staff', 'manager', 'receptionist',
]

const CAN_SEE_TASKS = [
  'admin', 'staff', 'manager',
  'counselor', 'visa_officer', 'document_handler',
  'finance_officer', 'receptionist', 'marketing', 'other',
]

const CAN_SEE_PAYMENTS = [
  'admin', 'staff', 'manager', 'finance_officer', 'receptionist',
]

const CAN_SEE_REPORTS = [
  'admin', 'manager', 'finance_officer', 'marketing',
]

const CAN_SEE_DOCUMENTS = [
  'admin', 'staff', 'manager', 'visa_officer', 'document_handler',
]

const CAN_SEE_CHAT = ALL_STAFF

const ADMIN_ONLY = ['admin']

// ── Layout wrapper ─────────────────────────────────────────────────────────
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

function StaffRoute({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

function StudentRoute({ children }) {
  return (
    <ProtectedRoute roles={['student']}>
      {children}
    </ProtectedRoute>
  )
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/"      element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* eSewa callbacks — no auth, eSewa redirects here */}
        <Route path="/payment/success" element={<EsewaSuccess />} />
        <Route path="/payment/failure" element={<EsewaFailure />} />

        {/* Dashboard — every staff role */}
        <Route path="/dashboard" element={
          <StaffRoute roles={ALL_STAFF}><Dashboard /></StaffRoute>
        } />

        {/* Applications */}
        <Route path="/applications" element={
          <StaffRoute roles={CAN_SEE_APPLICATIONS}><Applications /></StaffRoute>
        } />

        {/* Students */}
        <Route path="/students" element={
          <StaffRoute roles={CAN_SEE_STUDENTS}><Students /></StaffRoute>
        } />

        {/* Visitors */}
        <Route path="/visitors" element={
          <StaffRoute roles={CAN_SEE_VISITORS}><Visitors /></StaffRoute>
        } />

        {/* Appointments */}
        <Route path="/appointments" element={
          <StaffRoute roles={CAN_SEE_APPOINTMENTS}><Appointments /></StaffRoute>
        } />

        {/* Tasks — everyone */}
        <Route path="/tasks" element={
          <StaffRoute roles={CAN_SEE_TASKS}><Tasks /></StaffRoute>
        } />

        {/* Payments */}
        <Route path="/payments" element={
          <StaffRoute roles={CAN_SEE_PAYMENTS}><Payments /></StaffRoute>
        } />

        {/* Reports */}
        <Route path="/reports" element={
          <StaffRoute roles={CAN_SEE_REPORTS}><Reports /></StaffRoute>
        } />

        {/* Documents */}
        <Route path="/documents" element={
          <StaffRoute roles={CAN_SEE_DOCUMENTS}><Documents /></StaffRoute>
        } />

        {/* Chat — everyone */}
        <Route path="/chat" element={
          <StaffRoute roles={CAN_SEE_CHAT}><StaffChat /></StaffRoute>
        } />

        {/* Admin only */}
        <Route path="/staff" element={
          <StaffRoute roles={ADMIN_ONLY}><Staff /></StaffRoute>
        } />
        <Route path="/settings" element={
          <StaffRoute roles={ADMIN_ONLY}><Settings /></StaffRoute>
        } />

        {/* Student portal */}
        <Route path="/student/dashboard"    element={<StudentRoute><StudentDashboard /></StudentRoute>} />
        <Route path="/student/appointments" element={<StudentRoute><StudentAppointments /></StudentRoute>} />
        <Route path="/student/profile"      element={<StudentRoute><StudentProfile /></StudentRoute>} />
        <Route path="/student/payments"     element={<StudentRoute><StudentPayments /></StudentRoute>} />
        <Route path="/student/documents"    element={<StudentRoute><StudentDocuments /></StudentRoute>} />
        <Route path="/student/chat"         element={<StudentRoute><StudentChat /></StudentRoute>} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}