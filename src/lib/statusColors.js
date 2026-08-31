// ── Status colours — single source of truth ─────────────────────────────
// Every status pill / badge in the app should get its colours from here so
// "paid" is the same green everywhere, "pending" the same amber, and so on.
//
//   statusChip(value)  ->  { bg, color, border, label, tone }
//
// `tone` is one of: success | warning | danger | info | neutral
// and maps to the semantic palette in src/theme.js.

import { status as S } from '../theme'

const chip = (tone, label) => ({
  tone,
  bg:     S[tone].bg,
  color:  S[tone].text,
  border: S[tone].border,
  label,
})

// Normalise: lower-case, spaces/dashes -> underscore
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')

// One flat map covering payments, appointments, applications, tasks, docs.
// Keys are the normalised status values.
const MAP = {
  // ── positive / done ──────────────────────────────────────
  paid:                 chip('success', 'Paid'),
  completed:            chip('success', 'Completed'),
  approved:             chip('success', 'Approved'),
  success:              chip('success', 'Success'),
  successful:           chip('success', 'Successful'),
  verified:             chip('success', 'Verified'),
  active:               chip('success', 'Active'),
  abroad:               chip('success', 'Abroad'),
  enrolled:             chip('success', 'Enrolled'),
  'class/enrolled':     chip('success', 'Class / Enrolled'),

  // ── waiting on someone ───────────────────────────────────
  pending:              chip('warning', 'Pending'),
  awaiting:             chip('warning', 'Awaiting'),
  processing:           chip('warning', 'Processing'),
  in_progress:          chip('warning', 'In Progress'),
  submitted:            chip('warning', 'Submitted'),

  // ── in review / neutral-active ───────────────────────────
  confirmed:            chip('info', 'Confirmed'),
  scheduled:            chip('info', 'Scheduled'),
  pending_verification: chip('info', 'Pending Verification'),
  under_review:         chip('info', 'Under Review'),
  in_review:            chip('info', 'In Review'),
  new:                  chip('info', 'New'),
  inquiring:            chip('info', 'Inquiring'),
  counseling:           chip('info', 'Counseling'),
  counselling:          chip('info', 'Counselling'),
  documentation:        chip('info', 'Documentation'),
  applied:              chip('info', 'Applied'),
  visa_process:         chip('info', 'Visa Process'),

  // ── failed / negative ────────────────────────────────────
  failed:               chip('danger', 'Failed'),
  rejected:             chip('danger', 'Rejected'),
  declined:             chip('danger', 'Declined'),
  cancelled:            chip('danger', 'Cancelled'),
  canceled:             chip('danger', 'Cancelled'),
  overdue:              chip('danger', 'Overdue'),
  expired:              chip('danger', 'Expired'),
  error:                chip('danger', 'Error'),

  // ── inactive / unknown ───────────────────────────────────
  draft:                chip('neutral', 'Draft'),
  inactive:             chip('neutral', 'Inactive'),
  archived:             chip('neutral', 'Archived'),
  none:                 chip('neutral', '—'),
}

const titleCase = (v) =>
  String(v || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()

/**
 * Colours + label for a status value.
 * @param {string} value  raw status from the DB (e.g. "pending_verification")
 * @param {string} [fallbackLabel]  label to show if the value is unknown
 */
export function statusChip(value, fallbackLabel) {
  const hit = MAP[norm(value)]
  if (hit) return hit
  return {
    tone: 'neutral',
    bg:     S.neutral.bg,
    color:  S.neutral.text,
    border: S.neutral.border,
    label:  fallbackLabel || titleCase(value) || '—',
  }
}

/** Just the tone name (success | warning | danger | info | neutral). */
export const statusTone = (value) => statusChip(value).tone

export default statusChip
