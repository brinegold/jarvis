import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a clean Supabase client for client-side operations
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey) as any

export default supabaseClient
