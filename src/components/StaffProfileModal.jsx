import { useRef, useState } from 'react'
import theme from '../theme'
import { Camera, Trash2, X, Loader2, Info } from 'lucide-react'
import { supabase } from '../supabase'
import { useIsMobile } from '../hooks/useIsMobile'

// ─── Avatar photo storage — real Supabase Storage, bucket "avatars" ───
// Requires the `avatars` storage bucket + the `avatar_url` column on
// `profiles`/`staff` to exist — see the SQL in CHANGES.md. Keyed by email so
// the same person's photo resolves the same way whether it was uploaded via
// the admin Staff list or via that person's own "My Profile".
const avatarPathKey = (email) => (email || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'staff'

async function uploadAvatar(email, file) {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${avatarPathKey(email)}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

async function deleteAvatarByUrl(url) {
  if (!url) return
  const path = url.split('/avatars/')[1]
  if (!path) return
  await supabase.storage.from('avatars').remove([decodeURIComponent(path)])
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function avatarColor(name) {
  const colors = [theme.status.success.main, theme.primary, theme.status.warning.main, theme.pink, theme.purple, theme.accent, theme.status.danger.main, theme.status.success.main]
  if (!name) return colors[0]
  return colors[name.charCodeAt(0) % colors.length]
}

const MAX_PHOTO_BYTES = 3 * 1024 * 1024 // 3MB

const fieldStyle = {
  width: '100%', padding: '9px 12px', background: theme.pageBg,
  border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 13,
  color: theme.textMid, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600, color: theme.textLight,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

/**
 * Reusable staff profile popup — used both as the admin's "view / edit a
 * staff member" modal (from the Staff page) and as anyone's "My Profile"
 * modal (from the navbar avatar). The caller decides what's editable:
 *   - roleOptions: pass the ROLES list to let the role be changed (admin
 *     editing someone else); omit it to show role as a read-only badge
 *     (self-editing your own profile — role changes stay admin-only).
 *   - showJoined: whether to show/edit the "joined" date (only meaningful
 *     when there's a backing `staff` table row).
 *   - onSave(fields): called with { name, role, phone, joined }; throw to
 *     keep the modal open and show the error.
 *   - onPhotoChange(url | null): called after the file is uploaded to (or
 *     removed from) Supabase Storage — persist `url` to whichever table(s)
 *     this caller owns (the `staff` row and/or the `profiles` row); throw to
 *     surface an error in the modal.
 */
export default function StaffProfileModal({
  staff, roleOptions = null, showJoined = false, title = 'Staff Profile', onClose, onSave, onPhotoChange,
}) {
  const isMobile = useIsMobile()
  const fileInputRef = useRef(null)

  const [photo,      setPhoto]      = useState(staff.avatarUrl || null)
  const [name,        setName]      = useState(staff.name || '')
  const [role,        setRole]      = useState(staff.role || '')
  const [phone,       setPhone]     = useState(staff.phone || '')
  const [joined,      setJoined]    = useState(staff.joined || '')
  const [saving,      setSaving]    = useState(false)
  const [photoBusy,   setPhotoBusy] = useState(false)
  const [error,       setError]     = useState('')

  function handlePhotoClick() {
    if (!photoBusy) fileInputRef.current?.click()
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Image is too large — please choose one under 3MB.')
      return
    }

    setError('')
    setPhotoBusy(true)
    try {
      const previousUrl = photo
      const url = await uploadAvatar(staff.email, file)
      await onPhotoChange(url)
      setPhoto(url)
      // Best-effort cleanup of the old file — don't block on it.
      if (previousUrl) deleteAvatarByUrl(previousUrl).catch(() => {})
    } catch (err) {
      setError(err.message || 'Failed to upload photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleRemovePhoto() {
    setError('')
    setPhotoBusy(true)
    try {
      await onPhotoChange(null)
      await deleteAvatarByUrl(photo)
      setPhoto(null)
    } catch (err) {
      setError(err.message || 'Failed to remove photo.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), role, phone: phone.trim(), joined: joined || null })
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong saving your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 300,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Photo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{
                  width: 88, height: 88, borderRadius: '50%',
                  objectFit: 'cover', border: `1px solid ${theme.border}`, opacity: photoBusy ? 0.5 : 1,
                }}
              />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: '50%', background: avatarColor(name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, color: theme.white, opacity: photoBusy ? 0.5 : 1,
              }}>
                {getInitials(name)}
              </div>
            )}
            {photoBusy && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Loader2 size={20} color={theme.primary} style={{ animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            <button
              onClick={handlePhotoClick}
              disabled={photoBusy}
              title="Change photo"
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 30, height: 30, borderRadius: '50%',
                background: theme.primary, border: `2px solid ${theme.white}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: photoBusy ? 'not-allowed' : 'pointer', color: theme.white,
              }}
            >
              <Camera size={14} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button
              onClick={handlePhotoClick}
              disabled={photoBusy}
              style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: theme.primary, cursor: photoBusy ? 'not-allowed' : 'pointer', padding: 0 }}
            >
              {photoBusy ? 'Uploading...' : 'Change photo'}
            </button>
            {photo && !photoBusy && (
              <button
                onClick={handleRemovePhoto}
                style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: theme.status.danger.main, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
          <div style={{
            marginTop: 10, fontSize: 11, color: theme.textMuted, textAlign: 'center',
            display: 'flex', alignItems: 'flex-start', gap: 4, maxWidth: 320,
          }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Stored in Supabase — visible to everyone who can see this profile, on any device.</span>
          </div>
        </div>

        <FormField label="Full Name *">
          <input value={name} onChange={e => setName(e.target.value)} style={fieldStyle} />
        </FormField>

        <FormField label="Email (used for login)">
          <input value={staff.email || ''} disabled style={{ ...fieldStyle, background: theme.surfaceAlt, color: theme.textMuted, cursor: 'not-allowed' }} />
        </FormField>

        <FormField label="Role">
          {roleOptions ? (
            <>
              <select value={role} onChange={e => setRole(e.target.value)} style={fieldStyle}>
                {roleOptions.map(r => <option key={r.value} value={r.label}>{r.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                This only changes the label shown on their staff card — it doesn't change which
                pages they can access (that's set when their login is created).
              </div>
            </>
          ) : (
            <div style={{
              padding: '3px 14px', background: theme.status.info.bg, color: theme.primary,
              borderRadius: 20, fontSize: 12, fontWeight: 500, display: 'inline-block',
            }}>
              {role || '—'}
            </div>
          )}
        </FormField>

        <FormField label="Phone">
          <input placeholder="98XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} style={fieldStyle} />
        </FormField>

        {showJoined && (
          <FormField label="Joining Date">
            <input type="date" value={joined || ''} onChange={e => setJoined(e.target.value)} style={fieldStyle} />
          </FormField>
        )}

        {error && (
          <div style={{
            padding: '8px 12px', background: theme.status.danger.bg, border: `1px solid ${theme.status.danger.border}`,
            borderRadius: 7, fontSize: 12, color: theme.status.danger.text, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex', gap: 10,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          justifyContent: 'flex-end', marginTop: 8,
        }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', background: theme.pageBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, fontSize: 13, color: theme.textLight, cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 22px', background: saving ? theme.textMuted : theme.primary,
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: theme.white,
            cursor: saving ? 'not-allowed' : 'pointer',
            width: isMobile ? '100%' : 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {saving && <Loader2 size={14} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}
