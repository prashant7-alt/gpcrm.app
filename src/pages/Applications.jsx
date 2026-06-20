import { useState, useEffect, useRef } from 'react'
// useState  → manages the applicants list, search text, status filter, and loading flag
// useEffect → triggers the initial data fetch once on mount
// useRef    → holds a reference to BottomButtons so we can call its openApplicantModal() method

import { supabase } from '../supabase'
// supabase → pre-configured client for querying the applicants table

import theme from '../theme'
// theme → shared design token object (colors, backgrounds, borders)
//         centralised so the whole app reStyles from one file

import BottomButtons from '../components/BottomButtons'
// BottomButtons → modal component that handles Add Applicant form
//                 exposed via ref so this page can open it from the "+ Add Applicant" button


// ── STATUS BADGE COLOR HELPER ─────────────────────────────────────────────────
const badgeStyle = (status) => {
  const map = {
    'Approved': { bg: '#dcfce7',   color: '#15803d' },  // green
    'Pending':  { bg: '#fef9c3',   color: '#a16207' },  // yellow
    'Rejected': { bg: '#fee2e2',   color: '#b91c1c' },  // red
    'New':      { bg: '#dbeafe00', color: 'black'   },  // transparent bg (no badge tint for New)
  }
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' }
  // fallback → gray badge for any unrecognised status value
}
// Defined outside the component so it's not recreated on every render


export default function Applications() {

  // ── STATE ──────────────────────────────────────────────────
  const [list,    setList]    = useState([])     // full list of applicants from Supabase
  const [search,  setSearch]  = useState('')     // live search input value
  const [filter,  setFilter]  = useState('All')  // selected status filter from dropdown
  const [loading, setLoading] = useState(true)   // true until the first DB fetch completes

  // Ref passed to BottomButtons so we can call its imperative method from here
  // (BottomButtons uses forwardRef + useImperativeHandle to expose openApplicantModal)
  const bottomButtonsRef = useRef(null)


  // ── ON MOUNT: fetch applicants ─────────────────────────────
  useEffect(() => {
    load()
  }, [])
  // [] → runs only once after the first render


  // ── DATA FETCH ────────────────────────────────────────────
  async function load() {
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: false })  // newest applicants shown first

    setList(data || [])   // null fallback in case Supabase returns null
    setLoading(false)
  }
  // Also passed as `onAdd` prop to BottomButtons so the list refreshes after a new insert


  // ── CLIENT-SIDE FILTERING ─────────────────────────────────
  const filtered = list.filter(a => {
    // Search: check if applicant's name contains the search string (case-insensitive)
    const matchSearch = a.name?.toLowerCase().includes(search.toLowerCase())
    // ?.toLowerCase() → safe if a.name is null/undefined (returns undefined → falsy → excluded)

    // Filter: 'All' shows everyone; otherwise match the selected status exactly
    const matchFilter = filter === 'All' || a.status === filter

    // Both conditions must be true for the row to appear
    return matchSearch && matchFilter
  })
  // Derived from `list` on every render — no extra state needed
  // Runs entirely client-side (no extra DB calls when typing or changing filter)


  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── PAGE HEADER ─────────────────────────────────── */}
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
            {/* Shows count of ALL applicants, not just the filtered subset */}
          </p>
        </div>

        {/* Opens the Add Applicant modal inside BottomButtons via the ref */}
        <button
          onClick={() => bottomButtonsRef.current?.openApplicantModal()}
          // ?.openApplicantModal() → safe call; does nothing if ref isn't attached yet
          style={{
            padding: '9px 16px', background: theme.primary,
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}
        >
          + Add Applicant
        </button>
      </div>


      {/* ── SEARCH + FILTER BAR ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>

        {/* Search input — wrapped in a styled div to allow a search icon on the left */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', flex: 1,  // takes remaining width
        }}>
          <span style={{ color: theme.textMuted }}></span>  {/* search icon */}
          <input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}  // updates search state on every keystroke
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, width: '100%',
            }}
          />
        </div>

        {/* Status filter dropdown */}
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}  // updates filter state
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


      {/* ── APPLICANTS TABLE ─────────────────────────────── */}
      <div style={{
        background: theme.cardBg, border: `1px solid ${theme.border}`,
        borderRadius: 10, overflow: 'hidden',  // clips row hover bg at rounded corners
      }}>

        {/* Table header — CSS grid with 5 columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',  // Name gets most space
          padding: '10px 16px',
          background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name', 'Course', 'Country', 'Status', 'Date'].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 600, color: theme.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Loading state */}
        {loading && (
          <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>Loading...</p>
        )}

        {/* Empty state — only shown when loading is done but no rows match */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
              No applicants found
            </div>
          </div>
        )}

        {/* Data rows — one grid row per applicant in the filtered list */}
        {filtered.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr',  // must match header columns
              padding: '13px 16px',
              // Divider under every row except the last
              borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
            }}
            // Inline hover effect without needing a CSS class
            onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Name + email (two lines in the first column) */}
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

            {/* Status badge — color driven by badgeStyle() helper */}
            <div>
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: badgeStyle(a.status).bg,
                color:      badgeStyle(a.status).color,
              }}>
                {a.status || 'New'}  {/* fallback label if status is null */}
              </span>
            </div>

            {/* Created date — formatted to locale string (e.g. "6/20/2026") */}
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {a.created_at
                ? new Date(a.created_at).toLocaleDateString()
                : '—'}
            </div>
          </div>
        ))}
      </div>


      {/* BottomButtons renders the Add Applicant modal
          ref={bottomButtonsRef} → lets us call openApplicantModal() from the button above
          onAdd={load}           → BottomButtons calls this after a successful insert
                                   so the table refreshes with the new row */}
      <BottomButtons ref={bottomButtonsRef} onAdd={load} />

    </div>
  )
}