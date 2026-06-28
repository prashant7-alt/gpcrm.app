/**
 * emailService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmailJS integration for Global Pathway CRM
 *
 * SETUP:
 *   1. Install emailjs:
 *      npm install @emailjs/browser
 *
 *   2. Copy this file to: src/emailService.js
 *
 *   3. Import and use in your components:
 *      import { sendWelcomeEmail, sendPaymentConfirmedEmail } from '../emailService'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import emailjs from '@emailjs/browser'

// ── EmailJS credentials ───────────────────────────────────────────────────────
const SERVICE_ID  = 'service_c3scccw'
const PUBLIC_KEY  = 'hZjBQERs-KUmUgybU'

const TEMPLATE = {
  WELCOME:  'template_4t9wjct',
  PAYMENT:  'template_8eq6dch',
}

// initialise EmailJS once
emailjs.init(PUBLIC_KEY)

// ─────────────────────────────────────────────────────────────────────────────
// sendWelcomeEmail
// Call this when admin creates a new student account
//
// Usage:
//   await sendWelcomeEmail({
//     student_name:     'Ram Sharma',
//     student_email:    'ram@gmail.com',
//     student_password: 'Pass1234',
//   })
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWelcomeEmail({ student_name, student_email, student_password }) {
  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATE.WELCOME, {
      student_name,
      student_email,
      student_password,
    })
    console.log('✅ Welcome email sent to', student_email)
    return { success: true, result }
  } catch (error) {
    console.error('❌ Welcome email failed:', error)
    return { success: false, error }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendPaymentConfirmedEmail
// Call this when admin marks a payment as "paid"
//
// Usage:
//   await sendPaymentConfirmedEmail({
//     student_name:  'Ram Sharma',
//     student_email: 'ram@gmail.com',
//     amount:        '5000',
//     payment_type:  'Visa Fee',
//     method:        'eSewa',
//     date:          '2025-01-18',
//     reference:     'TXN123456',
//   })
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPaymentConfirmedEmail({
  student_name,
  student_email,
  amount,
  payment_type,
  method,
  date,
  reference,
}) {
  try {
    const result = await emailjs.send(SERVICE_ID, TEMPLATE.PAYMENT, {
      student_name,
      student_email,
      amount,
      payment_type,
      method,
      date:      date || new Date().toLocaleDateString(),
      reference: reference || '—',
    })
    console.log('✅ Payment email sent to', student_email)
    return { success: true, result }
  } catch (error) {
    console.error('❌ Payment email failed:', error)
    return { success: false, error }
  }
}