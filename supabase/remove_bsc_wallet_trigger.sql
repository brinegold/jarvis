-- Remove BSC wallet auto-generation trigger and functions
-- This removes the database trigger approach in favor of using the actual BSC service
-- SAFE VERSION: Only removes BSC-specific triggers and functions

-- Drop only the BSC-specific trigger (keep the updated_at trigger)
DROP TRIGGER IF EXISTS trigger_auto_generate_profile_data ON public.profiles;

-- Drop only BSC-specific functions (keep update_updated_at_column as it's used by other tables)
DROP FUNCTION IF EXISTS auto_generate_profile_data();
DROP FUNCTION IF EXISTS generate_bsc_wallet_address(UUID);
DROP FUNCTION IF EXISTS generate_referral_code(UUID, TEXT);

-- Note: Keeping update_updated_at_column() function and trigger_update_profiles_updated_at trigger
-- as they are used by other tables (investment_plans, transactions)

-- Show current profiles without BSC wallet addresses
SELECT 
    COUNT(*) as total_profiles,
    COUNT(bsc_wallet_address) as profiles_with_wallet,
    COUNT(*) - COUNT(bsc_wallet_address) as profiles_missing_wallet
FROM public.profiles;

-- List profiles that need BSC wallet addresses
SELECT 
    id,
    full_name,
    bsc_wallet_address,
    created_at
FROM public.profiles 
WHERE bsc_wallet_address IS NULL 
   OR bsc_wallet_address = ''
ORDER BY created_at DESC;

SELECT 'BSC wallet trigger and functions removed successfully!' as status;
