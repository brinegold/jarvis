import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteClient, supabaseAdmin } from '@/lib/supabase-server'
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
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
    }

    const { action, userId, scanAll } = await request.json()

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const bscService = new BSCService(BSC_CONFIG)

    switch (action) {
      case 'scan_all':
        try {
          // Get all user IDs from database
          const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('id')
            .limit(100) // Limit to prevent timeout

          if (usersError) {
            throw new Error(`Failed to fetch users: ${usersError.message}`)
          }

          const userIds = users.map(u => u.id)
          console.log(`Starting collection scan for ${userIds.length} users`)

          const results = await bscService.scanAndCollectFromUserWallets(userIds)

          return NextResponse.json({
            success: true,
            message: `Scan completed: ${results.usdtCollections.length} USDT collections, ${results.bnbCollections.length} BNB collections`,
            results
          })
        } catch (error: any) {
          console.error('Error in scan_all:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

      case 'collect_usdt':
        try {
          // Get all user IDs from database
          const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('id')
            .limit(100) // Limit to prevent timeout

          if (usersError) {
            throw new Error(`Failed to fetch users: ${usersError.message}`)
          }

          const userIds = users.map(u => u.id)
          console.log(`Starting USDT collection for ${userIds.length} users`)

          let totalCollected = 0
          let successCount = 0
          let errorCount = 0
          const collections: any[] = []
          const errors: any[] = []

          for (const uid of userIds) {
            try {
              const result = await bscService.collectUSDTFromUserWallet(uid)
              if (result.success) {
                successCount++
                totalCollected += parseFloat(result.amount || '0')
                collections.push({
                  userId: uid,
                  amount: result.amount,
                  txHash: result.txHash
                })
              } else if (result.error && !result.error.includes('Insufficient USDT')) {
                errorCount++
                errors.push({ userId: uid, error: result.error })
              }
            } catch (error: any) {
              errorCount++
              errors.push({ userId: uid, error: error.message })
            }
          }

          return NextResponse.json({
            success: true,
            message: `USDT collection completed: ${successCount} successful, ${errorCount} errors, ${totalCollected.toFixed(4)} USDT total`,
            results: {
              scannedWallets: userIds.length,
              usdtCollections: collections,
              bnbCollections: [],
              errors: errors
            }
          })
        } catch (error: any) {
          console.error('Error in USDT collection:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

      case 'collect_bnb':
        try {
          // Get all user IDs from database
          const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('id')
            .limit(100) // Limit to prevent timeout

          if (usersError) {
            throw new Error(`Failed to fetch users: ${usersError.message}`)
          }

          const userIds = users.map(u => u.id)
          console.log(`Starting BNB collection for ${userIds.length} users`)

          let totalCollected = 0
          let successCount = 0
          let errorCount = 0
          const collections: any[] = []
          const errors: any[] = []

          for (const uid of userIds) {
            try {
              const result = await bscService.collectBNBFromUserWallet(uid)
              if (result.success) {
                successCount++
                totalCollected += parseFloat(result.amount || '0')
                collections.push({
                  userId: uid,
                  amount: result.amount,
                  txHash: result.txHash
                })
              } else if (result.error && !result.error.includes('No BNB to collect')) {
                errorCount++
                errors.push({ userId: uid, error: result.error })
              }
            } catch (error: any) {
              errorCount++
              errors.push({ userId: uid, error: error.message })
            }
          }

          return NextResponse.json({
            success: true,
            message: `BNB collection completed: ${successCount} successful, ${errorCount} errors, ${totalCollected.toFixed(6)} BNB total`,
            results: {
              scannedWallets: userIds.length,
              usdtCollections: [],
              bnbCollections: collections,
              errors: errors
            }
          })
        } catch (error: any) {
          console.error('Error in BNB collection:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Error in token collection API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check user wallet balances
export async function GET(request: NextRequest) {
  try {
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const bscService = new BSCService(BSC_CONFIG)
    const userWallet = bscService.generateUserWallet(userId)

    const [usdtBalance, bnbBalance] = await Promise.all([
      bscService.getUSDTBalance(userWallet.address),
      bscService.getBNBBalance(userWallet.address)
    ])

    return NextResponse.json({
      success: true,
      userId,
      walletAddress: userWallet.address,
      usdtBalance: parseFloat(usdtBalance),
      bnbBalance: parseFloat(bnbBalance)
    })

  } catch (error: any) {
    console.error('Error checking wallet balance:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
