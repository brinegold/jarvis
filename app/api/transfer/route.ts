import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Transfer functionality temporarily disabled for build compatibility' 
  }, { status: 503 })
}
