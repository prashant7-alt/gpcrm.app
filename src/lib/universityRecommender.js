// ─────────────────────────────────────────────────────────────────────────────
// universityRecommender
// A small, offline, rule-based matcher. It is NOT an admissions predictor —
// it filters a curated list against the student's extended profile
// (src/lib/studentProfileSchema.js) and explains each pick, plus what to fix.
//
// Dataset is intentionally short and hand-kept. `tuition` = rough international
// tuition, USD per year. `ielts` = typical overall requirement. `gpa` = rough
// minimum on a 4.0 scale. Verify specifics with the counsellor / uni website.
// ─────────────────────────────────────────────────────────────────────────────

// Field tags a course area maps to.
const FIELD_TAG = {
  'IT & Computer Science': 'it',
  'Engineering': 'eng',
  'Business & Management': 'biz',
  'Accounting & Finance': 'fin',
  'Health, Nursing & Medicine': 'health',
  'Science & Research': 'sci',
  'Arts, Design & Humanities': 'arts',
  'Law': 'law',
  'Education & Teaching': 'edu',
  'Agriculture & Environment': 'agri',
  'Hospitality & Tourism': 'hosp',
  'Trades & Vocational': 'trades',
}

const BUDGET_MAX = {
  'Under USD 10,000':      8000,
  'USD 10,000 – 20,000':   20000,
  'USD 20,000 – 30,000':   30000,
  'USD 30,000 – 40,000':   40000,
  'Above USD 40,000':      999999,
}

