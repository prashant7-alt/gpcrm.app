import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

export default function StudentChat() {
  const navigate  = useNavigate()
  const profile   = JSON.parse(localStorage.getItem('profile') || '{}')
  const bottomRef = useRef(null)

  const [staffList,   setStaffList]   = useState([])
  const [activeStaff, setActiveStaff] = useState(null)
  const [messages,    setMessages]    = useState([])
  const [text,        setText]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [unread,      setUnread]      = useState({})

  useEffect(() => {
    if (!profile.id) navigate('/login')
  }, [])

  // ── load only staff members ──────────────────────────────
  useEffect(() => {
    async function loadStaff() {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'staff')
        .order('name')
      setStaffList(data || [])
    }
    loadStaff()
  }, [])

  // ── load messages when active staff changes ──────────────
  useEffect(() => {
    if (!activeStaff) return
    loadMessages()
    markAsRead()
  }, [activeStaff])

  // ── realtime subscription ────────────────────────────────
  useEffect(() => {
    if (!profile.id) return

    const channel = supabase
      .channel('student-chat-' + profile.id)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
      }, (payload) => {
        const msg = payload.new
        if (
          activeStaff &&
          (
            (msg.sender_id === profile.id     && msg.receiver_id === activeStaff.id) ||
            (msg.sender_id === activeStaff.id && msg.receiver_id === profile.id)
          )
        ) {
          setMessages(prev => [...prev, msg])
          markAsRead()
        } else {
          if (msg.sender_id !== profile.id) {
            setUnread(prev => ({
              ...prev,
              [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
            }))
          }
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile.id, activeStaff])

  // ── FIX: scroll to bottom with timeout so DOM renders first ──
  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [messages])

  async function loadMessages() {
    if (!activeStaff || !profile.id) return
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${profile.id},receiver_id.eq.${activeStaff.id}),` +
        `and(sender_id.eq.${activeStaff.id},receiver_id.eq.${profile.id})`
      )
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoadingMsgs(false)
  }

  async function markAsRead() {
    if (!activeStaff || !profile.id) return
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', profile.id)
      .eq('sender_id', activeStaff.id)
      .eq('read', false)
    setUnread(prev => ({ ...prev, [activeStaff.id]: 0 }))
  }

  async function sendMessage() {
    if (!text.trim() || !activeStaff || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      sender_id:     profile.id,
      receiver_id:   activeStaff.id,
      sender_name:   profile.name || 'Student',
      receiver_name: activeStaff.name,
      message:       text.trim(),
    })
    if (!error) setText('')
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function formatTime(ts) {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(ts) {
    if (!ts) return ''
    const d   = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    const yest = new Date(); yest.setDate(yest.getDate() - 1)
    if (d.toDateString() === yest.toDateString()) return 'Yesterday'
    return d.toLocaleDateString()
  }

  function groupByDate(msgs) {
    const groups = []
    let lastDate = null
    msgs.forEach(m => {
      const d = formatDate(m.created_at)
      if (d !== lastDate) { groups.push({ type: 'date', label: d }); lastDate = d }
      groups.push({ type: 'msg', data: m })
    })
    return groups
  }

  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0)

  // ─────────────────────────────────────────────────────────
  // RENDER
  // FIX: outer div is height-constrained so the page never
  //      scrolls — only the message list scrolls internally
  // ─────────────────────────────────────────────────────────
  return (
    <StudentLayout>

      {/* FIX: fixed height container — prevents page from growing and scrolling */}
      <div style={{
        fontFamily: "'Segoe UI', Arial, sans-serif",
        height: 'calc(100vh - 88px)',   // 64px navbar + 24px padding
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',             // nothing escapes this box
      }}>

        {/* Page heading — fixed height so it doesn't push chat down */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Chat with Staff
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Send messages directly to your counselor or document officer
          </p>
        </div>

        {/* FIX: chat shell — height fills remaining space, overflow hidden */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          flex: 1,                        // takes all remaining vertical space
          minHeight: 0,                   // CRITICAL: lets flex child shrink below content size
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          overflow: 'hidden',
        }}>

          {/* ── STAFF SIDEBAR ──────────────────────────────── */}
          <div style={{
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            background: '#f9fafb',
            minHeight: 0,               // allows inner scroll
            overflow: 'hidden',
          }}>

            {/* Sidebar header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid #e5e7eb',
              fontSize: 12, fontWeight: 700,
              color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em',
              flexShrink: 0,
            }}>
              Staff Members
              {totalUnread > 0 && (
                <span style={{
                  marginLeft: 6, background: '#dc2626', color: '#fff',
                  borderRadius: 20, fontSize: 10, padding: '1px 6px', fontWeight: 700,
                }}>
                  {totalUnread}
                </span>
              )}
            </div>

            {/* FIX: staff list scrolls independently */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {staffList.length === 0 && (
                <div style={{ padding: 20, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                  No staff available
                </div>
              )}

              {staffList.map(staff => {
                const isActive  = activeStaff?.id === staff.id
                const unreadCnt = unread[staff.id] || 0
                const initials  = staff.name
                  ? staff.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                  : '?'

                return (
                  <div
                    key={staff.id}
                    onClick={() => setActiveStaff(staff)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '12px 14px', cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      background: isActive ? '#eff6ff' : 'transparent',
                      borderLeft: isActive ? '3px solid #1a56db' : '3px solid transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? '#1a56db' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      color: isActive ? '#fff' : '#374151',
                    }}>
                      {initials}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: isActive ? '#1a56db' : '#111827',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {staff.name}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                        background: '#ede9fe', color: '#7c3aed',
                      }}>
                        Staff
                      </span>
                    </div>

                    {unreadCnt > 0 && (
                      <span style={{
                        background: '#dc2626', color: '#fff',
                        borderRadius: 20, fontSize: 10, fontWeight: 700,
                        padding: '1px 7px', flexShrink: 0,
                      }}>
                        {unreadCnt}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── CHAT AREA ──────────────────────────────────── */}
          {!activeStaff ? (

            // Empty state
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#9ca3af', gap: 12,
            }}>
              <div style={{ fontSize: 48 }}>💬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                Select a staff member to start chatting
              </div>
              <div style={{ fontSize: 13 }}>Your messages are private and secure</div>
            </div>

          ) : (

            // Active chat
            // FIX: flex column with minHeight:0 so message list can scroll
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,             // CRITICAL: allows children to scroll
              overflow: 'hidden',
            }}>

              {/* Chat header — fixed, never scrolls */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#fff',
                flexShrink: 0,          // header never shrinks
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#1a56db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {activeStaff.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    {activeStaff.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{activeStaff.email}</div>
                </div>
              </div>

              {/* FIX: message list — flex:1 + minHeight:0 + overflowY:auto
                  This is the ONLY scrollable area. The page itself does not scroll. */}
              <div style={{
                flex: 1,
                minHeight: 0,           // CRITICAL: without this flex child won't shrink
                overflowY: 'auto',      // scrolls independently
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                background: '#fafafa',
              }}>
                {loadingMsgs && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                    Loading messages...
                  </div>
                )}

                {!loadingMsgs && messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 40 }}>
                    No messages yet. Say hello! 👋
                  </div>
                )}

                {groupByDate(messages).map((item, i) => {
                  if (item.type === 'date') return (
                    <div key={i} style={{
                      textAlign: 'center', margin: '12px 0',
                      fontSize: 11, color: '#9ca3af',
                    }}>
                      <span style={{ background: '#f3f4f6', padding: '3px 12px', borderRadius: 20 }}>
                        {item.label}
                      </span>
                    </div>
                  )

                  const msg  = item.data
                  const isMe = msg.sender_id === profile.id

                  return (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: 2,
                    }}>
                      <div style={{ maxWidth: '70%' }}>
                        <div style={{
                          padding: '9px 14px',
                          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: isMe ? '#1a56db' : '#fff',
                          color:      isMe ? '#fff'    : '#111827',
                          fontSize: 13, lineHeight: 1.5,
                          border: isMe ? 'none' : '1px solid #e5e7eb',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.message}
                        </div>
                        <div style={{
                          fontSize: 10, color: '#9ca3af', marginTop: 3,
                          textAlign: isMe ? 'right' : 'left',
                        }}>
                          {formatTime(msg.created_at)}
                          {isMe && (
                            <span style={{ marginLeft: 4 }}>
                              {msg.read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Scroll anchor — scrollIntoView targets this */}
                <div ref={bottomRef} />
              </div>

              {/* Input bar — fixed at bottom, never scrolls */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex', gap: 10, alignItems: 'flex-end',
                background: '#fff',
                flexShrink: 0,          // input bar never shrinks
              }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={`Message ${activeStaff.name}...`}
                  rows={1}
                  style={{
                    flex: 1, padding: '10px 14px',
                    border: '1px solid #d1d5db', borderRadius: 10,
                    fontSize: 13, fontFamily: 'inherit',
                    resize: 'none', outline: 'none', lineHeight: 1.5,
                    maxHeight: 120, overflowY: 'auto',
                  }}
                  onInput={e => {
                    // Auto-grow textarea up to 120px
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  style={{
                    padding: '10px 18px',
                    background: !text.trim() || sending ? '#e5e7eb' : '#1a56db',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    color: !text.trim() || sending ? '#9ca3af' : '#fff',
                    cursor: !text.trim() || sending ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {sending ? '...' : 'Send ↑'}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </StudentLayout>
  )
}