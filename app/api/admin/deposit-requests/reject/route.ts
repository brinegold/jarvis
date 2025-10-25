import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
import EmailService from '@/lib/email-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get the authenticated user from the session
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId, adminNotes } = await request.json()

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 })
    }

    if (!adminNotes || !adminNotes.trim()) {
      return NextResponse.json({ 
        error: 'Admin notes are required when rejecting a deposit request' 
      }, { status: 400 })
    }

    // Get the deposit request details before rejection
    const { data: depositRequest } = await supabase
      .from('deposit_requests')
      .select(`
        *,
        user_profile:profiles!deposit_requests_user_id_fkey(full_name, username)
      `)
      .eq('id', requestId)
      .single()

    if (!depositRequest) {
      return NextResponse.json({ 
        error: 'Deposit request not found' 
      }, { status: 404 })
    }

    if (depositRequest.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Deposit request has already been processed' 
      }, { status: 400 })
    }

    // Reject the deposit using the database function
    const { data: result, error: rejectError } = await supabase
      .rpc('reject_manual_deposit', {
        p_request_id: requestId,
        p_admin_id: user.id,
        p_admin_notes: adminNotes.trim()
      })

    if (rejectError) {
      console.error('Error rejecting deposit:', rejectError)
      return NextResponse.json({ 
        error: 'Failed to reject deposit request' 
      }, { status: 500 })
    }

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to reject deposit' 
      }, { status: 400 })
    }

    // Send rejection email to user
    try {
      const { data: authUser } = await (supabaseAdmin.auth as any).admin.getUserById(depositRequest.user_id)

      if (authUser.user?.email) {
        const emailService = new EmailService()
        await emailService.sendDepositNotification(
          authUser.user.email,
          depositRequest.user_profile?.full_name || 'User',
          depositRequest.amount,
          depositRequest.currency,
          'failed',
          depositRequest.tx_hash,
          0,
          0,
          adminNotes.trim()
        )
        console.log("Deposit rejection email sent")
      }
    } catch (emailError) {
      console.error("Failed to send deposit rejection email:", emailError)
      // Don't fail the rejection if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Deposit request rejected successfully"
    })

  } catch (error: any) {
    console.error("Error rejecting deposit request:", error)
    return NextResponse.json({ 
      error: error.message || "Failed to reject deposit request" 
    }, { status: 500 })
  }
}
