import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

const COUNTRY_OPTIONS = [
  'Korea', 'Australia', 'Japan', 'UK', 'USA',
  'Canada', 'Finland', 'Germany', 'France', 'New Zealand',
  'Ireland', 'Malta', 'Cyprus', 'Hungary', 'Poland',
  'Czech Republic', 'Italy', 'Portugal', 'Sweden', 'Denmark',
  'Norway', 'Netherlands', 'Belgium', 'Switzerland', 'Spain', 'Other',
]

const badgeStyle = (status) => {
  const map = {
    'Approved':       { bg: '#dcfce7', color: '#15803d' },
    'Pending':        { bg: '#fef9c3', color: '#a16207' },
    'Rejected':       { bg: '#fee2e2', color: '#b91c1c' },
    'New':            { bg: '#dbeafe', color: '#1d4ed8' },
    'Inquiring':      { bg: '#ede9fe', color: '#7c3aed' },
    'Counseling':     { bg: '#fef9c3', color: '#ca8a04' },
    'Documentation':  { bg: '#ffedd5', color: '#ea580c' },
    'Applied':        { bg: '#dbeafe', color: '#2563eb' },
    'Visa Process':   { bg: '#cffafe', color: '#0891b2' },
    'Class/Enrolled': { bg: '#ede9fe', color: '#7c3aed' },
    'Abroad':         { bg: '#dcfce7', color: '#16a34a' },
  }
  return map[status] || { bg: '#f3f4f6', color: '#6b7280' }
}

export default function Applications() {
  const [list,     setList]     = useState([])
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('All')
  const [country,  setCountry]  = useState('All')
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({
    name: '', email: '', phone: '', course: '', country: '', password: '',
  })

  useEffect(() => { load() }, [])

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
    if (!form.password || form.password.length < 6) return alert('Password must be at least 6 characters')

    setSaving(true)

    // Step 1 — insert into applicants table
    const { data: newApplicant, error: appError } = await supabase
      .from('applicants')
      .insert({
        name:    form.name.trim(),
        email:   form.email.trim().toLowerCase(),
        phone:   form.phone.trim()  || null,
        course:  form.course.trim() || null,
        country: form.country       || null,
        status:  'New',
      })
      .select()
      .single()

    if (appError) {
      alert('Error saving applicant: ' + appError.message)
      setSaving(false)
      return
    }

    // Step 2 — create student auth account + profile via Edge Function
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-staff-user`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    form.email.trim().toLowerCase(),
          password: form.password,
          name:     form.name.trim(),
          role:     'student',
        }),
      })

      const result = await res.json()

      if (!result.success) {
        // Applicant row created but login failed — still usable, just warn
        alert(
          `⚠️ Applicant added but login creation failed: ${result.message}\n\n` +
          `The applicant appears in the list. You can try creating their login manually later.`
        )
        setSaving(false)
        setShowAdd(false)
        setForm({ name: '', email: '', phone: '', course: '', country: '', password: '' })
        load()
        return
      }

      // Step 3 — link applicant_id to the profile row
      await supabase
        .from('profiles')
        .update({ applicant_id: newApplicant.id })
        .eq('id', result.user_id)

    } catch (err) {
      alert('Network error creating login: ' + err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAdd(false)
    setForm({ name: '', email: '', phone: '', course: '', country: '', password: '' })
    load()

    alert(
      `✅ Applicant added and student login created!\n\n` +
      `Name:     ${form.name}\n` +
      `Email:    ${form.email}\n` +
      `Password: ${form.password}\n\n` +
      `Share these login credentials with the student.`
    )
  }

  async function deleteApplicant(applicant) {
    const confirmed = window.confirm(`Delete "${applicant.name}"? This cannot be undone.`)
    if (!confirmed) return
    setDeleting(applicant.id)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('applicant_id', applicant.id)
        .maybeSingle()

      if (profile?.id) {
        await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: profile.id }),
        })
        await supabase.from('profiles').delete().eq('id', profile.id)
      }

      await supabase.from('applicants').delete().eq('id', applicant.id)
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

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>Applications</h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>{list.length} total applicants</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '9px 16px', background: theme.primary,
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
        }}>
          + Add Applicant
        </button>
      </div>

      {/* filters */}
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
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: theme.textMid, width: '100%' }}
          />
        </div>

        <select value={filter} onChange={e => setFilter(e.target.value)} style={{
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
        }}>
          <option value="All">All Status</option>
          {['New','Pending','Approved','Rejected','Inquiring','Counseling','Documentation','Applied','Visa Process','Class/Enrolled','Abroad'].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select value={country} onChange={e => setCountry(e.target.value)} style={{
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px', fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
        }}>
          {countryOptions.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* table */}
      <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 0.8fr',
          padding: '10px 16px', background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name','Course','Country','Status','Date','Actions'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {loading && <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>Loading...</p>}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>No applicants found</div>
          </div>
        )}

        {filtered.map((a, i) => (
          <div key={a.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr 0.8fr',
            padding: '13px 16px',
            borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
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
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: badgeStyle(a.status).bg, color: badgeStyle(a.status).color,
              }}>{a.status || 'New'}</span>
            </div>
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
            </div>
            <button
              onClick={() => deleteApplicant(a)}
              disabled={deleting === a.id}
              style={{
                padding: '5px 10px',
                background: deleting === a.id ? '#f3f4f6' : '#fee2e2',
                border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600,
                color: deleting === a.id ? '#9ca3af' : '#b91c1c',
                cursor: deleting === a.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {deleting === a.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        ))}
      </div>

      {/* add modal */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
            padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add New Applicant</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, color: '#1d4ed8', marginBottom: 18 }}>
              ℹ️ This creates the applicant record and a student login account in one step.
            </div>

            {[
              { label: 'Full Name *',              key: 'name',     placeholder: 'Ram Sharma',          type: 'text'     },
              { label: 'Email * (for login)',       key: 'email',   placeholder: 'ram@email.com',        type: 'email'    },
              { label: 'Login Password * (min 6)', key: 'password', placeholder: 'Set student password', type: 'text'     },
              { label: 'Phone',                    key: 'phone',    placeholder: '98XXXXXXXX',           type: 'text'     },
              { label: 'Course',                   key: 'course',   placeholder: 'BSc Computer Science', type: 'text'     },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.type} placeholder={f.placeholder} value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: '#f9fafb' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Country</label>
              <select value={form.country} onChange={e => set('country', e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit', background: '#f9fafb', boxSizing: 'border-box', cursor: 'pointer' }}>
                <option value="">Select country...</option>
                {COUNTRY_OPTIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addApplicant} disabled={saving} style={{ padding: '9px 20px', background: saving ? '#9ca3af' : theme.primary, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
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