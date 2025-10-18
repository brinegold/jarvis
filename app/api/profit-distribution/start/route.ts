import { NextResponse } from 'next/server'

// This endpoint has been deprecated
// Profit distribution is now handled via:
// 1. External cron jobs calling /api/auto-profit-distribution
// 2. Manual admin button

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'This endpoint has been deprecated',
    message: 'Profit distribution is now handled via external cron jobs and manual admin button',
    alternatives: {
      cronJob: '/api/auto-profit-distribution (POST)',
      manual: 'Admin dashboard "Distribute Profits" button'
    }
  }, { status: 410 }) // 410 Gone
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'This endpoint has been deprecated',
    message: 'Profit distribution is now handled via external cron jobs and manual admin button',
    alternatives: {
      cronJob: '/api/auto-profit-distribution (POST)',
      manual: 'Admin dashboard "Distribute Profits" button'
    }
  }, { status: 410 }) // 410 Gone
}
