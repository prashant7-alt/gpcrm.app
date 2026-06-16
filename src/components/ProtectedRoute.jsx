import { Navigate } from 'react-router-dom'

// wrap any route with this to block wrong roles
// <ProtectedRoute role="admin">  or  <ProtectedRoute role="student">

export default function ProtectedRoute({ children, role }) {
  const raw     = localStorage.getItem('profile')
  const profile = raw ? JSON.parse(raw) : null

  // not logged in
  if (!profile) {
    return <Navigate to="/login" replace />
  }

  // logged in but wrong role — send to their own home
  if (profile.role !== role) {
    if (profile.role === 'admin')   return <Navigate to="/dashboard"         replace />
    if (profile.role === 'student') return <Navigate to="/student/dashboard" replace />
  }

  return children
}