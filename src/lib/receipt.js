// ── Payment receipt ─────────────────────────────────────────────────────
// One shared receipt used by both the staff Payments page and the student
// portal, so every receipt looks the same.
//
//   openReceipt(payment)       -> opens a preview window with Close / Print /
//                                 Download PDF buttons (falls back to a new
//                                 tab / same tab if the popup is blocked)
//   downloadReceiptPDF(payment)-> generates a real .pdf file and downloads it
//                                 straight away (no print dialog); jsPDF is
//                                 loaded on demand so it stays out of the
//                                 main bundle
//   buildReceiptHTML(payment)  -> the full HTML string (for the preview window)
//   receiptNumber(payment)     -> the "GP-XXXXXXXX" number
//
// Colours are pulled from src/theme.js so the receipt restyles with the app.

import { palette, status } from '../theme'

export function receiptNumber(payment) {
  const idPart = String(payment.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return `GP-${idPart || '00000000'}`
}

const esc = (str) =>
  String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const longDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

const shortTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

export function buildReceiptHTML(payment) {
  const rcpt   = receiptNumber(payment)
  const amount = Number(payment.amount || 0).toLocaleString()

  // Prefer the confirmed-paid timestamp, then an explicit date, then created.
  const paidSource = payment.paid_at || payment.date || payment.created_at || Date.now()
  const date = longDate(paidSource)
  const time = payment.paid_at ? shortTime(payment.paid_at) : ''

  const ref    = payment.txn_ref || payment.reference || payment.pidx || '—'
  const isPaid = String(payment.status || '').toLowerCase() === 'paid'
  const issued = `${longDate(Date.now())} at ${shortTime(Date.now())}`

  const statusPill = isPaid
    ? `<div class="status-pill paid">&#10003; Paid</div>`
    : `<div class="status-pill pending">Pending confirmation</div>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt ${esc(rcpt)}</title>
<style>
  @page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:${palette.surface};padding:40px 20px;color:${palette.textStrong}}
  .sheet{max-width:620px;margin:0 auto;background:${palette.white};border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
  .band{height:6px;background:linear-gradient(90deg,${palette.navy} 0%,${palette.blue} 55%,${palette.teal} 100%)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding:32px 36px 24px;border-bottom:1px solid ${palette.border}}
  .brand{display:flex;align-items:center;gap:12px}
  .brand-mark{width:46px;height:46px;border-radius:12px;background:${palette.navy};display:flex;align-items:center;justify-content:center;color:${palette.white};font-weight:800;font-size:18px}
  .brand-name{font-size:16px;font-weight:800;color:${palette.textStrong}}.brand-sub{font-size:11.5px;color:${palette.textMuted};margin-top:2px}
  .receipt-tag{text-align:right}.receipt-tag .label{font-size:10.5px;font-weight:700;color:${palette.textFaint};text-transform:uppercase;letter-spacing:.08em}
  .receipt-tag .num{font-size:17px;font-weight:800;color:${palette.textStrong};margin-top:3px}
  .status-pill{display:inline-flex;align-items:center;gap:5px;margin-top:8px;padding:3px 11px;border-radius:20px;font-size:11px;font-weight:700}
  .status-pill.paid{background:${status.success.bg};color:${status.success.text}}
  .status-pill.pending{background:${status.warning.bg};color:${status.warning.text}}
  .body{padding:30px 36px 8px}
  .amount-block{text-align:center;padding:22px 0 26px;border-bottom:1px dashed ${palette.borderStrong};margin-bottom:22px}
  .amount-block .label{font-size:11px;color:${palette.textFaint};text-transform:uppercase;letter-spacing:.08em;font-weight:700}
  .amount-block .value{font-size:38px;font-weight:800;color:${palette.textStrong};margin-top:6px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px 24px;margin-bottom:28px}
  .field .label{font-size:10.5px;font-weight:700;color:${palette.textFaint};text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .field .value{font-size:14px;font-weight:600;color:${palette.textStrong};word-break:break-word}.field .value.muted{font-weight:400;color:${palette.textMuted}}
  .note-box{background:${palette.surface};border:1px solid ${palette.border};border-radius:10px;padding:14px 16px;margin-bottom:24px;font-size:12.5px;color:${palette.textMuted}}
  .footer{padding:22px 36px 32px;border-top:1px solid ${palette.border};text-align:center}
  .footer .thanks{font-size:13px;font-weight:700;color:${palette.textStrong};margin-bottom:4px}
  .footer .small{font-size:11px;color:${palette.textFaint};line-height:1.6}
  .actions{max-width:620px;margin:18px auto 0;display:flex;gap:10px;justify-content:flex-end;align-items:center}
  .actions button{padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:none}
  .btn-pdf{background:${palette.navy};color:${palette.white}}
  .btn-print{background:${palette.blue};color:${palette.white}}.btn-close{background:${palette.surface};color:${palette.textMuted};border:1px solid ${palette.border}}
  .actions .hint{margin-right:auto;font-size:11px;color:${palette.textFaint}}
  @media print{body{background:${palette.white};padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}.actions{display:none}}
</style></head><body>
<div class="sheet"><div class="band"></div>
<div class="header">
  <div class="brand"><div class="brand-mark">GP</div><div><div class="brand-name">Global Pathway</div><div class="brand-sub">Consultancy CRM</div></div></div>
  <div class="receipt-tag"><div class="label">Receipt No.</div><div class="num">${esc(rcpt)}</div>${statusPill}</div>
</div>
<div class="body">
  <div class="amount-block"><div class="label">${isPaid ? 'Amount Received' : 'Amount'}</div><div class="value">Rs ${esc(amount)}</div></div>
  <div class="grid">
    <div class="field"><div class="label">${isPaid ? 'Received From' : 'Billed To'}</div><div class="value">${esc(payment.student_name || '—')}</div></div>
    <div class="field"><div class="label">Payment Type</div><div class="value">${esc(payment.type || 'Payment')}</div></div>
    <div class="field"><div class="label">Payment Method</div><div class="value">${esc(payment.method || '—')}</div></div>
    <div class="field"><div class="label">Date${time ? ' &amp; Time' : ''}</div><div class="value">${esc(date)}${time ? ` <span class="muted">&middot; ${esc(time)}</span>` : ''}</div></div>
    <div class="field"><div class="label">Transaction Reference</div><div class="value muted">${esc(ref)}</div></div>
    <div class="field"><div class="label">Student Email</div><div class="value muted">${esc(payment.student_email || '—')}</div></div>
  </div>
  ${payment.note ? `<div class="note-box"><strong style="color:${palette.textStrong};">Note:</strong> ${esc(payment.note)}</div>` : ''}
</div>
<div class="footer">
  <div class="thanks">${isPaid ? 'Thank you for your payment' : 'This is not proof of payment until confirmed'}</div>
  <div class="small">Receipt ${esc(rcpt)} &middot; Generated ${esc(issued)}<br/>System-generated document from Global Pathway Consultancy CRM. For queries, contact your counsellor.</div>
</div>
</div>
<div class="actions">
  <span class="hint">Print opens your browser&rsquo;s dialog &middot; Download PDF saves the file directly.</span>
  <button class="btn-close" id="rcpt-close" type="button">Close</button>
  <button class="btn-print" id="rcpt-print" type="button">&#128424; Print</button>
  <button class="btn-pdf" id="rcpt-pdf" type="button">&#11015; Download PDF</button>
</div>
</body></html>`
}

// The app ships a strict CSP (`script-src 'self'`), which the receipt window
// inherits — so inline `onclick=` handlers are blocked. Instead we wire the
// buttons from here with addEventListener (allowed: same-origin, no inline
// script). `win` is same-origin with the opener so `win.document` is reachable.
function wireReceiptControls(win, payment, { print = false } = {}) {
  const bind = () => {
    let doc
    try { doc = win.document } catch { return false }
    if (!doc || !doc.getElementById('rcpt-close')) return false
    const on = (id, fn) => {
      const el = doc.getElementById(id)
      if (el) el.addEventListener('click', fn)
    }
    on('rcpt-close', () => { try { win.close() } catch { /* noop */ } })
    on('rcpt-print', () => { try { win.focus(); win.print() } catch { /* noop */ } })
    on('rcpt-pdf',   () => { downloadReceiptPDF(payment) })
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { try { win.close() } catch { /* noop */ } }
    })
    if (print) { try { win.focus(); win.print() } catch { /* noop */ } }
    return true
  }

  // A document.write'd window is ready synchronously; a navigated blob URL is
  // not, so retry briefly until the receipt DOM shows up.
  if (bind()) return
  const started = Date.now()
  const timer = setInterval(() => {
    if (bind() || Date.now() - started > 5000 || win.closed) clearInterval(timer)
  }, 80)
}

