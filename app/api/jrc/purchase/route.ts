import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Use admin client for server operations
    const supabase = supabaseAdmin
    
    const { userId, amount } = await request.json()
    
    if (!userId || !amount) {
      return NextResponse.json({ error: 'User ID and amount are required' }, { status: 400 })
    }

    const { jrcAmount } = await request.json()

    if (!jrcAmount || parseFloat(jrcAmount) <= 0) {
      return NextResponse.json({ error: 'Invalid JRC amount' }, { status: 400 })
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

    const coinsToBuy = parseFloat(jrcAmount)
    const jrcRate = 0.1 // $0.1 per JRC coin
    const totalCost = coinsToBuy * jrcRate

    // Validation
    if (totalCost > profile.fund_wallet_balance) {
      // Send failure email notification
      try {
        const emailService = new EmailService()
        await emailService.sendJrcPurchaseNotification(
          profile.email || '',
          profile.full_name || 'User',
          coinsToBuy,
          'JRC',
          'failed',
          undefined,
          `Insufficient fund wallet balance. You need $${totalCost.toFixed(2)} but only have $${profile.fund_wallet_balance.toFixed(2)}`
        )
      } catch (emailError) {
        console.error("Failed to send JRC purchase failure email:", emailError)
      }

      return NextResponse.json({ 
        error: `Insufficient fund wallet balance. You need $${totalCost.toFixed(2)} but only have $${profile.fund_wallet_balance.toFixed(2)}` 
      }, { status: 400 })
    }

    // Update user balances
    const newFundBalance = profile.fund_wallet_balance - totalCost
    const newJrcBalance = profile.total_jarvis_tokens + coinsToBuy

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        fund_wallet_balance: newFundBalance,
      })
      .eq('id', userId)

    if (updateError) throw updateError

    // Use the database function to process the JRC purchase
    const { data: transactionId, error: purchaseError } = await supabase
      .rpc('process_jrc_purchase', {
        p_user_id: userId,
        p_coins_to_buy: coinsToBuy,
        p_jrc_rate: jrcRate
      })

    if (purchaseError) throw purchaseError

    // Send success email notification
    try {
      const emailService = new EmailService()
      await emailService.sendJrcPurchaseNotification(
        profile.email || '',
        profile.full_name || 'User',
        coinsToBuy,
        'JRC',
        'success'
      )
      console.log("JRC purchase success email sent")
    } catch (emailError) {
      console.error("Failed to send JRC purchase success email:", emailError)
      // Don't fail the transaction if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${coinsToBuy.toLocaleString()} JRC coins for $${totalCost.toFixed(2)}!`,
      coinsPurchased: coinsToBuy,
      totalCost: totalCost,
      newFundBalance: newFundBalance,
      newJrcBalance: newJrcBalance
    })

  } catch (error: any) {
    console.error("Error processing JRC purchase:", error)
    
    // Note: Email notification for errors would need user context
    // which is not available in this catch block
    
    return NextResponse.json({ error: error.message || "Failed to purchase JRC coins" }, { status: 500 })
  }
}
