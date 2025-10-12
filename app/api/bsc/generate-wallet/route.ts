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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check if user exists and doesn't already have a BSC wallet
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, bsc_wallet_address')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    if (profile.bsc_wallet_address) {
      return NextResponse.json({ 
        success: true, 
        wallet_address: profile.bsc_wallet_address,
        message: 'User already has a BSC wallet address'
      })
    }

    // Initialize BSC service
    const bscService = new BSCService(BSC_CONFIG)
    
    // Generate BSC wallet for the user
    const userWallet = bscService.generateUserWallet(userId)
    
    // Update profile with BSC wallet address
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        bsc_wallet_address: userWallet.address,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating profile with BSC wallet:', updateError)
      return NextResponse.json({ error: 'Failed to save BSC wallet address' }, { status: 500 })
    }

    console.log(`✅ BSC wallet generated for user ${userId}:`)
    console.log(`   - User: ${profile.full_name}`)
    console.log(`   - BSC Wallet: ${userWallet.address}`)

    return NextResponse.json({
      success: true,
      wallet_address: userWallet.address,
      message: 'BSC wallet generated successfully'
    })

  } catch (error) {
    console.error('Error in generate-wallet API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check if user has BSC wallet
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check user's BSC wallet status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, bsc_wallet_address')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      user_id: profile.id,
      full_name: profile.full_name,
      has_bsc_wallet: !!profile.bsc_wallet_address,
      bsc_wallet_address: profile.bsc_wallet_address || null
    })

  } catch (error) {
    console.error('Error checking BSC wallet status:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
