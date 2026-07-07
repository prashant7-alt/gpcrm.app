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
import StudentVisaStatus   from './pages/student/StudentVisaStatus'

import EsewaSuccess        from './pages/payment/EsewaSuccess'
import EsewaFailure        from './pages/payment/EsewaFailure'

const SIDEBAR_WIDTH = 230
const ALL_STAFF = ['admin', 'staff', 'finance_officer', 'document_handler', 'receptionist']

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/"      element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Payment callbacks */}
        <Route path="/payment/esewa-success" element={<EsewaSuccess />} />
        <Route path="/payment/esewa-failure" element={<EsewaFailure />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<StaffRoute roles={ALL_STAFF}><Dashboard /></StaffRoute>} />

        {/* Pipeline */}
        <Route path="/applications" element={<StaffRoute roles={['admin','staff','receptionist']}><Applications /></StaffRoute>} />
        <Route path="/students"     element={<StaffRoute roles={['admin','staff','receptionist']}><Students /></StaffRoute>} />
        <Route path="/visitors"     element={<StaffRoute roles={['admin','staff','receptionist']}><Visitors /></StaffRoute>} />

        {/* Operations */}
        <Route path="/appointments" element={<StaffRoute roles={['admin','staff']}><Appointments /></StaffRoute>} />
        <Route path="/tasks"        element={<StaffRoute roles={['admin','staff']}><Tasks /></StaffRoute>} />

        {/* Finance */}
        <Route path="/payments" element={<StaffRoute roles={['admin','staff','finance_officer']}><Payments /></StaffRoute>} />
        <Route path="/reports"  element={<StaffRoute roles={['admin','finance_officer']}><Reports /></StaffRoute>} />

        {/* Documents */}
        <Route path="/documents" element={<StaffRoute roles={['admin','staff','document_handler']}><Documents /></StaffRoute>} />

        {/* Chat */}
        <Route path="/chat" element={<StaffRoute roles={['staff','document_handler']}><StaffChat /></StaffRoute>} />

        {/* Admin only */}
        <Route path="/staff"    element={<StaffRoute roles={['admin']}><Staff /></StaffRoute>} />
        <Route path="/settings" element={<StaffRoute roles={['admin']}><Settings /></StaffRoute>} />

        {/* Student routes */}
        <Route path="/student/dashboard"    element={<StudentRoute><StudentDashboard /></StudentRoute>} />
        <Route path="/student/appointments" element={<StudentRoute><StudentAppointments /></StudentRoute>} />
        <Route path="/student/profile"      element={<StudentRoute><StudentProfile /></StudentRoute>} />
        <Route path="/student/payments"     element={<StudentRoute><StudentPayments /></StudentRoute>} />
        <Route path="/student/documents"    element={<StudentRoute><StudentDocuments /></StudentRoute>} />
        <Route path="/student/chat"         element={<StudentRoute><StudentChat /></StudentRoute>} />
        <Route path="/student/visa-status"  element={<StudentRoute><StudentVisaStatus /></StudentRoute>} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}