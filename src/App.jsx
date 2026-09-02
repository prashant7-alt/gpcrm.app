import { useState, createContext, useContext, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Navbar         from './components/Navbar/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import theme          from './theme'
import { useIsMobile } from './hooks/useIsMobile'

// Auth pages stay eager — one of them is always the entry point, and they're
// small. Everything else is code-split so a page's JS only downloads when it's
// first opened, instead of shipping the whole CRM in the initial bundle.
import Login          from './pages/auth/login'
import StudentLogin   from './pages/auth/StudentLogin'
import ResetPassword  from './pages/auth/ResetPassword'

const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Applications   = lazy(() => import('./pages/Applications'))
const Students       = lazy(() => import('./pages/Students'))
const Visitors       = lazy(() => import('./pages/Visitors'))
const Payments       = lazy(() => import('./pages/Payments'))
const Staff          = lazy(() => import('./pages/Staff'))
const Documents      = lazy(() => import('./pages/Documents'))
const Reports        = lazy(() => import('./pages/Reports'))
const Appointments   = lazy(() => import('./pages/Appointments'))
const Tasks          = lazy(() => import('./pages/Tasks'))
const Settings       = lazy(() => import('./pages/Settings'))
const StaffChat      = lazy(() => import('./pages/StaffChat'))

const StudentDashboard    = lazy(() => import('./pages/student/StudentDashboard'))
const StudentAppointments = lazy(() => import('./pages/student/StudentAppointments'))
const StudentProfile      = lazy(() => import('./pages/student/StudentProfile'))
const StudentVisaStatus   = lazy(() => import('./pages/student/StudentVisaStatus'))
const StudentDocuments    = lazy(() => import('./pages/student/StudentDocuments'))
const StudentPayments     = lazy(() => import('./pages/student/StudentPayments'))
const StudentChat         = lazy(() => import('./pages/student/StudentChat'))

const EsewaSuccess  = lazy(() => import('./pages/payment/EsewaSuccess'))
const EsewaFailure  = lazy(() => import('./pages/payment/EsewaFailure'))
const KhaltiSuccess = lazy(() => import('./pages/payment/KhaltiSuccess'))

const SIDEBAR_WIDTH = 230

// Shown for the brief moment a code-split page's chunk is downloading.
function RouteFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: theme.pageBg, color: theme.textLight, fontSize: 14,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 26, height: 26, margin: '0 auto 12px',
          border: `3px solid ${theme.border}`, borderTopColor: theme.primary,
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        Loading…
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}

// All non-student roles
const ALL_STAFF = ['admin', 'staff', 'finance_officer', 'document_handler', 'receptionist', 'counselor', 'visa_officer']

// Every staff role EXCEPT admin — Tasks/Appointments/Visitors moved off the
// admin side and now belong to Reception (and Tasks to every staff panel).
const STAFF_NO_ADMIN = ['staff', 'finance_officer', 'document_handler', 'receptionist', 'counselor', 'visa_officer']

// Sidebar open/closed state lives ABOVE <Routes> so it survives navigation.
// (Each route renders its own <Layout>, so keeping the state inside Layout
//  made the sidebar reset to closed on every page change.)
const MenuContext = createContext(null)

function MenuProvider({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <MenuContext.Provider value={{ menuOpen, setMenuOpen }}>
      {children}
    </MenuContext.Provider>
  )
}

