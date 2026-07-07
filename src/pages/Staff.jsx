import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColor = (name) => {
  const colors = ['#16a34a','#2563eb','#f59e0b','#db2777','#7c3aed','#0891b2','#dc2626','#059669']
  if (!name) return colors[0]
  return colors[name.charCodeAt(0) % colors.length]
}

const ROLES = [
  { label: 'Counselor',        value: 'counselor',        access: 'Dashboard, Students, Appointments, Tasks, Chat' },
  { label: 'Visa Officer',     value: 'visa_officer',     access: 'Dashboard, Applications, Students, Appointments, Documents, Tasks, Chat' },
  { label: 'Document Handler', value: 'document_handler', access: 'Dashboard, Students, Documents, Tasks, Chat' },
  { label: 'Receptionist',     value: 'receptionist',     access: 'Dashboard, Applications, Students, Visitors, Appointments, Payments, Tasks, Chat' },
  { label: 'Finance Officer',  value: 'finance_officer',  access: 'Dashboard, Payments, Reports, Students (view), Tasks, Chat' },
  { label: 'Marketing',        value: 'marketing',        access: 'Dashboard, Applications, Reports, Tasks, Chat' },
  { label: 'Manager',          value: 'manager',          access: 'Dashboard, everything except Staff & Settings' },
  { label: 'Staff',            value: 'staff',            access: 'Dashboard, Applications, Students, Visitors, Appointments, Payments, Documents, Tasks, Chat' },
  { label: 'Admin',            value: 'admin',            access: 'Full access to everything' },
  { label: 'Other',            value: 'other',            access: 'Dashboard, Tasks, Chat' },
]

