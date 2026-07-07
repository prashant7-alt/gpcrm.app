import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4d3BtanRpeGRiZWJuYnFvcmp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg0MTA3NiwiZXhwIjoyMDk0NDE3MDc2fQ.-hCYRtHjWg-W2VQsWHfdf5XJztKq_6EhYUuZjN6hV7M'

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:   false,
    autoRefreshToken: false,
  }
})
