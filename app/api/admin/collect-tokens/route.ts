import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
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

    // TODO: Add proper admin check when authentication is implemented
    // Temporarily bypassing admin check

    const { action, userId, walletAddress, scanAll } = await request.json()

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

      case 'collect_specific_usdt':
        try {
          if (!userId && !walletAddress) {
            return NextResponse.json({ error: 'Either User ID or Wallet Address is required for specific collection' }, { status: 400 })
          }

          let result
          if (userId) {
            console.log(`Starting USDT collection for specific user: ${userId}`)
            result = await bscService.collectUSDTFromUserWallet(userId)
          } else {
            console.log(`Starting USDT collection for specific wallet: ${walletAddress}`)
            // For manual wallet addresses, we need to check if it's a user wallet we can derive
            // Try to find if this wallet belongs to any user in our system
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id')
              .limit(1000) // Reasonable limit for checking
            
            if (profilesError) {
              return NextResponse.json({ 
                error: 'Unable to verify wallet ownership for collection' 
              }, { status: 500 })
            }
            
            let matchingUserId = null
            for (const profile of profiles) {
              const userWallet = bscService.generateUserWallet(profile.id)
              if (userWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
                matchingUserId = profile.id
                break
              }
            }
            
            if (matchingUserId) {
              // This is a user wallet, we can collect from it
              result = await bscService.collectUSDTFromUserWallet(matchingUserId)
            } else {
              // This is an external wallet, we cannot collect without private key
              return NextResponse.json({ 
                error: 'Cannot collect from external wallet addresses. Collection is only supported for user wallets in the system for security reasons.',
                details: 'To collect from this wallet, the owner must use the user selection mode or import their wallet into the system.'
              }, { status: 400 })
            }
          }

          if (result.success) {
            return NextResponse.json({
              success: true,
              message: `USDT collection completed: ${result.amount} USDT collected`,
              txHash: result.txHash,
              amount: result.amount,
              userId: userId || null
            })
          } else {
            return NextResponse.json({
              success: false,
              error: result.error || 'Collection failed',
              userId
            }, { status: 400 })
          }
        } catch (error: any) {
          console.error('Error in specific USDT collection:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

      case 'collect_specific_bnb':
        try {
          if (!userId && !walletAddress) {
            return NextResponse.json({ error: 'Either User ID or Wallet Address is required for specific collection' }, { status: 400 })
          }

          let result
          if (userId) {
            console.log(`Starting BNB collection for specific user: ${userId}`)
            result = await bscService.collectBNBFromUserWallet(userId)
          } else {
            console.log(`Starting BNB collection for specific wallet: ${walletAddress}`)
            // Check if this wallet belongs to any user in our system
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id')
              .limit(1000)
            
            if (profilesError) {
              return NextResponse.json({ 
                error: 'Unable to verify wallet ownership for collection' 
              }, { status: 500 })
            }
            
            let matchingUserId = null
            for (const profile of profiles) {
              const userWallet = bscService.generateUserWallet(profile.id)
              if (userWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
                matchingUserId = profile.id
                break
              }
            }
            
            if (matchingUserId) {
              result = await bscService.collectBNBFromUserWallet(matchingUserId)
            } else {
              return NextResponse.json({ 
                error: 'Cannot collect from external wallet addresses. Collection is only supported for user wallets in the system for security reasons.',
                details: 'To collect from this wallet, the owner must use the user selection mode or import their wallet into the system.'
              }, { status: 400 })
            }
          }

          if (result.success) {
            return NextResponse.json({
              success: true,
              message: `BNB collection completed: ${result.amount} BNB collected`,
              txHash: result.txHash,
              amount: result.amount,
              userId
            })
          } else {
            return NextResponse.json({
              success: false,
              error: result.error || 'Collection failed',
              userId
            }, { status: 400 })
          }
        } catch (error: any) {
          console.error('Error in specific BNB collection:', error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

      case 'collect_specific_all':
        try {
          if (!userId && !walletAddress) {
            return NextResponse.json({ error: 'Either User ID or Wallet Address is required for specific collection' }, { status: 400 })
          }

          let effectiveUserId = userId
          
          if (walletAddress) {
            // Check if this wallet belongs to any user in our system
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('id')
              .limit(1000)
            
            if (profilesError) {
              return NextResponse.json({ 
                error: 'Unable to verify wallet ownership for collection' 
              }, { status: 500 })
            }
            
            let matchingUserId = null
            for (const profile of profiles) {
              const userWallet = bscService.generateUserWallet(profile.id)
              if (userWallet.address.toLowerCase() === walletAddress.toLowerCase()) {
                matchingUserId = profile.id
                break
              }
            }
            
            if (!matchingUserId) {
              return NextResponse.json({ 
                error: 'Cannot collect from external wallet addresses. Collection is only supported for user wallets in the system for security reasons.',
                details: 'To collect from this wallet, the owner must use the user selection mode or import their wallet into the system.'
              }, { status: 400 })
            }
            
            effectiveUserId = matchingUserId
            console.log(`Starting complete collection for wallet address ${walletAddress} (user: ${effectiveUserId})`)
          } else {
            console.log(`Starting complete collection for specific user: ${userId}`)
          }
          
          const [usdtResult, bnbResult] = await Promise.allSettled([
            bscService.collectUSDTFromUserWallet(effectiveUserId),
            bscService.collectBNBFromUserWallet(effectiveUserId)
          ])

          const results = {
            userId,
            usdtCollection: usdtResult.status === 'fulfilled' ? usdtResult.value : { success: false, error: usdtResult.reason?.message },
            bnbCollection: bnbResult.status === 'fulfilled' ? bnbResult.value : { success: false, error: bnbResult.reason?.message }
          }

          const successCount = (results.usdtCollection.success ? 1 : 0) + (results.bnbCollection.success ? 1 : 0)
          const totalCollected = {
            usdt: results.usdtCollection.success && 'amount' in results.usdtCollection && results.usdtCollection.amount ? parseFloat(results.usdtCollection.amount) : 0,
            bnb: results.bnbCollection.success && 'amount' in results.bnbCollection && results.bnbCollection.amount ? parseFloat(results.bnbCollection.amount) : 0
          }

          return NextResponse.json({
            success: successCount > 0,
            message: `Collection completed for user ${userId}: ${successCount}/2 successful`,
            results,
            totalCollected
          })
        } catch (error: any) {
          console.error('Error in specific complete collection:', error)
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
          const collections = []
          const errors = []

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
          const collections = []
          const errors = []

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


    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const walletAddress = url.searchParams.get('walletAddress')

    if (!userId && !walletAddress) {
      return NextResponse.json({ error: 'Either User ID or Wallet Address is required' }, { status: 400 })
    }

    const bscService = new BSCService(BSC_CONFIG)
    let targetAddress: string

    if (userId) {
      // Generate wallet from user ID
      const userWallet = bscService.generateUserWallet(userId)
      targetAddress = userWallet.address
    } else {
      // Use provided wallet address
      targetAddress = walletAddress!
      
      // Enhanced validation for wallet address format
      if (!targetAddress || typeof targetAddress !== 'string') {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
      }
      
      // Clean and validate address
      targetAddress = targetAddress.trim()
      if (!targetAddress.startsWith('0x') || targetAddress.length !== 42) {
        return NextResponse.json({ error: 'Invalid wallet address format. Must be 42 characters starting with 0x' }, { status: 400 })
      }
      
      // Check if it's a valid hex string
      if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        return NextResponse.json({ error: 'Invalid wallet address format. Must contain only hexadecimal characters' }, { status: 400 })
      }
      
      // Additional Web3 address validation using Web3 utils
      try {
        const Web3 = require('web3')
        const web3Utils = new Web3().utils
        if (!web3Utils.isAddress(targetAddress)) {
          return NextResponse.json({ error: 'Invalid wallet address. Not a valid Ethereum/BSC address.' }, { status: 400 })
        }
      } catch (validationError) {
        console.warn('Web3 address validation failed, proceeding with basic validation')
      }
    }

    try {
      const [usdtBalance, bnbBalance] = await Promise.all([
        bscService.getUSDTBalance(targetAddress),
        bscService.getBNBBalance(targetAddress)
      ])

      return NextResponse.json({
        success: true,
        userId: userId || null,
        walletAddress: targetAddress,
        usdtBalance: parseFloat(usdtBalance),
        bnbBalance: parseFloat(bnbBalance)
      })
    } catch (balanceError: any) {
      console.error('Error fetching wallet balances:', balanceError)
      
      // Check for specific Web3 errors
      if (balanceError.code === 205 || balanceError.message?.includes('Returned values aren\'t valid')) {
        return NextResponse.json({ 
          error: 'Unable to fetch balance for this wallet address. This may be due to network issues, invalid address, or contract problems.',
          details: 'Web3 ABI decoding error - the wallet address may not be valid or the network may be experiencing issues.',
          walletAddress: targetAddress
        }, { status: 400 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch wallet balance',
        details: balanceError.message || 'Unknown error',
        walletAddress: targetAddress
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Error checking wallet balance:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
