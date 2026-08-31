import { useState, useEffect, useRef } from 'react'
import theme from '../../theme'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Receipt, CheckCircle2, Hourglass, Bot, X, Send, MessageSquare, BookOpen } from 'lucide-react'
import AnnouncementsPanel from '../../components/AnnouncementsPanel'
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus'

// ── KNOWLEDGE BASE ─────────────────────────────────────────────────────────
// Every intent has: id, topic (for the "Browse topics" menu), q (the canonical
// question shown in that menu), keywords, answer, follow-up suggestions.
const INTENTS = [

  // ═══ GETTING STARTED ═══════════════════════════════════════════════════
  {
    id: 'start_here', topic: 'Getting started', q: 'How do I start the whole process?',
    keywords: ['how do i start', 'where do i begin', 'first step', 'get started', 'begin process',
               'what to do first', 'how to apply abroad', 'start studying abroad', 'guide me'],
    answer: `Here's the full journey, start to finish 👇\n\n1. 🎯 **Counselling** — pick country, course & budget with your counsellor\n2. 🌐 **English test** — book IELTS/PTE (or check if you qualify for a waiver)\n3. 📂 **Documents** — collect academics, passport, financials\n4. 📝 **Apply** — SOP + application to 2–4 universities\n5. 📧 **Offer letter** — accept one, pay the tuition deposit\n6. 🎫 **CAS / CoE / I-20** — the university issues your visa sponsorship document\n7. 🛂 **Visa** — biometrics, medical, financial proof, submit\n8. ✈️ **Pre-departure** — flights, forex, accommodation, packing\n\n⏰ Whole process: **6–9 months**. Start now for the next intake!`,
    suggestions: ['What are the intakes and deadlines?', 'What documents do I need?', 'Which country should I choose?'],
  },
  {
    id: 'intakes', topic: 'Getting started', q: 'What are the intakes and deadlines?',
    keywords: ['intake', 'intakes', 'september intake', 'january intake', 'fall intake', 'spring intake',
               'when apply', 'deadline', 'admission deadline', 'may intake', 'february intake', 'which intake'],
    answer: `Most countries have 2–3 intakes a year:\n\n📅 **Fall / Autumn (Sept–Oct)** — the MAIN intake, most courses & scholarships, most seats\n📅 **Winter / Spring (Jan–Feb)** — good secondary option, fewer courses\n📅 **Summer (May)** — limited, mainly Australia & some US colleges\n\n**Apply this early (before the intake month):**\n• 🇬🇧 UK — 4–6 months\n• 🇦🇺 Australia — 4–6 months\n• 🇨🇦 Canada — **6–8 months** (visa is slow!)\n• 🇺🇸 USA — 8–12 months (Fall deadlines are Dec–Feb)\n• 🇩🇪 Germany — 6–9 months\n\n💡 Missed a deadline? Target the next intake rather than rushing a weak file.`,
    suggestions: ['How long does the whole process take?', 'How do I start the process?', 'What documents do I need?'],
  },
  {
    id: 'country_choice', topic: 'Getting started', q: 'Which country should I choose?',
    keywords: ['which country', 'best country', 'uk vs australia', 'canada vs australia', 'usa vs canada',
               'where to go', 'country choice', 'which is better', 'compare countries', 'best destination'],
    answer: `How the top destinations compare:\n\n🇨🇦 **Canada** — Best for PR. Spouse gets an open work permit. Slow visa.\n🇦🇺 **Australia** — Best balance: high wages, strong PR paths, fast visa.\n🇬🇧 **UK** — Best for prestige & speed. 1-year masters, 2-year post-study work.\n🇩🇪 **Germany** — Best value: little/no tuition at public universities.\n🇳🇿 **New Zealand** — Safest & calmest, manageable costs, good post-study work.\n🇺🇸 **USA** — Best universities & research funding, but costly and no PR pathway from study.\n\n💡 Your counsellor matches this to YOUR course, budget, GPA and PR goal.`,
    suggestions: ['Which course gives the best PR?', 'How much does each country cost?', 'What IELTS score do I need?'],
  },
  {
    id: 'course_choice', topic: 'Getting started', q: 'How do I choose the right course?',
    keywords: ['which course', 'what course', 'choose course', 'course selection', 'best course',
               'what to study', 'which subject', 'course for pr', 'pr friendly course', 'in demand course'],
    answer: `Pick a course that fits **3 things**: your background, your budget, and your goal (job/PR).\n\n✅ **High-demand / PR-friendly fields:**\n• Nursing & Healthcare\n• IT, Data, Cybersecurity\n• Engineering (Civil, Mechanical, Electrical)\n• Accounting & Finance\n• Trades, Agriculture, Early Childhood Education (Australia/Canada)\n\n⚠️ **Watch out:** switching to a totally unrelated field can raise visa "genuine student" questions — be ready to explain it in your SOP.\n\n💡 A related course + clear career story = stronger application.`,
    suggestions: ['Which country is best for PR?', 'How do I explain a course change?', 'What are my visa chances?'],
  },
  {
    id: 'timeline', topic: 'Getting started', q: 'How long does the whole process take?',
    keywords: ['how long process', 'how long does it take', 'timeline', 'total time', 'process time',
               'how many months', 'step by step', 'when can i go', 'how soon'],
    answer: `Typical end-to-end timeline:\n\n📅 **Month 1–2:** Counselling, choose country & course, sit IELTS\n📅 **Month 2–3:** Collect documents, write SOP, apply to universities\n📅 **Month 3–4:** Receive offer letter, pay tuition deposit\n📅 **Month 4–5:** Get CAS / CoE / I-20, arrange finances\n📅 **Month 5–6:** Biometrics + medical, submit visa\n📅 **Month 6–8:** Visa decision\n📅 **Month 8–9:** Pre-departure briefing, book flights, travel ✈️\n\n⏰ **Total: usually 6–9 months** (Canada & USA closer to 9–12).`,
    suggestions: ['What are the intakes and deadlines?', 'How long does the visa take?', 'How do I start the process?'],
  },
  {
    id: 'consultancy_help', topic: 'Getting started', q: 'What does Global Pathway do for me?',
    keywords: ['what do you do', 'how do you help', 'consultancy help', 'gp help', 'your service',
               'what does global pathway do', 'agent help', 'why use consultancy'],
    answer: `Global Pathway supports you at every stage — for free (universities pay us):\n\n• 🎯 Career & country counselling\n• 🏫 University & course shortlisting to match your profile\n• 📝 SOP and application document review\n• 📄 Document checklist, verification & attestation guidance\n• 💰 Financial planning + education-loan guidance\n• 🎫 Handling offer letters, deposits and CAS/CoE\n• 🛂 Full visa file preparation & mock interview\n• ✈️ Pre-departure briefing (forex, accommodation, packing)\n\n💬 For anything specific to YOUR file, use **"Chat with Staff"** in the sidebar.`,
    suggestions: ['How do I start the process?', 'What documents do I need?', 'Talk to my counsellor'],
  },

  // ═══ TESTS (IELTS / GRE) ═══════════════════════════════════════════════
  {
    id: 'ielts_score', topic: 'English & tests', q: 'What IELTS score do I need?',
    keywords: ['ielts score', 'ielts band', 'ielts requirement', 'score required', 'what score',
               'band required', 'english score', 'minimum score', 'ielts needed', 'required band'],
    answer: `IELTS requirements by country (undergrad → postgrad):\n\n🇬🇧 **UK:** 6.0 → 6.5 overall (min 5.5–6.0 per band)\n🇦🇺 **Australia:** 6.0 → 6.5 overall\n🇨🇦 **Canada:** 6.0 → 6.5 overall\n🇺🇸 **USA:** 6.5 → 7.0 overall\n🇩🇪 **Germany:** 6.0 → 6.5 (English-taught programs)\n🇳🇿 **New Zealand:** 5.5 → 6.5 overall\n\n📌 Nursing, teaching & health courses often need **7.0**. Your counsellor finds universities that match your exact bands.`,
    suggestions: ['My IELTS is 5.5 — can I apply?', 'Can I apply without IELTS?', 'How do I prepare for IELTS?'],
  },
  {
    id: 'ielts_low', topic: 'English & tests', q: 'My IELTS is 5.5 — can I still apply?',
    keywords: ['5.5', '5.0', '6.0', 'low score', 'low ielts', 'my score is low', 'not enough', 'low band',
               'ielts is 5', 'score is 5', 'below 6', 'weak in ielts', 'failed ielts', 'poor english score',
               'band is low', 'less ielts', 'ielts low'],
    answer: `Yes — a 5.5 still opens plenty of doors 😊\n\n• ✅ **Diploma / foundation / pathway** programs\n• ✅ Universities with a **pre-sessional English** course (do 4–12 weeks before your main course)\n• ✅ Many colleges in **Australia, Canada, New Zealand**\n• ✅ **IELTS One Skill Retake** — re-sit only your weakest section\n\n⚠️ A 5.0 or a band below 5.0 is harder — pre-sessional or a retake is usually needed.`,
    suggestions: ['Can I apply without IELTS?', 'How do I prepare for IELTS?', 'What is a pathway program?'],
  },
  {
    id: 'no_ielts', topic: 'English & tests', q: 'Can I apply without IELTS?',
    keywords: ['without ielts', 'no ielts', 'skip ielts', 'alternative to ielts', 'pte', 'toefl',
               'duolingo', 'other english test', 'waive ielts', 'ielts waiver', 'moi', 'medium of instruction'],
    answer: `Often, yes!\n\n**Accepted alternatives:**\n• 📘 PTE Academic — fast results, widely accepted\n• 📗 TOEFL iBT\n• 📙 Duolingo English Test — cheapest (~USD 65), at-home\n• 📕 Cambridge C1 Advanced / LanguageCert\n\n**IELTS waiver options:**\n• 🏫 **MOI letter** — if your last degree was taught in English (accepted by many UK/Canada/Australia universities)\n• 🎓 Some universities accept **+2 English marks** above a threshold\n• 🗣️ A few run their own **online English interview**\n\n💡 The USA and most PR-track visas still prefer a real test score.`,
    suggestions: ['What IELTS score do I need?', 'How do I prepare for IELTS?', 'Which universities accept MOI?'],
  },
  {
    id: 'ielts_prep', topic: 'English & tests', q: 'How do I prepare for IELTS / how many retakes?',
    keywords: ['prepare', 'preparation', 'prep', 'prepare for ielts', 'ielts prep', 'ielts class',
               'ielts practice', 'retake', 'retake ielts', 'how many times', 'ielts again', 'improve ielts',
               'ielts tips', 'ielts study', 'one skill retake', 'reappear', 'give ielts again'],
    answer: `**Preparation:**\n• Give yourself **4–8 weeks** of focused practice\n• Do full **timed mock tests** weekly\n• Weakest skill for most Nepali students = **Writing** and **Speaking fluency**\n• Free resources: IELTS official practice, British Council prep, YouTube (IELTS Liz, E2)\n\n**Retakes:**\n• ♾️ No limit — you can re-sit as often as you want\n• 💸 Full test ≈ NPR 30,000+; **One Skill Retake** lets you redo just one section\n• Book the retake **1–2 weeks** apart so prep stays fresh\n\n💡 Computer-delivered IELTS gives results in **3–5 days** vs 13 for paper.`,
    suggestions: ['What IELTS score do I need?', 'Can I apply without IELTS?', 'My IELTS is 5.5 — can I apply?'],
  },
  {
    id: 'gre_gmat', topic: 'English & tests', q: 'Do I need GRE / GMAT / SAT?',
    keywords: ['gre', 'gmat', 'sat', 'aptitude test', 'need gre', 'gre required', 'gmat required',
               'do i need sat', 'graduate record exam', 'standardised test'],
    answer: `Depends on country & course:\n\n🇺🇸 **USA**\n• **GRE** — many MS programs (Engineering, CS, Sciences). Increasingly optional/waived — check each university.\n• **GMAT** — MBA & business masters (aim 600+)\n• **SAT** — undergraduate admission (aim 1200+)\n\n🇬🇧 🇦🇺 🇨🇦 **UK / Australia / Canada**\n• Usually **NOT required** — admission is on GPA + IELTS + SOP\n• Some top MBA programs want GMAT/GRE\n\n💡 A strong GRE can offset a lower GPA for US grad school and help with funding.`,
    suggestions: ['What IELTS score do I need?', 'Which country should I choose?', 'How do I get a scholarship?'],
  },

  // ═══ DOCUMENTS ════════════════════════════════════════════════════════
  {
    id: 'doc_list', topic: 'Documents', q: 'What documents do I need?',
    keywords: ['document', 'documents', 'what do i need', 'what should i prepare', 'required documents',
               'paperwork', 'checklist', 'files', 'certificate', 'what to bring', 'papers needed'],
    answer: `Your core document set:\n\n📋 **Personal**\n• Passport (valid 2+ years; renew now if it expires soon)\n• Citizenship / National ID\n• Passport-size photos (white background, 2–4)\n\n🎓 **Academic**\n• SEE/SLC marksheet & character certificate\n• +2 / A-Level marksheet, transcript & certificate\n• Bachelor's transcript, provisional & degree (if applicable)\n• Migration certificate\n\n🌐 **English**\n• IELTS/PTE/TOEFL score report (or MOI letter)\n\n💰 **Financial**\n• Bank statement (last 6 months) + balance certificate\n• Income source evidence / sponsor documents\n• Property valuation or tax papers (supports "ties to Nepal")\n\n📝 **Application**\n• SOP, CV, and 1–2 recommendation letters\n\n👉 Your counsellor gives you a personalised checklist for your exact course & country.`,
    suggestions: ['How do I get documents verified & translated?', 'How much bank balance do I need?', 'What goes in the SOP?'],
  },
  {
    id: 'doc_verify', topic: 'Documents', q: 'How do I get documents verified & translated?',
    keywords: ['verify documents', 'document verification', 'attestation', 'notarised', 'notarized',
               'translation', 'translate documents', 'eca', 'wes', 'attest', 'true copy', 'certified copy', 'authentication'],
    answer: `**Certified / true copies**\n• Get photocopies stamped by a **notary public** or your school/campus\n\n**Translation**\n• Any document not in English (e.g. old marksheets) needs an official English translation by a **registered translator**, then notarised\n\n**Attestation (for some countries)**\n• Nepal: **Ministry of Education** → **Ministry of Foreign Affairs** → destination country's embassy\n\n**Credential evaluation**\n• 🇨🇦 Canada Express Entry / some universities: **WES** or **ECA**\n• 🇺🇸 USA: **WES / ECE** course-by-course evaluation\n\n💡 Start early — attestation queues can take 1–3 weeks. Your counsellor tells you exactly which of these your file needs.`,
    suggestions: ['What documents do I need?', 'What is a police clearance certificate?', 'How long does the process take?'],
  },
  {
    id: 'sop', topic: 'Documents', q: 'What goes in a strong SOP?',
    keywords: ['sop', 'statement of purpose', 'personal statement', 'cover letter', 'motivation letter',
               'why study', 'essay', 'study plan', 'gte statement', 'write sop'],
    answer: `Your SOP / study plan is often what makes or breaks a visa. Cover:\n\n1. 🎓 **Background** — brief academic & work summary\n2. 💡 **Why this course** — how it builds on what you've done\n3. 🌍 **Why this country & university** — specific reasons (ranking, modules, faculty), not generic\n4. 💰 **How it's funded** — your/sponsor finances, clearly\n5. 🎯 **Career plan** — the exact role & sector you'll return to\n6. 🏠 **Ties to Nepal** — family, property, job offer, business — why you'll come back\n\n📏 500–1,000 words, honest, first-person, no copied templates. Global Pathway reviews and refines it with you.`,
    suggestions: ['What documents do I need?', 'What are my visa chances?', 'How do I explain a study gap?'],
  },
  {
    id: 'study_gap', topic: 'Documents', q: 'How do I explain a study gap / gap year?',
    keywords: ['study gap', 'gap year', 'education gap', 'gap after', 'years gap', 'explain gap',
               'long gap', 'break in study', 'passed out long ago', 'graduated years ago'],
    answer: `A gap is fine — it just needs a **clear, documented reason**.\n\n✅ **Acceptable & how to evidence it:**\n• 💼 Work experience → appointment & experience letters, salary slips\n• 🌐 Preparing for IELTS / entrance exams → test result dates\n• 👪 Family / health reasons → a short honest note (+ medical papers if relevant)\n• 🏢 Running a family business → registration & tax papers\n\n**Rough tolerance:** up to ~2 yrs (UG) / ~5 yrs (PG) is routine; longer gaps need stronger justification and are easier for Australia/Canada than the UK.\n\n💡 Address the gap directly in your SOP — don't hope it goes unnoticed.`,
    suggestions: ['What goes in the SOP?', 'Can I apply with low GPA or backlogs?', 'What are my visa chances?'],
  },
  {
    id: 'backlogs_gpa', topic: 'Documents', q: 'Can I apply with low GPA / backlogs?',
    keywords: ['low gpa', 'backlog', 'backlogs', 'failed subject', 'low marks', 'low percentage',
               'poor academics', 'weak gpa', 'low grade', 'second division', 'below average marks', 'many backlogs'],
    answer: `Yes — options exist for almost every profile.\n\n📊 **Rough guide (backlogs = failed-then-cleared papers):**\n• 🇬🇧 UK — up to ~10–15 backlogs OK for many universities\n• 🇦🇺 Australia — flexible; focus on genuine-student story\n• 🇨🇦 Canada — colleges are lenient; universities stricter\n\n**If your GPA is low:**\n• Apply to **colleges / pathway / diploma** programs, then upgrade\n• Use a strong **SOP + work experience + good IELTS** to offset it\n• Some places accept a higher GRE/PTE to compensate\n\n💡 Send your real transcript to your counsellor — they'll shortlist universities that will actually accept it.`,
    suggestions: ['How do I explain a study gap?', 'Which country is easiest for admission?', 'What goes in the SOP?'],
  },
  {
    id: 'police_clearance', topic: 'Documents', q: 'What is a police clearance certificate?',
    keywords: ['police clearance', 'pcc', 'police report', 'character certificate police',
               'criminal record check', 'police verification', 'no criminal record'],
    answer: `A **Police Clearance Certificate (PCC)** confirms you have no criminal record. Some student visas need it.\n\n**Needed for:** 🇦🇺 Australia (often), 🇨🇦 Canada (usually), 🇳🇿 New Zealand, sometimes 🇬🇧 UK.\n\n**In Nepal — get it from:**\n• **Nepal Police, Central Police HQ (Naxal)** or through the **District Police Office**, then attested by MOFA\n• Bring: passport, citizenship, photos, application fee\n• Takes **a few days to 2 weeks**\n\n💡 If you've lived abroad 12+ months recently, you may also need a PCC from that country.`,
    suggestions: ['How do I get documents verified?', 'What documents do I need?', 'How long is the visa process?'],
  },

  // ═══ FINANCES ═════════════════════════════════════════════════════════
  {
    id: 'total_cost', topic: 'Money & funding', q: 'How much does studying abroad cost?',
    keywords: ['cost', 'how much', 'total cost', 'fees', 'expensive', 'budget', 'cheap', 'afford',
               'price', 'tuition', 'living cost', 'cost of study', 'how much money total'],
    answer: `Approx. total per year (tuition + living):\n\n🇩🇪 **Germany:** EUR 11,000–16,000 (~NPR 16–23 lakh) ✅ cheapest — public unis have little/no tuition\n🇨🇦 **Canada:** CAD 25,000–40,000 (~NPR 25–41 lakh)\n🇦🇺 **Australia:** AUD 30,000–48,000 (~NPR 26–43 lakh)\n🇳🇿 **New Zealand:** NZD 28,000–42,000\n🇬🇧 **UK:** GBP 20,000–33,000 (~NPR 34–56 lakh)\n🇺🇸 **USA:** USD 30,000–65,000 (most expensive)\n\n💡 Regional cities cut living costs 25–40%. Part-time work covers much of your living expenses in most countries.`,
    suggestions: ['How much bank balance do I need?', 'How do I get an education loan?', 'How do I get a scholarship?'],
  },
  {
    id: 'bank_balance', topic: 'Money & funding', q: 'How much bank balance do I need to show?',
    keywords: ['bank balance', 'bank statement', 'how much money', 'financial proof', 'funds required',
               'savings', 'how much do i need', 'money show', 'show money', 'proof of funds', 'financial requirement'],
    answer: `Show **1 year tuition + 1 year living costs** (roughly):\n\n🇬🇧 **UK:** tuition + GBP 1,334/month × up to 9 months (~GBP 12,000)\n🇦🇺 **Australia:** tuition + AUD 29,710/year living\n🇨🇦 **Canada:** tuition + **CAD 20,635/year** (SDS route) — usually via a **GIC**\n🇩🇪 **Germany:** **EUR 11,904** in a blocked account\n🇺🇸 **USA:** full first-year cost on the I-20 (tuition + living)\n🇳🇿 **New Zealand:** tuition + NZD 20,000/year\n\n⚠️ Funds should be **seasoned 3–6 months** (sudden large deposits get questioned). Fixed deposits & some loans count — cash-at-home does not.`,
    suggestions: ['Can a relative sponsor me?', 'What counts as an acceptable source of funds?', 'How do I get an education loan?'],
  },
  {
    id: 'fund_sources', topic: 'Money & funding', q: 'What counts as an acceptable source of funds?',
    keywords: ['source of funds', 'acceptable funds', 'fund source', 'where money from', 'income source',
               'genuine funds', 'what money counts', 'liquid funds', 'blocked account', 'gic'],
    answer: `Visa officers check that money is **real, yours (or your sponsor's), and explainable**.\n\n✅ **Accepted:**\n• Savings / current account (seasoned 3–6 months)\n• Fixed deposits (with certificate)\n• Education loan from a recognised bank (sanction letter)\n• Sponsor's salary, business income, rental income, farm income — with evidence\n• Sale of property/land — with the deed & bank credit trail\n• Canada **GIC** / Germany **blocked account** / UK 28-day maintenance\n\n❌ **Not accepted:** cash at home, undocumented gifts, funds that appear days before applying, borrowed money "parked" temporarily.`,
    suggestions: ['How much bank balance do I need?', 'Can a relative sponsor me?', 'How do I get an education loan?'],
  },
  {
    id: 'sponsor', topic: 'Money & funding', q: 'Can a relative sponsor me?',
    keywords: ['sponsor', 'uncle', 'relative', 'third party', 'who can sponsor', 'family sponsor',
               'brother sponsor', 'sponsor me', 'father sponsor', 'can my uncle sponsor', 'co-sponsor'],
    answer: `Yes — close relatives can sponsor you in most countries (UK & Canada prefer parents/siblings/spouse; Australia is broader).\n\n✅ **From the sponsor:**\n• Notarised sponsorship / affidavit of support letter\n• Bank statements — last 6 months\n• Income proof: salary slips + tax returns, or business registration + audit\n• Proof of relationship (birth cert, relationship certificate)\n\n✅ **From you:**\n• Short letter explaining why this person is sponsoring you and their capacity to do so\n\n⚠️ Multiple small sponsors look weak — one or two strong sponsors is better.`,
    suggestions: ['What counts as an acceptable source of funds?', 'How much bank balance do I need?', 'How do I get an education loan?'],
  },
  {
    id: 'education_loan', topic: 'Money & funding', q: 'How do I get an education loan?',
    keywords: ['education loan', 'student loan', 'bank loan', 'loan for study', 'loan collateral',
               'loan interest', 'how to get loan', 'loan sanction', 'study loan nepal', 'loan process'],
    answer: `Most Nepali banks offer education loans for study abroad.\n\n**Typical terms:**\n• 💰 Up to **80–90%** of total cost, often needs **land/property as collateral**\n• 📈 Interest ~**9–13%** p.a. (varies with base rate)\n• 🗓️ Repayment starts after a grace period (course length + 6–12 months)\n\n**You'll usually need:**\n• Offer letter + fee structure\n• Land ownership papers + valuation\n• Sponsor/guarantor income proof + tax clearance\n• Your citizenship, passport, academic docs\n\n⏱️ Sanction takes **1–3 weeks** — start once you have your offer letter. The **loan sanction letter** can be shown as part of your funds for the visa.`,
    suggestions: ['What counts as an acceptable source of funds?', 'How much bank balance do I need?', 'How do I pay the tuition fee from Nepal?'],
  },
  {
    id: 'forex_payment', topic: 'Money & funding', q: 'How do I pay tuition & carry money from Nepal?',
    keywords: ['pay tuition', 'send money abroad', 'foreign exchange', 'forex', 'swift transfer',
               'transfer fee', 'nrb approval', 'remittance', 'pay university', 'wire transfer', 'forex card', 'how to pay fees'],
    answer: `**Paying tuition / deposit from Nepal**\n• Go through a **commercial bank** — they process a **SWIFT / telegraphic transfer** to the university\n• Bring: offer letter, fee invoice, passport, PAN, loan/source docs\n• Bank arranges the **Nepal Rastra Bank (NRB)** approval for the amount\n• Some universities use **Flywire / Convera** — the bank still sends the funds\n\n**Carrying money for living costs**\n• Get a **prepaid forex/travel card** or a small USD cash amount (declare if over the limit)\n• Open a local student bank account in your first week abroad and transfer the rest\n\n💡 Keep every remittance receipt — you may need to show the trail for the visa and at arrival.`,
    suggestions: ['How do I get an education loan?', 'How much bank balance do I need?', 'What should I do in my first week abroad?'],
  },
  {
    id: 'scholarship', topic: 'Money & funding', q: 'How do I get a scholarship?',
    keywords: ['scholarship', 'scholarship available', 'funded', 'fully funded', 'financial aid',
               'bursary', 'fee waiver', 'grant', 'free study', 'merit scholarship', 'get scholarship'],
    answer: `Scholarships for Nepali students:\n\n🏆 **Fully funded (competitive):**\n• Chevening (UK) · Australia Awards · DAAD (Germany) · Fulbright (USA) · Commonwealth · ADB-JSP\n\n🎓 **University scholarships (most common):**\n• Merit / academic-excellence awards — **10–50%** tuition off, often automatic on GPA\n• Early-application & regional bursaries\n• Erasmus+ / GKS (Korea) for specific programs\n\n**To improve your odds:** strong GPA, a sharp SOP, apply **early**, and to a spread of universities.\n\n💡 Ask your counsellor which shortlisted universities give automatic merit discounts for your marks.`,
    suggestions: ['How much does studying cost?', 'What IELTS score do I need?', 'How do I start the process?'],
  },
  {
    id: 'application_fee', topic: 'Money & funding', q: 'Are application fees and deposits refundable?',
    keywords: ['application fee', 'university deposit', 'tuition deposit', 'refundable', 'refund deposit',
               'is deposit refundable', 'pay deposit', 'confirmation deposit', 'application cost'],
    answer: `**Application fee**\n• Some universities charge **GBP/AUD/USD 50–150** per application; many (esp. UK/Australia) are free\n• Non-refundable, but small\n\n**Tuition deposit** (paid after you accept an offer, before CAS/CoE)\n• Usually **£1,000–£5,000 / AUD 5,000–10,000 / first semester**\n• ✅ **Refundable if your visa is refused** (with the refusal letter) at most universities — minus a small admin fee\n• ❌ Usually **not** refundable if you simply change your mind\n\n💡 Always read the university's refund policy before paying — your counsellor confirms it for each offer.`,
    suggestions: ['What is a CAS / CoE / I-20?', 'How do I pay the fee from Nepal?', 'What are my visa chances?'],
  },

  // ═══ VISA ═════════════════════════════════════════════════════════════
  {
    id: 'visa_process', topic: 'Visa', q: 'What is the student visa process step by step?',
    keywords: ['visa process', 'visa steps', 'how to apply visa', 'student visa', 'visa application',
               'visa procedure', 'apply for visa', 'visa step by step', 'get student visa'],
    answer: `**Student visa — the flow:**\n1. 📧 Accept your offer & pay the tuition deposit\n2. 🎫 University issues your sponsorship doc — **CAS** (UK) / **CoE** (Australia) / **I-20** (USA) / **LOA + GIC** (Canada)\n3. 💰 Arrange financial proof (blocked account / GIC / bank balance)\n4. 🖐️ Create the online visa account & pay the fee (+ health surcharge)\n5. 🏥 Book **biometrics** at VFS and the **panel medical** (if required)\n6. 📤 Upload documents: passport, CAS/I-20, finances, academics, SOP, PCC\n7. 🎤 Attend interview (USA F1; sometimes UK/Australia credibility check)\n8. ⏳ Wait for the decision → passport returned with visa\n\nGlobal Pathway prepares the whole file and does a mock interview with you.`,
    suggestions: ['How long does the visa take?', 'What is a visa interview like?', 'What is biometrics and the medical exam?'],
  },
  {
    id: 'visa_time', topic: 'Visa', q: 'How long does the visa take?',
    keywords: ['how long visa', 'visa processing time', 'visa time', 'when visa', 'visa duration',
               'processing time', 'visa result', 'visa decision', 'visa take', 'long does the visa',
               'weeks for visa', 'how long for visa', 'visa come', 'visa result time'],
    answer: `Approximate student visa processing times:\n\n🇺🇸 **USA:** 1–6 weeks after interview (book interview early — slots fill)\n🇬🇧 **UK:** 3 weeks standard · ~5 working days priority\n🇦🇺 **Australia:** 4–8 weeks (can be longer)\n🇳🇿 **New Zealand:** 4–8 weeks\n🇩🇪 **Germany:** 6–12 weeks (national visa)\n🇨🇦 **Canada:** 8–16+ weeks ⚠️ apply the earliest\n\n📌 Submit **at least 3 months** before your course starts; **5–6 months** for Canada & Germany.`,
    suggestions: ['What is the visa process step by step?', 'What are my visa chances?', 'What are the intakes and deadlines?'],
  },
  {
    id: 'visa_chances', topic: 'Visa', q: 'What are my visa chances?',
    keywords: ['visa chance', 'will i get visa', 'visa approved', 'visa approval', 'chances of visa',
               'likelihood', 'get visa', 'visa success', 'visa rate', 'genuine student', 'gte', 'gs requirement'],
    answer: `Officers assess whether you're a **genuine student** who can fund the course and will leave afterwards.\n\n✅ **Strengthens your case:**\n• Seasoned funds (3–6+ months), clear source\n• A course that logically follows your background\n• Specific reasons for the country & university\n• Strong ties to Nepal (family, property, job offer)\n• Clean, consistent documents & a sharp SOP\n\n❌ **Weakens it:**\n• Sudden large deposits / thin funds\n• Big unexplained career or subject switch\n• Vague "why here" answers\n• Past refusal not addressed\n\nYour counsellor gives you an honest read before you apply. 💪`,
    suggestions: ['What is a visa interview like?', 'My visa was refused before — what now?', 'What goes in the SOP?'],
  },
  {
    id: 'visa_interview', topic: 'Visa', q: 'What is the visa interview like?',
    keywords: ['visa interview', 'f1 interview', 'interview questions', 'credibility interview',
               'gte interview', 'embassy interview', 'consular interview', 'interview tips', 'visa officer questions'],
    answer: `Mainly for **USA (F1)**, sometimes **UK credibility** and **Australia GS** checks.\n\n**Common questions:**\n• Why this university & course? Why not study in Nepal?\n• How is your study funded? Who is your sponsor & their income?\n• What will you do after graduation? (answer: a specific job **in Nepal**)\n• Do you have relatives in that country?\n\n**Tips:**\n• Answers **short, confident, consistent** with your SOP & DS-160/form\n• Know your program, fees, city, and career plan cold\n• Don't volunteer plans to work or settle there\n• Dress smart, carry documents neatly organised\n\n💡 Global Pathway runs a **mock interview** before your date.`,
    suggestions: ['What is the visa process step by step?', 'What are my visa chances?', 'My visa was refused before — what now?'],
  },
  {
    id: 'biometrics_medical', topic: 'Visa', q: 'What is biometrics and the medical exam?',
    keywords: ['biometrics', 'vfs', 'medical exam', 'panel physician', 'health check', 'tb test',
               'chest xray', 'medical test visa', 'immigration medical', 'x-ray visa'],
    answer: `**Biometrics** — fingerprints + photo, taken at a **VFS Global** centre in Kathmandu after you pay the visa fee. Quick appointment; carry your passport & fee receipt.\n\n**Medical exam** — required for 🇦🇺 Australia, 🇨🇦 Canada, 🇳🇿 New Zealand, and 🇬🇧 UK (if staying 6+ months = **TB test**).\n• Done only at an **approved panel clinic** (list is country-specific)\n• Includes a **chest X-ray** (TB screening), sometimes blood/urine tests\n• Results go **directly to the immigration authority**\n• Costs ~**NPR 5,000–9,000**; valid 3–6 months\n\n💡 Book the medical as soon as you start the visa application so it doesn't delay you.`,
    suggestions: ['What is the visa process step by step?', 'How long does the visa take?', 'What is a police clearance certificate?'],
  },
  {
    id: 'visa_rejected', topic: 'Visa', q: 'My visa was refused before — what now?',
    keywords: ['visa rejected', 'visa refused', 'refusal', 'rejected before', 'denied', 'rejection',
               'visa failed', 'previous rejection', '214b', 'reapply visa', 'refusal letter'],
    answer: `A refusal is **not a ban** — many students succeed on the next try. ✅\n\n**Do this:**\n1. 📄 Read the refusal letter — identify the **exact ground** (funds / intent / documents / 214(b))\n2. 🔧 Fix that specific issue — e.g. season funds longer, clearer source, stronger SOP\n3. 📝 Add a short **cover letter** acknowledging the earlier refusal and what's changed\n4. 🏫 Consider a different university/course if that was the concern\n5. ⏱️ Reapply once the file is genuinely stronger — not immediately\n\nBring the refusal letter to your counsellor — it's the roadmap for the reapplication. 🙏`,
    suggestions: ['What are my visa chances?', 'What is a visa interview like?', 'What goes in the SOP?'],
  },
  {
    id: 'offer_docs', topic: 'Visa', q: 'What is a CAS / CoE / I-20 / LOA?',
    keywords: ['cas', 'coe', 'i-20', 'i20', 'loa', 'confirmation of enrolment', 'confirmation of acceptance',
               'letter of acceptance', 'what is cas', 'admission letter', 'unconditional offer', 'conditional offer'],
    answer: `These are the **university documents that let you apply for the visa**:\n\n• 🇬🇧 **CAS** — Confirmation of Acceptance for Studies (a reference number). Issued after you accept an **unconditional offer** + pay the deposit + meet conditions.\n• 🇦🇺 **CoE** — Confirmation of Enrolment. Issued after you accept + pay deposit + OSHC.\n• 🇺🇸 **I-20** — issued by the university; you use it to pay the SEVIS fee and book the F1 interview.\n• 🇨🇦 **LOA** — Letter of Acceptance from a DLI (Designated Learning Institution); used with a **GIC** for the study permit.\n\n**Conditional offer** = you must still meet a requirement (IELTS, final transcript).\n**Unconditional offer** = all conditions met — ready for CAS/CoE.`,
    suggestions: ['What is the visa process step by step?', 'Are deposits refundable?', 'How long does the visa take?'],
  },

  // ═══ AFTER YOU ARRIVE ═════════════════════════════════════════════════
  {
    id: 'work_abroad', topic: 'Work & PR', q: 'Can I work while studying?',
    keywords: ['work while studying', 'part time', 'part-time job', 'work hours', 'can i work',
               'job abroad', 'earn money', 'working student', 'work rights', 'hours allowed'],
    answer: `Yes, on a student visa:\n\n🇬🇧 **UK:** 20 hrs/week in term (degree level), full-time in holidays\n🇦🇺 **Australia:** 48 hrs/fortnight in term, unlimited in breaks\n🇨🇦 **Canada:** 24 hrs/week off-campus in term, full-time in breaks\n🇳🇿 **New Zealand:** 20 hrs/week (up to 40 for some)\n🇩🇪 **Germany:** 120 full / 240 half days per year\n🇺🇸 **USA:** on-campus only (20 hrs/week); off-campus needs CPT/OPT authorisation\n\n💰 **Typical wages/hr:** UK £11–13 · Australia AUD 24–28 · Canada CAD 16–20 · Germany EUR 12–14\n\n💡 Part-time work usually covers rent + groceries, not tuition.`,
    suggestions: ['How do I find a part-time job abroad?', 'Can I get PR after studying?', 'What is a post-study work visa?'],
  },
  {
    id: 'job_hunting', topic: 'Work & PR', q: 'How do I find a part-time job abroad?',
    keywords: ['find job abroad', 'part time job search', 'get a job', 'job hunt', 'cv resume',
               'how to find work', 'campus job', 'first job abroad', 'tax number', 'ni number', 'sin number', 'tfn'],
    answer: `**First, get your work/tax number:**\n• 🇬🇧 National Insurance (NI) · 🇨🇦 SIN · 🇦🇺 TFN · 🇳🇿 IRD — apply in week 1\n\n**Where to look:**\n• University careers portal & on-campus jobs (library, student union)\n• In person — hand your CV to cafés, retail, warehouses, supermarkets\n• Apps/sites: Indeed, local job boards, Seek (AU), Job Bank (CA)\n• Nepali student community groups on Facebook\n\n**CV tips:** 1 page, local phone number & address, list any Nepal work/volunteering, references.\n\n💡 Give yourself the first 2–3 weeks to settle before job hunting hard.`,
    suggestions: ['Can I work while studying?', 'What should I do in my first week abroad?', 'What is a post-study work visa?'],
  },
  {
    id: 'psw_visa', topic: 'Work & PR', q: 'What is a post-study work visa?',
    keywords: ['post study work', 'psw', 'graduate route', 'graduate visa', 'work permit after study',
               'stay back option', '485 visa', 'pgwp', 'opt', 'after graduation visa', 'work after degree'],
    answer: `A visa to **stay and work after you graduate**:\n\n🇬🇧 **Graduate Route:** 2 years (3 for PhD). Apply from inside the UK before your student visa ends.\n🇦🇺 **Temporary Graduate (485):** 2–3 years (longer for regional study / some degrees).\n🇨🇦 **PGWP:** up to 3 years, length matches your course. Program must be PGWP-eligible.\n🇳🇿 **Post-Study Work Visa:** up to 3 years (degree level).\n🇩🇪 **18-month job-seeker residence** after graduation → work permit / EU Blue Card.\n🇺🇸 **OPT:** 12 months (+24 months STEM extension). No direct PR route.\n\n💡 These are the bridge from study → skilled work → PR.`,
    suggestions: ['Can I get PR after studying?', 'Which country is best for PR?', 'Can I work while studying?'],
  },
  {
    id: 'pr_pathway', topic: 'Work & PR', q: 'Can I get PR after studying?',
    keywords: ['pr', 'permanent residency', 'permanent residence', 'stay after study', 'immigration',
               'settle abroad', 'citizenship', 'residency', 'green card', 'pr after study', 'pnp', 'express entry'],
    answer: `Clear study → work → PR pathways exist in several countries:\n\n🇨🇦 **Canada** (strongest): PGWP → skilled work → **Express Entry / PNP**, ~2–4 yrs post-grad\n🇦🇺 **Australia:** 485 visa → skilled occupation list → state nomination / points PR\n🇳🇿 **New Zealand:** post-study work → Skilled Migrant Category\n🇩🇪 **Germany:** work 21–33 months on a Blue Card → PR; among the fastest in Europe\n🇬🇧 **UK:** Graduate Route → Skilled Worker visa → PR (ILR) after 5 yrs\n🇺🇸 **USA:** no direct route — needs employer H-1B sponsorship\n\n💡 **PR-friendly fields:** Nursing, IT, Engineering, Accounting, Trades, Early Childhood Education.`,
    suggestions: ['What is a post-study work visa?', 'Which course gives the best PR?', 'Which country should I choose?'],
  },
  {
    id: 'dependents', topic: 'Work & PR', q: 'Can I bring my spouse or family?',
    keywords: ['dependent', 'dependant', 'spouse', 'wife', 'husband', 'partner', 'bring my',
               'bring family', 'bring children', 'partner visa', 'spouse visa', 'dependent work',
               'family with me', 'take my family', 'married'],
    answer: `Depends on the country and course level:\n\n🇨🇦 **Canada:** spouse can get an **open work permit** if you're in a masters/PhD or an eligible program\n🇦🇺 **Australia:** dependants allowed; partner can work (often full-time for postgrad-by-research/masters)\n🇬🇧 **UK:** dependants now only for **PhD / research masters** or government-sponsored courses ⚠️\n🇳🇿 **New Zealand:** partner may get a work visa if you study an eligible course\n🇩🇪 **Germany:** family reunion possible; spouse can work\n🇺🇸 **USA:** F-2 dependants allowed but **cannot work**\n\n**You'll need:** marriage certificate, relationship evidence, and **extra funds** for each dependant.`,
    suggestions: ['How much bank balance do I need?', 'Which country should I choose?', 'Can I work while studying?'],
  },
  {
    id: 'accommodation', topic: 'After you arrive', q: 'How do I arrange accommodation?',
    keywords: ['accommodation', 'housing', 'where to live', 'student housing', 'hostel', 'dorm',
               'rent abroad', 'homestay', 'find a room', 'halls of residence', 'flat share', 'place to stay'],
    answer: `**Options:**\n• 🏫 **University halls / on-campus** — safest for the first term, bills included, book early (limited seats)\n• 🏠 **Private student accommodation** (Unite, Scape, etc.) — furnished, all-in price\n• 👨‍👩‍👧 **Homestay** — live with a local family; good for a soft landing\n• 🛏️ **Private rental / flat share** — cheapest per person; arrange **after you arrive** and can view it\n\n**Cost (per month, rough):** UK £500–900 · Australia AUD 800–1,600 · Canada CAD 700–1,400\n\n💡 Book **temporary accommodation for the first 1–2 weeks** before you fly, then find a longer-term place in person. Never pay a large deposit for an unseen private flat.`,
    suggestions: ['What should I do in my first week abroad?', 'How much are living costs?', 'What should I pack?'],
  },
  {
    id: 'health_insurance', topic: 'After you arrive', q: 'Do I need health insurance?',
    keywords: ['health insurance', 'oshc', 'ihs', 'health surcharge', 'medical insurance', 'nhs',
               'insurance abroad', 'ghip', 'student health cover', 'do i need insurance'],
    answer: `Yes — usually paid **as part of the visa**:\n\n🇦🇺 **Australia — OSHC:** compulsory, buy for your whole stay before the CoE. ~AUD 500–650/yr single.\n🇬🇧 **UK — IHS (Immigration Health Surcharge):** ~£776/yr, paid with the visa → free NHS access.\n🇨🇦 **Canada:** province-based (some provinces cover students, e.g. BC MSP; others need private cover for the first months).\n🇳🇿 **New Zealand:** insurance required for enrolment.\n🇩🇪 **Germany:** compulsory public health insurance (~EUR 120/month) — enrol on arrival.\n🇺🇸 **USA:** university health plan, often **USD 1,500–2,500/yr**, usually mandatory.\n\n💡 Budget this separately — it's on top of tuition.`,
    suggestions: ['How much does studying cost?', 'What is the visa process step by step?', 'What should I do in my first week abroad?'],
  },
  {
    id: 'predeparture', topic: 'After you arrive', q: 'What should I pack / carry?',
    keywords: ['pack', 'packing', 'luggage', 'suitcase', 'pre departure', 'predeparture', 'what to carry',
               'hand luggage', 'documents to carry', 'before flying', 'checklist before travel', 'what to take',
               'before i fly', 'carry in flight'],
    answer: `**Carry in your hand luggage (never checked-in):**\n• Passport with visa, offer/CAS/CoE/I-20, admission letter\n• Financial documents, loan sanction, fee receipts\n• All academic originals + IELTS\n• Medical & PCC reports, insurance proof\n• Accommodation booking, a few passport photos\n• Forex card + some local cash\n\n**Pack:**\n• Season-appropriate clothing (a proper winter coat if going Sept–Feb)\n• Plug adapter, essential medicines with prescription, spectacles spare\n• A few Nepali food items / spices (check the country's customs rules)\n\n**Before flying:** tell your bank you're travelling, download offline maps, note emergency & university contacts.`,
    suggestions: ['What should I do in my first week abroad?', 'How do I arrange accommodation?', 'How do I carry money from Nepal?'],
  },
  {
    id: 'arrival_setup', topic: 'After you arrive', q: 'What should I do in my first week abroad?',
    keywords: ['first week', 'when i arrive', 'after landing', 'settle in', 'first things to do',
               'arrival', 'reach abroad', 'new country setup', 'first day abroad', 'orientation'],
    answer: `**Week 1 checklist:**\n1. 🛂 Collect your **BRP / residence permit** if required (UK, Germany)\n2. 🏫 Attend **university orientation** & complete **enrolment / registration**\n3. 📱 Get a local **SIM card** (student plans are cheap)\n4. 🏦 Open a **local student bank account** (take passport, offer letter, address proof)\n5. 🔢 Apply for your **work/tax number** (NI / SIN / TFN / IRD)\n6. 🩺 Register with a local doctor / GP; activate your health cover\n7. 🚌 Get a **student transport card**\n8. 🏠 Confirm longer-term accommodation if you booked temporary\n9. 👋 Join the university's **Nepali students' society**\n\n💡 Keep some emergency funds accessible for the first month.`,
    suggestions: ['How do I find a part-time job abroad?', 'How do I arrange accommodation?', 'Can I work while studying?'],
  },

  // ═══ NEPAL PROCESS ════════════════════════════════════════════════════
  {
    id: 'noc', topic: 'Nepal process', q: 'What is the NOC from the Ministry of Education?',
    keywords: ['noc', 'no objection certificate', 'ministry of education', 'moe nepal', 'noc process',
               'nepal noc', 'education ministry letter', 'noc for visa', 'noc documents'],
    answer: `The **No Objection Certificate (NOC)** from Nepal's **Ministry of Education, Science & Technology** is required before you leave to study abroad. Many embassies ask for it, and you show it at immigration when flying out.\n\n**Apply (Kathmandu / online portal + Ministry office) with:**\n• Offer / admission letter + fee structure\n• Passport & citizenship\n• Academic certificates (SEE onwards) + transcripts\n• Proof of fee payment / financial capacity / loan\n• IELTS/PTE report\n• Passport photos + the application form & fee\n\n⏱️ Usually issued in a **few working days**. Your counsellor guides you through the current process.`,
    suggestions: ['How do I get documents verified?', 'What documents do I need?', 'How do I pay the tuition from Nepal?'],
  },
]

