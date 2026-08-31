import { useState, useEffect } from 'react'
import theme from '../../theme'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  ClipboardList,
  Phone,
  UserRound,
  FolderOpen,
  GraduationCap,
  Plane,
  BookOpen,
  PlaneTakeoff,
  Clock,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react'

const STAGES = [
  { key: 'New',            label: 'Application Received', Icon: ClipboardList, desc: 'Your application has been received by Global Pathway.' },
  { key: 'Inquiring',      label: 'Initial Inquiry',       Icon: Phone,         desc: 'Our team has reviewed your inquiry and will contact you shortly.' },
  { key: 'Counseling',     label: 'Counseling Session',    Icon: UserRound,     desc: 'You have had a counseling session with our advisor.' },
  { key: 'Documentation',  label: 'Document Collection',   Icon: FolderOpen,    desc: 'Your documents are being collected and verified.' },
  { key: 'Applied',        label: 'University Applied',    Icon: GraduationCap, desc: 'Your university application has been submitted.' },
  { key: 'Visa Process',   label: 'Visa Processing',       Icon: Plane,         desc: 'Your visa application is being processed.' },
  { key: 'Class/Enrolled', label: 'Enrolled',              Icon: BookOpen,      desc: 'You have been enrolled in your program.' },
  { key: 'Abroad',         label: 'Departed Abroad',       Icon: PlaneTakeoff,  desc: 'Congratulations! You have successfully departed.' },
]

// Statuses from the admin dropdown that aren't part of the linear pipeline —
// shown as a dedicated banner instead of a pipeline position.
const SPECIAL_STATUSES = {
  Pending: {
    Icon: Clock,
    title: 'Pending Review',
    desc: 'Your application is under review. We will update you as soon as a decision is made.',
    bg: theme.status.warning.bg, border: theme.status.warning.border, labelColor: theme.status.warning.text, textColor: theme.status.warning.text, iconColor: theme.status.warning.text,
  },
  Approved: {
    Icon: CheckCircle2,
    title: 'Approved',
    desc: 'Great news — your application has been approved! Our team will reach out with next steps.',
    bg: theme.status.success.bg, border: theme.status.success.border, labelColor: theme.status.success.text, textColor: theme.status.success.text, iconColor: theme.status.success.text,
  },
  Rejected: {
    Icon: XCircle,
    title: 'Application Rejected',
    desc: 'Unfortunately your application was not approved. Please contact Global Pathway to discuss next steps.',
    bg: theme.status.danger.bg, border: theme.status.danger.border, labelColor: theme.status.danger.text, textColor: theme.status.danger.text, iconColor: theme.status.danger.text,
  },
}

