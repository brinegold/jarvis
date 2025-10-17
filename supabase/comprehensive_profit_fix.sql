-- COMPREHENSIVE PROFIT FIX SCRIPT
-- This script fixes all profit distribution issues once and for all
-- It handles both USDT investment profits (5% daily) and JRC staking profits

BEGIN;

-- ============================================================================
-- PART 1: ANALYSIS - Show current state before fixing
-- ============================================================================

SELECT 'CURRENT STATE ANALYSIS' as section;

-- Show investment plans that should have profits
WITH investment_analysis AS (
  SELECT 
    ip.id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    -- Calculate actual days since creation (minimum 1 day to get profits)
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) as days_since_creation,
    -- Calculate expected total profit
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total_profit,
    -- Get actual distributed profits
    COALESCE(pd.actual_distributed, 0) as actual_distributed
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
)
SELECT 
  id as plan_id,
  user_id,
  investment_amount,
  daily_percentage || '%' as daily_rate,
  created_at::date as start_date,
  days_since_creation,
  ROUND(expected_total_profit::numeric, 2) as expected_profit,
  ROUND(actual_distributed::numeric, 2) as actual_distributed,
  ROUND(total_profit_earned::numeric, 2) as stored_total,
  ROUND((expected_total_profit - GREATEST(actual_distributed, total_profit_earned))::numeric, 2) as missing_profit
FROM investment_analysis
WHERE expected_total_profit > GREATEST(actual_distributed, total_profit_earned)
ORDER BY missing_profit DESC;

-- ============================================================================
-- PART 2: FIX MISSING PROFIT DISTRIBUTIONS
-- ============================================================================

SELECT 'CREATING MISSING PROFIT DISTRIBUTIONS' as section;

-- Create missing daily profit distribution records
WITH investment_analysis AS (
  SELECT 
    ip.id as plan_id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) as days_since_creation,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total_profit,
    COALESCE(pd.actual_distributed, 0) as actual_distributed
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
),
missing_profits AS (
  SELECT 
    *,
    GREATEST(0, expected_total_profit - GREATEST(actual_distributed, total_profit_earned)) as missing_amount,
    CASE 
      WHEN investment_amount > 0 AND daily_percentage > 0 THEN
        FLOOR(GREATEST(0, expected_total_profit - GREATEST(actual_distributed, total_profit_earned)) / 
              (investment_amount * (daily_percentage / 100.0)))
      ELSE 0
    END as missing_days
  FROM investment_analysis
  WHERE expected_total_profit > GREATEST(actual_distributed, total_profit_earned)
),
daily_distributions AS (
  SELECT 
    mp.plan_id,
    mp.user_id,
    mp.investment_amount * (mp.daily_percentage / 100.0) as daily_profit_amount,
    (mp.created_at::date + (gs.day_num * INTERVAL '1 day'))::date as distribution_date
  FROM missing_profits mp
  CROSS JOIN generate_series(1, 30) gs(day_num)  -- Max 30 days lookback
  WHERE mp.missing_days > 0
    AND gs.day_num <= mp.missing_days
    AND (mp.created_at::date + (gs.day_num * INTERVAL '1 day'))::date <= CURRENT_DATE
)
INSERT INTO profit_distributions (plan_id, user_id, profit_amount, distribution_date)
SELECT 
  dd.plan_id,
  dd.user_id,
  dd.daily_profit_amount,
  dd.distribution_date
FROM daily_distributions dd
WHERE NOT EXISTS (
  SELECT 1 FROM profit_distributions pd 
  WHERE pd.plan_id = dd.plan_id 
  AND pd.distribution_date = dd.distribution_date
);

-- Show how many distributions were created
SELECT 
  'PROFIT DISTRIBUTIONS CREATED' as status,
  COUNT(*) as new_distributions_created
FROM profit_distributions 
WHERE created_at >= NOW() - INTERVAL '1 minute';

-- ============================================================================
-- PART 3: UPDATE USER BALANCES
-- ============================================================================

