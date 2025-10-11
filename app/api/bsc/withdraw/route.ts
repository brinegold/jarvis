import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'BSC withdrawal temporarily disabled' 
  }, { status: 503 })
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ 
    error: 'BSC withdrawal update temporarily disabled' 
  }, { status: 503 })
}
