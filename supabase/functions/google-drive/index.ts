import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// google-drive  —  server-side bridge between the CRM and the consultancy's
// Google Drive. The React app NEVER talks to Google directly and never sees the
// OAuth client secret / refresh token.
//
//  Supabase   = database, auth, all metadata (students, document rows, …)
//  Google Drive = the actual document files, one folder per student
//
// Security model (same shape as create-staff-user / esewa-sign):
//  - Caller must present a valid Supabase session (Authorization: Bearer <jwt>).
//  - The caller's role is read server-side from `profiles`.
//  - Staff roles can act on any student; a `student` can only act on their own
//    documents (matched on profiles.email / profiles.applicant_id).
//  - Google credentials live only in this function's env (Supabase secrets).
//  - Files are streamed back through this function — never shared publicly and
//    never "anyone with the link".
//
// Actions (POST JSON `{ action, ... }`, or GET `?action=…` for view/download):
//   health          – check Google auth + resolve the Students root folder
//   ensure_folder   – { applicant_id }            create/reuse the student folder
//   upload          – { document_id | (applicant_id + doc_type), filename,
//                       mime_type, data_base64 }  upload a file, save metadata
//   delete          – { document_id }             trash the Drive file, reset row
//   view / download – { document_id }             stream the file (inline/attach)
//   migrate_all     – admin only                  move existing Supabase Storage
//                                                 files into Drive, in batches
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

const GOOGLE_CLIENT_ID     = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? ''
const CONFIGURED_ROOT_ID   = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') ?? ''
const MAX_UPLOAD_MB        = Math.max(1, Number(Deno.env.get('GOOGLE_DRIVE_MAX_UPLOAD_MB') ?? '10'))

const ROOT_FOLDER_NAME     = 'Global Pathway CRM'
const STUDENTS_FOLDER_NAME = 'Students'
const MIGRATE_BATCH        = 15
const STORAGE_BUCKET       = 'student-docs'

// Mirrors src/App.jsx:  /documents is open to these roles.
const DOC_WRITE_ROLES = ['admin', 'staff', 'document_handler', 'visa_officer']
// Any staff role may read a document.
const STAFF_ROLES = ['admin', 'staff', 'finance_officer', 'document_handler',
                     'receptionist', 'counselor', 'visa_officer']

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

const isLocalhost = (o: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow =
    isLocalhost(origin) ? origin
    : ALLOWED_ORIGINS.length === 0 ? (origin || '*')
    : ALLOWED_ORIGINS.includes(origin) ? origin
    : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── typed error so the router can map to a status + a user-safe message ──────
class GDriveError extends Error {
  kind: string; status: number; detail: unknown
  constructor(kind: string, message: string, status = 502, detail?: unknown) {
    super(message); this.kind = kind; this.status = status; this.detail = detail
  }
}

// ── Google OAuth: refresh-token → access-token, cached across warm invokes ───
let tokenCache: { access: string; exp: number } | null = null

async function getAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new GDriveError('config', 'Google Drive is not configured on the server.', 500)
  }
  if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.access

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) {
    throw new GDriveError('google_auth',
      'Could not authenticate with Google Drive. The refresh token may have been revoked.',
      502, j)
  }
  tokenCache = { access: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  return tokenCache.access
}

// ── thin Drive REST v3 helpers ─────────────────────────────────────────────
async function driveFetch(path: string, init: RequestInit = {}, base = 'https://www.googleapis.com/drive/v3') {
  const at = await getAccessToken()
  return fetch(base + path, { ...init, headers: { Authorization: `Bearer ${at}`, ...(init.headers ?? {}) } })
}

async function driveJson(path: string, init: RequestInit = {}) {
  const res = await driveFetch(path, init)
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new GDriveError('drive', j?.error?.message || `Drive API error (${res.status})`, 502, j)
  return j
}

function esc(s: string) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") }