SELECT 'UPDATING USER WALLET BALANCES' as section;

-- Calculate total missing profits per user and update their wallets
WITH user_missing_profits AS (
  SELECT 
    ip.user_id,
    SUM(
      GREATEST(0, 
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
        ip.investment_amount * (ip.daily_percentage / 100.0) - 
        GREATEST(COALESCE(pd.actual_distributed, 0), ip.total_profit_earned)
      )
    ) as total_missing_profit
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
  GROUP BY ip.user_id
  HAVING SUM(
    GREATEST(0, 
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
      ip.investment_amount * (ip.daily_percentage / 100.0) - 
      GREATEST(COALESCE(pd.actual_distributed, 0), ip.total_profit_earned)
    )
  ) > 0
)
UPDATE profiles 
SET main_wallet_balance = main_wallet_balance + ump.total_missing_profit,
    updated_at = NOW()
FROM user_missing_profits ump
WHERE profiles.id = ump.user_id;

-- Show updated balances
SELECT 
  'USER BALANCES UPDATED' as status,
  COUNT(*) as users_updated
FROM profiles 
WHERE updated_at >= NOW() - INTERVAL '1 minute';

-- ============================================================================
-- PART 4: UPDATE INVESTMENT PLAN TOTALS
-- ============================================================================

SELECT 'UPDATING INVESTMENT PLAN TOTALS' as section;

-- Update total_profit_earned for each investment plan
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
WHERE investment_plans.id = pt.plan_id;

-- ============================================================================
-- PART 5: CREATE TRANSACTION RECORDS
-- ============================================================================

SELECT 'CREATING TRANSACTION RECORDS' as section;

-- Create transaction records for the catch-up profits
WITH user_missing_profits AS (
  SELECT 
    ip.user_id,
    SUM(
      GREATEST(0, 
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
        ip.investment_amount * (ip.daily_percentage / 100.0) - 
        GREATEST(COALESCE(pd.actual_distributed, 0), COALESCE(ip.total_profit_earned, 0) - 
          COALESCE(new_distributions.new_profit, 0))
      )
    ) as missing_profit_amount
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    WHERE created_at < NOW() - INTERVAL '5 minutes'  -- Distributions before this fix
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as new_profit
    FROM profit_distributions
    WHERE created_at >= NOW() - INTERVAL '5 minutes'  -- New distributions from this fix
    GROUP BY plan_id
  ) new_distributions ON ip.id = new_distributions.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
    AND new_distributions.new_profit > 0  -- Only users who got new distributions
  GROUP BY ip.user_id
  HAVING SUM(
    GREATEST(0, 
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
      ip.investment_amount * (ip.daily_percentage / 100.0) - 
      GREATEST(COALESCE(pd.actual_distributed, 0), COALESCE(ip.total_profit_earned, 0) - 
        COALESCE(new_distributions.new_profit, 0))
    )
  ) > 0
)
INSERT INTO transactions (user_id, transaction_type, amount, net_amount, status, description, created_at)
SELECT 
  ump.user_id,
  'profit' as transaction_type,
  nd.new_profit as amount,
  nd.new_profit as net_amount,
  'completed' as status,
  'Profit catch-up - Missing daily distributions' as description,
  NOW()
FROM user_missing_profits ump
JOIN (
  SELECT 
    ip.user_id,
    SUM(new_distributions.new_profit) as new_profit
  FROM investment_plans ip
  JOIN (
    SELECT plan_id, SUM(profit_amount) as new_profit
    FROM profit_distributions
    WHERE created_at >= NOW() - INTERVAL '5 minutes'
    GROUP BY plan_id
  ) new_distributions ON ip.id = new_distributions.plan_id
  GROUP BY ip.user_id
) nd ON ump.user_id = nd.user_id;

-- ============================================================================
-- PART 6: JRC STAKING PROFIT FIX (if table exists)
-- ============================================================================

SELECT 'CHECKING JRC STAKING SYSTEM' as section;

