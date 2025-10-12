import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
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
    // Get userId from query parameter for now
    const { searchParams } = new URL(request.url)
    let userId: string | null = searchParams.get('userId')
    
    // Fallback: get from cookie or session (for browser requests)
    if (!userId) {
      try {
        // Try to get the most recent user as a demo fallback
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (profiles && profiles.length > 0) {
          userId = profiles[0].id
          console.log('Using most recent user as fallback:', userId)
        }
      } catch (error) {
        console.log('Fallback failed:', error)
      }
    }
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'No user found',
        hint: 'Make sure you are logged in or use /api/bsc/wallet?userId=your-id'
      }, { status: 401 })
    }
    
    console.log('Getting BSC wallet for user:', userId)

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('Profile lookup error for userId:', userId, profileError)
      return NextResponse.json({ 
        error: 'User profile not found',
        details: profileError?.message || 'Profile does not exist',
        userId: userId
      }, { status: 404 })
    }

    const bscService = new BSCService(BSC_CONFIG)

    // Generate or retrieve user's BSC wallet
    let walletAddress = profile.bsc_wallet_address
    
    if (!walletAddress) {
      console.log('Generating new BSC wallet for user:', userId)
      const wallet = bscService.generateUserWallet(userId)
      walletAddress = wallet.address
      
      // Store wallet address (not private key for security)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          bsc_wallet_address: walletAddress,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating wallet address:', updateError)
        return NextResponse.json({ error: 'Failed to save wallet address' }, { status: 500 })
      }
      
      console.log('✅ New BSC wallet generated and saved:', walletAddress)
    } else {
      console.log('✅ Existing BSC wallet found:', walletAddress)
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      user_name: profile.full_name,
      address: walletAddress,
      walletAddress,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}`,
      network: "BSC (Binance Smart Chain)",
      tokenContract: BSC_CONFIG.usdtContractAddress,
      instructions: {
        deposit: "Send USDT (BEP-20) to this address",
        network: "Use Binance Smart Chain (BSC) network only",
        token: "USDT contract: " + BSC_CONFIG.usdtContractAddress
      }
    })

  } catch (error) {
    console.error("Error getting BSC wallet:", error)
    return NextResponse.json({ 
      error: "Failed to get wallet address",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
