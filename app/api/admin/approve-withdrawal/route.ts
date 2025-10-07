import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import BSCService from '@/lib/bsc-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955",
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || ""
}

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

    const { withdrawalId, action } = await request.json()

    if (!withdrawalId || !action) {
      return NextResponse.json({ error: 'Withdrawal ID and action are required' }, { status: 400 })
    }

    // Get withdrawal request details
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawal_requests')
      .select(`
        *,
        profiles!inner(username, main_wallet_balance)
      `)
      .eq('id', withdrawalId)
      .eq('status', 'pending')
      .single()

    if (withdrawalError || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal request not found or already processed' }, { status: 404 })
    }

    if (action === 'approve') {
      try {
        console.log('Processing withdrawal approval:', {
          withdrawalId,
          amount: withdrawal.amount,
          walletAddress: withdrawal.wallet_address,
          userId: withdrawal.user_id
        })

        // Calculate net amount (after 10% fee)
        const withdrawalFee = withdrawal.amount * 0.10
        const netAmount = withdrawal.amount - withdrawalFee

        // Initialize BSC service
        const bscService = new BSCService(BSC_CONFIG)
        
        // Process the blockchain withdrawal
        console.log('Sending USDT to user wallet:', {
          toAddress: withdrawal.wallet_address,
          amount: netAmount
        })

        const txHash = await bscService.processWithdrawal(
          withdrawal.wallet_address,
          netAmount.toString()
        )

        console.log('Blockchain withdrawal successful:', txHash)

        // Use database function to approve withdrawal with blockchain hash
        const { error: approvalError } = await supabase.rpc('approve_withdrawal_request', {
          p_request_id: withdrawalId,
          p_admin_notes: `Approved and processed on blockchain. TX: ${txHash}`
        })

        if (approvalError) throw approvalError

        // Update the withdrawal request with blockchain transaction hash
        await supabase
          .from('withdrawal_requests')
          .update({
            admin_notes: `Blockchain TX: ${txHash}`
          })
          .eq('id', withdrawalId)

        return NextResponse.json({
          success: true,
          message: 'Withdrawal approved and processed on blockchain',
          txHash,
          netAmount,
          withdrawalFee
        })

      } catch (error: any) {
        console.error('Error processing blockchain withdrawal:', error)
        
        // If blockchain transaction fails, reject the withdrawal
        const { error: rejectionError } = await supabase.rpc('reject_withdrawal_request', {
          p_request_id: withdrawalId,
          p_admin_notes: `Blockchain processing failed: ${error.message}`
        })

        return NextResponse.json({ 
          error: `Withdrawal processing failed: ${error.message}`,
          details: 'The withdrawal has been automatically rejected due to blockchain processing failure'
        }, { status: 500 })
      }

    } else if (action === 'reject') {
      // Use database function to reject withdrawal
      const { error: rejectionError } = await supabase.rpc('reject_withdrawal_request', {
        p_request_id: withdrawalId,
        p_admin_notes: `Manually rejected by admin at ${new Date().toISOString()}`
      })

      if (rejectionError) throw rejectionError

      return NextResponse.json({
        success: true,
        message: 'Withdrawal rejected successfully'
      })

    } else {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Error in withdrawal approval:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process withdrawal approval' 
    }, { status: 500 })
  }
}