-- Check if JRC staking table exists and fix profits if needed
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'jrc_staking_plans') THEN
    
    -- Fix JRC staking profits similar to investment profits
    WITH jrc_analysis AS (
      SELECT 
        jsp.id as staking_plan_id,
        jsp.user_id,
        jsp.amount as staking_amount,
        jsp.daily_percentage,
        jsp.created_at,
        jsp.status,
        jsp.end_date,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - jsp.created_at)) / 86400)) as days_since_creation,
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - jsp.created_at)) / 86400)) * 
        jsp.amount * (jsp.daily_percentage / 100.0) as expected_jrc_profit,
        COALESCE(jsd.actual_distributed, 0) as actual_jrc_distributed
      FROM jrc_staking_plans jsp
      LEFT JOIN (
        SELECT staking_plan_id, SUM(profit_amount) as actual_distributed
        FROM jrc_staking_distributions
        GROUP BY staking_plan_id
      ) jsd ON jsp.id = jsd.staking_plan_id
      WHERE jsp.status = 'active'
        AND jsp.created_at <= NOW() - INTERVAL '24 hours'
        AND (jsp.end_date IS NULL OR jsp.end_date > NOW())
    ),
    missing_jrc_profits AS (
      SELECT 
        *,
        GREATEST(0, expected_jrc_profit - actual_jrc_distributed) as missing_jrc_amount,
        CASE 
          WHEN staking_amount > 0 AND daily_percentage > 0 THEN
            FLOOR(GREATEST(0, expected_jrc_profit - actual_jrc_distributed) / 
                  (staking_amount * (daily_percentage / 100.0)))
          ELSE 0
        END as missing_jrc_days
      FROM jrc_analysis
      WHERE expected_jrc_profit > actual_jrc_distributed
    ),
    jrc_daily_distributions AS (
      SELECT 
        mjp.staking_plan_id,
        mjp.user_id,
        mjp.staking_amount * (mjp.daily_percentage / 100.0) as daily_jrc_profit,
        (mjp.created_at::date + (gs.day_num * INTERVAL '1 day'))::date as distribution_date
      FROM missing_jrc_profits mjp
      CROSS JOIN generate_series(1, 30) gs(day_num)
      WHERE mjp.missing_jrc_days > 0
        AND gs.day_num <= mjp.missing_jrc_days
        AND (mjp.created_at::date + (gs.day_num * INTERVAL '1 day'))::date <= CURRENT_DATE
    )
    INSERT INTO jrc_staking_distributions (staking_plan_id, user_id, profit_amount, distribution_date)
    SELECT 
      jdd.staking_plan_id,
      jdd.user_id,
      jdd.daily_jrc_profit,
      jdd.distribution_date
    FROM jrc_daily_distributions jdd
    WHERE NOT EXISTS (
      SELECT 1 FROM jrc_staking_distributions jsd 
      WHERE jsd.staking_plan_id = jdd.staking_plan_id 
      AND jsd.distribution_date = jdd.distribution_date
    );

    -- Update JRC balances for users
    WITH jrc_user_totals AS (
      SELECT 
        jsp.user_id,
        SUM(GREATEST(0, 
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - jsp.created_at)) / 86400)) * 
          jsp.amount * (jsp.daily_percentage / 100.0) - 
          COALESCE(jsd.actual_distributed, 0)
        )) as total_missing_jrc
      FROM jrc_staking_plans jsp
      LEFT JOIN (
        SELECT staking_plan_id, SUM(profit_amount) as actual_distributed
        FROM jrc_staking_distributions
        GROUP BY staking_plan_id
      ) jsd ON jsp.id = jsd.staking_plan_id
      WHERE jsp.status = 'active'
        AND jsp.created_at <= NOW() - INTERVAL '24 hours'
        AND (jsp.end_date IS NULL OR jsp.end_date > NOW())
      GROUP BY jsp.user_id
      HAVING SUM(GREATEST(0, 
        GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - jsp.created_at)) / 86400)) * 
        jsp.amount * (jsp.daily_percentage / 100.0) - 
        COALESCE(jsd.actual_distributed, 0)
      )) > 0
    )
    UPDATE profiles 
    SET total_jarvis_tokens = total_jarvis_tokens + jut.total_missing_jrc,
        updated_at = NOW()
    FROM jrc_user_totals jut
    WHERE profiles.id = jut.user_id;

    RAISE NOTICE 'JRC staking profits have been fixed';
  ELSE
    RAISE NOTICE 'JRC staking table does not exist - skipping JRC profit fix';
  END IF;
