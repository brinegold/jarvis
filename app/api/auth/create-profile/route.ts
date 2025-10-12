import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
import BSCService from '@/lib/bsc-service'
import crypto from 'crypto'

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

// Generate unique referral code
function generateReferralCode(userId: string, fullName: string): string {
  const seed = `${userId}-${fullName}-${Date.now()}`
  const hash = crypto.createHash('sha256').update(seed).digest('hex')
  return hash.substring(0, 8).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { fullName, sponsorId, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    // Initialize BSC service
    const bscService = new BSCService(BSC_CONFIG)
    
    // Generate BSC wallet for the user
    const userWallet = bscService.generateUserWallet(userId)
    
    // Generate unique referral code
    const referralCode = generateReferralCode(userId, fullName)
    
    // Check if referral code already exists (very unlikely but just in case)
    let finalReferralCode = referralCode
    let counter = 1
    while (true) {
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('referral_code', finalReferralCode)
        .single()
      
      if (!existingProfile) break
      
      finalReferralCode = `${referralCode}${counter}`
      counter++
    }

    // Create profile with BSC wallet address and referral code
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        sponsor_id: sponsorId || null,
        bsc_wallet_address: userWallet.address,
        referral_code: finalReferralCode,
        main_wallet_balance: 0,
        fund_wallet_balance: 0,
        total_jarvis_tokens: 0,
        created_at: new Date().toISOString()
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    // Build referral chain if sponsor exists
    if (sponsorId) {
      try {
        const { error: referralError } = await supabaseAdmin
          .rpc('build_referral_chain', {
            referred_user_id: userId,
            sponsor_referral_code: sponsorId
          })

        if (referralError) {
          console.error('Referral chain error:', referralError)
          // Don't fail profile creation if referral chain fails
        }
      } catch (referralChainError) {
        console.error('Referral chain error:', referralChainError)
        // Don't fail profile creation if referral chain fails
      }
    }

    console.log(`✅ Profile created successfully for user ${userId}:`)
    console.log(`   - Full Name: ${fullName}`)
    console.log(`   - BSC Wallet: ${userWallet.address}`)
    console.log(`   - Referral Code: ${finalReferralCode}`)
    console.log(`   - Sponsor ID: ${sponsorId || 'None'}`)

    return NextResponse.json({
      success: true,
      profile: {
        id: userId,
        full_name: fullName,
        bsc_wallet_address: userWallet.address,
        referral_code: finalReferralCode,
        sponsor_id: sponsorId || null
      }
    })

  } catch (error) {
    console.error('Error in create-profile API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
