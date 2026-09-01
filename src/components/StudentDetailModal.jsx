import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import theme from '../theme'
import { statusChip } from '../lib/statusColors'
import { STAGE_ORDER } from '../lib/pipelineStages'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  X, Mail, Phone, Globe2, GraduationCap, CalendarDays, CreditCard,
  FolderOpen, CheckCircle2, Clock, IdCard, ExternalLink, Check,
} from 'lucide-react'

// Statuses the admin can set that aren't part of the linear pipeline.
const SPECIAL_STAGES = ['Pending', 'Approved', 'Rejected', 'Lead']

const initials = (name) =>
  (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

const money = (n) => 'Rs ' + Number(n || 0).toLocaleString()

const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString()
}

// A soft status pill used across the sections.
function Pill({ value }) {
  const c = statusChip(value)
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function SectionCard({ icon: Icon, title, right, children }) {
  return (
    <div style={{
      background: theme.cardBg, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <Icon size={15} color={theme.primary} strokeWidth={2.2} />
        <span style={{
          fontSize: 12, fontWeight: 700, color: theme.textDark,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {title}
        </span>
        <span style={{ marginLeft: 'auto' }}>{right}</span>
      </div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return (
    <div style={{ fontSize: 13, color: theme.textLight, padding: '4px 0' }}>
      {children}
    </div>
  )
}

/**
 * Read-only "everything about this student" panel. Opens from the View button
 * on the Students list. Pulls the applicant's payments, documents and
 * appointments (matched on email, falling back to name) plus their linked
 * login profile, and shows where they sit in the pipeline.
 */
export default function StudentDetailModal({ student, onClose }) {
  const isMobile = useIsMobile()

  const [loading, setLoading]           = useState(true)
  const [payments, setPayments]         = useState([])
  const [documents, setDocuments]       = useState([])
  const [appointments, setAppointments] = useState([])
  const [loginProfile, setLoginProfile] = useState(null)

  const email = (student?.email || '').trim()
  const name  = (student?.name || '').trim()

  // Keep the latest onClose reachable from the mount-once keydown handler.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!student) return
    let cancelled = false

    async function loadAll() {
      setLoading(true)

      // Match on email when we have one, otherwise fall back to name. These
      // tables only store loose text, not a real FK to `applicants`.
      const orFilter = [
        email && `student_email.ilike.${email}`,
        name  && `student_name.ilike.${name}`,
      ].filter(Boolean).join(',')

      const [pay, docs, appts, prof] = await Promise.all([
        orFilter
          ? supabase.from('payments').select('*').or(orFilter).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        email
          ? supabase.from('student_documents').select('*').ilike('student_email', email)
          : Promise.resolve({ data: [] }),
        orFilter
          ? supabase.from('appointments').select('*').or(orFilter).order('date', { ascending: false })
          : Promise.resolve({ data: [] }),
        student.id != null
          ? supabase.from('profiles').select('id, email, avatar_url, role, applicant_id').eq('applicant_id', student.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (cancelled) return
      // Hide unfinished gateway checkouts (see Payments.jsx).
      setPayments((pay.data || []).filter(p => p.status !== 'awaiting_payment'))
      setDocuments(docs.data || [])
      setAppointments(appts.data || [])
      setLoginProfile(prof.data || null)
      setLoading(false)
    }

    loadAll()
    return () => { cancelled = true }
  }, [student, email, name])

  // Lock body scroll while open + close on Escape. Runs once per mount — the
  // parent unmounts this component on close, so mount/unmount == open/close.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const totals = useMemo(() => {
    const paid = payments
      .filter(p => statusChip(p.status).tone === 'success')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const pending = payments
      .filter(p => ['warning', 'info'].includes(statusChip(p.status).tone))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return { paid, pending, count: payments.length }
  }, [payments])

  if (!student) return null

  const stage        = student.status || 'New'
  const isSpecial    = SPECIAL_STAGES.includes(stage)
  const activeIndex  = STAGE_ORDER.indexOf(stage)
  const stageChip    = statusChip(stage)

  const avatarUrl = loginProfile?.avatar_url || student.avatar_url || null

  const contactRows = [
    { Icon: Mail,          label: 'Email',   value: student.email },
    { Icon: Phone,         label: 'Phone',   value: student.phone },
    { Icon: Globe2,        label: 'Country', value: student.country },
    { Icon: GraduationCap, label: 'Course',  value: student.course },
    { Icon: CalendarDays,  label: 'Added',   value: fmtDate(student.created_at) },
    {
      Icon: IdCard, label: 'Student login',
      value: loginProfile ? `Active (${loginProfile.email || student.email})` : 'Not linked',
    },
  ]

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(11,31,51,0.55)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center', zIndex: 400, padding: isMobile ? 0 : 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: theme.pageBg,
          borderRadius: isMobile ? '16px 16px 0 0' : 16,
          width: isMobile ? '100%' : 640,
          maxWidth: '100%', maxHeight: isMobile ? '92vh' : '88vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,0.28)', overflow: 'hidden',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{
          background: theme.navy, color: theme.textOnDark,
          padding: isMobile ? '18px 18px 20px' : '20px 24px 22px',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.white,
            }}
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingRight: 36 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={student.name}
                style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid rgba(255,255,255,0.25)' }} />
            ) : (
              <div style={{
                width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                background: theme.accent, color: theme.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 18,
              }}>
                {initials(student.name)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: theme.white, lineHeight: 1.25 }}>
                {student.name || '—'}
              </div>
              <div style={{ fontSize: 12.5, color: theme.textOnDarkMuted, marginTop: 3, wordBreak: 'break-all' }}>
                {student.email || 'No email on file'}
              </div>
              <span style={{
                display: 'inline-block', marginTop: 8,
                padding: '3px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: stageChip.bg, color: stageChip.color, border: `1px solid ${stageChip.border}`,
              }}>
                {stageChip.label}
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div style={{ padding: isMobile ? 14 : 18, overflowY: 'auto' }}>

          {/* Contact / application facts */}
          <SectionCard icon={IdCard} title="Student Information">
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px 18px' }}>
              {contactRows.map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                  <row.Icon size={14} color={theme.textLight} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                      {row.label}
                    </div>
                    <div style={{ fontSize: 13, color: theme.textMid, wordBreak: 'break-word' }}>
                      {row.value || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Fee status */}
          <SectionCard
            icon={CreditCard}
            title="Fees & Payments"
            right={<span style={{ fontSize: 11, color: theme.textLight }}>{totals.count} record{totals.count === 1 ? '' : 's'}</span>}
          >
            <div style={{ display: 'flex', gap: 10, marginBottom: payments.length ? 12 : 0, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120, background: theme.status.success.bg, border: `1px solid ${theme.status.success.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.status.success.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: theme.status.success.text }}>{money(totals.paid)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 120, background: theme.status.warning.bg, border: `1px solid ${theme.status.warning.border}`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.status.warning.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outstanding</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: theme.status.warning.text }}>{money(totals.pending)}</div>
              </div>
            </div>

            {loading && <Empty>Loading…</Empty>}
            {!loading && payments.length === 0 && <Empty>No payments recorded for this student.</Empty>}
            {!loading && payments.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0', borderTop: `1px solid ${theme.border}`,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDark }}>{p.type || 'Payment'}</div>
                  <div style={{ fontSize: 11.5, color: theme.textLight }}>
                    {(p.method || '—')} · {fmtDate(p.created_at || p.date)}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textDark }}>{money(p.amount)}</div>
                <Pill value={p.status} />
              </div>
            ))}
          </SectionCard>

          {/* Pipeline */}
          <SectionCard icon={CheckCircle2} title="Pipeline Progress">
            {isSpecial ? (
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: stageChip.bg, border: `1px solid ${stageChip.border}`,
                fontSize: 13, color: stageChip.color, fontWeight: 600,
              }}>
                Status is set to “{stageChip.label}” — outside the standard pipeline.
              </div>
            ) : (
              <div>
                {STAGE_ORDER.map((s, i) => {
                  const done    = activeIndex > i
                  const current = activeIndex === i
                  const color   = done ? theme.status.success.main : current ? theme.primary : theme.textMuted
                  return (
                    <div key={s} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: done ? theme.status.success.bg : current ? theme.primaryLight : theme.pageBg,
                          border: `2px solid ${color}`,
                        }}>
                          {done
                            ? <Check size={14} color={theme.status.success.main} strokeWidth={3} />
                            : <span style={{ fontSize: 11, fontWeight: 700, color }}>{i + 1}</span>}
                        </div>
                        {i < STAGE_ORDER.length - 1 && (
                          <div style={{ width: 2, flex: 1, minHeight: 16, background: done ? theme.status.success.main : theme.border, margin: '3px 0' }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: i < STAGE_ORDER.length - 1 ? 12 : 0, paddingTop: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: current ? 700 : 500, color: done ? theme.status.success.text : current ? theme.primary : theme.textLight }}>
                          {s}
                        </div>
                        {current && (
                          <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>Current stage</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {/* Documents */}
          <SectionCard
            icon={FolderOpen}
            title="Documents"
            right={<span style={{ fontSize: 11, color: theme.textLight }}>{documents.length} total</span>}
          >
            {loading && <Empty>Loading…</Empty>}
            {!loading && documents.length === 0 && <Empty>No documents on file.</Empty>}
            {!loading && documents.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0', borderTop: `1px solid ${theme.border}`,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDark }}>{d.doc_type || 'Document'}</div>
                  <div style={{ fontSize: 11.5, color: theme.textLight }}>Updated {fmtDate(d.updated_at)}</div>
                </div>
                {d.file_url ? (
                  <a href={d.file_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: theme.primary, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                    Open <ExternalLink size={12} />
                  </a>
                ) : null}
                <Pill value={d.status} />
              </div>
            ))}
          </SectionCard>

          {/* Appointments */}
          <SectionCard
            icon={CalendarDays}
            title="Appointments"
            right={<span style={{ fontSize: 11, color: theme.textLight }}>{appointments.length} total</span>}
          >
            {loading && <Empty>Loading…</Empty>}
            {!loading && appointments.length === 0 && <Empty>No appointments booked.</Empty>}
            {!loading && appointments.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 0', borderTop: `1px solid ${theme.border}`,
              }}>
                <Clock size={14} color={theme.textLight} style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDark }}>{a.type || 'Appointment'}</div>
                  <div style={{ fontSize: 11.5, color: theme.textLight }}>{fmtDate(a.date)} {a.time ? `· ${a.time}` : ''}</div>
                </div>
                <Pill value={a.status} />
              </div>
            ))}
          </SectionCard>

        </div>
      </div>
    </div>,
    document.body,
  )
}
