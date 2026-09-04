import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { supabase, functionHeaders } from '../supabase'
import theme from '../theme'
import { statusChip } from '../lib/statusColors'
import BottomButtons from '../components/BottomButtons'
import Pagination from '../components/Pagination'
import { createApplicantWithLogin } from '../lib/createApplicant'
import { useIsMobile } from '../hooks/useIsMobile'
import { usePagination } from '../hooks/usePagination'
import { useRefetchOnFocus, useRefreshHold } from '../hooks/useRefetchOnFocus'
import { useFormDraft, hasFormDraft } from '../hooks/useFormDraft'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

const COUNTRY_OPTIONS = [
  'Korea', 'Australia', 'Japan', 'UK', 'USA',
  'Canada', 'Finland', 'Germany', 'France', 'New Zealand',
  'Ireland', 'Malta', 'Cyprus', 'Hungary', 'Poland',
  'Czech Republic', 'Italy', 'Portugal', 'Sweden', 'Denmark',
  'Norway', 'Netherlands', 'Belgium', 'Switzerland', 'Spain', 'Other',
]

const STATUS_OPTIONS = [
  'New', 'Pending', 'Approved', 'Rejected',
  'Inquiring', 'Counseling', 'Documentation',
  'Applied', 'Visa Process', 'Class/Enrolled', 'Abroad',
]

// Pipeline stage badges. Outcome states (Approved / Pending / Rejected) and the
// early stages come from the shared status system; the "active work" stages use
// the teal accent so the pipeline still reads left-to-right at a glance.
const stageTeal = {
  bg: theme.accentLight, color: theme.accentHover, border: 'rgba(21,154,156,0.28)',
}
const badgeStyle = (status) => {
  const teal = ['Documentation', 'Applied', 'Visa Process']
  if (teal.includes(status)) return stageTeal
  return statusChip(status)
}

