import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transaction_uuid, total_amount, payment_id } = await req.json()

    const MERCHANT_CODE = Deno.env.get('ESEWA_MERCHANT_CODE') ?? 'EPAYTEST'

    // Ask eSewa to confirm this transaction is real
    const verifyUrl =
      `https://rc-epay.esewa.com.np/api/epay/transaction/status/?` +
      `product_code=${MERCHANT_CODE}` +
      `&total_amount=${total_amount}` +
      `&transaction_uuid=${transaction_uuid}`

    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()

    if (data.status === 'COMPLETE') {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')              ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      )

      await supabase
        .from('payments')
        .update({
          status:  'paid',
          method:  'eSewa',
          txn_ref: transaction_uuid,
          paid_at: new Date().toISOString(),
        })
        .eq('id', payment_id)

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, status: data.status, data }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})