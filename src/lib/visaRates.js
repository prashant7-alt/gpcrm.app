import { supabase } from '../supabase'

// Destination list + flag codes, shared by the staff Students page and the
// admin "Visa Rates" settings screen so the two never drift apart.
export const COUNTRIES = ['Korea', 'Australia', 'Japan', 'UK', 'USA', 'Canada', 'Finland']

// ISO 3166-1 alpha-2 codes for flagcdn.com — real flag images instead of emoji
// (flag emoji render as plain letters on Windows/Chrome).
export const COUNTRY_CODES = {
  Korea: 'kr',
  Australia: 'au',
  Japan: 'jp',
  UK: 'gb',
  USA: 'us',
  Canada: 'ca',
  Finland: 'fi',
}

// Fallback student-visa success rates (%) — Nepali applicants, latest published
// data (2025 – early 2026). These are used for the first render and whenever the
// `visa_rates` table is empty or unreachable; admins override them from Settings
// → Visa Rates, which writes to that table.
export const DEFAULT_VISA_RATES = {
  Korea: 85,      // no official country data; ~85% for well-documented applicants
  Australia: 40,  // Mar 2026 grant rate ~42% post Level-3 reclassification
  Japan: 88,      // ~85–90% via Certificate of Eligibility for genuine students
  UK: 95,         // ~4.75% overall refusal; Nepal not in the high-refusal group
  USA: 19,        // Nepal F-1 refusal rate ~81% in FY2025
  Canada: 57,     // Nepal study-permit approval ~57% (Jan–Aug 2025)
  Finland: 88,    // ~91% overall student-permit approval in 2025
}

// Live rates = DB overrides merged over the defaults. Never throws — on any
// error (table missing, offline, RLS) the caller just gets the defaults.
export async function fetchVisaRates() {
  try {
    const { data, error } = await supabase.from('visa_rates').select('country, rate')
    if (error || !data) return { ...DEFAULT_VISA_RATES }
    const merged = { ...DEFAULT_VISA_RATES }
    for (const row of data) {
      const n = Number(row.rate)
      if (row.country && Number.isFinite(n)) merged[row.country] = n
    }
    return merged
  } catch {
    return { ...DEFAULT_VISA_RATES }
  }
}
