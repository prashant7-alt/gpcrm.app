// ─────────────────────────────────────────────────────────────────────────────
// AnnouncementsPanel.jsx
// Admin-posted news feed. Rendered on both the staff dashboard (audience="staff")
// and the student dashboard (audience="students"). When `isAdmin` is true it
// also shows the compose / edit / delete controls; everyone else sees a
// read-only list. Backed by the `announcements` table (see
// `supabase sql code/announcements.sql`). Safe before the SQL is run — the list
// just stays empty.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { Megaphone, Pin, Pencil, Trash2, Plus, X } from 'lucide-react'
import theme from '../theme'
import {
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  timeAgo,
} from '../lib/announcements'

const AUDIENCE_OPTS = [
  { value: 'all',      label: 'Everyone (staff + students)' },
  { value: 'staff',    label: 'Staff only' },
  { value: 'students', label: 'Students only' },
]
const audienceLabel = (a) =>
  a === 'staff' ? 'Staff only' : a === 'students' ? 'Students only' : 'Everyone'

const EMPTY_FORM = { title: '', body: '', audience: 'all', pinned: false }

export default function AnnouncementsPanel({ audience, isAdmin = false, style }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [busy,      setBusy]      = useState(false)
  const [err,       setErr]       = useState('')

  useEffect(() => {
    let alive = true
    fetchAnnouncements(audience).then(rows => {
      if (!alive) return
      setItems(rows)
      setLoading(false)
    })
    return () => { alive = false }
  }, [audience])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function startNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setComposing(true)
    setErr('')
  }
  function startEdit(a) {
    setComposing(false)
    setEditingId(a.id)
    setForm({ title: a.title, body: a.body, audience: a.audience, pinned: a.pinned })
    setErr('')
  }
  function cancel() {
    setComposing(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setErr('')
  }

  async function submit() {
    if (!form.title.trim() || !form.body.trim()) {
      setErr('Title and message are both required.')
      return
    }
    setBusy(true)
    setErr('')

    if (editingId) {
      const { data, error } = await updateAnnouncement(editingId, form)
      setBusy(false)
      if (error) { setErr(error); return }
      setItems(prev =>
        sortItems(prev.map(a => (a.id === editingId ? { ...a, ...data } : a))))
      cancel()
    } else {
      const { data, error } = await createAnnouncement(form)
      setBusy(false)
      if (error) { setErr(error); return }
      setItems(prev => sortItems([data, ...prev]))
      cancel()
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this announcement? Everyone will stop seeing it.')) return
    const snapshot = items
    setItems(prev => prev.filter(a => a.id !== id))   // optimistic
    const { error } = await deleteAnnouncement(id)
    if (error) {
      setItems(snapshot)                              // rollback
      alert('Could not delete: ' + error)
    }
  }

  // ── styles ────────────────────────────────────────────────────────────────
  const card = {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    ...style,
  }
  const head = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, padding: '14px 18px', borderBottom: `1px solid ${theme.border}`,
  }
  const field = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    border: `1px solid ${theme.inputBorder}`, borderRadius: 8,
    fontSize: 13, color: theme.textStrong, outline: 'none',
    fontFamily: 'inherit', background: theme.pageBg,
  }
  const smallBtn = (bg, color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', border: 'none', borderRadius: 6,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', background: bg, color,
  })

  const showForm = composing || editingId

  return (
    <div style={card}>
      <div style={head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Megaphone size={17} strokeWidth={2.2} style={{ color: theme.primary }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: theme.textStrong }}>
            Announcements
          </span>
        </div>
        {isAdmin && !showForm && (
          <button onClick={startNew} style={smallBtn(theme.primary, theme.white)}>
            <Plus size={13} strokeWidth={2.5} /> New
          </button>
        )}
      </div>

      {/* compose / edit form (admin only) */}
      {isAdmin && showForm && (
        <div style={{ padding: 18, borderBottom: `1px solid ${theme.border}`, background: theme.pageBg }}>
          <input
            style={{ ...field, marginBottom: 10, fontWeight: 600 }}
            placeholder="Title"
            value={form.title}
            maxLength={140}
            onChange={e => set('title', e.target.value)}
          />
          <textarea
            style={{ ...field, marginBottom: 10, minHeight: 84, resize: 'vertical' }}
            placeholder="Write the news / information to share…"
            value={form.body}
            onChange={e => set('body', e.target.value)}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <select
              style={{ ...field, width: 'auto', flex: '1 1 200px', cursor: 'pointer' }}
              value={form.audience}
              onChange={e => set('audience', e.target.value)}
            >
              {AUDIENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: theme.textMid, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={e => set('pinned', e.target.checked)}
              />
              Pin to top
            </label>
          </div>
          {err && (
            <div style={{ fontSize: 12, color: theme.status.danger.text, marginBottom: 10 }}>{err}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} disabled={busy} style={smallBtn(theme.primary, theme.white)}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Post announcement'}
            </button>
            <button onClick={cancel} disabled={busy} style={smallBtn(theme.pageBg, theme.textMid)}>
              <X size={13} strokeWidth={2.5} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* list */}
      <div>
        {loading && (
          <div style={{ padding: 18, fontSize: 13, color: theme.textLight }}>Loading…</div>
        )}

        {!loading && items.length === 0 && !showForm && (
          <div style={{ padding: 22, fontSize: 13, color: theme.textLight }}>
            {isAdmin
              ? 'No announcements yet. Click “New” to share news with everyone.'
              : 'No announcements right now.'}
          </div>
        )}

        {!loading && items.map((a, i) => (
          <div
            key={a.id}
            style={{
              padding: '14px 18px',
              borderBottom: i < items.length - 1 ? `1px solid ${theme.border}` : 'none',
              background: a.pinned ? theme.accentLight : 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {a.pinned && <Pin size={13} strokeWidth={2.4} style={{ color: theme.accentHover, flexShrink: 0 }} />}
                <span style={{ fontSize: 14, fontWeight: 700, color: theme.textStrong }}>{a.title}</span>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEdit(a)} title="Edit"
                    style={smallBtn(theme.pageBg, theme.textMid)}>
                    <Pencil size={12} strokeWidth={2.4} />
                  </button>
                  <button onClick={() => remove(a.id)} title="Delete"
                    style={smallBtn(theme.status.danger.bg, theme.status.danger.text)}>
                    <Trash2 size={12} strokeWidth={2.4} />
                  </button>
                </div>
              )}
            </div>

            <p style={{
              margin: '6px 0 0', fontSize: 13, lineHeight: 1.5,
              color: theme.textMid, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {a.body}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11.5, color: theme.textMuted }}>
              <span>{timeAgo(a.updated_at && a.updated_at !== a.created_at ? a.updated_at : a.created_at)}</span>
              {a.updated_at && a.updated_at !== a.created_at && <span>· edited</span>}
              {a.audience && a.audience !== 'all' && (
                <span style={{
                  padding: '1px 7px', borderRadius: 10,
                  background: theme.status.info.bg, color: theme.status.info.text, fontWeight: 600,
                }}>
                  {audienceLabel(a.audience)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function sortItems(list) {
  return [...list].sort((x, y) => {
    if (!!x.pinned !== !!y.pinned) return x.pinned ? -1 : 1
    return new Date(y.created_at) - new Date(x.created_at)
  })
}
