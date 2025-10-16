import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userIds } = await request.json()
    
    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ 
        error: 'User IDs array is required' 
      }, { status: 400 })
    }

    // Use REST API to fetch user data directly from auth.users table
    // Since we have service role key, we can query the auth schema directly
    const { data: authUsers, error: authError } = await supabaseAdmin
      .from('auth.users')
      .select('id, email, last_sign_in_at')
      .in('id', userIds)
    
    if (authError) {
      console.error('Error fetching user emails:', authError)
      return NextResponse.json({ 
        error: 'Failed to fetch user emails' 
      }, { status: 500 })
    }

    // The data is already filtered by the query, just return it
    const filteredUsers = authUsers || []

    return NextResponse.json({
      success: true,
      users: filteredUsers
    })

  } catch (error: any) {
    console.error('Error in get user emails API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
