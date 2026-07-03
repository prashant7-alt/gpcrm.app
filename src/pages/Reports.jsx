
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'

// ─────────────────────────────────────────────────────────────────────────────
// Reports & Analytics page
// Shows: top stat cards, conversion funnel, source pie chart,
//        country bar chart, and staff performance table
// All data comes from supabase — no hardcoded numbers
// ─────────────────────────────────────────────────────────────────────────────

export default function Reports() {

  // raw data from supabase
  const [applicants, setApplicants] = useState([])
  const [payments,   setPayments]   = useState([])
  const [staff,      setStaff]      = useState([])
  const [tasks,      setTasks]      = useState([])
  const [loading,    setLoading]    = useState(true)

  // load everything at once when page opens
  useEffect(() => {
    async function load() {
      const [a, p, s, t] = await Promise.all([
        supabase.from('applicants').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('staff').select('*'),
        supabase.from('tasks').select('*'),
      ])
      setApplicants(a.data || [])
      setPayments(p.data   || [])
      setStaff(s.data      || [])
      setTasks(t.data      || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── calculated numbers ────────────────────────────────────────────────────

  // applicants added this calendar month
  const now = new Date()
  const newThisMonth = applicants.filter(a => {
    const d = new Date(a.created_at)
    return d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
  }).length

  // lead → abroad conversions (anyone who reached Abroad stage)
  const conversions = applicants.filter(a => a.stage === 'Abroad').length

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
  // count applicants in each pipeline stage
  const funnelData = [
    { label: 'Lead',      count: applicants.filter(a => a.stage === 'Lead').length,      color: '#ef4444' },
    { label: 'Inquiring', count: applicants.filter(a => a.stage === 'Inquiring').length,  color: '#8b5cf6' },
    { label: 'Class',     count: applicants.filter(a => a.stage === 'Class').length,      color: '#a855f7' },
    { label: 'Abroad',    count: applicants.filter(a => a.stage === 'Abroad').length,     color: theme.primary },
  ]
  // highest count — used to calculate bar width percentage
  const funnelMax = Math.max(...funnelData.map(f => f.count), 1)

  // ── source breakdown ──────────────────────────────────────────────────────
  // how did each applicant hear about us?
  const sourceMap = {}
  applicants.forEach(a => {
    const src = a.source || 'Unknown'
    sourceMap[src] = (sourceMap[src] || 0) + 1
  })
  const sourceTotal = applicants.length || 1

  // colors for each slice of the pie
  const sourceColors = ['#4F46E5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
  const sourceEntries = Object.entries(sourceMap).map(([name, count], i) => ({
    name,
    count,
    pct: Math.round((count / sourceTotal) * 100),
    color: sourceColors[i % sourceColors.length],
  }))

  // ── country breakdown ─────────────────────────────────────────────────────
  const countryList = ['Korea','Australia','Japan','UK','USA','Canada','Finland','Others']
  const countryData = countryList.map(c => {
    const total  = c === 'Others'
      ? applicants.filter(a => !countryList.slice(0,-1).includes(a.country)).length
      : applicants.filter(a => a.country === c).length
    const abroad = c === 'Others'
      ? applicants.filter(a => !countryList.slice(0,-1).includes(a.country) && a.stage === 'Abroad').length
      : applicants.filter(a => a.country === c && a.stage === 'Abroad').length
    return { country: c, total, abroad }
  })
  const countryMax = Math.max(...countryData.map(d => d.total), 1)

  // ── staff performance ─────────────────────────────────────────────────────
  // count assigned applicants and completed tasks per staff member
  const staffWithStats = staff.map(s => ({
    ...s,
    applicantCount: applicants.filter(a => a.assigned_to === s.id).length,
    taskCount:      tasks.filter(t => t.assigned_to === s.id).length,
    doneCount:      tasks.filter(t => t.assigned_to === s.id && t.status === 'done').length,
  }))

  // ── top stat cards ────────────────────────────────────────────────────────
  const topCards = [
    {
      label: 'New This Month',
      value: newThisMonth,
      sub:   'Applicants',
      color: 'black',
   
    },
    {
      label: 'Conversions',
      value: conversions,
      sub:   'Lead → Abroad',
      color: 'black',
  
    },
    {
      label: 'Month Revenue',
      value: `Rs${monthRevenue.toLocaleString()}`,
     
      color: 'black',
     
    },
    {
      label: 'Visa Approvals',
      value: visaApprovals,
      sub:   'This month',
      color: 'black',
     
    },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // role badge style — each role gets a different tint
  const roleBadge = (role) => {
    const map = {
      'C.E.O':       { bg: '#dbeafe', color: '#1d4ed8' },
      'M.D':         { bg: '#ede9fe', color: '#6d28d9' },
      'Visa Officer':{ bg: '#d1fae5', color: '#065f46' },
      'Admin':       { bg: '#fef3c7', color: '#92400e' },
      'Counselor':   { bg: '#fce7f3', color: '#9d174d' },
    }
    return map[role] || { bg: '#f3f4f6', color: '#374151' }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // build a simple SVG donut / pie chart from source data
  // each source gets an arc, legend shows below
  const buildPie = () => {
    if (sourceEntries.length === 0) return null
    const cx = 130, cy = 130, r = 100, inner = 55
    let startAngle = -Math.PI / 2  // start from top

    const slices = sourceEntries.map(entry => {
      const angle = (entry.count / sourceTotal) * 2 * Math.PI
      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(startAngle + angle)
      const y2 = cy + r * Math.sin(startAngle + angle)
      const xi1 = cx + inner * Math.cos(startAngle)
      const yi1 = cy + inner * Math.sin(startAngle)
      const xi2 = cx + inner * Math.cos(startAngle + angle)
      const yi2 = cy + inner * Math.sin(startAngle + angle)
      const largeArc = angle > Math.PI ? 1 : 0
      const path = `
        M ${x1} ${y1}
        A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}
        L ${xi2} ${yi2}
        A ${inner} ${inner} 0 ${largeArc} 0 ${xi1} ${yi1}
        Z
      `
      const midAngle = startAngle + angle / 2
      startAngle += angle
      return { path, color: entry.color, label: entry.name, pct: entry.pct, midAngle }
    })

    return (
      <svg viewBox="0 0 260 260" width="220" height="220">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={2} />
        ))}
        {/* center label */}
        <text x={cx} y={cy - 6} textAnchor="middle"
          fontSize={13} fill={theme.textLight} fontWeight={500}>
          Total
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          fontSize={22} fill={theme.textDark} fontWeight={800}>
          {applicants.length}
        </text>
      </svg>
    )
  }

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
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: theme.textDark,
            margin: 0,
          }}>
           
          </h1>
          <p style={{
            fontSize: 13,
            color: theme.textLight,
            marginTop: 4,
          }}>
            
          </p>
        </div>

        {/* export + print buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
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
            gap: 6,
          }}>
             Export All
          </button>
          <button style={{
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
            gap: 6,
          }}>
             Print Report
          </button>
        </div>
      </div>

      {/* ── top 4 stat cards ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}>
        {topCards.map(card => (
          <div key={card.label} style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderTop: `3px solid ${card.border}`,  // colored top line
            borderRadius: 12,
            padding: '20px',
          }}>
            <p style={{
              fontSize: 13,
              color: theme.textLight,
              margin: '0 0 10px 0',
              fontWeight: 500,
            }}>
              {card.label}
            </p>
            {/* big number */}
            <div style={{
              fontSize: 34,
              fontWeight: 800,
              color: card.color,
              lineHeight: 1,
              marginBottom: 6,
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

      {/* ── row 2: funnel + source pie ────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }}>

        {/* conversion funnel ─────────────────────────────────────────────── */}
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 16 }}></span>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: theme.textDark,
            }}>
              Conversion Funnel
            </span>
          </div>

          {/* bar for each stage */}
          {funnelData.map(stage => (
            <div key={stage.label} style={{ marginBottom: 18 }}>

              {/* count number above bar */}
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: theme.textDark,
                marginBottom: 6,
                textAlign: 'center',
                width: `${Math.max((stage.count / funnelMax) * 100, 8)}%`,
              }}>
                {stage.count}
              </div>

              {/* the colored bar */}
              <div style={{
                height: 36,
                background: theme.pageBg,
                borderRadius: 6,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max((stage.count / funnelMax) * 100, 4)}%`,
                  background: stage.color,
                  borderRadius: 6,
                  minWidth: stage.count > 0 ? 40 : 0,
                  transition: 'width 0.6s ease',
                }} />
              </div>

              {/* label below */}
              <div style={{
                fontSize: 12,
                color: theme.textLight,
                marginTop: 5,
                fontWeight: 500,
              }}>
                {stage.label}
              </div>
            </div>
          ))}
        </div>

        {/* source analysis pie ────────────────────────────────────────────── */}
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 16 }}></span>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: theme.textDark,
            }}>
              Source Analysis
            </span>
          </div>

          {/* pie + legend side by side */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}>

            {/* SVG donut chart */}
            <div style={{ flexShrink: 0 }}>
              {buildPie() || (
                <div style={{
                  width: 180,
                  height: 180,
                  borderRadius: '50%',
                  background: theme.pageBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: theme.textMuted,
                }}>
                  No data
                </div>
              )}
            </div>

            {/* legend dots */}
            <div style={{ flex: 1 }}>
              {sourceEntries.map(entry => (
                <div key={entry.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: entry.color,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 13,
                      color: theme.textMid,
                    }}>
                      {entry.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: entry.color,
                  }}>
                    {entry.pct}%
                  </span>
                </div>
              ))}
              {sourceEntries.length === 0 && (
                <p style={{
                  fontSize: 13,
                  color: theme.textMuted,
                  margin: 0,
                }}>
                  No source data yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── row 3: country bar chart + staff table ────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}>

        {/* country popularity bar chart ───────────────────────────────────── */}
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 16 }}></span>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: theme.textDark,
            }}>
              Country Popularity
            </span>
          </div>

          {/* legend: total vs abroad */}
          <div style={{
            display: 'flex',
            gap: 16,
            marginBottom: 20,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 28,
                height: 10,
                background: '#8b5cf6',
                borderRadius: 2,
              }} />
              <span style={{ fontSize: 12, color: theme.textLight }}>
                Total
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <div style={{
                width: 28,
                height: 10,
                background: theme.primary,
                borderRadius: 2,
              }} />
              <span style={{ fontSize: 12, color: theme.textLight }}>
                Abroad
              </span>
            </div>
          </div>

          {/* vertical bars */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            height: 160,
            paddingBottom: 4,
          }}>
            {countryData.map(d => (
              <div key={d.country} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                height: '100%',
                justifyContent: 'flex-end',
              }}>
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
                    background: '#8b5cf6',
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.5s ease',
                  }} />
                  {/* abroad bar */}
                  <div style={{
                    width: '45%',
                    height: Math.max((d.abroad / countryMax) * 130, d.abroad > 0 ? 4 : 0),
                    background: theme.primary,
                    borderRadius: '3px 3px 0 0',
                    transition: 'height 0.5s ease',
                  }} />
                </div>

                {/* country label */}
                <span style={{
                  fontSize: 10,
                  color: theme.textLight,
                  textAlign: 'center',
                  marginTop: 4,
                  lineHeight: 1.2,
                }}>
                  {d.country}
                </span>
              </div>
            ))}
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
            <span style={{ fontSize: 10, color: theme.textMuted }}>
              {countryMax}
            </span>
          </div>
        </div>

        {/* staff performance table ─────────────────────────────────────────── */}
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 16 }}></span>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: theme.textDark,
            }}>
              Staff Performance
            </span>
          </div>

          {/* table header */}
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
                fontWeight: 600,
                color: theme.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {h}
              </span>
            ))}
          </div>

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
              <div style={{
                fontSize: 14,
                fontWeight: 500,
                color: theme.textDark,
              }}>
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
              <div style={{
                fontSize: 14,
                color: theme.textMid,
                textAlign: 'center',
              }}>
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
          ))}
        </div>

      </div>

      
      </div>

    
  )
}
