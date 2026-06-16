import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  Users, GraduationCap, PlaneTakeoff, CalendarCheck,
  DollarSign, TrendingUp, Target, RefreshCw,
} from 'lucide-react'

const C = {
  pageBg:    '#f4f5f7',
  cardBg:    '#ffffff',
  border:    '#e8eaed',
  textDark:  '#111827',
  textMid:   '#374151',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
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
  barColors: {
    'Lead':           '#d1d5db',
    'Inquiring':      '#d1d5db',
    'Counseling':     '#d1d5db',
    'Documentation':  '#f59e0b',
    'Applied':        '#3b82f6',
    'Visa Process':   '#d1d5db',
    'Class/Enrolled': '#8b5cf6',
    'Abroad':         '#22c55e',
  },
}

function StatCard({ label, value, sub, Icon, iconColor, iconBg, valueColor }) {
  return (
    <div style={{
      background: C.cardBg,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 11.5, color: C.textLight,
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {label}
        </span>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: iconBg || '#f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={17} color={iconColor || C.textLight} strokeWidth={1.9} />
        </div>
      </div>
      <div style={{
        fontSize: 32, fontWeight: 800,
        color: valueColor || C.textDark,
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11.5, color: C.textMuted }}>{sub}</div>
      )}
    </div>
  )
}

function StageBadge({ stage }) {
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
  const s = map[stage] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>{stage || 'Lead'}</span>
  )
}

function PriorityBadge({ priority }) {
  const map = {
    'Hot':    { bg: '#fee2e2', color: '#dc2626' },
    'Warm':   { bg: '#ffedd5', color: '#ea580c' },
    'Cold':   { bg: '#dbeafe', color: '#2563eb' },
    'Normal': { bg: '#f3f4f6', color: '#6b7280' },
  }
  const s = map[priority] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>{priority || '—'}</span>
  )
}

