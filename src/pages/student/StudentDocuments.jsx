/**
 * StudentDocumentUpload.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Student-facing document upload portal — 12 document types
 * Students can upload AND delete their own files
 * FILE LOCATION: src/pages/student/StudentDocumentUpload.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react'
import { supabase } from '../../supabase'

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

export default function StudentDocumentUpload() {

  const [step, setStep] = useState('login')

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [looking,  setLooking]  = useState(false)
  const [loginErr, setLoginErr] = useState('')

  const [docs,    setDocs]    = useState([])
  const [student, setStudent] = useState(null)

  const [uploading,  setUploading]  = useState({})  // { [doc.id]: true } while uploading
  const [deleting,   setDeleting]   = useState({})  // { [doc.id]: true } while deleting
  const [uploadSuccess, setUploadSuccess] = useState({})

  // ── Look up the student by name + email ────────────────
  async function findStudent(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setLoginErr('Please enter both your full name and email.')
      return
    }
    setLooking(true)
    setLoginErr('')

    const { data, error } = await supabase
      .from('student_documents')
      .select('*')
      .ilike('student_name',  name.trim())
      .ilike('student_email', email.trim().toLowerCase())

    setLooking(false)

    if (error) {
      setLoginErr('Something went wrong. Please try again.')
      return
    }
    if (!data || data.length === 0) {
      setLoginErr(
        "We couldn't find your record. Please check your name and email, " +
        "or contact Global Pathway to ensure you've been registered."
      )
      return
    }

    setDocs(data)
    setStudent({ name: data[0].student_name, email: data[0].student_email })
    setStep('docs')
  }

  // ── Reload this student's docs ─────────────────────────
  async function reloadDocs() {
    if (!student) return
    const { data } = await supabase
      .from('student_documents')
      .select('*')
      .ilike('student_name',  student.name)
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
          <span style={{ fontSize: 22 }}>🎓</span>
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

      {/* ════════════════════════════════════════════════
          STEP 1 — LOGIN
          ════════════════════════════════════════════════ */}
      {step === 'login' && (
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <div style={{ ...card, padding: '36px 32px' }}>

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: '#eff6ff', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, margin: '0 auto 14px',
              }}>📁</div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
                Upload Your Documents
              </h1>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 1.55 }}>
                Enter your registered name and email to access your document checklist.
              </p>
            </div>

            <form onSubmit={findStudent}>
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700,
                  color: '#6b7280', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 5,
                }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ram Kumar Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '10px 13px',
                    border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, color: '#111827', outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700,
                  color: '#6b7280', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 5,
                }}>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. ram@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '10px 13px',
                    border: '1px solid #d1d5db', borderRadius: 8,
                    fontSize: 14, color: '#111827', outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>

              {loginErr && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#b91c1c', marginBottom: 16, lineHeight: 1.5,
                }}>
                  ⚠️ {loginErr}
                </div>
              )}

              <button
                type="submit"
                disabled={looking}
                style={{
                  width: '100%', padding: '11px 0',
                  background: looking ? '#9ca3af' : '#1a56db',
                  border: 'none', borderRadius: 9,
                  fontSize: 14, fontWeight: 700, color: '#fff',
                  cursor: looking ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'background 0.2s',
                }}
              >
                {looking ? 'Looking up your record…' : 'View My Documents →'}
              </button>
            </form>

            <div style={{
              marginTop: 20, padding: '12px 14px',
              background: '#f9fafb', borderRadius: 8,
              fontSize: 12, color: '#6b7280', lineHeight: 1.6,
            }}>
              📞 <strong>Need help?</strong> Contact Global Pathway if your name/email
              isn't recognised — your counsellor needs to register you first.
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          STEP 2 — DOCUMENT CHECKLIST
          ════════════════════════════════════════════════ */}
      {step === 'docs' && student && (
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

            <button
              onClick={() => {
                setStep('login'); setDocs([]); setStudent(null)
                setName(''); setEmail('')
              }}
              style={{
                padding: '7px 16px', background: '#f9fafb',
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 12, fontWeight: 600, color: '#6b7280',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          </div>

          {/* Instructions */}
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 10, padding: '12px 18px', marginBottom: 18,
            fontSize: 13, color: '#1d4ed8', lineHeight: 1.6,
          }}>
            📋 <strong>How to upload:</strong> Click <em>Choose File</em>, select a PDF or image,
            then click <strong>Upload</strong>. To replace a file, delete it first then upload
            the new one. Verified documents cannot be deleted — contact your counsellor.
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
                  <div style={{ fontSize: 13, color: '#374151' }}>📋 {type}</div>
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
                      <span style={{ fontSize: 16 }}>
                        {isVerified ? '✅' : hasFile ? '📄' : '📋'}
                      </span>
                      {type}
                    </div>
                    {doc.note && (
                      <div style={{
                        fontSize: 11, color: '#92400e', marginTop: 5,
                        background: '#fef9c3', border: '1px solid #fde68a',
                        padding: '3px 9px', borderRadius: 5, display: 'inline-block',
                      }}>
                        💬 {doc.note}
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
                        📎 View file
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: '#d1d5db' }}>No file yet</span>
                    )}
                  </div>

                  {/* Actions: upload + delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                    {/* Verified — no actions allowed */}
                    {isVerified && (
                      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                        ✓ Verified — contact counsellor to replace
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
                            {isDeling ? '⏳ Deleting…' : '🗑️ Delete file'}
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
              <span style={{ fontSize: 28 }}>🎉</span>
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
      )}
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
      <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
        ✓ Uploaded: {successName}
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
        📂 {file
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
            padding: '6px 14px',
            background: isUploading ? '#9ca3af' : '#1a56db',
            border: 'none', borderRadius: 7,
            fontSize: 12, fontWeight: 700, color: '#fff',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isUploading ? 'Uploading…' : 'Upload ↑'}
        </button>
      )}
    </div>
  )
}