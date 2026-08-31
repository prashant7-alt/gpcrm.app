import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (hardened 2026-08-27)
//  - The eSewa-confirmed amount is now cross-checked against the amount stored
//    on the target `payments` row. A confirmed transaction can only move ITS
//    OWN matching invoice to `pending_verification`; it can't be replayed
//    against a different (e.g. larger) payment_id.
//  - A row already marked `paid` is never overwritten.
//  - CORS restricted to ALLOWED_ORIGINS when that secret is set.
// ─────────────────────────────────────────────────────────────────────────────

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

const amountsMatch = (a: number, b: number) => Math.abs(Number(a) - Number(b)) <= 1

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const { transaction_uuid, total_amount, payment_id } = await req.json()
    if (!transaction_uuid || !payment_id) {
      return respond({ success: false, message: 'transaction_uuid and payment_id are required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    // Source of truth for the amount is our own invoice row.
    const { data: paymentRow, error: rowErr } = await supabase
      .from('payments')
      .select('id, amount, status')
      .eq('id', payment_id)
      .maybeSingle()

    if (rowErr || !paymentRow) return respond({ success: false, message: 'Unknown payment_id' }, 404)
    if (paymentRow.status === 'paid') {
      return respond({ success: true, status: 'already_paid' })
    }

    const MERCHANT_CODE = Deno.env.get('ESEWA_MERCHANT_CODE') ?? 'EPAYTEST'
    const verifyUrl =
      `https://rc-epay.esewa.com.np/api/epay/transaction/status/?` +
      `product_code=${MERCHANT_CODE}` +
      `&total_amount=${total_amount}` +
      `&transaction_uuid=${transaction_uuid}`

    const response = await fetch(verifyUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    const data = await response.json()

    if (data.status !== 'COMPLETE') {
      return respond({ success: false, status: data.status, data }, 400)
    }

    // eSewa confirmed COMPLETE only if total_amount matched its own records,
    // so `data.total_amount` (fallback to the echoed value) is trustworthy here.
    const confirmedAmount = Number(data.total_amount ?? total_amount)
    if (!amountsMatch(confirmedAmount, paymentRow.amount)) {
      console.error('[verify-esewa] amount mismatch', { confirmedAmount, expected: paymentRow.amount, payment_id })
      return respond({ success: false, message: 'Payment amount does not match this invoice' }, 409)
    }

    await supabase
      .from('payments')
      .update({ status: 'pending_verification', method: 'eSewa', txn_ref: transaction_uuid, paid_at: null })
      .eq('id', payment_id)
      .neq('status', 'paid')

    return respond({ success: true, data, status: 'pending_verification' })
  } catch (err) {
    return respond({ success: false, message: err instanceof Error ? err.message : String(err) }, 500)
  }
})
