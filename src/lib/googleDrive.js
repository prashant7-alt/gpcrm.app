import { functionHeaders } from '../supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Client wrapper for the `google-drive` Edge Function.
//
// The browser only ever talks to this Supabase function — it never sees the
// Google OAuth client secret or refresh token. Supabase keeps every record;
// the function stores the actual file bytes in the consultancy's Google Drive
// and streams them back through itself for View / Download.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const FN = `${SUPABASE_URL}/functions/v1/google-drive`

async function call(action, payload = {}) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: await functionHeaders(),
    body: JSON.stringify({ action, ...payload }),
  })
  let json = {}
  try { json = await res.json() } catch { /* non-JSON body */ }
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json
}

// Read a File/Blob as raw base64 (no data: prefix).
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Could not read the selected file'))
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.readAsDataURL(file)
  })
}

const EXT_MIME = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'

/** Connectivity / config check — Google auth + the Students root folder. */
export function driveHealth() {
  return call('health')
}

/** Create (or reuse) this student's Drive folder and store its id on the row. */
export function ensureStudentFolder(applicantId) {
  return call('ensure_folder', { applicant_id: applicantId })
}

/**
 * Upload a file for a checklist document.
 *   documentId  — the student_documents row id (preferred)
 *   applicantId + docType — used when the checklist row doesn't exist yet
 * Returns { ok, document, file_id } — `document` is the updated row.
 */
export async function uploadDocument({ documentId, applicantId, docType, file }) {
  if (!file) throw new Error('No file selected')
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const mime = file.type || EXT_MIME[ext] || 'application/octet-stream'
  const data_base64 = await fileToBase64(file)
  return call('upload', {
    document_id: documentId,
    applicant_id: applicantId,
    doc_type: docType,
    filename: file.name,
    mime_type: mime,
    data_base64,
  })
}

/** Trash the Drive file and reset the checklist slot back to "Missing". */
export function deleteDriveDocument(documentId) {
  return call('delete', { document_id: documentId })
}

/**
 * Fetch a document's bytes through the function and return an object URL.
 * Caller is responsible for URL.revokeObjectURL() when done.
 */
export async function fetchDocumentBlobUrl(documentId, { download = false } = {}) {
  const res = await fetch(
    `${FN}?action=${download ? 'download' : 'view'}&document_id=${encodeURIComponent(documentId)}`,
    { headers: await functionHeaders() },
  )
  if (!res.ok) {
    let msg = `Could not load the file (${res.status})`
    try { msg = (await res.json()).error || msg } catch { /* streamed body, no JSON */ }
    throw new Error(msg)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * One-time migration of every legacy Supabase Storage file into Drive.
 * Loops the batched `migrate_all` action until nothing remains.
 * onProgress({ migrated, skipped, errors }) is called after each batch.
 */
export async function migrateAllToDrive(onProgress) {
  const total = { migrated: 0, skipped: 0, errors: [] }
  for (let i = 0; i < 200; i++) {
    const r = await call('migrate_all')
    total.migrated += r.migrated || 0
    total.skipped += r.skipped || 0
    total.errors = total.errors.concat(r.errors || [])
    onProgress?.({ ...total })
    if (!r.remaining) break
  }
  return total
}
