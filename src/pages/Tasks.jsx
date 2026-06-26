import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
const STATUSES   = ['To Do', 'In Progress', 'Done']

const priorityStyle = (p) => {
  if (p === 'Urgent') return { bg: '#fee2e2', color: '#b91c1c' }
  if (p === 'High')   return { bg: '#fef9c3', color: '#a16207' }
  if (p === 'Medium') return { bg: '#dbeafe', color: '#1d4ed8' }
  return                     { bg: '#f3f4f6', color: '#6b7280' }
}

const statusColor = (s) => {
  if (s === 'Done')        return '#16a34a'
  if (s === 'In Progress') return '#2563eb'
  return                          '#9ca3af'
}

export default function Tasks() {

  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const isAdmin = profile.role === 'admin'

  const [tasks,      setTasks]      = useState([])
  const [staffList,  setStaffList]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editTask,   setEditTask]   = useState(null)
  const [search,     setSearch]     = useState('')
  const [filterAssignee, setFilterAssignee] = useState('All')
  const [filterStatus,   setFilterStatus]   = useState('All')

  const [form, setForm] = useState({
    title:       '',
    description: '',
    assigned_to: '',
    priority:    'Medium',
    due_date:    '',
    status:      'To Do',
  })

  useEffect(() => {
    load()
    loadStaff()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  // fetch staff from profiles table where role = staff or admin
  async function loadStaff() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['admin', 'staff'])
      .order('name')
    setStaffList(data || [])
  }

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  function openAdd() {
    setEditTask(null)
    setForm({
      title:       '',
      description: '',
      assigned_to: '',
      priority:    'Medium',
      due_date:    '',
      status:      'To Do',
    })
    setShowModal(true)
  }

  function openEdit(task) {
    setEditTask(task)
    setForm({
      title:       task.title       || '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      priority:    task.priority    || 'Medium',
      due_date:    task.due_date    || '',
      status:      task.status      || 'To Do',
    })
    setShowModal(true)
  }

  async function saveTask() {
    if (!form.title.trim()) {
      alert('Task title is required')
      return
    }

    if (editTask) {
      await supabase
        .from('tasks')
        .update({
          title:       form.title.trim(),
          description: form.description.trim(),
          assigned_to: form.assigned_to,
          priority:    form.priority,
          due_date:    form.due_date || null,
          status:      form.status,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', editTask.id)
    } else {
      await supabase.from('tasks').insert({
        title:       form.title.trim(),
        description: form.description.trim(),
        assigned_to: form.assigned_to,
        priority:    form.priority,
        due_date:    form.due_date || null,
        status:      'To Do',
        created_by:  profile.name || 'Admin',
      })
    }

    setShowModal(false)
    setEditTask(null)
    load()
  }

  async function deleteTask(id) {
    if (!window.confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    load()
  }

  async function quickStatus(task, newStatus) {
    await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id)
    load()
  }

  // filtering
  const filtered = tasks.filter(t => {
    const matchSearch  = t.title?.toLowerCase().includes(search.toLowerCase())
      || t.assigned_to?.toLowerCase().includes(search.toLowerCase())
    const matchAssign  = filterAssignee === 'All' || t.assigned_to === filterAssignee
    const matchStatus  = filterStatus   === 'All' || t.status === filterStatus
    return matchSearch && matchAssign && matchStatus
  })

  // counts per column for kanban
  const countByStatus = (s) => tasks.filter(t => t.status === s).length

  // is overdue
  const isOverdue = (task) => {
    if (!task.due_date || task.status === 'Done') return false
    return new Date(task.due_date) < new Date()
  }

  // unique assignees for filter dropdown
  const assignees = [...new Set(tasks.map(t => t.assigned_to).filter(Boolean))]

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* ── header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            Tasks
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Assign and track tasks across your team
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            style={{
              padding: '9px 20px',
              background: theme.primary || '#16a34a',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + Add Task
          </button>
        )}
      </div>

      {/* ── stat cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12, marginBottom: 20,
      }}>
        {STATUSES.map(s => (
          <div key={s} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderTop: `3px solid ${statusColor(s)}`,
            borderRadius: 10, padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColor(s), flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{s}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>
                {countByStatus(s)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── filters ── */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap',
      }}>
        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 200,
        }}>
          <span style={{ color: '#9ca3af' }}>🔍</span>
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: '#374151', width: '100%', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* filter by assignee */}
        <select
          value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}
          style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: '8px 14px',
            fontSize: 13, color: '#374151', outline: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <option value="All">All Assignees</option>
          {assignees.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {/* filter by status */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: '8px 14px',
            fontSize: 13, color: '#374151', outline: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── kanban board ── */}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading tasks...</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, alignItems: 'start',
        }}>
          {STATUSES.map(status => {
            const columnTasks = filtered.filter(t => t.status === status)
            return (
              <div key={status}>

                {/* column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 10, padding: '0 4px',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusColor(status),
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: '#374151',
                  }}>
                    {status}
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    background: '#f3f4f6', color: '#6b7280',
                    fontSize: 11, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {columnTasks.length}
                  </span>
                </div>

                {/* task cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {columnTasks.length === 0 && (
                    <div style={{
                      background: '#f9fafb',
                      border: '2px dashed #e5e7eb',
                      borderRadius: 10, padding: '30px 20px',
                      textAlign: 'center', color: '#9ca3af', fontSize: 12,
                    }}>
                      Drop tasks here
                    </div>
                  )}

                  {columnTasks.map(task => (
                    <div
                      key={task.id}
                      style={{
                        background: '#fff',
                        border: `1px solid ${isOverdue(task) ? '#fca5a5' : '#e5e7eb'}`,
                        borderLeft: `4px solid ${statusColor(task.status)}`,
                        borderRadius: 10,
                        padding: '14px 14px 12px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        transition: 'box-shadow 0.15s',
                      }}
                      onMouseEnter={e =>
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'}
                      onMouseLeave={e =>
                        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
                    >
                      {/* overdue warning */}
                      {isOverdue(task) && (
                        <div style={{
                          fontSize: 10, fontWeight: 700,
                          color: '#b91c1c', marginBottom: 6,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          ⚠️ Overdue
                        </div>
                      )}

                      {/* title */}
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        color: '#111827', marginBottom: 6, lineHeight: 1.3,
                      }}>
                        {task.title}
                      </div>

                      {/* description */}
                      {task.description && (
                        <div style={{
                          fontSize: 12, color: '#6b7280',
                          marginBottom: 10, lineHeight: 1.4,
                        }}>
                          {task.description}
                        </div>
                      )}

                      {/* priority badge */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 20,
                          fontSize: 10, fontWeight: 700,
                          background: priorityStyle(task.priority).bg,
                          color:      priorityStyle(task.priority).color,
                        }}>
                          {task.priority}
                        </span>

                        {task.due_date && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 20,
                            fontSize: 10, fontWeight: 600,
                            background: isOverdue(task) ? '#fee2e2' : '#f3f4f6',
                            color:      isOverdue(task) ? '#b91c1c' : '#6b7280',
                          }}>
                            📅 {new Date(task.due_date).toLocaleDateString('en-GB', {
                              day: '2-digit', month: 'short',
                            })}
                          </span>
                        )}
                      </div>

                      {/* assigned to */}
                      {task.assigned_to && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 7,
                          marginBottom: 12,
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: theme.primary || '#16a34a',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: '#fff',
                            flexShrink: 0,
                          }}>
                            {task.assigned_to.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                            {task.assigned_to}
                          </span>
                        </div>
                      )}

                      {/* action buttons */}
                      <div style={{
                        display: 'flex', gap: 6,
                        paddingTop: 10,
                        borderTop: '1px solid #f3f4f6',
                      }}>
                        {/* quick status change */}
                        {status !== 'In Progress' && (
                          <button
                            onClick={() => quickStatus(task, 'In Progress')}
                            style={{
                              flex: 1, padding: '5px 0',
                              background: '#dbeafe', border: 'none',
                              borderRadius: 6, fontSize: 11, fontWeight: 600,
                              color: '#1d4ed8', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            ▶ Start
                          </button>
                        )}

                        {status !== 'Done' && (
                          <button
                            onClick={() => quickStatus(task, 'Done')}
                            style={{
                              flex: 1, padding: '5px 0',
                              background: '#dcfce7', border: 'none',
                              borderRadius: 6, fontSize: 11, fontWeight: 600,
                              color: '#15803d', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            ✓ Done
                          </button>
                        )}

                        {status !== 'To Do' && (
                          <button
                            onClick={() => quickStatus(task, 'To Do')}
                            style={{
                              padding: '5px 10px',
                              background: '#f3f4f6', border: 'none',
                              borderRadius: 6, fontSize: 11, fontWeight: 600,
                              color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            ↩
                          </button>
                        )}

                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEdit(task)}
                              style={{
                                padding: '5px 10px',
                                background: '#f3f4f6', border: 'none',
                                borderRadius: 6, fontSize: 11,
                                color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              style={{
                                padding: '5px 10px',
                                background: '#fee2e2', border: 'none',
                                borderRadius: 6, fontSize: 11,
                                color: '#b91c1c', cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — ADD / EDIT TASK
          ════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 300,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16,
            padding: 28, width: 520,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>

            {/* modal header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 22,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#dcfce7',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16,
                }}>
                  ✅
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {editTask ? 'Edit Task' : 'Add Task'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: 'none',
                fontSize: 20, cursor: 'pointer', color: '#9ca3af',
              }}>×</button>
            </div>

            {/* task title */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Task Title *</label>
              <input
                placeholder="What needs to be done?"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                autoFocus
                style={inputStyle}
              />
            </div>

            {/* description */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description</label>
              <textarea
                placeholder="Details..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            {/* assigned to — fetched from real staff list */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Assigned To</label>
              <select
                value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}
                style={inputStyle}
              >
                <option value="">Unassigned</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
              {staffList.length === 0 && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                  ⚠️ No staff found — add staff members first from the Staff page.
                </div>
              )}
            </div>

            {/* priority + due date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => set('priority', e.target.value)}
                  style={inputStyle}
                >
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => set('due_date', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* status — only shown when editing */}
            {editTask && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Status</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => set('status', s)}
                      style={{
                        flex: 1, padding: '9px 4px',
                        borderRadius: 8, cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                        border: form.status === s
                          ? `2px solid ${statusColor(s)}`
                          : '2px solid #e5e7eb',
                        background: form.status === s ? `${statusColor(s)}18` : '#f9fafb',
                        color: form.status === s ? statusColor(s) : '#6b7280',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px',
                  background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: 8, fontSize: 13, color: '#6b7280',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveTask}
                style={{
                  padding: '10px 24px',
                  background: theme.primary || '#16a34a',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                💾 Save Task
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase',
  marginBottom: 6, letterSpacing: '0.04em',
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
}