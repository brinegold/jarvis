import { createClient } from '@supabase/supabase-js'
import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Server component client
export const createSupabaseServerClient = () => createServerComponentClient({ cookies })

// Route handler client for API routes
export const createSupabaseRouteClient = () => createRouteHandlerClient({ cookies })

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
