import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'

const PRIORITIES = {
  High:   { bg: '#fee2e2', color: '#dc2626', dot: '#dc2626' },
  Medium: { bg: '#fef9c3', color: '#ca8a04', dot: '#ca8a04' },
  Low:    { bg: '#dcfce7', color: '#16a34a', dot: '#16a34a' },
}

const STATUSES = {
  'pending':     { label: 'To Do',       bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  'in_progress': { label: 'In Progress', bg: '#dbeafe', color: '#1d4ed8', dot: '#2563eb' },
  'completed':   { label: 'Done',        bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #e5e7eb', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#f9fafb',
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: 5,
}

function Avatar({ name, size = 28 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const colors = ['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0891b2']
  const bg = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function dueDateInfo(dateStr, status) {
  if (!dateStr) return { label: null, color: '#9ca3af' }
  if (status === 'completed') return {
    label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: '#9ca3af',
  }
  const today = new Date(); today.setHours(0,0,0,0)
  const due   = new Date(dateStr); due.setHours(0,0,0,0)
  const diff  = Math.round((due - today) / 86400000)
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: '#dc2626' }
  if (diff === 0) return { label: 'Due today',    color: '#ca8a04' }
  if (diff === 1) return { label: 'Due tomorrow', color: '#ca8a04' }
  return {
    label: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    color: '#6b7280',
  }
}

export default function Tasks() {

  const [tasks,    setTasks]    = useState([])
  const [staff,    setStaff]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [assignee, setAssignee] = useState('All')
  const [priority, setPriority] = useState('All')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)

  const emptyForm = {
    title: '', description: '', assigned_to: '',
    due_date: '', priority: 'Medium', status: 'pending', related_to: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('staff').select('id, name, role').order('name'),
    ])
    setTasks(t || [])
    setStaff(s || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

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
      assigned_to: form.assigned_to        || null,
      due_date:    form.due_date            || null,
      priority:    form.priority,
      status:      form.status,
      related_to:  form.related_to.trim()  || null,
    }

    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id)
    } else {
      await supabase.from('tasks').insert(payload)
    }

    setSaving(false)
    setShowAdd(false)
    setEditTask(null)
    load()
  }

  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return
    setDeleting(id)
    await supabase.from('tasks').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  async function changeStatus(task, newStatus) {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  // counts
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

  // unique assignees from tasks
  const assignees = ['All', ...new Set(tasks.map(t => t.assigned_to).filter(Boolean))]

  // filter
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

  // group by status
  const grouped = {
    pending:     filtered.filter(t => t.status === 'pending'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    completed:   filtered.filter(t => t.status === 'completed'),
  }

  const statCards = [
    { label: 'To Do',       value: counts.pending,     color: '#6b7280', bg: '#f3f4f6' },
    { label: 'In Progress', value: counts.in_progress, color: '#2563eb', bg: '#dbeafe' },
    { label: 'Done',        value: counts.completed,   color: '#16a34a', bg: '#dcfce7' },
    { label: 'Overdue',     value: overdueCount,        color: '#dc2626', bg: '#fee2e2' },
  ]

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Tasks</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Assign and track tasks across your team
          </p>
        </div>
        <button onClick={openAdd} style={{
          padding: '9px 18px', background: '#16a34a',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
          color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + Add Task
        </button>
      </div>

      {/* stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 24,
      }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: s.bg,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: s.color,
              }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: '8px 14px',
        }}>
          <span style={{ color: '#9ca3af', fontSize: 15 }}>🔍</span>
          <input
            placeholder="Search tasks, client, or assignee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: '#374151', width: '100%', fontFamily: 'inherit',
            }}
          />
        </div>
        <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, color: '#374151', outline: 'none', cursor: 'pointer',
        }}>
          {assignees.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, color: '#374151', outline: 'none', cursor: 'pointer',
        }}>
          <option value="All">All Priority</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </div>

      {/* kanban columns */}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading tasks...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, alignItems: 'flex-start',
        }}>
          {Object.entries(grouped).map(([statusKey, statusTasks]) => {
            const s = STATUSES[statusKey]
            return (
              <div key={statusKey}>

                {/* column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 12,
                  padding: '10px 14px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderTop: `3px solid ${s.dot}`,
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: s.dot,
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>
                    {s.label}
                  </span>
                  <span style={{
                    background: s.bg, color: s.color,
                    fontSize: 12, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {statusTasks.length}
                  </span>
                </div>

                {/* task cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {statusTasks.length === 0 && (
                    <div style={{
                      border: '2px dashed #e5e7eb', borderRadius: 10,
                      padding: '28px 16px', textAlign: 'center',
                      fontSize: 12, color: '#d1d5db',
                    }}>
                      Drop tasks here
                    </div>
                  )}

                  {statusTasks.map(task => {
                    const p    = PRIORITIES[task.priority] || PRIORITIES['Medium']
                    const due  = dueDateInfo(task.due_date, task.status)
                    const done = task.status === 'completed'

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderLeft: `4px solid ${p.dot}`,
                          borderRadius: 10,
                          padding: '14px 14px 12px',
                          opacity: done ? 0.7 : 1,
                        }}
                      >
                        {/* title + priority */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'flex-start', gap: 8, marginBottom: 6,
                        }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: '#111827',
                            textDecoration: done ? 'line-through' : 'none',
                            flex: 1, lineHeight: 1.4,
                          }}>
                            {task.title}
                          </div>
                          <span style={{
                            padding: '2px 8px', borderRadius: 20, fontSize: 11,
                            fontWeight: 600, background: p.bg, color: p.color,
                            flexShrink: 0,
                          }}>
                            {task.priority}
                          </span>
                        </div>

                        {/* description */}
                        {task.notes && (
                          <div style={{
                            fontSize: 12, color: '#6b7280', marginBottom: 8,
                            lineHeight: 1.4, overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {task.notes}
                          </div>
                        )}

                        {/* related to */}
                        {task.related_to && (
                          <div style={{
                            fontSize: 11, color: '#6b7280', marginBottom: 8,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <span>👤</span> {task.related_to}
                          </div>
                        )}

                        {/* due date */}
                        {due.label && (
                          <div style={{
                            fontSize: 11, fontWeight: 600,
                            color: due.color, marginBottom: 10,
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <span>🗓</span> {due.label}
                          </div>
                        )}

                        {/* assignee + actions row */}
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #f3f4f6', paddingTop: 10, marginTop: 4,
                        }}>
                          {/* assignee avatar */}
                          {task.assigned_to ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Avatar name={task.assigned_to} size={24} />
                              <span style={{ fontSize: 11, color: '#6b7280' }}>
                                {task.assigned_to}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#d1d5db' }}>Unassigned</span>
                          )}

                          {/* action buttons */}
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {/* status cycle buttons */}
                            {task.status !== 'in_progress' && task.status !== 'completed' && (
                              <button
                                onClick={() => changeStatus(task, 'in_progress')}
                                title="Start"
                                style={{
                                  padding: '4px 10px', background: '#dbeafe',
                                  border: 'none', borderRadius: 6,
                                  fontSize: 11, fontWeight: 600, color: '#1d4ed8',
                                  cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                ▶ Start
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => changeStatus(task, 'completed')}
                                title="Mark done"
                                style={{
                                  padding: '4px 10px', background: '#dcfce7',
                                  border: 'none', borderRadius: 6,
                                  fontSize: 11, fontWeight: 600, color: '#15803d',
                                  cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                ✓ Done
                              </button>
                            )}
                            {task.status === 'completed' && (
                              <button
                                onClick={() => changeStatus(task, 'pending')}
                                title="Reopen"
                                style={{
                                  padding: '4px 10px', background: '#f3f4f6',
                                  border: 'none', borderRadius: 6,
                                  fontSize: 11, fontWeight: 600, color: '#6b7280',
                                  cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                ↩ Reopen
                              </button>
                            )}

                            {/* edit */}
                            <button
                              onClick={() => openEdit(task)}
                              style={{
                                width: 28, height: 28, background: '#f9fafb',
                                border: '1px solid #e5e7eb', borderRadius: 6,
                                fontSize: 13, cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              ✏️
                            </button>

                            {/* delete */}
                            <button
                              onClick={() => deleteTask(task.id)}
                              disabled={deleting === task.id}
                              style={{
                                width: 28, height: 28, background: '#fff5f5',
                                border: '1px solid #fecaca', borderRadius: 6,
                                fontSize: 13, cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: '#dc2626',
                              }}
                            >
                              🗑
                            </button>
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
        <div
          onClick={() => setShowAdd(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 14, padding: 28, width: 480,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            {/* modal header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 22,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                {editTask ? 'Edit Task' : 'Add New Task'}
              </h3>
              <button onClick={() => setShowAdd(false)} style={{
                background: 'none', border: 'none', fontSize: 20,
                cursor: 'pointer', color: '#9ca3af',
              }}>✕</button>
            </div>

            {/* title */}
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

            {/* description */}
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

            {/* related to */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Related To (Client / Applicant)</label>
              <input
                placeholder="e.g. Ram Sharma"
                value={form.related_to}
                onChange={e => set('related_to', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* assign to staff dropdown */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Assign To Staff</label>
              <select
                value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select staff member —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            {/* due date + priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
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
                <select
                  value={form.priority}
                  onChange={e => set('priority', e.target.value)}
                  style={inputStyle}
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>

            {/* status — only show when editing */}
            {editTask && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  style={inputStyle}
                >
                  <option value="pending">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Done</option>
                </select>
              </div>
            )}

            {/* footer */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22,
            }}>
              <button onClick={() => setShowAdd(false)} style={{
                padding: '9px 18px', background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Cancel
              </button>
              <button onClick={saveTask} disabled={saving} style={{
                padding: '9px 22px',
                background: saving ? '#9ca3af' : '#16a34a',
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
                {saving ? 'Saving...' : editTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}