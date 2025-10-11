// Comprehensive Referral System Debug Script
// Run this in your browser console on the referral page

async function debugReferralSystem() {
  console.log('🔍 DEBUGGING REFERRAL SYSTEM');
  console.log('================================');
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('❌ No authenticated user found');
    return;
  }
  
  console.log('👤 Current User ID:', user.id);
  
  // 1. Check user profile and referral setup
  console.log('\n📋 1. CHECKING USER PROFILE');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  console.log('Profile:', profile);
  if (profileError) console.log('❌ Profile Error:', profileError);
  
  // 2. Check if referral_commissions table has dual commission columns
  console.log('\n📊 2. CHECKING REFERRAL_COMMISSIONS TABLE STRUCTURE');
  const { data: sampleCommission, error: structureError } = await supabase
    .from('referral_commissions')
    .select('*')
    .limit(1);
  
  if (sampleCommission && sampleCommission.length > 0) {
    console.log('Table columns available:', Object.keys(sampleCommission[0]));
    console.log('✅ Has usdt_commission:', 'usdt_commission' in sampleCommission[0]);
    console.log('✅ Has jrc_commission:', 'jrc_commission' in sampleCommission[0]);
  } else {
    console.log('⚠️ No commission records found or table structure issue');
  }
  
  // 3. Check existing referral commissions
  console.log('\n💰 3. CHECKING EXISTING COMMISSIONS');
  const { data: commissions, error: commError } = await supabase
    .from('referral_commissions')
    .select('*')
    .eq('referrer_id', user.id);
  
  console.log('Total commission records:', commissions?.length || 0);
  console.log('Commission records:', commissions);
  if (commError) console.log('❌ Commission Error:', commError);
  
  // 4. Check direct referrals
  console.log('\n👥 4. CHECKING DIRECT REFERRALS');
  if (profile?.referral_code) {
    const { data: directReferrals, error: refError } = await supabase
      .from('profiles')
      .select('id, full_name, referral_code, sponsor_id')
      .eq('sponsor_id', profile.referral_code);
    
    console.log('Direct referrals found:', directReferrals?.length || 0);
    console.log('Direct referrals:', directReferrals);
    if (refError) console.log('❌ Referral Error:', refError);
  }
  
  // 5. Test the dualReferralService
  console.log('\n🔧 5. TESTING DUAL REFERRAL SERVICE');
  try {
    // Note: This assumes dualReferralService is available globally
    // If not, you'll need to import it or access it through the app
    if (typeof dualReferralService !== 'undefined') {
      const stats = await dualReferralService.getReferralStats(user.id);
      console.log('Dual referral stats:', stats);
    } else {
      console.log('⚠️ dualReferralService not available in global scope');
    }
  } catch (error) {
    console.log('❌ Dual referral service error:', error);
  }
  
  // 6. Check if there are any investment/staking records
  console.log('\n📈 6. CHECKING INVESTMENT/STAKING ACTIVITY');
  const { data: investments, error: invError } = await supabase
    .from('investment_plans')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('Recent investments:', investments);
  if (invError) console.log('❌ Investment Error:', invError);
  
  console.log('\n✅ DEBUG COMPLETE');
  console.log('================================');
  
  return {
    user,
    profile,
    commissions,
    directReferrals: profile?.referral_code ? await supabase
      .from('profiles')
      .select('*')
      .eq('sponsor_id', profile.referral_code) : null
  };
}

// Auto-run the debug
console.log('🚀 Starting Referral System Debug...');
debugReferralSystem().then(result => {
  console.log('📋 Debug Summary:', result);
}).catch(error => {
  console.error('❌ Debug failed:', error);
});

// Also provide manual functions
window.debugReferralSystem = debugReferralSystem;
