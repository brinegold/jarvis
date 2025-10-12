import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get all profiles for debugging
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, bsc_wallet_address, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Recent profiles (for debugging)',
      count: profiles?.length || 0,
      profiles: profiles?.map(p => ({
        id: p.id,
        full_name: p.full_name,
        has_bsc_wallet: !!p.bsc_wallet_address,
        bsc_wallet_address: p.bsc_wallet_address,
        created_at: p.created_at
      })) || []
    })

  } catch (error) {
    console.error('Error in debug profiles API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
