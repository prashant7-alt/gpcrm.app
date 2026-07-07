import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, roles }) {
  const raw     = localStorage.getItem('profile')
  const profile = raw ? JSON.parse(raw) : null

  if (!profile) {
    return <Navigate to="/login" replace />
  }

  if (!roles || !roles.includes(profile.role)) {
    const home = {
      admin:            '/dashboard',
      staff:            '/dashboard',
      manager:          '/dashboard',
      counselor:        '/dashboard',
      visa_officer:     '/dashboard',
      finance_officer:  '/dashboard',
      document_handler: '/dashboard',
      receptionist:     '/dashboard',
      marketing:        '/dashboard',
      other:            '/dashboard',
      student:          '/student/dashboard',
    }
    return <Navigate to={home[profile.role] ?? '/login'} replace />
  }

  return children
}