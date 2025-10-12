import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase-server'
import BSCService from '@/lib/bsc-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const BSC_CONFIG = {
  rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org/",
  contractAddress: process.env.PAYMENT_CONTRACT_ADDRESS || "",
  usdtContractAddress: process.env.USDT_CONTRACT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955", // BSC mainnet USDT
  adminFeeWallet: process.env.ADMIN_FEE_WALLET || "",
  globalAdminWallet: process.env.GLOBAL_ADMIN_WALLET || "",
  privateKey: process.env.BSC_PRIVATE_KEY || ""
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const bscService = new BSCService(BSC_CONFIG)

    // Generate or retrieve user's BSC wallet
    let walletAddress = profile.bsc_wallet_address
    
    if (!walletAddress) {
      const wallet = bscService.generateUserWallet(user.id)
      walletAddress = wallet.address
      
      // Store wallet address (not private key for security)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ bsc_wallet_address: walletAddress })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating wallet address:', updateError)
        return NextResponse.json({ error: 'Failed to save wallet address' }, { status: 500 })
      }
    }

    return NextResponse.json({
      address: walletAddress,
      walletAddress,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}`,
      network: "BSC (Binance Smart Chain)",
      tokenContract: BSC_CONFIG.usdtContractAddress
    })

  } catch (error) {
    console.error("Error getting BSC wallet:", error)
    return NextResponse.json({ error: "Failed to get wallet address" }, { status: 500 })
  }
}
