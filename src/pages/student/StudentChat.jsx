import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

const avatarColor = (name) => {
  const colors = ['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0891b2']
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Color-coded role badges so students can identify who they're talking to
const roleColor = (role) => {
  if (!role) return { bg: '#f3f4f6', color: '#6b7280' }
  const r = role.toLowerCase()
  if (r.includes('document'))  return { bg: '#dbeafe', color: '#1d4ed8' }
  if (r.includes('visa'))      return { bg: '#ede9fe', color: '#6d28d9' }
  if (r.includes('finance'))   return { bg: '#dcfce7', color: '#15803d' }
  if (r.includes('marketing')) return { bg: '#fef9c3', color: '#a16207' }
  if (r.includes('counsel'))   return { bg: '#ffedd5', color: '#c2410c' }
  if (r.includes('admin'))     return { bg: '#fee2e2', color: '#b91c1c' }
  return                              { bg: '#f3f4f6', color: '#6b7280' }
}

export default function StudentChat() {

  const navigate     = useNavigate()
  const profile      = JSON.parse(localStorage.getItem('profile') || '{}')
  const bottomRef    = useRef(null)

  const [staff,       setStaff]       = useState([])
  const [selected,    setSelected]    = useState(null)
  const [messages,    setMessages]    = useState([])
  const [newMessage,  setNewMessage]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [sending,     setSending]     = useState(false)

  useEffect(() => {
    if (!profile.id) { navigate('/login'); return }
    loadStaff()
  }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages()

    // Realtime: listen for new messages in this conversation
    const channel = supabase
      .channel('chat-' + profile.id + '-' + selected.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const msg = payload.new
        // match by email (reliable) OR name (fallback)
        const fromMe    = msg.sender_email   === profile.email  || msg.sender_name   === profile.name
        const fromThem  = msg.sender_email   === selected.email || msg.sender_name   === selected.name
        const toMe      = msg.receiver_email === profile.email  || msg.receiver_name === profile.name
        const toThem    = msg.receiver_email === selected.email || msg.receiver_name === selected.name

        if ((fromMe && toThem) || (fromThem && toMe)) {
          setMessages(prev => {
            // prevent duplicate if loadMessages already caught it
            if (prev.find(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // FIX: timeout lets DOM render the new message before scrolling
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected])

  // Scroll to bottom whenever messages update
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages])

  // Fetch from staff table so we get real roles (Document Handler, Visa Officer etc.)
  async function loadStaff() {
    const { data } = await supabase
      .from('staff')
      .select('id, name, role, email')
      .order('name')
    setStaff(data || [])
  }

  async function loadMessages() {
    if (!selected) return
    setLoading(true)

    // Query by BOTH email AND name to catch all message combinations.
    // Old messages may only have name; new messages should have both.
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_email.eq.${profile.email},receiver_email.eq.${selected.email}),` +
        `and(sender_email.eq.${selected.email},receiver_email.eq.${profile.email}),` +
        `and(sender_name.eq.${profile.name},receiver_name.eq.${selected.name}),` +
        `and(sender_name.eq.${selected.name},receiver_name.eq.${profile.name})`
      )
      .order('created_at', { ascending: true })

    // Deduplicate — the broad OR can return the same row multiple times
    const seen   = new Set()
    const deduped = (data || []).filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    setMessages(deduped)
    setLoading(false)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selected) return
    setSending(true)

    const { error } = await supabase.from('messages').insert({
      message:        newMessage.trim(),
      sender_name:    profile.name,
      sender_email:   profile.email,
      sender_role:    'student',
      receiver_name:  selected.name,
      receiver_email: selected.email || '',
      is_read:        false,
    })

    setSending(false)
    if (error) { alert('Failed to send: ' + error.message); return }
    setNewMessage('')
    loadMessages()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d         = new Date(ts)
    const today     = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString())     return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Group messages by date for the date-divider display
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  // True if message was sent by the student (me)
  const isFromMe = (msg) =>
    msg.sender_email === profile.email ||
    msg.sender_name  === profile.name

  return (
    <StudentLayout>
      <div style={{
        height: 'calc(100vh - 100px)',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        overflow: 'hidden',
      }}>

        {/* Page header */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Chat with Staff
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Send messages directly to your counselor or document handler
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          {/* ── Staff list sidebar ──────────────────────────── */}
          <div style={{
            width: 240, flexShrink: 0,
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 12, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid #e5e7eb',
              fontSize: 11, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              flexShrink: 0,
            }}>
              Staff Members
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px' }}>
              {staff.length === 0 && (
                <p style={{ fontSize: 12, color: '#9ca3af', padding: '12px 8px', textAlign: 'center' }}>
                  No staff available
                </p>
              )}
              {staff.map(s => {
                const isSelected = selected?.id === s.id
                const rc = roleColor(s.role)
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelected(s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 10px', borderRadius: 8, cursor: 'pointer',
                      marginBottom: 2,
                      background: isSelected ? '#ede9fe' : 'transparent',
                      borderLeft: isSelected ? '3px solid #7c3aed' : '3px solid transparent',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: avatarColor(s.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {getInitials(s.name)}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? '#7c3aed' : '#111827',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {s.name}
                      </div>
                      {/* Real role from staff table — color-coded */}
                      <span style={{
                        display: 'inline-block', marginTop: 2,
                        padding: '1px 8px', borderRadius: 20,
                        fontSize: 10, fontWeight: 600,
                        background: rc.bg, color: rc.color,
                      }}>
                        {s.role || 'Staff'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Chat area ──────────────────────────────────── */}
          <div style={{
            flex: 1, background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 12, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minHeight: 0,
          }}>

            {/* Empty state */}
            {!selected && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
              }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>💬</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
                  Select a staff member to start chatting
                </div>
              </div>
            )}

            {selected && (
              <>
                {/* Chat header — shows name + real role badge */}
                <div style={{
                  padding: '14px 18px', borderBottom: '1px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#fafafa', flexShrink: 0,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: avatarColor(selected.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {getInitials(selected.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                      {selected.name}
                    </div>
                    <span style={{
                      display: 'inline-block', marginTop: 2,
                      padding: '1px 8px', borderRadius: 20,
                      fontSize: 10, fontWeight: 600,
                      background: roleColor(selected.role).bg,
                      color: roleColor(selected.role).color,
                    }}>
                      {selected.role || 'Staff'}
                    </span>
                  </div>
                </div>

                {/* Messages scroll area */}
                <div style={{
                  flex: 1, overflowY: 'auto', minHeight: 0,
                  padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  background: '#f9fafb',
                }}>
                  {loading && (
                    <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>
                      Loading messages...
                    </p>
                  )}

                  {!loading && messages.length === 0 && (
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      color: '#9ca3af', paddingTop: 60,
                    }}>
                      <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>✉️</div>
                      <div style={{ fontSize: 13 }}>
                        No messages yet. Say hello to {selected.name}!
                      </div>
                    </div>
                  )}

                  {Object.entries(groupedMessages).map(([date, msgs]) => (
                    <div key={date}>
                      {/* Date divider */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        margin: '12px 0 8px',
                      }}>
                        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                        <span style={{
                          fontSize: 11, color: '#9ca3af', fontWeight: 600,
                          padding: '2px 10px', background: '#fff',
                          borderRadius: 20, border: '1px solid #e5e7eb',
                          whiteSpace: 'nowrap',
                        }}>
                          {date}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                      </div>

                      {msgs.map((msg, i) => {
                        const mine = isFromMe(msg)
                        return (
                          <div key={msg.id || i} style={{
                            display: 'flex',
                            justifyContent: mine ? 'flex-end' : 'flex-start',
                            marginBottom: 6,
                          }}>
                            <div style={{
                              maxWidth: '70%',
                              // Student (me) = purple bubble, staff = light gray bubble
                              background: mine ? '#7c3aed' : '#ffffff',
                              color:      mine ? '#ffffff' : '#111827',
                              border:     mine ? 'none'   : '1px solid #e5e7eb',
                              padding: '9px 14px',
                              borderRadius: mine
                                ? '18px 18px 4px 18px'
                                : '18px 18px 18px 4px',
                              fontSize: 13, lineHeight: 1.5,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}>
                              {/* Staff sender label on received messages */}
                              {!mine && (
                                <div style={{
                                  fontSize: 10, fontWeight: 700,
                                  color: roleColor(selected.role).color,
                                  marginBottom: 4,
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                }}>
                                  {msg.sender_name || selected.name}
                                </div>
                              )}
                              {/* Message text — explicit color so it's always visible */}
                              <div style={{
                                color: mine ? '#ffffff' : '#111827',
                                wordBreak: 'break-word',
                              }}>
                                {msg.message || msg.content || ''}
                              </div>
                              {/* Timestamp */}
                              <div style={{
                                fontSize: 10, marginTop: 4,
                                color: mine ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                                textAlign: 'right',
                              }}>
                                {formatTime(msg.created_at)}
                                {mine && ' ✓'}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* Scroll anchor */}
                  <div ref={bottomRef} />
                </div>

                {/* Input bar */}
                <div style={{
                  padding: '12px 16px', borderTop: '1px solid #e5e7eb',
                  display: 'flex', gap: 10, alignItems: 'flex-end',
                  background: '#fff', flexShrink: 0,
                }}>
                  <textarea
                    placeholder={`Message ${selected.name}...`}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    style={{
                      flex: 1, padding: '10px 14px',
                      border: '1px solid #e5e7eb', borderRadius: 10,
                      fontSize: 13, color: '#111827', outline: 'none',
                      fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
                      background: '#fff', maxHeight: 120, overflowY: 'auto',
                    }}
                    onInput={e => {
                      // auto-grow textarea up to 120px
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    style={{
                      padding: '10px 18px',
                      background: sending || !newMessage.trim() ? '#e5e7eb' : '#7c3aed',
                      border: 'none', borderRadius: 10,
                      fontSize: 13, fontWeight: 600,
                      color: sending || !newMessage.trim() ? '#9ca3af' : '#fff',
                      cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', flexShrink: 0,
                      transition: 'background 0.15s',
                    }}
                  >
                    {sending ? 'Sending...' : 'Send ↑'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  )
}