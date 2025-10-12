import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase-server'
import { distributeProfits } from '@/lib/profit-distribution'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
    }

    console.log('Admin triggered profit distribution:', user.id)

    // Trigger profit distribution
    await distributeProfits()

    return NextResponse.json({
      success: true,
      message: 'Profit distribution completed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error in profit distribution API:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to distribute profits' 
    }, { status: 500 })
  }
}

// GET endpoint to check profit distribution status
export async function GET(request: NextRequest) {
  try {
    // TODO: Implement proper authentication
    // For now, using a temporary solution to bypass auth issues
    const user = { id: 'temp-user', email: 'user@temp.com' }
    const supabase = supabaseAdmin

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 })
    }

    // Get recent profit distributions
    const { data: recentDistributions, error: distributionError } = await supabase
      .from('profit_distributions')
      .select(`
        *,
        profiles!inner(username)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (distributionError) {
      console.error('Error fetching distributions:', distributionError)
    }

    // Get today's distribution stats
    const today = new Date().toISOString().split('T')[0]
    const { data: todayStats, error: statsError } = await supabase
      .from('profit_distributions')
      .select('profit_amount')
      .eq('distribution_date', today)

    const todayTotal = todayStats?.reduce((sum, dist) => sum + (dist.profit_amount || 0), 0) || 0
    const todayCount = todayStats?.length || 0

    return NextResponse.json({
      success: true,
      data: {
        recentDistributions: recentDistributions || [],
        todayStats: {
          totalAmount: todayTotal,
          distributionCount: todayCount,
          date: today
        }
      }
    })

  } catch (error: any) {
    console.error('Error fetching profit distribution status:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch distribution status' 
    }, { status: 500 })
  }
}
