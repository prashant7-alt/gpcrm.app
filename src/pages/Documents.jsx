import { useState, useEffect } from 'react'
import { Trash2, User, ClipboardList, FolderOpen, CheckCircle2, FileText, Pencil, Search, Info, Eye, X } from 'lucide-react'
import { supabase } from '../supabase'
import theme from '../theme'
import { advanceApplicantStage } from '../lib/pipelineStages'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRefetchOnFocus, useRefreshHold } from '../hooks/useRefetchOnFocus'
import DocViewerModal from '../components/DocViewerModal'

// ─── ALL 12 DOCUMENT TYPES ────────────────────────────────────────────────────
// MUST match StudentDocumentUpload.jsx exactly — same order, same spelling
const DOC_TYPES = [
  'Passport',
  'National ID / Citizenship Certificate',
  'SLC/SEE Marksheet & Certificate',
  '+2 / A-Level Marksheet & Certificate',
  "Bachelor's Degree Transcripts & Certificate",
  'Character Certificate',
  'NOC',
  'English Language Test (IELTS, TOEFL, PTE, Duolingo)',
  'Statement of Purpose (SOP)',
  'Letters of Recommendation (LOR)',
  'Financial Documents (Bank Statement, Bank Balance Certificate)',
  'Medical Examination Report',
]

const STATUS_OPTIONS  = ['Missing', 'Received', 'Verified']
const STATUS_PRIORITY = { 'Verified': 2, 'Received': 1, 'Missing': 0 }

// Grid templates — header rows and body rows must use the same one.
const PS_COLS  = '2.6fr 1fr 2.4fr'                  // per-student: Document | Status | Actions
const ALL_COLS = '1.7fr 2fr 0.9fr 1.3fr 2.2fr'      // all docs:    Student | Document | Status | Note | Actions

function bestDoc(rows, type) {
  return rows
    .filter(d => d.doc_type === type)
    .sort((a, b) => (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0))[0]
}

const statusStyle = (status) => {
  if (status === 'Verified') return { bg: theme.status.success.bg, border: theme.status.success.border, color: theme.status.success.text, dot: theme.status.success.main }
  if (status === 'Received') return { bg: theme.status.info.bg, border: theme.status.info.border, color: theme.primary, dot: theme.primary }
  return                            { bg: theme.status.danger.bg, border: theme.status.danger.border, color: theme.status.danger.text, dot: theme.status.danger.main }
}

