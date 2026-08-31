import { useNavigate } from 'react-router-dom'
import { GraduationCap, Users, ArrowRight } from 'lucide-react'
import theme from '../../theme'
import { useIsMobile } from '../../hooks/useIsMobile'

// Landing page: pick which portal to sign in to.
// "Employee" covers every staff role including admin — there is no separate
// admin sign-in.
export default function LoginChooser() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const CHOICES = [
    {
      key: 'student',
      Icon: GraduationCap,
      label: 'Student',
      sub: 'Track your application, upload documents, book appointments and pay fees.',
      to: '/student-login',
    },
    {
      key: 'employee',
      Icon: Users,
      label: 'Employee',
      sub: 'Staff & admin portal — manage applicants, students, payments and reports.',
      to: '/staff-login',
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '32px 18px' : 48,
      fontFamily: "'Segoe UI', Arial, sans-serif",
      background: `radial-gradient(1200px 600px at 50% -10%, ${theme.palette?.blueSoft || theme.accentLight} 0%, ${theme.pageBg} 55%)`,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* brand lockup */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', marginBottom: isMobile ? 28 : 36,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: theme.navy,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <GraduationCap size={28} color={theme.white} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textStrong, letterSpacing: '-0.3px' }}>
            Global Pathway
          </div>
          <div style={{ fontSize: 13.5, color: theme.textLight, marginTop: 4 }}>
            Choose how you want to sign in
          </div>
        </div>

        {/* choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CHOICES.map(({ key, Icon, label, sub, to }) => (
            <button
              key={key}
              onClick={() => navigate(to)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                width: '100%', textAlign: 'left',
                padding: isMobile ? '16px 16px' : '18px 20px',
                background: theme.navy,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                cursor: 'pointer', fontFamily: 'inherit',
                color: theme.white,
                transition: 'transform 0.12s ease, box-shadow 0.12s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 10px 28px rgba(11,31,51,0.28)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={22} color={theme.white} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.2px' }}>
                  Continue as{' '}
                  <span style={{
                    paddingBottom: 3,
                    backgroundImage: 'linear-gradient(90deg,#3b82f6,#a855f7,#ec4899)',
                    backgroundSize: '100% 2px',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: '0 100%',
                  }}>
                    {label}
                  </span>
                </div>
                <div style={{
                  fontSize: 12.5, color: 'rgba(255,255,255,0.62)',
                  marginTop: 4, lineHeight: 1.5,
                }}>
                  {sub}
                </div>
              </div>

              <ArrowRight size={18} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <div style={{
          textAlign: 'center', marginTop: 26,
          fontSize: 12, color: theme.textMuted,
        }}>
          © 2026 Global Pathway Consultancy
        </div>

      </div>
    </div>
  )
}
