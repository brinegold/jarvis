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
    console.log('🚀 Starting BSC wallet generation for users without wallets...')

    // Get all profiles without BSC wallet addresses
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, bsc_wallet_address')
      .or('bsc_wallet_address.is.null,bsc_wallet_address.eq.')
      .order('created_at', { ascending: false })

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ 
        message: 'All users already have BSC wallet addresses',
        count: 0,
        wallets_generated: []
      })
    }

    console.log(`📊 Found ${profiles.length} users without BSC wallet addresses`)

    // Initialize BSC service
    const bscService = new BSCService(BSC_CONFIG)
    
    const results = {
      total_processed: 0,
      wallets_generated: [] as Array<{userId: string, name: string, wallet_address: string}>,
      errors: [] as Array<{userId: string, name: string, error: string}>
    }

    // Generate BSC wallets for each user
    for (const profile of profiles) {
      try {
        console.log(`💳 Generating BSC wallet for user: ${profile.full_name} (${profile.id})`)
        
        // Generate BSC wallet using the actual BSC service
        const userWallet = bscService.generateUserWallet(profile.id)
        
        // Update profile with BSC wallet address
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            bsc_wallet_address: userWallet.address,
            updated_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        if (updateError) {
          console.error(`❌ Failed to save wallet for ${profile.full_name}:`, updateError)
          results.errors.push({
            userId: profile.id,
            name: profile.full_name,
            error: updateError.message
          })
        } else {
          console.log(`✅ BSC wallet generated for ${profile.full_name}: ${userWallet.address}`)
          results.wallets_generated.push({
            userId: profile.id,
            name: profile.full_name,
            wallet_address: userWallet.address
          })
        }
        
        results.total_processed++
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`💥 Error generating wallet for ${profile.full_name}:`, error)
        results.errors.push({
          userId: profile.id,
          name: profile.full_name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`🎉 BSC wallet generation completed!`)
    console.log(`   - Total processed: ${results.total_processed}`)
    console.log(`   - Wallets generated: ${results.wallets_generated.length}`)
    console.log(`   - Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'BSC wallet generation completed',
      summary: {
        total_processed: results.total_processed,
        wallets_generated: results.wallets_generated.length,
        errors: results.errors.length
      },
      results
    })

  } catch (error) {
    console.error('💥 Error in generate-missing-wallets API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check how many users need BSC wallets
export async function GET(request: NextRequest) {
  try {
    // Count profiles without BSC wallet addresses
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, bsc_wallet_address, created_at')
      .or('bsc_wallet_address.is.null,bsc_wallet_address.eq.')
      .order('created_at', { ascending: false })

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Users without BSC wallet addresses',
      count: profiles?.length || 0,
      users: profiles?.map(p => ({
        id: p.id,
        name: p.full_name,
        created_at: p.created_at
      })) || []
    })

  } catch (error) {
    console.error('Error checking missing wallets:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
