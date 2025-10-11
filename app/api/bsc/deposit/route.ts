import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper BSC deposit verification
    // Temporarily disabled for build compatibility
    return NextResponse.json({ 
      error: 'BSC deposit verification temporarily disabled for build compatibility' 
    }, { status: 503 })
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
