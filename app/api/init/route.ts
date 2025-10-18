import { NextResponse } from 'next/server'

// This endpoint initializes the server - profit distribution is now handled via cron jobs and manual admin button
export async function GET() {
  try {
    console.log('🚀 Server initialization...')
    
    return NextResponse.json({
      success: true,
      message: 'Server initialized successfully.',
      info: {
        description: 'Profit distribution system',
        method: 'External cron jobs + manual admin button',
        distribution: 'Users receive profits every 24 hours after investing/staking',
        endpoints: {
          cronJob: '/api/auto-profit-distribution (POST)',
          manual: 'Admin dashboard "Distribute Profits" button'
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ Error initializing server:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to initialize server',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'
