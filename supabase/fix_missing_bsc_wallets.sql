-- Fix existing profiles that don't have BSC wallet addresses
-- This script will generate BSC wallet addresses for existing users

-- First, let's see how many profiles are missing BSC wallet addresses
SELECT 
    COUNT(*) as total_profiles,
    COUNT(bsc_wallet_address) as profiles_with_wallet,
    COUNT(*) - COUNT(bsc_wallet_address) as profiles_missing_wallet
FROM public.profiles;

-- Function to generate BSC wallet address (same as in auto_generate_bsc_wallet.sql)
CREATE OR REPLACE FUNCTION generate_bsc_wallet_for_existing_user(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    seed TEXT;
    hash_result TEXT;
    wallet_address TEXT;
BEGIN
    -- Create a seed from user ID and a constant salt
    seed := user_id::TEXT || '-jarvis-ai-seed';
    
    -- Generate SHA256 hash
    hash_result := encode(digest(seed, 'sha256'), 'hex');
    
    -- Create a valid-looking Ethereum address format (40 hex characters)
    wallet_address := '0x' || substring(hash_result, 1, 40);
    
    -- Make it lowercase for consistency
    wallet_address := lower(wallet_address);
    
    RETURN wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Update existing profiles that don't have BSC wallet addresses
UPDATE public.profiles 
SET 
    bsc_wallet_address = generate_bsc_wallet_for_existing_user(id),
    updated_at = NOW()
WHERE 
    bsc_wallet_address IS NULL 
    OR bsc_wallet_address = '';

-- Show the results
SELECT 
    'After Update' as status,
    COUNT(*) as total_profiles,
    COUNT(bsc_wallet_address) as profiles_with_wallet,
    COUNT(*) - COUNT(bsc_wallet_address) as profiles_missing_wallet
FROM public.profiles;

-- Show some sample generated wallet addresses
SELECT 
    id,
    full_name,
    bsc_wallet_address,
    created_at
FROM public.profiles 
WHERE bsc_wallet_address IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS generate_bsc_wallet_for_existing_user(UUID);

SELECT 'BSC wallet addresses generated for existing profiles!' as result;
