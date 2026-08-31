import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (hardened 2026-08-27)
//  - Requires a valid Supabase session (Authorization: Bearer <jwt>).
//  - The charge amount is taken from the `payments` row identified by
//    `payment_id`, NOT from the client. A student can no longer initiate a
//    Rs 1 payment against a Rs 50,000 invoice.
//  - The caller must own that payment row (matched on student_email).
//  - CORS restricted to ALLOWED_ORIGINS when that secret is set.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allow =
    ALLOWED_ORIGINS.length === 0 ? (origin || '*')
    : ALLOWED_ORIGINS.includes(origin) ? origin
    : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ success: false, error: 'Missing Authorization header' }, 401)
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
    if (authErr || !user) return json({ success: false, error: 'Invalid or expired session' }, 401)

    const { payment_id, student_name, return_url } = await req.json()
    if (!payment_id) return json({ success: false, error: 'payment_id is required' }, 400)

    const { data: me } = await admin.from('profiles').select('email').eq('id', user.id).maybeSingle()
    const { data: row, error: rowErr } = await admin
      .from('payments')
      .select('id, amount, status, student_email')
      .eq('id', payment_id)
      .maybeSingle()

    if (rowErr || !row) return json({ success: false, error: 'Unknown payment_id' }, 404)
    if (me?.email && row.student_email && me.email.toLowerCase() !== String(row.student_email).toLowerCase()) {
      return json({ success: false, error: 'This payment does not belong to you' }, 403)
    }
    if (row.status === 'paid') return json({ success: false, error: 'This payment is already paid' }, 409)

    const KHALTI_SECRET_KEY = Deno.env.get('KHALTI_SECRET_KEY')
    const SITE_URL          = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    if (!KHALTI_SECRET_KEY) return json({ success: false, error: 'KHALTI_SECRET_KEY not configured' }, 500)

    const amountPaisa = Math.round(Number(row.amount) * 100) // authoritative, from DB
    const safeName = (student_name && String(student_name).trim()) ? String(student_name).trim() : 'Student'

    const payload = {
      return_url:          return_url || `${SITE_URL}/payment/khalti-success`,
      website_url:         SITE_URL,
      amount:              amountPaisa,
      purchase_order_id:   payment_id,
      purchase_order_name: `Payment by ${safeName}`,
      customer_info:       { name: safeName },
    }

    const response = await fetch('https://dev.khalti.com/api/v2/epayment/initiate/', {
      method: 'POST',
      headers: { 'Authorization': `Key ${KHALTI_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()

    if (!response.ok) {
      const errMsg = data?.detail || data?.error_key || data?.message || JSON.stringify(data)
      return json({ success: false, error: errMsg }, 400)
    }
    if (!data.payment_url) {
      return json({ success: false, error: 'No payment_url in Khalti response', raw: data }, 400)
    }

    return json({ success: true, payment_url: data.payment_url, pidx: data.pidx })
  } catch (err) {
    console.error('[khalti-initiate] error:', err)
    return json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
