import { supabase } from './supabase'

// Keep this order in sync with the STAGES array in StudentVisaStatus.jsx
// and Applications.jsx.
const PIPELINE_ORDER = [
  'New', 'Inquiring', 'Counseling', 'Documentation',
  'Applied', 'Visa Process', 'Class/Enrolled', 'Abroad',
]

// Statuses the auto-engine must NEVER touch these are either fully
// staff-controlled (Applied and beyond) or legacy/manual-only statuses.
const MANUAL_ONLY = [
  'Applied', 'Visa Process', 'Class/Enrolled', 'Abroad',
  'Pending', 'Approved', 'Rejected',
]

function rank(status) {
  const i = PIPELINE_ORDER.indexOf(status)
  return i === -1 ? -1 : i
}

export async function recomputeApplicantStatus(applicantId) {
  if (!applicantId) return null

  const { data: applicant, error: appErr } = await supabase
    .from('applicants')
    .select('id, email, status')
    .eq('id', applicantId)
    .maybeSingle()

  if (appErr || !applicant) {
    console.error('[statusEngine] could not load applicant', appErr)
    return null
  }

  if (MANUAL_ONLY.includes(applicant.status)) {
    return applicant.status
  }

  let hasCompletedAppointment = false
  let hasCompletedCounseling  = false

  if (applicant.email) {
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('type, status')
      .ilike('student_email', applicant.email.trim())

    if (apptErr) {
      console.error('[statusEngine] appointments lookup failed', apptErr)
    } else if (appts) {
      hasCompletedAppointment = appts.some(a => a.status?.toLowerCase() === 'completed')
      hasCompletedCounseling  = appts.some(a =>
        a.status?.toLowerCase() === 'completed' && a.type === 'Counseling Session'
      )
    }
  }

  let allDocsVerified = false
  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select('status')
    .eq('applicant_id', applicant.id)

  if (docErr) {
    console.error('[statusEngine] documents lookup failed', docErr)
  } else if (docs && docs.length > 0) {
    allDocsVerified = docs.every(d => d.status === 'Verified')
  }

  let target = 'New'
  if (allDocsVerified)               target = 'Documentation'
  else if (hasCompletedCounseling)   target = 'Counseling'
  else if (hasCompletedAppointment)  target = 'Inquiring'

  if (rank(target) > rank(applicant.status)) {
    const { error: updErr } = await supabase
      .from('applicants')
      .update({ status: target })
      .eq('id', applicant.id)

    if (updErr) {
      console.error('[statusEngine] failed to update status', updErr)
      return applicant.status
    }
    return target
  }

  return applicant.status
}

export async function recomputeApplicantStatusByEmail(email) {
  if (!email) return null
  const { data: applicant, error } = await supabase
    .from('applicants')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle()

  if (error || !applicant) return null
  return recomputeApplicantStatus(applicant.id)
}
