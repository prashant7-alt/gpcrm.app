import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const countries = [
  { name: '',     flag: 'Korea' },
  { name: '', flag: 'Australia' },
  { name: '',     flag: 'Japan' },
  { name: '',        flag: 'UK' },
  { name: '',       flag: 'USA' },
  { name: '',    flag: 'Canada' },
  { name: '',   flag: '🇫🇮' },
  { name: '', flag: 'Others' },
]

const feeColor = (status) => {
  if (status === 'Paid')    return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'Pending') return { bg: '#fef9c3', color: '#a16207' }
  if (status === 'Overdue') return { bg: '#fee2e2', color: '#b91c1c' }
  return { bg: '#f3f4f6', color: '#6b7280' }
}

export default function Students() {

  const [students, setStudents] = useState([])
  const [search,   setSearch]   = useState('')
  const [country,  setCountry]  = useState('All')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })
    setStudents(data || [])
    setLoading(false)
  }

  const countByCountry = (name) => {
    if (name === 'Others') {
      const known = countries
        .filter(c => c.code !== 'OTHER')
        .map(c => c.name)
      return students.filter(s => !known.includes(s.country)).length
    }
    return students.filter(s => s.country === name).length
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name?.toLowerCase()
      .includes(search.toLowerCase())
    const matchCountry = country === 'All' || s.country === country
    return matchSearch && matchCountry
  })

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
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
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            style={{
              padding: '8px 14px',
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: theme.textMid,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="All">All Countries</option>
            {countries.map(c => (
              <option key={c.code} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
          <button style={{
            padding: '8px 16px',
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: theme.textMid,
            cursor: 'pointer',
          }}>
             Export
          </button>
        </div>
      </div>

      {/* country cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: 10,
        marginBottom: 24,
      }}>
        {countries.map(c => (
          <div
            key={c.code}
            onClick={() => setCountry(
              country === c.name ? 'All' : c.name
            )}
            style={{
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderTop: country === c.name
                ? `3px solid ${theme.primary}`
                : `3px solid ${theme.border}`,
              borderRadius: 10,
              padding: '14px 10px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{c.flag}</div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: theme.textDark,
              marginBottom: 4,
            }}>
              {c.code}
            </div>
            <div style={{
              fontSize: 20,
              fontWeight: 800,
              color: theme.black,
              marginBottom: 2,
            }}>
              {countByCountry(c.name)}
            </div>
            <div style={{ fontSize: 11, color: theme.textLight }}>
              {c.name}
            </div>
          </div>
        ))}
      </div>

      {/* table */}
      <div style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1.5fr 1fr 1fr 1.5fr',
          padding: '10px 16px',
          background: theme.pageBg,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name','Phone','Country','Class',
            'Fee Status','Stage','Added','Actions'].map(h => (
            <span key={h} style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {loading && (
          <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>
            Loading...
          </p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: theme.textLight,
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}></div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: theme.textMid,
            }}>
              No students found
            </div>
          </div>
        )}

        {filtered.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1.5fr 1fr 1fr 1.5fr',
              padding: '13px 16px',
              borderBottom: i < filtered.length - 1
                ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
            }}
            onMouseEnter={e =>
              e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e =>
              e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: theme.textDark,
            }}>
              {s.name || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {s.phone || '—'}
            </div>
            <div style={{
              fontSize: 13,
              color: theme.textMid,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <span>
                {countries.find(c => c.name === s.country)?.flag || '🌍'}
              </span>
              {s.country || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {s.class || '—'}
            </div>
            <div>
              <span style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: feeColor(s.fee_status).bg,
                color: feeColor(s.fee_status).color,
              }}>
                {s.fee_status
                  ? `Rs${s.fee_paid || 0} ${s.fee_status}`
                  : '—'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {s.stage || '—'}
            </div>
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {s.created_at
                ? new Date(s.created_at).toLocaleDateString()
                : '—'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{
                padding: '5px 12px',
                background: theme.primary,
                border: 'none',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
              }}>
                 View
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomButtons onAdd={load} />
    </div>
  )
}