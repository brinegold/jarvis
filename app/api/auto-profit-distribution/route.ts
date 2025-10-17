import { NextRequest, NextResponse } from 'next/server'
import { distributeProfits } from '@/lib/profit-distribution'

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic'

/**
 * Automatic Profit Distribution API Endpoint
 * 
 * This endpoint triggers the automatic distribution of profits to all eligible users.
 * It requires no parameters or authentication secrets, making it suitable for:
 * - External cron services
 * - Automated scheduling systems
 * - Manual triggering without authentication
 * 
 * The endpoint handles both:
 * - Regular investment profit distribution (24-hour cycle)
 * - JRC staking profit distribution (24-hour cycle)
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('=== AUTO PROFIT DISTRIBUTION STARTED ===')
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log(`Request URL: ${request.url}`)
    console.log(`User Agent: ${request.headers.get('user-agent') || 'Unknown'}`)

    // Trigger comprehensive profit distribution
    // This includes both investment profits and JRC staking profits
    await distributeProfits()

    const endTime = Date.now()
    const executionTime = endTime - startTime

    console.log('=== AUTO PROFIT DISTRIBUTION COMPLETED ===')
    console.log(`Execution time: ${executionTime}ms`)
    console.log(`Completed at: ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Automatic profit distribution completed successfully',
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime,
      distributionTypes: [
        'Investment profits (24-hour cycle)',
        'JRC staking profits (24-hour cycle)'
      ]
    }, { status: 200 })

  } catch (error: any) {
    const endTime = Date.now()
    const executionTime = endTime - startTime

    console.error('=== AUTO PROFIT DISTRIBUTION FAILED ===')
    console.error(`Error: ${error.message}`)
    console.error(`Stack: ${error.stack}`)
    console.error(`Execution time: ${executionTime}ms`)
    console.error(`Failed at: ${new Date().toISOString()}`)

    return NextResponse.json({ 
      success: false,
      error: error.message || 'Failed to distribute profits automatically',
      timestamp: new Date().toISOString(),
      executionTimeMs: executionTime
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check the status and get information about the auto distribution system
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Auto profit distribution status check requested')

    return NextResponse.json({
      success: true,
      message: 'Auto profit distribution endpoint is active',
      endpoint: '/api/auto-profit-distribution',
      methods: ['POST', 'GET'],
      description: 'Automatic profit distribution system for investment and JRC staking profits',
      features: [
        'No authentication required',
        'No parameters needed',
        'Handles both investment and JRC staking profits',
        '24-hour cycle distribution logic',
        'Comprehensive error handling and logging',
        'Execution time tracking'
      ],
      usage: {
        trigger: 'Send POST request to this endpoint',
        frequency: 'Can be called multiple times - system prevents duplicate distributions within 24 hours',
        external_cron: 'Suitable for external cron services like cron-job.org, EasyCron, etc.'
      },
      timestamp: new Date().toISOString()
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error in auto profit distribution status check:', error)
    
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Failed to get status information',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