async function findFolder(name: string, parentId: string | null): Promise<string | null> {
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    `name = '${esc(name)}'`,
    parentId ? `'${esc(parentId)}' in parents` : "'root' in parents",
  ].join(' and ')
  const j = await driveJson(`/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive&pageSize=5`)
  return j.files?.[0]?.id ?? null
}

async function createFolder(name: string, parentId: string | null): Promise<string> {
  const j = await driveJson('/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  })
  return j.id
}

async function ensureFolder(name: string, parentId: string | null): Promise<string> {
  return (await findFolder(name, parentId)) ?? (await createFolder(name, parentId))
}

async function folderExists(id: string): Promise<boolean> {
  const res = await driveFetch(`/files/${id}?fields=id,trashed`)
  if (!res.ok) return false
  const j = await res.json().catch(() => ({}))
  return !!j.id && !j.trashed
}

// Resolve "Global Pathway CRM / Students". Cached; prefer the configured id.
let studentsFolderId = CONFIGURED_ROOT_ID
async function getStudentsFolderId(): Promise<string> {
  if (studentsFolderId) return studentsFolderId
  const root = await ensureFolder(ROOT_FOLDER_NAME, null)
  const students = await ensureFolder(STUDENTS_FOLDER_NAME, root)
  studentsFolderId = students
  console.log(`[google-drive] Resolved "${ROOT_FOLDER_NAME}/${STUDENTS_FOLDER_NAME}" = ${students}. ` +
    `Set the GOOGLE_DRIVE_ROOT_FOLDER_ID secret to this value to skip the lookup on cold starts.`)
  return students
}

function safeName(s: string, max = 120): string {
  return String(s ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'file'
}

interface ApplicantRow {
  id: string | number
  name: string | null
  email: string | null
  student_code: string | null
  google_drive_folder_id: string | null
}

async function ensureStudentFolder(a: ApplicantRow): Promise<string> {
  if (a.google_drive_folder_id && await folderExists(a.google_drive_folder_id)) {
    return a.google_drive_folder_id
  }
  const code = a.student_code || `ID-${String(a.id).slice(0, 8)}`
  const folderName = safeName(`${code} - ${a.name || 'Student'}`)
  const parent = await getStudentsFolderId()
  const id = (await findFolder(folderName, parent)) ?? (await createFolder(folderName, parent))
  await admin.from('applicants').update({ google_drive_folder_id: id }).eq('id', a.id)
  return id
}

async function driveUploadMultipart(
  folderId: string, filename: string, mime: string, bytes: Uint8Array,
): Promise<{ id: string; size: number }> {
  const boundary = '----gpcrm' + crypto.randomUUID()
  const enc = new TextEncoder()
  const meta = JSON.stringify({ name: filename, parents: [folderId] })
  const pre = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  )
  const post = enc.encode(`\r\n--${boundary}--\r\n`)
  const body = new Uint8Array(pre.length + bytes.length + post.length)
  body.set(pre, 0); body.set(bytes, pre.length); body.set(post, pre.length + bytes.length)

  const at = await getAccessToken()
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size',
    { method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
  )
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.id) throw new GDriveError('drive_upload', j?.error?.message || 'Drive upload failed', 502, j)
  return { id: j.id, size: Number(j.size ?? bytes.length) }
}

async function driveRename(id: string, name: string) {
  await driveJson(`/files/${id}?fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  })
}

async function driveTrash(id: string) {
  const res = await driveFetch(`/files/${id}`, { method: 'DELETE' })
  if (res.ok || res.status === 404) return
  // Fall back to a soft trash if an outright delete isn't permitted.
  await driveFetch(`/files/${id}?fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  }).catch(() => {})
}

// ── content sniffing — never trust the extension / declared type alone ──────
function sniff(b: Uint8Array): 'pdf' | 'jpeg' | 'png' | 'webp' | 'zip' | 'ole' | null {
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4B && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'zip'
  if (b.length >= 8 && b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) return 'ole'
  return null
}

