-- Manual Profit Catch-up Script
-- This script identifies investment plans that should have received profits but haven't,
-- and manually distributes the missing profits to catch up.

-- IMPORTANT: Run this script carefully and review the results before committing
-- It's recommended to run in a transaction first to review the changes

BEGIN;

-- Step 1: Create a temporary table to store calculations
CREATE TEMP TABLE profit_catchup_calculations AS
WITH investment_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.is_active,
    ip.total_profit_earned,
    -- Calculate how many days since creation (minimum 1 day required)
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) as days_since_creation,
    -- Calculate expected total profit based on days elapsed
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total_profit,
    -- Get actual distributed profit from profit_distributions table
    COALESCE(pd.actual_distributed, 0) as actual_distributed_profit,
    -- Get stored total profit from investment_plans table
    COALESCE(ip.total_profit_earned, 0) as stored_total_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours' -- Only plans older than 24 hours
)
SELECT 
  plan_id,
  user_id,
  investment_amount,
  daily_percentage,
  created_at,
  days_since_creation,
  expected_total_profit,
  actual_distributed_profit,
  stored_total_profit,
  -- Calculate the maximum of actual distributed or stored total
  GREATEST(actual_distributed_profit, stored_total_profit) as current_total_profit,
  -- Calculate missing profit (expected - current)
  GREATEST(0, expected_total_profit - GREATEST(actual_distributed_profit, stored_total_profit)) as missing_profit,
  -- Calculate how many days of profit are missing
  CASE 
    WHEN investment_amount > 0 AND daily_percentage > 0 THEN
      FLOOR(GREATEST(0, expected_total_profit - GREATEST(actual_distributed_profit, stored_total_profit)) / 
            (investment_amount * (daily_percentage / 100.0)))
    ELSE 0
  END as missing_days
FROM investment_analysis
WHERE 
  -- Only include plans that have missing profits
  expected_total_profit > GREATEST(actual_distributed_profit, stored_total_profit)
  AND days_since_creation > 0;

-- Step 2: Display the analysis (for review)
SELECT 
  'PROFIT CATCHUP ANALYSIS' as report_section,
  COUNT(*) as plans_needing_catchup,
  SUM(missing_profit) as total_missing_profit,
  AVG(missing_days) as avg_missing_days
FROM profit_catchup_calculations;

-- Step 3: Show detailed breakdown
SELECT 
  plan_id,
  user_id,
  investment_amount,
  daily_percentage || '%' as daily_rate,
  days_since_creation,
  ROUND(expected_total_profit::numeric, 8) as expected_profit,
  ROUND(current_total_profit::numeric, 8) as current_profit,
  ROUND(missing_profit::numeric, 8) as missing_profit,
  missing_days as days_behind
FROM profit_catchup_calculations
ORDER BY missing_profit DESC;

-- Step 4: Generate the missing profit distributions
-- This creates individual daily profit entries for each missing day
INSERT INTO profit_distributions (plan_id, user_id, profit_amount, distribution_date)
SELECT 
  pcc.plan_id,
  pcc.user_id,
  pcc.investment_amount * (pcc.daily_percentage / 100.0) as daily_profit,
  (pcc.created_at + (generate_series(1, pcc.missing_days::integer) * INTERVAL '1 day'))::date as distribution_date
FROM profit_catchup_calculations pcc
WHERE pcc.missing_days > 0
  AND NOT EXISTS (
    -- Don't create duplicate distributions for dates that already exist
    SELECT 1 FROM profit_distributions pd 
    WHERE pd.plan_id = pcc.plan_id 
    AND pd.distribution_date = (pcc.created_at + (generate_series(1, pcc.missing_days::integer) * INTERVAL '1 day'))::date
  );

-- Step 5: Update user wallet balances
UPDATE profiles 
SET main_wallet_balance = main_wallet_balance + catchup.total_missing_profit
FROM (
  SELECT 
    user_id,
    SUM(missing_profit) as total_missing_profit
  FROM profit_catchup_calculations
  GROUP BY user_id
) catchup
WHERE profiles.id = catchup.user_id;

-- Step 6: Update investment plans total_profit_earned
UPDATE investment_plans 
SET total_profit_earned = total_profit_earned + catchup.missing_profit
FROM profit_catchup_calculations catchup
WHERE investment_plans.id = catchup.plan_id;

-- Step 7: Create transaction records for the catch-up profits
INSERT INTO transactions (user_id, transaction_type, amount, net_amount, status, description)
SELECT 
  user_id,
  'profit' as transaction_type,
  missing_profit as amount,
  missing_profit as net_amount,
  'completed' as status,
  'Profit catch-up for ' || missing_days || ' missing days' as description
FROM profit_catchup_calculations
WHERE missing_profit > 0;

-- Step 8: Final summary
SELECT 
  'CATCHUP COMPLETED' as status,
  COUNT(*) as plans_updated,
  SUM(missing_profit) as total_profit_distributed,
  COUNT(DISTINCT user_id) as users_affected
FROM profit_catchup_calculations
WHERE missing_profit > 0;

-- COMMIT; -- Uncomment this line to commit the changes
-- ROLLBACK; -- Uncomment this line to rollback if you want to review first

-- Usage Instructions:
-- 1. First run with ROLLBACK to review the changes
-- 2. Check the analysis output to ensure it looks correct
-- 3. If satisfied, change ROLLBACK to COMMIT and run again

-- Safety Notes:
-- - This script only affects active investment plans older than 24 hours
-- - It won't create duplicate profit distributions for existing dates
-- - It calculates missing profits based on expected vs actual distributions
-- - All changes are wrapped in a transaction for safety
