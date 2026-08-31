// ── Payment receipt ─────────────────────────────────────────────────────
// One shared, print-ready receipt used by both the staff Payments page and
// the student portal, so every receipt looks the same.
//
//   openReceipt(payment)      -> opens a new window with the receipt + a
//                                Print button (falls back to same-tab if the
//                                browser blocks the popup)
//   buildReceiptHTML(payment) -> the full HTML string (for embedding)
//   receiptNumber(payment)    -> the "GP-XXXXXXXX" number
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
  .actions{max-width:620px;margin:18px auto 0;display:flex;gap:10px;justify-content:flex-end}
  .actions button{padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;border:none}
  .btn-print{background:${palette.blue};color:${palette.white}}.btn-close{background:${palette.surface};color:${palette.textMuted};border:1px solid ${palette.border}}
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
<div class="actions"><button class="btn-close" onclick="window.close()">Close</button><button class="btn-print" onclick="window.print()">&#128424; Print Receipt</button></div>
</body></html>`
}

/**
 * Open the receipt in a new window with a Print button. If the browser blocks
 * the popup, fall back to replacing the current tab (the user can print then
 * use Back).
 */
export function openReceipt(payment) {
  const html = buildReceiptHTML(payment)
  const win = window.open('', '_blank', 'width=720,height=900')
  if (win) {
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    return
  }
  // Popup blocked — use a data URL in the same tab as a fallback.
  const blob = new Blob([html], { type: 'text/html' })
  window.location.href = URL.createObjectURL(blob)
}
