-- Fix existing referral commission records that have null values in new columns
-- This updates existing records to populate the dual commission columns properly

-- First, let's see what we have
SELECT 
    id,
    referrer_id,
    level,
    commission_amount,
    usdt_commission,
    jrc_commission,
    jrc_percentage,
    transaction_type,
    plan_type,
    created_at
FROM public.referral_commissions
ORDER BY created_at DESC
LIMIT 10;

-- Update existing records where new columns are null/empty
-- Set usdt_commission = commission_amount for existing records
UPDATE public.referral_commissions 
SET 
    usdt_commission = COALESCE(usdt_commission, commission_amount, 0),
    jrc_commission = COALESCE(jrc_commission, 0),
    jrc_percentage = CASE 
        WHEN level = 1 THEN 20
        WHEN level = 2 THEN 15
        WHEN level = 3 THEN 10
        WHEN level = 4 THEN 8
        WHEN level = 5 THEN 6
        WHEN level = 6 THEN 4
        WHEN level = 7 THEN 3
        WHEN level = 8 THEN 2
        WHEN level = 9 THEN 1.5
        WHEN level = 10 THEN 1
        ELSE 20
    END,
    transaction_type = COALESCE(transaction_type, 'investment'),
    updated_at = NOW()
WHERE 
    usdt_commission IS NULL 
    OR usdt_commission = 0 
    OR jrc_percentage IS NULL 
    OR jrc_percentage = 0
    OR transaction_type IS NULL;

-- Calculate JRC commission based on the original investment
-- This is an approximation since we don't have the exact JRC earned data
-- For $10 investment = 100 JRC, so we can estimate
UPDATE public.referral_commissions 
SET 
    jrc_commission = CASE 
        WHEN commission_amount > 0 THEN
            -- Estimate JRC earned: commission_amount / (commission_percentage/100) gives original investment
            -- Then original_investment / 10 * 100 gives JRC earned
            -- Then JRC earned * (jrc_percentage/100) gives JRC commission
            ((commission_amount / (commission_percentage/100.0)) / 10.0 * 100.0) * (jrc_percentage/100.0)
        ELSE 0
    END,
    updated_at = NOW()
WHERE 
    jrc_commission IS NULL 
    OR jrc_commission = 0;

-- Verify the updates
SELECT 
    'After Update' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN usdt_commission > 0 THEN 1 END) as records_with_usdt,
    COUNT(CASE WHEN jrc_commission > 0 THEN 1 END) as records_with_jrc,
    COUNT(CASE WHEN jrc_percentage > 0 THEN 1 END) as records_with_jrc_rate,
    COUNT(CASE WHEN transaction_type IS NOT NULL THEN 1 END) as records_with_type
FROM public.referral_commissions;

-- Show sample of updated records
SELECT 
    level,
    commission_amount,
    usdt_commission,
    jrc_commission,
    commission_percentage,
    jrc_percentage,
    transaction_type,
    created_at
FROM public.referral_commissions
ORDER BY created_at DESC
LIMIT 5;

SELECT 'Referral commission data fix completed!' as status;
