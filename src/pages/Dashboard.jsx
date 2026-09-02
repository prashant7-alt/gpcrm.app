// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx
// Main admin dashboard page for Global Pathway CRM.
// Loads data from Supabase and shows stats, pipeline, countries, applicants,
// and pending tasks — all in one scrollable page.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import theme from '../theme'
import { supabase } from '../supabase'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus, useRefreshHold } from '../hooks/useRefetchOnFocus'
import AnnouncementsPanel from '../components/AnnouncementsPanel'

// Lucide icons — lightweight SVG icon library
import {
  Users,        // people / applicants icon
  GraduationCap,// students icon
  PlaneTakeoff, // abroad / travel icon
  CalendarCheck,// appointments icon
  Wallet,       // revenue icon
  TrendingUp,   // visa approvals icon
  Target,       // conversion rate icon
  RefreshCw,    // refresh button icon
  CheckCircle2, // "all clear" empty state
  X,            // modal close
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// C — design tokens (colors used across the whole dashboard)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  pageBg:    theme.pageBg,
  cardBg:    theme.white,
  border:    theme.border,
  textDark:  theme.textStrong,
  textMid:   theme.textMid,
  textLight: theme.textLight,
  textMuted: theme.textMuted,

  green:     theme.status.success.main,
  greenBg:   theme.status.success.bg,
  greenText: theme.status.success.text,
  blue:      theme.primary,
  blueBg:    theme.status.info.bg,
  purple:    theme.purple,
  purpleBg:  theme.purpleLight,
  orange:    theme.status.warning.main,
  orangeBg:  theme.status.warning.bg,
  yellow:    theme.status.warning.text,
  yellowBg:  theme.status.warning.bg,
  red:       theme.status.danger.main,
  redBg:     theme.status.danger.bg,
  teal:      theme.accent,
  tealBg:    theme.accentLight,

  // One distinct, readable colour per pipeline stage — early stages cool,
  // ending on green at "Abroad". (Previously Lead/Inquiring/Counseling/Visa
  // Process all shared the faint input-border grey and barely showed.)
  barColors: {
    'Lead':           theme.status.neutral.main,   // slate — visible, "just entered"
    'Inquiring':      theme.primary,               // blue
    'Counseling':     theme.accent,                // teal
    'Documentation':  theme.status.warning.main,   // amber
    'Applied':        theme.purple,                // purple
    'Visa Process':   theme.pink,                  // pink
    'Class/Enrolled': theme.navy,                  // navy
    'Abroad':         theme.status.success.main,   // green — "made it"
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, iconColor, iconBg, valueColor, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 8,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={onClick ? e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        e.currentTarget.style.borderColor = iconColor || C.border
      } : undefined}
      onMouseLeave={onClick ? e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = C.border
      } : undefined}
    >
      <div style={{
        width: 36, height: 36,
        borderRadius: 10,
        background: iconBg || theme.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={17} color={iconColor || C.textLight} strokeWidth={1.9} />
      </div>

      <span style={{
        fontSize: 11.5,
        color: C.textLight,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </span>

      <div style={{
        fontSize: 22,
        fontWeight: 800,
        color: valueColor || C.textDark,
        lineHeight: 1,
      }}>
        {value}
      </div>

      {sub && (
        <div style={{ fontSize: 11.5, color: C.textMuted }}>{sub}</div>
      )}

      {onClick && !sub && (
        <div style={{ fontSize: 11.5, color: iconColor || C.textMuted, fontWeight: 600 }}>
          View monthly history →
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StageBadge
// ─────────────────────────────────────────────────────────────────────────────
function StageBadge({ stage }) {
  const map = {
    'Lead':           { bg: theme.surfaceAlt, color: theme.textLight },
    'Inquiring':      { bg: theme.status.info.bg, color: theme.primary },
    'Counseling':     { bg: theme.status.warning.bg, color: theme.status.warning.text },
    'Documentation':  { bg: theme.status.warning.bg, color: theme.status.warning.main },
    'Applied':        { bg: theme.status.info.bg, color: theme.primary },
    'Visa Process':   { bg: theme.accentLight, color: theme.accent },
    'Class/Enrolled': { bg: theme.purpleLight, color: theme.purple },
    'Abroad':         { bg: theme.status.success.bg, color: theme.status.success.main },
    'Approved':       { bg: theme.status.success.bg, color: theme.status.success.main },
    'Pending':        { bg: theme.status.warning.bg, color: theme.status.warning.text },
    'Rejected':       { bg: theme.status.danger.bg, color: theme.status.danger.main },
    'New':            { bg: theme.status.info.bg, color: theme.primary },
  }

  const s = map[stage] || { bg: theme.surfaceAlt, color: theme.textLight }

  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {stage || 'Lead'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PriorityBadge
// ─────────────────────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const map = {
    'Hot':    { bg: theme.status.danger.bg, color: theme.status.danger.main },
    'Warm':   { bg: theme.status.warning.bg, color: theme.status.warning.main },
    'Cold':   { bg: theme.status.info.bg, color: theme.primary },
    'Normal': { bg: theme.surfaceAlt, color: theme.textLight },
  }
  const s = map[priority] || { bg: theme.surfaceAlt, color: theme.textLight }

  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {priority || '—'}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — main page component
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const isMobile = useIsMobile()

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const isAdmin = (profile.role || '') === 'admin'

  const [applicants,   setApplicants]   = useState([])
  const [students,     setStudents]     = useState([])
  const [payments,     setPayments]     = useState([])
  const [tasks,        setTasks]        = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(new Date())
  const [detailModal,  setDetailModal]  = useState(null) // { title, rows, totalDisplay } for the stat-history popup

  async function load() {
    setLoading(true)

    const [a, s, p, t, appt] = await Promise.all([
      supabase.from('applicants').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('appointments').select('*'),
    ])

    setApplicants(a.data      || [])
    setStudents(s.data        || [])
    setPayments(p.data        || [])
    setTasks(t.data           || [])
    setAppointments(appt.data || [])
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useRefetchOnFocus(load)
  useRefreshHold(!!detailModal)

  const now      = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const totalApplicants = applicants.length

  const activeStudents = students.filter(s =>
    ['Counseling','Documentation','Applied','Visa Process','Class/Enrolled'].includes(s.stage)
  ).length

  const abroadCount = students.filter(s => s.stage === 'Abroad').length
    || applicants.filter(a => a.status === 'Abroad').length

  const todayAppts = appointments.filter(a => (a.date || '').startsWith(todayStr)).length

  const pendingTaskCnt = tasks.filter(t => t.status === 'pending').length

  const monthRevenue = payments
    .filter(p => {
      if (p.status !== 'paid') return false
      const d = new Date(p.created_at || p.date || 0)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const visaApprovals = applicants.filter(a => {
    if (a.status !== 'Approved') return false
    const d = new Date(a.updated_at || a.created_at || 0)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const converted = applicants.filter(a =>
    ['Approved','Abroad','Class/Enrolled'].includes(a.status)
  ).length
  const convRate = totalApplicants > 0
    ? Math.round((converted / totalApplicants) * 100) : 0

  // ── Monthly history — every month up to now, for the clickable stat cards ──
  const monthKey   = d => {
    const dt = new Date(d)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
  }
  const monthLabel = k => {
    const [y, m] = k.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const revenueByMonth = {}
  payments.forEach(p => {
    if (p.status !== 'paid') return
    const k = monthKey(p.created_at || p.date || Date.now())
    revenueByMonth[k] = (revenueByMonth[k] || 0) + (p.amount || 0)
  })

  const visaByMonth = {}
  applicants.forEach(a => {
    if (a.status !== 'Approved') return
    const k = monthKey(a.updated_at || a.created_at || Date.now())
    visaByMonth[k] = (visaByMonth[k] || 0) + 1
  })

  const openRevenueHistory = () => {
    const rows = Object.keys(revenueByMonth).sort().reverse().map(k => ({
      key: k, label: monthLabel(k), display: `Rs. ${fmt(revenueByMonth[k])}`,
    }))
    const total = Object.values(revenueByMonth).reduce((a, b) => a + b, 0)
    setDetailModal({ title: 'Revenue — Monthly History', rows, totalDisplay: `Rs. ${fmt(total)}` })
  }

  const openVisaHistory = () => {
    const rows = Object.keys(visaByMonth).sort().reverse().map(k => ({
      key: k, label: monthLabel(k), display: String(visaByMonth[k]),
    }))
    const total = Object.values(visaByMonth).reduce((a, b) => a + b, 0)
    setDetailModal({ title: 'Visa Approvals — Monthly History', rows, totalDisplay: String(total) })
  }

  const STAGES = ['Lead','Inquiring','Counseling','Documentation','Applied','Visa Process','Class/Enrolled','Abroad']

  const stageCounts = Object.fromEntries(STAGES.map(s => [s, 0]))

  applicants.forEach(a => {
    const s = a.status || 'Lead'
    if (stageCounts[s] !== undefined) stageCounts[s]++
    else stageCounts['Lead']++
  })

  students.forEach(s => {
    if (stageCounts[s.stage] !== undefined) stageCounts[s.stage]++
  })

  const maxCount = Math.max(1, ...Object.values(stageCounts))

  const countryMap = {}
  ;[...applicants, ...students].forEach(r => {
    const c = r.country || r.destination
    if (c) countryMap[c] = (countryMap[c] || 0) + 1
  })

  const totalCEntries = Object.values(countryMap).reduce((a, b) => a + b, 0) || 1

  const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 4)

  const relTime = d => {
    if (!d) return ''
    const days = Math.floor((Date.now() - new Date(d)) / 86400000)
    return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
  }

  const timeStr = lastUpdated.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })

  // ── A greeting that sounds like a person, not a status bar ──
  const hour       = now.getHours()
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName  = (profile.name || '').trim().split(/\s+/)[0] || 'there'
  const dateStr    = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // A plain-English read on the day, built from whatever's actually pending
  const dayNote = (() => {
    const bits = []
    if (todayAppts > 0)    bits.push(`${todayAppts} appointment${todayAppts > 1 ? 's' : ''} on the calendar`)
    if (pendingTaskCnt > 0) bits.push(`${pendingTaskCnt} task${pendingTaskCnt > 1 ? 's' : ''} still open`)
    if (bits.length === 0) return "Nothing urgent right now — good time to get ahead of things."
    return `You've got ${bits.join(' and ')}.`
  })()

  const recentApplicants = applicants.slice(0, 5)

  const dueTasks = tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
    .slice(0, 6)

  const fmt = n => n?.toLocaleString('en-IN') ?? '0'

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 300, color: C.textLight, fontSize: 14,
    }}>
      Loading dashboard…
    </div>
  )

  return (
    <div style={{ background: C.pageBg }}>

      {/* ── GREETING — talks to the person, not at them ── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        marginBottom: 18, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? 20 : 24, fontWeight: 800,
            color: C.textDark, margin: 0, letterSpacing: '-0.015em',
          }}>
            {greeting}, {firstName}
          </h1>
          <div style={{ fontSize: 13, color: C.textLight, marginTop: 5, lineHeight: 1.5 }}>
            {dateStr} · {dayNote}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: C.textMuted, flexShrink: 0,
        }}>
          <span>Updated {timeStr}</span>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px',
              background: C.cardBg, border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              color: C.green, cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} strokeWidth={2.2} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── ANNOUNCEMENTS (admin posts, everyone reads) ── */}
      <AnnouncementsPanel audience="staff" isAdmin={isAdmin} />

      {/* ── TOP 4 STAT CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 14, marginBottom: 14,
      }}>
        <StatCard
          label="Total Applicants"
          value={totalApplicants}
          Icon={Users}
          iconColor={C.blue}
          iconBg={C.blueBg}
          valueColor={C.textDark}
        />
        <StatCard
          label="Active Students"
          value={activeStudents}
          Icon={GraduationCap}
          iconColor={C.purple}
          iconBg={C.purpleBg}
          valueColor="black"
        />
        <StatCard
          label="Abroad"
          value={abroadCount}
          Icon={PlaneTakeoff}
          iconColor={C.teal}
          iconBg={C.tealBg}
          valueColor={C.textDark}
        />
        <StatCard
          label="Today's Appointments"
          value={todayAppts}
          sub={`${pendingTaskCnt} tasks pending`}
          Icon={CalendarCheck}
          iconColor={C.orange}
          iconBg={C.orangeBg}
          valueColor={todayAppts === 0 ? C.textMuted : 'black'}
        />
      </div>

      {/* ── BOTTOM 3 STAT CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 14, marginBottom: 20,
      }}>
        <StatCard
          label="Revenue This Month"
          value={`Rs. ${fmt(monthRevenue)}`}
          Icon={Wallet}
          iconColor={C.green}
          iconBg={C.greenBg}
          valueColor="black"
          onClick={openRevenueHistory}
        />
        <StatCard
          label="Visa Approvals (Month)"
          value={visaApprovals}
          Icon={TrendingUp}
          iconColor={C.blue}
          iconBg={C.blueBg}
          valueColor={visaApprovals > 0 ? "black" : C.textMuted}
          onClick={openVisaHistory}
        />
        <StatCard
          label="Conversion Rate"
          value={`${convRate}%`}
          Icon={Target}
          iconColor={C.orange}
          iconBg={C.orangeBg}
          valueColor="black"
        />
      </div>

      {/* ── MIDDLE ROW — pipeline (left) + countries (right) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.65fr 1fr',
        gap: 16, marginBottom: 18,
      }}>

        {/* ── PIPELINE OVERVIEW ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: isMobile ? '18px 16px' : '20px 24px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 20 }}>
            Where everyone stands
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {STAGES.map(stage => {
              const count = stageCounts[stage] || 0
              const pct = (count / maxCount) * 100

              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>

                  <span style={{
                    width: isMobile ? 86 : 118,
                    fontSize: isMobile ? 11 : 12.5,
                    color: C.textMid,
                    flexShrink: 0, textAlign: 'right',
                  }}>
                    {stage}
                  </span>

                  <div style={{
                    flex: 1, height: 8, borderRadius: 6,
                    background: theme.surfaceAlt, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: pct > 0 ? `${pct}%` : '3px',
                      borderRadius: 6,
                      background: C.barColors[stage] || theme.inputBorder,
                      transition: 'width 0.45s ease',
                    }} />
                  </div>

                  <span style={{
                    width: 18, fontSize: 12.5, fontWeight: 700,
                    color: count > 0 ? C.textDark : C.textMuted,
                    flexShrink: 0,
                  }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── DESTINATION COUNTRIES ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: isMobile ? '18px 16px' : '20px 22px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 18 }}>
            Where they're headed
          </div>

          {topCountries.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 30 }}>
              Nothing to show here yet
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 10,
            }}>
              {topCountries.map(([country, count]) => (
                <div key={country} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>
                      {country}
                    </div>
                    <div style={{ fontSize: 11, color: C.textLight }}>
                      {Math.round((count / totalCEntries) * 100)}% · {count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW — recent applicants (left) + due tasks (right) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.65fr 1fr',
        gap: 16,
      }}>

        {/* ── RECENT APPLICANTS TABLE ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>

          <div style={{
            padding: isMobile ? '14px 16px' : '16px 22px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>
              Just came in
            </span>
            <a href="/applications" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: 'none' }}>
              View all →
            </a>
          </div>

          {/* On mobile: stack applicant fields as cards instead of a grid table */}
          {isMobile ? (
            recentApplicants.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.textLight, fontSize: 13 }}>
                Nobody new yet — check back later
              </div>
            ) : (
              recentApplicants.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: i < recentApplicants.length - 1 ? `1px solid ${C.border}` : 'none',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>
                      {a.name || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {relTime(a.created_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: C.textMid }}>{a.country || '—'}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <StageBadge stage={a.status} />
                      <PriorityBadge priority={a.priority} />
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.6fr 1fr',
                padding: '8px 22px', background: theme.pageBg, borderBottom: `1px solid ${C.border}`,
              }}>
                {['NAME', 'DESTINATION', 'STAGE', 'PRIORITY'].map(h => (
                  <span key={h} style={{
                    fontSize: 10, fontWeight: 700,
                    color: C.textMuted, letterSpacing: '0.06em',
                  }}>
                    {h}
                  </span>
                ))}
              </div>

              {recentApplicants.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.textLight, fontSize: 13 }}>
                  No applicants yet
                </div>
              ) : (
                recentApplicants.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.6fr 1fr',
                      padding: '12px 22px',
                      borderBottom: i < recentApplicants.length - 1 ? `1px solid ${C.border}` : 'none',
                      alignItems: 'center', cursor: 'default',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>
                        {a.name || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {relTime(a.created_at)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMid }}>
                      <span>{a.country || '—'}</span>
                    </div>

                    <StageBadge stage={a.status} />

                    <PriorityBadge priority={a.priority} />
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* ── DUE TASKS LIST ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>

          <div style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>On your plate</span>
            <a href="/tasks" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: 'none' }}>
              View all →
            </a>
          </div>

          {dueTasks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
              <CheckCircle2 size={26} style={{ marginBottom: 10, opacity: 0.3 }} />
              <div>You're all caught up — nothing due right now</div>
            </div>
          ) : (
            dueTasks.map((t, i) => (
              <div
                key={t.id}
                style={{
                  padding: isMobile ? '12px 16px' : '12px 20px',
                  borderBottom: i < dueTasks.length - 1 ? `1px solid ${C.border}` : 'none',
                  display: 'flex', alignItems: 'center', gap: 11,
                }}
                onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: t.priority === 'High'
                    ? C.red
                    : t.priority === 'Medium'
                    ? C.yellow
                    : C.green,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: C.textDark,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {t.title || '—'}
                  </div>
                  {t.related_to && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {t.related_to}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
                  {t.due_date
                    ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'No date'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── STAT HISTORY MODAL — month-by-month, all months up to now ── */}
      {detailModal && (
        <div
          onClick={() => setDetailModal(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center', zIndex: 300,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.cardBg,
              border: `1px solid ${C.border}`,
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 26,
              width: isMobile ? '100%' : 420,
              maxHeight: '85vh', overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 18,
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: 0 }}>
                {detailModal.title}
              </h3>
              <button
                onClick={() => setDetailModal(null)}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', color: C.textLight, display: 'inline-flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {detailModal.rows.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                No data yet
              </div>
            ) : (
              detailModal.rows.map(r => (
                <div key={r.key} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 16,
                  padding: '11px 0',
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontSize: 13, color: C.textMid }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.textDark }}>{r.display}</span>
                </div>
              ))
            )}

            {detailModal.rows.length > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 16,
                padding: '13px 0 2px', marginTop: 4,
              }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, color: C.textLight,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  All-time total
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.green }}>
                  {detailModal.totalDisplay}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}