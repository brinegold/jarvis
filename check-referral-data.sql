-- Check current referral system data
-- Run these queries in Supabase SQL editor to debug the referral system

-- 1. Check if dual commission columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'referral_commissions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check existing referral commission records
SELECT 
  id,
  referrer_id,
  referred_id,
  level,
  commission_amount,
  commission_percentage,
  -- These columns might not exist yet if migration wasn't run
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referral_commissions' 
    AND column_name = 'usdt_commission'
  ) THEN usdt_commission ELSE NULL END as usdt_commission,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referral_commissions' 
    AND column_name = 'jrc_commission'
  ) THEN jrc_commission ELSE NULL END as jrc_commission,
  created_at
FROM public.referral_commissions
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check referral relationships
SELECT 
  p1.id as user_id,
  p1.full_name as user_name,
  p1.referral_code as user_code,
  p1.sponsor_id,
  p2.id as referrer_id,
  p2.full_name as referrer_name,
  p2.referral_code as referrer_code
FROM public.profiles p1
LEFT JOIN public.profiles p2 ON p1.sponsor_id = p2.referral_code
WHERE p1.sponsor_id IS NOT NULL
ORDER BY p1.created_at DESC
LIMIT 10;

-- 4. Check recent investments that should trigger referral commissions
SELECT 
  ip.id,
  ip.user_id,
  p.full_name,
  p.sponsor_id,
  ip.investment_amount,
  ip.jarvis_tokens_earned,
  ip.created_at
FROM public.investment_plans ip
JOIN public.profiles p ON ip.user_id = p.id
WHERE ip.created_at > NOW() - INTERVAL '7 days'
ORDER BY ip.created_at DESC
LIMIT 10;

-- 5. Count total referrals per user
SELECT 
  p2.id as referrer_id,
  p2.full_name as referrer_name,
  p2.referral_code,
  COUNT(p1.id) as direct_referrals
FROM public.profiles p2
LEFT JOIN public.profiles p1 ON p1.sponsor_id = p2.referral_code
GROUP BY p2.id, p2.full_name, p2.referral_code
HAVING COUNT(p1.id) > 0
ORDER BY direct_referrals DESC;
