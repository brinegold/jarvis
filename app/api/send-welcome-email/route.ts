import { NextRequest, NextResponse } from 'next/server'
import EmailService from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, userName, referralCode } = body

    // Validate required fields
    if (!userEmail || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: userEmail and userName are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Send welcome email
    const emailService = new EmailService()
    const success = await emailService.sendWelcomeEmail({
      userEmail,
      userName,
      referralCode
    })

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Welcome email sent successfully' 
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Welcome email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
