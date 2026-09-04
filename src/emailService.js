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

// ── EmailJS config ───────────────────────────────────────────────────────────
// All values come from Vite env vars (see .env.example). The EmailJS "public
// key" is designed to be shipped in the browser bundle, but the service and
// template ids are kept out of source so they can differ per environment and
// are never hardcoded here.
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

const TEMPLATE = {
  WELCOME: import.meta.env.VITE_EMAILJS_TEMPLATE_WELCOME,
  PAYMENT: import.meta.env.VITE_EMAILJS_TEMPLATE_PAYMENT,
}

if (!SERVICE_ID || !PUBLIC_KEY || !TEMPLATE.WELCOME || !TEMPLATE.PAYMENT) {
  console.error(
    'Missing VITE_EMAILJS_* env vars — welcome / payment emails will not be sent',
  )
}

// initialise EmailJS once
if (PUBLIC_KEY) emailjs.init(PUBLIC_KEY)

// ─────────────────────────────────────────────────────────────────────────────
// sendWelcomeEmail
// Call this when admin creates a new student account. The email delivers the
// student's login email + password so they can sign in to the portal.
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
    console.log('Welcome email sent to', student_email)
    return { success: true, result }
  } catch (error) {
    console.error('Welcome email failed:', error)
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
    console.log('Payment email sent to', student_email)
    return { success: true, result }
  } catch (error) {
    console.error('Payment email failed:', error)
    return { success: false, error }
  }
}