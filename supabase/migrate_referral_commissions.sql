-- Migration: Move referral commissions from transactions table to referral_commissions table
-- This ensures all referral data is properly stored in the dedicated referral_commissions table

-- First, add the dual commission columns if they don't exist
ALTER TABLE public.referral_commissions 
ADD COLUMN IF NOT EXISTS usdt_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'investment',
ADD COLUMN IF NOT EXISTS plan_type TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a function to extract referral info from transaction descriptions
CREATE OR REPLACE FUNCTION extract_referral_level(description TEXT)
RETURNS INTEGER AS $$
BEGIN
    -- Extract level number from descriptions like "Level 1 USDT referral commission from investment"
    RETURN CAST(SUBSTRING(description FROM 'Level (\d+)') AS INTEGER);
EXCEPTION
    WHEN OTHERS THEN
        RETURN 1; -- Default to level 1 if extraction fails
END;
$$ LANGUAGE plpgsql;

-- Create a function to extract currency from transaction descriptions
CREATE OR REPLACE FUNCTION extract_currency(description TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Extract currency from descriptions like "Level 1 USDT referral commission from investment"
    IF description LIKE '%USDT%' THEN
        RETURN 'USDT';
    ELSIF description LIKE '%JRC%' THEN
        RETURN 'JRC';
    ELSE
        RETURN 'USDT'; -- Default to USDT
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing referral bonus transactions to referral_commissions table
INSERT INTO public.referral_commissions (
    referrer_id,
    referred_id,
    usdt_commission,
    jrc_commission,
    level,
    commission_percentage,
    jrc_percentage,
    transaction_type,
    plan_type,
    created_at,
    updated_at
)
SELECT 
    t.user_id as referrer_id,
    NULL as referred_id, -- We'll need to determine this separately
    CASE WHEN extract_currency(t.description) = 'USDT' THEN t.amount ELSE 0 END as usdt_commission,
    CASE WHEN extract_currency(t.description) = 'JRC' THEN t.amount ELSE 0 END as jrc_commission,
    extract_referral_level(t.description) as level,
    CASE 
        WHEN extract_referral_level(t.description) = 1 THEN 15
        WHEN extract_referral_level(t.description) = 2 THEN 10
        WHEN extract_referral_level(t.description) = 3 THEN 5
        WHEN extract_referral_level(t.description) = 4 THEN 3
        WHEN extract_referral_level(t.description) = 5 THEN 2
        WHEN extract_referral_level(t.description) = 6 THEN 1
        WHEN extract_referral_level(t.description) = 7 THEN 0.5
        WHEN extract_referral_level(t.description) = 8 THEN 0.2
        WHEN extract_referral_level(t.description) = 9 THEN 0.1
        WHEN extract_referral_level(t.description) = 10 THEN 0.05
        ELSE 15
    END as commission_percentage,
    CASE 
        WHEN extract_referral_level(t.description) = 1 THEN 20
        WHEN extract_referral_level(t.description) = 2 THEN 15
        WHEN extract_referral_level(t.description) = 3 THEN 10
        WHEN extract_referral_level(t.description) = 4 THEN 8
        WHEN extract_referral_level(t.description) = 5 THEN 6
        WHEN extract_referral_level(t.description) = 6 THEN 4
        WHEN extract_referral_level(t.description) = 7 THEN 3
        WHEN extract_referral_level(t.description) = 8 THEN 2
        WHEN extract_referral_level(t.description) = 9 THEN 1.5
        WHEN extract_referral_level(t.description) = 10 THEN 1
        ELSE 20
    END as jrc_percentage,
    CASE 
        WHEN t.description LIKE '%investment%' THEN 'investment'
        WHEN t.description LIKE '%staking%' THEN 'staking'
        ELSE 'investment'
    END as transaction_type,
    NULL as plan_type, -- Extract from description if needed
    t.created_at,
    NOW() as updated_at
FROM public.transactions t
WHERE t.transaction_type = 'referral_bonus'
AND t.status = 'completed'
-- Only migrate if not already migrated
AND NOT EXISTS (
    SELECT 1 FROM public.referral_commissions rc 
    WHERE rc.referrer_id = t.user_id 
    AND rc.level = extract_referral_level(t.description)
    AND ABS(
        CASE WHEN extract_currency(t.description) = 'USDT' THEN rc.usdt_commission ELSE rc.jrc_commission END 
        - t.amount
    ) < 0.001
);

-- Group USDT and JRC commissions together for the same referrer/level/time
-- This consolidates separate USDT and JRC transaction records into single referral commission records
WITH grouped_commissions AS (
    SELECT 
        referrer_id,
        level,
        transaction_type,
        DATE_TRUNC('minute', created_at) as time_group, -- Group by minute to catch related transactions
        SUM(usdt_commission) as total_usdt,
        SUM(jrc_commission) as total_jrc,
        MAX(commission_percentage) as usdt_rate,
        MAX(jrc_percentage) as jrc_rate,
        MIN(created_at) as earliest_created
    FROM public.referral_commissions
    WHERE created_at > NOW() - INTERVAL '1 hour' -- Only process recent records
    GROUP BY referrer_id, level, transaction_type, DATE_TRUNC('minute', created_at)
    HAVING COUNT(*) > 1 -- Only groups with multiple records
)
-- Delete individual records and insert consolidated ones
DELETE FROM public.referral_commissions 
WHERE (referrer_id, level, transaction_type, DATE_TRUNC('minute', created_at)) IN (
    SELECT referrer_id, level, transaction_type, time_group FROM grouped_commissions
);

-- Insert consolidated records
INSERT INTO public.referral_commissions (
    referrer_id, level, usdt_commission, jrc_commission, 
    commission_percentage, jrc_percentage, transaction_type, created_at, updated_at
)
SELECT 
    referrer_id, level, total_usdt, total_jrc,
    usdt_rate, jrc_rate, transaction_type, earliest_created, NOW()
FROM grouped_commissions;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer_level 
ON public.referral_commissions(referrer_id, level);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_created_at 
ON public.referral_commissions(created_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.referral_commissions TO authenticated;

-- Clean up helper functions
DROP FUNCTION IF EXISTS extract_referral_level(TEXT);
DROP FUNCTION IF EXISTS extract_currency(TEXT);

SELECT 'Referral commissions migration completed successfully!' as status;
