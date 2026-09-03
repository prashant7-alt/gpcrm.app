import { useState, useEffect } from 'react'
import theme from '../theme'
import { supabase } from '../supabase'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus, useRefreshHold } from '../hooks/useRefetchOnFocus'
import {
  Plus,
  Search,
  ListTodo,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Undo2,
  Pencil,
  Trash2,
  User,
  CalendarDays,
  X,
} from 'lucide-react'

const PRIORITIES = {
  High:   { bg: theme.status.danger.bg, color: theme.status.danger.main, dot: theme.status.danger.main },
  Medium: { bg: theme.status.warning.bg, color: theme.status.warning.text, dot: theme.status.warning.text },
  Low:    { bg: theme.status.success.bg, color: theme.status.success.main, dot: theme.status.success.main },
}

const STATUSES = {
  'pending':     { label: 'To Do',       bg: theme.surfaceAlt, color: theme.textLight, dot: theme.textMuted, Icon: ListTodo },
  'in_progress': { label: 'In Progress', bg: theme.status.info.bg, color: theme.primary, dot: theme.primary, Icon: Loader2  },
  'completed':   { label: 'Done',        bg: theme.status.success.bg, color: theme.status.success.text, dot: theme.status.success.main, Icon: CheckCircle2 },
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: `1px solid ${theme.border}`, borderRadius: 8,
  fontSize: 13, color: theme.textStrong, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: theme.pageBg,
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: theme.textLight, textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}

