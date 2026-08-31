// supabase/functions/khalti-verify/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (hardened 2026-08-27)
//  - `simulate` mode (marks a payment confirmed with NO real money) is now
//    disabled unless the ALLOW_PAYMENT_SIMULATION secret is exactly "true".
//    Leave it unset in production.
//  - Real verifications now cross-check the Khalti-confirmed amount against the
//    amount stored on the target `payments` row, and refuse to touch a row that
//    is already `paid`. This stops a cheap real payment from being replayed to
//    flip an expensive invoice.
//  - CORS restricted to ALLOWED_ORIGINS when that secret is set.
// ─────────────────────────────────────────────────────────────────────────────

const KHALTI_SECRET = Deno.env.get('KHALTI_SECRET_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')       ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ALLOW_SIM     = Deno.env.get('ALLOW_PAYMENT_SIMULATION') === 'true'
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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

/** Amounts match if within 1 rupee (rounding between paisa <-> rupee). */
const amountsMatch = (a: number, b: number) => Math.abs(Number(a) - Number(b)) <= 1

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: cors })

  try {
    const { pidx, payment_id, simulate } = await req.json()

    // ── SIMULATE MODE (disabled in production) ─────────────────────────
    if (simulate) {
      if (!ALLOW_SIM) {
        return json({ completed: false, error: 'Payment simulation is disabled' }, 403)
      }
      if (!payment_id) return json({ completed: false, error: 'payment_id required' }, 400)

      const { error } = await supabase
        .from('payments')
        .update({ status: 'pending_verification', method: 'Khalti', txn_ref: pidx || `SIM-${Date.now()}` })
        .eq('id', payment_id)
        .neq('status', 'paid')

      if (error) return json({ completed: false, error: error.message }, 500)
      return json({ completed: true, simulated: true })
    }

    // ── REAL VERIFICATION ─────────────────────────────────────────────
    if (!pidx)       return json({ completed: false, error: 'pidx required' }, 400)
    if (!payment_id) return json({ completed: false, error: 'payment_id required' }, 400)

    // Look up the target invoice first — it is the source of truth for the amount.
    const { data: paymentRow, error: rowErr } = await supabase
      .from('payments')
      .select('id, amount, status')
      .eq('id', payment_id)
      .maybeSingle()

    if (rowErr || !paymentRow) return json({ completed: false, error: 'Unknown payment_id' }, 404)
    if (paymentRow.status === 'paid') {
      return json({ completed: true, alreadyPaid: true })
    }

    const khaltiRes = await fetch('https://a.khalti.com/api/v2/epayment/lookup/', {
      method: 'POST',
      headers: { 'Authorization': `Key ${KHALTI_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pidx }),
    })
    const khaltiData = await khaltiRes.json()
    const isCompleted = khaltiData.status === 'Completed'
    const paidRupees  = Number(khaltiData.total_amount) / 100

    if (isCompleted && !amountsMatch(paidRupees, paymentRow.amount)) {
      console.error('[khalti-verify] amount mismatch', { paidRupees, expected: paymentRow.amount, payment_id })
      return json({ completed: false, error: 'Payment amount does not match this invoice' }, 409)
    }

    if (isCompleted) {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'pending_verification', method: 'Khalti', txn_ref: pidx, amount: paidRupees })
        .eq('id', payment_id)
        .neq('status', 'paid')
      if (error) console.error('[khalti-verify] DB update error:', error)
    }

    return json({ completed: isCompleted, status: khaltiData.status, amount: khaltiData.total_amount })
  } catch (err) {
    console.error('[khalti-verify] error:', err)
    return json({ completed: false, error: String(err) }, 500)
  }
})
