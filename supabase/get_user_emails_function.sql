-- Function to get user emails from auth.users table
-- This function can access the auth schema which is not directly accessible via REST API

CREATE OR REPLACE FUNCTION get_user_emails_by_ids(user_ids UUID[])
RETURNS TABLE (
  id UUID,
  email VARCHAR(255),
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.last_sign_in_at
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users (admin only in practice)
GRANT EXECUTE ON FUNCTION get_user_emails_by_ids(UUID[]) TO authenticated;

-- Optional: Create a simpler version that gets all users (for fallback)
CREATE OR REPLACE FUNCTION get_all_user_emails()
RETURNS TABLE (
  id UUID,
  email VARCHAR(255),
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.last_sign_in_at
  FROM auth.users au;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_user_emails() TO authenticated;
