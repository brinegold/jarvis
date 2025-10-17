-- Recent Profit Catch-up Script (Last 7 Days Only)
-- This is a safer version that only catches up profits for the last 7 days
-- Use this for regular maintenance to avoid large catch-up operations

BEGIN;

-- Step 1: Analyze recent missing profits (last 7 days only)
WITH recent_profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    -- Only look at the last 7 days or since creation if newer
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as days_to_check,
    -- Calculate expected profit for the period we're checking
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    -- Get profit distributions from the last 7 days
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours' -- Only plans older than 24 hours
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400 >= 1 -- At least 1 day old
),
missing_recent_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_recent_profit - recent_distributed_profit) as missing_recent_profit,
    CASE 
      WHEN investment_amount > 0 AND daily_percentage > 0 THEN
        FLOOR(GREATEST(0, expected_recent_profit - recent_distributed_profit) / 
              (investment_amount * (daily_percentage / 100.0)))
      ELSE 0
    END as missing_recent_days
  FROM recent_profit_analysis
  WHERE expected_recent_profit > recent_distributed_profit
)
SELECT 
  'RECENT PROFIT ANALYSIS (Last 7 Days)' as report_section,
  COUNT(*) as plans_needing_recent_catchup,
  ROUND(SUM(missing_recent_profit)::numeric, 2) as total_missing_recent_profit,
  ROUND(AVG(missing_recent_days)::numeric, 1) as avg_missing_days
FROM missing_recent_profits;

-- Step 2: Show detailed breakdown of recent missing profits
WITH recent_profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as days_to_check,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400 >= 1
),
missing_recent_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_recent_profit - recent_distributed_profit) as missing_recent_profit,
    CASE 
      WHEN investment_amount > 0 AND daily_percentage > 0 THEN
        FLOOR(GREATEST(0, expected_recent_profit - recent_distributed_profit) / 
              (investment_amount * (daily_percentage / 100.0)))
      ELSE 0
    END as missing_recent_days
  FROM recent_profit_analysis
  WHERE expected_recent_profit > recent_distributed_profit
)
SELECT 
  plan_id,
  user_id,
  ROUND(investment_amount::numeric, 2) as investment,
  daily_percentage || '%' as daily_rate,
  days_to_check as days_checked,
  ROUND(expected_recent_profit::numeric, 4) as expected_profit,
  ROUND(recent_distributed_profit::numeric, 4) as distributed_profit,
  ROUND(missing_recent_profit::numeric, 4) as missing_profit,
  missing_recent_days as days_behind
FROM missing_recent_profits
WHERE missing_recent_profit > 0
ORDER BY missing_recent_profit DESC;

-- Step 3: Create missing profit distributions for recent period only
WITH recent_profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as days_to_check,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400 >= 1
),
missing_recent_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_recent_profit - recent_distributed_profit) as missing_recent_profit,
    CASE 
      WHEN investment_amount > 0 AND daily_percentage > 0 THEN
        FLOOR(GREATEST(0, expected_recent_profit - recent_distributed_profit) / 
              (investment_amount * (daily_percentage / 100.0)))
      ELSE 0
    END as missing_recent_days
  FROM recent_profit_analysis
  WHERE expected_recent_profit > recent_distributed_profit
),
profit_distributions_to_create AS (
  SELECT 
    mrp.plan_id,
    mrp.user_id,
    mrp.investment_amount * (mrp.daily_percentage / 100.0) as daily_profit,
    (CURRENT_DATE - (mrp.missing_recent_days - gs.day_offset) * INTERVAL '1 day')::date as distribution_date
  FROM missing_recent_profits mrp
  CROSS JOIN generate_series(1, 7) gs(day_offset)
  WHERE mrp.missing_recent_days > 0
    AND gs.day_offset <= mrp.missing_recent_days
)
INSERT INTO profit_distributions (plan_id, user_id, profit_amount, distribution_date)
SELECT 
  ptc.plan_id,
  ptc.user_id,
  ptc.daily_profit,
  ptc.distribution_date
FROM profit_distributions_to_create ptc
WHERE NOT EXISTS (
  SELECT 1 FROM profit_distributions pd 
  WHERE pd.plan_id = ptc.plan_id 
  AND pd.distribution_date = ptc.distribution_date
);

-- Step 4: Update user balances and investment totals
WITH recent_profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as days_to_check,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400 >= 1
),
missing_recent_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_recent_profit - recent_distributed_profit) as missing_recent_profit
  FROM recent_profit_analysis
  WHERE expected_recent_profit > recent_distributed_profit
)
-- Update user wallet balances
UPDATE profiles 
SET main_wallet_balance = main_wallet_balance + user_totals.total_missing
FROM (
  SELECT 
    user_id,
    SUM(missing_recent_profit) as total_missing
  FROM missing_recent_profits
  GROUP BY user_id
) user_totals
WHERE profiles.id = user_totals.user_id;

-- Update investment plan totals
WITH recent_profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as days_to_check,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400 >= 1
),
missing_recent_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_recent_profit - recent_distributed_profit) as missing_recent_profit
  FROM recent_profit_analysis
  WHERE expected_recent_profit > recent_distributed_profit
)
UPDATE investment_plans 
SET total_profit_earned = total_profit_earned + mrp.missing_recent_profit
FROM missing_recent_profits mrp
WHERE investment_plans.id = mrp.plan_id;

-- Step 5: Create transaction records
WITH recent_profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as days_to_check,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
    AND EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400 >= 1
),
missing_recent_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_recent_profit - recent_distributed_profit) as missing_recent_profit,
    CASE 
      WHEN investment_amount > 0 AND daily_percentage > 0 THEN
        FLOOR(GREATEST(0, expected_recent_profit - recent_distributed_profit) / 
              (investment_amount * (daily_percentage / 100.0)))
      ELSE 0
    END as missing_recent_days
  FROM recent_profit_analysis
  WHERE expected_recent_profit > recent_distributed_profit
)
INSERT INTO transactions (user_id, transaction_type, amount, net_amount, status, description)
SELECT 
  user_id,
  'profit' as transaction_type,
  missing_recent_profit as amount,
  missing_recent_profit as net_amount,
  'completed' as status,
  'Recent profit catch-up (' || missing_recent_days || ' days)' as description
FROM missing_recent_profits
WHERE missing_recent_profit > 0;

-- Final summary
SELECT 
  'RECENT CATCHUP COMPLETED' as status,
  NOW() as completed_at,
  'Last 7 days only' as scope;

-- COMMIT; -- Uncomment to commit changes
-- ROLLBACK; -- Uncomment to rollback and review first
