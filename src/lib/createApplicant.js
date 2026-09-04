import { supabase, functionHeaders } from '../supabase'
import { sendWelcomeEmail } from '../emailService'
import { ensureStudentFolder } from './googleDrive'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'

/**
 * Create an applicant record AND a student login in one step.
 *
 * Shared by the Applications page ("Add Applicant") and the Visitors page
 * ("Convert to Applicant"). Mirrors the original inline flow in Applications.jsx:
 *   1. one email → one account (check applicants + profiles first)
 *   2. insert the applicant row
 *   3. call create-staff-user; roll the applicant row back if it fails
 *   4. link profiles.applicant_id
 *   5. kick off the Drive folder + welcome email in the background (both are
 *      non-fatal / self-healing, so the caller doesn't wait on two external
 *      APIs before seeing "done")
 *
 * Returns:
 *   { ok: true,  applicant, warning? }   // warning = non-fatal (profile link only)
 *   { ok: false, message }               // caller shows this in an alert
 */
export async function createApplicantWithLogin({ name, email, password, phone, course, country }) {
  const nameNorm  = (name  || '').trim()
  const emailNorm = (email || '').trim().toLowerCase()

  if (!nameNorm)  return { ok: false, message: 'Name is required' }
  if (!emailNorm) return { ok: false, message: 'Email is required so the student can log in' }
  if (!password || password.length < 8) return { ok: false, message: 'Password must be at least 8 characters' }

  // 1. One email → one account. Check both tables before creating anything so a
  // duplicate never leaves an orphan applicant row behind. (A DB unique index on
  // lower(email) — one-account-per-email.sql — is the hard backstop.)
  const [{ data: dupApplicant }, { data: dupProfile }] = await Promise.all([
    supabase.from('applicants').select('id, name').ilike('email', emailNorm).maybeSingle(),
    supabase.from('profiles').select('id, name, role').ilike('email', emailNorm).maybeSingle(),
  ])
  if (dupApplicant || dupProfile) {
    const who    = dupApplicant?.name || dupProfile?.name || 'someone'
    const asRole = dupProfile?.role ? ` (${dupProfile.role} account)` : ''
    return { ok: false, message: `"${emailNorm}" is already registered to ${who}${asRole}.\n\nOne email can only have one account. Use a different email, or delete the existing record first.` }
  }

  // 2. Insert the applicant. (No upfront refreshSession() call here —
  // functionHeaders() already checks the token's expiry and refreshes only
  // when it's actually within 2.5 min of expiring, right before the
  // create-staff-user call below. An unconditional refresh on every submit
  // was a wasted network round-trip in the common case.)
  const { data: newApplicant, error: appError } = await supabase
    .from('applicants')
    .insert({
      name:    nameNorm,
      email:   emailNorm,
      phone:   (phone  || '').trim() || null,
      course:  (course || '').trim() || null,
      country: country || null,
      status:  'New',
    })
    .select()
    .single()

  if (appError) {
    const dup = appError.code === '23505' || /duplicate key|unique/i.test(appError.message || '')
    return { ok: false, message: dup
      ? `"${emailNorm}" is already registered. One email can only have one account.`
      : 'Error saving applicant: ' + appError.message }
  }

  // 4. Create the login.
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-staff-user`, {
      method:  'POST',
      headers: await functionHeaders(),
      body: JSON.stringify({ email: emailNorm, password, name: nameNorm, role: 'student' }),
    })
    const result = await res.json()

    if (!result.success) {
      // Roll the applicant row back — an applicant with no login is exactly the
      // orphan state we're avoiding. Common cause: email already registered.
      await supabase.from('applicants').delete().eq('id', newApplicant.id)
      const taken   = /already been registered|already registered|duplicate|exists/i.test(result.message || '')
      const expired = /invalid or expired session|missing authorization|jwt/i.test(result.message || '') || res.status === 401
      return { ok: false, message: taken
        ? `"${emailNorm}" already has an account. One email can only have one account — nothing was created.`
        : expired
        ? `Your session has expired — nothing was saved.\n\nSign out, sign back in, and try again.`
        : `Login creation failed: ${result.message}\n\nThe applicant was not saved. Please try again.` }
    }

    const { error: linkError } = await supabase
      .from('profiles')
      .update({ applicant_id: newApplicant.id })
      .eq('id', result.user_id)

    let warning
    if (linkError) {
      warning =
        `Login was created but linking it to the applicant record failed:\n${linkError.message}\n\n` +
        `This student may show "No application found" until this is fixed. Check that the RLS ` +
        `policy on "profiles" allows updating applicant_id for the signed-in admin/staff user.`
    }

    // Kick off the Drive folder + welcome email without waiting on them — both
    // are non-fatal by design (the folder is also created lazily on the first
    // document upload; a failed email doesn't affect the login) so there's no
    // reason to make the admin sit through two external API calls (Google
    // Drive, EmailJS) that don't change whether this call succeeded.
    ensureStudentFolder(newApplicant.id).catch(driveErr => {
      console.error('[createApplicant] Google Drive folder setup failed (will retry on first upload):', driveErr)
    })
    sendWelcomeEmail({
      student_name:     nameNorm,
      student_email:    emailNorm,
      student_password: password,
    }).then(res => {
      if (!res.success) console.warn('[createApplicant] Welcome email failed:', res.error)
    })

    return { ok: true, applicant: newApplicant, warning }
  } catch (err) {
    return { ok: false, message: 'Network error creating login: ' + err.message }
  }
}
