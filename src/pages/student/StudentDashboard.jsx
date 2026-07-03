import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import StudentLayout from './StudentLayout'

// ── KNOWLEDGE BASE ─────────────────────────────────────────────────────────
const INTENTS = [
  {
    id: 'doc_list',
    keywords: ['document', 'documents', 'what do i need', 'what should i prepare',
               'required', 'paperwork', 'checklist', 'files', 'certificate', 'what to bring'],
    answer: `Here are the documents you typically need to prepare:\n\n📋 **Personal**\n• Passport (valid for at least 2 years)\n• National ID / Citizenship certificate\n• Passport-sized photos (usually 2–4)\n\n🎓 **Academic**\n• SLC/SEE marksheet & certificate\n• +2 / A-Level marksheet & certificate\n• Bachelor's transcripts & degree (if applicable)\n• Character certificate & Migration certificate\n\n🌐 **Language**\n• IELTS / TOEFL / PTE score report\n\n💰 **Financial**\n• Bank statements (last 6 months)\n• Bank balance certificate\n• Sponsor's income proof & bank statements\n\nYour counsellor will give you a personalised checklist! 😊`,
    suggestions: ['How much bank balance do I need?', 'Can a relative sponsor me?', 'How do I get documents verified?'],
  },
  {
    id: 'bank_balance',
    keywords: ['bank balance', 'bank statement', 'how much money', 'financial proof',
               'bank', 'funds', 'savings', 'how much do i need', 'money show'],
    answer: `The required bank balance varies by country:\n\n🇬🇧 **UK:** GBP 1,334 × months of course\n🇦🇺 **Australia:** AUD 21,041 per year\n🇨🇦 **Canada:** CAD 10,000 + first year tuition\n🇩🇪 **Germany:** EUR 11,208 per year\n🇺🇸 **USA:** Full tuition + USD 10,000 living\n\n⚠️ Money should be in the account for **3–6 months** (seasoning).`,
    suggestions: ['Can a relative sponsor me?', 'What documents do I need?', 'Which country is cheapest?'],
  },
  {
    id: 'sponsor',
    keywords: ['sponsor', 'uncle', 'relative', 'third party', 'who can sponsor',
               'family sponsor', 'brother sponsor', 'sponsor me'],
    answer: `Yes! A relative or third-party sponsor is accepted in most countries.\n\n✅ **From the sponsor:**\n• Notarised sponsorship letter\n• Income proof (salary slips, bank statements — 6 months)\n• Employment letter or business registration\n• Proof of relationship\n\n✅ **From you:**\n• Explanation letter on why the relative is sponsoring you`,
    suggestions: ['How much bank balance is needed?', 'What documents do I need?', 'What is the visa process?'],
  },
  {
    id: 'ielts_score',
    keywords: ['ielts score', 'ielts band', 'ielts requirement', 'score required',
               'what score', 'band required', 'english score', 'minimum score'],
    answer: `IELTS score requirements by country:\n\n🇬🇧 **UK:** 6.0–6.5 overall\n🇦🇺 **Australia:** 6.0–6.5 overall\n🇨🇦 **Canada:** 6.0–6.5 overall\n🇺🇸 **USA:** 6.5–7.0 overall\n🇩🇪 **Germany:** 6.0–6.5 overall\n🇳🇿 **New Zealand:** 5.5–6.5 overall\n\n📌 Requirements vary by university and course. Your counsellor can find universities that match your exact band score! 🎯`,
    suggestions: ['My IELTS is 5.5 — can I apply?', 'Can I apply without IELTS?', 'How many times can I retake IELTS?'],
  },
  {
    id: 'ielts_low',
    keywords: ['5.5', 'low score', 'low ielts', 'my score is low', 'not enough',
               'low band', '5.0', '5.5 ielts', 'below 6'],
    answer: `Don't worry! A 5.5 is still enough for many programs 😊\n\nWith a 5.5 IELTS you can:\n• ✅ Apply to **diploma and foundation** programs\n• ✅ Apply to universities offering **pre-sessional English** courses\n• ✅ Apply to many colleges in **Australia, Canada, New Zealand**\n• ✅ Consider **IELTS One Skill Retake** to improve a specific weak band`,
    suggestions: ['Can I apply without IELTS?', 'How many times can I retake?', 'What score do I need?'],
  },
  {
    id: 'no_ielts',
    keywords: ['without ielts', 'no ielts', 'skip ielts', 'alternative to ielts',
               'pte', 'toefl', 'duolingo', 'other english test', 'waive ielts'],
    answer: `Yes, you can sometimes apply without IELTS!\n\n**Alternative English tests:**\n• 📘 PTE Academic\n• 📗 TOEFL iBT\n• 📙 Duolingo English Test (cheapest — USD 49)\n• 📕 Cambridge English (C1 Advanced)\n\n**IELTS waiver:** If your previous degree was taught entirely in English, many universities accept a letter confirming English medium of instruction.`,
    suggestions: ['What IELTS score do I need?', 'My score is 5.5, can I apply?', 'Which country is best for me?'],
  },
  {
    id: 'visa_chances',
    keywords: ['visa chance', 'will i get visa', 'visa approved', 'visa approval',
               'chances', 'likelihood', 'get visa', 'visa success'],
    answer: `Visa approval depends on several factors:\n\n✅ **Strengthens your application:**\n• Strong financial proof (6+ months seasoned funds)\n• Genuine student intent\n• Ties to Nepal (family, property)\n• Good academic record\n• Well-written SOP\n\n❌ **Weakens your application:**\n• Insufficient or recently deposited funds\n• Unclear reasons for choosing that country\n• Previous visa refusals not addressed\n\nYour counsellor will assess your profile honestly before you apply! 💪`,
    suggestions: ['My visa was rejected before — what do I do?', 'How long does visa take?', 'What documents do I need?'],
  },
  {
    id: 'visa_rejected',
    keywords: ['visa rejected', 'visa refused', 'refusal', 'rejected before',
               'denied', 'rejection', 'visa failed', 'previous rejection'],
    answer: `A visa rejection does NOT permanently ban you — you can reapply! ✅\n\n**Steps after rejection:**\n1. 📄 Read your refusal letter carefully\n2. 🔍 Address the specific reason given\n3. 💪 Build stronger finances (6+ months seasoning)\n4. 📝 Write a stronger SOP\n5. 🏦 Consider a different university if needed\n\nBring your refusal letter to your counsellor — they'll help you build a much stronger reapplication! 🙏`,
    suggestions: ['What are my visa chances?', 'What documents do I need?', 'Which country is easiest for visa?'],
  },
  {
    id: 'visa_time',
    keywords: ['how long visa', 'visa processing time', 'visa time', 'when visa',
               'visa duration', 'how many weeks', 'processing time'],
    answer: `Visa processing times (approximate):\n\n🇬🇧 **UK:** 3–8 weeks\n🇦🇺 **Australia:** 4–10 weeks\n🇨🇦 **Canada:** 8–16 weeks ⚠️ Apply early!\n🇩🇪 **Germany:** 4–12 weeks\n🇺🇸 **USA:** 2–8 weeks\n🇳🇿 **New Zealand:** 4–8 weeks\n\n📌 Apply **at least 3 months** before your course start date. For Canada, apply **5–6 months** early.`,
    suggestions: ['Will I get my visa approved?', 'What documents do I need?', 'How long is the whole process?'],
  },
  {
    id: 'total_cost',
    keywords: ['cost', 'how much', 'total cost', 'fees', 'expensive', 'budget',
               'cheap', 'afford', 'price', 'tuition', 'living cost'],
    answer: `Approximate total annual cost (tuition + living):\n\n🇬🇧 **UK:** GBP 18,000–30,000/year (~NPR 31–52 lakh)\n🇦🇺 **Australia:** AUD 28,000–45,000/year (~NPR 26–42 lakh)\n🇨🇦 **Canada:** CAD 25,000–40,000/year (~NPR 26–41 lakh)\n🇩🇪 **Germany:** EUR 8,000–15,000/year (~NPR 12–22 lakh) ✅ Cheapest!\n🇺🇸 **USA:** USD 30,000–60,000/year (most expensive)\n\n💡 Studying in smaller regional cities cuts living costs by 30–40%!`,
    suggestions: ['Are there scholarships available?', 'How much bank balance do I need?', 'Which country is best for PR?'],
  },
  {
    id: 'scholarship',
    keywords: ['scholarship', 'scholarship available', 'funded', 'fully funded',
               'financial aid', 'bursary', 'fee waiver', 'grant', 'free study'],
    answer: `Yes, scholarships are available for Nepali students! 🎓\n\n**Fully funded:**\n• 🏆 Chevening Scholarship (UK)\n• 🌏 Australia Awards\n• 🌐 ADB Scholarships\n\n**Partial scholarships:**\n• Most universities offer merit scholarships (10–50% reduction)\n• Erasmus+ programme (European universities)\n\nAsk your counsellor which universities offer automatic merit discounts for your profile! 💰`,
    suggestions: ['Which country is cheapest?', 'What IELTS score do I need?', 'How do I start the application?'],
  },
  {
    id: 'work_abroad',
    keywords: ['work while studying', 'part time', 'part-time job', 'work hours',
               'can i work', 'job abroad', 'earn money', 'working student'],
    answer: `Yes, you can work while studying!\n\n🇬🇧 **UK:** 20 hrs/week during term\n🇦🇺 **Australia:** 48 hrs per fortnight\n🇨🇦 **Canada:** 20 hrs/week off-campus\n🇩🇪 **Germany:** 120 full days per year\n🇳🇿 **New Zealand:** 20 hrs/week\n🇺🇸 **USA:** On-campus only ⚠️\n\n💰 **Typical wages:** UK GBP 11–13/hr · Australia AUD 23–27/hr · Canada CAD 15–20/hr`,
    suggestions: ['Can I get PR after studying?', 'How much does studying cost?', 'Which country is best for PR?'],
  },
  {
    id: 'pr_pathway',
    keywords: ['pr', 'permanent residency', 'permanent residence', 'stay after study',
               'immigration', 'settle abroad', 'citizenship', 'residency'],
    answer: `Many countries offer clear pathways from student to PR! 🌟\n\n🇨🇦 **Canada** (most popular): Express Entry, PNP — 2–4 years after graduation\n🇦🇺 **Australia:** Graduate Visa (485) — 2–4 years post-study work\n🇬🇧 **UK:** Graduate Route Visa — 2 years post-study work\n🇩🇪 **Germany:** 18-month job seeker visa → EU Blue Card → PR in 21 months\n\n💡 **PR-friendly courses:** Nursing, IT, Engineering, Accounting, Healthcare`,
    suggestions: ['Which course gives best PR chances?', 'Can I work while studying?', 'Which country should I choose?'],
  },
  {
    id: 'timeline',
    keywords: ['how long process', 'how long does it take', 'timeline', 'total time',
               'process time', 'when start', 'how many months', 'step by step'],
    answer: `Here's the typical timeline:\n\n📅 **Month 1–2:** Counselling, choose country & course, IELTS\n📅 **Month 2–3:** Collect documents, write SOP, apply to university\n📅 **Month 3–4:** Receive offer letter, pay deposit\n📅 **Month 4–5:** Get CAS/CoE, prepare visa documents\n📅 **Month 5–6:** Submit visa application\n📅 **Month 6–8:** Visa decision\n📅 **Month 8–9:** Pre-departure briefing, travel! ✈️\n\n⏰ **Total: typically 6–9 months**`,
    suggestions: ['When should I start for September intake?', 'What is a CAS number?', 'What documents do I need?'],
  },
  {
    id: 'country_choice',
    keywords: ['which country', 'best country', 'uk vs australia', 'canada vs australia',
               'where to go', 'country choice', 'which is better', 'compare countries'],
    answer: `Here's how top destinations compare:\n\n🇨🇦 **Canada** — Best for PR. Open Work Permit for spouse.\n🇦🇺 **Australia** — Best balance. High wages, good PR paths.\n🇬🇧 **UK** — Best for prestige. Shorter 3-year degrees.\n🇩🇪 **Germany** — Best value. No tuition at public universities!\n🇳🇿 **New Zealand** — Most peaceful. Safe and manageable cost.\n\n💡 Your counsellor will recommend based on your course, budget, and PR goals!`,
    suggestions: ['Which course gives best PR?', 'How much does it cost?', 'What IELTS score do I need?'],
  },
  {
    id: 'sop',
    keywords: ['sop', 'statement of purpose', 'personal statement', 'cover letter',
               'motivation letter', 'why study', 'essay'],
    answer: `Your SOP is one of the most important documents! 📝\n\n**A strong SOP covers:**\n1. 🎓 Your academic background\n2. 💡 Why this specific course?\n3. 🌍 Why this country/university?\n4. 🎯 Your career goals after graduation\n5. 🏠 Why you will return to Nepal (important for visa!)\n\nKeep it honest, 1–2 pages (500–800 words). Global Pathway counsellors help you write and review your SOP! ✍️`,
    suggestions: ['What documents do I need?', 'What are my visa chances?', 'How do I start the application?'],
  },
]

