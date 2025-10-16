-- Function to efficiently get referral counts for all users
-- This should be created in your Supabase database to optimize performance

CREATE OR REPLACE FUNCTION get_referral_counts()
RETURNS TABLE (
  referral_code text,
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    sponsor_id as referral_code,
    COUNT(*) as count
  FROM profiles 
  WHERE sponsor_id IS NOT NULL
  GROUP BY sponsor_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_referral_counts() TO authenticated;
