import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4d3BtanRpeGRiZWJuYnFvcmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDEwNzYsImV4cCI6MjA5NDQxNzA3Nn0.Xy43HkFKEs9L6yVTQU4TkCV8rcBhZkjgQD-UdEhDSfI'

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:   false,
    autoRefreshToken: false,
  }
})