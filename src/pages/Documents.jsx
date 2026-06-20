import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import BottomButtons from '../components/BottomButtons'

const DOC_LIST = [
  'Passport Copy',
  'Academic Transcripts',
  'Bank Balance Certificate',
  'Statement of Purpose (SOP)',
  'CV / Resume',
  'Digital Photos',
  'Medical Certificate',
  'Language Test Score (IELTS/TOPIK/JLPT)',
  'Employment Certificate / NOC',
  'Recommendation Letters',
  'Visa Application Form',
]

const initials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColor = (name) => {
  const colors = [
    '#16a34a','#2563eb','#f59e0b',
    '#db2777','#7c3aed','#0891b2'
  ]
  if (!name) return colors[0]
  return colors[name.charCodeAt(0) % colors.length]
}

const stageColor = (stage) => {
  const map = {
    'inquiring':  { bg: '#ede9fe', color: '#6d28d9' },
    'abroad':     { bg: '#dcfce7', color: '#15803d' },
    'applied':    { bg: '#dbeafe', color: '#1d4ed8' },
    'processing': { bg: '#fef9c3', color: '#a16207' },
    'rejected':   { bg: '#fee2e2', color: '#b91c1c' },
  }
  return map[stage?.toLowerCase()] || { bg: '#f3f4f6', color: '#6b7280' }
}

