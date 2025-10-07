import { NextRequest, NextResponse } from 'next/server'
import { startProfitDistribution } from '@/lib/profit-distribution'

// This endpoint starts the automatic profit distribution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const intervalMinutes = body.intervalMinutes || 60 // Default to 60 minutes
    
    // Start the automatic distribution
    startProfitDistribution(intervalMinutes)
    
    return NextResponse.json({
      success: true,
      message: `Automatic profit distribution started (every ${intervalMinutes} minutes)`,
      intervalMinutes
    })
  } catch (error: any) {
    console.error('Error starting profit distribution:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start profit distribution' },
      { status: 500 }
    )
  }
}

// GET endpoint to start with default interval
export async function GET(request: NextRequest) {
  try {
    // Start with default 60 minute interval
    startProfitDistribution(60)
    
    return NextResponse.json({
      success: true,
      message: 'Automatic profit distribution started (every 60 minutes)',
      intervalMinutes: 60
    })
  } catch (error: any) {
    console.error('Error starting profit distribution:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start profit distribution' },
      { status: 500 }
    )
  }
}
