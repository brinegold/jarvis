# User Email Function Setup

## Issue
The admin users page was failing to fetch user emails because the API was trying to query `auth.users` directly from the REST API, which is not allowed due to schema restrictions.

## Solution
Created an RPC function that can access the `auth.users` table with proper permissions.

## Setup Instructions

### 1. Execute the SQL Function
Run the SQL commands in `supabase/get_user_emails_function.sql` in your Supabase SQL Editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/get_user_emails_function.sql`
4. Execute the SQL commands

### 2. Verify Function Creation
After executing, you should see two new functions:
- `get_user_emails_by_ids(user_ids UUID[])`
- `get_all_user_emails()`

### 3. Test the Function
You can test the function in SQL Editor:
```sql
-- Test with specific user IDs
SELECT * FROM get_user_emails_by_ids(ARRAY['user-id-1', 'user-id-2']::UUID[]);

-- Test getting all user emails
SELECT * FROM get_all_user_emails();
```

## What This Fixes

1. **Schema Access**: The function has `SECURITY DEFINER` which allows it to access the `auth` schema
2. **Proper Permissions**: Only authenticated users can execute the function
3. **Fallback Handling**: The API now has fallback logic if the RPC fails
4. **Type Safety**: Proper UUID array handling for user IDs

## API Behavior

The `/api/admin/get-user-emails` endpoint now:
1. Tries to use the RPC function first
2. If RPC fails, falls back to using user IDs as email placeholders
3. Returns proper user email data for the admin interface

## Files Modified
- `app/api/admin/get-user-emails/route.ts` - Updated to use RPC function
- `supabase/get_user_emails_function.sql` - New SQL function
- `USER_EMAIL_FUNCTION_SETUP.md` - This setup guide
