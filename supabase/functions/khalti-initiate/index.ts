const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, payment_id, student_name, description } = await req.json()

    if (!amount || !payment_id) {
      return new Response(
        JSON.stringify({ error: 'amount and payment_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const KHALTI_SECRET_KEY = Deno.env.get('KHALTI_SECRET_KEY')
    const SITE_URL = Deno.env.get('SITE_URL') || 'http://localhost:5173'

    if (!KHALTI_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'KHALTI_SECRET_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = {
      return_url:          `${SITE_URL}/payment/khalti-success`,
      website_url:         SITE_URL,
      amount:              Math.round(amount * 100),
      purchase_order_id:   payment_id,
      purchase_order_name: description || `Payment for ${student_name}`,
      customer_info: { name: student_name || 'Student' },
    }

    // Use sandbox for test keys, live for production
    const KHALTI_URL = 'https://a.khalti.com/api/v2/epayment/initiate/'

    const response = await fetch(KHALTI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ payment_url: data.payment_url, pidx: data.pidx }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})