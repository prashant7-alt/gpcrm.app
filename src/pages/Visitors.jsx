import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const statusStyle = (status) => {
  if (status === 'Converted') return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'Follow-up') return { bg: '#fef9c3', color: '#a16207' }
  if (status === 'Cold')      return { bg: '#f3f4f6', color: '#6b7280' }
  return { bg: '#dbeafe', color: '#1d4ed8' }
}

export default function Visitors() {

  const [visitors,  setVisitors]  = useState([])
  const [search,    setSearch]    = useState('')
  const [purpose,   setPurpose]   = useState('All Purposes')
  const [interest,  setInterest]  = useState('All Interest')
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)

  // form fields for new visitor
  const [form, setForm] = useState({
    name:     '',
    phone:    '',
    purpose:  '',
    interest: '',
    country:  '',
    status:   'New',
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('visitors')
      .select('*')
      .order('created_at', { ascending: false })
    setVisitors(data || [])
    setLoading(false)
  }

  // update one form field
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // save new visitor to supabase
  async function saveVisitor() {
    if (!form.name) return alert('Please enter visitor name')

    const { error } = await supabase
      .from('visitors')
      .insert({
        name:     form.name,
        phone:    form.phone,
        purpose:  form.purpose,
        interest: form.interest,
        country:  form.country,
        status:   form.status,
      })

    if (error) {
      alert('Error: ' + error.message)
      return
    }

    // reset form and close modal
    setForm({
      name: '', phone: '', purpose: '',
      interest: '', country: '', status: 'New',
    })
    setShowModal(false)
    load() // refresh list
  }

  const todayStr = new Date().toDateString()

  const todayCount = visitors.filter(v =>
    new Date(v.created_at).toDateString() === todayStr
  ).length

  const thisWeek = visitors.filter(v => {
    const diff = (new Date() - new Date(v.created_at))
      / (1000 * 60 * 60 * 24)
    return diff <= 7
  }).length

  const thisMonth = visitors.filter(v => {
    const d = new Date(v.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
  }).length

  const followUps = visitors.filter(v =>
    v.status === 'Follow-up'
  ).length

  const stats = [
    { label: 'Today',      value: todayCount, icon: '', iconBg: '#dcfce709', color: 'black', },
    { label: 'This Week',  value: thisWeek,   icon: '', iconBg: '#dbeafe00', color: 'black', },
    { label: 'This Month', value: thisMonth,  icon: '', iconBg: '#fef9c300', color: 'black',},
    { label: 'Follow-ups', value: followUps,  icon: '', iconBg: '#fee2e200', color: 'black' },
  ]

  const filtered = visitors.filter(v => {
    const matchSearch   = v.name?.toLowerCase().includes(search.toLowerCase())
    const matchPurpose  = purpose  === 'All Purposes' || v.purpose  === purpose
    const matchInterest = interest === 'All Interest'  || v.interest === interest
    return matchSearch && matchPurpose && matchInterest
  })

  return (
    <div>

      {/* header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            fontSize: 20, fontWeight: 700,
            color: theme.textDark, margin: 0,
          }}>
            Visitor Log
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>
            Walk-in visitor tracking
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{
            padding: '8px 16px',
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8, fontSize: 13,
            color: theme.textMid, cursor: 'pointer',
          }}>
            📤 Export
          </button>

          {/* this button now opens the modal */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '8px 16px',
              background: theme.primary,
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: '#fff', cursor: 'pointer',
            }}
          >
            + Log Visitor
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14, marginBottom: 20,
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderTop: `3px solid ${s.top}`,
            borderRadius: 10, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: s.iconBg,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{
                fontSize: 28, fontWeight: 800,
                color: s.color, lineHeight: 1,
              }}>
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* table card */}
      <div style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 10, overflow: 'hidden',
      }}>

        {/* search */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: theme.pageBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '8px 14px', maxWidth: 380,
          }}>
            <span style={{ color: theme.textMuted }}>🔍</span>
            <input
              placeholder="Search visitors..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'none', border: 'none',
                outline: 'none', fontSize: 13,
                color: theme.textMid, width: '100%',
              }}
            />
          </div>
        </div>

        {/* purpose filter */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${theme.border}` }}>
          <select
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            style={{
              width: '100%', background: 'none',
              border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, cursor: 'pointer',
            }}
          >
            <option>All Purposes</option>
            <option>Study Abroad</option>
            <option>Visa Inquiry</option>
            <option>Document Help</option>
            <option>General Info</option>
          </select>
        </div>

        {/* interest filter */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${theme.border}` }}>
          <select
            value={interest}
            onChange={e => setInterest(e.target.value)}
            style={{
              width: '100%', background: 'none',
              border: 'none', outline: 'none',
              fontSize: 13, color: theme.textMid, cursor: 'pointer',
            }}
          >
            <option>All Interest</option>
            <option>UK</option>
            <option>Australia</option>
            <option>Canada</option>
            <option>USA</option>
            <option>Japan</option>
            <option>Korea</option>
          </select>
        </div>

        {/* table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '36px 2fr 1.5fr 1.5fr 1.5fr 1.5fr 1fr 1fr 1fr',
          padding: '10px 16px',
          background: theme.pageBg,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          <input type="checkbox" style={{ cursor: 'pointer' }}/>
          {['Visitor','Phone','Purpose','Interest',
            'Country','Date','Status','Actions'].map(h => (
            <span key={h} style={{
              fontSize: 11, fontWeight: 600,
              color: theme.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {loading && (
          <p style={{ padding: 20, color: theme.textLight, fontSize: 13 }}>
            Loading...
          </p>
        )}

        {/* empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 60, textAlign: 'center',
            color: theme.textLight,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>
              👥
            </div>
            <div style={{
              fontSize: 15, fontWeight: 600,
              color: theme.textMid, marginBottom: 6,
            }}>
              No visitors logged
            </div>
            <div style={{ fontSize: 13 }}>
              Click <strong>+ Log Visitor</strong> to add one
            </div>
          </div>
        )}

        {/* visitor rows */}
        {filtered.map((v, i) => (
          <div
            key={v.id}
            style={{
              display: 'grid',
              gridTemplateColumns:
                '36px 2fr 1.5fr 1.5fr 1.5fr 1.5fr 1fr 1fr 1fr',
              padding: '12px 16px',
              borderBottom: i < filtered.length - 1
                ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
            }}
            onMouseEnter={e =>
              e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e =>
              e.currentTarget.style.background = 'transparent'}
          >
            <input type="checkbox" style={{ cursor: 'pointer' }}/>
            <div style={{ fontSize: 13, fontWeight: 500, color: theme.textDark }}>
              {v.name || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {v.phone || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {v.purpose || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {v.interest || '—'}
            </div>
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {v.country || '—'}
            </div>
            <div style={{ fontSize: 12, color: theme.textLight }}>
              {v.created_at
                ? new Date(v.created_at).toLocaleDateString()
                : '—'}
            </div>
            <div>
              <span style={{
                padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                background: statusStyle(v.status).bg,
                color: statusStyle(v.status).color,
              }}>
                {v.status || 'New'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{
                padding: '5px 10px',
                background: theme.primaryLight,
                border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                color: theme.primaryText, cursor: 'pointer',
              }}>
                View
              </button>
              <button style={{
                padding: '5px 10px',
                background: theme.pageBg,
                border: `1px solid ${theme.border}`,
                borderRadius: 6, fontSize: 12,
                color: theme.textMid, cursor: 'pointer',
              }}>
                ✏️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* log visitor modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: '#fff',
            border: `1px solid ${theme.border}`,
            borderRadius: 14, padding: 28, width: 440,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>

            {/* modal header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20,
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700,
                color: theme.textDark, margin: 0,
              }}>
                Log New Visitor
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 18, cursor: 'pointer',
                  color: theme.textLight,
                }}
              >
                ✕
              </button>
            </div>

            {/* form fields */}
            {[
              { label: 'Full Name *', key: 'name',    placeholder: 'Ram Sharma' },
              { label: 'Phone',       key: 'phone',   placeholder: '98XXXXXXXX' },
              { label: 'Country',     key: 'country', placeholder: 'Nepal, India...' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', fontSize: 11,
                  fontWeight: 600, color: theme.textLight,
                  textTransform: 'uppercase', marginBottom: 5,
                }}>
                  {f.label}
                </label>
                <input
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8, fontSize: 13,
                    color: theme.textMid, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}

            {/* purpose select */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                Purpose
              </label>
              <select
                value={form.purpose}
                onChange={e => set('purpose', e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">Select purpose...</option>
                <option>Study Abroad</option>
                <option>Visa Inquiry</option>
                <option>Document Help</option>
                <option>General Info</option>
              </select>
            </div>

            {/* interest select */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                Interested In
              </label>
              <select
                value={form.interest}
                onChange={e => set('interest', e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">Select country...</option>
                <option>UK</option>
                <option>Australia</option>
                <option>Canada</option>
                <option>USA</option>
                <option>Japan</option>
                <option>Korea</option>
              </select>
            </div>

            {/* status select */}
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 11,
                fontWeight: 600, color: theme.textLight,
                textTransform: 'uppercase', marginBottom: 5,
              }}>
                Status
              </label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <option>New</option>
                <option>Follow-up</option>
                <option>Converted</option>
                <option>Cold</option>
              </select>
            </div>

            {/* buttons */}
            <div style={{
              display: 'flex', gap: 10,
              justifyContent: 'flex-end', marginTop: 20,
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '9px 18px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8, fontSize: 13,
                  color: theme.textMid, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveVisitor}
                style={{
                  padding: '9px 18px',
                  background: theme.primary,
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                Save Visitor
              </button>
            </div>

          </div>
        </div>
      )}

      <BottomButtons onAdd={load} />
    </div>
  )
}