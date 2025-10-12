import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client - use direct client to avoid auth-helpers type issues
export const supabase = createClient(supabaseUrl, supabaseAnonKey) as any

// Client component client - use regular client for auth methods (typed as any to avoid conflicts)
export const createSupabaseClient = () => createClient(supabaseUrl, supabaseAnonKey) as any
