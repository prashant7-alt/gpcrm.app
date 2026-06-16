import { createClient } from '@supabase/supabase-js'

// paste your URL and KEY from supabase.com → Settings → API
const SUPABASE_URL = 'https://txwpmjtixdbebnbqorju.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4d3BtanRpeGRiZWJuYnFvcmp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NDEwNzYsImV4cCI6MjA5NDQxNzA3Nn0.Xy43HkFKEs9L6yVTQU4TkCV8rcBhZkjgQD-UdEhDSfI'

// this line creates the connection
// export const = makes it available to import in other files
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)