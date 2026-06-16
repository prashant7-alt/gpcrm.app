import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const badgeStyle = (status) => {
  const map = {
    'Approved': { bg: '#dcfce7', color: '#15803d' },
    'Pending':  { bg: '#fef9c3', color: '#a16207' },
    'Rejected': { bg: '#fee2e2', color: '#b91c1c' },
    'New':      { bg: '#dbeafe', color: '#1d4ed8' },
  }
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' }
}

export default function Applications() {

  const [list,    setList]    = useState([])
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('All')
  const [loading, setLoading] = useState(true)

  // ref to call openApplicantModal() inside BottomButtons
  const bottomButtonsRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: false })
    setList(data || [])
    setLoading(false)
  }

  const filtered = list.filter(a => {
    const matchSearch = a.name?.toLowerCase()
      .includes(search.toLowerCase())
    const matchFilter = filter === 'All' || a.status === filter
    return matchSearch && matchFilter
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
            Applications
          </h1>
          <p style={{
            fontSize: 13,
            color: theme.textLight,
            marginTop: 4,
          }}>
            {list.length} total applicants
          </p>
        </div>
        <button
          onClick={() => bottomButtonsRef.current?.openApplicantModal()}
          style={{
            padding: '9px 16px',
            background: theme.primary,
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          + Add Applicant
        </button>
      </div>

      {/* search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: '8px 14px',
          flex: 1,
        }}>
          <span style={{ color: theme.textMuted }}>🔍</span>
          <input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: theme.textMid,
              width: '100%',
            }}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            color: theme.textMid,
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option>All</option>
          <option>New</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
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
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
          padding: '10px 16px',
          background: theme.pageBg,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name','Course','Country','Status','Date'].map(h => (
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
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
              No applicants found
            </div>
          </div>
        )}

        {filtered.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',
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
            <div>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                color: theme.textDark,
              }}>
                {a.name || '—'}
              </div>
              <div style={{
                fontSize: 11,
                color: theme.textLight,
                marginTop: 2,
              }}>
                {a.email || '—'}
              </div>
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {a.course || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {a.country || '—'}
            </div>
            <div>
              <span style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: badgeStyle(a.status).bg,
                color: badgeStyle(a.status).color,
              }}>
                {a.status || 'New'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {a.created_at
                ? new Date(a.created_at).toLocaleDateString()
                : '—'}
            </div>
          </div>
        ))}
      </div>

      <BottomButtons ref={bottomButtonsRef} onAdd={load} />
    </div>
  )
}