function validateFile(mime: string, bytes: Uint8Array) {
  if (bytes.length === 0) throw new GDriveError('empty_file', 'The file is empty.', 400)
  if (bytes.length > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new GDriveError('too_large', `File is too large. The maximum is ${MAX_UPLOAD_MB} MB.`, 413)
  }
  if (!ALLOWED_MIME[mime]) {
    throw new GDriveError('bad_type', 'That file type is not allowed. Use PDF, JPG, PNG, DOC or DOCX.', 415)
  }
  const s = sniff(bytes)
  const ok =
    (mime === 'application/pdf'  && s === 'pdf')  ||
    (mime === 'image/jpeg'       && s === 'jpeg') ||
    (mime === 'image/png'        && s === 'png')  ||
    (mime === 'image/webp'       && s === 'webp') ||
    (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && s === 'zip') ||
    (mime === 'application/msword' && (s === 'ole' || s === null)) // some valid .doc lack the OLE header
  if (!ok) throw new GDriveError('content_mismatch', "The file's contents don't match its type.", 415)
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = String(b64 || '').replace(/^data:[^;]+;base64,/, '')
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ── caller identity / authorisation ───────────────────────────────────────
interface Caller { id: string; role: string; email: string; applicant_id: string | null }

async function getCaller(req: Request): Promise<Caller | { error: string; status: number }> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return { error: 'Missing Authorization header', status: 401 }
  const { data: { user }, error } = await admin.auth.getUser(jwt)
  if (error || !user) return { error: 'Invalid or expired session', status: 401 }
  const { data: p } = await admin.from('profiles')
    .select('role, email, applicant_id').eq('id', user.id).maybeSingle()
  if (!p) return { error: 'Caller has no profile', status: 403 }
  return { id: user.id, role: p.role || '', email: (p.email || '').toLowerCase(), applicant_id: p.applicant_id ?? null }
}

const isStaff = (c: Caller) => STAFF_ROLES.includes(c.role)

function ownsDoc(c: Caller, row: { student_email?: string | null; applicant_id?: string | number | null }) {
  const email = (row.student_email || '').toLowerCase()
  return (!!email && email === c.email) ||
         (row.applicant_id != null && c.applicant_id != null && String(row.applicant_id) === String(c.applicant_id))
}

async function loadApplicant(idOrEmail: { id?: string | number | null; email?: string | null }): Promise<ApplicantRow | null> {
  const cols = 'id, name, email, student_code, google_drive_folder_id'
  if (idOrEmail.id != null) {
    const { data } = await admin.from('applicants').select(cols).eq('id', idOrEmail.id).maybeSingle()
    if (data) return data as ApplicantRow
  }
  if (idOrEmail.email) {
    const { data } = await admin.from('applicants').select(cols).ilike('email', idOrEmail.email).maybeSingle()
    if (data) return data as ApplicantRow
  }
  return null
}