function Avatar({ name, size = 28 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const colors = [theme.status.success.main,theme.primary,theme.purple,theme.pink,theme.status.warning.main,theme.accent]
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: theme.white,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function dueDateInfo(dateStr, status) {
  if (!dateStr) return { label: null, color: theme.textMuted }
  if (status === 'completed') return {
    label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: theme.textMuted,
  }
  const today = new Date(); today.setHours(0,0,0,0)
  const due   = new Date(dateStr); due.setHours(0,0,0,0)
  const diff  = Math.round((due - today) / 86400000)
  if (diff < 0)   return { label: `${Math.abs(diff)}d overdue`, color: theme.status.danger.main }
  if (diff === 0) return { label: 'Due today',    color: theme.status.warning.text }
  if (diff === 1) return { label: 'Due tomorrow', color: theme.status.warning.text }
  return {
    label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: theme.textLight,
  }
}

export default function Tasks() {
  const isMobile = useIsMobile()

  const [tasks,    setTasks]    = useState([])
  const [staff,    setStaff]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [loadErr,  setLoadErr]  = useState('')
  const [search,   setSearch]   = useState('')
  const [assignee, setAssignee] = useState('All')
  const [priority, setPriority] = useState('All')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  const emptyForm = {
    title: '', description: '', assigned_to: '', assignee_id: '',
    due_date: '', priority: 'Medium', status: 'pending', related_to: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])
  useRefetchOnFocus(load)
  useRefreshHold(showAdd || !!editTask)

  async function load() {
    setLoading(true)
    setLoadErr('')

    const { data: t, error: tErr } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (tErr) {
      setLoadErr('Could not load tasks: ' + tErr.message)
      setLoading(false)
      return
    }

    // ✅ FIXED: assignable people now come from `profiles` ONLY.
    // Previously this merged `staff` and `profiles` rows and de-duplicated
    // by name text — but staff.id and profiles.id are unrelated UUIDs for
    // the same person, so a real foreign key couldn't safely target
    // either list. `profiles` already covers every non-student role
    // (it's the login-tied, authoritative table), so it's the single
    // consistent id space assignee_id now points at.
    const { data: profileRows, error: pErr } = await supabase
      .from('profiles')
      .select('id, name, role')
      .neq('role', 'student')
      .order('name')

    if (pErr) {
      setLoadErr('Could not load staff: ' + pErr.message)
    }

    setTasks(t || [])
    setStaff(profileRows || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function selectAssignee(id) {
    const person = staff.find(s => s.id === id)
    setForm(prev => ({
      ...prev,
      assignee_id: id,
      assigned_to: person ? person.name : '',
    }))
  }

  function openAdd() {
    setForm(emptyForm)
    setEditTask(null)
    setShowAdd(true)
  }

  function openEdit(task) {
    setForm({
      title:       task.title       || '',
      description: task.notes       || '',
      assigned_to: task.assigned_to || '',
      assignee_id: task.assignee_id || '',
      due_date:    task.due_date    || '',
      priority:    task.priority    || 'Medium',
      status:      task.status      || 'pending',
      related_to:  task.related_to  || '',
    })
    setEditTask(task)
    setShowAdd(true)
  }

  async function saveTask() {
    if (!form.title.trim()) return alert('Task title is required')
    setSaving(true)

    const payload = {
      title:       form.title.trim(),
      notes:       form.description.trim() || null,
      assigned_to: form.assigned_to        || null,  // display-only text, kept for backward compat
      assignee_id: form.assignee_id        || null,  // real FK → profiles.id
      due_date:    form.due_date            || null,
      priority:    form.priority,
      status:      form.status,
      related_to:  form.related_to.trim()  || null,
    }

    let error
    if (editTask) {
      const res = await supabase.from('tasks').update(payload).eq('id', editTask.id)
      error = res.error
      // Reflect the edit in the list immediately — no refetch / refresh needed.
      if (!error) setTasks(prev => prev.map(t => (t.id === editTask.id ? { ...t, ...payload } : t)))
    } else {
      const res = await supabase.from('tasks').insert(payload).select().single()
      error = res.error
      if (!error && res.data) setTasks(prev => [res.data, ...prev])
    }

    setSaving(false)

    if (error) {
      alert('Failed to save task: ' + error.message)
      return
    }

    setShowAdd(false)
    setEditTask(null)
  }

  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return
    setDeleting(id)
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    setDeleting(null)
    if (error) { alert('Delete failed: ' + error.message); return }
    setTasks(prev => prev.filter(t => t.id !== id))   // drop it from the list now
  }

  async function changeStatus(task, newStatus) {
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    if (error) { alert('Status update failed: ' + error.message); return }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  const counts = {
    pending:     tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed:   tasks.filter(t => t.status === 'completed').length,
  }

  const overdueCount = tasks.filter(t => {
    if (t.status === 'completed' || !t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    const today = new Date(); today.setHours(0,0,0,0)
    return d < today
  }).length

  const assignees = ['All', ...new Set(tasks.map(t => t.assigned_to).filter(Boolean))]

  const filtered = tasks.filter(t => {
    const matchSearch = (
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.related_to?.toLowerCase().includes(search.toLowerCase()) ||
      t.assigned_to?.toLowerCase().includes(search.toLowerCase())
    )
    const matchAssignee = assignee === 'All' || t.assigned_to === assignee
    const matchPriority = priority === 'All' || t.priority === priority
    return matchSearch && matchAssignee && matchPriority
  })

  const grouped = {
    pending:     filtered.filter(t => t.status === 'pending'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    completed:   filtered.filter(t => t.status === 'completed'),
  }

  const statCards = [
    { label: 'To Do',       value: counts.pending,     color: theme.textLight, bg: theme.surfaceAlt, Icon: ListTodo     },
    { label: 'In Progress', value: counts.in_progress, color: theme.primary, bg: theme.status.info.bg, Icon: Loader2      },
    { label: 'Done',        value: counts.completed,   color: theme.status.success.main, bg: theme.status.success.bg, Icon: CheckCircle2 },
    { label: 'Overdue',     value: overdueCount,        color: theme.status.danger.main, bg: theme.status.danger.bg, Icon: AlertCircle },
  ]

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

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
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textStrong, margin: 0 }}>Tasks</h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            Assign and track tasks across your team
          </p>
        </div>
        <button onClick={openAdd} style={{
          padding: '9px 18px', background: theme.status.success.main,
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
          color: theme.white, cursor: 'pointer', fontFamily: 'inherit',
          width: isMobile ? '100%' : 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>
          <Plus size={15} />
          Add Task
        </button>
      </div>

      {/* load error */}
      {loadErr && (
        <div style={{
          background: theme.status.danger.bg, border: `1px solid ${theme.status.danger.border}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: theme.status.danger.text,
        }}>
          <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />{loadErr}
          <br />
          <span style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, display: 'block' }}>
            Go to Supabase → SQL Editor and make sure the <strong>tasks</strong> table exists,
            has an <strong>assignee_id</strong> column, and RLS policies allow reads.
          </span>
        </div>
      )}

      {/* stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: isMobile ? 10 : 12, marginBottom: 24,
      }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: 10, padding: isMobile ? '14px 12px' : '18px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', gap: 8,
          }}>
            <div style={{
              width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: 10,
              background: s.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <s.Icon size={isMobile ? 16 : 18} color={s.color} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 11, color: theme.textLight, fontWeight: 500 }}>
              {s.label}
            </div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: 10, marginBottom: 20,
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: theme.white, border: `1px solid ${theme.border}`,
          borderRadius: 8, padding: '8px 14px',
        }}>
          <Search size={15} color={theme.textMuted} />
          <input
            placeholder="Search tasks, client, or assignee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, width: '100%', fontFamily: 'inherit',
            }}
          />
        </div>
        <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
          background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 8,
          padding: '8px 14px', fontSize: 13, color: theme.textMid, outline: 'none',
          width: isMobile ? '100%' : 'auto',
        }}>
          {assignees.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{
          background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 8,
          padding: '8px 14px', fontSize: 13, color: theme.textMid, outline: 'none',
          width: isMobile ? '100%' : 'auto',
        }}>
          <option value="All">All Priority</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </div>

      {/* kanban columns — desktop: 3 across. mobile: stacked full-width, one column at a time */}
      {loading ? (
        <p style={{ color: theme.textLight, fontSize: 13 }}>Loading tasks...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 16, alignItems: 'flex-start',
        }}>
          {Object.entries(grouped).map(([statusKey, statusTasks]) => {
            const s = STATUSES[statusKey]
            return (
              <div key={statusKey}>
                {/* column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                  padding: '10px 14px', background: theme.white,
                  border: `1px solid ${theme.border}`, borderTop: `3px solid ${s.dot}`,
                  borderRadius: 10,
                }}>
                  <s.Icon size={15} color={s.dot} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: theme.textStrong, flex: 1 }}>
                    {s.label}
                  </span>
                  <span style={{
                    background: s.bg, color: s.color,
                    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  }}>
                    {statusTasks.length}
                  </span>
                </div>

                {/* task cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {statusTasks.length === 0 && (
                    <div style={{
                      border: `2px dashed ${theme.border}`, borderRadius: 10,
                      padding: '28px 16px', textAlign: 'center',
                      fontSize: 12, color: theme.inputBorder,
                    }}>
                      Drop tasks here
                    </div>
                  )}

                  {statusTasks.map(task => {
                    const p   = PRIORITIES[task.priority] || PRIORITIES['Medium']
                    const due = dueDateInfo(task.due_date, task.status)
                    const done = task.status === 'completed'
                    return (
                      <div key={task.id} style={{
                        background: theme.white, border: `1px solid ${theme.border}`,
                        borderLeft: `4px solid ${p.dot}`, borderRadius: 10,
                        padding: '14px 14px 12px', opacity: done ? 0.7 : 1,
                      }}>
                        {/* title + priority */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'flex-start', gap: 8, marginBottom: 6,
                        }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: theme.textStrong,
                            textDecoration: done ? 'line-through' : 'none',
                            flex: 1, lineHeight: 1.4,
                          }}>
                            {task.title}
                          </div>
                          <span style={{
                            padding: '2px 8px', borderRadius: 20, fontSize: 11,
                            fontWeight: 600, background: p.bg, color: p.color, flexShrink: 0,
                          }}>
                            {task.priority}
                          </span>
                        </div>

                        {task.notes && (
                          <div style={{
                            fontSize: 12, color: theme.textLight, marginBottom: 8, lineHeight: 1.4,
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {task.notes}
                          </div>
                        )}

                        {task.related_to && (
                          <div style={{
                            fontSize: 11, color: theme.textLight, marginBottom: 8,
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <User size={12} /> {task.related_to}
                          </div>
                        )}

                        {due.label && (
                          <div style={{
                            fontSize: 11, fontWeight: 600, color: due.color,
                            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <CalendarDays size={12} /> {due.label}
                          </div>
                        )}

                        {/* assignee + actions */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          borderTop: `1px solid ${theme.surfaceAlt}`, paddingTop: 10, marginTop: 4,
                          flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 8,
                        }}>
                          {task.assigned_to ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar name={task.assigned_to} size={24} />
                              <span style={{ fontSize: 11, color: theme.textLight }}>{task.assigned_to}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: theme.inputBorder }}>Unassigned</span>
                          )}

                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {task.status === 'pending' && (
                              <button onClick={() => changeStatus(task, 'in_progress')} style={{
                                padding: '4px 10px', background: theme.status.info.bg,
                                border: 'none', borderRadius: 6, fontSize: 11,
                                fontWeight: 600, color: theme.primary, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}><Play size={11} /> Start</button>
                            )}
                            {task.status === 'in_progress' && (
                              <button onClick={() => changeStatus(task, 'completed')} style={{
                                padding: '4px 10px', background: theme.status.success.bg,
                                border: 'none', borderRadius: 6, fontSize: 11,
                                fontWeight: 600, color: theme.status.success.text, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}><CheckCircle2 size={11} /> Done</button>
                            )}
                            {task.status === 'completed' && (
                              <button onClick={() => changeStatus(task, 'pending')} style={{
                                padding: '4px 10px', background: theme.surfaceAlt,
                                border: 'none', borderRadius: 6, fontSize: 11,
                                fontWeight: 600, color: theme.textLight, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}><Undo2 size={11} /> Reopen</button>
                            )}
                            <button onClick={() => openEdit(task)} style={{
                              width: 28, height: 28, background: theme.pageBg,
                              border: `1px solid ${theme.border}`, borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}><Pencil size={13} color={theme.textLight} /></button>
                            <button onClick={() => deleteTask(task.id)} disabled={deleting === task.id} style={{
                              width: 28, height: 28, background: theme.status.danger.bg,
                              border: `1px solid ${theme.status.danger.border}`, borderRadius: 6,
                              cursor: 'pointer', color: theme.status.danger.main,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* add / edit modal */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 300,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: isMobile ? '14px 14px 0 0' : 14,
            padding: isMobile ? 20 : 28,
            width: isMobile ? '100%' : 480,
            maxHeight: '90vh', overflowY: 'auto',
            boxSizing: 'border-box',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 22,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
                {editTask ? 'Edit Task' : 'Add New Task'}
              </h3>
              <button onClick={() => setShowAdd(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'flex',
              }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Task Title *</label>
              <input
                placeholder="e.g. Follow up with Ram Sharma"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                autoFocus
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                placeholder="Additional details..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Related To (Client / Applicant)</label>
              <input
                placeholder="e.g. Ram Sharma"
                value={form.related_to}
                onChange={e => set('related_to', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>
                Assign To Staff
                {staff.length === 0 && (
                  <span style={{ color: theme.status.danger.main, marginLeft: 8, fontSize: 10 }}>
                    (no staff found — add staff first)
                  </span>
                )}
              </label>
              <select
                value={form.assignee_id}
                onChange={e => selectAssignee(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select staff member —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 12, marginBottom: 14,
            }}>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => set('due_date', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)} style={inputStyle}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>

            {editTask && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
                  <option value="pending">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Done</option>
                </select>
              </div>
            )}

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end', marginTop: 22,
            }}>
              <button onClick={() => setShowAdd(false)} style={{
                padding: '9px 18px', background: theme.pageBg,
                border: `1px solid ${theme.border}`, borderRadius: 8,
                fontSize: 13, color: theme.textLight, cursor: 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>Cancel</button>
              <button onClick={saveTask} disabled={saving} style={{
                padding: '9px 22px',
                background: saving ? theme.textMuted : theme.status.success.main,
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: theme.white,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <CheckCircle2 size={15} />
                {saving ? 'Saving...' : editTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}