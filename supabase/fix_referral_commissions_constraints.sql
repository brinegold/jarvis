-- Fix referral_commissions table constraints for dual commission system
-- This handles the NOT NULL constraint issue with commission_amount

-- First, check the current table structure
SELECT column_name, is_nullable, column_default, data_type
FROM information_schema.columns 
WHERE table_name = 'referral_commissions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add dual commission columns if they don't exist
ALTER TABLE public.referral_commissions 
ADD COLUMN IF NOT EXISTS usdt_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_commission DECIMAL(20,8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS jrc_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'investment',
ADD COLUMN IF NOT EXISTS plan_type TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Make required columns nullable to support new dual commission system
-- Make commission_amount nullable (will be populated by trigger)
ALTER TABLE public.referral_commissions 
ALTER COLUMN commission_amount DROP NOT NULL;

-- Make transaction_id nullable (not always needed for referral tracking)
ALTER TABLE public.referral_commissions 
ALTER COLUMN transaction_id DROP NOT NULL;

-- Option 2: Set a default value of 0 (uncomment if you prefer this approach)
-- ALTER TABLE public.referral_commissions 
-- ALTER COLUMN commission_amount SET DEFAULT 0;

-- Update existing records to have commission_amount = usdt_commission where it's null
UPDATE public.referral_commissions 
SET commission_amount = COALESCE(usdt_commission, 0)
WHERE commission_amount IS NULL;

-- Create a trigger to automatically set commission_amount = usdt_commission for backward compatibility
CREATE OR REPLACE FUNCTION sync_commission_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Set commission_amount to usdt_commission for backward compatibility
    NEW.commission_amount = COALESCE(NEW.usdt_commission, NEW.commission_amount, 0);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_commission_amount_trigger ON public.referral_commissions;

-- Create the trigger
CREATE TRIGGER sync_commission_amount_trigger
    BEFORE INSERT OR UPDATE ON public.referral_commissions
    FOR EACH ROW EXECUTE FUNCTION sync_commission_amount();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.referral_commissions TO authenticated;

SELECT 'Referral commissions constraints fixed successfully!' as status;
