-- Profit Analysis Report
-- This script analyzes profit distributions without making any changes
-- Use this to identify accounts that need profit catch-up

-- 1. Overall Investment Summary
SELECT 
  'INVESTMENT OVERVIEW' as report_section,
  COUNT(*) as total_active_plans,
  COUNT(*) FILTER (WHERE created_at <= NOW() - INTERVAL '24 hours') as plans_eligible_for_profits,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as plans_too_new,
  ROUND(SUM(investment_amount)::numeric, 2) as total_investment_amount,
  ROUND(SUM(total_profit_earned)::numeric, 2) as total_stored_profits
FROM investment_plans 
WHERE is_active = true;

-- 2. Profit Distribution Summary
SELECT 
  'PROFIT DISTRIBUTION SUMMARY' as report_section,
  COUNT(DISTINCT plan_id) as plans_with_distributions,
  COUNT(*) as total_distributions,
  ROUND(SUM(profit_amount)::numeric, 2) as total_distributed_amount,
  MIN(distribution_date) as earliest_distribution,
  MAX(distribution_date) as latest_distribution
FROM profit_distributions;

-- 3. Plans Missing Recent Profits (Last 7 Days)
WITH profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    -- Calculate days since creation (capped at 7 for recent analysis)
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as recent_days,
    -- Expected profit for recent period
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    -- Actual distributed in recent period
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit,
    -- All-time distributed
    COALESCE(all_pd.total_distributed, 0) as total_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as total_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) all_pd ON ip.id = all_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
)
SELECT 
  'RECENT PROFIT ANALYSIS (Last 7 Days)' as report_section,
  COUNT(*) as total_eligible_plans,
  COUNT(*) FILTER (WHERE expected_recent_profit > recent_distributed_profit) as plans_missing_recent_profits,
  ROUND(SUM(GREATEST(0, expected_recent_profit - recent_distributed_profit))::numeric, 2) as total_missing_recent_profit,
  ROUND(AVG(GREATEST(0, expected_recent_profit - recent_distributed_profit))::numeric, 2) as avg_missing_per_plan
FROM profit_analysis;

-- 4. Detailed Breakdown of Plans Missing Recent Profits
WITH profit_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) as recent_days,
    LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_recent_profit,
    COALESCE(recent_pd.recent_distributed, 0) as recent_distributed_profit,
    COALESCE(all_pd.total_distributed, 0) as total_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as recent_distributed
    FROM profit_distributions
    WHERE distribution_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY plan_id
  ) recent_pd ON ip.id = recent_pd.plan_id
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as total_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) all_pd ON ip.id = all_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
)
SELECT 
  plan_id,
  user_id,
  ROUND(investment_amount::numeric, 2) as investment,
  daily_percentage || '%' as daily_rate,
  recent_days as days_in_period,
  created_at::date as created_date,
  ROUND(expected_recent_profit::numeric, 4) as expected_recent,
  ROUND(recent_distributed_profit::numeric, 4) as distributed_recent,
  ROUND(GREATEST(0, expected_recent_profit - recent_distributed_profit)::numeric, 4) as missing_recent,
  ROUND(total_distributed_profit::numeric, 4) as total_distributed,
  ROUND(total_profit_earned::numeric, 4) as stored_total,
  CASE 
    WHEN expected_recent_profit > recent_distributed_profit THEN 'NEEDS CATCHUP'
    ELSE 'UP TO DATE'
  END as status
FROM profit_analysis
WHERE expected_recent_profit > recent_distributed_profit
ORDER BY GREATEST(0, expected_recent_profit - recent_distributed_profit) DESC
LIMIT 20;

-- 5. All-Time Profit Analysis
WITH lifetime_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    -- Total days since creation
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) as total_days,
    -- Expected lifetime profit
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_lifetime_profit,
    -- Actual distributed lifetime
    COALESCE(all_pd.total_distributed, 0) as total_distributed_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as total_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) all_pd ON ip.id = all_pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
)
SELECT 
  'LIFETIME PROFIT ANALYSIS' as report_section,
  COUNT(*) as total_plans,
  COUNT(*) FILTER (WHERE expected_lifetime_profit > GREATEST(total_distributed_profit, total_profit_earned)) as plans_behind_lifetime,
  ROUND(SUM(GREATEST(0, expected_lifetime_profit - GREATEST(total_distributed_profit, total_profit_earned)))::numeric, 2) as total_lifetime_deficit,
  ROUND(AVG(total_days)::numeric, 1) as avg_days_active
FROM lifetime_analysis;

-- 6. User-Level Summary
WITH user_summary AS (
  SELECT 
    ip.user_id,
    COUNT(*) as active_plans,
    ROUND(SUM(ip.investment_amount)::numeric, 2) as total_investment,
    ROUND(SUM(ip.total_profit_earned)::numeric, 2) as stored_profits,
    ROUND(SUM(COALESCE(pd.distributed, 0))::numeric, 2) as actual_distributed,
    -- Recent missing profits
    ROUND(SUM(
      GREATEST(0, 
        LEAST(7, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400))) * 
        ip.investment_amount * (ip.daily_percentage / 100.0) - 
        COALESCE(recent_pd.recent_distributed, 0)
      )
    )::numeric, 2) as missing_recent_profits
  FROM investment_plans ip
  LEFT JOIN (
    SELECT 
      plan_id,
      SUM(profit_amount) as distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
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
  GROUP BY ip.user_id
)
SELECT 
  'TOP USERS NEEDING CATCHUP' as report_section,
  user_id,
  active_plans,
  total_investment,
  stored_profits,
  actual_distributed,
  missing_recent_profits,
  CASE 
    WHEN missing_recent_profits > 0 THEN 'NEEDS RECENT CATCHUP'
    ELSE 'UP TO DATE'
  END as status
FROM user_summary
WHERE missing_recent_profits > 0
ORDER BY missing_recent_profits DESC
LIMIT 10;

-- 7. Distribution Date Analysis
SELECT 
  'DISTRIBUTION FREQUENCY ANALYSIS' as report_section,
  distribution_date,
  COUNT(*) as distributions_count,
  COUNT(DISTINCT plan_id) as unique_plans,
  ROUND(SUM(profit_amount)::numeric, 2) as total_amount
FROM profit_distributions
WHERE distribution_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY distribution_date
ORDER BY distribution_date DESC
LIMIT 10;
