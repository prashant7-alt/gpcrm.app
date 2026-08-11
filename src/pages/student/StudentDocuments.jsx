/**
 * StudentDocuments.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Student-facing document upload portal — 12 document types
 * Students can upload AND delete their own files
 * FILE LOCATION: src/pages/student/StudentDocuments.jsx
 *
 * ✅ CHANGED: no more separate name+email login form. The student is already
 * authenticated by <StudentRoute> before reaching this page, so we read their
 * profile straight from localStorage (same pattern as StudentPayments.jsx)
 * and look up their documents by that email automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  FolderOpen,
  GraduationCap,
  ClipboardList,
  Paperclip,
  CheckCircle2,
  FileText,
  FileQuestion,
  MessageSquare,
  Trash2,
  Loader2,
  PartyPopper,
} from 'lucide-react'

// ─── ALL 12 DOCUMENT TYPES ────────────────────────────────────────────────────
// MUST match Documents.jsx (admin) exactly — same order, same spelling
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

const STATUS_COLOR = {
  Verified: { bg: '#dcfce7', color: '#15803d', label: 'Verified ✓' },
  Received: { bg: '#dbeafe', color: '#1d4ed8', label: 'Uploaded'  },
  Missing:  { bg: '#fee2e2', color: '#b91c1c', label: 'Missing'   },
}

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function StudentDocuments() {
  const navigate = useNavigate()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  // ✅ 'loading' → 'ready' → 'not_found'  (replaces the old 'login' / 'docs' steps)
  const [status, setStatus] = useState('loading')

  const [docs,    setDocs]    = useState([])
  const [student, setStudent] = useState(null)

  const [uploading,  setUploading]  = useState({})  // { [doc.id]: true } while uploading
  const [deleting,   setDeleting]   = useState({})  // { [doc.id]: true } while deleting
  const [uploadSuccess, setUploadSuccess] = useState({})

  useEffect(() => {
    if (!profile.id) { navigate('/login'); return }
    loadByProfile()
  }, [])

  // ── Look up this logged-in student's documents by their profile email ──
  async function loadByProfile() {
    if (!profile.email) {
      setStatus('not_found')
      return
    }

    const { data, error } = await supabase
      .from('student_documents')
      .select('*')
      .ilike('student_email', profile.email.trim().toLowerCase())

    if (error || !data || data.length === 0) {
      setStatus('not_found')
      return
    }

    setDocs(data)
    setStudent({ name: data[0].student_name, email: data[0].student_email })
    setStatus('ready')
  }

  // ── Reload this student's docs ─────────────────────────
  async function reloadDocs() {
    if (!student) return
    const { data } = await supabase
      .from('student_documents')
      .select('*')
      .ilike('student_email', student.email)
    setDocs(data || [])
  }

  // ── Upload a file ──────────────────────────────────────
  async function handleUpload(doc, file) {
    if (!file) return

    setUploading(u => ({ ...u, [doc.id]: true }))
    setUploadSuccess(s => { const n = { ...s }; delete n[doc.id]; return n })

    const ext  = file.name.split('.').pop()
    const path = `${doc.student_name}/${doc.doc_type}-${Date.now()}.${ext}`
      .replace(/\s+/g, '_')

    const { error: upErr } = await supabase.storage
      .from('student-docs')
      .upload(path, file)

    if (upErr) {
      alert('Upload failed: ' + upErr.message)
      setUploading(u => ({ ...u, [doc.id]: false }))
      return
    }

    const { data: urlData } = supabase.storage
      .from('student-docs')
      .getPublicUrl(path)

    await supabase
      .from('student_documents')
      .update({
        file_url:   urlData.publicUrl,
        status:     doc.status === 'Missing' ? 'Received' : doc.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    setUploading(u => ({ ...u, [doc.id]: false }))
    setUploadSuccess(s => ({ ...s, [doc.id]: file.name }))
    await reloadDocs()
  }

  // ── Delete a file ──────────────────────────────────────
  // Students can only delete files that are NOT yet Verified by admin.
  // Once verified, only admin can remove it.
  async function handleDelete(doc) {
    if (doc.status === 'Verified') {
      alert('This document has been verified by your counsellor and cannot be deleted. Contact Global Pathway if you need to replace it.')
      return
    }
    if (!window.confirm('Delete this file? You will need to upload it again.')) return

    setDeleting(d => ({ ...d, [doc.id]: true }))

    // Remove from Supabase Storage
    if (doc.file_url) {
      const path = doc.file_url.split('/student-docs/')[1]
      if (path) {
        await supabase.storage.from('student-docs').remove([decodeURIComponent(path)])
      }
    }

    // Reset the DB row back to Missing with no file
    await supabase
      .from('student_documents')
      .update({
        file_url:   '',
        status:     'Missing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    // Clear any upload success badge for this doc
    setUploadSuccess(s => { const n = { ...s }; delete n[doc.id]; return n })
    setDeleting(d => ({ ...d, [doc.id]: false }))
    await reloadDocs()
  }

  // ── Completion stats ───────────────────────────────────
  const total    = docs.length
  const verified = docs.filter(d => d.status === 'Verified').length
  const received = docs.filter(d => d.status === 'Received').length
  const missing  = docs.filter(d => d.status === 'Missing').length
  const pct      = total ? Math.round(((verified + received) / total) * 100) : 0

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 50%, #f0fdf4 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Loading your documents…</div>
      </div>
    )
  }

  if (status === 'not_found') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 50%, #f0fdf4 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Segoe UI', Arial, sans-serif", padding: 20,
      }}>
        <div style={{ ...card, padding: '36px 32px', maxWidth: 460, textAlign: 'center' }}>
          <FolderOpen size={40} color="#d1d5db" style={{ marginBottom: 14 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            No document checklist yet
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Your counsellor hasn't set up your document list yet. Please contact
            Global Pathway to get registered for document tracking.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 50%, #f0fdf4 100%)',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: '40px 16px',
    }}>

      {/* ── Brand bar ───────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '10px 22px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}>
          <GraduationCap size={22} color="#1a56db" />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a56db' }}>
            Global Pathway
          </span>
          <span style={{
            fontSize: 11, color: '#6b7280', fontWeight: 500,
            borderLeft: '1px solid #e5e7eb', paddingLeft: 10, marginLeft: 4,
          }}>
            Student Document Portal
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto' }}>

        {/* Student header */}
        <div style={{
          ...card, padding: '20px 26px', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: '#1a56db', flexShrink: 0,
          }}>
            {student.name.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
              {student.name}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {student.email}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip label={`${verified} Verified`} bg="#dcfce7" color="#15803d" />
              <Chip label={`${received} Uploaded`} bg="#dbeafe" color="#1d4ed8" />
              <Chip label={`${missing} Missing`}   bg="#fee2e2" color="#b91c1c" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 160, height: 6,
                background: '#e5e7eb', borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: pct === 100 ? '#16a34a' : '#1a56db',
                  borderRadius: 99, transition: 'width 0.4s',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                {pct}% complete
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 10, padding: '12px 18px', marginBottom: 18,
          fontSize: 13, color: '#1d4ed8', lineHeight: 1.6,
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <ClipboardList size={16} color="#1d4ed8" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>How to upload:</strong> Click <em>Choose File</em>, select a PDF or image,
            then click <strong>Upload</strong>. To replace a file, delete it first then upload
            the new one. Verified documents cannot be deleted — contact your counsellor.
          </span>
        </div>

        {/* Document table */}
        <div style={{ ...card, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 0.8fr 1fr 2.2fr',
            padding: '10px 22px',
            background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
          }}>
            {['Document Required', 'Status', 'Current File', 'Actions'].map(h => (
              <span key={h} style={{
                fontSize: 11, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{h}</span>
            ))}
          </div>

          {DOC_TYPES.map((type, i) => {
            const doc     = docs.find(d => d.doc_type === type)
            const isLast  = i === DOC_TYPES.length - 1

            // Doc type not in DB yet (admin hasn't run the SQL)
            if (!doc) return (
              <div key={type} style={{
                display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr 2.2fr',
                padding: '16px 22px', alignItems: 'center',
                borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                opacity: 0.5,
              }}>
                <div style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FileQuestion size={16} color="#9ca3af" />
                  {type}
                </div>
                <span style={{
                  padding: '4px 11px', borderRadius: 20, fontSize: 11,
                  fontWeight: 700, background: '#f3f4f6', color: '#9ca3af',
                  display: 'inline-block',
                }}>Not set up</span>
                <div />
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  Contact your counsellor.
                </div>
              </div>
            )

            const sc        = STATUS_COLOR[doc.status] || STATUS_COLOR.Missing
            const isUping   = uploading[doc.id]
            const isDeling  = deleting[doc.id]
            const success   = uploadSuccess[doc.id]
            const hasFile   = !!doc.file_url
            const isVerified = doc.status === 'Verified'

            return (
              <div
                key={type}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.8fr 1fr 2.2fr',
                  padding: '16px 22px', alignItems: 'center',
                  borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                  background: isVerified ? '#f0fdf4' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* Document name + counsellor note */}
                <div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: '#111827',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    {isVerified
                      ? <CheckCircle2 size={16} color="#16a34a" />
                      : hasFile
                        ? <FileText size={16} color="#6b7280" />
                        : <ClipboardList size={16} color="#9ca3af" />
                    }
                    {type}
                  </div>
                  {doc.note && (
                    <div style={{
                      fontSize: 11, color: '#92400e', marginTop: 5,
                      background: '#fef9c3', border: '1px solid #fde68a',
                      padding: '3px 9px', borderRadius: 5, display: 'inline-flex',
                      alignItems: 'center', gap: 5,
                    }}>
                      <MessageSquare size={12} color="#92400e" />
                      {doc.note}
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{
                  padding: '4px 11px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700,
                  background: sc.bg, color: sc.color,
                  display: 'inline-block', whiteSpace: 'nowrap',
                }}>
                  {sc.label}
                </span>

                {/* Current file link */}
                <div>
                  {hasFile ? (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12, color: '#1a56db', fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Paperclip size={13} color="#1a56db" />
                      View file
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: '#d1d5db' }}>No file yet</span>
                  )}
                </div>

                {/* Actions: upload + delete */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Verified — no actions allowed */}
                  {isVerified && (
                    <span style={{
                      fontSize: 12, color: '#16a34a', fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      Verified — contact counsellor to replace
                    </span>
                  )}

                  {/* Not verified — show upload + delete controls */}
                  {!isVerified && (
                    <>
                      {/* Upload row */}
                      <UploadControl
                        doc={doc}
                        isUploading={isUping}
                        successName={success}
                        onUpload={handleUpload}
                      />

                      {/* Delete button — only shown when a file exists */}
                      {hasFile && (
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={isDeling}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', width: 'fit-content',
                            background: isDeling ? '#f9fafb' : '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 7, fontSize: 12, fontWeight: 600,
                            color: isDeling ? '#9ca3af' : '#dc2626',
                            cursor: isDeling ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isDeling) e.currentTarget.style.background = '#fee2e2'
                          }}
                          onMouseLeave={e => {
                            if (!isDeling) e.currentTarget.style.background = '#fef2f2'
                          }}
                        >
                          {isDeling
                            ? <><Loader2 size={13} className="animate-spin" /> Deleting…</>
                            : <><Trash2 size={13} /> Delete file</>
                          }
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* All done banner */}
        {missing === 0 && (
          <div style={{
            ...card, marginTop: 16, padding: '18px 24px',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <PartyPopper size={28} color="#15803d" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>
                All documents submitted!
              </div>
              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                Your counsellor will review and verify each document.
                You'll be contacted once the process is complete.
              </div>
            </div>
          </div>
        )}

        <div style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 12, color: '#9ca3af',
        }}>
          Files are securely stored. Only Global Pathway counsellors can access your documents.
        </div>

      </div>
    </div>
  )
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Chip({ label, bg, color }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: bg, color,
    }}>
      {label}
    </span>
  )
}

function UploadControl({ doc, isUploading, successName, onUpload }) {
  const [file, setFile] = useState(null)

  async function handleClick() {
    if (!file) return
    await onUpload(doc, file)
    setFile(null)
  }

  if (successName) {
    return (
      <div style={{
        fontSize: 12, color: '#16a34a', fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
        <CheckCircle2 size={14} color="#16a34a" />
        Uploaded: {successName}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px',
        background: '#f3f4f6', border: '1px solid #d1d5db',
        borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#374151',
        cursor: 'pointer',
      }}>
        <FolderOpen size={14} color="#374151" />
        {file
          ? (file.name.length > 18 ? file.name.slice(0, 16) + '…' : file.name)
          : 'Choose file'}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={e => setFile(e.target.files[0] || null)}
          style={{ display: 'none' }}
          disabled={isUploading}
        />
      </label>

      {file && (
        <button
          onClick={handleClick}
          disabled={isUploading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 14px',
            background: isUploading ? '#9ca3af' : '#1a56db',
            border: 'none', borderRadius: 7,
            fontSize: 12, fontWeight: 700, color: '#fff',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isUploading
            ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
            : 'Upload ↑'
          }
        </button>
      )}
    </div>
  )
}