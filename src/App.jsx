import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Navbar  from './components/Navbar/Navbar'
import Sidebar from './components/Sidebar/Sidebar'

import Login from './pages/auth/login'

import StudentDashboard    from './pages/student/StudentDashboard'
import StudentAppointments from './pages/student/StudentAppointments'
import StudentProfile      from './pages/student/StudentProfile'

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

function Layout({ children }) {
  return (
    <div style={{ display: 'flex', background: '#f9fafb', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: 220 }}>
        <Navbar />
        <main style={{ marginTop: 64, padding: '24px 28px 100px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

function AdminRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role !== 'admin') return <Navigate to="/student/dashboard" replace />
  return children
}

function StudentRoute({ children }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  if (!profile.id) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/student/dashboard" element={
          <StudentRoute><StudentDashboard /></StudentRoute>
        } />
        <Route path="/student/appointments" element={
          <StudentRoute><StudentAppointments /></StudentRoute>
        } />
        <Route path="/student/profile" element={
          <StudentRoute><StudentProfile /></StudentRoute>
        } />

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

        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}