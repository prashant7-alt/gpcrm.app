import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import theme from '../theme'
import { advanceApplicantStage } from '../lib/pipelineStages'
import { useIsMobile } from '../hooks/useIsMobile'

// ─── ALL 12 DOCUMENT TYPES ────────────────────────────────────────────────────
// MUST match StudentDocumentUpload.jsx exactly — same order, same spelling
const DOC_TYPES = [
  'Passport (copy + original scan)',
  'National ID / Citizenship Certificate',
  'SLC/SEE Marksheet & Certificate',
  '+2 / A-Level Marksheet & Certificate',
  "Bachelor's Degree Transcripts & Certificate",
  'Character Certificate',
  'Migration Certificate',
  'English Language Test (IELTS, TOEFL, PTE, Duolingo)',
  'Statement of Purpose (SOP)',
  'Letters of Recommendation (LOR)',
  'Financial Documents (Bank Statement, Bank Balance Certificate)',
  'Medical Examination Report',
]

const STATUS_OPTIONS  = ['Missing', 'Received', 'Verified']
const STATUS_PRIORITY = { 'Verified': 2, 'Received': 1, 'Missing': 0 }

function bestDoc(rows, type) {
  return rows
    .filter(d => d.doc_type === type)
    .sort((a, b) => (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0))[0]
}

const statusStyle = (status) => {
  if (status === 'Verified') return { bg: '#dcfce7', color: '#15803d' }
  if (status === 'Received') return { bg: '#dbeafe', color: '#1d4ed8' }
  return                            { bg: '#fee2e2', color: '#b91c1c' }
}

const inputStyle = {
  width: '100%', padding: '8px 11px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: 13, color: '#111827', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase', marginBottom: 5,
}

// ── Reusable file link + delete button (admin side) ───────────────────────────
function FileLink({ doc, onDeleted }) {
  if (!doc.file_url) return null

  async function handleDelete() {
    if (!window.confirm('Delete this file?')) return
    const path = doc.file_url.split('/student-docs/')[1]
    if (path) {
      await supabase.storage.from('student-docs').remove([decodeURIComponent(path)])
    }
    await supabase
      .from('student_documents')
      .update({ file_url: '', status: 'Missing', updated_at: new Date().toISOString() })
      .eq('id', doc.id)
    if (onDeleted) onDeleted()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
      <a
        href={doc.file_url}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 11, color: '#1a56db' }}
      >
        📎 View file
      </a>
      <button
        onClick={handleDelete}
        style={{
          background: 'none', border: 'none',
          fontSize: 11, color: '#dc2626',
          cursor: 'pointer', padding: 0,
        }}
      >
        🗑️ Delete
      </button>
    </div>
  )
}