/**
 * Open the receipt in a new window with Close / Print / Download PDF buttons.
 * If the browser blocks the popup, fall back to the current tab (the buttons
 * won't wire there, but the browser's own print — Ctrl/Cmd+P — still works).
 */
export function openReceipt(payment, { print = false } = {}) {
  const html = buildReceiptHTML(payment)
  const win = window.open('', '_blank', 'width=720,height=900')
  if (win) {
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    wireReceiptControls(win, payment, { print })
    return
  }
  // Popup blocked — try a new tab from a blob URL, else replace this tab.
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const tab = window.open(url, '_blank')
  if (tab) wireReceiptControls(tab, payment, { print })
  else window.location.href = url
}

// ── Real PDF (vector text, no print dialog) ─────────────────────────────
const pdfDash = '-'

async function buildReceiptDoc(payment) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const P = palette

  const rcpt   = receiptNumber(payment)
  const amount = Number(payment.amount || 0).toLocaleString()
  const paidSource = payment.paid_at || payment.date || payment.created_at || Date.now()
  const date   = longDate(paidSource)
  const time   = payment.paid_at ? shortTime(payment.paid_at) : ''
  const ref    = payment.txn_ref || payment.reference || payment.pidx || pdfDash
  const isPaid = String(payment.status || '').toLowerCase() === 'paid'
  const issued = `${longDate(Date.now())} at ${shortTime(Date.now())}`

  const M = 18          // page margin
  const R = 210 - M     // right edge (A4 is 210mm wide)
  const W = R - M       // content width

  // brand band
  doc.setFillColor(P.navy); doc.rect(0, 0, 92, 3, 'F')
  doc.setFillColor(P.blue); doc.rect(92, 0, 68, 3, 'F')
  doc.setFillColor(P.teal); doc.rect(160, 0, 50, 3, 'F')

  // header — brand mark + name
  doc.setFillColor(P.navy)
  doc.roundedRect(M, 14, 13, 13, 2, 2, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(P.white)
  doc.text('GP', M + 6.5, 22.3, { align: 'center' })
  doc.setFontSize(13); doc.setTextColor(P.textStrong)
  doc.text('Global Pathway', M + 17, 19.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(P.textMuted)
  doc.text('Consultancy CRM', M + 17, 24.5)

  // header — receipt number + status pill
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(P.textFaint)
  doc.text('RECEIPT NO.', R, 17, { align: 'right' })
  doc.setFontSize(13); doc.setTextColor(P.textStrong)
  doc.text(rcpt, R, 23, { align: 'right' })

  const pillText = isPaid ? 'PAID' : 'PENDING CONFIRMATION'
  const pc = isPaid ? status.success : status.warning
  doc.setFontSize(7.5)
  const pillW = doc.getTextWidth(pillText) + 7
  const pillX = R - pillW, pillY = 26.5
  doc.setFillColor(pc.bg)
  doc.roundedRect(pillX, pillY, pillW, 5.5, 2.5, 2.5, 'F')
  doc.setTextColor(pc.text)
  doc.text(pillText, pillX + pillW / 2, pillY + 3.8, { align: 'center' })

  doc.setDrawColor(P.border); doc.setLineWidth(0.3)
  doc.line(M, 36, R, 36)

  // amount
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(P.textFaint)
  doc.text(isPaid ? 'AMOUNT RECEIVED' : 'AMOUNT', 105, 46, { align: 'center' })
  doc.setFontSize(24); doc.setTextColor(P.textStrong)
  doc.text(`Rs ${amount}`, 105, 57, { align: 'center' })

  doc.setDrawColor(P.borderStrong)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(M, 66, R, 66)
  doc.setLineDashPattern([], 0)

  // field grid (2 columns)
  const fields = [
    [isPaid ? 'RECEIVED FROM' : 'BILLED TO', payment.student_name || pdfDash],
    ['PAYMENT TYPE',   payment.type || 'Payment'],
    ['PAYMENT METHOD', payment.method || pdfDash],
    [time ? 'DATE & TIME' : 'DATE', time ? `${date}  (${time})` : date],
    ['TRANSACTION REFERENCE', ref],
    ['STUDENT EMAIL', payment.student_email || pdfDash],
  ]
  const colW = (W - 10) / 2
  const colX = [M, M + colW + 10]
  let rowY = 78
  fields.forEach(([label, value], i) => {
    if (i % 2 === 0 && i > 0) rowY += 20
    const x = colX[i % 2]
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(P.textFaint)
    doc.text(label, x, rowY)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(P.textStrong)
    doc.text(doc.splitTextToSize(String(value), colW).slice(0, 2), x, rowY + 5)
  })
  let y = rowY + 22

  if (payment.note) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(P.textMuted)
    const noteLines = doc.splitTextToSize(`Note: ${payment.note}`, W - 12)
    const boxH = noteLines.length * 4.6 + 8
    doc.setFillColor(P.surface); doc.setDrawColor(P.border); doc.setLineWidth(0.3)
    doc.roundedRect(M, y, W, boxH, 2, 2, 'FD')
    doc.text(noteLines, M + 6, y + 6)
    y += boxH + 6
  }

  // footer
  const fy = 262
  doc.setDrawColor(P.border); doc.setLineWidth(0.3)
  doc.line(M, fy, R, fy)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(P.textStrong)
  doc.text(
    isPaid ? 'Thank you for your payment' : 'This is not proof of payment until confirmed',
    105, fy + 8, { align: 'center' },
  )
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(P.textFaint)
  doc.text(`Receipt ${rcpt}   Generated ${issued}`, 105, fy + 14, { align: 'center' })
  doc.text(
    'System-generated document from Global Pathway Consultancy CRM. For queries, contact your counsellor.',
    105, fy + 19, { align: 'center' },
  )

  return doc
}

/**
 * Generate the receipt as a real PDF and download it as
 * "Receipt GP-XXXXXXXX.pdf". Falls back to the print dialog if jsPDF can't
 * load for some reason.
 */
export async function downloadReceiptPDF(payment) {
  try {
    const doc = await buildReceiptDoc(payment)
    doc.save(`Receipt ${receiptNumber(payment)}.pdf`)
  } catch (err) {
    console.error('[receipt] PDF generation failed, falling back to print', err)
    openReceipt(payment, { print: true })
  }
}