export default function Applications() {
  const isMobile = useIsMobile()

  const [list,       setList]       = useState([])
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('All')
  const [country,    setCountry]    = useState('All')
  const [loading,    setLoading]    = useState(true)
  const [deleting,   setDeleting]   = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [saving,     setSaving]     = useState(false)
  // The "Add Applicant" draft survives navigating away & back (and reloads).
  // `password` is deliberately never written to storage.
  const [showAdd, setShowAdd] = useState(() => hasFormDraft('applications:add'))
  const [form, setForm] = useFormDraft(
    'applications:add',
    { name: '', email: '', phone: '', course: '', country: '', password: '' },
    showAdd,
    { omit: ['password'] },
  )

  useEffect(() => { load() }, [])
  useRefetchOnFocus(load)
  useRefreshHold(showAdd)

  async function load() {
    const { data } = await supabase
      .from('applicants')
      .select('*')
      .order('created_at', { ascending: false })
    setList(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function addApplicant() {
    if (!form.name.trim())  return alert('Name is required')
    if (!form.email.trim()) return alert('Email is required so the student can log in')
    if (!form.password || form.password.length < 8) return alert('Password must be at least 8 characters')

    setSaving(true)
    const { name, email, password } = form
    const result = await createApplicantWithLogin({
      name, email, password,
      phone: form.phone, course: form.course, country: form.country,
    })
    setSaving(false)

    if (!result.ok)      { alert(result.message); return }
    if (result.warning)  alert(result.warning)

    setShowAdd(false)
    setForm({ name: '', email: '', phone: '', course: '', country: '', password: '' })
    load()

    alert(
      `Applicant added and student login created!\n\n` +
      `Name:     ${name}\n` +
      `Email:    ${email}\n` +
      `Password: ${password}\n\n` +
      `A welcome email with these login details has been sent to the student.`
    )
  }

  async function updateStatus(applicant, newStatus) {
    if (newStatus === applicant.status) return
    setUpdatingId(applicant.id)

    const { error } = await supabase
      .from('applicants')
      .update({ status: newStatus })
      .eq('id', applicant.id)

    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      setList(prev => prev.map(a => a.id === applicant.id ? { ...a, status: newStatus } : a))
    }
    setUpdatingId(null)
  }

  async function deleteApplicant(applicant) {
    const confirmed = window.confirm(
      `Delete "${applicant.name}"?\n\nThis removes their applicant record AND their student login — ` +
      `they will no longer be able to sign in. This cannot be undone.`
    )
    if (!confirmed) return
    setDeleting(applicant.id)
    try {
      // Call delete-user directly with applicant_id + email — the function
      // already resolves the login by applicant_id first, then by email, so
      // there's no need to look up the profile id here first (that was a
      // redundant round-trip doing the exact same lookup the function does).
      // It's a no-op success when there's genuinely no login to remove.
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
          method:  'POST',
          headers: await functionHeaders(),
          body: JSON.stringify({
            email:        applicant.email ? applicant.email.trim().toLowerCase() : null,
            applicant_id: applicant.id,
          }),
        })
        const result = await res.json()

        if (!res.ok || !result?.success) {
          alert(
            `Could not remove this student's login: ${result?.message || 'Unknown error'}\n\n` +
            `Nothing was deleted, so the student can still sign in. ` +
            `Please try again, or check the delete-user function logs in Supabase.`
          )
          setDeleting(null)
          return
        }
      } catch (fnErr) {
        alert(
          `Network error while removing the student's login: ${fnErr.message}\n\n` +
          `Nothing was deleted, so the student can still sign in. Please try again.`
        )
        setDeleting(null)
        return
      }

      // Clear child rows that FK to applicants.id before deleting the applicant.
      // student_documents has a real FK; payments / appointments key on loose
      // email text (no FK) so they don't block the delete. These two deletes
      // are independent, so run them together instead of one after the other.
      await Promise.all([
        supabase.from('student_documents').delete().eq('applicant_id', applicant.id),
        applicant.email
          ? supabase.from('student_documents').delete().ilike('student_email', applicant.email.trim())
          : Promise.resolve(),
      ])

      const { error: delErr } = await supabase.from('applicants').delete().eq('id', applicant.id)
      if (delErr) {
        // A lingering FK from another table, or RLS. The login was already
        // handled above; report so it doesn't look like it worked.
        alert(
          `The student's login was removed, but the applicant record could not be deleted:\n` +
          `${delErr.message}\n\nRefresh and try Delete again.`
        )
      }
      load()
    } catch (err) {
      alert('Error deleting: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const countryOptions = ['All', ...new Set(list.map(a => a.country).filter(Boolean))]

  const filtered = list.filter(a => {
    const matchSearch  = a.name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter  = filter  === 'All' || a.status  === filter
    const matchCountry = country === 'All' || a.country === country
    return matchSearch && matchFilter && matchCountry
  })

  const pg = usePagination(filtered, { pageSize: 20, resetKey: `${search}|${filter}|${country}` })
  const rows = pg.pageItems

  const tableCols = '2fr 1.5fr 1.5fr 1fr 1fr 0.8fr'

  return (
    <div>
      {/* header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 12 : 0,
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>Applications</h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>{list.length} total applicants</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '9px 16px', background: theme.primary,
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer',
          width: isMobile ? '100%' : 'auto',
        }}>
          + Add Applicant
        </button>
      </div>

      {/* filters */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 10, marginBottom: 16,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', flex: 1,
        }}>
          <Search size={16} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: theme.textMid, width: '100%' }}
          />
        </div>

        <select value={filter} onChange={e => setFilter(e.target.value)} style={{
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
          width: isMobile ? '100%' : 'auto',
        }}>
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select value={country} onChange={e => setCountry(e.target.value)} style={{
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
          width: isMobile ? '100%' : 'auto',
        }}>
          {countryOptions.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* table / cards */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}>

        {!isMobile && (
          <div style={{
            display: 'grid', gridTemplateColumns: tableCols,
            padding: '10px 16px', background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
          }}>
            {['Name','Course','Country','Status','Date','Actions'].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
        )}

        {loading && <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>Loading...</p>}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>No applicants found</div>
          </div>
        )}

        {rows.map((a, i) => (
          isMobile ? (
            // ── Mobile card ──
            <div key={a.id} style={{
              padding: '14px 16px',
              borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none',
              opacity: deleting === a.id ? 0.5 : 1,
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.textDark }}>{a.name || '—'}</div>
                  <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, wordBreak: 'break-all' }}>{a.email || '—'}</div>
                </div>
                <select
                  value={a.status || 'New'}
                  onChange={e => updateStatus(a, e.target.value)}
                  disabled={updatingId === a.id}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: badgeStyle(a.status).bg, color: badgeStyle(a.status).color,
                    border: 'none', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
                    cursor: updatingId === a.id ? 'not-allowed' : 'pointer',
                    opacity: updatingId === a.id ? 0.6 : 1, fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMid, flexWrap: 'wrap' }}>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Course: </b>{a.course || '—'}</span>
                <span><b style={{ color: theme.textMuted, fontWeight: 600 }}>Country: </b>{a.country || '—'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: theme.textLight }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                </span>
                <button
                  onClick={() => deleteApplicant(a)}
                  disabled={deleting === a.id}
                  style={{
                    padding: '6px 14px',
                    background: deleting === a.id ? theme.surfaceAlt : theme.status.danger.bg,
                    border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    color: deleting === a.id ? theme.textMuted : theme.status.danger.text,
                    cursor: deleting === a.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {deleting === a.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            // ── Desktop row ──
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: tableCols,
              padding: '13px 16px',
              borderBottom: i < rows.length - 1 ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center', opacity: deleting === a.id ? 0.5 : 1,
            }}
              onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: theme.textDark }}>{a.name || '—'}</div>
                <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>{a.email || '—'}</div>
              </div>
              <div style={{ fontSize: 13, color: theme.textMid }}>{a.course  || '—'}</div>
              <div style={{ fontSize: 13, color: theme.textMid }}>{a.country || '—'}</div>

              <div>
                <select
                  value={a.status || 'New'}
                  onChange={e => updateStatus(a, e.target.value)}
                  disabled={updatingId === a.id}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    background: badgeStyle(a.status).bg,
                    color: badgeStyle(a.status).color,
                    border: 'none',
                    outline: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    cursor: updatingId === a.id ? 'not-allowed' : 'pointer',
                    opacity: updatingId === a.id ? 0.6 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: 12, color: theme.textLight }}>
                {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
              </div>
              <button
                onClick={() => deleteApplicant(a)}
                disabled={deleting === a.id}
                style={{
                  padding: '5px 10px',
                  background: deleting === a.id ? theme.surfaceAlt : theme.status.danger.bg,
                  border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  color: deleting === a.id ? theme.textMuted : theme.status.danger.text,
                  cursor: deleting === a.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {deleting === a.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )
        ))}
      </div>

      <Pagination {...pg} onPage={pg.setPage} noun="applicants" />

      {/* add modal */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: isMobile ? '14px 14px 0 0' : 14,
            padding: isMobile ? 20 : 28,
            width: isMobile ? '100%' : 440,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>Add New Applicant</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'inline-flex' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '10px 14px', background: theme.status.info.bg, border: `1px solid ${theme.status.info.border}`, borderRadius: 8, fontSize: 12, color: theme.primary, marginBottom: 18 }}>
              ℹ️ This creates the applicant record and a student login account in one step.
            </div>

            {[
              { label: 'Full Name *',              key: 'name',     placeholder: 'Ram Sharma',          type: 'text'     },
              { label: 'Email * (for login)',       key: 'email',   placeholder: 'ram@email.com',        type: 'email'    },
              { label: 'Login Password * (min 8)', key: 'password', placeholder: 'Set student password', type: 'text'     },
              { label: 'Phone',                    key: 'phone',    placeholder: '98XXXXXXXX',           type: 'text'     },
              { label: 'Course',                   key: 'course',   placeholder: 'BSc Computer Science', type: 'text'     },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.type} placeholder={f.placeholder} value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textStrong, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: theme.pageBg }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Country</label>
              <select value={form.country} onChange={e => set('country', e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textStrong, outline: 'none', fontFamily: 'inherit', background: theme.pageBg, boxSizing: 'border-box', cursor: 'pointer' }}>
                <option value="">Select country...</option>
                {COUNTRY_OPTIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end',
            }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', background: theme.pageBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13, color: theme.textLight, cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>Cancel</button>
              <button onClick={addApplicant} disabled={saving} style={{ padding: '9px 20px', background: saving ? theme.textMuted : theme.primary, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', width: isMobile ? '100%' : 'auto' }}>
                {saving ? 'Creating...' : 'Add Applicant + Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomButtons onAdd={load} />
    </div>
  )
}