export default function StudentVisaStatus() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  const [profile,   setProfile]   = useState(null)
  const [applicant, setApplicant] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Step 1 — load profile from localStorage safely
  useEffect(() => {
    const stored = localStorage.getItem('profile')
    if (!stored) {
      navigate('/student-login')
      return
    }
    const parsed = JSON.parse(stored)
    if (!parsed?.id) {
      navigate('/student-login')
      return
    }
    setProfile(parsed)
  }, [])

  // Step 2 — only runs after profile is ready
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
          String(payload.new.id) === String(profile.applicant_id) ||
          payload.new.email?.toLowerCase() === profile.email?.toLowerCase()
        ) {
          setApplicant(prev => ({ ...prev, ...payload.new }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  async function load() {
    setLoading(true)
    setLoadError(null)

    let data = null
    const errors = []

    // Method 1 — use applicant_id (most reliable, always prefer this)
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

    // Method 2 — email match fallback (still unique per applicant)
    if (!data && profile.email) {
      const { data: d, error } = await supabase
        .from('applicants')
        .select('*')
        .ilike('email', profile.email.trim())
        .maybeSingle()
      if (error) errors.push(['email lookup', error])
      data = d
    }

    // NOTE: there is intentionally no "Method 3" name-based fallback here.
    // Names are not unique, and matching on name risks showing one student
    // another student's application data. If applicant_id and email both
    // fail to find a record, we correctly show "No application found"
    // below rather than guessing based on name.

    if (errors.length) {
      errors.forEach(([label, err]) => console.error(`[VisaStatus] ${label} failed:`, err))
      setLoadError(errors[errors.length - 1][1]?.message || 'Failed to load your application.')
    }

    setApplicant(data || null)
    setLoading(false)
  }

  // Guard — don't render anything until profile is confirmed
  if (!profile) return null

  const isSpecial   = applicant && SPECIAL_STATUSES[applicant.status]
  const specialInfo = isSpecial ? SPECIAL_STATUSES[applicant.status] : null

  // Only compute a pipeline position when status is an actual pipeline stage
  const stageIndex = applicant ? STAGES.findIndex(s => s.key === applicant.status) : -1
  const activeIndex = stageIndex >= 0 ? stageIndex : 0

  return (
    <StudentLayout>
      <div style={{ maxWidth: 700 }}>

        <div style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textStrong, margin: '0 0 4px' }}>
            Visa Pipeline
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
            Track your application progress in real time
          </p>
        </div>

        {loading && (
          <p style={{ color: theme.textLight, fontSize: 13 }}>Loading your status...</p>
        )}

        {!loading && loadError && (
          <div style={{
            background: theme.status.danger.bg, border: `1px solid ${theme.status.danger.border}`,
            borderRadius: 12, padding: isMobile ? 16 : 24, marginBottom: 16,
            fontSize: 13, color: theme.status.danger.text,
          }}>
            <strong>Couldn't load your application:</strong> {loadError}
            <div style={{ marginTop: 6, color: theme.status.danger.text }}>
              This is usually a database permissions (RLS) issue, not a bug in the page itself.
              Check the browser console for details.
            </div>
          </div>
        )}

        {!loading && !applicant && !loadError && (
          <div style={{
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: isMobile ? '48px 20px' : 60, textAlign: 'center',
          }}>
            <ClipboardList size={44} color={theme.inputBorder} style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, marginBottom: 6 }}>
              No application found
            </div>
            <div style={{ fontSize: 13, color: theme.textLight }}>
              Your account is not linked to any application yet.
              Please contact Global Pathway to get started.
            </div>
          </div>
        )}

        {/* Special status banner — Pending / Approved / Rejected */}
        {!loading && applicant && isSpecial && (
          <div style={{
            background: specialInfo.bg,
            border: `1px solid ${specialInfo.border}`,
            borderRadius: 12,
            padding: isMobile ? '14px 16px' : '16px 20px',
            marginBottom: 20,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            gap: isMobile ? 8 : 14,
          }}>
            <specialInfo.Icon size={isMobile ? 28 : 34} color={specialInfo.iconColor} strokeWidth={1.75} />
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: specialInfo.labelColor,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
              }}>
                Current Status
              </div>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: theme.textStrong }}>
                {specialInfo.title}
              </div>
              <div style={{ fontSize: 13, color: specialInfo.textColor, marginTop: 4 }}>
                {specialInfo.desc}
              </div>
            </div>
          </div>
        )}

        {!loading && applicant && (
          <>
            {/* Pipeline banner — only for statuses that are actual pipeline stages */}
            {!isSpecial && (
              <div style={{
                background: activeIndex === STAGES.length - 1 ? theme.status.success.bg : theme.status.info.bg,
                border: `1px solid ${activeIndex === STAGES.length - 1 ? theme.status.success.border : theme.status.info.border}`,
                borderRadius: 12,
                padding: isMobile ? '14px 16px' : '16px 20px',
                marginBottom: isMobile ? 20 : 28,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? 8 : 14,
              }}>
                {STAGES[activeIndex] && (() => {
                  const ActiveIcon = STAGES[activeIndex].Icon
                  return (
                    <ActiveIcon
                      size={isMobile ? 28 : 34}
                      color={activeIndex === STAGES.length - 1 ? theme.status.success.text : theme.primary}
                      strokeWidth={1.75}
                    />
                  )
                })()}
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: activeIndex === STAGES.length - 1 ? theme.status.success.text : theme.primary,
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                  }}>
                    Current Status
                  </div>
                  <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: theme.textStrong }}>
                    {STAGES[activeIndex]?.label}
                  </div>
                  <div style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
                    {STAGES[activeIndex]?.desc}
                  </div>
                </div>
              </div>
            )}

            {/* Vertical pipeline steps — always shown so students can see the full journey,
                even while in a special (Pending/Approved/Rejected) state */}
            <div style={{
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: isMobile ? '18px 16px' : '24px 28px',
              opacity: isSpecial ? 0.6 : 1,
            }}>
              {isSpecial && (
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16 }}>
                  Pipeline progress will resume once your application moves past the {applicant.status.toLowerCase()} stage.
                </div>
              )}
              {STAGES.map((stage, i) => {
                const isDone    = !isSpecial && i < activeIndex
                const isActive  = !isSpecial && i === activeIndex
                const isPending = isSpecial || i > activeIndex
                const StageIcon = stage.Icon
                return (
                  <div key={stage.key} style={{ display: 'flex', gap: isMobile ? 10 : 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, zIndex: 1,
                        background: isDone ? theme.status.success.bg : isActive ? theme.status.info.bg : theme.surfaceAlt,
                        border: `2px solid ${isDone ? theme.status.success.main : isActive ? theme.primary : theme.border}`,
                      }}>
                        {isDone
                          ? <Check size={isMobile ? 17 : 20} color={theme.status.success.main} strokeWidth={2.5} />
                          : <StageIcon
                              size={isMobile ? 17 : 20}
                              color={isActive ? theme.primary : theme.textMuted}
                              strokeWidth={1.75}
                            />
                        }
                      </div>
                      {i < STAGES.length - 1 && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 24,
                          background: isDone ? theme.status.success.main : theme.border,
                          margin: '4px 0',
                        }} />
                      )}
                    </div>
                    <div style={{
                      paddingBottom: i < STAGES.length - 1 ? 20 : 0,
                      paddingTop: 8, flex: 1, minWidth: 0,
                    }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 500,
                        color: isDone ? theme.status.success.text : isActive ? theme.primary : theme.textMuted,
                        marginBottom: 3,
                      }}>
                        {stage.label}
                        {isDone && (
                          <span style={{
                            marginLeft: 8, fontSize: 11,
                            background: theme.status.success.bg, color: theme.status.success.text,
                            padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                            display: 'inline-block', marginTop: isMobile ? 4 : 0,
                          }}>Completed</span>
                        )}
                        {isActive && (
                          <span style={{
                            marginLeft: 8, fontSize: 11,
                            background: theme.status.info.bg, color: theme.primary,
                            padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                            display: 'inline-block', marginTop: isMobile ? 4 : 0,
                          }}>Current</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: isPending ? theme.inputBorder : theme.textLight }}>
                        {stage.desc}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Applicant details */}
            <div style={{
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: isMobile ? '14px 16px' : '16px 20px', marginTop: 16,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: theme.textMuted,
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
                    <span style={{ width: 70, color: theme.textLight, fontWeight: 600, flexShrink: 0 }}>
                      {row.label}
                    </span>
                    <span style={{ color: theme.textStrong, wordBreak: 'break-word', minWidth: 0 }}>
                      {row.value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: theme.status.warning.bg, border: `1px solid ${theme.status.warning.border}`,
              borderRadius: 8, fontSize: 12, color: theme.status.warning.text,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Clock size={14} color={theme.status.warning.text} strokeWidth={2} />
              This page updates automatically when your advisor changes your status.
            </div>
          </>
        )}
      </div>
    </StudentLayout>
  )
}