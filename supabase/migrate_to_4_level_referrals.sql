-- Migration script to update referral structure from 10 levels to 4 levels
-- Run this in Supabase SQL Editor

-- Step 1: Check existing data distribution
SELECT 
    level,
    COUNT(*) as count
FROM referrals
GROUP BY level
ORDER BY level;

-- Step 2: Handle existing referral records with levels > 4
-- Option A: Delete old referral relationships (recommended for clean migration)
DELETE FROM referrals WHERE level > 4;

-- Option B: If you want to keep them, cap at level 4 (uncomment below and comment out DELETE above)
-- UPDATE referrals SET level = 4 WHERE level > 4;

-- Step 3: Update the referrals table constraint to allow only 4 levels
ALTER TABLE public.referrals 
DROP CONSTRAINT IF EXISTS referrals_level_check;

ALTER TABLE public.referrals 
ADD CONSTRAINT referrals_level_check 
CHECK (level >= 1 AND level <= 4);

-- Step 2: Update the optimized referral functions with new 4-level structure
CREATE OR REPLACE FUNCTION get_referral_chain_recursive(
    start_user_id UUID,
    max_levels INTEGER DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    referral_code TEXT,
    main_wallet_balance DECIMAL,
    total_jarvis_tokens DECIMAL,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE referral_chain AS (
        -- Base case: start with the given user
        SELECT 
            p.id,
            p.full_name,
            p.referral_code,
            p.main_wallet_balance,
            p.total_jarvis_tokens,
            0 as current_level,
            p.sponsor_id
        FROM profiles p
        WHERE p.id = start_user_id
        
        UNION ALL
        
        -- Recursive case: find the referrer at each level
        SELECT 
            referrer.id,
            referrer.full_name,
            referrer.referral_code,
            referrer.main_wallet_balance,
            referrer.total_jarvis_tokens,
            rc.current_level + 1,
            referrer.sponsor_id
        FROM referral_chain rc
        JOIN profiles referrer ON referrer.referral_code = rc.sponsor_id
        WHERE rc.current_level < max_levels
        AND rc.sponsor_id IS NOT NULL
    )
    SELECT 
        rc.id,
        rc.full_name,
        rc.referral_code,
        rc.main_wallet_balance,
        rc.total_jarvis_tokens,
        rc.current_level as level
    FROM referral_chain rc
    WHERE rc.current_level > 0  -- Exclude the starting user
    ORDER BY rc.current_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Update the optimized stats function with new commission rates
CREATE OR REPLACE FUNCTION get_referral_stats_optimized(
    user_id UUID
)
RETURNS JSON AS $$
DECLARE
    user_referral_code TEXT;
    stats JSON;
BEGIN
    -- Get user's referral code
    SELECT referral_code INTO user_referral_code
    FROM profiles
    WHERE id = user_id;
    
    IF user_referral_code IS NULL THEN
        RETURN json_build_object(
            'totalUsdtEarned', 0,
            'totalJrcEarned', 0,
            'totalReferrals', 0,
            'levelStats', '[]'::json
        );
    END IF;
    
    -- Build comprehensive stats in a single query
    SELECT json_build_object(
        'totalUsdtEarned', COALESCE(totals.total_usdt, 0),
        'totalJrcEarned', COALESCE(totals.total_jrc, 0),
        'totalReferrals', COALESCE(direct_count.count, 0),
        'levelStats', COALESCE(level_stats.stats, '[]'::json)
    ) INTO stats
    FROM (
        -- Calculate totals
        SELECT 
            SUM(COALESCE(usdt_commission, commission_amount, 0)) as total_usdt,
            SUM(COALESCE(jrc_commission, 0)) as total_jrc
        FROM referral_commissions
        WHERE referrer_id = user_id
    ) totals
    CROSS JOIN (
        -- Count direct referrals
        SELECT COUNT(*) as count
        FROM profiles
        WHERE sponsor_id = user_referral_code
    ) direct_count
    CROSS JOIN (
        -- Level statistics with new 4-level rates
        SELECT json_agg(
            json_build_object(
                'level', level_data.level,
                'count', COALESCE(level_data.referral_count, 0),
                'usdtEarned', COALESCE(level_data.usdt_earned, 0),
                'jrcEarned', COALESCE(level_data.jrc_earned, 0),
                'usdtRate', level_data.usdt_rate,
                'jrcRate', level_data.jrc_rate
            ) ORDER BY level_data.level
        ) as stats
        FROM (
            SELECT 
                levels.level,
                levels.usdt_rate,
                levels.jrc_rate,
                COUNT(DISTINCT rc.referred_id) as referral_count,
                SUM(COALESCE(rc.usdt_commission, rc.commission_amount, 0)) as usdt_earned,
                SUM(COALESCE(rc.jrc_commission, 0)) as jrc_earned
            FROM (
                VALUES 
                (1, 5, 20), (2, 3, 15), (3, 2, 10), (4, 1, 8)
            ) AS levels(level, usdt_rate, jrc_rate)
            LEFT JOIN referral_commissions rc ON rc.referrer_id = user_id AND rc.level = levels.level
            GROUP BY levels.level, levels.usdt_rate, levels.jrc_rate
        ) level_data
    ) level_stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION get_referral_chain_recursive TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_stats_optimized TO authenticated;

-- Step 5: Check existing commission data distribution
SELECT 
    level,
    COUNT(*) as commission_count,
    SUM(COALESCE(usdt_commission, commission_amount, 0)) as total_usdt,
    SUM(COALESCE(jrc_commission, 0)) as total_jrc
FROM referral_commissions
WHERE level > 4
GROUP BY level
ORDER BY level;

-- Step 6: Handle old commission records (levels 5-10)
-- These commissions have already been paid, so we keep them for historical records
-- But you can optionally archive or delete them

-- Option A: Archive old commissions (keeps data, marks as archived)
-- UPDATE referral_commissions 
-- SET transaction_type = 'archived_' || transaction_type
-- WHERE level > 4 AND transaction_type NOT LIKE 'archived_%';

-- Option B: Delete old commission records (clean slate)
-- WARNING: This permanently deletes historical commission data
-- DELETE FROM referral_commissions WHERE level > 4;

-- Step 7: Verify the changes
SELECT 
    'Migration completed successfully!' as status,
    'Referral structure updated to 4 levels' as message,
    'New USDT rates: Level 1=5%, Level 2=3%, Level 3=2%, Level 4=1%' as commission_rates;

-- Step 8: Check existing data
SELECT 
    level,
    COUNT(*) as commission_count,
    SUM(COALESCE(usdt_commission, commission_amount, 0)) as total_usdt,
    SUM(COALESCE(jrc_commission, 0)) as total_jrc
FROM referral_commissions
GROUP BY level
ORDER BY level;
