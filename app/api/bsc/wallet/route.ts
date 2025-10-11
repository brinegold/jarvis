import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    error: 'BSC wallet temporarily disabled' 
  }, { status: 503 })
}
