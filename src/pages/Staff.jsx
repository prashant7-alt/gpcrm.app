import { useState, useEffect } from 'react'
import { Mail, Phone, Calendar, Trash2, Search, IdCard } from 'lucide-react'
import { supabase, functionHeaders } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'
import StaffProfileModal, { getInitials, avatarColor } from '../components/StaffProfileModal'
import { ROLES } from '../lib/staffRoles'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

export default function Staff() {
  const isMobile = useIsMobile()

  const [staff,         setStaff]         = useState([])
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [showAdd,       setShowAdd]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [deleting,      setDeleting]      = useState(null)
  const [staffPassword, setStaffPassword] = useState('')
  const [form,          setForm]          = useState({ name: '', role: '', email: '', phone: '', joined: '' })
  const [profileStaff,  setProfileStaff]  = useState(null) // staff row currently open in the profile modal

  useEffect(() => { load() }, [])
  useRefetchOnFocus(load)

  async function load() {
    setLoading(true)

    const [{ data, error }, { data: profileRows }] = await Promise.all([
      supabase.from('staff').select('*').order('created_at', { ascending: true }),
      // Staff members can only be trusted to update their OWN `profiles` row
      // (RLS on `staff` generally restricts writes to admins), so a photo
      // someone uploaded from "My Profile" may only have landed in
      // `profiles.avatar_url`. Fall back to that here so it still shows up
      // on this admin page even when the `staff` row's own copy didn't sync.
      supabase.from('profiles').select('email, avatar_url'),
    ])

    if (!error) {
      const photoByEmail = {}
      ;(profileRows || []).forEach(p => {
        if (p.email && p.avatar_url) photoByEmail[p.email.trim().toLowerCase()] = p.avatar_url
      })
      const merged = (data || []).map(s => ({
        ...s,
        avatar_url: s.avatar_url || photoByEmail[(s.email || '').trim().toLowerCase()] || null,
      }))
      setStaff(merged)
    }
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
    if (!staffPassword || staffPassword.length < 8) return alert('Password must be at least 8 characters')

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
        headers: await functionHeaders(),
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
      `Name:  ${form.name}\n` +
      `Role:  ${roleLabel}\n` +
      `Email: ${form.email}\n\n` +
      `Give the staff member their login email and the password you just set — ` +
      `share it directly (in person or by phone), not by email.`
    )
  }

  async function removeStaff(id, name, email) {
    if (!window.confirm(
      `Remove ${name} from staff?\n\n` +
      `This also deletes their login account and revokes portal access.`
    )) return
    setDeleting(id)
    try {
      // Find the linked login profile so we can revoke portal access too.
      // A former staff whose `profiles` row is left behind keeps a working
      // login AND still shows up wherever the app lists staff from
      // `profiles` (e.g. the student chat).
      let profileId = null
      if (email) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', email.trim())
          .maybeSingle()
        profileId = prof?.id || null
      }

      if (profileId) {
        // Delete the auth user first. If this fails, abort without removing
        // anything else — otherwise the person keeps a usable login while
        // disappearing from this page.
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
            method:  'POST',
            headers: await functionHeaders(),
            body:    JSON.stringify({ user_id: profileId }),
          })
          const result = await res.json()
          if (!res.ok || !result?.success) {
            alert(
              `⚠️ Could not delete ${name}'s login account: ${result?.message || 'Unknown error'}\n\n` +
              `Nothing was removed. Please try again, or check the delete-user function logs.`
            )
            setDeleting(null)
            return
          }
        } catch (fnErr) {
          alert(
            `⚠️ Network error while deleting ${name}'s login account: ${fnErr.message}\n\n` +
            `Nothing was removed, so their login still works. Please try again.`
          )
          setDeleting(null)
          return
        }
        await supabase.from('profiles').delete().eq('id', profileId)
      }

      await supabase.from('staff').delete().eq('id', id)
    } catch (err) {
      alert('Error removing staff: ' + err.message)
    } finally {
      setDeleting(null)
      load()
    }
  }

  // Best-effort sync into the matching login profile so the staff member
  // sees admin-made edits immediately on their own "My Profile" — they
  // usually can't read the `staff` table row directly (that's admin-only),
  // but they can always read their own `profiles` row. Never blocks the
  // main save: the `staff` table write above is the source of truth for
  // this admin-facing page, this is just propagation.
  async function syncToProfile(email, fields) {
    if (!email) return
    const { data, error } = await supabase.from('profiles').update(fields).ilike('email', email).select()
    if (error || !data || data.length === 0) {
      console.warn('Could not sync to this person\'s login profile (no matching row, or blocked by permissions):', error?.message)
    }
  }

  async function saveStaffProfile(fields) {
    const { error } = await supabase
      .from('staff')
      .update({
        name:  fields.name,
        role:  fields.role,
        phone: fields.phone || null,
        joined: fields.joined || null,
      })
      .eq('id', profileStaff.id)

    if (error) throw error
    await syncToProfile(profileStaff.email, { name: fields.name, phone_new: fields.phone || null })
    await load()
  }

  async function saveStaffAvatar(url) {
    const { error } = await supabase.from('staff').update({ avatar_url: url }).eq('id', profileStaff.id)
    if (error) throw error
    await syncToProfile(profileStaff.email, { avatar_url: url })
    await load()
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
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 12 : 0,
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>Staff</h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            {staff.length} team member{staff.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '7px 14px', width: isMobile ? '100%' : 220,
            boxSizing: 'border-box',
          }}>
            <Search size={16} style={{ color: theme.textMuted, flexShrink: 0 }} />
            <input
              placeholder="Search staff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: theme.textMid, width: '100%' }}
            />
          </div>
          <button onClick={openAdd} style={{
            padding: '8px 18px', background: theme.primary,
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}>
            + Add Staff
          </button>
        </div>
      </div>

      {loading && <p style={{ color: theme.textLight, fontSize: 13, padding: '20px 0' }}>Loading staff...</p>}

      {!loading && staff.length === 0 && (
        <div style={{
          background: theme.cardBg, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: isMobile ? '48px 20px' : 80, textAlign: 'center',
        }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <div style={{ fontSize: 48 }}>👥</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>No staff members yet</div>
          <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 20 }}>Add your team members to get started</div>
          <button onClick={openAdd} style={{
            padding: '10px 22px', background: theme.primary,
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer',
          }}>
            + Add First Staff Member
          </button>
        </div>
      )}

      {/* staff cards */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: isMobile ? 12 : 16,
        }}>
          {filtered.map(s => (
            <div key={s.id} style={{
              background: theme.cardBg, border: `1px solid ${theme.border}`,
              borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div
                onClick={() => setProfileStaff(s)}
                title="View / edit profile"
                style={{ padding: '22px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}
              >
                {s.avatar_url ? (
                  <img
                    src={s.avatar_url}
                    alt={s.name}
                    style={{
                      width: 68, height: 68, borderRadius: '50%', objectFit: 'cover',
                      border: `1px solid ${theme.border}`, marginBottom: 12,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 68, height: 68, borderRadius: '50%', background: avatarColor(s.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, color: theme.white, marginBottom: 12,
                  }}>
                    {getInitials(s.name)}
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: theme.textDark, marginBottom: 6, textAlign: 'center' }}>
                  {s.name}
                </div>
                <div style={{
                  padding: '3px 14px', background: theme.blueLight, color: theme.blue,
                  borderRadius: 20, fontSize: 12, fontWeight: 500, marginBottom: 14,
                }}>
                  {s.role}
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textMid }}>
                    <Mail size={14} style={{ flexShrink: 0, color: theme.textMuted }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textMid }}>
                    <Phone size={14} style={{ flexShrink: 0, color: theme.textMuted }} />
                    <span>{s.phone || '—'}</span>
                  </div>
                  {s.joined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textLight }}>
                      <Calendar size={14} style={{ flexShrink: 0, color: theme.textMuted }} />
                      <span>Joined {new Date(s.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                  <div style={{
                    marginTop: 4, padding: '4px 10px', background: theme.status.success.bg,
                    border: `1px solid ${theme.status.success.border}`, borderRadius: 6, fontSize: 11,
                    color: theme.status.success.text, textAlign: 'center',
                  }}>
                    ✓ Has login access
                  </div>
                  <button
                    onClick={() => setProfileStaff(s)}
                    style={{
                      marginTop: 2, padding: '6px 10px', background: theme.status.info.bg,
                      border: `1px solid ${theme.status.info.border}`, borderRadius: 6, fontSize: 11,
                      fontWeight: 600, color: theme.primary, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <IdCard size={12} /> View Profile
                  </button>
                </div>
              </div>
              <button
                onClick={() => removeStaff(s.id, s.name, s.email)}
                disabled={deleting === s.id}
                style={{
                  width: '100%', padding: '10px',
                  background: deleting === s.id ? theme.pageBg : theme.status.danger.bg,
                  border: 'none', borderTop: `1px solid ${theme.border}`,
                  fontSize: 12, fontWeight: 500,
                  color: deleting === s.id ? theme.textMuted : theme.status.danger.main,
                  cursor: deleting === s.id ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={e => { if (deleting !== s.id) e.currentTarget.style.background = theme.status.danger.bg }}
                onMouseLeave={e => { if (deleting !== s.id) e.currentTarget.style.background = theme.status.danger.bg }}
              >
                <Trash2 size={14} />
                {deleting === s.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && staff.length > 0 && filtered.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
            <Search size={48} style={{ color: theme.textMuted }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>No staff match "{search}"</div>
        </div>
      )}

      {/* add staff modal */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>Add Staff Member</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted }}>✕</button>
            </div>

            <div style={{
              padding: '10px 14px', background: theme.status.info.bg, border: `1px solid ${theme.status.info.border}`,
              borderRadius: 8, fontSize: 12, color: theme.primary, marginBottom: 18,
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
                background: theme.status.success.bg, border: `1px solid ${theme.status.success.border}`, borderRadius: 7,
                fontSize: 11, color: theme.status.success.text,
              }}>
                <strong>Access:</strong> {selectedRole.access}
              </div>
            )}

            <FormField label="Email * (used for login)">
              <input type="email" placeholder="nabin@globalpathway.com" value={form.email} onChange={e => set('email', e.target.value)} style={fieldStyle} />
            </FormField>

            <FormField label="Login Password * (min 8 characters)">
              <input type="text" placeholder="Set a password for this staff member" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} style={fieldStyle} />
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Share this email + password directly with the staff member.</div>
            </FormField>

            <FormField label="Phone">
              <input placeholder="98XXXXXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} style={fieldStyle} />
            </FormField>

            <FormField label="Joining Date">
              <input type="date" value={form.joined} onChange={e => set('joined', e.target.value)} style={fieldStyle} />
            </FormField>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end', marginTop: 22,
            }}>
              <button onClick={() => setShowAdd(false)} style={{
                padding: '9px 18px', background: theme.pageBg, border: `1px solid ${theme.border}`,
                borderRadius: 8, fontSize: 13, color: theme.textLight, cursor: 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}>Cancel</button>
              <button onClick={addStaff} disabled={saving} style={{
                padding: '9px 22px', background: saving ? theme.textMuted : theme.primary,
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white,
                cursor: saving ? 'not-allowed' : 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}>
                {saving ? 'Creating...' : 'Add Staff + Create Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* staff profile popup — view/edit any staff member, photo is device-local */}
      {profileStaff && (
        <StaffProfileModal
          staff={{ ...profileStaff, avatarUrl: profileStaff.avatar_url }}
          roleOptions={ROLES}
          showJoined
          title="Staff Profile"
          onClose={() => setProfileStaff(null)}
          onSave={saveStaffProfile}
          onPhotoChange={saveStaffAvatar}
        />
      )}

      <BottomButtons onAdd={load} />
    </div>
  )
}

const fieldStyle = {
  width: '100%', padding: '9px 12px', background: theme.pageBg,
  border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13,
  color: theme.textMid, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}