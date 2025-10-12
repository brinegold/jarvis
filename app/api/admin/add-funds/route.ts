import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get authorization token from cookies or headers
    const authHeader = request.headers.get('authorization')
    let token: string | undefined

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    } else {
      // Try to get from cookies
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=')
          acc[key] = value
          return acc
        }, {} as Record<string, string>)
        
        // Look for Supabase auth token in cookies
        token = cookies['sb-access-token'] || cookies['supabase-auth-token']
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'No authentication token found' }, { status: 401 })
    }

    // For now, skip auth verification in development
    // TODO: Implement proper JWT token verification
    const user = { id: 'temp-admin', email: 'admin@temp.com' }

    // Check if user is admin using admin client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
    }

    const { userId, amount, adminNotes } = await request.json()

    // Validate input
    if (!userId || !amount) {
      return NextResponse.json({ 
        error: 'User ID and amount are required' 
      }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ 
        error: 'Amount must be a positive number' 
      }, { status: 400 })
    }

    // Call the database function to add funds using admin client
    const { data: result, error: addFundsError } = await supabaseAdmin.rpc('admin_add_funds_to_user', {
      p_user_id: userId,
      p_amount: amount,
      p_admin_notes: adminNotes || null
    })

    if (addFundsError) {
      console.error('Error adding funds:', addFundsError)
      return NextResponse.json({ 
        error: addFundsError.message || 'Failed to add funds to user wallet' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Funds added successfully',
      data: result
    })

  } catch (error: any) {
    console.error('Error in add funds API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