function StatusBadge({ status }) {
  const s = statusStyle(status)
  return (
    <span style={{
      padding: '2px 8px 2px 6px', borderRadius: 20,
      fontSize: 10.5, fontWeight: 600, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', gap: 4,
      minWidth: 68, whiteSpace: 'nowrap',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  )
}

function DocStatusIcon({ status, size = 14 }) {
  if (status === 'Verified') return <CheckCircle2 size={size} color={theme.status.success.main} />
  if (status === 'Received') return <FileText size={size} color={theme.primary} />
  return <ClipboardList size={size} color={theme.textMuted} />
}

const inputStyle = {
  width: '100%', padding: '8px 11px',
  border: `1px solid ${theme.inputBorder}`, borderRadius: 7,
  fontSize: 13, color: theme.textStrong, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', background: theme.white,
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: theme.textLight, textTransform: 'uppercase', marginBottom: 5,
}

// ── Row action buttons (admin side) ──────────────────────────────────────────
// Proper buttons for View / Edit / Delete. "View" opens the uploaded file in a
// new tab; "Delete" removes the uploaded file and resets the item to "Missing"
// (the checklist item itself stays). Edit is hidden when no `onEdit` is given
// (e.g. inside the edit modal, where you're already editing).
function DocActions({ doc, onEdit, onChanged, isMobile }) {
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(false)
  const hasFile = !!doc.file_url

  useRefreshHold(viewing)

  // Replace the file straight from the viewer (admin can replace at any status).
  async function handleReplace(file) {
    const ext  = file.name.split('.').pop()
    const path = `${doc.applicant_id}/${doc.doc_type}-${Date.now()}.${ext}`.replace(/\s+/g, '_')

    const { error: upErr } = await supabase.storage
      .from('student-docs').upload(path, file, { upsert: true })
    if (upErr) throw new Error(upErr.message)

    const { data: urlData } = supabase.storage.from('student-docs').getPublicUrl(path)
    const { error } = await supabase
      .from('student_documents')
      .update({
        file_url:   urlData.publicUrl,
        status:     doc.status === 'Missing' ? 'Received' : doc.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
    if (error) throw new Error(error.message)
    onChanged?.()
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the uploaded file for "${doc.doc_type}"?\nThe item will go back to "Missing".`)) return
    setBusy(true)
    try {
      const path = doc.file_url.split('/student-docs/')[1]
      if (path) {
        await supabase.storage.from('student-docs').remove([decodeURIComponent(path)])
      }
      const { error } = await supabase
        .from('student_documents')
        .update({ file_url: '', status: 'Missing', updated_at: new Date().toISOString() })
        .eq('id', doc.id)
      if (error) { alert('Could not delete the file: ' + error.message); return }
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  const btn = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit', border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {hasFile && (
        <button
          onClick={() => setViewing(true)}
          style={{ ...btn, background: theme.primaryLight, borderColor: theme.border, color: theme.primary }}
        >
          <Eye size={13} /> View
        </button>
      )}

      {viewing && (
        <DocViewerModal
          fileUrl={doc.file_url}
          title={`${doc.student_name || ''} — ${doc.doc_type}`}
          onClose={() => setViewing(false)}
          onReplace={handleReplace}
        />
      )}

      {onEdit && (
        <button
          onClick={() => onEdit(doc)}
          style={{ ...btn, background: theme.cardBg, borderColor: theme.border, color: theme.textMid }}
        >
          <Pencil size={13} /> Edit
        </button>
      )}

      {hasFile && (
        <button
          onClick={handleDelete}
          disabled={busy}
          style={{
            ...btn,
            background: theme.status.danger.bg,
            borderColor: theme.status.danger.border,
            color: theme.status.danger.text,
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          <Trash2 size={13} /> {busy ? '…' : 'Delete'}
        </button>
      )}
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
  useRefetchOnFocus(load)
  useRefreshHold(showAddStudent || adding || !!editDoc)

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
          <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: theme.textDark || theme.textStrong, margin: 0 }}>
            Student Documents
          </h1>
          <p style={{ fontSize: 13, color: theme.textLight || theme.textLight, marginTop: 4 }}>
            Track and manage visa application documents for each student ({DOC_TYPES.length} types)
          </p>
        </div>
        <button
          onClick={() => setShowAddStudent(true)}
          style={{
            padding: '9px 18px', background: theme.primary || theme.primary,
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: theme.white, cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          + Add Student Documents
        </button>
      </div>

      {/* ── VIEW TOGGLE ───────────────────────────────────── */}
      <div style={{
        display: 'flex', marginBottom: 20,
        background: theme.surfaceAlt, borderRadius: 10, padding: 4,
        width: isMobile ? '100%' : 'fit-content',
      }}>
        {[
          { key: 'student', label: 'Per Student',   Icon: User },
          { key: 'all',     label: 'All Documents', Icon: ClipboardList },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)} style={{
            padding: '8px 22px', border: 'none', borderRadius: 7,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            flex: isMobile ? 1 : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: view === tab.key ? theme.white : 'transparent',
            color:      view === tab.key ? (theme.primary || theme.primary) : theme.textLight,
            boxShadow:  view === tab.key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
          }}>
            <tab.Icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: theme.textLight, fontSize: 13 }}>Loading documents...</p>}

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
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: 12, overflow: 'hidden',
            boxSizing: 'border-box',
          }}>
            <div style={{
              padding: '12px 14px', borderBottom: `1px solid ${theme.border}`,
              fontSize: 12, fontWeight: 700, color: theme.textLight,
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
                <div style={{ padding: '20px 8px', fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>
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
                      background: isSelected ? (theme.primaryLight || theme.status.info.bg) : 'transparent',
                      color: isSelected ? (theme.primaryText || theme.primary) : theme.textMid,
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <div style={{ fontSize: 13 }}>{s.name}</div>
                    {/* Email shown so same-name students are distinguishable */}
                    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{s.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{
                        flex: 1, height: 4, background: theme.border,
                        borderRadius: 99, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${s.total ? Math.round((s.verified / s.total) * 100) : 0}%`,
                          height: '100%', background: theme.status.success.main, borderRadius: 99,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: theme.textMuted }}>{s.verified}/{s.total}</span>
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
                background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 12,
                padding: 60, textAlign: 'center', color: theme.textMuted,
              }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  <FolderOpen size={40} color={theme.textMuted} />
                </div>
                <div style={{ fontSize: 14, color: theme.textLight }}>
                  Select a student from the list to view their documents
                </div>
              </div>
            ) : (
              <>
                {/* Student summary header */}
                <div style={{
                  background: theme.white, border: `1px solid ${theme.border}`,
                  borderRadius: 12, padding: isMobile ? '14px 16px' : '16px 20px', marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong }}>
                      {selectedApplicant?.name || studentDocs[0]?.student_name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>
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
                        padding: '3px 10px 3px 8px', borderRadius: 20,
                        fontSize: 11.5, fontWeight: 600, display: 'inline-flex',
                        alignItems: 'center', gap: 5,
                        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                        {s.count} {s.label}
                      </span>
                    ))}
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: 11.5, fontWeight: 700,
                      background: theme.surfaceAlt, color: theme.textMid,
                    }}>
                      {completePct}% complete
                    </span>
                  </div>
                </div>

                {/* Document checklist — table on desktop, cards on phone */}
                <div style={{
                  background: theme.white, border: `1px solid ${theme.border}`,
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  {!isMobile && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: PS_COLS,
                      padding: '10px 18px',
                      background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
                    }}>
                      {['Document', 'Status', 'Actions'].map(h => (
                        <span key={h} style={{
                          fontSize: 11, fontWeight: 700, color: theme.textMuted,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          textAlign: h === 'Actions' ? 'center' : 'left',
                        }}>{h}</span>
                      ))}
                    </div>
                  )}

                  {deduplicatedDocs.length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
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
                          borderBottom: i < DOC_TYPES.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                        }}>
                          <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClipboardList size={14} style={{ flexShrink: 0 }} /> {type}
                          </div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11,
                            fontWeight: 600, display: 'inline-block',
                            background: theme.surfaceAlt, color: theme.textMuted,
                          }}>Not set up</span>
                        </div>
                      ) : (
                        <div key={type} style={{
                          display: 'grid', gridTemplateColumns: PS_COLS,
                          padding: '14px 18px', alignItems: 'center',
                          borderBottom: i < DOC_TYPES.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                          opacity: 0.45,
                        }}>
                          <div style={{ fontSize: 13, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClipboardList size={14} style={{ flexShrink: 0 }} /> {type}
                          </div>
                          <span style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: 11,
                            fontWeight: 600, display: 'inline-block',
                            background: theme.surfaceAlt, color: theme.textMuted,
                          }}>Not set up</span>
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
                          borderBottom: i < DOC_TYPES.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                          background: doc.status === 'Verified' ? theme.status.success.bg : 'transparent',
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: theme.textStrong, display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
                            <DocStatusIcon status={doc.status} />
                            <span>{type}</span>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            <StatusBadge status={doc.status} />
                          </div>
                        </div>

                        <div style={{ marginTop: 2 }}>
                          <DocActions doc={doc} onEdit={openEdit} onChanged={load} isMobile />
                        </div>
                      </div>
                    ) : (
                      // ── Desktop row ──
                      <div
                        key={type}
                        style={{
                          display: 'grid', gridTemplateColumns: PS_COLS,
                          padding: '14px 18px', alignItems: 'center',
                          borderBottom: i < DOC_TYPES.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                          background: doc.status === 'Verified' ? theme.status.success.bg : 'transparent',
                        }}
                        onMouseEnter={e => {
                          if (doc.status !== 'Verified') e.currentTarget.style.background = theme.pageBg
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = doc.status === 'Verified' ? theme.status.success.bg : 'transparent'
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: theme.textStrong, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <DocStatusIcon status={doc.status} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
                        </div>

                        <StatusBadge status={doc.status} />

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <DocActions doc={doc} onEdit={openEdit} onChanged={load} />
                        </div>
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
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: 8, padding: '8px 14px', flex: 1,
            }}>
              <Search size={16} style={{ color: theme.textMuted, flexShrink: 0 }} />
              <input
                placeholder="Search by student name or document type..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                style={{
                  background: 'none', border: 'none', outline: 'none',
                  fontSize: 13, color: theme.textMid, width: '100%', fontFamily: 'inherit',
                }}
              />
            </div>
            <select
              value={tableFilter}
              onChange={e => setTableFilter(e.target.value)}
              style={{
                background: theme.white, border: `1px solid ${theme.border}`,
                borderRadius: 8, padding: '8px 14px',
                fontSize: 13, color: theme.textMid, outline: 'none', cursor: 'pointer',
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
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {!isMobile && (
              <div style={{
                display: 'grid', gridTemplateColumns: ALL_COLS,
                padding: '10px 18px',
                background: theme.pageBg, borderBottom: `1px solid ${theme.border}`,
              }}>
                {['Student', 'Document', 'Status', 'Note', 'Actions'].map(h => (
                  <span key={h} style={{
                    fontSize: 11, fontWeight: 700, color: theme.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</span>
                ))}
              </div>
            )}

            {deduplicatedAll.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  <FolderOpen size={36} color={theme.textMuted} />
                </div>
                <div style={{ fontSize: 14, color: theme.textLight }}>No documents found</div>
              </div>
            )}

            {deduplicatedAll.map((doc, i) => (
              isMobile ? (
                // ── Mobile card ──
                <div key={doc.id} style={{
                  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
                  borderBottom: i < deduplicatedAll.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                  background: doc.status === 'Verified' ? theme.status.success.bg : 'transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.textStrong }}>{doc.student_name}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{doc.student_email || ''}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <StatusBadge status={doc.status} />
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: theme.textMid, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                    <DocStatusIcon status={doc.status} />
                    <span>{doc.doc_type}</span>
                  </div>

                  {doc.note && <div style={{ fontSize: 12, color: theme.textMuted }}>{doc.note}</div>}

                  <div style={{ marginTop: 2 }}>
                    <DocActions doc={doc} onEdit={openEdit} onChanged={load} isMobile />
                  </div>
                </div>
              ) : (
                // ── Desktop row ──
                <div key={doc.id} style={{
                  display: 'grid', gridTemplateColumns: ALL_COLS,
                  padding: '13px 18px', alignItems: 'center',
                  borderBottom: i < deduplicatedAll.length - 1 ? `1px solid ${theme.surfaceAlt}` : 'none',
                  background: doc.status === 'Verified' ? theme.status.success.bg : 'transparent',
                }}
                  onMouseEnter={e => {
                    if (doc.status !== 'Verified') e.currentTarget.style.background = theme.pageBg
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = doc.status === 'Verified' ? theme.status.success.bg : 'transparent'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.textStrong }}>
                      {doc.student_name}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
                      {doc.student_email || ''}
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <DocStatusIcon status={doc.status} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.doc_type}</span>
                  </div>

                  <StatusBadge status={doc.status} />

                  <div style={{
                    fontSize: 12, color: theme.textMuted,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {doc.note || '—'}
                  </div>

                  <DocActions doc={doc} onEdit={openEdit} onChanged={load} />
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
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 440,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              maxHeight: '90vh', overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
                Add Student Documents
              </h3>
              <button onClick={() => setShowAddStudent(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'inline-flex',
              }}><X size={18} /></button>
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
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, display: 'flex', gap: 4 }}>
                <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Only applicants who don't already have a document list are shown here —
                  that's what prevents duplicate lists, even for two students sharing a name.
                </span>
              </div>
              {applicantsWithoutDocs.length === 0 && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', background: theme.status.warning.bg,
                  border: `1px solid ${theme.status.warning.border}`, borderRadius: 7, fontSize: 12, color: theme.status.warning.text,
                }}>
                  Every applicant already has a document list. Add a new applicant first
                  from the Applications page.
                </div>
              )}
            </div>

            {/* Preview all 12 doc types */}
            <div style={{
              background: theme.pageBg, border: `1px solid ${theme.border}`,
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: theme.textLight,
                marginBottom: 8, textTransform: 'uppercase',
              }}>
                Will create tracking for ({DOC_TYPES.length} documents):
              </div>
              {DOC_TYPES.map(t => (
                <div key={t} style={{
                  fontSize: 12, color: theme.textMid, padding: '3px 0',
                  display: 'flex', gap: 6,
                }}>
                  <span style={{ color: theme.status.danger.text }}>●</span> {t}
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end',
            }}>
              <button onClick={() => setShowAddStudent(false)} style={{
                padding: '9px 18px', background: theme.pageBg,
                border: `1px solid ${theme.border}`, borderRadius: 8,
                fontSize: 13, color: theme.textLight, cursor: 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>Cancel</button>
              <button onClick={addStudentDocs} disabled={adding || !addApplicantId} style={{
                padding: '9px 18px',
                background: (adding || !addApplicantId) ? theme.textMuted : (theme.primary || theme.primary),
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: theme.white,
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
              background: theme.white, border: `1px solid ${theme.border}`,
              borderRadius: isMobile ? '14px 14px 0 0' : 14,
              padding: isMobile ? 20 : 28,
              width: isMobile ? '100%' : 440,
              maxHeight: '90vh', overflowY: 'auto',
              boxSizing: 'border-box',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
                Update Document
              </h3>
              <button onClick={() => setEditDoc(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, display: 'inline-flex',
              }}><X size={18} /></button>
            </div>

            {/* Document info */}
            <div style={{
              background: theme.pageBg, borderRadius: 8,
              padding: '10px 14px', marginBottom: 18,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.textStrong }}>
                {editDoc.doc_type}
              </div>
              <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2, marginBottom: editDoc.file_url ? 10 : 0 }}>
                Student: {editDoc.student_name} {editDoc.student_email ? `(${editDoc.student_email})` : ''}
              </div>
              {/* View / delete the current file — admin can delete regardless of status */}
              <DocActions doc={editDoc} onChanged={() => { setEditDoc(null); load() }} />
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
                        : `2px solid ${theme.border}`,
                      background: editStatus === s ? statusStyle(s).bg : theme.pageBg,
                      color: editStatus === s ? statusStyle(s).color : theme.textLight,
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
                style={{ fontSize: 13, color: theme.textMid }}
              />
              {editFile && (
                <div style={{ fontSize: 12, color: theme.status.success.main, marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} /> {editFile.name}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex', gap: 10,
              flexDirection: isMobile ? 'column-reverse' : 'row',
              justifyContent: 'flex-end',
            }}>
              <button onClick={() => setEditDoc(null)} style={{
                padding: '9px 18px', background: theme.pageBg,
                border: `1px solid ${theme.border}`, borderRadius: 8,
                fontSize: 13, color: theme.textLight, cursor: 'pointer', fontFamily: 'inherit',
                width: isMobile ? '100%' : 'auto',
              }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{
                padding: '9px 18px',
                background: saving ? theme.textMuted : theme.status.success.main,
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: theme.white,
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