END $$;

-- ============================================================================
-- PART 7: FINAL VERIFICATION
-- ============================================================================

SELECT 'FINAL VERIFICATION' as section;

-- Show the results after fixing
WITH final_analysis AS (
  SELECT 
    ip.id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) as days_since_creation,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total_profit,
    COALESCE(pd.actual_distributed, 0) as actual_distributed
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
)
SELECT 
  'FINAL RESULTS' as report,
  COUNT(*) as total_active_plans,
  COUNT(*) FILTER (WHERE ABS(expected_total_profit - GREATEST(actual_distributed, total_profit_earned)) < 0.01) as plans_with_correct_profits,
  COUNT(*) FILTER (WHERE expected_total_profit > GREATEST(actual_distributed, total_profit_earned) + 0.01) as plans_still_missing_profits,
  ROUND(SUM(expected_total_profit)::numeric, 2) as total_expected_profits,
  ROUND(SUM(GREATEST(actual_distributed, total_profit_earned))::numeric, 2) as total_current_profits
FROM final_analysis;

-- Show any remaining issues
SELECT 
  id as plan_id,
  user_id,
  investment_amount,
  daily_percentage || '%' as rate,
  days_since_creation,
  ROUND(expected_total_profit::numeric, 2) as expected,
  ROUND(GREATEST(actual_distributed, total_profit_earned)::numeric, 2) as current,
  ROUND((expected_total_profit - GREATEST(actual_distributed, total_profit_earned))::numeric, 2) as still_missing
FROM (
  SELECT 
    ip.id,
    ip.user_id,
    ip.investment_amount,
    ip.daily_percentage,
    ip.created_at,
    ip.total_profit_earned,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) as days_since_creation,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - ip.created_at)) / 86400)) * 
    ip.investment_amount * (ip.daily_percentage / 100.0) as expected_total_profit,
    COALESCE(pd.actual_distributed, 0) as actual_distributed
  FROM investment_plans ip
  LEFT JOIN (
    SELECT plan_id, SUM(profit_amount) as actual_distributed
    FROM profit_distributions
    GROUP BY plan_id
  ) pd ON ip.id = pd.plan_id
  WHERE ip.is_active = true
    AND ip.created_at <= NOW() - INTERVAL '24 hours'
) final_check
WHERE expected_total_profit > GREATEST(actual_distributed, total_profit_earned) + 0.01
ORDER BY (expected_total_profit - GREATEST(actual_distributed, total_profit_earned)) DESC;

SELECT 'COMPREHENSIVE PROFIT FIX COMPLETED' as status, NOW() as completed_at;

-- COMMIT; -- Uncomment to apply changes
-- ROLLBACK; -- Uncomment to rollback and review first

-- ============================================================================
-- USAGE INSTRUCTIONS:
-- ============================================================================
-- 1. First run with ROLLBACK to review all changes
-- 2. Check the analysis output to ensure calculations are correct
-- 3. Verify the "FINAL RESULTS" section shows correct profit distributions
-- 4. If satisfied, change ROLLBACK to COMMIT and run again
-- 
-- This script will:
-- - Fix all missing profit distributions for USDT investments (5% daily)
-- - Update user wallet balances with missing profits
-- - Fix JRC staking profits if the system exists
-- - Create proper transaction records for audit trail
-- - Ensure all future auto-distributions work correctly
-- ============================================================================
