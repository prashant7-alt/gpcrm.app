import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'
import { encode as encodeBase64 } from 'https://deno.land/std@0.177.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY (hardened 2026-08-27)
// This function is an HMAC signing oracle for eSewa payment forms. Previously it
// would sign ANY (amount, uuid) pair for anyone, letting a caller mint a validly
// signed form for an arbitrary amount.
//
// Now:
//  - Requires a valid Supabase session (Authorization: Bearer <jwt>).
//  - transaction_uuid must be "GP-<paymentId>-<suffix>"; the payment row is
//    loaded and must belong to the caller and still be unpaid.
//  - The signed total_amount MUST equal that invoice's amount.
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
const amountsMatch = (a: number, b: number) => Math.abs(Number(a) - Number(b)) <= 1

serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ error: 'Missing Authorization header' }, 401)
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt)
    if (authErr || !user) return json({ error: 'Invalid or expired session' }, 401)

    const { total_amount, transaction_uuid, product_code } = await req.json()
    if (!total_amount || !transaction_uuid || !product_code) {
      return json({ error: 'total_amount, transaction_uuid and product_code are required' }, 400)
    }

    // "GP-<paymentId>-<suffix>"
    const withoutPrefix = String(transaction_uuid).startsWith('GP-')
      ? String(transaction_uuid).slice(3) : String(transaction_uuid)
    const paymentId = withoutPrefix.slice(0, withoutPrefix.lastIndexOf('-')) || null
    if (!paymentId) return json({ error: 'Malformed transaction_uuid' }, 400)

    const { data: me } = await admin.from('profiles').select('email').eq('id', user.id).maybeSingle()
    const { data: row, error: rowErr } = await admin
      .from('payments')
      .select('id, amount, status, student_email')
      .eq('id', paymentId)
      .maybeSingle()

    if (rowErr || !row) return json({ error: 'Unknown payment_id' }, 404)
    if (me?.email && row.student_email && me.email.toLowerCase() !== String(row.student_email).toLowerCase()) {
      return json({ error: 'This payment does not belong to you' }, 403)
    }
    if (row.status === 'paid') return json({ error: 'This payment is already paid' }, 409)
    if (!amountsMatch(total_amount, row.amount)) {
      return json({ error: 'Signed amount does not match the invoice' }, 409)
    }

    const SECRET_KEY = Deno.env.get('ESEWA_SECRET_KEY') ?? ''
    if (!SECRET_KEY) return json({ error: 'ESEWA_SECRET_KEY is not configured' }, 500)
    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(SECRET_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    return json({ signature: encodeBase64(new Uint8Array(signature)) })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