function findIntent(userMessage) {
  const msg = userMessage.toLowerCase().trim()
  let bestScore = 0, bestIntent = null
  for (const intent of INTENTS) {
    let score = 0
    for (const keyword of intent.keywords) {
      if (msg.includes(keyword.toLowerCase())) score += keyword.length
    }
    if (score > bestScore) { bestScore = score; bestIntent = intent }
  }
  return bestScore >= 3 ? bestIntent : null
}

const INITIAL_SUGGESTIONS = [
  'What documents do I need?',
  'What IELTS score do I need?',
  'What are my visa chances?',
  'Can I work while studying?',
  'Which country is best for PR?',
  'How much does studying cost?',
]

function BotAvatar() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, flexShrink: 0,
    }}>🤖</div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <BotAvatar />
      <div style={{
        background: '#f3f4f6', borderRadius: '14px 14px 14px 4px',
        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#9ca3af',
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
          <div key={i} style={{ fontSize: 12, lineHeight: 1.6, color: '#1f2937' }}>
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

// ── FLOATING CHATBOT WIDGET ────────────────────────────────────────────────
function ChatBotWidget({ navigate }) {
  const profile = JSON.parse(localStorage.getItem('profile') || '{}')
  const firstName = (profile.name || 'there').split(' ')[0]

  const [open,        setOpen]        = useState(false)
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [isTyping,    setIsTyping]    = useState(false)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const [unread,      setUnread]      = useState(0)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    setTimeout(() => {
      const greeting = {
        id: 1, role: 'bot',
        text: `Hi ${firstName}! 👋 I'm the **GP Assistant**.\n\nI can answer questions about **documents, IELTS, visa, costs, work rights, PR pathways** and more.\n\nWhat would you like to know?`,
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
          text: `Hmm, I'm not sure about that specific question. 🤔\n\nTry one of the suggestions below, or **chat with your counsellor** for personalised help!`,
          isFallback: true,
        }])
        setSuggestions(['What documents do I need?', 'What IELTS score do I need?', 'What are my visa chances?', 'How long does the process take?'])
      }
    }, delay)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function handleOpen() {
    setOpen(true)
    setUnread(0)
  }

  return (
    <>
      {/* ── CHAT POPUP WINDOW ── */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 90, right: 28,
          width: 360,
          height: 500,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'popIn 0.2s ease-out',
        }}>
          <style>{`
            @keyframes popIn {
              from { opacity:0; transform: scale(0.92) translateY(10px); }
              to   { opacity:1; transform: scale(1)    translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #1e40af 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>GP Assistant</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}/>
                Online • Answers instantly
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: '50%', width: 26, height: 26,
                color: '#fff', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '12px 12px 6px',
            display: 'flex', flexDirection: 'column', gap: 10,
            background: '#fafafa',
          }}>
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', background: '#2563eb', color: '#fff',
                      borderRadius: '14px 14px 4px 14px', padding: '8px 12px',
                      fontSize: 12, lineHeight: 1.5,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', maxWidth: '90%' }}>
                    <BotAvatar />
                    <div style={{
                      background: '#fff', border: '1px solid #e5e7eb',
                      borderRadius: '14px 14px 14px 4px', padding: '10px 12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}>
                      <BotMessage text={msg.text} />
                      {msg.isHandoff && (
                        <button
                          onClick={() => { setOpen(false); navigate('/student/chat') }}
                          style={{
                            marginTop: 8, fontSize: 11, fontWeight: 600, color: '#fff',
                            background: '#2563eb', border: 'none', borderRadius: 7,
                            padding: '5px 12px', cursor: 'pointer', display: 'block',
                          }}
                        >💬 Open Chat →</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isTyping && <TypingIndicator />}

            {/* Suggestion chips */}
            {!isTyping && suggestions.length > 0 && (
              <div style={{ paddingLeft: 35, display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    color: '#1d4ed8', fontWeight: 500,
                  }}>{s}</button>
                ))}
                <button onClick={() => { setOpen(false); navigate('/student/chat') }} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  color: '#15803d', fontWeight: 500,
                }}>💬 Talk to counsellor</button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '8px 12px', borderTop: '1px solid #e5e7eb',
            background: '#fff', display: 'flex', gap: 7, alignItems: 'center',
            flexShrink: 0,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about visa, IELTS, costs..."
              disabled={isTyping}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 20,
                border: '1.5px solid #e5e7eb', fontSize: 12,
                outline: 'none', background: '#f9fafb', color: '#111827',
              }}
              onFocus={e => e.target.style.borderColor = '#2563eb'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                background: input.trim() && !isTyping ? '#2563eb' : '#e5e7eb',
                color: '#fff', fontSize: 14, cursor: input.trim() && !isTyping ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >➤</button>
          </div>
        </div>
      )}

      {/* ── FLOATING BUTTON ── */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        style={{
          position: 'fixed',
          bottom: 28, right: 28,
          width: 56, height: 56,
          borderRadius: '50%',
          background: open ? '#374151' : 'linear-gradient(135deg, #1e40af, #4f46e5)',
          border: 'none',
          boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
          zIndex: 1001,
          transition: 'all 0.2s',
        }}
        title="Ask GP Assistant"
      >
        {open ? '✕' : '🤖'}
        {/* Unread badge */}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {unread}
          </div>
        )}
      </button>
    </>
  )
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate()
  const profile  = JSON.parse(localStorage.getItem('profile') || '{}')

  const [payments, setPayments] = useState([])
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!profile.id) { navigate('/login'); return }
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: pays } = await supabase
        .from('payments').select('*')
        .eq('student_name', profile.name || '')
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
    if (status === 'paid')                 return { bg: '#dcfce7', color: '#15803d' }
    if (status === 'pending')              return { bg: '#fef9c3', color: '#a16207' }
    if (status === 'pending_verification') return { bg: '#dbeafe', color: '#1d4ed8' }
    if (status === 'overdue')              return { bg: '#fee2e2', color: '#b91c1c' }
    return { bg: '#f3f4f6', color: '#6b7280' }
  }

  if (loading) {
    return (
      <StudentLayout>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Loading your dashboard...</p>
      </StudentLayout>
    )
  }

  return (
    <StudentLayout>

      {/* ── GREETING ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            Welcome back, {(profile.name || 'Student').split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Here's your application overview
          </p>
        </div>
        {/* Small hint next to greeting */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#eff6ff00', border: '1px solid #bfdbfe00',
          borderRadius: 10, padding: '8px 14px',
          fontSize: 12, color: '#1d4ed8', fontWeight: 500,
        }}>
        
         
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Payments', value: payments.length, icon: '🧾', bg: '#eff6ff' },
          {
            label: 'Amount Paid',
            value: `Rs ${payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}`,
            icon: '✅', bg: '#f0fdf4',
          },
          { label: 'Pending Tasks', value: tasks.filter(t => t.status === 'pending').length, icon: '⏳', bg: '#fefce8' },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 10, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: card.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PAYMENT HISTORY ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontSize: 15, fontWeight: 700, color: '#111827' }}>
          Payment History
        </div>
        {payments.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No payment records yet</div>
        ) : (
          payments.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 18px',
              borderBottom: i < payments.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 2 }}>
                  Rs {p.amount?.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
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
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', fontSize: 15, fontWeight: 700, color: '#111827' }}>
          Your Next Steps
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No tasks assigned yet</div>
        ) : (
          tasks.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
              borderBottom: i < tasks.length - 1 ? '1px solid #e5e7eb' : 'none',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: t.priority === 'High' ? '#ef4444' : t.priority === 'Urgent' ? '#dc2626' : '#16a34a',
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{t.title}</div>
                {t.due_date && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Due: {new Date(t.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: t.status === 'done' ? '#dcfce7' : '#fef9c3',
                color:      t.status === 'done' ? '#15803d' : '#a16207',
              }}>
                {t.status}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── FLOATING CHATBOT ── */}
      <ChatBotWidget navigate={navigate} />

    </StudentLayout>
  )
}