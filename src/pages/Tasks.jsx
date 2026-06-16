import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const priorities = {
  High:   { bg: '#fee2e2', color: '#dc2626' },
  Medium: { bg: '#fef9c3', color: '#ca8a04' },
  Low:    { bg: '#dcfce7', color: '#16a34a' },
}

export default function Tasks() {

  const [tasks,      setTasks]      = useState([])
  const [search,     setSearch]     = useState('')
  const [priority,   setPriority]   = useState('All')
  const [assignee,   setAssignee]   = useState('All')
  const [activeTab,  setActiveTab]  = useState('pending')
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(null)
  const [form,       setForm]       = useState({
    title: '', related_to: '', assigned_to: '',
    due_date: '', priority: 'Medium', notes: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setTasks(data || [])
    setLoading(false)
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const openAdd = () => {
    setForm({
      title: '', related_to: '', assigned_to: '',
      due_date: '', priority: 'Medium', notes: '',
    })
    setShowAdd(true)
  }

  async function addTask() {
    if (!form.title.trim()) return alert('Task title is required')
    setSaving(true)
    const { error } = await supabase.from('tasks').insert({
      title:       form.title.trim(),
      related_to:  form.related_to.trim()  || null,
      assigned: form.assigned_to.trim() || null,
      due_date:    form.due_date            || null,
      priority:    form.priority            || 'Medium',
      notes:       form.notes.trim()        || null,
      status:      'pending',
    })
    setSaving(false)
    if (error) return alert('Error saving: ' + error.message)
    setShowAdd(false)
    load()
  }

  async function toggleComplete(task) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev =>
      prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
    )
  }

  async function deleteTask(id, title) {
    if (!window.confirm(`Delete task "${title}"?`)) return
    setDeleting(id)
    await supabase.from('tasks').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  // date helpers
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueDateLabel = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    const diff = Math.round((d - today) / (1000 * 60 * 60 * 24))
    if (diff < 0)   return `${Math.abs(diff)}d overdue`
    if (diff === 0) return 'Due today'
    if (diff === 1) return 'Due tomorrow'
    return `Due in ${diff}d`
  }

  const dueDateColor = (dateStr, status) => {
    if (status === 'completed') return theme.textLight
    if (!dateStr) return theme.textLight
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    const diff = Math.round((d - today) / (1000 * 60 * 60 * 24))
    if (diff < 0)   return theme.red
    if (diff === 0) return theme.yellow
    return theme.textLight
  }

  // counts
  const pendingCount   = tasks.filter(t => t.status === 'pending').length
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const overdueCount   = tasks.filter(t => {
    if (t.status === 'completed' || !t.due_date) return false
    const d = new Date(t.due_date)
    d.setHours(0, 0, 0, 0)
    return d < today
  }).length

  const stats = [
    { label: 'Pending',   value: pendingCount,   icon: '', iconBg: theme.dark,   color: theme.black,  },
    { label: 'Overdue',   value: overdueCount,   icon: '', iconBg: theme.dark,    color: theme.dark,   },
    { label: 'Completed', value: completedCount, icon: '', iconBg: theme.greenLight,          color: 'dark',     },
    { label: 'Total',     value: tasks.length,   icon: '', iconBg: theme.dark, color: theme.dark,  },
  ]

  const tabs = [
    { key: 'pending',   label: 'Pending',   count: pendingCount },
    { key: 'overdue',   label: 'Overdue',   count: overdueCount },
    { key: 'completed', label: 'Completed', count: completedCount },
    { key: 'all',       label: 'All',       count: tasks.length },
  ]

  // unique assignees from data
  const assignees = ['All', ...new Set(tasks.map(t => t.assigned_to).filter(Boolean))]

  // filter
  const filtered = tasks.filter(t => {
    const matchSearch = (
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.related_to?.toLowerCase().includes(search.toLowerCase()) ||
      t.assigned_to?.toLowerCase().includes(search.toLowerCase())
    )
    const matchPriority = priority === 'All' || t.priority === priority
    const matchAssignee = assignee === 'All' || t.assigned_to === assignee

    let matchTab = true
    if (activeTab === 'pending') {
      matchTab = t.status === 'pending'
    } else if (activeTab === 'completed') {
      matchTab = t.status === 'completed'
    } else if (activeTab === 'overdue') {
      if (t.status === 'completed' || !t.due_date) {
        matchTab = false
      } else {
        const d = new Date(t.due_date)
        d.setHours(0, 0, 0, 0)
        matchTab = d < today
      }
    }

    return matchSearch && matchPriority && matchAssignee && matchTab
  })

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: 0 }}>
            Tasks
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            Track team tasks and follow-ups
          </p>
        </div>
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
          }}
        >
          + Add Task
        </button>
      </div>

      {/* stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14,
        marginBottom: 24,
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderTop: `3px solid ${s.top}`,
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: s.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
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
            placeholder="Search tasks, client, or assignee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, width: '100%',
            }}
          />
        </div>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          style={{
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '8px 14px',
            fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="All">All Priority</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <select
          value={assignee}
          onChange={e => setAssignee(e.target.value)}
          style={{
            background: theme.cardBg, border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '8px 14px',
            fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
          }}
        >
          {assignees.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      {/* tabs */}
      <div style={{
        display: 'flex', gap: 2,
        borderBottom: `1px solid ${theme.border}`,
        marginBottom: 16,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key
                ? `2px solid ${theme.primary}` : '2px solid transparent',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? theme.primary : theme.textMid,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              marginBottom: -1,
            }}
          >
            {tab.label}
            <span style={{
              background: activeTab === tab.key ? theme.primaryLight : theme.pageBg,
              color: activeTab === tab.key ? theme.primaryText : theme.textMuted,
              fontSize: 11, fontWeight: 600,
              padding: '2px 7px', borderRadius: 10,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* task table */}
      <div style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>

        {/* header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px 3fr 1.5fr 1fr 1.2fr 1.2fr 1fr',
          padding: '10px 16px',
          background: theme.pageBg,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <span/>
          {['Task','Related To','Priority','Due Date','Assigned To','Actions'].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 600, color: theme.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {loading && (
          <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>Loading...</p>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: theme.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>
              {activeTab === 'completed' ? '🎉' : activeTab === 'overdue' ? '✅' : '📋'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid, marginBottom: 6 }}>
              {activeTab === 'completed' ? 'No completed tasks yet'
                : activeTab === 'overdue' ? 'No overdue tasks — great job!'
                : 'No tasks found'}
            </div>
            {activeTab === 'pending' && tasks.length === 0 && (
              <button
                onClick={openAdd}
                style={{
                  marginTop: 10, padding: '9px 20px',
                  background: theme.primary, border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                + Add First Task
              </button>
            )}
          </div>
        )}

        {filtered.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 3fr 1.5fr 1fr 1.2fr 1.2fr 1fr',
              padding: '13px 16px',
              borderBottom: i < filtered.length - 1 ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
              opacity: t.status === 'completed' ? 0.55 : 1,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >

            {/* checkbox */}
            <input
              type="checkbox"
              checked={t.status === 'completed'}
              onChange={() => toggleComplete(t)}
              style={{ cursor: 'pointer', width: 16, height: 16, accentColor: theme.primary }}
            />

            {/* title + notes */}
            <div>
              <div style={{
                fontSize: 13, fontWeight: 500, color: theme.textDark,
                textDecoration: t.status === 'completed' ? 'line-through' : 'none',
              }}>
                {t.title || '—'}
              </div>
              {t.notes && (
                <div style={{
                  fontSize: 11, color: theme.textLight, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280,
                }}>
                  {t.notes}
                </div>
              )}
            </div>

            {/* related to */}
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {t.related_to || '—'}
            </div>

            {/* priority */}
            <div>
              {t.priority ? (
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: (priorities[t.priority] || priorities['Low']).bg,
                  color: (priorities[t.priority] || priorities['Low']).color,
                }}>
                  {t.priority}
                </span>
              ) : '—'}
            </div>

            {/* due date */}
            <div>
              {t.due_date ? (
                <>
                  <div style={{
                    fontSize: 12, fontWeight: 500,
                    color: dueDateColor(t.due_date, t.status),
                  }}>
                    {dueDateLabel(t.due_date)}
                  </div>
                  <div style={{ fontSize: 11, color: theme.textLight, marginTop: 1 }}>
                    {new Date(t.due_date).toLocaleDateString()}
                  </div>
                </>
              ) : <span style={{ fontSize: 12, color: theme.textLight }}>—</span>}
            </div>

            {/* assigned to */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {t.assigned_to ? (
                <>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: theme.primaryLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: theme.primaryText, flexShrink: 0,
                  }}>
                    {t.assigned_to.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: 12, color: theme.textMid,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.assigned_to}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 12, color: theme.textLight }}>Unassigned</span>
              )}
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => toggleComplete(t)}
                style={{
                  padding: '5px 10px',
                  background: t.status === 'completed' ? theme.pageBg : theme.primaryLight,
                  border: `1px solid ${t.status === 'completed' ? theme.border : 'transparent'}`,
                  borderRadius: 6, fontSize: 12, fontWeight: 600,
                  color: t.status === 'completed' ? theme.textMid : theme.primaryText,
                  cursor: 'pointer',
                }}
              >
                {t.status === 'completed' ? '↩ Undo' : '✓ Done'}
              </button>
              <button
                onClick={() => deleteTask(t.id, t.title)}
                disabled={deleting === t.id}
                style={{
                  padding: '5px 8px',
                  background: '#fff5f5', border: '1px solid #fee2e2',
                  borderRadius: 6, fontSize: 12,
                  color: deleting === t.id ? theme.textMuted : theme.red,
                  cursor: deleting === t.id ? 'not-allowed' : 'pointer',
                }}
              >
                🗑️
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* add task modal */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 14, padding: 28, width: 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 22,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                Add New Task
              </h3>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  background: 'none', border: 'none', fontSize: 20,
                  cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>

            <FormField label="Task Title *">
              <input
                placeholder="e.g. Follow up with Ram Sharma"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                autoFocus
                style={fieldStyle}
              />
            </FormField>

            <FormField label="Related To (Client / Applicant)">
              <input
                placeholder="e.g. Ram Sharma"
                value={form.related_to}
                onChange={e => set('related_to', e.target.value)}
                style={fieldStyle}
              />
            </FormField>

            <FormField label="Assigned To">
              <input
                placeholder="e.g. Nabin, Sonika..."
                value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}
                style={fieldStyle}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Due Date">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => set('due_date', e.target.value)}
                  style={fieldStyle}
                />
              </FormField>
              <FormField label="Priority">
                <select
                  value={form.priority}
                  onChange={e => set('priority', e.target.value)}
                  style={fieldStyle}
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                placeholder="Any extra details..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </FormField>

            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22,
            }}>
              <button
                onClick={() => setShowAdd(false)}
                style={{
                  padding: '9px 18px', background: '#f9fafb',
                  border: '1px solid #e5e7eb', borderRadius: 8,
                  fontSize: 13, color: '#6b7280', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={addTask}
                disabled={saving}
                style={{
                  padding: '9px 22px',
                  background: saving ? '#9ca3af' : theme.primary,
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Add Task'}
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