export default function Staff() {
  const [staff,         setStaff]         = useState([])
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [showAdd,       setShowAdd]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState(null)
  const [staffPassword, setStaffPassword] = useState('')
  const [form,          setForm]          = useState({ name: '', role: '', email: '', phone: '', joined: '' })

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

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const openAdd = () => {
    setForm({ name: '', role: '', email: '', phone: '', joined: '' })
    setStaffPassword('')
    setShowAdd(true)
  }

  async function addStaff() {
    if (!form.name.trim())  return alert('Full name is required')
    if (!form.role)         return alert('Role is required')
    if (!form.email.trim()) return alert('Email is required to create a login')
    if (!staffPassword || staffPassword.length < 6) return alert('Password must be at least 6 characters')

    const roleObj   = ROLES.find(r => r.value === form.role)
    const roleLabel = roleObj?.label || 'Staff'

    setSaving(true)

    // Step 1 — save to staff table (display label for card)
    const { error: staffError } = await supabase.from('staff').insert({
      name:   form.name.trim(),
      role:   roleLabel,
      email:  form.email.trim().toLowerCase(),
      phone:  form.phone.trim() || null,
      joined: form.joined || null,
    })

    if (staffError) {
      alert('Error saving staff: ' + staffError.message)
      setSaving(false)
      return
    }

    // Step 2 — create auth account + profile via Edge Function
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-staff-user`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    form.email.trim().toLowerCase(),
          password: staffPassword,
          name:     form.name.trim(),
          role:     form.role,   // system role value e.g. 'counselor'
        }),
      })

      const result = await res.json()

      if (!result.success) {
        alert('Staff saved but login creation failed: ' + result.message)
        setSaving(false)
        setShowAdd(false)
        setForm({ name: '', role: '', email: '', phone: '', joined: '' })
        setStaffPassword('')
        load()
        return
      }
    } catch (err) {
      alert('Network error creating login: ' + err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowAdd(false)
    setForm({ name: '', role: '', email: '', phone: '', joined: '' })
    setStaffPassword('')
    load()

    alert(
      `✅ Staff account created!\n\n` +
      `Name:     ${form.name}\n` +
      `Role:     ${roleLabel}\n` +
      `Email:    ${form.email}\n` +
      `Password: ${staffPassword}\n\n` +
      `Share these credentials with the staff member.`
    )
  }

  async function removeStaff(id, name) {
    if (!window.confirm(`Remove ${name} from staff?`)) return
    setDeleting(id)
    await supabase.from('staff').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  const filtered = staff.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.role?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  const selectedRole = ROLES.find(r => r.value === form.role)

  return (
    <div>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>Staff</h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            {staff.length} team member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '7px 14px', width: 220,
          }}>
            <span style={{ color: theme.textMuted, fontSize: 13 }}>🔍</span>
            <input
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: theme.textMid, width: '100%' }}
            />
          </div>
          <button onClick={openAdd} style={{
            padding: '8px 18px', background: theme.primary,
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}>
            + Add Staff
          </button>
        </div>
      </div>

      {loading && <p style={{ color: theme.textLight, fontSize: 13, padding: '20px 0' }}>Loading staff...</p>}

      {!loading && staff.length === 0 && (
        <div style={{
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: 80, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>No staff members yet</div>
          <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 20 }}>Add your team members to get started</div>
          <button onClick={openAdd} style={{
            padding: '10px 22px', background: theme.primary,
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}>
            + Add First Staff Member
          </button>
        </div>
      )}

      {/* staff cards */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(s => (
            <div key={s.id} style={{
              background: theme.cardBg, border: `1px solid ${theme.border}`,
              borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ height: 5, background: avatarColor(s.name) }} />
              <div style={{ padding: '22px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 68, height: 68, borderRadius: '50%', background: avatarColor(s.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 12,
                }}>
                  {getInitials(s.name)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.textDark, marginBottom: 6, textAlign: 'center' }}>
                  {s.name}
                </div>
                <div style={{
                  padding: '3px 14px', background: theme.blueLight, color: theme.blue,
                  borderRadius: 20, fontSize: 12, fontWeight: 500, marginBottom: 14,
                }}>
                  {s.role}
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textMid }}>
                    <span>📧</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {s.email || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textMid }}>
                    <span>📱</span>{s.phone || '—'}
                  </div>
                  {s.joined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textLight }}>
                      <span>📅</span>
                      Joined {new Date(s.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  <div style={{
                    marginTop: 4, padding: '4px 10px', background: '#f0fdf4',
                    border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11,
                    color: '#15803d', textAlign: 'center',
                  }}>
                    ✓ Has login access
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeStaff(s.id, s.name)}
                disabled={deleting === s.id}
                style={{
                  width: '100%', padding: '10px',
                  background: deleting === s.id ? '#f9fafb' : '#fff5f5',
                  border: 'none', borderTop: `1px solid ${theme.border}`,
                  fontSize: 12, fontWeight: 500,
                  color: deleting === s.id ? theme.textMuted : '#dc2626',
                  cursor: deleting === s.id ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={e => { if (deleting !== s.id) e.currentTarget.style.background = '#fee2e2' }}
                onMouseLeave={e => { if (deleting !== s.id) e.currentTarget.style.background = '#fff5f5' }}
              >
                {deleting === s.id ? 'Removing...' : '🗑️ Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && staff.length > 0 && filtered.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>No staff match "{search}"</div>
        </div>
      )}

      {/* add staff modal */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
              padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Add Staff Member</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>

            <div style={{
              padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 8, fontSize: 12, color: '#1d4ed8', marginBottom: 18,
            }}>
              ℹ️ Creates a login account. The role controls which pages they can access.
            </div>

            <FormField label="Full Name *">
              <input placeholder="Nabin Sharma" value={form.name} onChange={e => set('name', e.target.value)} autoFocus style={fieldStyle} />
            </FormField>

            <FormField label="Role *">
              <select value={form.role} onChange={e => set('role', e.target.value)} style={fieldStyle}>
                <option value="">Select a role...</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </FormField>

            {selectedRole && (
              <div style={{
                marginTop: -8, marginBottom: 14, padding: '8px 12px',
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7,
                fontSize: 11, color: '#15803d',
              }}>
                <strong>Access:</strong> {selectedRole.access}
              </div>
            )}

            <FormField label="Email * (used for login)">
              <input type="email" placeholder="nabin@globalpathway.com" value={form.email} onChange={e => set('email', e.target.value)} style={fieldStyle} />
            </FormField>

            <FormField label="Login Password * (min 6 characters)">
              <input type="text" placeholder="Set a password for this staff member" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} style={fieldStyle} />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Share this email + password directly with the staff member.</div>
            </FormField>

            <FormField label="Phone">
              <input placeholder="98XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} style={fieldStyle} />
            </FormField>

            <FormField label="Joining Date">
              <input type="date" value={form.joined} onChange={e => set('joined', e.target.value)} style={fieldStyle} />
            </FormField>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setShowAdd(false)} style={{
                padding: '9px 18px', background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 8, fontSize: 13, color: '#6b7280', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={addStaff} disabled={saving} style={{
                padding: '9px 22px', background: saving ? '#9ca3af' : theme.primary,
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Creating...' : 'Add Staff + Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomButtons onAdd={load} />
    </div>
  )
}

const fieldStyle = {
  width: '100%', padding: '9px 12px', background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13,
  color: '#374151', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}