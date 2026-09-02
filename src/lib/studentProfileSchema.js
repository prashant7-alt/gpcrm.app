// ─────────────────────────────────────────────────────────────────────────────
// studentProfileSchema
// Single source of truth for the student's extended (consultancy) profile.
//
// Consumed by:
//   • src/pages/student/StudentProfile.jsx   — renders the editable form
//   • src/components/StudentDetailModal.jsx   — renders it read-only for staff
//   • src/lib/universityRecommender.js        — reads keys for recommendations
//
// Every column here also exists on `public.profiles` — see
// `supabase sql code/student-profile-extended.sql`.
//
// Field types:  'text' | 'select' | 'multiselect' (stored comma-joined) | 'date'
// ─────────────────────────────────────────────────────────────────────────────
import { GraduationCap, Compass, Wallet, Briefcase, FileCheck } from 'lucide-react'

export const STUDY_COUNTRIES = [
  'Australia', 'Canada', 'UK', 'USA', 'Germany',
  'New Zealand', 'Ireland', 'Finland', 'Japan', 'South Korea',
]

export const PROFILE_SECTIONS = [
  {
    id: 'academic',
    title: 'Academic Background',
    Icon: GraduationCap,
    subtitle: 'Your past studies and grades',
    fields: [
      { key: 'education_level', label: 'Highest Qualification', type: 'select', options: [
        'SEE / SLC', '+2 / A-Levels / High School',
        "Bachelor's (ongoing)", "Bachelor's (completed)", "Master's", 'Other',
      ] },
      { key: 'grade', label: 'Grade / GPA', type: 'text', placeholder: 'e.g. 3.6 / 4.0 or 78%' },
      { key: 'institution', label: 'School / College', type: 'text', placeholder: 'Last institution attended' },
      { key: 'field_of_study', label: 'What You Studied', type: 'text', placeholder: 'e.g. Science, Management' },
    ],
  },
  {
    id: 'study_prefs',
    title: 'Study Preferences',
    Icon: Compass,
    subtitle: 'Where and what you want to study',
    fields: [
      { key: 'pref_countries', label: 'Preferred Countries', type: 'multiselect', options: STUDY_COUNTRIES },
      { key: 'study_level', label: 'Study Level', type: 'select', options: [
        'Foundation / Pathway', 'Diploma / Certificate', "Bachelor's",
        "Master's / Postgraduate", 'PhD / Research', 'Not sure yet',
      ] },
      { key: 'intended_field', label: 'Intended Field', type: 'select', options: [
        'IT & Computer Science', 'Engineering', 'Business & Management',
        'Accounting & Finance', 'Health, Nursing & Medicine', 'Science & Research',
        'Arts, Design & Humanities', 'Law', 'Education & Teaching',
        'Agriculture & Environment', 'Hospitality & Tourism', 'Trades & Vocational',
        'Other / Undecided',
      ] },
      { key: 'preferred_intake', label: 'Preferred Intake', type: 'select', options: [
        'As soon as possible', 'Fall 2026', 'Spring 2026',
        'Fall 2027', 'Spring 2027', 'Flexible',
      ] },
      { key: 'budget_per_year', label: 'Budget / Year (tuition + living)', type: 'select', options: [
        'Under USD 10,000', 'USD 10,000 – 20,000', 'USD 20,000 – 30,000',
        'USD 30,000 – 40,000', 'Above USD 40,000',
      ] },
      { key: 'location_pref', label: 'Location Preference', type: 'select', options: [
        'No preference', 'Major city', 'Smaller city / town', 'Low cost-of-living area',
      ] },
      { key: 'accommodation_help', label: 'Need Accommodation Help?', type: 'select', options: [
        'Yes, need help', 'No, will arrange myself', 'Not sure',
      ] },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & Sponsorship',
    Icon: Wallet,
    subtitle: 'How your studies will be funded',
    fields: [
      { key: 'funding_source', label: 'Main Funding Source', type: 'select', options: [
        'Self / Family savings', 'Education loan', 'Scholarship / Grant',
        'Sponsor (relative)', 'Mix of the above',
      ] },
      { key: 'sponsor_relation', label: 'Sponsor Relationship', type: 'select', options: [
        'Self', 'Parent', 'Sibling', 'Spouse', 'Relative', 'Other',
      ] },
      { key: 'sponsor_occupation', label: 'Sponsor Occupation', type: 'text', placeholder: 'e.g. Business, Govt. service' },
      { key: 'bank_balance_ready', label: 'Bank Balance Ready?', type: 'select', options: [
        'Yes, full amount ready', 'Partially ready', 'Not yet', 'Need guidance',
      ] },
      { key: 'loan_required', label: 'Education Loan Needed?', type: 'select', options: [
        'No', 'Yes', 'Maybe / exploring',
      ] },
    ],
  },
  {
    id: 'work',
    title: 'Work Experience & Gaps',
    Icon: Briefcase,
    subtitle: 'Employment history and any study gap',
    fields: [
      { key: 'work_experience', label: 'Work Experience', type: 'select', options: [
        'None', 'Less than 1 year', '1 – 2 years', '3 – 5 years', 'More than 5 years',
      ] },
      { key: 'job_title', label: 'Current / Last Job Title', type: 'text', placeholder: 'e.g. Account Assistant' },
      { key: 'job_sector', label: 'Job Sector', type: 'text', placeholder: 'e.g. Banking, Hospitality, IT' },
      { key: 'study_gap', label: 'Study Gap', type: 'select', options: [
        'No gap', 'Less than 1 year', '1 – 2 years', 'More than 2 years',
      ] },
      { key: 'gap_reason', label: 'Reason for Gap', type: 'text', placeholder: 'Only if you have a gap' },
      { key: 'visa_refusal', label: 'Any Past Visa Refusal?', type: 'select', options: [
        'No, never', 'Yes, once', 'Yes, more than once',
      ] },
      { key: 'visa_refusal_detail', label: 'Refusal Details', type: 'text', placeholder: 'Country, year, reason' },
    ],
  },
  {
    id: 'tests_passport',
    title: 'Test Scores & Passport',
    Icon: FileCheck,
    subtitle: 'English test, other exams and travel document',
    fields: [
      { key: 'english_test', label: 'English Test', type: 'select', options: [
        'Not taken yet', 'IELTS', 'IELTS (booked)', 'PTE Academic',
        'TOEFL iBT', 'Duolingo English Test', 'MOI / Waiver',
      ] },
      { key: 'english_overall', label: 'Overall Score', type: 'text', placeholder: 'e.g. 6.5' },
      { key: 'english_sections', label: 'Section Scores (L / R / W / S)', type: 'text', placeholder: 'e.g. 6.5 / 6.0 / 6.0 / 6.5' },
      { key: 'other_test', label: 'Other Test (GRE / GMAT / SAT)', type: 'text', placeholder: 'e.g. GRE 315' },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'passport_number', label: 'Passport Number', type: 'text', placeholder: 'If you have one' },
      { key: 'passport_expiry', label: 'Passport Expiry', type: 'date' },
      { key: 'travel_history', label: 'International Travel', type: 'select', options: [
        'Never travelled abroad', 'Yes — a few countries', 'Yes — extensively',
      ] },
    ],
  },
]

// Flat list of every extended-profile column, for the DB update payload.
export const PROFILE_FIELD_KEYS = PROFILE_SECTIONS.flatMap(s => s.fields.map(f => f.key))

// Build a blank form object keyed by every field.
export const blankProfileForm = () =>
  Object.fromEntries(PROFILE_FIELD_KEYS.map(k => [k, '']))

// Pull the current values off a loaded profile row into a form object.
export const profileToForm = (row) =>
  Object.fromEntries(PROFILE_FIELD_KEYS.map(k => [k, row?.[k] ?? '']))

// A form object → a Supabase update payload (empty string → null).
export const formToPatch = (form) =>
  Object.fromEntries(PROFILE_FIELD_KEYS.map(k => {
    const v = typeof form[k] === 'string' ? form[k].trim() : form[k]
    return [k, v || null]
  }))
