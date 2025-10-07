import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
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

    // Call the database function to add funds
    const { data: result, error: addFundsError } = await supabase.rpc('admin_add_funds_to_user', {
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
