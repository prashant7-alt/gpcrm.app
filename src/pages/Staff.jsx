import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

// generate initials from name
const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// give each staff member a consistent color based on their name
const avatarColor = (name) => {
  const colors = [
    '#16a34a', '#2563eb', '#f59e0b',
    '#db2777', '#7c3aed', '#0891b2',
    '#dc2626', '#059669',
  ]
  if (!name) return colors[0]
  return colors[name.charCodeAt(0) % colors.length]
}

const roles = [
  'Counselor',
  'Visa Officer',
  'Document Handler',
  'Receptionist',
  'Marketing',
  'Manager',
  'Admin',
  'Other',
]

export default function Staff() {

  const [staff,    setStaff]    = useState([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null) // id being deleted
  const [form,     setForm]     = useState({
    name: '', role: '', email: '', phone: '', joined: '',
  })

  // load staff from supabase
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error) setStaff(data || [])
    setLoading(false)
  }

  // update a single form field
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // open add modal with blank form
  const openAdd = () => {
    setForm({ name: '', role: '', email: '', phone: '', joined: '' })
    setShowAdd(true)
  }

  // submit new staff to supabase
  async function addStaff() {
    if (!form.name.trim()) return alert('Full name is required')
    if (!form.role)        return alert('Role is required')
    setSaving(true)
    const { error } = await supabase.from('staff').insert({
      name:   form.name.trim(),
      role:   form.role,
      email:  form.email.trim()  || null,
      phone:  form.phone.trim()  || null,
     
    })
    setSaving(false)
    if (error) return alert('Error saving: ' + error.message)
    setShowAdd(false)
    load()
  }

  // delete staff member
  async function removeStaff(id, name) {
    if (!window.confirm(`Remove ${name} from staff?`)) return
    setDeleting(id)
    await supabase.from('staff').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  // filtered by search
  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.role?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>

      {/* ── page header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: theme.textDark,
            margin: 0,
          }}>
            Staff
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            {staff.length} team member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '7px 14px',
            width: 220,
          }}>
            <span style={{ color: theme.textMuted, fontSize: 13 }}>🔍</span>
            <input
              placeholder="Search staff..."
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

          {/* add button */}
          <button
            onClick={openAdd}
            style={{
              padding: '8px 18px',
              background: theme.primary,
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Add Staff
          </button>
        </div>
      </div>

      {/* ── loading ── */}
      {loading && (
        <p style={{ color: theme.textLight, fontSize: 13, padding: '20px 0' }}>
          Loading staff...
        </p>
      )}

      {/* ── empty state ── */}
      {!loading && staff.length === 0 && (
        <div style={{
          background: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: 80,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>👥</div>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: theme.textDark,
            marginBottom: 6,
          }}>
            No staff members yet
          </div>
          <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 20 }}>
            Add your team members to get started
          </div>
          <button
            onClick={openAdd}
            style={{
              padding: '10px 22px',
              background: theme.primary,
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            + Add First Staff Member
          </button>
        </div>
      )}

      {/* ── staff cards grid ── */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(s => (
            <div key={s.id} style={{
              background: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>

              {/* colored top bar */}
              <div style={{
                height: 6,
                background: avatarColor(s.name),
              }}/>

              {/* card body */}
              <div style={{
                padding: '22px 20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
              }}>

                {/* avatar circle */}
                <div style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: avatarColor(s.name),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 12,
                  flexShrink: 0,
                }}>
                  {getInitials(s.name)}
                </div>

                {/* name */}
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: theme.textDark,
                  marginBottom: 6,
                  textAlign: 'center',
                }}>
                  {s.name}
                </div>

                {/* role badge */}
                <div style={{
                  padding: '3px 14px',
                  background: theme.blueLight,
                  color: theme.blue,
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 14,
                }}>
                  {s.role}
                </div>

                {/* contact info */}
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginBottom: 6,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: theme.textMid,
                  }}>
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📧</span>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {s.email || '—'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: theme.textMid,
                  }}>
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📱</span>
                    {s.phone || '—'}
                  </div>
                  {s.joined && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: theme.textLight,
                    }}>
                      <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>📅</span>
                      Joined {new Date(s.joined).toLocaleDateString('en-US', {
                        month: 'short', year: 'numeric'
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* card footer — remove button */}
              <button
                onClick={() => removeStaff(s.id, s.name)}
                disabled={deleting === s.id}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: deleting === s.id ? '#f9fafb' : '#fff5f5',
                  border: 'none',
                  borderTop: `1px solid ${theme.border}`,
                  fontSize: 12,
                  fontWeight: 500,
                  color: deleting === s.id ? theme.textMuted : '#dc2626',
                  cursor: deleting === s.id ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => {
                  if (deleting !== s.id)
                    e.currentTarget.style.background = '#fee2e2'
                }}
                onMouseLeave={e => {
                  if (deleting !== s.id)
                    e.currentTarget.style.background = '#fff5f5'
                }}
              >
                {deleting === s.id ? 'Removing...' : '🗑️ Remove'}
              </button>

            </div>
          ))}
        </div>
      )}

      {/* ── no search results ── */}
      {!loading && staff.length > 0 && filtered.length === 0 && (
        <div style={{
          padding: 60,
          textAlign: 'center',
          color: theme.textLight,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
            No staff match "{search}"
          </div>
        </div>
      )}

      {/* ── add staff modal ── */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              padding: 28,
              width: 440,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >

            {/* modal header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 22,
            }}>
              <h3 style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#111827',
                margin: 0,
              }}>
                Add Staff Member
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#9ca3af',
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* name */}
            <FormField label="Full Name *">
              <input
                placeholder="Nabin Sharma"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                autoFocus
                style={fieldStyle}
              />
            </FormField>

            {/* role — dropdown */}
            <FormField label="Role *">
              <select
                value={form.role}
                onChange={e => set('role', e.target.value)}
                style={fieldStyle}
              >
                <option value="">Select a role...</option>
                {roles.map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </FormField>

            {/* email */}
            <FormField label="Email">
              <input
                type="email"
                placeholder="nabin@globalpathway.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                style={fieldStyle}
              />
            </FormField>

            {/* phone */}
            <FormField label="Phone">
              <input
                placeholder="98XXXXXXXX"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                style={fieldStyle}
              />
            </FormField>

            {/* joined date */}
            <FormField label="Joining Date">
              <input
                type="date"
                value={form.joined}
                onChange={e => set('joined', e.target.value)}
                style={fieldStyle}
              />
            </FormField>

            {/* buttons */}
            <div style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              marginTop: 22,
            }}>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  padding: '9px 18px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#6b7280',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={addStaff}
                disabled={saving}
                style={{
                  padding: '9px 22px',
                  background: saving ? '#9ca3af' : theme.primary,
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Add Staff'}
              </button>
            </div>

          </div>
        </div>
      )}

      <BottomButtons onAdd={load} />

    </div>
  )
}

// small helpers to keep the form clean
const fieldStyle = {
  width: '100%',
  padding: '9px 12px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 13,
  color: '#374151',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}