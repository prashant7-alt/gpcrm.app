import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'
import { encode as encodeBase64 } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { total_amount, transaction_uuid, product_code } = await req.json()

    // eSewa UAT/sandbox test secret used as fallback only. Set ESEWA_SECRET_KEY
    // in Supabase Edge Function secrets with your real merchant secret for production.
    const SECRET_KEY = Deno.env.get('ESEWA_SECRET_KEY') ?? '8gBm/:&EnhH.1/q'

    // eSewa requires signature of this exact string in this exact order
    const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    const base64sig = encodeBase64(new Uint8Array(signature))

    return new Response(
      JSON.stringify({ signature: base64sig }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})