// ── Curated list ────────────────────────────────────────────────────────────
const UNIS = [
  // ─ Australia ─
  { name: 'University of Melbourne',        country: 'Australia', city: 'Melbourne',  tuition: 33000, ielts: 6.5, gpa: 3.0, tags: ['it','eng','biz','sci','arts','law','health'] },
  { name: 'Monash University',              country: 'Australia', city: 'Melbourne',  tuition: 32000, ielts: 6.5, gpa: 2.8, tags: ['it','eng','biz','fin','health','edu','sci'] },
  { name: 'RMIT University',                country: 'Australia', city: 'Melbourne',  tuition: 26000, ielts: 6.5, gpa: 2.5, tags: ['it','eng','biz','arts','trades','hosp'] },
  { name: 'Deakin University',              country: 'Australia', city: 'Geelong',    tuition: 24000, ielts: 6.0, gpa: 2.5, tags: ['it','biz','health','edu','sci'] },
  { name: 'University of Tasmania',         country: 'Australia', city: 'Hobart',     tuition: 21000, ielts: 6.0, gpa: 2.4, tags: ['agri','sci','health','biz','hosp'] },
  { name: 'Federation University',          country: 'Australia', city: 'Ballarat',   tuition: 18000, ielts: 6.0, gpa: 2.3, tags: ['it','biz','health','edu','trades'] },

  // ─ Canada ─
  { name: 'University of Toronto',          country: 'Canada', city: 'Toronto',    tuition: 45000, ielts: 6.5, gpa: 3.3, tags: ['it','eng','biz','sci','arts','health'] },
  { name: 'University of Waterloo',         country: 'Canada', city: 'Waterloo',   tuition: 42000, ielts: 6.5, gpa: 3.2, tags: ['it','eng','sci','fin'] },
  { name: 'University of Alberta',          country: 'Canada', city: 'Edmonton',   tuition: 30000, ielts: 6.5, gpa: 3.0, tags: ['eng','sci','agri','biz','health'] },
  { name: 'University of Manitoba',         country: 'Canada', city: 'Winnipeg',   tuition: 19000, ielts: 6.0, gpa: 2.7, tags: ['eng','agri','biz','health','edu'] },
  { name: 'University of Regina',           country: 'Canada', city: 'Regina',     tuition: 18000, ielts: 6.0, gpa: 2.5, tags: ['it','biz','eng','edu','arts'] },
  { name: 'Cape Breton University',         country: 'Canada', city: 'Sydney, NS',  tuition: 16000, ielts: 6.0, gpa: 2.4, tags: ['biz','it','hosp','health'] },
  { name: 'Conestoga College',             country: 'Canada', city: 'Kitchener',   tuition: 14000, ielts: 6.0, gpa: 2.3, tags: ['it','biz','trades','eng','health','hosp'] },

  // ─ UK ─
  { name: 'University of Manchester',       country: 'UK', city: 'Manchester',  tuition: 30000, ielts: 6.5, gpa: 3.0, tags: ['it','eng','biz','sci','arts','law'] },
  { name: 'University of Glasgow',          country: 'UK', city: 'Glasgow',     tuition: 27000, ielts: 6.5, gpa: 2.9, tags: ['it','eng','biz','law','sci','health'] },
  { name: 'University of Birmingham',       country: 'UK', city: 'Birmingham',  tuition: 26000, ielts: 6.5, gpa: 2.9, tags: ['eng','biz','fin','edu','sci'] },
  { name: 'Coventry University',            country: 'UK', city: 'Coventry',    tuition: 18000, ielts: 6.0, gpa: 2.5, tags: ['biz','it','eng','health','arts'] },
  { name: 'University of Hertfordshire',    country: 'UK', city: 'Hatfield',    tuition: 16000, ielts: 6.0, gpa: 2.4, tags: ['it','biz','eng','health','hosp'] },
  { name: 'Teesside University',            country: 'UK', city: 'Middlesbrough', tuition: 15000, ielts: 6.0, gpa: 2.3, tags: ['it','eng','biz','health','arts'] },

  // ─ USA ─
  { name: 'Arizona State University',       country: 'USA', city: 'Tempe',        tuition: 32000, ielts: 6.5, gpa: 3.0, tags: ['it','eng','biz','sci','arts'] },
  { name: 'University of Texas at Dallas',  country: 'USA', city: 'Dallas',       tuition: 30000, ielts: 6.5, gpa: 3.0, tags: ['it','eng','biz','fin','sci'] },
  { name: 'University of Cincinnati',       country: 'USA', city: 'Cincinnati',   tuition: 27000, ielts: 6.5, gpa: 2.8, tags: ['eng','biz','it','health','arts'] },
  { name: 'University of Central Missouri', country: 'USA', city: 'Warrensburg',  tuition: 15000, ielts: 6.0, gpa: 2.5, tags: ['it','biz','eng','edu','agri'] },
  { name: 'Wright State University',        country: 'USA', city: 'Dayton',       tuition: 18000, ielts: 6.0, gpa: 2.5, tags: ['it','eng','biz','health'] },

  // ─ Germany ─
  { name: 'Technical University of Munich', country: 'Germany', city: 'Munich',     tuition: 3500, ielts: 6.5, gpa: 3.2, tags: ['it','eng','sci','biz'] },
  { name: 'RWTH Aachen University',         country: 'Germany', city: 'Aachen',     tuition: 3000, ielts: 6.5, gpa: 3.0, tags: ['eng','it','sci'] },
  { name: 'University of Freiburg',         country: 'Germany', city: 'Freiburg',   tuition: 3500, ielts: 6.5, gpa: 2.9, tags: ['sci','arts','law','agri','health'] },
  { name: 'Schmalkalden Uni of Applied Sciences', country: 'Germany', city: 'Schmalkalden', tuition: 2500, ielts: 6.0, gpa: 2.5, tags: ['biz','it','eng','law'] },

  // ─ New Zealand ─
  { name: 'University of Auckland',         country: 'New Zealand', city: 'Auckland',     tuition: 30000, ielts: 6.5, gpa: 3.0, tags: ['it','eng','biz','health','sci','arts'] },
  { name: 'Massey University',              country: 'New Zealand', city: 'Palmerston N.', tuition: 24000, ielts: 6.0, gpa: 2.6, tags: ['agri','biz','it','sci','edu'] },
  { name: 'Lincoln University',             country: 'New Zealand', city: 'Christchurch', tuition: 23000, ielts: 6.0, gpa: 2.5, tags: ['agri','biz','sci','hosp'] },
  { name: 'Auckland Uni of Technology',     country: 'New Zealand', city: 'Auckland',     tuition: 25000, ielts: 6.0, gpa: 2.5, tags: ['it','biz','health','hosp','arts','eng'] },

  // ─ Ireland ─
  { name: 'University College Dublin',      country: 'Ireland', city: 'Dublin',   tuition: 26000, ielts: 6.5, gpa: 3.0, tags: ['it','eng','biz','agri','sci','health'] },
  { name: 'University of Limerick',         country: 'Ireland', city: 'Limerick',  tuition: 20000, ielts: 6.5, gpa: 2.7, tags: ['it','eng','biz','edu','health'] },
  { name: 'Dublin City University',         country: 'Ireland', city: 'Dublin',   tuition: 18000, ielts: 6.0, gpa: 2.6, tags: ['it','biz','eng','edu','arts'] },
  { name: 'Munster Technological Univ.',    country: 'Ireland', city: 'Cork',      tuition: 13000, ielts: 6.0, gpa: 2.4, tags: ['it','biz','eng','hosp','arts'] },

  // ─ Finland ─
  { name: 'University of Helsinki',         country: 'Finland', city: 'Helsinki',  tuition: 15000, ielts: 6.5, gpa: 3.0, tags: ['sci','it','arts','law','agri','edu'] },
  { name: 'LUT University',                 country: 'Finland', city: 'Lappeenranta', tuition: 13500, ielts: 6.0, gpa: 2.7, tags: ['eng','it','biz','sci'] },
  { name: 'Metropolia Uni of Applied Sci.', country: 'Finland', city: 'Helsinki',  tuition: 12000, ielts: 6.0, gpa: 2.5, tags: ['it','eng','biz','health'] },

  // ─ Japan ─
  { name: 'University of Tokyo',            country: 'Japan', city: 'Tokyo',       tuition: 5000, ielts: 6.5, gpa: 3.2, tags: ['eng','it','sci','biz','arts'] },
  { name: 'Kyushu University',              country: 'Japan', city: 'Fukuoka',     tuition: 5000, ielts: 6.0, gpa: 2.8, tags: ['eng','sci','agri','it'] },
  { name: 'Ritsumeikan Uni. (APU)',        country: 'Japan', city: 'Beppu',       tuition: 9000, ielts: 6.0, gpa: 2.6, tags: ['biz','hosp','it','arts'] },

  // ─ South Korea ─
  { name: 'Korea University',               country: 'South Korea', city: 'Seoul', tuition: 9000, ielts: 6.0, gpa: 2.9, tags: ['biz','it','eng','sci','arts'] },
  { name: 'Kyungpook National University',  country: 'South Korea', city: 'Daegu', tuition: 6000, ielts: 5.5, gpa: 2.5, tags: ['eng','it','sci','agri','biz'] },
  { name: 'Sejong University',              country: 'South Korea', city: 'Seoul', tuition: 7500, ielts: 5.5, gpa: 2.5, tags: ['hosp','biz','it','arts'] },
]

