import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { statusChip } from '../lib/statusColors'
import { exportRows, asDate } from '../lib/exportCsv'
import StudentDetailModal from '../components/StudentDetailModal'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'
import { COUNTRIES, COUNTRY_CODES, DEFAULT_VISA_RATES, fetchVisaRates } from '../lib/visaRates'
import { Eye, Globe, Search } from 'lucide-react'

// Same shared status colours as the rest of the app (src/lib/statusColors.js).
const stageStyle = (stage) => statusChip(stage || 'New')

export default function Students() {
  const isMobile = useIsMobile()

  const [students,        setStudents]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [countryFilter,   setCountryFilter]   = useState('All Countries')
  const [search,          setSearch]          = useState('')
  const [viewStudent,     setViewStudent]     = useState(null)
  const [visaRates,       setVisaRates]       = useState(DEFAULT_VISA_RATES)

  useEffect(() => { load() }, [])
  useEffect(() => { fetchVisaRates().then(setVisaRates) }, [])
  useRefetchOnFocus(load)

  async function load() {
    setLoading(true)

    const [{ data: apps }, { data: profs }] = await Promise.all([
      supabase.from('applicants').select('*').order('created_at', { ascending: false }),
      // Students edit their own name / phone in the student portal — that
      // saves to `profiles` (phone_new), NOT `applicants`. Pull those rows so
      // staff see the up-to-date values instead of the stale applicant record.
      supabase.from('profiles').select('email, name, phone_new, phone').eq('role', 'student'),
    ])

    const profByEmail = {}
    ;(profs || []).forEach(p => {
      const k = (p.email || '').trim().toLowerCase()
      if (k) profByEmail[k] = p
    })

    const merged = (apps || []).map(a => {
      const p = profByEmail[(a.email || '').trim().toLowerCase()]
      if (!p) return a
      return {
        ...a,
        name:  p.name || a.name,
        phone: p.phone_new || p.phone || a.phone,
      }
    })

    setStudents(merged)
    setLoading(false)
  }

  // count per country card
  const countryCounts = {}
  COUNTRIES.forEach(c => { countryCounts[c] = 0 })
  countryCounts['Others'] = 0
  students.forEach(s => {
    const c = s.country || ''
    if (COUNTRIES.includes(c)) countryCounts[c]++
    else if (c) countryCounts['Others']++
  })

  const uniqueCountries = ['All Countries', ...new Set(students.map(s => s.country).filter(Boolean))]

  const filtered = students.filter(s => {
    const matchSearch = (
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.country?.toLowerCase().includes(search.toLowerCase())
    )
    const matchCountry = selectedCountry
      ? selectedCountry === 'Others'
        ? !COUNTRIES.includes(s.country || '')
        : s.country === selectedCountry
      : countryFilter === 'All Countries'
      ? true
      : s.country === countryFilter

    return matchSearch && matchCountry
  })

  const handleCountryCard = (country) => {
    if (selectedCountry === country) {
      setSelectedCountry(null)
      setCountryFilter('All Countries')
    } else {
      setSelectedCountry(country)
      setCountryFilter(country)
    }
  }

  const tableCols = '1.8fr 1.1fr 1fr 1.3fr 1.1fr 0.9fr 88px'

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 12 : 0,
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>
            Students
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            Enrolled and studying students
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
          <select
            value={countryFilter}
            onChange={e => {
              setCountryFilter(e.target.value)
              setSelectedCountry(e.target.value === 'All Countries' ? null : e.target.value)
            }}
            style={{
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: 8, padding: '8px 14px',
              fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            {uniqueCountries.map(c => <option key={c}>{c}</option>)}
          </select>
          <button
            onClick={() => exportRows('students', filtered, [
              { header: 'Name',    value: s => s.name },
              { header: 'Email',   value: s => s.email },
              { header: 'Phone',   value: s => s.phone },
              { header: 'Country', value: s => s.country },
              { header: 'Course',  value: s => s.course },
              { header: 'Stage',   value: s => stageStyle(s.status).label },
              { header: 'Added',   value: s => asDate(s.created_at) },
            ])}
            style={{
              padding: '8px 16px', background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: 8, fontSize: 13, color: theme.textMid, cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Export
          </button>
        </div>
      </div>

      {/* country cards — horizontal scroll works fine on both, just tightened on mobile */}
      <div style={{
        display: 'flex', gap: isMobile ? 8 : 12, marginBottom: 20,
        overflowX: 'auto', paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
      }}>
        {[...COUNTRIES, 'Others'].map(country => {
          const count    = countryCounts[country] || 0
          const isActive = selectedCountry === country
          return (
            <div
              key={country}
              onClick={() => handleCountryCard(country)}
              style={{
                minWidth: isMobile ? 96 : 120,
                padding: isMobile ? '12px 14px' : '16px 20px',
                background: isActive ? theme.status.info.bg : theme.white,
                border: `1px solid ${isActive ? theme.primary : theme.border}`,
                borderRadius: 12, textAlign: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                height: isMobile ? 22 : 26, marginBottom: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {COUNTRY_CODES[country] ? (
                  <img
                    src={`https://flagcdn.com/w40/${COUNTRY_CODES[country]}.png`}
                    alt={country}
                    style={{
                      width: isMobile ? 28 : 32, height: isMobile ? 19 : 22,
                      objectFit: 'cover', borderRadius: 3,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                    }}
                  />
                ) : (
                  <Globe size={isMobile ? 18 : 22} style={{ color: theme.textMuted }} />
                )}
              </div>
              <div style={{
                fontSize: isMobile ? 13 : 15, fontWeight: 700,
                color: isActive ? theme.primary : theme.textDark,
                marginBottom: 6, whiteSpace: 'nowrap',
              }}>
                {country}
              </div>
              <div style={{
                fontSize: isMobile ? 22 : 28, fontWeight: 800,
                color: isActive ? theme.primary : theme.status.danger.text,
              }}>
                {count}
              </div>
              {visaRates[country] != null && (
                <div style={{
                  marginTop: 5, fontSize: isMobile ? 10 : 11, fontWeight: 600,
                  color: theme.textMuted, whiteSpace: 'nowrap',
                }}>
                  Visa rate{' '}
                  <span style={{ color: theme.status.success.text, fontWeight: 700 }}>
                    {visaRates[country]}%
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* search + active filter tag */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 16, alignItems: isMobile ? 'stretch' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.white, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', flex: 1,
        }}>
          <Search size={15} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input
            placeholder="Search by name, phone, email, country..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, width: '100%',
            }}
          />
        </div>

        {selectedCountry && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: isMobile ? 'space-between' : 'flex-start',
            padding: '6px 14px',
            background: theme.status.info.bg, border: `1px solid ${theme.primary}`,
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: theme.primary,
          }}>
            {selectedCountry}
            <span
              onClick={() => { setSelectedCountry(null); setCountryFilter('All Countries') }}
              style={{ cursor: 'pointer', fontWeight: 800 }}
            >
              x
            </span>
          </div>
        )}
      </div>

      {/* results count */}
      {selectedCountry && (
        <p style={{ fontSize: 13, color: theme.textLight, marginBottom: 12 }}>
          Showing {filtered.length} student{filtered.length !== 1 ? 's' : ''} going to {selectedCountry}
        </p>
      )}

      {/* table / cards */}
      <div style={{
        background: theme.white, border: `1px solid ${theme.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>

        {/* column header row — desktop only */}
        {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: tableCols,
            padding: '10px 18px',
            background: theme.pageBg || theme.pageBg,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            {['Name', 'Phone', 'Country', 'Course', 'Stage', 'Added', ''].map((h, hi) => (
              <span key={h || hi} style={{
                fontSize: 11, fontWeight: 700, color: theme.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {h}
              </span>
            ))}
          </div>
        )}

        {loading && (
          <p style={{ padding: 20, fontSize: 13, color: theme.textLight }}>Loading...</p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
              {selectedCountry
                ? `No students found going to ${selectedCountry}`
                : 'No students found'}
            </div>
          </div>
        )}

        {filtered.map((s, i) => (
          isMobile ? (
            // ── Mobile card ──
            <div
              key={s.id}
              onClick={() => setViewStudent(s)}
              style={{
                padding: '14px 18px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
                display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.textDark }}>
                    {s.name || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, wordBreak: 'break-all' }}>
                    {s.email || '—'}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600, flexShrink: 0,
                  background: stageStyle(s.status).bg,
                  color:      stageStyle(s.status).color,
                }}>
                  {stageStyle(s.status).label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMid, flexWrap: 'wrap' }}>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Phone: </b>{s.phone || '—'}</span>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Country: </b>{s.country || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMid, flexWrap: 'wrap' }}>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Course: </b>{s.course || '—'}</span>
                <span style={{ color: theme.textLight }}>
                  {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                </span>
              </div>

              <button
                onClick={e => { e.stopPropagation(); setViewStudent(s) }}
                style={{
                  marginTop: 2, alignSelf: 'flex-start',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', background: theme.primaryLight,
                  border: `1px solid ${theme.border}`, borderRadius: 8,
                  fontSize: 12, fontWeight: 600, color: theme.primary, cursor: 'pointer',
                }}
              >
                <Eye size={13} /> View full details
              </button>
            </div>
          ) : (
            // ── Desktop row ──
            <div
              key={s.id}
              onClick={() => setViewStudent(s)}
              style={{
                display: 'grid',
                gridTemplateColumns: tableCols,
                padding: '13px 18px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
                alignItems: 'center', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = theme.pageBg || theme.pageBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.textDark }}>
                  {s.name || '—'}
                </div>
                <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>
                  {s.email || '—'}
                </div>
              </div>

              <div style={{ fontSize: 13, color: theme.textMid }}>{s.phone   || '—'}</div>
              <div style={{ fontSize: 13, color: theme.textMid }}>{s.country || '—'}</div>
              <div style={{ fontSize: 13, color: theme.textMid }}>{s.course  || '—'}</div>

              <div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: stageStyle(s.status).bg,
                  color:      stageStyle(s.status).color,
                }}>
                  {stageStyle(s.status).label}
                </span>
              </div>

              <div style={{ fontSize: 12, color: theme.textLight }}>
                {s.created_at
                  ? new Date(s.created_at).toLocaleDateString()
                  : '—'}
              </div>

              <button
                onClick={e => { e.stopPropagation(); setViewStudent(s) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', background: theme.primaryLight,
                  border: `1px solid ${theme.border}`, borderRadius: 7,
                  fontSize: 12, fontWeight: 600, color: theme.primary, cursor: 'pointer',
                }}
              >
                <Eye size={13} /> View
              </button>
            </div>
          )
        ))}
      </div>

      {viewStudent && (
        <StudentDetailModal
          student={viewStudent}
          onClose={() => setViewStudent(null)}
        />
      )}

    </div>
  )
}