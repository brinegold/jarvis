import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    const { jrcAmount } = await request.json()

    if (!jrcAmount || parseFloat(jrcAmount) <= 0) {
      return NextResponse.json({ error: 'Invalid JRC amount' }, { status: 400 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
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
          user.email || '',
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
        total_jarvis_tokens: newJrcBalance
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    // Create transaction record
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        transaction_type: 'jrc_purchase',
        amount: totalCost,
        net_amount: totalCost,
        status: 'completed',
        description: `Purchased ${coinsToBuy.toLocaleString()} JRC coins at $${jrcRate} per coin`
      })

    if (transactionError) throw transactionError

    // Send success email notification
    try {
      const emailService = new EmailService()
      await emailService.sendJrcPurchaseNotification(
        user.email || '',
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
    
    // TODO: Implement failure email notification when auth is fixed
    // Skipping error email notifications for now due to auth issues
    
    return NextResponse.json({ error: error.message || "Failed to purchase JRC coins" }, { status: 500 })
  }
}
