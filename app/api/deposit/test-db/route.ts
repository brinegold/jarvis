import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    console.log('🔍 Testing database connection...')
    
    // Test if deposit_requests table exists
    const { data, error } = await supabase
      .from('deposit_requests')
      .select('id')
      .limit(1)

    if (error) {
      console.error('❌ Database error:', error)

      // Check if it's a table not found error
      if (error.code === 'PGRST116' || error.message?.includes('relation "public.deposit_requests" does not exist')) {
        return NextResponse.json({
          success: false,
          error: 'Database table "deposit_requests" does not exist',
          solution: 'Please run the SQL schema file: supabase/manual_deposit_schema.sql',
          details: error.message,
          steps: [
            '1. Go to Supabase Dashboard → SQL Editor',
            '2. Copy and paste the SQL from create_deposit_table.sql',
            '3. Click Run',
            '4. Check if table appears in Table Editor',
            '5. Refresh this page and try again'
          ]
        }, { status: 500 })
      }

      // Check if it's a foreign key relationship error
      if (error.code === 'PGRST200' && error.message?.includes('foreign key relationship')) {
        return NextResponse.json({
          success: false,
          error: 'Foreign key relationship issue',
          solution: 'The profiles table reference is incorrect. Please use the updated SQL file.',
          details: error.message,
          steps: [
            '1. Drop existing deposit_requests table if it exists',
            '2. Run the corrected SQL from create_deposit_table.sql',
            '3. The foreign key should reference profiles(id), not auth.users(id)'
          ]
        }, { status: 500 })
      }

      return NextResponse.json({
        success: false,
        error: 'Database table not accessible',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log('✅ Database table exists and is accessible')
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      tableExists: true,
      data: data
    })

  } catch (error: any) {
    console.error('❌ Test failed:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Database test failed' 
    }, { status: 500 })
  }
}
