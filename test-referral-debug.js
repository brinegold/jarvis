// Test script to debug referral system
// Run this in the browser console on your app to test referral functionality

async function testReferralSystem(userId) {
  console.log('🔍 Testing Referral System for User:', userId);
  
  // Test 1: Check user's sponsor_id
  const { data: userProfile, error: userError } = await supabase
    .from('profiles')
    .select('id, full_name, sponsor_id, referral_code')
    .eq('id', userId)
    .single();
  
  console.log('👤 User Profile:', userProfile);
  if (userError) console.error('❌ User Error:', userError);
  
  if (!userProfile?.sponsor_id) {
    console.log('⚠️ User has no sponsor_id - no referral relationship');
    return;
  }
  
  // Test 2: Find the referrer
  const { data: referrer, error: referrerError } = await supabase
    .from('profiles')
    .select('id, full_name, referral_code, main_wallet_balance, total_jarvis_tokens')
    .eq('referral_code', userProfile.sponsor_id)
    .single();
  
  console.log('👥 Referrer Profile:', referrer);
  if (referrerError) console.error('❌ Referrer Error:', referrerError);
  
  // Test 3: Check referral commissions
  const { data: commissions, error: commError } = await supabase
    .from('referral_commissions')
    .select('*')
    .eq('referrer_id', referrer?.id);
  
  console.log('💰 Referral Commissions:', commissions);
  if (commError) console.error('❌ Commission Error:', commError);
  
  // Test 4: Check if referral relationship exists in referrals table
  const { data: referralRelation, error: relError } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', referrer?.id)
    .eq('referred_id', userId);
  
  console.log('🔗 Referral Relationship:', referralRelation);
  if (relError) console.error('❌ Relation Error:', relError);
  
  return {
    user: userProfile,
    referrer,
    commissions,
    relationship: referralRelation
  };
}

// Usage: testReferralSystem('your-user-id-here')
console.log('📋 Referral Debug Script Loaded');
console.log('Usage: testReferralSystem("your-user-id-here")');