export default function Dashboard() {
  const [applicants,   setApplicants]   = useState([])
  const [students,     setStudents]     = useState([])
  const [payments,     setPayments]     = useState([])
  const [tasks,        setTasks]        = useState([])
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(new Date())

  async function load() {
    setLoading(true)
    const [a, s, p, t, appt] = await Promise.all([
      supabase.from('applicants').select('*').order('created_at', { ascending: false }),
      supabase.from('students').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('appointments').select('*'),
    ])
    setApplicants(a.data    || [])
    setStudents(s.data      || [])
    setPayments(p.data      || [])
    setTasks(t.data         || [])
    setAppointments(appt.data || [])
    setLastUpdated(new Date())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // computed
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const totalApplicants = applicants.length
  const activeStudents  = students.filter(s =>
    ['Counseling','Documentation','Applied','Visa Process','Class/Enrolled'].includes(s.stage)
  ).length
  const abroadCount     = students.filter(s => s.stage === 'Abroad').length
    || applicants.filter(a => a.status === 'Abroad').length
  const todayAppts      = appointments.filter(a => (a.date || '').startsWith(todayStr)).length
  const pendingTaskCnt  = tasks.filter(t => t.status === 'pending').length

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

  // pipeline
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

  // countries
  const countryMap = {}
  ;[...applicants, ...students].forEach(r => {
    const c = r.country || r.destination
    if (c) countryMap[c] = (countryMap[c] || 0) + 1
  })
  const totalCEntries = Object.values(countryMap).reduce((a, b) => a + b, 0) || 1
  const topCountries  = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 4)

  const countryFlag = n => ({ Australia:'🇦🇺', UK:'🇬🇧', Japan:'🇯🇵', Korea:'🇰🇷', Canada:'🇨🇦', USA:'🇺🇸', Germany:'🇩🇪', Finland:'🇫🇮' }[n] || '🌍')

  const relTime = d => {
    if (!d) return ''
    const days = Math.floor((Date.now() - new Date(d)) / 86400000)
    return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
  }

  const timeStr = lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  const recentApplicants = applicants.slice(0, 5)
  const dueTasks = tasks.filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
    .slice(0, 6)

  const fmt = n => n?.toLocaleString('en-IN') ?? '0'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: C.textLight, fontSize: 14 }}>
      Loading dashboard…
    </div>
  )

  return (
    <div style={{ background: C.pageBg, minHeight: '100vh', padding: '28px 28px 40px' }}>

      {/* ── header ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 22, gap: 10, fontSize: 12, color: C.textMuted }}>
        <span>Last updated {timeStr}</span>
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

      {/* ── top 4 stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <StatCard label="Total Applicants"     value={totalApplicants} sub="All pipeline stages"    Icon={Users}         iconColor="#2563eb" iconBg="#dbeafe" valueColor={C.textDark} />
        <StatCard label="Active Students"      value={activeStudents}  sub="Counseling → Visa"      Icon={GraduationCap} iconColor="#7c3aed" iconBg="#ede9fe" valueColor="#2563eb"   />
        <StatCard label="Abroad"               value={abroadCount}     sub="Successfully departed"  Icon={PlaneTakeoff}  iconColor="#0891b2" iconBg="#cffafe" valueColor={C.textDark} />
        <StatCard label="Today's Appointments" value={todayAppts}      sub={`${pendingTaskCnt} tasks pending`} Icon={CalendarCheck} iconColor="#ea580c" iconBg="#ffedd5" valueColor={todayAppts === 0 ? C.textMuted : '#ea580c'} />
      </div>

      {/* ── bottom 3 stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Revenue This Month"    value={`Rs. ${fmt(monthRevenue)}`} sub="Confirmed payments"   Icon={DollarSign}  iconColor="#16a34a" iconBg="#dcfce7" valueColor="#16a34a" />
        <StatCard label="Visa Approvals (Month)" value={visaApprovals}             sub="This calendar month"  Icon={TrendingUp}  iconColor={visaApprovals > 0 ? "#16a34a" : C.textMuted} iconBg={visaApprovals > 0 ? "#dcfce7" : "#f3f4f6"} valueColor={visaApprovals > 0 ? "#16a34a" : C.textMuted} />
        <StatCard label="Conversion Rate"        value={`${convRate}%`}            sub="Lead → Abroad"        Icon={Target}      iconColor="#ea580c" iconBg="#ffedd5" valueColor="#ea580c" />
      </div>

      {/* ── pipeline + destination ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 16, marginBottom: 18 }}>

        {/* Pipeline Overview */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 20 }}>Pipeline Overview</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {STAGES.map(stage => {
              const count = stageCounts[stage] || 0
              const pct   = (count / maxCount) * 100
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 118, fontSize: 12.5, color: C.textMid, flexShrink: 0, textAlign: 'right' }}>
                    {stage}
                  </span>
                  <div style={{ flex: 1, height: 8, borderRadius: 6, background: '#f0f0f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: pct > 0 ? `${pct}%` : '3px',
                      borderRadius: 6,
                      background: C.barColors[stage] || '#d1d5db',
                      transition: 'width 0.45s ease',
                    }} />
                  </div>
                  <span style={{ width: 18, fontSize: 12.5, fontWeight: 700, color: count > 0 ? C.textDark : C.textMuted, flexShrink: 0 }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Destination Countries */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 18 }}>Destination Countries</div>
          {topCountries.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 30 }}>No data yet</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {topCountries.map(([country, count]) => (
                <div key={country} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  border: `1px solid ${C.border}`, borderRadius: 10,
                }}>
                  <span style={{ fontSize: 22 }}>{countryFlag(country)}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{country}</div>
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

      {/* ── recent applicants + due tasks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 16 }}>

        {/* Recent Applicants */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 22px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>Recent Applicants</span>
            <a href="/applications" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: 'none' }}>View all →</a>
          </div>

          {/* column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.6fr 1fr', padding: '8px 22px', background: '#fafafa', borderBottom: `1px solid ${C.border}` }}>
            {['NAME', 'DESTINATION', 'STAGE', 'PRIORITY'].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: '0.06em' }}>{h}</span>
            ))}
          </div>

          {recentApplicants.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textLight, fontSize: 13 }}>No applicants yet</div>
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
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{a.name || '—'}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{relTime(a.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textMid }}>
                  <span>{countryFlag(a.country)}</span>
                  <span>{a.country || '—'}</span>
                </div>
                <StageBadge stage={a.status} />
                <PriorityBadge priority={a.priority} />
              </div>
            ))
          )}
        </div>

        {/* Due Tasks */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>Due Tasks</span>
            <a href="/tasks" style={{ fontSize: 12, color: C.green, fontWeight: 600, textDecoration: 'none' }}>View all →</a>
          </div>

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
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: t.priority === 'High' ? C.red : t.priority === 'Medium' ? C.yellow : C.green,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.title || '—'}
                  </div>
                  {t.related_to && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{t.related_to}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
                  {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}