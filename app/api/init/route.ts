import { NextResponse } from 'next/server'
import { startProfitDistribution } from '@/lib/profit-distribution'

// This endpoint initializes the server and starts automatic profit distribution
export async function GET() {
  try {
    // Get interval from environment variable or default to 1 minute for testing
    const intervalMinutes = process.env.PROFIT_DISTRIBUTION_INTERVAL 
      ? parseInt(process.env.PROFIT_DISTRIBUTION_INTERVAL) 
      : 1 // Default to 1 minute for testing
    
    console.log(`Initializing profit distribution with ${intervalMinutes} minute interval...`)
    
    // Start automatic profit distribution
    startProfitDistribution(intervalMinutes)
    
    return NextResponse.json({
      success: true,
      message: `Server initialized. Profit distribution running every ${intervalMinutes} minutes.`,
      intervalMinutes,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error initializing server:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to initialize server',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