// ── helpers ────────────────────────────────────────────────────────────────
const csv = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean)

// Best-effort GPA on a 4.0 scale from a free-text grade field.
export function parseGpa4(grade) {
  if (!grade) return null
  const m = String(grade).match(/(\d+(\.\d+)?)/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (Number.isNaN(n)) return null
  if (n <= 4)   return n                 // already /4
  if (n <= 10)  return +(n * 0.4).toFixed(2)   // /10 CGPA
  if (n <= 100) return +(n / 25).toFixed(2)    // percentage
  return null
}

// Best-effort IELTS-equivalent overall band.
function parseIelts(profile) {
  const direct = String(profile.english_overall || '').match(/(\d+(\.\d+)?)/)
  if (direct) {
    const n = parseFloat(direct[1])
    if (n >= 3 && n <= 9) return n
    if (n > 9 && n <= 120) return +(4 + (n / 120) * 5).toFixed(1) // rough TOEFL→IELTS
  }
  return null
}

/**
 * @param {object} profile  a `profiles` row (extended fields)
 * @returns {{ ok:boolean, message?:string, picks:Array, notes:string[], meta:object }}
 */
export function recommendUniversities(profile = {}) {
  const countries = csv(profile.pref_countries)
  const fieldTag  = FIELD_TAG[profile.intended_field] || null
  const gpa4      = parseGpa4(profile.grade)
  const ielts     = parseIelts(profile)
  const budgetMax = BUDGET_MAX[profile.budget_per_year] ?? null

  const filledSignals = [countries.length, fieldTag, gpa4, ielts, budgetMax]
    .filter(Boolean).length
  if (filledSignals < 2) {
    return {
      ok: false,
      picks: [], notes: [], meta: {},
      message: "I need a bit more of your profile first. Open **My Profile → Study Preferences** and fill in at least your preferred countries, intended field, and grade — then ask me again.",
    }
  }

  const scored = UNIS.map(u => {
    let score = 1
    const reasons = []

    if (countries.length) {
      if (countries.includes(u.country)) { score += 4; reasons.push(`in ${u.country}`) }
      else return null // hard filter to chosen countries
    }
    if (fieldTag) {
      if (u.tags.includes(fieldTag)) { score += 3; reasons.push(`offers ${profile.intended_field}`) }
      else score -= 2
    }
    if (budgetMax != null) {
      if (u.tuition <= budgetMax) { score += 2; reasons.push(`tuition ~USD ${u.tuition.toLocaleString()}/yr fits your budget`) }
      else { score -= 3; reasons.push(`tuition ~USD ${u.tuition.toLocaleString()}/yr is above your budget band`) }
    }
    if (gpa4 != null) {
      if (gpa4 >= u.gpa) { score += 2; reasons.push(`your ${gpa4.toFixed(1)} GPA meets its bar`) }
      else { score -= 1; reasons.push(`GPA bar ~${u.gpa.toFixed(1)}/4 — slightly above yours`) }
    }
    if (ielts != null) {
      if (ielts >= u.ielts) { score += 2 }
      else { score -= 1; reasons.push(`wants IELTS ${u.ielts}+ (you have ${ielts})`) }
    }
    return { u, score, reasons }
  }).filter(Boolean)

  scored.sort((a, b) => b.score - a.score)
  const picks = scored.slice(0, 6).map(s => ({
    name: s.u.name, country: s.u.country, city: s.u.city,
    tuition: s.u.tuition, ielts: s.u.ielts,
    reasons: s.reasons.slice(0, 3),
  }))

  // ── advice notes ─────────────────────────────────────────────────────────
  const notes = []
  if (!countries.length)
    notes.push('You haven’t picked preferred countries — add them in My Profile for a tighter list.')
  if (ielts == null)
    notes.push('No English score on file yet. Book IELTS/PTE early — most of these need **6.0–6.5** overall.')
  else if (picks.some(p => ielts < p.ielts))
    notes.push(`Your IELTS ${ielts} is below what some picks want. A **one-skill retake** or a **pre-sessional English** course opens them up.`)
  if (gpa4 != null && gpa4 < 2.5)
    notes.push('A GPA under 2.5/4 is tight for direct entry — **diploma / pathway** routes (Australia, Canada, NZ) are a strong plan B.')
  if (budgetMax != null && budgetMax <= 8000)
    notes.push('On a sub-USD 10k budget, **Germany, Finland, Japan and South Korea** give the best value — public-university tuition is low there.')
  if (profile.funding_source === 'Education loan' || profile.loan_required === 'Yes')
    notes.push('Since you’ll use a loan, ask your counsellor about the **bank balance + sanction letter** timing — it drives your application date.')
  if ((profile.visa_refusal || '').startsWith('Yes'))
    notes.push('You noted a past visa refusal — we’ll need a clear written explanation in the SOP. Flag this with your counsellor now.')

  return {
    ok: true,
    picks, notes,
    meta: { countries, field: profile.intended_field || null, gpa4, ielts, budget: profile.budget_per_year || null },
  }
}

// Render a recommendation result as a chat-bubble markdown string.
export function formatRecommendation(result, firstName = 'there') {
  if (!result.ok) return result.message

  const { picks, notes, meta } = result
  const head = []
  const bits = []
  if (meta.field) bits.push(meta.field)
  if (meta.countries?.length) bits.push(meta.countries.join(', '))
  if (meta.gpa4 != null) bits.push(`GPA ~${meta.gpa4.toFixed(1)}/4`)
  if (meta.ielts != null) bits.push(`IELTS ${meta.ielts}`)
  head.push(`Here's a starting shortlist from your profile${bits.length ? ` (${bits.join(' · ')})` : ''} 👇`)
  head.push('')

  picks.forEach((p, i) => {
    head.push(`**${i + 1}. ${p.name}** — ${p.city}, ${p.country}`)
    head.push(`   Tuition ~USD ${p.tuition.toLocaleString()}/yr · IELTS ${p.ielts}+`)
    if (p.reasons.length) head.push(`   Why: ${p.reasons.join('; ')}`)
    head.push('')
  })

  if (notes.length) {
    head.push('**Before you apply:**')
    notes.forEach(n => head.push(`• ${n}`))
    head.push('')
  }

  head.push('Note: an automated starting point, not an admission guarantee — your counsellor refines it for your exact file.')
  return head.join('\n')
}
