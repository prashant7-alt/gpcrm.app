import { useState, useEffect, useRef } from 'react'
import { MessageSquareText, Mail, Check } from 'lucide-react'
import theme from '../../theme'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'
import { useIsMobile } from '../../hooks/useIsMobile'

const avatarColor = (name) => {
  const colors = [theme.status.success.main,theme.primary,theme.purple,theme.pink,theme.status.warning.main,theme.accent]
  return colors[(name?.charCodeAt(0) || 0) % colors.length]
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Case/whitespace-tolerant compare for names & emails.
const norm = (v) => (v || '').trim().toLowerCase()
const same = (a, b) => norm(a) !== '' && norm(a) === norm(b)

// Shows the staff member's uploaded profile photo when we have one,
// otherwise falls back to coloured initials.
function StaffAvatar({ name, url, size = 36, fontSize = 13 }) {
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  if (url) {
    return (
      <img
        src={url}
        alt={name || 'Staff'}
        style={{ ...base, objectFit: 'cover', border: `1px solid ${theme.border}` }}
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
    )
  }
  return (
    <div style={{ ...base, background: avatarColor(name), color: theme.white, fontSize, fontWeight: 700 }}>
      {getInitials(name)}
    </div>
  )
}

// Color-coded role badges so students can identify who they're talking to
const roleColor = (role) => {
  if (!role) return { bg: theme.surfaceAlt, color: theme.textLight }
  const r = role.toLowerCase()
  if (r.includes('document'))  return { bg: theme.status.info.bg, color: theme.primary }
  if (r.includes('visa'))      return { bg: theme.purpleLight, color: theme.purple }
  if (r.includes('finance'))   return { bg: theme.status.success.bg, color: theme.status.success.text }
  if (r.includes('marketing')) return { bg: theme.status.warning.bg, color: theme.status.warning.text }
  if (r.includes('counsel'))   return { bg: theme.status.warning.bg, color: theme.status.warning.main }
  if (r.includes('admin'))     return { bg: theme.status.danger.bg, color: theme.status.danger.text }
  return                              { bg: theme.surfaceAlt, color: theme.textLight }
}

export default function StudentChat() {
  const isMobile = useIsMobile()

  const navigate     = useNavigate()
  const profile      = JSON.parse(localStorage.getItem('profile') || '{}')
  const bottomRef    = useRef(null)
  const selectedRef  = useRef(null)

  const [staff,       setStaff]       = useState([])
  const [selected,    setSelected]    = useState(null)
  const [messages,    setMessages]    = useState([])
  const [newMessage,  setNewMessage]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [sending,     setSending]     = useState(false)

  useEffect(() => {
    if (!profile.id) { navigate('/student-login'); return }
    loadStaff()
  }, [])

  useEffect(() => { selectedRef.current = selected }, [selected])

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
        // match by email (reliable) OR name (fallback) — case/space tolerant
        const fromMe    = same(msg.sender_email, profile.email)  || same(msg.sender_name, profile.name)
        const fromThem  = same(msg.sender_email, selected.email) || same(msg.sender_name, selected.name)
        const toMe      = same(msg.receiver_email, profile.email)  || same(msg.receiver_name, profile.name)
        const toThem    = same(msg.receiver_email, selected.email) || same(msg.receiver_name, selected.name)

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

  // Fallback polling — realtime may not be enabled on the messages table, so
  // also refetch the open conversation every few seconds. This is what makes
  // a staff reply appear without the student refreshing the page.
  useEffect(() => {
    if (!selected) return
    const id = setInterval(() => {
      if (selectedRef.current) loadMessages(selectedRef.current, { silent: true })
    }, 8000)
    return () => clearInterval(id)
  }, [selected])

  // Build the staff list from `profiles` (the login-tied table) so the name +
  // email we address a message to EXACTLY match what that staff member's app
  // stores as their identity — otherwise their inbox never matches the
  // message and no notification shows. The `staff` table is only used to
  // enrich each person with a nicer role label / phone / photo.
  async function loadStaff() {
    const [{ data: profs }, { data: staffRows }] = await Promise.all([
      supabase.from('profiles').select('id, name, email, role, avatar_url').neq('role', 'student'),
      supabase.from('staff').select('name, email, role, phone, avatar_url'),
    ])

    const staffByEmail = {}
    ;(staffRows || []).forEach(s => {
      const k = (s.email || '').trim().toLowerCase()
      if (k) staffByEmail[k] = s
    })

    const prettyRole = (r) => (r || 'Staff').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    // Only surface people still on the admin-managed `staff` roster. A former
    // staff member whose `staff` row was removed must not remain messageable
    // here just because their `profiles` row lingers. Admins are kept even
    // without a `staff` row since they can be seeded directly.
    const isActiveStaff = (p) =>
      !!staffByEmail[(p.email || '').trim().toLowerCase()] ||
      ['admin', 'superadmin'].includes((p.role || '').toLowerCase())

    const list = (profs || []).filter(isActiveStaff).map(p => {
      const s = staffByEmail[(p.email || '').trim().toLowerCase()] || {}
      return {
        id:         p.id,
        name:       p.name  || s.name  || '—',   // ← canonical login identity
        email:      p.email || s.email || '',    // ← canonical login identity
        role:       s.role || prettyRole(p.role),
        phone:      s.phone || null,
        avatar_url: p.avatar_url || s.avatar_url || null,
      }
    })

    // Include any staff-table people who never got a profiles row (rare).
    ;(staffRows || []).forEach(s => {
      const k = (s.email || '').trim().toLowerCase()
      if (k && !list.some(x => (x.email || '').trim().toLowerCase() === k)) {
        list.push({ id: 'staff-' + k, name: s.name, email: s.email, role: s.role, phone: s.phone, avatar_url: s.avatar_url })
      }
    })

    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setStaff(list)
  }

  async function loadMessages(who = selected, { silent = false } = {}) {
    if (!who) return
    if (!silent) setLoading(true)

    // Query by BOTH email AND name to catch all message combinations.
    // Old messages may only have name; new messages should have both.
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_email.eq.${profile.email},receiver_email.eq.${who.email}),` +
        `and(sender_email.eq.${who.email},receiver_email.eq.${profile.email}),` +
        `and(sender_name.eq.${profile.name},receiver_name.eq.${who.name}),` +
        `and(sender_name.eq.${who.name},receiver_name.eq.${profile.name})`
      )
      .order('created_at', { ascending: true })

    // Deduplicate — the broad OR can return the same row multiple times
    const seen   = new Set()
    const deduped = (data || []).filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    // Skip the state update when nothing changed, so a background poll
    // doesn't re-render / jump the scroll while the student is reading.
    setMessages(prev => {
      const changed = prev.length !== deduped.length ||
        prev[prev.length - 1]?.id !== deduped[deduped.length - 1]?.id
      return changed ? deduped : prev
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
    same(msg.sender_email, profile.email) ||
    same(msg.sender_name,  profile.name)

  // ── Shared sub-renders (used by both desktop pane and mobile full-screen) ──

  const staffList = (
    <div style={{
      width: isMobile ? '100%' : 240, flexShrink: 0,
      background: theme.white, border: `1px solid ${theme.border}`,
      borderRadius: isMobile ? 0 : 12, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      height: isMobile ? '100%' : 'auto',
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${theme.border}`,
        fontSize: 11, fontWeight: 700, color: theme.textLight,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        flexShrink: 0,
      }}>
        Staff Members
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px' }}>
        {staff.length === 0 && (
          <p style={{ fontSize: 12, color: theme.textMuted, padding: '12px 8px', textAlign: 'center' }}>
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
                background: isSelected && !isMobile ? theme.purpleLight : 'transparent',
                borderLeft: isSelected && !isMobile ? `3px solid ${theme.purple}` : '3px solid transparent',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = theme.pageBg }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Avatar */}
              <StaffAvatar name={s.name} url={s.avatar_url} size={36} fontSize={13} />

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: isSelected && !isMobile ? 600 : 500,
                  color: isSelected && !isMobile ? theme.purple : theme.textStrong,
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
  )

  const chatPane = (
    <div style={{
      flex: 1, background: theme.white, border: isMobile ? 'none' : `1px solid ${theme.border}`,
      borderRadius: isMobile ? 0 : 12, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: 0, height: isMobile ? '100%' : 'auto',
    }}>

      {/* Empty state — desktop only */}
      {!selected && !isMobile && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: theme.textMuted,
        }}>
          <MessageSquareText size={44} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textLight }}>
            Select a staff member to start chatting
          </div>
        </div>
      )}

      {selected && (
        <>
          {/* Chat header — back button on mobile returns to the staff list */}
          <div style={{
            padding: '14px 18px', borderBottom: `1px solid ${theme.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            background: theme.pageBg, flexShrink: 0,
          }}>
            {isMobile && (
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'none', border: 'none', fontSize: 20,
                  cursor: 'pointer', color: theme.textLight, padding: 0,
                  display: 'flex', alignItems: 'center', flexShrink: 0,
                }}
              >
                ←
              </button>
            )}
            <StaffAvatar name={selected.name} url={selected.avatar_url} size={38} fontSize={14} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: theme.textStrong,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
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
            padding: isMobile ? '14px 12px' : '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 4,
            background: theme.pageBg,
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
                        // Student (me) = purple bubble, staff = light gray bubble
                        background: mine ? theme.purple : theme.white,
                        color:      mine ? theme.white : theme.textStrong,
                        border:     mine ? 'none'   : `1px solid ${theme.border}`,
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
                          color: mine ? theme.white : theme.textStrong,
                          wordBreak: 'break-word',
                        }}>
                          {msg.message || msg.content || ''}
                        </div>
                        {/* Timestamp */}
                        <div style={{
                          fontSize: 10, marginTop: 4,
                          color: mine ? 'rgba(255,255,255,0.7)' : theme.textMuted,
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

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: isMobile ? '10px 12px' : '12px 16px', borderTop: `1px solid ${theme.border}`,
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: theme.white, flexShrink: 0,
          }}>
            <textarea
              placeholder={`Message ${selected.name}...`}
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
                // auto-grow textarea up to 120px
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !newMessage.trim()}
              style={{
                padding: isMobile ? '10px 14px' : '10px 18px',
                background: sending || !newMessage.trim() ? theme.border : theme.purple,
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
      <StudentLayout>
        <div style={{
          height: 'calc(100vh - 140px)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Segoe UI', Arial, sans-serif",
          margin: '-12px',
        }}>
          {!selected ? (
            <>
              <div style={{ padding: '14px 16px 10px' }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: theme.textStrong, margin: '0 0 4px' }}>
                  Chat with Staff
                </h1>
                <p style={{ fontSize: 12, color: theme.textLight, margin: 0 }}>
                  Send messages directly to your counselor or document handler
                </p>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>{staffList}</div>
            </>
          ) : (
            chatPane
          )}
        </div>
      </StudentLayout>
    )
  }

  // ── Desktop: side-by-side panes, unchanged ──
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.textStrong, margin: '0 0 4px' }}>
            Chat with Staff
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, margin: 0 }}>
            Send messages directly to your counselor or document handler
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {staffList}
          {chatPane}
        </div>
      </div>
    </StudentLayout>
  )
}