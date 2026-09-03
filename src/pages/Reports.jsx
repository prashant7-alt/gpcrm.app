import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { exportRows } from '../lib/exportCsv'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'
import {
  Download,
  Printer,
  UserPlus,
  TrendingUp,
  Wallet,
  BadgeCheck,
  BarChart3,
  Globe2,
  Users,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Reports & Analytics page
// Shows: top stat cards, conversion funnel, country bar chart, and
//        staff performance table. All data comes from supabase — no
//        hardcoded numbers.
// ─────────────────────────────────────────────────────────────────────────────

export default function Reports() {
  const isMobile = useIsMobile()

  // raw data from supabase
  const [applicants, setApplicants] = useState([])
  const [payments,   setPayments]   = useState([])
  const [staff,      setStaff]      = useState([])
  const [tasks,      setTasks]      = useState([])
  const [profiles,   setProfiles]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [hoverBar,   setHoverBar]   = useState(null) // country name whose bar is hovered

  // load everything at once when page opens
  async function load() {
    const [a, p, s, t, pr] = await Promise.all([
      supabase.from('applicants').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('staff').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('profiles').select('id, name, email, role').neq('role', 'student'),
    ])
    setApplicants(a.data || [])
    setPayments(p.data   || [])
    setStaff(s.data      || [])
    setTasks(t.data      || [])
    setProfiles(pr.data  || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useRefetchOnFocus(load)

  // ── calculated numbers ────────────────────────────────────────────────────

  // applicants added this calendar month
  const now = new Date()
  const newThisMonth = applicants.filter(a => {
    const d = new Date(a.created_at)
    return d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
  }).length

  // lead → abroad conversions (anyone who reached Abroad stage)
  // NOTE: the pipeline position lives in the "status" column (confirmed by
  // your Students/Applicants pages, which read/write a.status) — this was
  // previously checking a.stage, a column that doesn't exist, so this
  // always read 0 regardless of real data.
  const conversions = applicants.filter(a => a.status === 'Abroad').length

  // total paid payments this month
  const monthRevenue = payments
    .filter(p => {
      const d = new Date(p.created_at)
      return p.status === 'paid' &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  // visa approvals = applicants with status Approved
  const visaApprovals = applicants.filter(a => a.status === 'Approved').length

  // ── funnel stages ─────────────────────────────────────────────────────────
  // count applicants in each pipeline stage — using a.status (see note
  // above), and matching the actual values used elsewhere in the app
  // ('New' and 'Class/Enrolled', not 'Lead' and 'Class').
  //
  // Covers all 11 real status values from your Applicants dropdown
  // (New, Pending, Approved, Rejected, Inquiring, Counseling,
  // Documentation, Applied, Visa Process, Class/Enrolled, Abroad) instead
  // of only 4 hand-picked ones — so every applicant is represented
  // somewhere in this chart, not just the ones matching 4 old labels.
  const FUNNEL_STATUSES = [
    { label: 'New',            color: theme.status.danger.main },
    { label: 'Pending',        color: theme.status.warning.main },
    { label: 'Inquiring',      color: theme.purple },
    { label: 'Counseling',     color: theme.purple },
    { label: 'Documentation',  color: theme.status.warning.main },
    { label: 'Applied',        color: theme.primary },
    { label: 'Visa Process',   color: theme.accent },
    { label: 'Class/Enrolled', color: theme.purple },
    { label: 'Approved',       color: theme.status.success.main },
    { label: 'Abroad',         color: theme.primary },
    { label: 'Rejected',       color: theme.status.danger.main },
  ]
  const funnelData = FUNNEL_STATUSES.map(s => ({
    ...s,
    count: applicants.filter(a => a.status === s.label).length,
  }))
  // highest count — used to calculate bar width percentage
  const funnelMax = Math.max(...funnelData.map(f => f.count), 1)

  // ── country breakdown ─────────────────────────────────────────────────────
  const countryList = ['Korea','Australia','Japan','UK','USA','Canada','Finland','Others']
  const countryData = countryList.map(c => {
    const total  = c === 'Others'
      ? applicants.filter(a => !countryList.slice(0,-1).includes(a.country)).length
      : applicants.filter(a => a.country === c).length
    const abroad = c === 'Others'
      ? applicants.filter(a => !countryList.slice(0,-1).includes(a.country) && a.status === 'Abroad').length
      : applicants.filter(a => a.country === c && a.status === 'Abroad').length
    return { country: c, total, abroad }
  })
  const countryMax = Math.max(...countryData.map(d => d.total), 1)

  // ── staff performance ─────────────────────────────────────────────────────
  // Tasks store the real assignee as `assignee_id` (FK → profiles.id) plus a
  // display-only `assigned_to` name string — NOT the `staff` table id. So we
  // bridge each staff row to its profile (by email) and count by profile id,
  // with a name fallback for older tasks. Completed tasks are status
  // 'completed' (the Tasks page value), not 'done'.
  const lc = v => (v || '').trim().toLowerCase()
  const staffWithStats = staff.map(s => {
    const prof  = profiles.find(p => lc(p.email) === lc(s.email))
    const pid   = prof?.id
    const names = [lc(s.name), lc(prof?.name)].filter(Boolean)

    const mine = row =>
      (pid && row.assignee_id === pid) ||
      (pid && row.assigned_to === pid) ||
      row.assigned_to === s.id ||
      names.includes(lc(row.assigned_to))

    const myTasks = tasks.filter(mine)

    return {
      ...s,
      applicantCount: applicants.filter(mine).length,
      taskCount:      myTasks.length,
      doneCount:      myTasks.filter(t => t.status === 'completed').length,
    }
  })

  // ── top stat cards ────────────────────────────────────────────────────────
  const topCards = [
    { label: 'New This Month',  value: newThisMonth,                        sub: 'Applicants',    border: theme.primary, Icon: UserPlus   },
    { label: 'Conversions',     value: conversions,                         sub: 'Lead → Abroad', border: theme.status.success.main, Icon: TrendingUp },
    { label: 'Month Revenue',   value: `Rs ${monthRevenue.toLocaleString()}`, sub: 'Collected',   border: theme.status.warning.text, Icon: Wallet     },
    { label: 'Visa Approvals',  value: visaApprovals,                       sub: 'This month',    border: theme.purple, Icon: BadgeCheck },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // role badge style — each role gets a different tint
  const roleBadge = (role) => {
    const map = {
      'C.E.O':       { bg: theme.status.info.bg, color: theme.primary },
      'M.D':         { bg: theme.purpleLight, color: theme.purple },
      'Visa Officer':{ bg: theme.status.success.bg, color: theme.status.success.text },
      'Admin':       { bg: theme.status.warning.bg, color: theme.status.warning.text },
      'Counselor':   { bg: theme.pinkLight, color: theme.pink },
    }
    return map[role] || { bg: theme.surfaceAlt, color: theme.textMid }
  }

  // Flatten every panel into one summary spreadsheet.
  function handleExportAll() {
    const rows = [
      ...topCards.map(c => ({ section: 'Summary', item: c.label, value: c.value, detail: c.sub })),
      ...funnelData.map(f => ({ section: 'Pipeline stage', item: f.label, value: f.count, detail: '' })),
      ...countryData.map(d => ({ section: 'Country', item: d.country, value: d.total, detail: `${d.abroad} gone abroad` })),
      ...staffWithStats.map(s => ({
        section: 'Staff performance',
        item: s.name || s.email || '—',
        value: `${s.applicantCount} applicants`,
        detail: `${s.doneCount}/${s.taskCount} tasks done`,
      })),
    ]
    exportRows('report', rows, [
      { header: 'Section', value: r => r.section },
      { header: 'Item',    value: r => r.item },
      { header: 'Value',   value: r => r.value },
      { header: 'Detail',  value: r => r.detail },
    ])
  }

  // shared card shell for the analytics panels
  const panelStyle = {
    background: theme.cardBg,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    padding: isMobile ? 16 : 20,
  }

  const panelTitle = (Icon, text) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8,
        background: theme.primaryLight || theme.status.info.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: theme.primary || theme.primary,
      }}>
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: theme.textDark }}>
        {text}
      </span>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: 40, color: theme.textLight, fontSize: 14 }}>
      Loading reports...
    </div>
  )

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* ── page header ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 12 : 0,
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? 19 : 22,
            fontWeight: 700,
            color: theme.textDark,
            margin: 0,
          }}>
            Reports & Analytics
          </h1>
          <p style={{
            fontSize: 13,
            color: theme.textLight,
            marginTop: 4,
          }}>
            A live overview of pipeline, revenue, and team performance
          </p>
        </div>

        {/* export + print buttons */}
        <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
          <button
            onClick={handleExportAll}
            style={{
              padding: '8px 16px',
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: theme.textMid,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <Download size={15} />
            Export All
          </button>
          <button
            onClick={() => window.print()}
            style={{
              padding: '8px 16px',
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              color: theme.textMid,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <Printer size={15} />
            Print Report
          </button>
        </div>
      </div>

      {/* ── top 4 stat cards ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: isMobile ? 10 : 16,
        marginBottom: 24,
      }}>
        {topCards.map(card => (
          <div key={card.label} style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: isMobile ? '16px' : '20px 18px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 8,
          }}>
            <div style={{
              width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: 10,
              background: theme.surfaceAlt, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <card.Icon size={isMobile ? 15 : 17} color={card.border} strokeWidth={2.2} />
            </div>
            <p style={{
              fontSize: 12,
              color: theme.textLight,
              margin: 0,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {card.label}
            </p>
            {/* big number */}
            <div style={{
              fontSize: isMobile ? 20 : 22,
              fontWeight: 800,
              color: theme.textDark,
              lineHeight: 1,
            }}>
              {card.value}
            </div>
            <p style={{
              fontSize: 12,
              color: theme.textMuted,
              margin: 0,
            }}>
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ── row 2: funnel + country popularity side by side ──────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }}>

        {/* conversion funnel ─────────────────────────────────────────────── */}
        <div style={panelStyle}>
          {panelTitle(BarChart3, 'Conversion Funnel')}

          {/* compact horizontal row per status — label left, bar + count right */}
          {funnelData.map(stage => (
            <div
              key={stage.label}
              title={`${stage.label}: ${stage.count} ${stage.count === 1 ? 'person' : 'people'} at this stage`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 10,
              }}>
              <div style={{
                width: 100, flexShrink: 0,
                fontSize: 12, color: theme.textLight, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {stage.label}
              </div>

              <div style={{
                flex: 1, height: 20,
                background: theme.pageBg,
                borderRadius: 5,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max((stage.count / funnelMax) * 100, stage.count > 0 ? 4 : 0)}%`,
                  background: stage.color,
                  borderRadius: 5,
                  minWidth: stage.count > 0 ? 20 : 0,
                  transition: 'width 0.6s ease',
                }} />
              </div>

              <div style={{
                width: 24, flexShrink: 0, textAlign: 'right',
                fontSize: 13, fontWeight: 700, color: theme.textDark,
              }}>
                {stage.count}
              </div>
            </div>
          ))}
        </div>

        {/* country popularity bar chart ───────────────────────────────────── */}
        <div style={panelStyle}>
          {panelTitle(Globe2, 'Country Popularity')}

          {/* legend: total vs abroad */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 10, background: theme.purple, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: theme.textLight }}>Total</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 10, background: theme.primary, borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: theme.textLight }}>Abroad</span>
            </div>
          </div>

          {/* vertical bars — horizontal scroll on phone so 8 columns don't get crushed */}
          <div style={{ overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 10,
              height: 160,
              paddingBottom: 4,
              minWidth: isMobile ? 480 : 'auto',
            }}>
              {countryData.map(d => (
                <div
                  key={d.country}
                  onMouseEnter={() => setHoverBar(d.country)}
                  onMouseLeave={() => setHoverBar(null)}
                  title={`${d.country} — ${d.total} applicant${d.total === 1 ? '' : 's'}, ${d.abroad} gone abroad`}
                  style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    height: '100%',
                    justifyContent: 'flex-end',
                    minWidth: isMobile ? 50 : 'auto',
                    cursor: 'default',
                  }}>

                  {/* hover tooltip — what the bars mean + the numbers */}
                  {hoverBar === d.country && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: theme.textDark || '#243447',
                      color: '#fff',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 11,
                      lineHeight: 1.5,
                      whiteSpace: 'nowrap',
                      zIndex: 5,
                      boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
                      pointerEvents: 'none',
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.country}</div>
                      <div><span style={{ color: theme.purple }}>■</span> Total applicants: <b>{d.total}</b></div>
                      <div><span style={{ color: theme.primary }}>■</span> Gone abroad: <b>{d.abroad}</b></div>
                    </div>
                  )}

                  {/* total + abroad bars side by side */}
                  <div style={{
                    display: 'flex',
                    gap: 3,
                    alignItems: 'flex-end',
                    width: '100%',
                    justifyContent: 'center',
                  }}>
                    {/* total bar */}
                    <div style={{
                      width: '45%',
                      height: Math.max((d.total / countryMax) * 130, d.total > 0 ? 4 : 0),
                      background: theme.purple,
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.5s ease',
                      opacity: hoverBar && hoverBar !== d.country ? 0.45 : 1,
                    }} />
                    {/* abroad bar */}
                    <div style={{
                      width: '45%',
                      height: Math.max((d.abroad / countryMax) * 130, d.abroad > 0 ? 4 : 0),
                      background: theme.primary,
                      borderRadius: '3px 3px 0 0',
                      transition: 'height 0.5s ease',
                      opacity: hoverBar && hoverBar !== d.country ? 0.45 : 1,
                    }} />
                  </div>

                  {/* country label */}
                  <span style={{
                    fontSize: 10,
                    color: hoverBar === d.country ? theme.textDark : theme.textLight,
                    fontWeight: hoverBar === d.country ? 700 : 400,
                    textAlign: 'center',
                    marginTop: 4,
                    lineHeight: 1.2,
                  }}>
                    {d.country}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* y-axis reference line (just for feel) */}
          <div style={{
            borderTop: `1px solid ${theme.border}`,
            marginTop: 2,
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}>
            <span style={{ fontSize: 10, color: theme.textMuted }}>0</span>
            <span style={{ fontSize: 10, color: theme.textMuted }}>{countryMax}</span>
          </div>
        </div>
      </div>

      {/* ── row 3: staff performance — full width ─────────────────────────── */}
      <div style={panelStyle}>
        {panelTitle(Users, 'Staff Performance')}

        {/* desktop: table. mobile: stacked cards */}
        {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
            paddingBottom: 10,
            borderBottom: `1px solid ${theme.border}`,
            marginBottom: 4,
          }}>
            {['Staff Member','Role','Applicants','Tasks','Done'].map(h => (
              <span key={h} style={{
                fontSize: 11,
                fontWeight: 700,
                color: theme.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {h}
              </span>
            ))}
          </div>
        )}

        {/* empty state */}
        {staffWithStats.length === 0 && (
          <div style={{
            padding: '30px 0',
            textAlign: 'center',
            color: theme.textLight,
            fontSize: 13,
          }}>
            No staff data yet
          </div>
        )}

        {/* staff rows */}
        {staffWithStats.map((s, i) => (
          isMobile ? (
            // ── Mobile card ──
            <div key={s.id} style={{
              padding: '12px 0',
              borderBottom: i < staffWithStats.length - 1 ? `1px solid ${theme.border}` : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textDark, marginBottom: 4 }}>
                  {s.name || '—'}
                </div>
                <span style={{
                  padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: roleBadge(s.role).bg, color: roleBadge(s.role).color,
                }}>
                  {s.role || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 14, flexShrink: 0, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: theme.textLight, marginBottom: 2 }}>Applic.</div>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: theme.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: theme.primaryText, margin: '0 auto',
                  }}>
                    {s.applicantCount}
                  </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: theme.textLight, marginBottom: 2 }}>Tasks</div>
                  <div style={{ fontSize: 13, color: theme.textMid, fontWeight: 600 }}>{s.taskCount}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: theme.textLight, marginBottom: 2 }}>Done</div>
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%', background: theme.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: theme.primaryText, margin: '0 auto',
                  }}>
                    {s.doneCount}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // ── Desktop row ──
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr',
                padding: '12px 0',
                borderBottom: i < staffWithStats.length - 1
                  ? `1px solid ${theme.border}` : 'none',
                alignItems: 'center',
              }}
            >
              {/* name */}
              <div style={{ fontSize: 14, fontWeight: 500, color: theme.textDark }}>
                {s.name || '—'}
              </div>

              {/* role badge */}
              <div>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  background: roleBadge(s.role).bg,
                  color: roleBadge(s.role).color,
                }}>
                  {s.role || '—'}
                </span>
              </div>

              {/* applicant count — green circle */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: theme.primaryLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: theme.primaryText,
                }}>
                  {s.applicantCount}
                </span>
              </div>

              {/* task count — just number */}
              <div style={{ fontSize: 14, color: theme.textMid, textAlign: 'center' }}>
                {s.taskCount}
              </div>

              {/* done tasks — green circle */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: theme.primaryLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: theme.primaryText,
                }}>
                  {s.doneCount}
                </span>
              </div>
            </div>
          )
        ))}
      </div>

    </div>
  )
}