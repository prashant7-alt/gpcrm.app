// Shared pipeline-stage helper.
// Adjust the import path in Appointments.jsx / Documents.jsx to wherever
// you place this file (e.g. `../lib/pipelineStages`).

// Must match STAGES keys in the student-facing VisaStatus page exactly.
export const STAGE_ORDER = [
  'New',
  'Inquiring',
  'Counseling',
  'Documentation',
  'Applied',
  'Visa Process',
  'Class/Enrolled',
  'Abroad',
]

/**
 * Advances an applicant's `status` to `targetStage`, but only if that
 * moves them FORWARD in the pipeline. Never regresses a stage an admin
 * already set manually (e.g. won't push someone back from "Applied" to
 * "Counseling" just because a counseling appointment got marked complete
 * late).
 *
 * Matches the applicant by `applicantId` if given, otherwise by email
 * (case-insensitive), otherwise by name (case-insensitive). Because
 * `appointments` and `student_documents` only store loose text
 * name/email — not a real foreign key — this matching is best-effort.
 * If you can add an `applicant_id` column to those tables later, pass
 * it as `applicantId` for a reliable match instead.
 */
export async function advanceApplicantStage(supabase, { applicantId, email, name }, targetStage) {
  if (!STAGE_ORDER.includes(targetStage)) {
    console.warn('[advanceApplicantStage] unknown stage:', targetStage)
    return
  }

  let applicant = null

  if (applicantId) {
    const { data } = await supabase
      .from('applicants')
      .select('id, status')
      .eq('id', applicantId)
      .maybeSingle()
    applicant = data
  }

  if (!applicant && email) {
    const { data } = await supabase
      .from('applicants')
      .select('id, status')
      .ilike('email', email.trim())
      .maybeSingle()
    applicant = data
  }

  if (!applicant && name) {
    const { data } = await supabase
      .from('applicants')
      .select('id, status')
      .ilike('name', name.trim())
      .maybeSingle()
    applicant = data
  }

  if (!applicant) {
    console.warn('[advanceApplicantStage] no matching applicant for', { applicantId, email, name })
    return
  }

  const currentIdx = STAGE_ORDER.indexOf(applicant.status)
  const targetIdx  = STAGE_ORDER.indexOf(targetStage)

  // Only move forward. If current status isn't recognized (-1), allow it
  // through rather than silently doing nothing.
  if (currentIdx !== -1 && targetIdx <= currentIdx) return

  const { error } = await supabase
    .from('applicants')
    .update({ status: targetStage })
    .eq('id', applicant.id)

  if (error) {
    console.error('[advanceApplicantStage] update failed:', error)
  }
}