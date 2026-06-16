import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'

const PAGE_LABELS = {
  dashboard:    'Dashboard',
  applications: 'Applicants',
  students:     'Students',
  visitors:     'Walk-ins',
  appointments: 'Appointments',
  tasks:        'Tasks',
  documents:    'Documents',
  abroad:       'Abroad Section',
  classes:      'Classes & Tests',
  payments:     'Payments',
  staff:        'Staff',
  reports:      'Reports',
  settings:     'Settings',
}

const PAGE_SUB = {
  applications: 'Manage all applicants',
  students:     'Enrolled & studying students',
  visitors:     'Walk-in inquiries',
  appointments: 'Scheduled meetings',
  tasks:        'Pending action items',
  documents:    'File management',
  payments:     'Fees & transactions',
  staff:        'Team members',
  reports:      'Analytics & insights',
  settings:     'System configuration',
}

export default function Navbar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const key       = location.pathname.replace('/', '').toLowerCase()
  const title     = PAGE_LABELS[key]  || 'Dashboard'
  const subtitle  = PAGE_SUB[key]     || ''

  return (
    <header style={{
      height: 64,
      background: '#ffffff',
      borderBottom: '1px solid #e8eaed',
      position: 'fixed',
      top: 0,
      left: 220,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 0,
      zIndex: 50,
    }}>

      {/* page title */}
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* right side */}
      <div style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>

        {/* role badge */}
        <div style={{
          padding: '5px 12px',
          background: '#f3f4f6',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          color: '#374151',
        }}>
          CEO / Founder
        </div>

        {/* bell */}
        <button style={{
          position: 'relative',
          width: 36, height: 36,
          borderRadius: 8,
          background: '#f9fafb',
          border: '1px solid #e8eaed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Bell size={16} strokeWidth={1.8} color="#374151" />
          <span style={{
            position: 'absolute',
            top: 6, right: 6,
            width: 7, height: 7,
            borderRadius: '50%',
            background: '#ef4444',
            border: '1.5px solid #fff',
          }} />
        </button>

        {/* avatar + name stacked */}
        <div
          onClick={() => navigate('/settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 36,
            borderRadius: '50%',
            background: '#1a1f3a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            color: '#fff',
            flexShrink: 0,
          }}>
            BBIS
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>BBIS</div>
            <div style={{ fontSize: 10.5, color: '#9ca3af' }}>Global Pathway</div>
          </div>
        </div>

      </div>
    </header>
  )
}