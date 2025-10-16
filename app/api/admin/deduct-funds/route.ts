import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { userId, amount, adminNotes } = await request.json()
    
    // Use server client for database operations
    const supabase = createSupabaseServerClient()

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

    // Get current user balance first to validate
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('main_wallet_balance')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json({ 
        error: 'Failed to fetch user profile' 
      }, { status: 500 })
    }

    // Check if user has sufficient balance
    if (profile.main_wallet_balance < amount) {
      return NextResponse.json({ 
        error: 'Insufficient balance. Cannot deduct more than current wallet balance.' 
      }, { status: 400 })
    }

    // Call the database function to deduct funds
    const { data: result, error: deductFundsError } = await supabase.rpc('admin_deduct_funds_from_user', {
      p_user_id: userId,
      p_amount: amount,
      p_admin_notes: adminNotes || null
    })

    if (deductFundsError) {
      console.error('Error deducting funds:', deductFundsError)
      return NextResponse.json({ 
        error: deductFundsError.message || 'Failed to deduct funds from user wallet' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Funds deducted successfully',
      data: result
    })

  } catch (error: any) {
    console.error('Error in deduct funds API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
