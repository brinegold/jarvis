-- Update database schema comments and references from JRV to JRC
-- This migration updates comments and any text references in the database

-- Update column comments to reflect JRC instead of JRV
COMMENT ON COLUMN public.profiles.total_jarvis_tokens IS 'Total JRC coins owned by the user';
COMMENT ON COLUMN public.investment_plans.jarvis_tokens_earned IS 'JRC coins earned from this investment plan';

-- Update any existing transaction descriptions that reference JRV to JRC
UPDATE public.transactions 
SET description = REPLACE(description, 'JRV', 'JRC')
WHERE description LIKE '%JRV%';

-- Update any existing transaction descriptions that reference "tokens" to "coins"
UPDATE public.transactions 
SET description = REPLACE(description, 'tokens', 'coins')
WHERE description LIKE '%tokens%';

-- Update any existing transaction descriptions that reference "Tokens" to "Coins"
UPDATE public.transactions 
SET description = REPLACE(description, 'Tokens', 'Coins')
WHERE description LIKE '%Tokens%';

-- Add a comment to track this migration
COMMENT ON TABLE public.transactions IS 'Transaction records - Updated to use JRC coin terminology';
COMMENT ON TABLE public.investment_plans IS 'Investment plans - Updated coin amounts: Plan A=100 JRC, Plan B=1000 JRC, Plan C=10000 JRC';
