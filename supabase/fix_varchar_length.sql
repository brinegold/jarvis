-- Fix varchar length constraints in referral_commissions table
-- The transaction_type and plan_type columns are too short (varchar(10))

-- Check current column constraints
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'referral_commissions' 
AND table_schema = 'public'
AND data_type = 'character varying'
ORDER BY ordinal_position;

-- Increase the length of varchar columns to accommodate longer values
-- transaction_type needs to fit "investment" (10 chars) and "staking" (7 chars)
-- plan_type needs to fit plan names which can be longer

ALTER TABLE public.referral_commissions 
ALTER COLUMN transaction_type TYPE VARCHAR(50);

ALTER TABLE public.referral_commissions 
ALTER COLUMN plan_type TYPE VARCHAR(100);

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'referral_commissions' 
AND table_schema = 'public'
AND column_name IN ('transaction_type', 'plan_type')
ORDER BY ordinal_position;

SELECT 'Varchar length constraints fixed successfully!' as status;
