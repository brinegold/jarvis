import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Parse request body
    const { txHash, amount, currency, network, userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    }

    if (!amount || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Valid deposit amount is required' }, { status: 400 })
    }

    const amountNum = parseFloat(amount)
    if (amountNum < 10) {
      return NextResponse.json({ error: 'Minimum deposit amount is $10 USDT' }, { status: 400 })
    }

    if (amountNum > 50000) {
      return NextResponse.json({ error: 'Maximum deposit amount is $50,000 USDT' }, { status: 400 })
    }

    // Validate transaction hash format
    if (!txHash.startsWith('0x') || txHash.length !== 66) {
      return NextResponse.json({ 
        error: 'Invalid transaction hash format. Must start with 0x and be 66 characters long.' 
      }, { status: 400 })
    }

    // Validate currency and network
    if (currency !== 'USDT') {
      return NextResponse.json({ error: 'Only USDT deposits are supported' }, { status: 400 })
    }

    if (network !== 'BEP20') {
      return NextResponse.json({ error: 'Only BEP20 network is supported' }, { status: 400 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check if transaction hash already exists
    const { data: existingRequest } = await supabase
      .from('deposit_requests')
      .select('id')
      .eq('tx_hash', txHash)
      .single()

    if (existingRequest) {
      return NextResponse.json({ 
        error: 'This transaction hash has already been submitted' 
      }, { status: 400 })
    }

    // Check if transaction already processed in old system
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference_id', txHash)
      .single()

    if (existingTx) {
      return NextResponse.json({ 
        error: 'This transaction has already been processed' 
      }, { status: 400 })
    }

    // Create deposit request
    const { data: depositRequest, error: insertError } = await supabase
      .from('deposit_requests')
      .insert({
        user_id: userId,
        tx_hash: txHash,
        amount: amountNum,
        currency: currency,
        network: network,
        status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating deposit request:', insertError)
      return NextResponse.json({ 
        error: 'Failed to create deposit request' 
      }, { status: 500 })
    }

    // Send notification email to user
    try {
      const { data: authUser } = await (supabaseAdmin.auth as any).admin.getUserById(userId)

      if (authUser.user?.email) {
        const emailService = new EmailService()
        // Note: Using 'success' status for now since email service doesn't support 'pending'
        // The message will indicate it's a pending request
        await emailService.sendDepositNotification(
          authUser.user.email,
          profile.full_name || 'User',
          amountNum,
          currency,
          'success',
          txHash,
          0,
          amountNum,
          `Deposit request submitted successfully. Request ID: ${depositRequest.id}. Your request is pending admin approval.`
        )
        console.log("Deposit request notification email sent")
      }
    } catch (emailError) {
      console.error("Failed to send deposit request notification email:", emailError)
      // Don't fail the request if email fails
    }

    // TODO: Send notification to admins
    // Admin notifications will be implemented later

    return NextResponse.json({
      success: true,
      message: "Deposit request submitted successfully",
      requestId: depositRequest.id,
      amount: amountNum,
      currency: currency,
      network: network,
      status: 'pending'
    })

  } catch (error: any) {
    console.error("Error creating manual deposit request:", error)
    return NextResponse.json({ 
      error: error.message || "Failed to create deposit request" 
    }, { status: 500 })
  }
}