// Staff layout — passes menuOpen state down to Navbar
function Layout({ children }) {
  const { menuOpen, setMenuOpen } = useContext(MenuContext)
  const isMobile = useIsMobile()

  return (
    <div style={{ background: theme.pageBg, minHeight: '100vh' }}>
      <Navbar menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <main style={{
        marginTop: 64,
        // Desktop: push content when sidebar is open.
        // Mobile: never push — the sidebar overlays on top instead.
        marginLeft: isMobile ? 0 : (menuOpen ? SIDEBAR_WIDTH : 0),
        padding: isMobile ? 12 : 24,
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {children}
      </main>
    </div>
  )
}

// Staff route — wraps ProtectedRoute + Layout
function StaffRoute({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

// Student route — no sidebar layout
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
      <MenuProvider>
      <Suspense fallback={<RouteFallback />}>
      <Routes>

        {/* ── Public ── */}
        {/* Root + unknown paths land on the student sign-in. Staff get there
            via the "Continue as employee" link, which goes to /staff-login;
            the old /team-portal-x7k2f9 path is kept as an alias so existing
            bookmarks and ProtectedRoute.jsx keep working. */}
        <Route path="/"      element={<StudentLogin />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/staff-login" element={<Login />} />
        <Route path="/team-portal-x7k2f9" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ── Payment callbacks — NO auth wrapper ── */}
        {/* eSewa sends to /payment/success (matches success_url in StudentPayments.jsx) */}
        <Route path="/payment/success"        element={<EsewaSuccess  />} />
        <Route path="/payment/failure"        element={<EsewaFailure  />} />
        {/* keeping /payment/esewa-success as alias in case anything links to it */}
        <Route path="/payment/esewa-success"  element={<EsewaSuccess  />} />
        <Route path="/payment/esewa-failure"  element={<EsewaFailure  />} />
        {/* Khalti sends to /payment/khalti-success (matches return_url in StudentPayments.jsx) */}
        <Route path="/payment/khalti-success" element={<KhaltiSuccess />} />

        {/* ── Overview — all staff ── */}
        <Route path="/dashboard" element={
          <StaffRoute roles={ALL_STAFF}><Dashboard /></StaffRoute>
        } />

        {/* ── Pipeline — admin, staff, receptionist ── */}
        <Route path="/applications" element={
          <StaffRoute roles={['admin', 'staff', 'receptionist', 'visa_officer']}><Applications /></StaffRoute>
        } />
        <Route path="/students" element={
          <StaffRoute roles={['admin', 'staff', 'receptionist', 'finance_officer', 'counselor', 'visa_officer']}><Students /></StaffRoute>
        } />
        <Route path="/visitors" element={
          <StaffRoute roles={['staff', 'receptionist']}><Visitors /></StaffRoute>
        } />

        {/* ── Operations — Reception + staff panels, not admin ── */}
        <Route path="/appointments" element={
          <StaffRoute roles={STAFF_NO_ADMIN}><Appointments /></StaffRoute>
        } />
        <Route path="/tasks" element={
          <StaffRoute roles={STAFF_NO_ADMIN}><Tasks /></StaffRoute>
        } />

        {/* ── Finance ── */}
        <Route path="/payments" element={
          <StaffRoute roles={['admin', 'staff', 'finance_officer']}><Payments /></StaffRoute>
        } />
        <Route path="/reports" element={
          <StaffRoute roles={['admin', 'staff', 'finance_officer']}><Reports /></StaffRoute>
        } />

        {/* ── Documents ── */}
        <Route path="/documents" element={
          <StaffRoute roles={['admin', 'staff', 'document_handler', 'visa_officer']}><Documents /></StaffRoute>
        } />

        {/* ── Chat ── */}
        <Route path="/chat" element={
          <StaffRoute roles={['admin', 'staff', 'document_handler', 'finance_officer', 'receptionist', 'counselor', 'visa_officer']}><StaffChat /></StaffRoute>
        } />

        {/* ── Admin only ── */}
        <Route path="/staff" element={
          <StaffRoute roles={['admin']}><Staff /></StaffRoute>
        } />
        <Route path="/settings" element={
          <StaffRoute roles={['admin']}><Settings /></StaffRoute>
        } />

        {/* ── Student routes ── */}
        <Route path="/student/dashboard"    element={<StudentRoute><StudentDashboard    /></StudentRoute>} />
        <Route path="/student/appointments" element={<StudentRoute><StudentAppointments /></StudentRoute>} />
        <Route path="/student/profile"      element={<StudentRoute><StudentProfile      /></StudentRoute>} />
        <Route path="/student/visa-status"  element={<StudentRoute><StudentVisaStatus   /></StudentRoute>} />
        <Route path="/student/documents"    element={<StudentRoute><StudentDocuments    /></StudentRoute>} />
        <Route path="/student/payments"     element={<StudentRoute><StudentPayments     /></StudentRoute>} />
        <Route path="/student/chat"         element={<StudentRoute><StudentChat         /></StudentRoute>} />

        {/* ── 404 ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
      </Suspense>
      </MenuProvider>
    </BrowserRouter>
  )
}