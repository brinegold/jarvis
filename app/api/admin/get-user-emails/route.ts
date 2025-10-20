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

    // Use RPC function to fetch user emails from auth schema
    // Create an RPC function in Supabase that can access auth.users
    const { data: authUsers, error: authError } = await supabaseAdmin
      .rpc('get_user_emails_by_ids', { user_ids: userIds })
    
    if (authError) {
      console.error('Error fetching user emails:', authError)
      // Fallback: return user IDs as emails if RPC fails
      const fallbackUsers = userIds.map((id: string) => ({
        id,
        email: id, // Use ID as fallback
        last_sign_in_at: null
      }))
      
      return NextResponse.json({
        success: true,
        users: fallbackUsers
      })
    }

    // Filter the results to only include requested user IDs
    const filteredUsers = authUsers?.filter((user: any) => userIds.includes(user.id)) || []

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
