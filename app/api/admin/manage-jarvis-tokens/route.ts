import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { userId, amount, action, adminNotes } = await request.json()
    
    // Use server client for database operations
    const supabase = createSupabaseServerClient()

    // Validate input
    if (!userId || !amount || !action) {
      return NextResponse.json({ 
        error: 'User ID, amount, and action are required' 
      }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ 
        error: 'Amount must be a positive number' 
      }, { status: 400 })
    }

    if (!['add', 'deduct'].includes(action)) {
      return NextResponse.json({ 
        error: 'Action must be either "add" or "deduct"' 
      }, { status: 400 })
    }

    // If deducting, check if user has sufficient tokens
    if (action === 'deduct') {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_jarvis_tokens')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        return NextResponse.json({ 
          error: 'Failed to fetch user profile' 
        }, { status: 500 })
      }

      // Check if user has sufficient tokens
      const currentTokens = profile.total_jarvis_tokens || 0
      if (currentTokens < amount) {
        return NextResponse.json({ 
          error: 'Insufficient tokens. Cannot deduct more than current token balance.' 
        }, { status: 400 })
      }
    }

    // Call the appropriate database function based on action
    const functionName = action === 'add' ? 'admin_add_jarvis_tokens' : 'admin_deduct_jarvis_tokens'
    const { data: result, error: tokenError } = await supabase.rpc(functionName, {
      p_user_id: userId,
      p_amount: amount,
      p_admin_notes: adminNotes || null
    })

    if (tokenError) {
      console.error(`Error ${action}ing jarvis tokens:`, tokenError)
      return NextResponse.json({ 
        error: tokenError.message || `Failed to ${action} jarvis tokens` 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Jarvis tokens ${action === 'add' ? 'added' : 'deducted'} successfully`,
      data: result
    })

  } catch (error: any) {
    console.error('Error in manage jarvis tokens API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
