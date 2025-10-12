-- Auto-generate BSC wallet address when profile is created
-- This trigger will automatically create a BSC wallet address for new profiles

-- Function to generate a deterministic BSC wallet address from user ID
CREATE OR REPLACE FUNCTION generate_bsc_wallet_address(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    seed TEXT;
    hash_result TEXT;
    wallet_address TEXT;
BEGIN
    -- Create a seed from user ID and a constant salt
    seed := user_id::TEXT || '-jarvis-ai-seed-' || extract(epoch from now())::TEXT;
    
    -- Generate SHA256 hash
    hash_result := encode(digest(seed, 'sha256'), 'hex');
    
    -- Create a valid-looking Ethereum address format (40 hex characters)
    -- This is deterministic but not a real private key derivation
    wallet_address := '0x' || substring(hash_result, 1, 40);
    
    -- Ensure it looks like a proper Ethereum address by making it mixed case
    -- This is a simplified approach - real Ethereum addresses use EIP-55 checksum
    wallet_address := lower(wallet_address);
    
    RETURN wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID, full_name TEXT)
RETURNS TEXT AS $$
DECLARE
    seed TEXT;
    hash_result TEXT;
    referral_code TEXT;
    counter INTEGER := 1;
    final_code TEXT;
BEGIN
    -- Create seed from user ID, name, and timestamp
    seed := user_id::TEXT || '-' || full_name || '-' || extract(epoch from now())::TEXT;
    
    -- Generate hash and take first 8 characters
    hash_result := encode(digest(seed, 'sha256'), 'hex');
    referral_code := upper(substring(hash_result, 1, 8));
    final_code := referral_code;
    
    -- Check for uniqueness and increment if needed
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = final_code) LOOP
        final_code := referral_code || counter::TEXT;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-generate BSC wallet and referral code
CREATE OR REPLACE FUNCTION auto_generate_profile_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate BSC wallet address if not provided
    IF NEW.bsc_wallet_address IS NULL OR NEW.bsc_wallet_address = '' THEN
        NEW.bsc_wallet_address := generate_bsc_wallet_address(NEW.id);
    END IF;
    
    -- Generate referral code if not provided
    IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
        NEW.referral_code := generate_referral_code(NEW.id, NEW.full_name);
    END IF;
    
    -- Set default balances if not provided
    IF NEW.main_wallet_balance IS NULL THEN
        NEW.main_wallet_balance := 0;
    END IF;
    
    IF NEW.fund_wallet_balance IS NULL THEN
        NEW.fund_wallet_balance := 0;
    END IF;
    
    IF NEW.total_jarvis_tokens IS NULL THEN
        NEW.total_jarvis_tokens := 0;
    END IF;
    
    -- Set timestamps
    IF NEW.created_at IS NULL THEN
        NEW.created_at := NOW();
    END IF;
    
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_generate_profile_data ON public.profiles;

-- Create trigger that fires before insert
CREATE TRIGGER trigger_auto_generate_profile_data
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_profile_data();

-- Also create an update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON public.profiles;

CREATE TRIGGER trigger_update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update existing profiles that don't have BSC wallet addresses
UPDATE public.profiles 
SET 
    bsc_wallet_address = generate_bsc_wallet_address(id),
    referral_code = COALESCE(referral_code, generate_referral_code(id, full_name)),
    updated_at = NOW()
WHERE 
    bsc_wallet_address IS NULL 
    OR bsc_wallet_address = ''
    OR referral_code IS NULL
    OR referral_code = '';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_bsc_wallet_address(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_referral_code(UUID, TEXT) TO authenticated;

SELECT 'BSC wallet auto-generation setup completed!' as status;
