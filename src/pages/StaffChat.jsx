import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function StaffChat() {
  const navigate  = useNavigate()
  const profile   = JSON.parse(localStorage.getItem('profile') || '{}')
  const bottomRef = useRef(null)

  const [studentList,   setStudentList]   = useState([])
  const [activeStudent, setActiveStudent] = useState(null)
  const [messages,      setMessages]      = useState([])
  const [text,          setText]          = useState('')
  const [sending,       setSending]       = useState(false)
  const [loadingMsgs,   setLoadingMsgs]   = useState(false)
  const [unread,        setUnread]        = useState({})
  const [search,        setSearch]        = useState('')

  useEffect(() => {
    if (!profile.id) navigate('/login')
  }, [])

  useEffect(() => {
    async function loadStudents() {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('role', 'student')
        .order('name')
      setStudentList(data || [])
    }
    loadStudents()
  }, [])

  useEffect(() => {
    if (!activeStudent) return
    loadMessages()
    markAsRead()
  }, [activeStudent])

  useEffect(() => {
    if (!profile.id) return
    const channel = supabase
      .channel('staff-chat-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const msg = payload.new
        if (
          activeStudent &&
          (
            (msg.sender_id === profile.id      && msg.receiver_id === activeStudent.id) ||
            (msg.sender_id === activeStudent.id && msg.receiver_id === profile.id)
          )
        ) {
          setMessages(prev => [...prev, msg])
          markAsRead()
        } else {
          if (msg.sender_id !== profile.id) {
            setUnread(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }))
          }
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile.id, activeStudent])

  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [messages])

  async function loadMessages() {
    if (!activeStudent || !profile.id) return
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${profile.id},receiver_id.eq.${activeStudent.id}),` +
        `and(sender_id.eq.${activeStudent.id},receiver_id.eq.${profile.id})`
      )
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoadingMsgs(false)
  }

  async function markAsRead() {
    if (!activeStudent || !profile.id) return
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', profile.id)
      .eq('sender_id', activeStudent.id)
      .eq('read', false)
    setUnread(prev => ({ ...prev, [activeStudent.id]: 0 }))
  }

  async function sendMessage() {
    if (!text.trim() || !activeStudent || sending) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      sender_id:     profile.id,
      receiver_id:   activeStudent.id,
      sender_name:   profile.name || 'Staff',
      receiver_name: activeStudent.name,
      message:       text.trim(),
    })
    if (!error) setText('')
    setSending(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function formatTime(ts) {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(ts) {
    if (!ts) return ''
    const d = new Date(ts), now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    const yest = new Date(); yest.setDate(yest.getDate() - 1)
    if (d.toDateString() === yest.toDateString()) return 'Yesterday'
    return d.toLocaleDateString()
  }

  function groupByDate(msgs) {
    const groups = []; let lastDate = null
    msgs.forEach(m => {
      const d = formatDate(m.created_at)
      if (d !== lastDate) { groups.push({ type: 'date', label: d }); lastDate = d }
      groups.push({ type: 'msg', data: m })
    })
    return groups
  }

  const totalUnread  = Object.values(unread).reduce((s, n) => s + n, 0)
  const filteredList = studentList.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    // ── FIXED: outer div takes exact remaining height, no overflow ──
    <div style={{
      fontFamily: "'Segoe UI', Arial, sans-serif",
      height: 'calc(100vh - 88px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* page header */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          Chat with Students
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Communicate directly with your students
        </p>
      </div>

      {/* ── FIXED: chat container fills remaining space exactly ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        flex: 1,
        minHeight: 0,       // ← critical: allows flex child to shrink below content size
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 14,
        overflow: 'hidden',
      }}>

        {/* ── STUDENT LIST ── */}
        <div style={{
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          background: '#f9fafb',
          minHeight: 0,      // ← allows inner scroll to work
        }}>
          {/* header + search — fixed, doesn't scroll */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
            }}>
              Students {totalUnread > 0 && (
                <span style={{
                  marginLeft: 6, background: '#dc2626', color: '#fff',
                  borderRadius: 20, fontSize: 10, padding: '1px 6px', fontWeight: 700,
                }}>
                  {totalUnread}
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px',
                border: '1px solid #d1d5db', borderRadius: 8,
                fontSize: 12, outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box', background: '#fff', color: '#111827',
              }}
            />
          </div>

          {/* scrollable student list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filteredList.length === 0 && (
              <div style={{ padding: 20, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                {search ? 'No students found' : 'No students yet'}
              </div>
            )}
            {filteredList.map(student => {
              const isActive  = activeStudent?.id === student.id
              const unreadCnt = unread[student.id] || 0
              const initials  = student.name
                ? student.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
                : '?'
              return (
                <div
                  key={student.id}
                  onClick={() => setActiveStudent(student)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11,
                    padding: '12px 14px', cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    background: isActive ? '#f0fdf4' : 'transparent',
                    borderLeft: isActive ? '3px solid #16a34a' : '3px solid transparent',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: isActive ? '#16a34a' : '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    color: isActive ? '#fff' : '#374151',
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: isActive ? '#16a34a' : '#111827',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {student.name}
                    </div>
                    <div style={{
                      fontSize: 11, color: '#6b7280',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {student.email}
                    </div>
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

        {/* ── CHAT AREA ── */}
        {!activeStudent ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#9ca3af', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
              Select a student to start chatting
            </div>
            <div style={{ fontSize: 13 }}>Messages are private between you and the student</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* chat header — fixed */}
            <div style={{
              padding: '14px 18px', flexShrink: 0,
              borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#16a34a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {activeStudent.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {activeStudent.name}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{activeStudent.email}</div>
              </div>
            </div>

            {/* messages — scrollable */}
            <div style={{
              flex: 1, overflowY: 'auto', minHeight: 0,
              padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 4,
              background: '#fafafa',
            }}>
              {loadingMsgs && (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                  Loading messages...
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 40 }}>
                  No messages yet. Start the conversation! 👋
                </div>
              )}
              {groupByDate(messages).map((item, i) => {
                if (item.type === 'date') return (
                  <div key={i} style={{ textAlign: 'center', margin: '12px 0', fontSize: 11, color: '#9ca3af' }}>
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
                        background: isMe ? '#16a34a' : '#fff',
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
                        {isMe && <span style={{ marginLeft: 4 }}>{msg.read ? ' ✓✓' : ' ✓'}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* input — fixed at bottom */}
            <div style={{
              padding: '12px 16px', flexShrink: 0,
              borderTop: '1px solid #e5e7eb',
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: '#fff',
            }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Message ${activeStudent.name}...`}
                rows={1}
                style={{
                  flex: 1, padding: '10px 14px',
                  border: '1px solid #d1d5db', borderRadius: 10,
                  fontSize: 13, fontFamily: 'inherit', resize: 'none',
                  outline: 'none', lineHeight: 1.5,
                  maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!text.trim() || sending}
                style={{
                  padding: '10px 18px',
                  background: !text.trim() || sending ? '#e5e7eb' : '#16a34a',
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
  )
}