// ── Matching ───────────────────────────────────────────────────────────────
const STOPWORDS = new Set(['the','a','an','is','are','do','does','did','i','to','for','of','my','me',
  'in','on','and','or','what','how','can','could','should','would','you','it','be','get','with','at',
  'about','need','want','tell','know','please','am','was','were','have','has','if','so','this','that'])

const wordsOf = (s) => s.toLowerCase().replace(/[^a-z0-9.\s]/g, ' ')
  .split(/\s+/).map(w => w.replace(/^\.+|\.+$/g, '')).filter(Boolean)

function findIntent(userMessage) {
  const raw = userMessage.toLowerCase().replace(/[^a-z0-9.\s]/g, ' ')
  const msgWords = new Set(wordsOf(userMessage).filter(w => !STOPWORDS.has(w)))

  let bestScore = 0, bestIntent = null
  for (const intent of INTENTS) {
    let score = 0
    for (const kw of intent.keywords) {
      const k = kw.toLowerCase()
      if (k.includes(' ')) {
        if (raw.includes(k)) score += 6 + k.length * 0.25          // exact phrase match — strong
      } else if (msgWords.has(k)) {
        score += 3                                                  // whole-word match
      } else if (raw.includes(k) && k.length >= 4) {
        score += 1.5                                                // partial / substring
      }
    }
    // small bonus if the intent's canonical question shares words with the query
    for (const w of wordsOf(intent.q)) {
      if (w.length >= 4 && !STOPWORDS.has(w) && msgWords.has(w)) score += 0.6
    }
    if (score > bestScore) { bestScore = score; bestIntent = intent }
  }
  return bestScore >= 3 ? bestIntent : null
}

