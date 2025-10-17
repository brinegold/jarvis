-- Test Auto Distribution System
-- This script simulates what the auto-distribution system should do
-- Use this to verify the profit distribution logic works correctly

-- ============================================================================
-- TEST 1: Check Current Investment Plans Status
-- ============================================================================

SELECT 'CURRENT INVESTMENT PLANS STATUS' as test_section;

SELECT 
  ip.id as plan_id,
  ip.user_id,
  ip.investment_amount,
  ip.daily_percentage || '%' as daily_rate,
  ip.created_at,
  ip.is_active,
  -- Calculate days since creation
  FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400) as days_since_creation,
  -- Calculate expected total profit
  FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400) * 
  ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total_profit,
  -- Get current stored total
  ip.total_profit_earned as stored_total,
  -- Get actual distributed amount
  COALESCE(pd.actual_distributed, 0) as actual_distributed,
  -- Check if eligible for distribution (24+ hours old)
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600 >= 24 THEN 'ELIGIBLE'
    ELSE 'TOO_NEW'
  END as distribution_status
FROM investment_plans ip
LEFT JOIN (
  SELECT plan_id, SUM(profit_amount) as actual_distributed
  FROM profit_distributions
  GROUP BY plan_id
) pd ON ip.id = pd.plan_id
WHERE ip.is_active = true
ORDER BY ip.created_at DESC;

-- ============================================================================
-- TEST 2: Check What Distributions Are Missing Today
-- ============================================================================

SELECT 'MISSING DISTRIBUTIONS FOR TODAY' as test_section;

WITH eligible_plans AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    -- Daily profit amount
    ip.investment_amount * (ip.daily_percentage / 100.0) as daily_profit
  FROM investment_plans ip
  WHERE ip.is_active = true
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600 >= 24  -- At least 24 hours old
)
SELECT 
  ep.plan_id,
  ep.user_id,
  ep.investment_amount,
  ep.daily_percentage || '%' as rate,
  ROUND(ep.daily_profit::numeric, 4) as daily_profit_amount,
  CURRENT_DATE as distribution_date_needed,
  CASE 
    WHEN pd.id IS NOT NULL THEN 'ALREADY_DISTRIBUTED'
    ELSE 'NEEDS_DISTRIBUTION'
  END as status
FROM eligible_plans ep
LEFT JOIN profit_distributions pd ON ep.plan_id = pd.plan_id 
  AND pd.distribution_date = CURRENT_DATE
ORDER BY status DESC, ep.plan_id;

-- ============================================================================
-- TEST 3: Simulate Auto-Distribution (CREATE MISSING DISTRIBUTIONS)
-- ============================================================================

SELECT 'SIMULATING AUTO-DISTRIBUTION' as test_section;

-- Create today's missing profit distributions
WITH eligible_plans AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.investment_amount * (ip.daily_percentage / 100.0) as daily_profit
  FROM investment_plans ip
  WHERE ip.is_active = true
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600 >= 24
),
missing_today AS (
  SELECT 
    ep.plan_id,
    ep.user_id,
    ep.daily_profit
  FROM eligible_plans ep
  LEFT JOIN profit_distributions pd ON ep.plan_id = pd.plan_id 
    AND pd.distribution_date = CURRENT_DATE
  WHERE pd.id IS NULL  -- No distribution for today
)
INSERT INTO profit_distributions (plan_id, user_id, profit_amount, distribution_date)
SELECT 
  plan_id,
  user_id,
  daily_profit,
  CURRENT_DATE
FROM missing_today;

-- Show how many distributions were created
SELECT 
  'DISTRIBUTIONS CREATED TODAY' as result,
  COUNT(*) as new_distributions,
  SUM(profit_amount) as total_profit_distributed
FROM profit_distributions 
WHERE distribution_date = CURRENT_DATE
  AND created_at >= NOW() - INTERVAL '1 minute';

-- ============================================================================
-- TEST 4: Update User Balances
-- ============================================================================

SELECT 'UPDATING USER BALANCES' as test_section;

