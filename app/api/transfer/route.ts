import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper authentication
    const supabase = createSupabaseServerClient()
    
    // Parse request body
    const { transferType, amount, receiverId, userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!transferType || !amount) {
      return NextResponse.json({ error: 'Transfer type and amount are required' }, { status: 400 })
    }

    const transferAmount = parseFloat(amount)
    
    if (transferAmount < 0.01) {
      return NextResponse.json({ error: 'Minimum transfer amount is $0.01' }, { status: 400 })
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

    if (transferType === 'main-to-fund') {
      // Main to Fund Transfer
      if (transferAmount > profile.main_wallet_balance) {
        return NextResponse.json({ error: 'Insufficient main wallet balance' }, { status: 400 })
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          main_wallet_balance: profile.main_wallet_balance - transferAmount,
          fund_wallet_balance: profile.fund_wallet_balance + transferAmount
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // Create transaction record
      await supabase.from('transactions').insert({
        net_amount: transferAmount,
        status: 'completed',
        description: 'Transfer from Main to Fund Wallet'
      })

      // TODO: Send email notification for main-to-fund transfer

      return NextResponse.json({
        success: true,
        message: `Successfully transferred $${transferAmount} from Main Wallet to Fund Wallet`,
        newMainBalance: profile.main_wallet_balance - transferAmount,
        newFundBalance: profile.fund_wallet_balance + transferAmount
      })

    } else if (transferType === 'fund-to-fund') {
      // Fund to Fund Transfer (to another user)
      if (transferAmount > profile.fund_wallet_balance) {
        return NextResponse.json({ error: 'Insufficient fund wallet balance' }, { status: 400 })
      }

      if (!receiverId) {
        return NextResponse.json({ error: 'Please enter receiver ID' }, { status: 400 })
      }

      // Check if receiver exists
      const { data: receiver, error: receiverError } = await supabase
        .from('profiles')
        .select('id, referral_code, full_name')
        .eq('referral_code', receiverId)
        .single()

      if (receiverError || !receiver) {
        return NextResponse.json({ error: 'Receiver not found' }, { status: 400 })
      }

      if (receiver.id === userId) {
        return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 })
      }

      // Perform transfer
      const { error: senderError } = await supabase
        .from('profiles')
        .update({
          fund_wallet_balance: profile.fund_wallet_balance - transferAmount
        })
        .eq('id', userId)

      if (senderError) throw senderError

      // Get receiver's current balance first
      const { data: receiverProfile, error: receiverFetchError } = await supabase
        .from('profiles')
        .select('fund_wallet_balance')
        .eq('id', receiver.id)
        .single()

      if (receiverFetchError) throw receiverFetchError

      const { error: receiverUpdateError } = await supabase
        .from('profiles')
        .update({
          fund_wallet_balance: receiverProfile.fund_wallet_balance + transferAmount
        })
        .eq('id', receiver.id)

      if (receiverUpdateError) throw receiverUpdateError

      // Create transaction records
      await supabase.from('transactions').insert([
        {
          user_id: userId,
          transaction_type: 'transfer_sent',
          amount: transferAmount,
          net_amount: transferAmount,
          status: 'completed',
          description: `Transfer to ${receiverId}`
        },
        {
          user_id: receiver.id,
          transaction_type: 'transfer_received',
          amount: transferAmount,
          net_amount: transferAmount,
          status: 'completed',
          description: `Transfer to ${receiverId}`
        }
      ])

      // TODO: Send email notifications for fund-to-fund transfer

      return NextResponse.json({
        success: true,
        message: `Successfully transferred $${transferAmount} to ${receiverId}`,
        newFundBalance: profile.fund_wallet_balance - transferAmount
      })
    }

    return NextResponse.json({ error: 'Invalid transfer type' }, { status: 400 })

  } catch (error: any) {
    console.error("Error processing transfer:", error)
    
    // TODO: Send failure email notification
    
    return NextResponse.json({ error: error.message || "Failed to process transfer" }, { status: 500 })
  }
}
