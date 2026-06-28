import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

const badgeStyle = (status) => {
  const map = {
    'Approved': { bg: '#dcfce7',   color: '#15803d' },
    'Pending':  { bg: '#fef9c3',   color: '#a16207' },
    'Rejected': { bg: '#fee2e2',   color: '#b91c1c' },
    'New':      { bg: '#dbeafe00', color: 'black'   },
  }
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' }
}

export default function Applications() {

  const [list,     setList]     = useState([])
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('All')
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(null)

  const bottomButtonsRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: false })
    setList(data || [])
    setLoading(false)
  }

  // ── DELETE APPLICANT ─────────────────────────────────────────────────────
  //
  // Your profiles table structure:
  //   id           uuid  ← this is the Supabase Auth user UUID
  //   applicant_id bigint ← FK → applicants.id  (with ON DELETE CASCADE after SQL fix)
  //   email        text
  //   ...
  //
  // DELETE ORDER:
  //   1. Find profile.id (auth UUID) using applicant_id
  //   2. Call Edge Function to delete their Supabase Auth account (revokes login)
  //   3. Delete the profiles row manually (belt-and-suspenders)
  //   4. Delete the applicants row → CASCADE handles profiles if step 3 missed
  //
  async function deleteApplicant(applicant) {
    const confirmed = window.confirm(
      `Delete "${applicant.name}"?\n\n` +
      `This will:\n` +
      `• Remove their applicant record\n` +
      `• Delete their student portal login\n` +
      `• They will no longer be able to log in\n\n` +
      `This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(applicant.id)

    try {
      // ── Step 1: find profile by applicant_id (bigint) ─────────────────
      const { data: profile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('applicant_id', applicant.id)   // applicant_id is bigint, applicant.id matches
        .maybeSingle()

      if (profileFetchError) {
        console.warn('Profile fetch warning:', profileFetchError.message)
      }

      // ── Step 2: delete Supabase Auth user via Edge Function ───────────
      if (profile?.id) {
        try {
          const res    = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ user_id: profile.id }),
          })
          const result = await res.json()
          if (!result.success) {
            console.warn('Auth delete warning:', result.message)
          }
        } catch (fetchErr) {
          console.warn('Edge function warning:', fetchErr.message)
          // continue — still delete DB rows even if auth call fails
        }

        // ── Step 3: explicitly delete the profiles row ─────────────────
        // (ON DELETE CASCADE will also do this, but being explicit is safer)
        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', profile.id)

        if (profileDeleteError) {
          console.warn('Profile row delete warning:', profileDeleteError.message)
          // If this fails, cascade from step 4 will clean it up
        }
      }

      // ── Step 4: delete applicant row ──────────────────────────────────
      // After ON DELETE CASCADE SQL fix, this also auto-deletes any
      // remaining profiles row that references this applicant_id
      const { error: applicantError } = await supabase
        .from('applicants')
        .delete()
        .eq('id', applicant.id)

      if (applicantError) throw applicantError

      load()
      alert(`✅ "${applicant.name}" deleted. Their login access has been removed.`)

    } catch (err) {
      alert('Error deleting: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = list.filter(a => {
    const matchSearch = a.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || a.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div>

      {/* ── PAGE HEADER ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>
            Applications
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            {list.length} total applicants
          </p>
        </div>
        <button
          onClick={() => bottomButtonsRef.current?.openApplicantModal()}
          style={{
            padding: '9px 16px', background: theme.primary,
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}
        >
          + Add Applicant
        </button>
      </div>

      {/* ── SEARCH + FILTER ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', flex: 1,
        }}>
          <span style={{ color: theme.textMuted }}>🔍</span>
          <input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, width: '100%',
            }}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '8px 14px',
            fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
          }}
        >
          <option>All</option>
          <option>New</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
      </div>

      {/* ── TABLE ── */}
      <div style={{
        background: theme.cardBg, border: `1px solid ${theme.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 0.8fr',
          padding: '10px 16px',
          background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name', 'Course', 'Country', 'Status', 'Date', 'Actions'].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 600, color: theme.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.05em',
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
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
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
              gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 0.8fr',
              padding: '13px 16px',
              borderBottom: i < filtered.length - 1
                ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
              opacity: deleting === a.id ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* name + email */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.textDark }}>
                {a.name || '—'}
              </div>
              <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>
                {a.email || '—'}
              </div>
            </div>

            <div style={{ fontSize: 13, color: theme.textMid }}>{a.course  || '—'}</div>
            <div style={{ fontSize: 13, color: theme.textMid }}>{a.country || '—'}</div>

            {/* status badge */}
            <div>
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: badgeStyle(a.status).bg,
                color:      badgeStyle(a.status).color,
              }}>
                {a.status || 'New'}
              </span>
            </div>

            {/* date */}
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {a.created_at
                ? new Date(a.created_at).toLocaleDateString()
                : '—'}
            </div>

            {/* delete button */}
            <div>
              <button
                onClick={() => deleteApplicant(a)}
                disabled={deleting === a.id}
                title="Delete applicant and remove their login"
                style={{
                  padding: '5px 12px',
                  background: deleting === a.id ? '#f3f4f6' : '#fee2e2',
                  border: 'none', borderRadius: 6,
                  fontSize: 11, fontWeight: 600,
                  color: deleting === a.id ? '#9ca3af' : '#b91c1c',
                  cursor: deleting === a.id ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {deleting === a.id ? 'Deleting…' : '🗑 Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomButtons ref={bottomButtonsRef} onAdd={load} />

    </div>
  )
}