-- Update user main wallet balances with today's profits
WITH todays_profits AS (
  SELECT 
    user_id,
    SUM(profit_amount) as total_profit
  FROM profit_distributions
  WHERE distribution_date = CURRENT_DATE
    AND created_at >= NOW() - INTERVAL '1 minute'  -- Only new distributions
  GROUP BY user_id
)
UPDATE profiles 
SET main_wallet_balance = main_wallet_balance + tp.total_profit,
    updated_at = NOW()
FROM todays_profits tp
WHERE profiles.id = tp.user_id;

-- Show updated balances
SELECT 
  'USER BALANCES UPDATED' as result,
  COUNT(*) as users_updated
FROM profiles 
WHERE updated_at >= NOW() - INTERVAL '1 minute';

-- ============================================================================
-- TEST 5: Update Investment Plan Totals
-- ============================================================================

SELECT 'UPDATING INVESTMENT TOTALS' as test_section;

-- Update total_profit_earned for investment plans
WITH plan_totals AS (
  SELECT 
    plan_id,
    SUM(profit_amount) as total_distributed
  FROM profit_distributions
  GROUP BY plan_id
)
UPDATE investment_plans 
SET total_profit_earned = pt.total_distributed,
    updated_at = NOW()
FROM plan_totals pt
WHERE investment_plans.id = pt.plan_id
  AND investment_plans.is_active = true;

-- ============================================================================
-- TEST 6: Create Transaction Records
-- ============================================================================

SELECT 'CREATING TRANSACTION RECORDS' as test_section;

-- Create transaction records for today's distributions
WITH todays_user_profits AS (
  SELECT 
    user_id,
    SUM(profit_amount) as daily_profit_total
  FROM profit_distributions
  WHERE distribution_date = CURRENT_DATE
    AND created_at >= NOW() - INTERVAL '1 minute'
  GROUP BY user_id
)
INSERT INTO transactions (user_id, transaction_type, amount, net_amount, status, description)
SELECT 
  user_id,
  'profit' as transaction_type,
  daily_profit_total,
  daily_profit_total,
  'completed' as status,
  'Daily profit distribution - ' || CURRENT_DATE as description
FROM todays_user_profits
WHERE daily_profit_total > 0;

-- ============================================================================
-- TEST 7: Final Verification
-- ============================================================================

SELECT 'FINAL VERIFICATION' as test_section;

-- Show current status after auto-distribution
WITH current_status AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400) as days_since_creation,
    FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total,
    ip.total_profit_earned as stored_total,
    COALESCE(pd.actual_distributed, 0) as actual_distributed
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600 >= 24
)
SELECT 
  plan_id,
  user_id,
  investment_amount,
  daily_percentage || '%' as rate,
  days_since_creation,
  ROUND(expected_total::numeric, 2) as expected_total,
  ROUND(stored_total::numeric, 2) as stored_total,
  ROUND(actual_distributed::numeric, 2) as actual_distributed,
  CASE 
    WHEN ABS(expected_total - GREATEST(stored_total, actual_distributed)) < 0.01 THEN 'CORRECT'
    WHEN expected_total > GREATEST(stored_total, actual_distributed) THEN 'STILL_MISSING'
    ELSE 'OVERPAID'
  END as profit_status
FROM current_status
ORDER BY profit_status DESC, plan_id;

-- Summary
SELECT 
  'AUTO-DISTRIBUTION TEST COMPLETED' as status,
  COUNT(*) as total_active_plans,
  COUNT(*) FILTER (WHERE ABS(expected_total - GREATEST(stored_total, actual_distributed)) < 0.01) as correct_plans,
  COUNT(*) FILTER (WHERE expected_total > GREATEST(stored_total, actual_distributed)) as plans_still_missing
FROM (
  SELECT 
    ip.id,
    FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total,
    ip.total_profit_earned as stored_total,
    COALESCE(pd.actual_distributed, 0) as actual_distributed
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 3600 >= 24
) summary;

-- ============================================================================
-- USAGE INSTRUCTIONS:
-- ============================================================================
-- This script simulates what the auto-distribution API should do daily.
-- It will:
-- 1. Check which plans need profit distribution for today
-- 2. Create missing profit distribution records
-- 3. Update user wallet balances
-- 4. Update investment plan totals
-- 5. Create transaction records
-- 6. Verify everything is correct
--
-- Run this script to test if the profit distribution logic works correctly.
-- This is essentially what happens when you call the auto-distribution API.
-- ============================================================================
