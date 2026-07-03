import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'

const COUNTRIES = ['Korea', 'Australia', 'Japan', 'UK', 'USA', 'Canada', 'Finland']

const stageStyle = (stage) => {
  const map = {
    'New':            { bg: '#dbeafe', color: '#1d4ed8' },
    'Lead':           { bg: '#f3f4f6', color: '#6b7280' },
    'Inquiring':      { bg: '#ede9fe', color: '#7c3aed' },
    'Counseling':     { bg: '#fef9c3', color: '#a16207' },
    'Documentation':  { bg: '#ffedd5', color: '#ea580c' },
    'Applied':        { bg: '#dbeafe', color: '#2563eb' },
    'Visa Process':   { bg: '#cffafe', color: '#0891b2' },
    'Class/Enrolled': { bg: '#ede9fe', color: '#7c3aed' },
    'Abroad':         { bg: '#dcfce7', color: '#15803d' },
    'Approved':       { bg: '#dcfce7', color: '#15803d' },
    'Rejected':       { bg: '#fee2e2', color: '#b91c1c' },
  }
  return map[stage] || { bg: '#f3f4f6', color: '#6b7280' }
}

export default function Students() {

  const [students,        setStudents]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [countryFilter,   setCountryFilter]   = useState('All Countries')
  const [search,          setSearch]          = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // read from applicants table instead of students
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: false })
    setStudents(data || [])
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

  // unique countries from actual data for dropdown
  const uniqueCountries = ['All Countries', ...new Set(students.map(s => s.country).filter(Boolean))]

  // filter
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

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>
            Students
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            Enrolled and studying students
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={countryFilter}
            onChange={e => {
              setCountryFilter(e.target.value)
              setSelectedCountry(e.target.value === 'All Countries' ? null : e.target.value)
            }}
            style={{
              background: '#fff', border: `1px solid ${theme.border}`,
              borderRadius: 8, padding: '8px 14px',
              fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
            }}
          >
            {uniqueCountries.map(c => <option key={c}>{c}</option>)}
          </select>
          <button style={{
            padding: '8px 16px', background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8, fontSize: 13, color: theme.textMid, cursor: 'pointer',
          }}>
            Export
          </button>
        </div>
      </div>

      {/* country cards */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20,
        overflowX: 'auto', paddingBottom: 4,
      }}>
        {[...COUNTRIES, 'Others'].map(country => {
          const count    = countryCounts[country] || 0
          const isActive = selectedCountry === country
          return (
            <div
              key={country}
              onClick={() => handleCountryCard(country)}
              style={{
                minWidth: 120, padding: '16px 20px',
                background: isActive ? '#dbeafe' : '#fff',
                border: `1px solid ${isActive ? '#2563eb' : theme.border}`,
                borderRadius: 12, textAlign: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: isActive ? '#2563eb' : theme.textDark,
                marginBottom: 6,
              }}>
                {country}
              </div>
              <div style={{
                fontSize: 28, fontWeight: 800,
                color: isActive ? '#2563eb' : '#b91c1c',
              }}>
                {count}
              </div>
            </div>
          )
        })}
      </div>

      {/* search + active filter tag */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', flex: 1,
        }}>
          <span style={{ color: theme.textMuted }}>&#128269;</span>
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
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px',
            background: '#dbeafe', border: '1px solid #2563eb',
            borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#2563eb',
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

      {/* table */}
      <div style={{
        background: '#fff', border: `1px solid ${theme.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>

        {/* header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr 1.2fr 1fr',
          padding: '10px 18px',
          background: theme.pageBg || '#f9fafb',
          borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name', 'Phone', 'Country', 'Course', 'Stage', 'Added'].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 600, color: theme.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

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
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.2fr 1.5fr 1.2fr 1fr',
              padding: '13px 18px',
              borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.pageBg || '#f9fafb'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* name + email */}
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

            {/* stage badge */}
            <div>
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: stageStyle(s.status).bg,
                color:      stageStyle(s.status).color,
              }}>
                {s.status || 'New'}
              </span>
            </div>

            <div style={{ fontSize: 12, color: theme.textLight }}>
              {s.created_at
                ? new Date(s.created_at).toLocaleDateString()
                : '—'}
            </div>
          </div>
        ))}
      </div>
        
    </div>
  )
}