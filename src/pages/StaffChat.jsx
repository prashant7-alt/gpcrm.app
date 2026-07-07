import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'

const avatarColor = (name) => {
  const colors = ['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0891b2']
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function StaffChat() {

  const profile   = JSON.parse(localStorage.getItem('profile') || '{}')
  const bottomRef = useRef(null)

  const [students,   setStudents]   = useState([])
  const [selected,   setSelected]   = useState(null)
  const [messages,   setMessages]   = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [sending,    setSending]    = useState(false)
  const [search,     setSearch]     = useState('')

  useEffect(() => { loadStudents() }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages()

    // realtime: listen for new messages in this conversation
    const channel = supabase
      .channel('staffchat-' + profile.id + '-' + selected.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const msg = payload.new
        // accept message if it belongs to this conversation (by name OR email)
        const involvesSender   = msg.sender_name === profile.name   || msg.sender_email === profile.email
        const involvesReceiver = msg.sender_name === selected.name  || msg.sender_email === selected.email
        const involvesMe       = msg.receiver_name === profile.name || msg.receiver_email === profile.email
        const involvesStudent  = msg.receiver_name === selected.name|| msg.receiver_email === selected.email

        if ((involvesSender && involvesStudent) || (involvesReceiver && involvesMe)) {
          setMessages(prev => {
            // avoid duplicate if loadMessages already added it
            if (prev.find(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages])

  async function loadStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('role', 'student')
      .order('name')
    setStudents(data || [])
  }

  async function loadMessages() {
    if (!selected) return
    setLoading(true)

    // query by BOTH name and email to catch all message combinations
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_email.eq.${selected.email},receiver_email.eq.${profile.email}),` +
        `and(sender_email.eq.${profile.email},receiver_email.eq.${selected.email}),` +
        `and(sender_name.eq.${selected.name},receiver_name.eq.${profile.name}),` +
        `and(sender_name.eq.${profile.name},receiver_name.eq.${selected.name})`
      )
      .order('created_at', { ascending: true })

    // deduplicate by id (the broad OR can return same row multiple times)
    const seen = new Set()
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
      sender_role:    profile.role,
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

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = formatDate(msg.created_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  const filteredStudents = students.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  // a message is "from me" if it was sent by the staff member (profile)
  const isFromMe = (msg) =>
    msg.sender_email === profile.email ||
    msg.sender_name  === profile.name

  return (
    <div style={{
      height: 'calc(100vh - 120px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textDark, margin: '0 0 4px' }}>
          Student Messages
        </h1>
        <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
          Chat with students directly
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Student list sidebar ──────────────────────────── */}
        <div style={{
          width: 260, flexShrink: 0,
          background: '#fff', border: `1px solid ${theme.border}`,
          borderRadius: 12, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 14px', borderBottom: `1px solid ${theme.border}`,
            fontSize: 11, fontWeight: 700, color: theme.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Students ({filteredStudents.length})
          </div>

          {/* search */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: theme.pageBg, border: `1px solid ${theme.border}`,
              borderRadius: 7, padding: '6px 10px',
            }}>
              <span style={{ color: theme.textMuted, fontSize: 13 }}>🔍</span>
              <input
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  fontSize: 12, color: theme.textMid, width: '100%', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {filteredStudents.length === 0 && (
              <p style={{ fontSize: 12, color: '#9ca3af', padding: '12px 8px', textAlign: 'center' }}>
                No students found
              </p>
            )}
            {filteredStudents.map(s => {
              const isSelected = selected?.id === s.id
              return (
                <div
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 10px', borderRadius: 8, cursor: 'pointer',
                    marginBottom: 2,
                    background: isSelected ? '#dcfce7' : 'transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = theme.pageBg }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
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
                      color: isSelected ? '#15803d' : theme.textDark,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </div>
                    <div style={{
                      fontSize: 11, color: theme.textLight,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.email}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Chat area ─────────────────────────────────────── */}
        <div style={{
          flex: 1, background: '#fff', border: `1px solid ${theme.border}`,
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
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
                Select a student to start chatting
              </div>
            </div>
          )}

          {selected && (
            <>
              {/* Chat header */}
              <div style={{
                padding: '14px 18px', borderBottom: `1px solid ${theme.border}`,
                display: 'flex', alignItems: 'center', gap: 12,
                flexShrink: 0,
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
                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.textDark }}>
                    {selected.name}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textLight }}>
                    {selected.email}
                  </div>
                </div>
              </div>

              {/* Messages scroll area */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 2,
                background: '#f9fafb', minHeight: 0,
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
                    <div style={{ fontSize: 13 }}>No messages yet with {selected.name}</div>
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
                            // Staff (me) = green bubble, student = white bubble
                            background: mine ? '#16a34a' : '#ffffff',
                            color:      mine ? '#ffffff' : '#111827',
                            border:     mine ? 'none' : '1px solid #e5e7eb',
                            padding: '9px 14px',
                            borderRadius: mine
                              ? '18px 18px 4px 18px'
                              : '18px 18px 18px 4px',
                            fontSize: 13, lineHeight: 1.5,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}>
                            {/* message text */}
                            <div style={{
                              color: mine ? '#ffffff' : '#111827',
                              wordBreak: 'break-word',
                            }}>
                              {msg.message || msg.content || ''}
                            </div>
                            {/* timestamp */}
                            <div style={{
                              fontSize: 10, marginTop: 4,
                              color: mine ? 'rgba(255,255,255,0.75)' : '#9ca3af',
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

                <div ref={bottomRef} />
              </div>

              {/* Input bar */}
              <div style={{
                padding: '12px 16px', borderTop: `1px solid ${theme.border}`,
                display: 'flex', gap: 10, alignItems: 'flex-end',
                background: '#fff', flexShrink: 0,
              }}>
                <textarea
                  placeholder={`Reply to ${selected.name}...`}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 14px',
                    border: `1px solid ${theme.border}`, borderRadius: 10,
                    fontSize: 13, color: '#111827', outline: 'none',
                    fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
                    background: '#fff', maxHeight: 120, overflowY: 'auto',
                  }}
                  onInput={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  style={{
                    padding: '10px 18px',
                    background: sending || !newMessage.trim() ? '#e5e7eb' : '#16a34a',
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
  )
}