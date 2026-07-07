import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

const STAGES = [
  { key: 'New',            label: 'Application Received', icon: '📋', desc: 'Your application has been received by Global Pathway.' },
  { key: 'Inquiring',      label: 'Initial Inquiry',       icon: '📞', desc: 'Our team has reviewed your inquiry and will contact you shortly.' },
  { key: 'Counseling',     label: 'Counseling Session',    icon: '🧑‍💼', desc: 'You have had a counseling session with our advisor.' },
  { key: 'Documentation',  label: 'Document Collection',   icon: '📁', desc: 'Your documents are being collected and verified.' },
  { key: 'Applied',        label: 'University Applied',    icon: '🎓', desc: 'Your university application has been submitted.' },
  { key: 'Visa Process',   label: 'Visa Processing',       icon: '🛂', desc: 'Your visa application is being processed.' },
  { key: 'Class/Enrolled', label: 'Enrolled',              icon: '📚', desc: 'You have been enrolled in your program.' },
  { key: 'Abroad',         label: 'Departed Abroad',       icon: '✈️', desc: 'Congratulations! You have successfully departed.' },
]

export default function StudentVisaStatus() {

  const navigate = useNavigate()

  // ✅ FIX: profile is now state, loaded safely inside useEffect
  const [profile,   setProfile]  = useState(null)
  const [applicant, setApplicant] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)

  // ✅ Step 1: Load profile from localStorage safely
  useEffect(() => {
    const stored = localStorage.getItem('profile')
    if (!stored) {
      navigate('/login')
      return
    }
    const parsed = JSON.parse(stored)
    if (!parsed?.id) {
      navigate('/login')
      return
    }
    setProfile(parsed)
  }, [])

  // ✅ Step 2: Only runs after profile is ready
  useEffect(() => {
    if (!profile) return

    load()

    // Realtime — when admin changes stage it auto updates
    const channel = supabase
      .channel('visa-pipeline-' + profile.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'applicants',
      }, (payload) => {
        if (
          String(payload.new.id)    === String(profile.applicant_id) ||
          payload.new.email?.toLowerCase() === profile.email?.toLowerCase()
        ) {
          setApplicant(prev => ({ ...prev, ...payload.new }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile]) // ← depends on profile being set

  async function load() {
    setLoading(true)
    setLoadError(null)

    let data = null
    const errors = []

    // Method 1 — use applicant_id
    if (profile.applicant_id != null && profile.applicant_id !== '') {
      const idNum = parseInt(profile.applicant_id, 10)
      if (!Number.isNaN(idNum)) {
        const { data: d, error } = await supabase
          .from('applicants')
          .select('*')
          .eq('id', idNum)
          .maybeSingle()
        if (error) errors.push(['applicant_id lookup', error])
        data = d
      } else {
        console.warn('[VisaStatus] profile.applicant_id is not numeric:', profile.applicant_id)
      }
    }

    // Method 2 — email match fallback
    if (!data && profile.email) {
      const { data: d, error } = await supabase
        .from('applicants')
        .select('*')
        .ilike('email', profile.email.trim())
        .maybeSingle()
      if (error) errors.push(['email lookup', error])
      data = d
    }

    // Method 3 — name match fallback
    if (!data && profile.name) {
      const { data: d, error } = await supabase
        .from('applicants')
        .select('*')
        .ilike('name', profile.name.trim())
        .maybeSingle()
      if (error) errors.push(['name lookup', error])
      data = d
    }

    if (errors.length) {
      errors.forEach(([label, err]) => console.error(`[VisaStatus] ${label} failed:`, err))
      setLoadError(errors[errors.length - 1][1]?.message || 'Failed to load your application.')
    }

    console.log('[VisaStatus] profile from localStorage:', profile)
    console.log('[VisaStatus] resolved applicant row:', data)

    setApplicant(data || null)
    setLoading(false)
  }

  // ✅ Guard: don't render anything until profile is confirmed
  if (!profile) return null

  const activeIndex = applicant
    ? Math.max(0, STAGES.findIndex(s => s.key === applicant.status))
    : 0

  return (
    <StudentLayout>
      <div style={{ maxWidth: 700 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Visa Pipeline
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Track your application progress in real time
          </p>
        </div>

        {loading && (
          <p style={{ color: '#6b7280', fontSize: 13 }}>Loading your status...</p>
        )}

        {!loading && loadError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 12, padding: 24, marginBottom: 16,
            fontSize: 13, color: '#991b1b',
          }}>
            <strong>Couldn't load your application:</strong> {loadError}
            <div style={{ marginTop: 6, color: '#b91c1c' }}>
              This is usually a database permissions (RLS) issue, not a bug in the page itself.
              Check the browser console for details.
            </div>
          </div>
        )}

        {!loading && !applicant && !loadError && (
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 12, padding: 60, textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
              No application found
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              Your account is not linked to any application yet.
              Please contact Global Pathway to get started.
            </div>
          </div>
        )}

        {!loading && applicant && (
          <>
            {/* Current status banner */}
            <div style={{
              background: activeIndex === STAGES.length - 1 ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${activeIndex === STAGES.length - 1 ? '#bbf7d0' : '#bfdbfe'}`,
              borderRadius: 12, padding: '16px 20px', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ fontSize: 36 }}>{STAGES[activeIndex]?.icon}</div>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: activeIndex === STAGES.length - 1 ? '#15803d' : '#1d4ed8',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                }}>
                  Current Status
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
                  {STAGES[activeIndex]?.label}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                  {STAGES[activeIndex]?.desc}
                </div>
              </div>
            </div>

            {/* Vertical pipeline steps */}
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 12, padding: '24px 28px',
            }}>
              {STAGES.map((stage, i) => {
                const isDone    = i < activeIndex
                const isActive  = i === activeIndex
                const isPending = i > activeIndex
                return (
                  <div key={stage.key} style={{ display: 'flex', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0, zIndex: 1,
                        background: isDone ? '#dcfce7' : isActive ? '#dbeafe' : '#f3f4f6',
                        border: `2px solid ${isDone ? '#16a34a' : isActive ? '#2563eb' : '#e5e7eb'}`,
                      }}>
                        {isDone ? '✅' : stage.icon}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 24,
                          background: isDone ? '#16a34a' : '#e5e7eb',
                          margin: '4px 0',
                        }} />
                      )}
                    </div>
                    <div style={{
                      paddingBottom: i < STAGES.length - 1 ? 20 : 0,
                      paddingTop: 8, flex: 1,
                    }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 500,
                        color: isDone ? '#15803d' : isActive ? '#1d4ed8' : '#9ca3af',
                        marginBottom: 3,
                      }}>
                        {stage.label}
                        {isDone && (
                          <span style={{
                            marginLeft: 8, fontSize: 11,
                            background: '#dcfce7', color: '#15803d',
                            padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                          }}>Completed</span>
                        )}
                        {isActive && (
                          <span style={{
                            marginLeft: 8, fontSize: 11,
                            background: '#dbeafe', color: '#1d4ed8',
                            padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                          }}>Current</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: isPending ? '#d1d5db' : '#6b7280' }}>
                        {stage.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Applicant details */}
            <div style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 12, padding: '16px 20px', marginTop: 16,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
              }}>
                Your Application Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Name',    value: applicant.name    },
                  { label: 'Course',  value: applicant.course  },
                  { label: 'Country', value: applicant.country },
                  { label: 'Email',   value: applicant.email   },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                    <span style={{ width: 70, color: '#6b7280', fontWeight: 600, flexShrink: 0 }}>
                      {row.label}
                    </span>
                    <span style={{ color: '#111827' }}>{row.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 8, fontSize: 12, color: '#92400e',
            }}>
              ⚡ This page updates automatically when your advisor changes your status.
            </div>
          </>
        )}
      </div>
    </StudentLayout>
  )
}