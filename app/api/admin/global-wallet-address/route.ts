import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get the global admin wallet address from environment variables
    const globalWalletAddress = "0x734a6e4215f34158344cf01e7d03f9b405d9d644"

    if (!globalWalletAddress) {
      return NextResponse.json({ 
        error: 'Global wallet address not configured' 
      }, { status: 500 })
    }

    // Validate the address format
    if (!globalWalletAddress.startsWith('0x') || globalWalletAddress.length !== 42) {
      return NextResponse.json({ 
        error: 'Invalid global wallet address format' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      address: globalWalletAddress,
      network: 'BEP20',
      currency: 'USDT'
    })

  } catch (error: any) {
    console.error('Error fetching global wallet address:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch global wallet address' 
    }, { status: 500 })
  }
}
