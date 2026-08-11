// supabase/functions/khalti-verify/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

const KHALTI_SECRET = Deno.env.get('KHALTI_SECRET_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')       ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { pidx, payment_id, simulate } = body

    console.log('[khalti-verify] received:', { pidx, payment_id, simulate })

    // ── SIMULATE MODE ──────────────────────────────────────────
    if (simulate) {
      if (!payment_id) {
        return Response.json({ completed: false, error: 'payment_id required' }, { headers: cors })
      }
      // ✅ pending_verification so admin still clicks Mark Paid + email fires
      const { error } = await supabase
        .from('payments')
        .update({
          status:  'pending_verification',
          method:  'Khalti',
          txn_ref: pidx || `SIM-${Date.now()}`,
        })
        .eq('id', payment_id)

      if (error) {
        console.error('[khalti-verify] simulate DB error:', error)
        return Response.json({ completed: false, error: error.message }, { headers: cors })
      }
      return Response.json({ completed: true, simulated: true }, { headers: cors })
    }

    // ── REAL VERIFICATION ──────────────────────────────────────
    if (!pidx) {
      return Response.json({ completed: false, error: 'pidx required' }, { headers: cors })
    }

    const khaltiRes = await fetch('https://a.khalti.com/api/v2/epayment/lookup/', {
      method:  'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ pidx }),
    })

    const khaltiData = await khaltiRes.json()
    console.log('[khalti-verify] Khalti response:', khaltiData)

    const isCompleted = khaltiData.status === 'Completed'

    if (isCompleted && payment_id) {
      // ✅ pending_verification NOT paid — admin confirms + email fires
      const { error } = await supabase
        .from('payments')
        .update({
          status:  'pending_verification',
          method:  'Khalti',
          txn_ref: pidx,
          amount:  khaltiData.total_amount / 100,
        })
        .eq('id', payment_id)

      if (error) console.error('[khalti-verify] DB update error:', error)
    }

    return Response.json({
      completed: isCompleted,
      status:    khaltiData.status,
      amount:    khaltiData.total_amount,
    }, { headers: cors })

  } catch (err) {
    console.error('[khalti-verify] error:', err)
    return Response.json({ completed: false, error: String(err) }, { headers: cors })
  }
})