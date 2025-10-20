-- Fix Investment Transactions
-- Update transactions that are actually investments (have plan_id and "Investment in" in description)
UPDATE transactions
SET transaction_type = 'investment'
WHERE transaction_type = 'deposit'
  AND plan_id IS NOT NULL
  AND description LIKE 'Investment in%';

-- Fix Staking Transactions
-- Update transactions that are actually staking (have "USD Staking" in description)
UPDATE transactions
SET transaction_type = 'staking'
WHERE transaction_type = 'deposit'
  AND description LIKE 'USD Staking%';

-- Alternative approach: Update by description pattern
-- If the above doesn't catch all, you can also update by description pattern:
-- UPDATE transactions
-- SET transaction_type = 'investment'
-- WHERE transaction_type = 'deposit'
--   AND (description LIKE '%Investment in%'
--        OR description LIKE '%invested%');

-- UPDATE transactions
-- SET transaction_type = 'staking'
-- WHERE transaction_type = 'deposit'
--   AND description LIKE '%Staking%';

-- Verify the changes
SELECT
  transaction_type,
  COUNT(*) as count,
  COUNT(plan_id) as with_plan_id,
  COUNT(CASE WHEN description LIKE 'Investment in%' THEN 1 END) as investment_descriptions,
  COUNT(CASE WHEN description LIKE 'USD Staking%' THEN 1 END) as staking_descriptions
FROM transactions
WHERE transaction_type IN ('deposit', 'investment', 'staking')
GROUP BY transaction_type
ORDER BY transaction_type;
