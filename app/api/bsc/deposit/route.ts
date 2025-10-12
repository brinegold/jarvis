import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase-server'
import BSCService from '@/lib/bsc-service'
import EmailService from '@/lib/email-service'

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
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    const { txHash, expectedAmount } = await request.json()

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 })
    }

    if (!expectedAmount || isNaN(parseFloat(expectedAmount))) {
      return NextResponse.json({ error: 'Valid deposit amount is required' }, { status: 400 })
    }

    const expectedAmountNum = parseFloat(expectedAmount)
    if (expectedAmountNum < 10) {
      return NextResponse.json({ error: 'Minimum deposit amount is $10 USDT' }, { status: 400 })
    }

    if (expectedAmountNum > 50000) {
      return NextResponse.json({ error: 'Maximum deposit amount is $50,000 USDT' }, { status: 400 })
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

    if (!profile.bsc_wallet_address) {
      return NextResponse.json({ error: 'No BSC wallet found. Please generate a wallet first.' }, { status: 400 })
    }

    const bscService = new BSCService(BSC_CONFIG)

    // Verify transaction hash and extract actual transfer amount
    const txDetails = await bscService.verifyTransaction(txHash)
    
    console.log("Transaction details:", {
      txHash,
      from: txDetails.from,
      to: txDetails.to,
      actualRecipient: txDetails.actualRecipient,
      usdtTransferAmount: txDetails.usdtTransferAmount,
      userBscWallet: profile.bsc_wallet_address
    })

    // Validate that this is a USDT transfer to the user's wallet
    if (txDetails.to.toLowerCase() === BSC_CONFIG.usdtContractAddress.toLowerCase()) {
      // This is a USDT token transfer - verify the recipient matches user's wallet
      if (!txDetails.actualRecipient || txDetails.actualRecipient.toLowerCase() !== profile.bsc_wallet_address.toLowerCase()) {
        return NextResponse.json({ 
          error: `USDT transfer not sent to your wallet. Expected: ${profile.bsc_wallet_address}, Got: ${txDetails.actualRecipient || 'unknown'}` 
        }, { status: 400 })
      }
      
      // Verify that USDT was actually transferred
      if (!txDetails.usdtTransferAmount || parseFloat(txDetails.usdtTransferAmount) <= 0) {
        return NextResponse.json({ 
          error: "No USDT transfer found in this transaction" 
        }, { status: 400 })
      }
    } else {
      return NextResponse.json({ 
        error: `Transaction not sent to USDT contract. Expected: ${BSC_CONFIG.usdtContractAddress}, Got: ${txDetails.to}` 
      }, { status: 400 })
    }

    // Check if transaction already processed
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('reference_id', txHash)
      .single()

    if (existingTx) {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 400 })
    }

    // Use the actual transfer amount from blockchain
    const depositAmount = parseFloat(txDetails.usdtTransferAmount)
    
    // Validate that the actual amount matches the expected amount (with 1% tolerance)
    const tolerance = expectedAmountNum * 0.01
    const amountDifference = Math.abs(depositAmount - expectedAmountNum)
    
    if (amountDifference > tolerance) {
      return NextResponse.json({ 
        error: `Transaction amount ($${depositAmount} USDT) does not match expected amount ($${expectedAmountNum} USDT). Please ensure you sent the correct amount.` 
      }, { status: 400 })
    }
    
    // Calculate amounts (1% fee, 99% to user)
    const fee = depositAmount * 0.01
    const netAmount = depositAmount - fee

    console.log("Processing deposit:", {
      originalAmount: depositAmount,
      fee,
      netAmount,
      userId: user.id
    })

    // Use the database function to process the entire deposit with referral commissions
    const { data: transactionId, error: depositError } = await supabase
      .rpc('process_bsc_deposit', {
        p_user_id: user.id,
        p_deposit_amount: depositAmount,
        p_fee_amount: fee,
        p_net_amount: netAmount,
        p_tx_hash: txHash,
        p_from_address: txDetails.from,
        p_to_address: txDetails.actualRecipient
      })

    if (depositError) {
      console.error('Error processing BSC deposit:', depositError)
      return NextResponse.json({ error: 'Failed to process deposit' }, { status: 500 })
    }

    console.log("Deposit completed successfully")

    // Transfer USDT from user wallet to admin wallets
    let adminTransferResults = {};
    try {
      console.log("Initiating USDT transfer to admin wallets...");
      adminTransferResults = await bscService.transferToAdminWallets(
        user.id,
        depositAmount,
        fee
      );
      console.log("USDT successfully transferred to admin wallets:", adminTransferResults);
    } catch (transferError) {
      console.error("Failed to transfer USDT to admin wallets:", transferError);
      // Log the error but don't fail the deposit since user balance is already credited
      // The admin can manually collect the USDT later if needed
    }

    // Send success email notification
    try {
      const emailService = new EmailService()
      await emailService.sendDepositNotification(
        user.email || '',
        profile.full_name || 'User',
        depositAmount,
        'USDT',
        'success',
        txHash,
        fee,
        netAmount
      )
      console.log("Deposit success email sent")
    } catch (emailError) {
      console.error("Failed to send deposit success email:", emailError)
      // Don't fail the transaction if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Deposit processed successfully",
      amount: netAmount,
      fee: fee,
      txHash: txHash,
      adminTransfers: adminTransferResults
    })

  } catch (error: any) {
    console.error("Error processing BSC deposit:", error)
    
    // TODO: Implement failure email notification when auth is fixed
    // Skipping error email notifications for now due to auth issues
    
    return NextResponse.json({ error: error.message || "Failed to process deposit" }, { status: 500 })
  }
}