// Topics for the "Browse all topics" menu, in display order.
const TOPIC_ORDER = ['Getting started', 'English & tests', 'Documents', 'Money & funding',
  'Visa', 'Work & PR', 'After you arrive', 'Nepal process']

const INITIAL_SUGGESTIONS = [
  'How do I start the process?',
  'What documents do I need?',
  'How much does studying abroad cost?',
  'What are my visa chances?',
  'Can I work while studying?',
  'Which country should I choose?',
]

function BotAvatar() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: `linear-gradient(135deg, ${theme.primary}, ${theme.purple})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, color: theme.white,
    }}>
      <Bot size={15} />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <BotAvatar />
      <div style={{
        background: theme.surfaceAlt, borderRadius: '14px 14px 14px 4px',
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: theme.textMuted,
            animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite`,
          }}/>
        ))}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:0.4}40%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  )
}

function BotMessage({ text }) {
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {lines.map((line, i) => {
        if (!line) return <div key={i} style={{ height: 3 }}/>
        const parts = line.split(/\*\*(.*?)\*\*/g)
        return (
          <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: theme.textMid }}>
            {parts.map((part, j) =>
              j % 2 === 1
                ? <strong key={j} style={{ fontWeight: 600 }}>{part}</strong>
                : <span key={j}>{part}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ChatBotWidget({ navigate, isMobile }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const firstName = (profile.name || 'there').split(' ')[0]

  const [open,        setOpen]        = useState(false)
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [isTyping,    setIsTyping]    = useState(false)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const [showTopics,  setShowTopics]  = useState(false)
  const [unread,      setUnread]      = useState(0)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    setTimeout(() => {
      const greeting = {
        id: 1, role: 'bot',
        text: `Hi ${firstName}! I'm the **GP Assistant** 🎓\n\nI cover the whole study-abroad journey — **getting started, IELTS & tests, documents, money & funding, the visa process, work & PR, life after you arrive**, and the **Nepal-side steps** (NOC, attestation).\n\nAsk me anything, or tap **📚 Browse all topics** below.`,
      }
      setMessages([greeting])
      if (!open) setUnread(1)
    }, 1200)
  }, [])

  function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || isTyping) return
    setInput('')
    setUnread(0)
    setShowTopics(false)
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: msg }])
    setSuggestions([])
    setIsTyping(true)
    const delay = 800 + Math.random() * 500
    setTimeout(() => {
      setIsTyping(false)
      if (['talk to counsellor','contact counsellor','speak to counsellor','human','chat'].some(k => msg.toLowerCase().includes(k))) {
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          text: `Of course! Click **"Chat with Staff"** in the sidebar to reach your counsellor directly. 💬\n\nThey'll answer questions specific to your profile and application status. 🙏`,
          isHandoff: true,
        }])
        setSuggestions([])
        return
      }
      const intent = findIntent(msg)
      if (intent) {
        setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: intent.answer, suggestions: intent.suggestions }])
        setSuggestions(intent.suggestions)
      } else {
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          text: `Hmm, I don't have a ready answer for that one. 🤔\n\nTap **📚 Browse all topics** below to see everything I cover, try rephrasing, or **chat with your counsellor** for help specific to your file.`,
          isFallback: true,
        }])
        setSuggestions(INITIAL_SUGGESTIONS)
        setShowTopics(true)
      }
    }, delay)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      {open && (
        <div style={{
          position: 'fixed',
          // Mobile: full-screen sheet. Desktop: original floating box.
          top:    isMobile ? 0   : 'auto',
          left:   isMobile ? 0   : 'auto',
          bottom: isMobile ? 0   : 90,
          right:  isMobile ? 0   : 28,
          width:  isMobile ? '100%' : 360,
          height: isMobile ? '100%' : 500,
          background: theme.white,
          border: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderRadius: isMobile ? 0 : 16,
          boxShadow: isMobile ? 'none' : '0 20px 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden',
          animation: 'popIn 0.2s ease-out',
        }}>
          <style>{`@keyframes popIn{from{opacity:0;transform:scale(0.92) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
          <div style={{
            padding: '12px 16px',
            background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.purple} 100%)`,
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.white,
            }}>
              <Bot size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.white }}>GP Assistant</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.status.success.main, display: 'inline-block' }}/>
                Online • Answers instantly
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
              width: 26, height: 26, color: theme.white, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} />
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 12px 6px',
            display: 'flex', flexDirection: 'column', gap: 10, background: theme.pageBg,
          }}>
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', background: theme.primary, color: theme.white,
                      borderRadius: '14px 14px 4px 14px', padding: '8px 12px',
                      fontSize: 12, lineHeight: 1.5,
                    }}>{msg.text}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', maxWidth: '90%' }}>
                    <BotAvatar />
                    <div style={{
                      background: theme.white, border: `1px solid ${theme.border}`,
                      borderRadius: '14px 14px 14px 4px', padding: '10px 12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                      <BotMessage text={msg.text} />
                      {msg.isHandoff && (
                        <button onClick={() => { setOpen(false); navigate('/student/chat') }} style={{
                          marginTop: 8, fontSize: 11, fontWeight: 600, color: theme.white,
                          background: theme.primary, border: 'none', borderRadius: 7,
                          padding: '5px 12px', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}><MessageSquare size={12} /> Open Chat</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isTyping && <TypingIndicator />}

            {!isTyping && (
              <div style={{ paddingLeft: 35, display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    background: theme.status.info.bg, border: `1px solid ${theme.status.info.border}`, color: theme.primary, fontWeight: 500,
                  }}>{s}</button>
                ))}
                <button onClick={() => setShowTopics(v => !v)} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                  background: showTopics ? theme.primary : theme.surfaceAlt,
                  border: `1px solid ${showTopics ? theme.primary : theme.border}`,
                  color: showTopics ? theme.white : theme.textMid, fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}><BookOpen size={12} /> Browse all topics</button>
                <button onClick={() => { setOpen(false); navigate('/student/chat') }} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                  background: theme.status.success.bg, border: `1px solid ${theme.status.success.border}`, color: theme.status.success.text, fontWeight: 500,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}><MessageSquare size={12} /> Talk to counsellor</button>
              </div>
            )}

            {!isTyping && showTopics && (
              <div style={{
                marginLeft: 35, marginTop: 4, background: theme.white,
                border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                {TOPIC_ORDER.map(topic => {
                  const items = INTENTS.filter(x => x.topic === topic)
                  if (!items.length) return null
                  return (
                    <div key={topic} style={{ marginBottom: 8 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: theme.textMuted,
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                      }}>{topic}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {items.map(it => (
                          <button key={it.id} onClick={() => sendMessage(it.q)} style={{
                            fontSize: 11, padding: '4px 9px', borderRadius: 8, cursor: 'pointer',
                            textAlign: 'left', lineHeight: 1.3,
                            background: theme.pageBg, border: `1px solid ${theme.border}`, color: theme.textMid,
                          }}>{it.q}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: '8px 12px', borderTop: `1px solid ${theme.border}`,
            background: theme.white, display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0,
            paddingBottom: isMobile ? 'max(8px, env(safe-area-inset-bottom))' : '8px',
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about visa, IELTS, funds, PR, arrival..."
              disabled={isTyping}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 20,
                border: `1.5px solid ${theme.border}`, fontSize: 12,
                outline: 'none', background: theme.pageBg, color: theme.textStrong,
              }}
              onFocus={e => e.target.style.borderColor = theme.primary}
              onBlur={e => e.target.style.borderColor = theme.border}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                background: input.trim() && !isTyping ? theme.primary : theme.border,
                color: theme.white,
                cursor: input.trim() && !isTyping ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={open ? () => setOpen(false) : () => { setOpen(true); setUnread(0) }}
        style={{
          position: 'fixed',
          bottom: isMobile ? 20 : 28,
          right: isMobile ? 20 : 28,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? theme.textMid : `linear-gradient(135deg, ${theme.primary}, ${theme.purple})`,
          border: 'none', boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.white, zIndex: 1001, transition: 'all 0.2s',
        }}
        title="Ask GP Assistant"
      >
        {open ? <X size={24} /> : <Bot size={26} />}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: theme.status.danger.main, color: theme.white,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${theme.white}`,
          }}>{unread}</div>
        )}
      </button>
    </>
  )
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate()
  const isMobile  = useIsMobile()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const [payments, setPayments] = useState([])
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!profile.id) { navigate('/student-login'); return }
    loadData()
  }, [])
  useRefetchOnFocus(loadData)

  async function loadData() {
    try {
      const { data: pays } = await supabase
        .from('payments').select('*')
        .eq('student_email', profile.email || '')   // ← FIXED: was student_name
        .order('created_at', { ascending: false })
      setPayments(pays || [])
    } catch { setPayments([]) }

    try {
      const { data: myTasks } = await supabase
        .from('tasks').select('*')
        .eq('related_to', profile.name || '')
        .order('created_at', { ascending: false })
      setTasks(myTasks || [])
    } catch { setTasks([]) }

    setLoading(false)
  }

  const payBadge = (status) => {
    if (status === 'paid')                 return { bg: theme.status.success.bg, color: theme.status.success.text }
    if (status === 'pending')              return { bg: theme.status.warning.bg, color: theme.status.warning.text }
    if (status === 'pending_verification') return { bg: theme.status.info.bg, color: theme.primary }
    if (status === 'overdue')              return { bg: theme.status.danger.bg, color: theme.status.danger.text }
    return { bg: theme.surfaceAlt, color: theme.textLight }
  }

  if (loading) {
    return (
      <StudentLayout>
        <p style={{ color: theme.textLight, fontSize: 13 }}>Loading your dashboard...</p>
      </StudentLayout>
    )
  }

  // Stat cards now use Lucide icons (matching the sidebar's icon style)
  // instead of emoji, with each icon tinted to match its card's background.
  const statCards = [
    {
      label: 'Total Payments',
      value: payments.length,
      Icon: Receipt,
      bg: theme.status.info.bg,
      color: theme.primary,
    },
    {
      label: 'Amount Paid',
      value: `Rs ${payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}`,
      Icon: CheckCircle2,
      bg: theme.status.success.bg,
      color: theme.status.success.main,
    },
    {
      label: 'Pending Tasks',
      value: tasks.filter(t => t.status === 'pending').length,
      Icon: Hourglass,
      bg: theme.status.warning.bg,
      color: theme.status.warning.text,
    },
  ]

  return (
    <StudentLayout>

      {/* ── GREETING ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: theme.textStrong, margin: 0 }}>
            Welcome back, {(profile.name || 'Student').split(' ')[0]}
          </h1>
        </div>
      </div>

      {/* ── ANNOUNCEMENTS (posted by admin) ── */}
      <AnnouncementsPanel audience="students" isAdmin={false} />

      {/* ── STAT CARDS ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 14, marginBottom: 20,
      }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            background: theme.white, border: `1px solid ${theme.border}`,
            borderRadius: 10, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: card.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: card.color,
            }}>
              <card.Icon size={22} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: theme.textStrong, lineHeight: 1 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PAYMENT HISTORY ── */}
      <div style={{ background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, fontSize: 15, fontWeight: 700, color: theme.textStrong }}>
          Payment History
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>No payment records yet</div>
        ) : (
          payments.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: isMobile ? 6 : 0,
              padding: '13px 18px',
              borderBottom: i < payments.length - 1 ? `1px solid ${theme.border}` : 'none',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: theme.textStrong, marginBottom: 2 }}>
                  Rs {p.amount?.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: theme.textLight }}>
                  {p.method} · {p.date || new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: payBadge(p.status).bg, color: payBadge(p.status).color,
              }}>
                {p.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── TASKS ── */}
      <div style={{ background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, fontSize: 15, fontWeight: 700, color: theme.textStrong }}>
          Your Next Steps
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>No tasks assigned yet</div>
        ) : (
          tasks.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
              borderBottom: i < tasks.length - 1 ? `1px solid ${theme.border}` : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: t.priority === 'High' ? theme.status.danger.main : t.priority === 'Urgent' ? theme.status.danger.main : theme.status.success.main,
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: theme.textStrong }}>{t.title}</div>
                {t.due_date && (
                  <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>
                    Due: {new Date(t.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0,
                background: t.status === 'done' ? theme.status.success.bg : theme.status.warning.bg,
                color:      t.status === 'done' ? theme.status.success.text : theme.status.warning.text,
              }}>
                {t.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── FLOATING CHATBOT ── */}
      <ChatBotWidget navigate={navigate} isMobile={isMobile} />

    </StudentLayout>
  )
}