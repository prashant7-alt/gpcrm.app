import { useState, useEffect, useRef } from 'react'
import { Search, MessageSquareText, Mail, Check } from 'lucide-react'
import { supabase } from '../supabase'
import theme from '../theme'
import { useIsMobile } from '../hooks/useIsMobile'

const avatarColor = (name) => {
  const colors = [theme.status.success.main,theme.primary,theme.purple,theme.pink,theme.status.warning.main,theme.accent]
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Stable key for a student / a message's sender, so unread counts line up
// whether the row was saved with an email, a name, or both.
const keyOf       = (s) => (s?.email || s?.name || '').trim().toLowerCase()
const senderKeyOf = (m) => (m?.sender_email || m?.sender_name || '').trim().toLowerCase()

// Case/whitespace-tolerant compare — names & emails can differ slightly
// between the `staff` table, the `profiles` table and the stored login.
const norm  = (v) => (v || '').trim().toLowerCase()
const same  = (a, b) => norm(a) !== '' && norm(a) === norm(b)

export default function StaffChat() {
  const isMobile = useIsMobile()

  const profile     = JSON.parse(localStorage.getItem('profile') || '{}')
  const bottomRef   = useRef(null)
  const selectedRef = useRef(null)

  const [students,   setStudents]   = useState([])
  const [selected,   setSelected]   = useState(null)
  const [messages,   setMessages]   = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [sending,    setSending]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [unread,     setUnread]     = useState({})   // { [studentKey]: count }
  const [lastAt,     setLastAt]     = useState({})   // { [studentKey]: last message time }

  useEffect(() => { selectedRef.current = selected }, [selected])

  // Mount: load students + keep a permanent inbox listener so a student's
  // message bumps their row to the top with an unread badge, even when the
  // staff member is looking at another conversation.
  useEffect(() => {
    loadStudents()

    const channel = supabase
      .channel('staffchat-inbox-' + (profile.id || profile.email || 'me'))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const m      = payload.new
        const toMe   = same(m.receiver_email, profile.email) || same(m.receiver_name, profile.name)
        const fromMe = same(m.sender_email,   profile.email) || same(m.sender_name,   profile.name)
        if (!toMe || fromMe) return

        const k = senderKeyOf(m)
        setLastAt(prev => ({ ...prev, [k]: m.created_at }))

        // Conversation already open on screen → mark read instead of badging
        if (selectedRef.current && keyOf(selectedRef.current) === k) {
          markRead(selectedRef.current)
          return
        }
        setUnread(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (!selected) return
    loadMessages()
    markRead(selected)

    // realtime: listen for new messages in this conversation
    const channel = supabase
      .channel('staffchat-' + profile.id + '-' + selected.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, (payload) => {
        const msg = payload.new
        // accept message if it belongs to this conversation (by name OR email)
        const involvesSender   = same(msg.sender_name, profile.name)   || same(msg.sender_email, profile.email)
        const involvesReceiver = same(msg.sender_name, selected.name)  || same(msg.sender_email, selected.email)
        const involvesMe       = same(msg.receiver_name, profile.name) || same(msg.receiver_email, profile.email)
        const involvesStudent  = same(msg.receiver_name, selected.name)|| same(msg.receiver_email, selected.email)

        if ((involvesSender && involvesStudent) || (involvesReceiver && involvesMe)) {
          setMessages(prev => {
            // avoid duplicate if loadMessages already added it
            if (prev.find(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // message from the student while their chat is open → clear the badge
          if (involvesReceiver && involvesMe) markRead(selected)
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages])

  // Fallback polling — Supabase Realtime may not be enabled on the `messages`
  // table for every deployment. Poll unread counts (and the open conversation)
  // on a short interval so a student's message still surfaces within seconds
  // without the staff member refreshing the page.
  useEffect(() => {
    const id = setInterval(() => {
      loadUnread()
      if (selectedRef.current) loadMessages(selectedRef.current, { silent: true })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  async function loadStudents() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('role', 'student')
      .order('name')
    setStudents(data || [])
    loadUnread()
  }

  // Count unread messages addressed to this staff member, grouped by student,
  // and remember each conversation's newest message time for list ordering.
  async function loadUnread() {
    const { data } = await supabase
      .from('messages')
      .select('sender_name, sender_email, receiver_name, receiver_email, created_at')
      .eq('is_read', false)

    const mine = (data || []).filter(m =>
      (same(m.receiver_email, profile.email) || same(m.receiver_name, profile.name)) &&
      !(same(m.sender_email, profile.email) || same(m.sender_name, profile.name))
    )

    const counts = {}
    const times  = {}
    for (const m of mine) {
      const k = senderKeyOf(m)
      if (!k) continue
      counts[k] = (counts[k] || 0) + 1
      if (!times[k] || new Date(m.created_at) > new Date(times[k])) times[k] = m.created_at
    }
    setUnread(counts)
    setLastAt(prev => ({ ...prev, ...times }))
  }

  // Mark every unread message from this student → me as read, and drop the badge.
  async function markRead(student) {
    if (!student) return
    const k = keyOf(student)
    setUnread(prev => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('is_read', false)
      .or(
        `and(sender_email.eq.${student.email},receiver_email.eq.${profile.email}),` +
        `and(sender_name.eq.${student.name},receiver_name.eq.${profile.name})`
      )
  }

  async function loadMessages(who = selected, { silent = false } = {}) {
    if (!who) return
    if (!silent) setLoading(true)

    // query by BOTH name and email to catch all message combinations
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_email.eq.${who.email},receiver_email.eq.${profile.email}),` +
        `and(sender_email.eq.${profile.email},receiver_email.eq.${who.email}),` +
        `and(sender_name.eq.${who.name},receiver_name.eq.${profile.name}),` +
        `and(sender_name.eq.${profile.name},receiver_name.eq.${who.name})`
      )
      .order('created_at', { ascending: true })

    // deduplicate by id (the broad OR can return same row multiple times)
    const seen = new Set()
    const deduped = (data || []).filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    // Only update state when something actually changed, so a background
    // poll doesn't re-render / yank the scroll position while you're reading.
    setMessages(prev => {
      const changed = prev.length !== deduped.length ||
        prev[prev.length - 1]?.id !== deduped[deduped.length - 1]?.id
      if (!changed) return prev
      // a fresh inbound message while this chat is open → clear its badge
      if (silent && deduped.length > prev.length) markRead(who)
      return deduped
    })
    if (!silent) setLoading(false)
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

  const filteredStudents = students
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const ka = keyOf(a), kb = keyOf(b)
      const ua = unread[ka] || 0, ub = unread[kb] || 0
      if (ua !== ub) return ub - ua                       // unread conversations first
      const ta = lastAt[ka], tb = lastAt[kb]
      if (ta && tb) return new Date(tb) - new Date(ta)    // then most recent activity
      if (ta) return -1
      if (tb) return 1
      return (a.name || '').localeCompare(b.name || '')
    })

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0)

  // a message is "from me" if it was sent by the staff member (profile)
  const isFromMe = (msg) =>
    same(msg.sender_email, profile.email) ||
    same(msg.sender_name,  profile.name)

  // ── Shared sub-renders (used by both desktop pane and mobile full-screen) ──

  const studentList = (
    <div style={{
      width: isMobile ? '100%' : 260, flexShrink: 0,
      background: theme.white, border: `1px solid ${theme.border}`,
      borderRadius: isMobile ? 0 : 12, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      height: isMobile ? '100%' : 'auto',
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${theme.border}`,
        fontSize: 11, fontWeight: 700, color: theme.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>Students ({filteredStudents.length})</span>
        {totalUnread > 0 && (
          <span style={{
            marginLeft: 'auto',
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9, background: theme.status.success.main, color: theme.white,
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {totalUnread}
          </span>
        )}
      </div>

      {/* search */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${theme.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.pageBg, border: `1px solid ${theme.border}`,
          borderRadius: 7, padding: '6px 10px',
        }}>
          <Search size={15} style={{ color: theme.textMuted, flexShrink: 0 }} />
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
          <p style={{ fontSize: 12, color: theme.textMuted, padding: '12px 8px', textAlign: 'center' }}>
            No students found
          </p>
        )}
        {filteredStudents.map(s => {
          const isSelected  = selected?.id === s.id
          const unreadCount = unread[keyOf(s)] || 0
          return (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px', borderRadius: 8, cursor: 'pointer',
                marginBottom: 2,
                background: isSelected && !isMobile
                  ? theme.status.success.bg
                  : unreadCount > 0 ? theme.status.success.bg : 'transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = theme.pageBg }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = unreadCount > 0 ? theme.status.success.bg : 'transparent' }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: avatarColor(s.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: theme.white, flexShrink: 0,
              }}>
                {getInitials(s.name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: unreadCount > 0 ? 700 : (isSelected && !isMobile ? 600 : 500),
                  color: isSelected && !isMobile ? theme.status.success.text : theme.textDark,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {s.name}
                </div>
                <div style={{
                  fontSize: 11, color: unreadCount > 0 ? theme.status.success.text : theme.textLight,
                  fontWeight: unreadCount > 0 ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {unreadCount > 0
                    ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`
                    : s.email}
                </div>
              </div>
              {unreadCount > 0 && (
                <span style={{
                  flexShrink: 0,
                  minWidth: 20, height: 20, padding: '0 6px',
                  borderRadius: 10, background: theme.status.success.main, color: theme.white,
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const chatPane = (
    <div style={{
      flex: 1, background: theme.white, border: isMobile ? 'none' : `1px solid ${theme.border}`,
      borderRadius: isMobile ? 0 : 12, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: 0, height: isMobile ? '100%' : 'auto',
    }}>

      {/* Empty state — desktop only; on mobile we simply don't render this pane until selected */}
      {!selected && !isMobile && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: theme.textMuted,
        }}>
          <MessageSquareText size={44} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textMid }}>
            Select a student to start chatting
          </div>
        </div>
      )}

      {selected && (
        <>
          {/* Chat header — back button on mobile returns to the student list */}
          <div style={{
            padding: '14px 18px', borderBottom: `1px solid ${theme.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            flexShrink: 0,
          }}>
            {isMobile && (
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none', border: 'none', fontSize: 20,
                  cursor: 'pointer', color: theme.textMid, padding: 0,
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >
                ←
              </button>
            )}
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: avatarColor(selected.name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: theme.white, flexShrink: 0,
            }}>
              {getInitials(selected.name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: theme.textDark,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selected.name}
              </div>
              <div style={{
                fontSize: 12, color: theme.textLight,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selected.email}
              </div>
            </div>
          </div>

          {/* Messages scroll area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: isMobile ? '14px 12px' : '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 2,
            background: theme.pageBg, minHeight: 0,
          }}>
            {loading && (
              <p style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 40 }}>
                Loading messages...
              </p>
            )}

            {!loading && messages.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: theme.textMuted, paddingTop: 60,
              }}>
                <Mail size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
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
                  <div style={{ flex: 1, height: 1, background: theme.border }} />
                  <span style={{
                    fontSize: 11, color: theme.textMuted, fontWeight: 600,
                    padding: '2px 10px', background: theme.white,
                    borderRadius: 20, border: `1px solid ${theme.border}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {date}
                  </span>
                  <div style={{ flex: 1, height: 1, background: theme.border }} />
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
                        maxWidth: isMobile ? '82%' : '70%',
                        // Staff (me) = green bubble, student = white bubble
                        background: mine ? theme.status.success.main : theme.white,
                        color:      mine ? theme.white : theme.textStrong,
                        border:     mine ? 'none' : `1px solid ${theme.border}`,
                        padding: '9px 14px',
                        borderRadius: mine
                          ? '18px 18px 4px 18px'
                          : '18px 18px 18px 4px',
                        fontSize: 13, lineHeight: 1.5,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}>
                        {/* message text */}
                        <div style={{
                          color: mine ? theme.white : theme.textStrong,
                          wordBreak: 'break-word',
                        }}>
                          {msg.message || msg.content || ''}
                        </div>
                        {/* timestamp */}
                        <div style={{
                          fontSize: 10, marginTop: 4,
                          color: mine ? 'rgba(255,255,255,0.75)' : theme.textMuted,
                          textAlign: 'right',
                        }}>
                          {formatTime(msg.created_at)}
                          {mine && <Check size={11} style={{ verticalAlign: '-1px', marginLeft: 3 }} />}
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
            padding: isMobile ? '10px 12px' : '12px 16px', borderTop: `1px solid ${theme.border}`,
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: theme.white, flexShrink: 0,
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
                fontSize: 13, color: theme.textStrong, outline: 'none',
                fontFamily: 'inherit', resize: 'none', lineHeight: 1.5,
                background: theme.white, maxHeight: 120, overflowY: 'auto',
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
                padding: isMobile ? '10px 14px' : '10px 18px',
                background: sending || !newMessage.trim() ? theme.border : theme.status.success.main,
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600,
                color: sending || !newMessage.trim() ? theme.textMuted : theme.white,
                cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              {sending ? 'Sending...' : isMobile ? '↑' : 'Send ↑'}
            </button>
          </div>
        </>
      )}
    </div>
  )

  // ── Mobile: full-screen list OR full-screen chat, never both ──
  if (isMobile) {
    return (
      // Pinned top+bottom instead of height:100vh — body has zoom:1.08
      // (index.css) which inflates 100vh, so a vh-sized pane overflowed the
      // screen: the input bar sat past the fold with a scrollable gap below it.
      // A fixed box anchored to the real viewport edges can't drift.
      <div style={{
        position: 'fixed', top: 64, left: 0, right: 0, bottom: 0,
        background: theme.pageBg, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}>
        {!selected ? (
          <>
            <div style={{ padding: '14px 16px 10px' }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: theme.textDark, margin: '0 0 4px' }}>
                Student Messages
              </h1>
              <p style={{ fontSize: 12, color: theme.textLight, margin: 0 }}>
                Chat with students directly
              </p>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>{studentList}</div>
          </>
        ) : (
          chatPane
        )}
      </div>
    )
  }

  // ── Desktop: side-by-side panes, unchanged ──
  return (
    <div style={{
      // /1.08 counteracts the global body zoom:1.08 (see index.css) so the
      // pane fills exactly the visible area — no overflow, no bottom gap.
      height: 'calc(100vh / 1.08 - 120px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      overflow: 'hidden',
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
        {studentList}
        {chatPane}
      </div>
    </div>
  )
}