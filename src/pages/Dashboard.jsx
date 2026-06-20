// ─────────────────────────────────────────────────────────────────────────────
// Dashboard.jsx
// Main admin dashboard page for Global Pathway CRM.
// Loads data from Supabase and shows stats, pipeline, countries, applicants,
// and pending tasks — all in one scrollable page.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// Lucide icons — lightweight SVG icon library
import {
  Users,        // people / applicants icon
  GraduationCap,// students icon
  PlaneTakeoff, // abroad / travel icon
  CalendarCheck,// appointments icon
  DollarSign,   // revenue icon
  TrendingUp,   // visa approvals icon
  Target,       // conversion rate icon
  RefreshCw,    // refresh button icon
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// C — design tokens (colors used across the whole dashboard)
// Keeping all colors in one place makes it easy to change the theme
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  pageBg:    '#083ca525', // very faint blue — page background
  cardBg:    '#ffffff',   // white — card background
  border:    '#e8eaed',   // light grey — card borders
  textDark:  '#111827',   // almost black — headings
  textMid:   '#374151',   // dark grey — normal text
  textLight: '#6b7280',   // medium grey — labels, subtitles
  textMuted: '#9ca3af',   // light grey — placeholders, timestamps

  // brand colors (also used in badges and icons)
  green:     '#16a34a',
  greenBg:   '#dcfce7',
  greenText: '#15803d',
  blue:      '#2563eb',
  blueBg:    '#dbeafe',
  purple:    '#7c3aed',
  purpleBg:  '#ede9fe',
  orange:    '#ea580c',
  orangeBg:  '#ffedd5',
  yellow:    '#ca8a04',
  yellowBg:  '#fef9c3',
  red:       '#dc2626',
  redBg:     '#fee2e2',
  teal:      '#0891b2',
  tealBg:    '#cffafe',

  // pipeline bar colors — each stage gets its own color
  barColors: {
    'Lead':           '#d1d5db', // grey  — early stage, not yet qualified
    'Inquiring':      '#d1d5db', // grey  — showed interest
    'Counseling':     '#d1d5db', // grey  — in counseling sessions
    'Documentation':  '#f59e0b', // amber — collecting documents
    'Applied':        '#3b82f6', // blue  — application submitted
    'Visa Process':   '#d1d5db', // grey  — visa being processed
    'Class/Enrolled': '#8b5cf6', // purple— enrolled in class
    'Abroad':         '#22c55e', // green — student is abroad
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — reusable card component that shows a single KPI metric
// Props:
//   label      — small uppercase label above the number e.g. "Total Applicants"
//   value      — the big number or text shown e.g. "42" or "Rs. 50,000"
//   sub        — optional small grey text below the number
//   Icon       — Lucide icon component to show top-right
//   iconColor  — color of the icon
//   iconBg     — background color of the icon circle
//   valueColor — color of the big number
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, iconColor, iconBg, valueColor }) {
  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,                   // space between label row, number, and sub text
    }}>

      {/* top row — label on the left, icon on the right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 11.5,
          color: C.textLight,
          fontWeight: 600,
          textTransform: 'uppercase', // e.g. "total applicants"
          letterSpacing: '0.05em',    // wider spacing for uppercase text
        }}>
          {label}
        </span>

        {/* icon in a rounded square */}
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: iconBg || '#f3f4f6', // fallback to grey if no iconBg provided
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, // don't shrink icon when card is narrow
        }}>
          <Icon size={17} color={iconColor || C.textLight} strokeWidth={1.9} />
        </div>
      </div>

      {/* big number */}
      <div style={{
        fontSize: 32,
        fontWeight: 800,
        color: valueColor || C.textDark,
        lineHeight: 1, // tight line height so number sits close to label
      }}>
        {value}
      </div>

      {/* optional sub text — only shown if sub prop is provided */}
      {sub && (
        <div style={{ fontSize: 11.5, color: C.textMuted }}>{sub}</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StageBadge — colored pill badge that shows an applicant's current stage
// e.g. "Lead" → grey, "Abroad" → green, "Rejected" → red
// ─────────────────────────────────────────────────────────────────────────────
function StageBadge({ stage }) {
  // map every possible stage to a background + text color pair
  const map = {
    'Lead':           { bg: '#f3f4f6', color: '#6b7280' },
    'Inquiring':      { bg: '#dbeafe', color: '#1d4ed8' },
    'Counseling':     { bg: '#fef9c3', color: '#a16207' },
    'Documentation':  { bg: '#ffedd5', color: '#ea580c' },
    'Applied':        { bg: '#dbeafe', color: '#2563eb' },
    'Visa Process':   { bg: '#cffafe', color: '#0891b2' },
    'Class/Enrolled': { bg: '#ede9fe', color: '#7c3aed' },
    'Abroad':         { bg: '#dcfce7', color: '#16a34a' },
    'Approved':       { bg: '#dcfce7', color: '#16a34a' },
    'Pending':        { bg: '#fef9c3', color: '#a16207' },
    'Rejected':       { bg: '#fee2e2', color: '#dc2626' },
    'New':            { bg: '#dbeafe', color: '#1d4ed8' },
  }

  // if the stage is not in the map, use a default grey style
  const s = map[stage] || { bg: '#f3f4f6', color: '#6b7280' }

  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,        // fully rounded pill shape
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {stage || 'Lead'}        {/* fallback to 'Lead' if stage is null/undefined */}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PriorityBadge — colored pill for task or applicant priority
// Hot = red, Warm = orange, Cold = blue, Normal = grey
// ─────────────────────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const map = {
    'Hot':    { bg: '#fee2e2', color: '#dc2626' }, // red
    'Warm':   { bg: '#ffedd5', color: '#ea580c' }, // orange
    'Cold':   { bg: '#dbeafe', color: '#2563eb' }, // blue
    'Normal': { bg: '#f3f4f6', color: '#6b7280' }, // grey
  }
  const s = map[priority] || { bg: '#f3f4f6', color: '#6b7280' }

  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {priority || '—'} {/* show dash if priority not set */}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — main page component
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {

  // ── state — one useState for each data table we load from Supabase ──
  const [applicants,   setApplicants]   = useState([]) // all applicant rows
  const [students,     setStudents]     = useState([]) // all student rows
  const [payments,     setPayments]     = useState([]) // all payment rows
  const [tasks,        setTasks]        = useState([]) // all task rows
  const [appointments, setAppointments] = useState([]) // all appointment rows
  const [loading,      setLoading]      = useState(true)         // show spinner while fetching
  const [lastUpdated,  setLastUpdated]  = useState(new Date())   // timestamp of last data fetch

  // ── load() — fetch all 5 tables from Supabase at once ──
  async function load() {
    setLoading(true) // show loading state before fetch starts

    // Promise.all runs all 5 queries in parallel (faster than one by one)
    const [a, s, p, t, appt] = await Promise.all([
      supabase.from('applicants').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('appointments').select('*'),
    ])

    // save results to state — fall back to empty array if query returned null
    setApplicants(a.data      || [])
    setStudents(s.data        || [])
    setPayments(p.data        || [])
    setTasks(t.data           || [])
    setAppointments(appt.data || [])
    setLastUpdated(new Date()) // record when data was last fetched
    setLoading(false)          // hide loading state
  }

  // run load() once when the component mounts (empty [] dependency = run once)
  useEffect(() => { load() }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES — derived from the raw data
  // ─────────────────────────────────────────────────────────────────────────

  const now      = new Date()
  const todayStr = now.toISOString().split('T')[0] // "2026-06-18" — used to filter today's records

  // total count of all applicants
  const totalApplicants = applicants.length

  // students who are in active processing stages (not yet abroad or dropped)
  const activeStudents = students.filter(s =>
    ['Counseling','Documentation','Applied','Visa Process','Class/Enrolled'].includes(s.stage)
  ).length

  // students currently abroad — check both tables to handle different data setups
  const abroadCount = students.filter(s => s.stage === 'Abroad').length
    || applicants.filter(a => a.status === 'Abroad').length

  // count appointments scheduled for today
  const todayAppts = appointments.filter(a => (a.date || '').startsWith(todayStr)).length

  // count tasks that are still pending (not completed)
  const pendingTaskCnt = tasks.filter(t => t.status === 'pending').length

  // revenue from paid payments this calendar month
  const monthRevenue = payments
    .filter(p => {
      if (p.status !== 'paid') return false // only count paid ones
      const d = new Date(p.created_at || p.date || 0)
      // check that the payment was made this month and year
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0) // add up all qualifying amounts

  // approved visas this month
  const visaApprovals = applicants.filter(a => {
    if (a.status !== 'Approved') return false
    const d = new Date(a.updated_at || a.created_at || 0)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  // conversion rate — % of applicants who became students or got approved
  const converted = applicants.filter(a =>
    ['Approved','Abroad','Class/Enrolled'].includes(a.status)
  ).length
  const convRate = totalApplicants > 0
    ? Math.round((converted / totalApplicants) * 100) : 0 // avoid divide by zero

  // ─────────────────────────────────────────────────────────────────────────
  // PIPELINE COUNTS — count how many applicants/students are in each stage
  // ─────────────────────────────────────────────────────────────────────────

  // ordered list of stages for the pipeline bar chart
  const STAGES = ['Lead','Inquiring','Counseling','Documentation','Applied','Visa Process','Class/Enrolled','Abroad']

  // start every stage count at 0
  const stageCounts = Object.fromEntries(STAGES.map(s => [s, 0]))

  // count applicants per stage
  applicants.forEach(a => {
    const s = a.status || 'Lead'
    if (stageCounts[s] !== undefined) stageCounts[s]++ // increment if stage is known
    else stageCounts['Lead']++                          // unknown stage → count as Lead
  })

  // also count students (they may be in Class/Enrolled or Abroad stages)
  students.forEach(s => {
    if (stageCounts[s.stage] !== undefined) stageCounts[s.stage]++
  })

  // max count across all stages — used to calculate bar widths as percentages
  const maxCount = Math.max(1, ...Object.values(stageCounts)) // Math.max(1,...) avoids 0

  // ─────────────────────────────────────────────────────────────────────────
  // DESTINATION COUNTRIES — count applicants/students per country
  // ─────────────────────────────────────────────────────────────────────────

  const countryMap = {}
  // merge applicants and students, then count by country field
  ;[...applicants, ...students].forEach(r => {
    const c = r.country || r.destination // handle different field names
    if (c) countryMap[c] = (countryMap[c] || 0) + 1
  })

  // total entries for calculating percentage
  const totalCEntries = Object.values(countryMap).reduce((a, b) => a + b, 0) || 1

  // get top 4 countries sorted by count descending
  const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 4)

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  // relTime — converts a date string to a human-readable "X days ago" label
  const relTime = d => {
    if (!d) return '' // no date → return empty string
    const days = Math.floor((Date.now() - new Date(d)) / 86400000) // ms → days
    return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
  }

  // format the last-updated time e.g. "10:30 AM"
  const timeStr = lastUpdated.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })

  // last 5 applicants for the "Recent Applicants" table
  const recentApplicants = applicants.slice(0, 5)

  // pending tasks sorted by due date (soonest first), max 6 shown
  const dueTasks = tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
    .slice(0, 6)

  // fmt — formats a number with Indian-style commas e.g. 50000 → "50,000"
  const fmt = n => n?.toLocaleString('en-IN') ?? '0'

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE — show a centered message while data is being fetched
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 300, color: C.textLight, fontSize: 14,
    }}>
      Loading dashboard…
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '28px 28px 40px' }}>

      {/* ── HEADER ROW — shows last updated time + refresh button ── */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        marginBottom: 22, gap: 10, fontSize: 12, color: C.textMuted,
      }}>
        <span>Last updated {timeStr}</span>

        {/* clicking Refresh calls load() again to re-fetch all data */}
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

      {/* ── TOP 4 STAT CARDS — main KPIs in a 4-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <StatCard
          label="Total Applicants"
          value={totalApplicants}
          Icon={Users}
          iconColor="#2564eb00" // transparent — icon color intentionally hidden
          iconBg="#dbeafe00"
          valueColor={C.textDark}
        />
        <StatCard
          label="Active Students"
          value={activeStudents}
          Icon={GraduationCap}
          iconColor="#7c3aed00"
          iconBg="#ede9fe00"
          valueColor="black"
        />
        <StatCard
          label="Abroad"
          value={abroadCount}
          Icon={PlaneTakeoff}
          iconColor="#0890b200"
          iconBg="#cffafe00"
          valueColor={C.textDark}
        />
        <StatCard
          label="Today's Appointments"
          value={todayAppts}
          sub={`${pendingTaskCnt} tasks pending`} // shows pending task count below
          Icon={CalendarCheck}
          iconColor="#ea5a0c00"
          iconBg="#ffedd500"
          valueColor={todayAppts === 0 ? C.textMuted : 'black'} // grey if zero
        />
      </div>

      {/* ── BOTTOM 3 STAT CARDS — financial + conversion metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard
          label="Revenue This Month"
          value={`Rs. ${fmt(monthRevenue)}`}
          Icon={DollarSign}
          iconColor="#16a34a07"
          iconBg="#dcfce700"
          valueColor="black"
        />
        <StatCard
          label="Visa Approvals (Month)"
          value={visaApprovals}
          Icon={TrendingUp}
          valueColor={visaApprovals > 0 ? "black" : C.textMuted} // grey if zero
        />
        <StatCard
          label="Conversion Rate"
          value={`${convRate}%`}
          Icon={Target}
          iconColor="#ea5a0c00"
          iconBg="#ffedd500"
          valueColor="black"
        />
      </div>

      {/* ── MIDDLE ROW — pipeline overview (left) + destination countries (right) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 16, marginBottom: 18 }}>

        {/* ── PIPELINE OVERVIEW — horizontal bar chart of stage counts ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 20 }}>
            Pipeline Overview
          </div>

          {/* one row per stage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {STAGES.map(stage => {
              const count = stageCounts[stage] || 0
              // bar width = count as % of the maximum count (so the highest bar = 100%)
              const pct = (count / maxCount) * 100

              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

                  {/* stage label — right-aligned, fixed width */}
                  <span style={{
                    width: 118, fontSize: 12.5, color: C.textMid,
                    flexShrink: 0, textAlign: 'right',
                  }}>
                    {stage}
                  </span>

                  {/* grey track — the bar sits inside this */}
                  <div style={{
                    flex: 1, height: 8, borderRadius: 6,
                    background: '#f0f0f0', overflow: 'hidden',
                  }}>
                    {/* colored fill — width driven by pct */}
                    <div style={{
                      height: '100%',
                      width: pct > 0 ? `${pct}%` : '3px', // 3px minimum so empty stages show a dot
                      borderRadius: 6,
                      background: C.barColors[stage] || '#d1d5db',
                      transition: 'width 0.45s ease', // smooth bar animation on data change
                    }} />
                  </div>

                  {/* count number on the right */}
                  <span style={{
                    width: 18, fontSize: 12.5, fontWeight: 700,
                    color: count > 0 ? C.textDark : C.textMuted, // grey if zero
                    flexShrink: 0,
                  }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── DESTINATION COUNTRIES — 2×2 grid of top 4 countries ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '20px 22px',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 18 }}>
            Destination Countries
          </div>

          {/* empty state — shown when no country data exists yet */}
          {topCountries.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 30 }}>
              No data yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {topCountries.map(([country, count]) => (
                <div key={country} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                }}>
                  <div>
                    {/* country name */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>
                      {country}
                    </div>
                    {/* percentage of total + raw count */}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 16 }}>

        {/* ── RECENT APPLICANTS TABLE ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>

          {/* table header row with "View all" link */}
          <div style={{
            padding: '16px 22px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>
              Recent Applicants
            </span>
            <a href="/applications" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: 'none' }}>
              View all →
            </a>
          </div>

          {/* column headings */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.6fr 1fr',
            padding: '8px 22px', background: '#fafafa', borderBottom: `1px solid ${C.border}`,
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

          {/* empty state */}
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
                  // only show bottom border if not the last row
                  borderBottom: i < recentApplicants.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems: 'center', cursor: 'default',
                }}
                // subtle hover highlight
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* name + relative time */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>
                    {a.name || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {relTime(a.created_at)} {/* e.g. "2 days ago" */}
                  </div>
                </div>

                {/* destination country */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMid }}>
                  <span>{a.country || '—'}</span>
                </div>

                {/* stage badge — color-coded pill */}
                <StageBadge stage={a.status} />

                {/* priority badge — Hot / Warm / Cold */}
                <PriorityBadge priority={a.priority} />
              </div>
            ))
          )}
        </div>

        {/* ── DUE TASKS LIST ── */}
        <div style={{
          background: C.cardBg, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: 'hidden',
        }}>

          {/* header with "View all" link */}
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>Due Tasks</span>
            <a href="/tasks" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: 'none' }}>
              View all →
            </a>
          </div>

          {/* empty state — shown when no pending tasks exist */}
          {dueTasks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>✓</div>
              No tasks due in the next 3 days
            </div>
          ) : (
            dueTasks.map((t, i) => (
              <div
                key={t.id}
                style={{
                  padding: '12px 20px',
                  borderBottom: i < dueTasks.length - 1 ? `1px solid ${C.border}` : 'none',
                  display: 'flex', alignItems: 'center', gap: 11,
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* priority color dot — red = High, yellow = Medium, green = Low */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: t.priority === 'High'
                    ? C.red
                    : t.priority === 'Medium'
                    ? C.yellow
                    : C.green,
                }} />

                {/* task title + optional related client name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: C.textDark,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {t.title || '—'}
                  </div>
                  {/* related_to = the client or applicant this task is about */}
                  {t.related_to && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {t.related_to}
                    </div>
                  )}
                </div>

                {/* due date — formatted as "Jun 18" */}
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

    </div>
  )
}