export default function Documents() {
  const isMobile = useIsMobile()

  const [view, setView] = useState('student')

  const [docs,      setDocs]      = useState([])
  const [applicants, setApplicants] = useState([])   // full applicants table: {id, name, email}
  const [loading,   setLoading]   = useState(true)

  // selectedApplicantId replaces the old selectedStudent (name) key
  const [selectedApplicantId, setSelectedApplicantId] = useState(null)
  const [studentSearch,       setStudentSearch]       = useState('')

  const [tableSearch, setTableSearch] = useState('')
  const [tableFilter, setTableFilter] = useState('All')

  const [showAddStudent,     setShowAddStudent]     = useState(false)
  const [addApplicantId,     setAddApplicantId]     = useState('')  // dropdown selection
  const [adding,             setAdding]             = useState(false)

  const [editDoc,    setEditDoc]    = useState(null)
  const [editStatus, setEditStatus] = useState('')
  const [editNote,   setEditNote]   = useState('')
  const [editFile,   setEditFile]   = useState(null)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const [{ data: docRows }, { data: applicantRows }] = await Promise.all([
      supabase.from('student_documents').select('*'),
      supabase.from('applicants').select('id, name, email').order('name', { ascending: true }),
    ])

    const rows = docRows || []
    setDocs(rows)
    setApplicants(applicantRows || [])

    // Unique list of applicant_ids that currently have document rows
    const idsWithDocs = [...new Set(rows.map(r => r.applicant_id).filter(Boolean))]

    if (idsWithDocs.length > 0 && !selectedApplicantId) {
      setSelectedApplicantId(idsWithDocs[0])
    }
    setLoading(false)
  }

  // Applicants who don't have a document list yet — shown in the "add" dropdown
  const applicantIdsWithDocs = new Set(docs.map(d => d.applicant_id).filter(Boolean))
  const applicantsWithoutDocs = applicants.filter(a => !applicantIdsWithDocs.has(a.id))

  async function addStudentDocs() {
    if (!addApplicantId) return alert('Select an applicant first')

    // Compare as strings — <select> values are always strings, but
    // applicant.id may be a UUID string OR a numeric id depending on the
    // schema, so a strict === can silently fail on type mismatch.
    const applicant = applicants.find(a => String(a.id) === String(addApplicantId))
    if (!applicant) return alert('Selected applicant not found — try reloading the page')

    // Structurally impossible to duplicate now: keyed on applicant_id, not name
    const exists = docs.some(d => String(d.applicant_id) === String(applicant.id))
    if (exists) return alert('Documents for this applicant already exist.')

    setAdding(true)
    const rows = DOC_TYPES.map(type => ({
      applicant_id:  applicant.id,
      student_name:  applicant.name,
      student_email: (applicant.email || '').trim().toLowerCase(),
      doc_type:      type,
      status:        'Missing',
      note:          '',
      file_url:      '',
    }))

    const { error } = await supabase.from('student_documents').insert(rows)
    if (error) {
      alert('Failed to create documents: ' + error.message)
      setAdding(false)
      return
    }

    setAdding(false)
    setShowAddStudent(false)
    setAddApplicantId('')
    await load()
    setSelectedApplicantId(applicant.id)
  }

  function openEdit(doc) {
    setEditDoc(doc)
    setEditStatus(doc.status)
    setEditNote(doc.note || '')
    setEditFile(null)
  }

  async function saveEdit() {
    if (!editDoc) return
    setSaving(true)

    let file_url = editDoc.file_url || ''

    if (editFile) {
      const ext  = editFile.name.split('.').pop()
      const path = `${editDoc.applicant_id}/${editDoc.doc_type}-${Date.now()}.${ext}`
        .replace(/\s+/g, '_')

      const { error: uploadError } = await supabase.storage
        .from('student-docs')
        .upload(path, editFile, { upsert: true })

      if (uploadError) {
        alert('File upload failed: ' + uploadError.message)
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('student-docs')
        .getPublicUrl(path)
      file_url = urlData.publicUrl
    }

    await supabase
      .from('student_documents')
      .update({
        status:     editStatus,
        note:       editNote,
        file_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editDoc.id)

    const applicantId  = editDoc.applicant_id
    const studentName  = editDoc.student_name
    const studentEmail = editDoc.student_email

    setSaving(false)
    setEditDoc(null)
    await load()

    // Auto-advance applicant to "Documentation" stage once ALL docs are
    // specifically Verified (not just uploaded/Received) by staff.
    const { data: freshRows } = await supabase
      .from('student_documents')
      .select('doc_type, status')
      .eq('applicant_id', applicantId)

    const allVerified = DOC_TYPES.every(type => {
      const doc = bestDoc(freshRows || [], type)
      return doc && doc.status === 'Verified'
    })

    if (allVerified) {
      await advanceApplicantStage(
        supabase,
        { email: studentEmail, name: studentName },
        'Documentation'
      )
    }
  }

  // ── Derived data for the per-student view ─────────────────────────────────
  const studentDocs      = selectedApplicantId
    ? docs.filter(d => d.applicant_id === selectedApplicantId)
    : []
  const deduplicatedDocs = DOC_TYPES.map(type => bestDoc(studentDocs, type)).filter(Boolean)
  const verifiedCount    = deduplicatedDocs.filter(d => d.status === 'Verified').length
  const receivedCount    = deduplicatedDocs.filter(d => d.status === 'Received').length
  const missingCount     = deduplicatedDocs.filter(d => d.status === 'Missing').length
  const completePct      = deduplicatedDocs.length
    ? Math.round((verifiedCount / deduplicatedDocs.length) * 100) : 0

  const selectedApplicant = applicants.find(a => a.id === selectedApplicantId)

  // ── Sidebar list — one entry per applicant_id that has document rows ──────
  const sidebarStudents = [...new Set(docs.map(d => d.applicant_id).filter(Boolean))]
    .map(id => {
      const applicant = applicants.find(a => a.id === id)
      const rows      = docs.filter(d => d.applicant_id === id)
      const unique    = DOC_TYPES.map(type => bestDoc(rows, type)).filter(Boolean)
      const verified  = unique.filter(d => d.status === 'Verified').length
      const total     = unique.length
      return {
        id,
        name:  applicant?.name  || rows[0]?.student_name  || 'Unknown',
        email: applicant?.email || rows[0]?.student_email || '',
        verified,
        total,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const filteredStudents = sidebarStudents.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  )

  // ── Derived data for the all-documents view ───────────────────────────────
  const filteredAll = docs.filter(d => {
    const matchSearch =
      d.student_name?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      d.doc_type?.toLowerCase().includes(tableSearch.toLowerCase())
    const matchFilter = tableFilter === 'All' || d.status === tableFilter
    return matchSearch && matchFilter
  })

  const deduplicatedAll = (() => {
    const seen = {}
    filteredAll.forEach(d => {
      // Group by applicant_id when present, falling back to name for any
      // legacy rows that predate the applicant_id column.
      const key = `${d.applicant_id || d.student_name}__${d.doc_type}`
      if (!seen[key] || (STATUS_PRIORITY[d.status] || 0) > (STATUS_PRIORITY[seen[key].status] || 0)) {
        seen[key] = d
      }
    })
    return Object.values(seen).sort((a, b) =>
      a.student_name.localeCompare(b.student_name) ||
      DOC_TYPES.indexOf(a.doc_type) - DOC_TYPES.indexOf(b.doc_type)
    )
  })()

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* ── PAGE HEADER ───────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: isMobile ? 12 : 0,
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textDark || '#111827', margin: 0 }}>
            Student Documents
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight || '#6b7280', marginTop: 4 }}>
            Track and manage visa application documents for each student ({DOC_TYPES.length} types)
          </p>
        </div>
        <button
          onClick={() => setShowAddStudent(true)}
          style={{
            padding: '9px 18px', background: theme.primary || '#1a56db',
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          + Add Student Documents
        </button>
      </div>

      {/* ── VIEW TOGGLE ───────────────────────────────────── */}
      <div style={{
        display: 'flex', marginBottom: 20,
        background: '#f3f4f6', borderRadius: 10, padding: 4,
        width: isMobile ? '100%' : 'fit-content',
      }}>
        {[
          { key: 'student', label: '👤 Per Student' },
          { key: 'all',     label: '📋 All Documents' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)} style={{
            padding: '8px 22px', border: 'none', borderRadius: 7,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            flex: isMobile ? 1 : 'none',
            background: view === tab.key ? '#fff' : 'transparent',
            color:      view === tab.key ? (theme.primary || '#1a56db') : '#6b7280',
            boxShadow:  view === tab.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading documents...</p>}

      {/* ════════════════════════════════════════════════════
          VIEW 1 — PER STUDENT
          ════════════════════════════════════════════════════ */}
      {!loading && view === 'student' && (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16, alignItems: 'flex-start',
        }}>

          {/* Student sidebar — full width, capped height on phone instead of a fixed side column */}
          <div style={{
            width: isMobile ? '100%' : 220, flexShrink: 0,
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 12, overflow: 'hidden',
            boxSizing: 'border-box',
          }}>
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid #e5e7eb',
              fontSize: 12, fontWeight: 700, color: '#6b7280',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Students ({sidebarStudents.length})
            </div>

            <div style={{ padding: '10px 10px 6px' }}>
              <input
                placeholder="Search student..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }}
              />
            </div>

            <div style={{
              maxHeight: isMobile ? 220 : 520,
              overflowY: 'auto', padding: '4px 8px 10px',
            }}>
              {filteredStudents.length === 0 && (
                <div style={{ padding: '20px 8px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  No students found
                </div>
              )}
              {filteredStudents.map(s => {
                const isSelected = selectedApplicantId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedApplicantId(s.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 10px',
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', marginBottom: 2,
                      background: isSelected ? (theme.primaryLight || '#eff6ff') : 'transparent',
                      color: isSelected ? (theme.primaryText || '#1a56db') : '#374151',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <div style={{ fontSize: 13 }}>{s.name}</div>
                    {/* Email shown so same-name students are distinguishable */}
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{s.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{
                        flex: 1, height: 4, background: '#e5e7eb',
                        borderRadius: 99, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${s.total ? Math.round((s.verified / s.total) * 100) : 0}%`,
                          height: '100%', background: '#16a34a', borderRadius: 99,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{s.verified}/{s.total}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ flex: 1, width: isMobile ? '100%' : 'auto', minWidth: 0 }}>
            {!selectedApplicantId ? (
              <div style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                padding: 60, textAlign: 'center', color: '#9ca3af',
              }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  Select a student from the list to view their documents
                </div>
              </div>
            ) : (
              <>
                {/* Student summary header */}
                <div style={{
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: 12, padding: isMobile ? '14px 16px' : '16px 20px', marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                      {selectedApplicant?.name || studentDocs[0]?.student_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {selectedApplicant?.email || studentDocs[0]?.student_email || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Verified', count: verifiedCount, ...statusStyle('Verified') },
                      { label: 'Received', count: receivedCount, ...statusStyle('Received') },
                      { label: 'Missing',  count: missingCount,  ...statusStyle('Missing')  },
                    ].map(s => (
                      <span key={s.label} style={{
                        padding: '4px 12px', borderRadius: 20,
                        fontSize: 12, fontWeight: 600,
                        background: s.bg, color: s.color,
                      }}>
                        {s.count} {s.label}
                      </span>
                    ))}
                    <span style={{
                      padding: '4px 12px', borderRadius: 20,
                      fontSize: 12, fontWeight: 700,
                      background: '#f3f4f6', color: '#374151',
                    }}>
                      {completePct}% complete
                    </span>
                  </div>
                </div>

                {/* Document checklist — table on desktop, cards on phone */}
                <div style={{
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  {!isMobile && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: '3fr 1fr 2fr 1.5fr',
                      padding: '10px 18px',
                      background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                    }}>
                      {['Document', 'Status', 'Note', 'Actions'].map(h => (
                        <span key={h} style={{
                          fontSize: 11, fontWeight: 600, color: '#9ca3af',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</span>
                      ))}
                    </div>
                  )}

                  {deduplicatedDocs.length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                      No documents found for this student.
                    </div>
                  )}

                  {/* One row/card per doc type */}
                  {DOC_TYPES.map((type, i) => {
                    const doc = bestDoc(studentDocs, type)

                    if (!doc) {
                      return isMobile ? (
                        <div key={type} style={{
                          padding: '12px 16px', opacity: 0.45,
                          borderBottom: i < DOC_TYPES.length - 1 ? '1px solid #f3f4f6' : 'none',
                        }}>
                          <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>📋 {type}</div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11,
                            fontWeight: 600, display: 'inline-block',
                            background: '#f3f4f6', color: '#9ca3af',
                          }}>Not set up</span>
                        </div>
                      ) : (
                        <div key={type} style={{
                          display: 'grid', gridTemplateColumns: '3fr 1fr 2fr 1.5fr',
                          padding: '14px 18px', alignItems: 'center',
                          borderBottom: i < DOC_TYPES.length - 1 ? '1px solid #f3f4f6' : 'none',
                          opacity: 0.45,
                        }}>
                          <div style={{ fontSize: 13, color: '#374151' }}>📋 {type}</div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11,
                            fontWeight: 600, display: 'inline-block',
                            background: '#f3f4f6', color: '#9ca3af',
                          }}>Not set up</span>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>Run SQL to add</div>
                          <div />
                        </div>
                      )
                    }

                    return isMobile ? (
                      // ── Mobile card ──
                      <div
                        key={type}
                        style={{
                          padding: '14px 16px',
                          borderBottom: i < DOC_TYPES.length - 1 ? '1px solid #f3f4f6' : 'none',
                          background: doc.status === 'Verified' ? '#f0fdf4' : 'transparent',
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
                            <span>{doc.status === 'Verified' ? '✅' : doc.status === 'Received' ? '📄' : '📋'}</span>
                            <span>{type}</span>
                          </div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20,
                            fontSize: 11, fontWeight: 600, flexShrink: 0,
                            background: statusStyle(doc.status).bg,
                            color:      statusStyle(doc.status).color,
                          }}>
                            {doc.status}
                          </span>
                        </div>

                        <FileLink doc={doc} onDeleted={load} />

                        {doc.note && (
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>{doc.note}</div>
                        )}

                        <button
                          onClick={() => openEdit(doc)}
                          style={{
                            alignSelf: 'flex-start',
                            padding: '6px 14px',
                            background: '#f3f4f6', border: '1px solid #e5e7eb',
                            borderRadius: 6, fontSize: 12, fontWeight: 600,
                            color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    ) : (
                      // ── Desktop row ──
                      <div
                        key={type}
                        style={{
                          display: 'grid', gridTemplateColumns: '3fr 1fr 2fr 1.5fr',
                          padding: '14px 18px', alignItems: 'center',
                          borderBottom: i < DOC_TYPES.length - 1 ? '1px solid #f3f4f6' : 'none',
                          background: doc.status === 'Verified' ? '#f0fdf4' : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (doc.status !== 'Verified') e.currentTarget.style.background = '#f9fafb'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = doc.status === 'Verified' ? '#f0fdf4' : 'transparent'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>
                              {doc.status === 'Verified' ? '✅'
                                : doc.status === 'Received' ? '📄' : '📋'}
                            </span>
                            {type}
                          </div>
                          <FileLink doc={doc} onDeleted={load} />
                        </div>

                        <span style={{
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: 11, fontWeight: 600, display: 'inline-block',
                          background: statusStyle(doc.status).bg,
                          color:      statusStyle(doc.status).color,
                        }}>
                          {doc.status}
                        </span>

                        <div style={{
                          fontSize: 12, color: '#9ca3af',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {doc.note || '—'}
                        </div>

                        <button
                          onClick={() => openEdit(doc)}
                          style={{
                            padding: '5px 14px',
                            background: '#f3f4f6', border: '1px solid #e5e7eb',
                            borderRadius: 6, fontSize: 12, fontWeight: 600,
                            color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          VIEW 2 — ALL DOCUMENTS TABLE
          ════════════════════════════════════════════════════ */}
      {!loading && view === 'all' && (
        <div>
          {/* Search + filter */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10, marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 8, padding: '8px 14px', flex: 1,
            }}>
              <span style={{ color: '#9ca3af' }}>🔍</span>
              <input
                placeholder="Search by student name or document type..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  fontSize: 13, color: '#374151', width: '100%', fontFamily: 'inherit',
                }}
              />
            </div>
            <select
              value={tableFilter}
              onChange={e => setTableFilter(e.target.value)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '8px 14px',
                fontSize: 13, color: '#374151', outline: 'none', cursor: 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              <option>All</option>
              <option>Missing</option>
              <option>Received</option>
              <option>Verified</option>
            </select>
          </div>

          <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 2.5fr 1fr 2fr 1.2fr',
                padding: '10px 18px',
                background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
              }}>
                {['Student', 'Document', 'Status', 'Note', 'Actions'].map(h => (
                  <span key={h} style={{
                    fontSize: 11, fontWeight: 600, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</span>
                ))}
              </div>
            )}

            {deduplicatedAll.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>No documents found</div>
              </div>
            )}

            {deduplicatedAll.map((doc, i) => (
              isMobile ? (
                // ── Mobile card ──
                <div key={doc.id} style={{
                  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
                  borderBottom: i < deduplicatedAll.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: doc.status === 'Verified' ? '#f0fdf4' : 'transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{doc.student_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{doc.student_email || ''}</div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                      fontSize: 11, fontWeight: 600,
                      background: statusStyle(doc.status).bg,
                      color:      statusStyle(doc.status).color,
                    }}>
                      {doc.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <span>{doc.status === 'Verified' ? '✅' : doc.status === 'Received' ? '📄' : '📋'}</span>
                    <span>{doc.doc_type}</span>
                  </div>
                  <FileLink doc={doc} onDeleted={load} />

                  {doc.note && <div style={{ fontSize: 12, color: '#9ca3af' }}>{doc.note}</div>}

                  <button
                    onClick={() => openEdit(doc)}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '6px 14px',
                      background: '#f3f4f6', border: '1px solid #e5e7eb',
                      borderRadius: 6, fontSize: 12, fontWeight: 600,
                      color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    ✏️ Edit
                  </button>
                </div>
              ) : (
                // ── Desktop row ──
                <div key={doc.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 2.5fr 1fr 2fr 1.2fr',
                  padding: '13px 18px', alignItems: 'center',
                  borderBottom: i < deduplicatedAll.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: doc.status === 'Verified' ? '#f0fdf4' : 'transparent',
                }}
                  onMouseEnter={e => {
                    if (doc.status !== 'Verified') e.currentTarget.style.background = '#f9fafb'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = doc.status === 'Verified' ? '#f0fdf4' : 'transparent'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {doc.student_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {doc.student_email || ''}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>
                        {doc.status === 'Verified' ? '✅'
                          : doc.status === 'Received' ? '📄' : '📋'}
                      </span>
                      {doc.doc_type}
                    </div>
                    <FileLink doc={doc} onDeleted={load} />
                  </div>

                  <span style={{
                    padding: '3px 10px', borderRadius: 20, display: 'inline-block',
                    fontSize: 11, fontWeight: 600,
                    background: statusStyle(doc.status).bg,
                    color:      statusStyle(doc.status).color,
                  }}>
                    {doc.status}
                  </span>

                  <div style={{
                    fontSize: 12, color: '#9ca3af',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {doc.note || '—'}
                  </div>

                  <button
                    onClick={() => openEdit(doc)}
                    style={{
                      padding: '5px 14px',
                      background: '#f3f4f6', border: '1px solid #e5e7eb',
                      borderRadius: 6, fontSize: 12, fontWeight: 600,
                      color: '#374151', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    ✏️ Edit
                  </button>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — ADD STUDENT (creates all 12 doc rows)
          ════════════════════════════════════════════════════ */}
      {showAddStudent && (
        <div
          onClick={() => setShowAddStudent(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 300,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 440,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              maxHeight: '90vh', overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                Add Student Documents
              </h3>
              <button onClick={() => setShowAddStudent(false)} style={{
                background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af',
              }}>✕</button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Select Applicant *</label>
              <select
                value={addApplicantId}
                onChange={e => setAddApplicantId(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">— Choose an applicant —</option>
                {applicantsWithoutDocs.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.email ? `(${a.email})` : ''}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                ℹ️ Only applicants who don't already have a document list are shown here —
                that's what prevents duplicate lists, even for two students sharing a name.
              </div>
              {applicantsWithoutDocs.length === 0 && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', background: '#fef9c3',
                  border: '1px solid #fde68a', borderRadius: 7, fontSize: 12, color: '#92400e',
                }}>
                  Every applicant already has a document list. Add a new applicant first
                  from the Applications page.
                </div>
              )}
            </div>

            {/* Preview all 12 doc types */}
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#6b7280',
                marginBottom: 8, textTransform: 'uppercase',
              }}>
                Will create tracking for ({DOC_TYPES.length} documents):
              </div>
              {DOC_TYPES.map(t => (
                <div key={t} style={{
                  fontSize: 12, color: '#374151', padding: '3px 0',
                  display: 'flex', gap: 6,
                }}>
                  <span style={{ color: '#b91c1c' }}>●</span> {t}
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end',
            }}>
              <button onClick={() => setShowAddStudent(false)} style={{
                padding: '9px 18px', background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>Cancel</button>
              <button onClick={addStudentDocs} disabled={adding || !addApplicantId} style={{
                padding: '9px 18px',
                background: (adding || !addApplicantId) ? '#9ca3af' : (theme.primary || '#1a56db'),
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: '#fff',
                cursor: (adding || !addApplicantId) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>
                {adding ? 'Creating…' : 'Create Document List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODAL — EDIT DOCUMENT
          ════════════════════════════════════════════════════ */}
      {editDoc && (
        <div
          onClick={() => setEditDoc(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 300,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                Update Document
              </h3>
              <button onClick={() => setEditDoc(null)} style={{
                background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af',
              }}>✕</button>
            </div>

            {/* Document info */}
            <div style={{
              background: '#f9fafb', borderRadius: 8,
              padding: '10px 14px', marginBottom: 18,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                {editDoc.doc_type}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Student: {editDoc.student_name} {editDoc.student_email ? `(${editDoc.student_email})` : ''}
              </div>
              {/* File link with delete — admin can always delete regardless of status */}
              <FileLink doc={editDoc} onDeleted={() => { setEditDoc(null); load() }} />
            </div>

            {/* Status picker */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Status *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                      border: editStatus === s
                        ? `2px solid ${statusStyle(s).color}`
                        : '2px solid #e5e7eb',
                      background: editStatus === s ? statusStyle(s).bg : '#f9fafb',
                      color: editStatus === s ? statusStyle(s).color : '#6b7280',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Note for student (optional)</label>
              <textarea
                placeholder="e.g. Original not yet submitted, copy received..."
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            {/* File upload */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>Upload File (PDF / Image)</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => setEditFile(e.target.files[0] || null)}
                style={{ fontSize: 13, color: '#374151' }}
              />
              {editFile && (
                <div style={{ fontSize: 12, color: '#16a34a', marginTop: 5 }}>
                  ✓ {editFile.name}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end',
            }}>
              <button onClick={() => setEditDoc(null)} style={{
                padding: '9px 18px', background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{
                padding: '9px 18px',
                background: saving ? '#9ca3af' : '#16a34a',
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}