// ════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const caller = await getCaller(req)
    if ('error' in caller) return json({ ok: false, error: caller.error }, caller.status)

    const url = new URL(req.url)
    let action = url.searchParams.get('action') || ''
    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}))
      action = (body.action as string) || action
    }
    const param = (k: string) => (body[k] as string) ?? url.searchParams.get(k) ?? undefined

    // ── health ────────────────────────────────────────────────────────────
    if (action === 'health') {
      if (!isStaff(caller)) return json({ ok: false, error: 'Staff only' }, 403)
      await getAccessToken()
      const folder = await getStudentsFolderId()
      return json({
        ok: true,
        students_folder_id: folder,
        root_configured: !!CONFIGURED_ROOT_ID,
        max_upload_mb: MAX_UPLOAD_MB,
      })
    }

    // ── ensure_folder ─────────────────────────────────────────────────────
    if (action === 'ensure_folder') {
      const applicantId = param('applicant_id')
      if (!applicantId) return json({ ok: false, error: 'applicant_id is required' }, 400)
      if (!isStaff(caller) && String(caller.applicant_id) !== String(applicantId)) {
        return json({ ok: false, error: 'Not permitted' }, 403)
      }
      const applicant = await loadApplicant({ id: applicantId })
      if (!applicant) return json({ ok: false, error: 'Student not found' }, 404)
      const folderId = await ensureStudentFolder(applicant)
      return json({ ok: true, folder_id: folderId })
    }

    // ── upload ────────────────────────────────────────────────────────────
    if (action === 'upload') {
      const documentId = param('document_id')
      const applicantId = param('applicant_id')
      const docType = param('doc_type')
      const filename = param('filename') || 'document'
      const mime = String(param('mime_type') || '')
      const dataB64 = param('data_base64')
      if (!dataB64) return json({ ok: false, error: 'data_base64 is required' }, 400)

      // Resolve the target student_documents row (existing checklist slot, or a
      // new row when the checklist hasn't been set up for this type yet).
      let row: Record<string, any> | null = null
      if (documentId) {
        const { data } = await admin.from('student_documents').select('*').eq('id', documentId).maybeSingle()
        row = data
        if (!row) return json({ ok: false, error: 'Document not found' }, 404)
      } else {
        if (!applicantId || !docType) {
          return json({ ok: false, error: 'document_id, or applicant_id + doc_type, is required' }, 400)
        }
        const { data } = await admin.from('student_documents').select('*')
          .eq('applicant_id', applicantId).eq('doc_type', docType).maybeSingle()
        row = data ?? null
      }

      const applicant = await loadApplicant({
        id: row?.applicant_id ?? applicantId ?? null,
        email: row?.student_email ?? null,
      })
      if (!applicant) return json({ ok: false, error: 'Student not found for this document' }, 404)

      const canWrite = DOC_WRITE_ROLES.includes(caller.role) ||
        ownsDoc(caller, { student_email: row?.student_email ?? applicant.email, applicant_id: applicant.id })
      if (!canWrite) return json({ ok: false, error: 'Not permitted to upload documents' }, 403)

      const bytes = b64ToBytes(dataB64)
      validateFile(mime, bytes)

      const folderId = await ensureStudentFolder(applicant)
      const ext = ALLOWED_MIME[mime]
      const typeLabel = safeName(row?.doc_type || docType || 'Document', 90)
      const driveName = `${typeLabel}.${ext}`

      // Replace flow: keep the previous version in Drive, renamed + recorded.
      const superseded: string[] = Array.isArray(row?.superseded_file_ids) ? [...row!.superseded_file_ids] : []
      const prevVersion = Number(row?.version) || 1
      let newVersion = 1
      if (row?.google_drive_file_id) {
        const stamp = new Date().toISOString().slice(0, 10)
        await driveRename(row.google_drive_file_id, `${typeLabel} (v${prevVersion} — replaced ${stamp}).${row.mime_type ? (ALLOWED_MIME[row.mime_type] || 'bin') : ext}`).catch(() => {})
        superseded.push(row.google_drive_file_id)
        newVersion = prevVersion + 1
      }

      const uploaded = await driveUploadMultipart(folderId, driveName, mime, bytes)
      const nowIso = new Date().toISOString()

      const patch = {
        storage_provider: 'google_drive',
        google_drive_file_id: uploaded.id,
        google_drive_folder_id: folderId,
        mime_type: mime,
        file_size: uploaded.size,
        original_filename: safeName(filename, 200),
        version: newVersion,
        superseded_file_ids: superseded,
        uploaded_by: caller.email || caller.id,
        uploaded_at: nowIso,
        updated_at: nowIso,
        deleted_at: null,
        file_url: '',
        status: (row?.status && row.status !== 'Missing') ? row.status : 'Received',
      }

      let saved: Record<string, any> | null = null
      if (row?.id) {
        const { data, error } = await admin.from('student_documents').update(patch).eq('id', row.id).select().maybeSingle()
        if (error) throw new GDriveError('db', 'The file uploaded but its record could not be saved: ' + error.message, 500)
        saved = data
      } else {
        const { data, error } = await admin.from('student_documents').insert({
          applicant_id: applicant.id,
          student_name: applicant.name,
          student_email: (applicant.email || '').toLowerCase(),
          doc_type: docType,
          note: '',
          ...patch,
        }).select().maybeSingle()
        if (error) throw new GDriveError('db', 'The file uploaded but its record could not be saved: ' + error.message, 500)
        saved = data
      }

      return json({ ok: true, document: saved, file_id: uploaded.id })
    }

    // ── delete ────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const documentId = param('document_id')
      if (!documentId) return json({ ok: false, error: 'document_id is required' }, 400)
      const { data: row } = await admin.from('student_documents').select('*').eq('id', documentId).maybeSingle()
      if (!row) return json({ ok: false, error: 'Document not found' }, 404)

      const canWrite = DOC_WRITE_ROLES.includes(caller.role) || ownsDoc(caller, row)
      if (!canWrite) return json({ ok: false, error: 'Not permitted to delete this document' }, 403)
      if (!DOC_WRITE_ROLES.includes(caller.role) && row.status === 'Verified') {
        return json({ ok: false, error: 'A verified document can only be removed by a counsellor.' }, 403)
      }

      if (row.google_drive_file_id) await driveTrash(row.google_drive_file_id)
      // Legacy rows that were still on Supabase Storage.
      if ((!row.google_drive_file_id) && row.file_url && String(row.file_url).includes(`/${STORAGE_BUCKET}/`)) {
        const path = decodeURIComponent(String(row.file_url).split(`/${STORAGE_BUCKET}/`)[1] || '')
        if (path) await admin.storage.from(STORAGE_BUCKET).remove([path]).catch(() => {})
      }

      const nowIso = new Date().toISOString()
      const { error } = await admin.from('student_documents').update({
        google_drive_file_id: null,
        mime_type: null,
        file_size: null,
        original_filename: null,
        file_url: '',
        status: 'Missing',
        updated_at: nowIso,
      }).eq('id', row.id)
      if (error) throw new GDriveError('db', 'The file was removed but the record update failed: ' + error.message, 500)

      return json({ ok: true })
    }

    // ── view / download ──────────────────────────────────────────────────
    if (action === 'view' || action === 'download') {
      const documentId = param('document_id')
      if (!documentId) return json({ ok: false, error: 'document_id is required' }, 400)
      const { data: row } = await admin.from('student_documents').select('*').eq('id', documentId).maybeSingle()
      if (!row) return json({ ok: false, error: 'Document not found' }, 404)

      const canRead = isStaff(caller) || ownsDoc(caller, row)
      if (!canRead) return json({ ok: false, error: 'Not permitted to view this document' }, 403)

      if (!row.google_drive_file_id) {
        if (row.file_url) return Response.redirect(row.file_url, 302)
        return json({ ok: false, error: 'This document has no file.' }, 404)
      }

      const g = await driveFetch(`/files/${row.google_drive_file_id}?alt=media`)
      if (!g.ok || !g.body) {
        const j = await g.json().catch(() => ({}))
        throw new GDriveError('drive_download', j?.error?.message || 'Could not fetch the file from Drive.', 502, j)
      }

      const ext = row.mime_type ? (ALLOWED_MIME[row.mime_type] || 'bin') : 'bin'
      const fallback = `${safeName(row.doc_type || 'document', 90)}.${ext}`
      const name = safeName(row.original_filename || fallback, 200).replace(/["\\]/g, '')
      const headers: Record<string, string> = {
        ...cors,
        'Content-Type': row.mime_type || g.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `${action === 'download' ? 'attachment' : 'inline'}; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      }
      const len = g.headers.get('content-length')
      if (len) headers['Content-Length'] = len
      return new Response(g.body, { headers })
    }

    // ── migrate_all (admin) ──────────────────────────────────────────────
    if (action === 'migrate_all') {
      if (caller.role !== 'admin') return json({ ok: false, error: 'Admin only' }, 403)

      const { data: rows, error } = await admin.from('student_documents')
        .select('*')
        .neq('storage_provider', 'google_drive')
        .not('file_url', 'is', null)
        .neq('file_url', '')
        .limit(MIGRATE_BATCH)
      if (error) throw new GDriveError('db', error.message, 500)

      const result = { ok: true, migrated: 0, skipped: 0, errors: [] as { id: unknown; reason: string }[], remaining: 0 }
      if (!rows || rows.length === 0) return json(result)

      for (const row of rows) {
        try {
          const applicant = await loadApplicant({ id: row.applicant_id, email: row.student_email })
          if (!applicant) { result.skipped++; result.errors.push({ id: row.id, reason: 'no matching applicant' }); continue }

          const marker = String(row.file_url).includes(`/${STORAGE_BUCKET}/`)
            ? decodeURIComponent(String(row.file_url).split(`/${STORAGE_BUCKET}/`)[1] || '')
            : ''
          if (!marker) { result.skipped++; result.errors.push({ id: row.id, reason: 'file_url is not a Storage path' }); continue }

          const dl = await admin.storage.from(STORAGE_BUCKET).download(marker)
          if (dl.error || !dl.data) { result.skipped++; result.errors.push({ id: row.id, reason: 'Storage download failed' }); continue }

          const bytes = new Uint8Array(await dl.data.arrayBuffer())
          const guessedMime = dl.data.type && ALLOWED_MIME[dl.data.type]
            ? dl.data.type
            : ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
                 doc: 'application/msword',
                 docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as Record<string, string>)[
                   (marker.split('.').pop() || '').toLowerCase()
                 ] || 'application/octet-stream'

          const folderId = await ensureStudentFolder(applicant)
          const ext = ALLOWED_MIME[guessedMime] || (marker.split('.').pop() || 'bin').toLowerCase()
          const driveName = `${safeName(row.doc_type || 'Document', 90)}.${ext}`
          const uploaded = await driveUploadMultipart(folderId, driveName, guessedMime, bytes)

          const { error: upErr } = await admin.from('student_documents').update({
            storage_provider: 'google_drive',
            google_drive_file_id: uploaded.id,
            google_drive_folder_id: folderId,
            mime_type: guessedMime,
            file_size: uploaded.size,
            original_filename: marker.split('/').pop() || driveName,
            uploaded_at: row.updated_at || new Date().toISOString(),
            file_url: '',
            updated_at: new Date().toISOString(),
          }).eq('id', row.id)
          if (upErr) {
            // Row not updated → leave Storage intact, remove the stray Drive copy.
            await driveTrash(uploaded.id).catch(() => {})
            result.skipped++; result.errors.push({ id: row.id, reason: 'row update failed: ' + upErr.message })
            continue
          }

          await admin.storage.from(STORAGE_BUCKET).remove([marker]).catch(() => {})
          result.migrated++
        } catch (e) {
          result.skipped++
          result.errors.push({ id: row.id, reason: e instanceof Error ? e.message : String(e) })
        }
      }

      // More to do only if we filled a batch AND at least one row advanced
      // (otherwise we'd loop forever on permanently-failing rows).
      result.remaining = (rows.length === MIGRATE_BATCH && result.migrated > 0) ? 1 : 0
      return json(result)
    }

    return json({ ok: false, error: `Unknown action "${action}"` }, 400)
  } catch (err) {
    if (err instanceof GDriveError) {
      console.error('[google-drive]', err.kind, err.message, err.detail ?? '')
      return json({ ok: false, error: err.message, kind: err.kind }, err.status)
    }
    console.error('[google-drive] unexpected', err)
    return json({ ok: false, error: 'Server error' }, 500)
  }
})