export default function Documents() {

  const [students,  setStudents]  = useState([])
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [docStatus, setDocStatus] = useState({})
  const [note,      setNote]      = useState('')
  const [notes,     setNotes]     = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })
    setStudents(data || [])
    setLoading(false)
  }

  const openDocs = (student) => {
    setSelected(student)
    setNotes([])
    setNote('')
    const initial = {}
    DOC_LIST.forEach(doc => { initial[doc] = 'missing' })
    setDocStatus(initial)
  }

  const toggleDoc = (doc) => {
    setDocStatus(prev => ({
      ...prev,
      [doc]: prev[doc] === 'uploaded' ? 'missing' : 'uploaded'
    }))
  }

  const uploadedCount = Object.values(docStatus)
    .filter(v => v === 'uploaded').length

  const addNote = () => {
    if (!note.trim()) return
    setNotes(prev => [...prev, {
      text: note,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      })
    }])
    setNote('')
  }

  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>

      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 700,
          color: theme.textDark,
          margin: 0,
        }}>
          Documents Checklist
        </h1>
        <p style={{
          fontSize: 13,
          color: theme.textLight,
          marginTop: 4,
        }}>
          Click a student to open their document checklist
        </p>
      </div>

      {/* table card */}
      <div style={{
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>

        {/* search */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: theme.pageBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '8px 14px',
            maxWidth: 380,
          }}>
            <span style={{ color: theme.textMuted }}></span>
            <input
              placeholder="Search students..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: theme.textMid,
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2.5fr 1.5fr 1.5fr 2fr 1.5fr',
          padding: '10px 16px',
          background: theme.pageBg,
          borderTop: `1px solid ${theme.border}`,
          borderBottom: `1px solid ${theme.border}`,
        }}>
          {['Name','Country','Stage','Documents','Action'].map(h => (
            <span key={h} style={{
              fontSize: 11,
              fontWeight: 600,
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

        {!loading && filtered.length === 0 && (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: theme.textLight,
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}></div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: theme.textMid,
            }}>
              No students found
            </div>
          </div>
        )}

        {filtered.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2.5fr 1.5fr 1.5fr 2fr 1.5fr',
              padding: '13px 16px',
              borderBottom: i < filtered.length - 1
                ? `1px solid ${theme.border}` : 'none',
              alignItems: 'center',
            }}
            onMouseEnter={e =>
              e.currentTarget.style.background = theme.pageBg}
            onMouseLeave={e =>
              e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              fontSize: 13,
              fontWeight: 500,
              color: theme.textDark,
            }}>
              {s.name || '—'}
            </div>

            <div style={{
              fontSize: 13,
              color: theme.textMid,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span style={{ fontSize: 11, color: theme.textMuted }}>
                {s.country?.slice(0, 2).toLowerCase()}
              </span>
              {s.country || '—'}
            </div>

            <div>
              <span style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                background: stageColor(s.stage).bg,
                color: stageColor(s.stage).color,
              }}>
                {s.stage || 'inquiring'}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{
                flex: 1,
                height: 6,
                background: '#e5e7eb',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${((s.docs_uploaded || 0) / DOC_LIST.length) * 100}%`,
                  background: theme.primary,
                  borderRadius: 3,
                }}/>
              </div>
              <span style={{
                fontSize: 12,
                color: theme.textLight,
                flexShrink: 0,
              }}>
                {s.docs_uploaded || 0}/{DOC_LIST.length}
              </span>
            </div>

            <button
              onClick={() => openDocs(s)}
              style={{
                padding: '6px 14px',
                background: theme.primary,
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
               Open Documents
            </button>
          </div>
        ))}
      </div>

      {/* document checklist modal */}
      {selected && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: 20,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 860,
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
          }}>

            {/* modal header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: avatarColor(selected.name),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}>
                {initials(selected.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.textDark,
                }}>
                  {selected.name}
                </div>
                <div style={{
                  display: 'flex',
                  gap: 14,
                  marginTop: 4,
                  flexWrap: 'wrap',
                }}>
                  {selected.email && (
                    <span style={{ fontSize: 12, color: theme.textLight }}>
                      ✉️ {selected.email}
                    </span>
                  )}
                  {selected.phone && (
                    <span style={{ fontSize: 12, color: theme.textLight }}>
                       {selected.phone}
                    </span>
                  )}
                  {selected.country && (
                    <span style={{ fontSize: 12, color: theme.textLight }}>
                       {selected.country}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{
                  padding: '7px 14px',
                  background: theme.pageBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: theme.textMid,
                  cursor: 'pointer',
                }}>
                   Invoices
                </button>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    cursor: 'pointer',
                    color: theme.textMid,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* stage steps */}
            <div style={{
              padding: '14px 24px',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              gap: 0,
            }}>
              {[
                { label: 'Counselor',          sub: 'Counseling Status',  icon: '', done: true  },
                { label: 'Document Uploader',  sub: 'Document Status',    icon: '', done: false },
                { label: 'Application Status', sub: 'Application Status', icon: '', done: false },
                { label: 'Visa Officer',       sub: 'Visa Status',        icon: '', done: false },
              ].map((step, i, arr) => (
                <div key={step.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: step.done ? theme.primaryLight : '#f3f4f6',
                      border: `2px solid ${step.done ? theme.primary : theme.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                    }}>
                      {step.icon}
                    </div>
                    <div>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: step.done ? theme.primaryText : theme.textMid,
                      }}>
                        {step.label}
                      </div>
                      <div style={{ fontSize: 11, color: theme.textLight }}>
                        {step.sub}
                      </div>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{
                      flex: 1,
                      height: 2,
                      background: step.done ? theme.primary : '#e5e7eb',
                      margin: '0 8px',
                    }}/>
                  )}
                </div>
              ))}
            </div>

            {/* modal body */}
            <div style={{
              display: 'flex',
              flex: 1,
              overflow: 'hidden',
            }}>

              {/* document list */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 24px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.textDark,
                  }}>
                    Documents ({uploadedCount}/{DOC_LIST.length})
                  </span>
                  <div style={{
                    width: 140,
                    height: 6,
                    background: '#e5e7eb',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${(uploadedCount / DOC_LIST.length) * 100}%`,
                      background: theme.primary,
                      borderRadius: 3,
                      transition: 'width 0.3s',
                    }}/>
                  </div>
                </div>

                {DOC_LIST.map(doc => (
                  <div key={doc} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    marginBottom: 8,
                  }}>
                    <span style={{
                      fontSize: 16,
                      color: theme.textMuted,
                      flexShrink: 0,
                    }}>
                      
                    </span>
                    <span style={{
                      flex: 1,
                      fontSize: 13,
                      color: theme.textDark,
                    }}>
                      {doc}
                    </span>
                    <button style={{
                      padding: '5px 12px',
                      background: 'none',
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: theme.textMid,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      ⬆UPLOAD
                    </button>
                    <input
                      type="checkbox"
                      checked={docStatus[doc] === 'uploaded'}
                      onChange={() => toggleDoc(doc)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <div
                      onClick={() => toggleDoc(doc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 500,
                        color: docStatus[doc] === 'uploaded'
                          ? theme.primary : '#dc2626',
                        cursor: 'pointer',
                        minWidth: 70,
                      }}
                    >
                      {docStatus[doc] === 'uploaded'
                        ? <><span></span> Done</>
                        : <><span></span> Missing</>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* notes panel */}
              <div style={{
                width: 240,
                borderLeft: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                padding: 16,
              }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: theme.textDark,
                  marginBottom: 12,
                }}>
                  Notes
                </div>
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  marginBottom: 12,
                }}>
                  {notes.length === 0 ? (
                    <p style={{
                      fontSize: 13,
                      color: theme.textMuted,
                      textAlign: 'center',
                      marginTop: 30,
                    }}>
                      No notes yet
                    </p>
                  ) : (
                    notes.map((n, i) => (
                      <div key={i} style={{
                        padding: '8px 10px',
                        background: theme.pageBg,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 8,
                        marginBottom: 8,
                        fontSize: 12,
                        color: theme.textMid,
                      }}>
                        <div>{n.text}</div>
                        <div style={{
                          fontSize: 10,
                          color: theme.textMuted,
                          marginTop: 4,
                        }}>
                          {n.time}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <textarea
                  placeholder="Add a note..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: theme.pageBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: theme.textMid,
                    outline: 'none',
                    resize: 'none',
                    marginBottom: 8,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={addNote}
                  style={{
                    width: '100%',
                    padding: 9,
                    background: theme.primary,
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  + Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomButtons onAdd={load} />
    </div>
  )
}