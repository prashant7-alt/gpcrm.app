import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, payment_id, student_name, return_url } = await req.json()

    if (!amount || !payment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'amount and payment_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const KHALTI_SECRET_KEY = Deno.env.get('KHALTI_SECRET_KEY')
    const SITE_URL          = Deno.env.get('SITE_URL') || 'http://localhost:5173'

    if (!KHALTI_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'KHALTI_SECRET_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ FIXED: Khalti rejects an empty/whitespace-only name with
    // {"customer_info":{"name":["This field is required."]}}.
    // student_name || 'Student' alone doesn't catch an empty string in every
    // case it arrives as, so trim first and fall back explicitly.
    const safeName = (student_name && student_name.trim()) ? student_name.trim() : 'Student'

    console.log('[khalti-initiate] received amount (paisa):', amount)

    const payload = {
      return_url:          return_url || `${SITE_URL}/payment/khalti-success`,
      website_url:         SITE_URL,
      amount:              amount,   // must be in paisa — frontend converts Rs × 100 before sending
      purchase_order_id:   payment_id,
      purchase_order_name: `Payment by ${safeName}`,
      customer_info: {
        name: safeName,
      },
    }

    console.log('[khalti-initiate] sending to Khalti:', JSON.stringify(payload))

    const response = await fetch('https://dev.khalti.com/api/v2/epayment/initiate/', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log('[khalti-initiate] Khalti response:', JSON.stringify(data))

    if (!response.ok) {
      // Surface the actual Khalti error message
      const errMsg = data?.detail || data?.error_key || data?.message || JSON.stringify(data)
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!data.payment_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'No payment_url in Khalti response', raw: data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Return success: true so frontend check works
    return new Response(
      JSON.stringify({ success: true, payment_url: data.payment_url, pidx: data.pidx }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[khalti-initiate] error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})