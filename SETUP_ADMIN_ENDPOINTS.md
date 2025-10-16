# Admin Endpoints Setup Guide

The admin user management page now includes new functionality for deducting funds and managing Jarvis tokens. To make these features work, you need to run the following SQL files in your Supabase database.

## Required Database Setup

Execute these SQL files in order:

### 1. Add Jarvis Token Transaction Types
```sql
-- File: supabase/add_jarvis_token_transaction_types.sql
-- This adds new transaction types for jarvis token operations
```

### 2. Create Admin Deduct Funds Function
```sql
-- File: supabase/admin_deduct_funds.sql
-- This creates the admin_deduct_funds_from_user function
```

### 3. Create Admin Jarvis Token Management Functions
```sql
-- File: supabase/admin_manage_jarvis_tokens.sql
-- This creates admin_add_jarvis_tokens and admin_deduct_jarvis_tokens functions
```

## API Endpoints Created

The following API endpoints have been created and are now available:

### 1. Deduct Funds
- **Endpoint**: `POST /api/admin/deduct-funds`
- **Function**: `admin_deduct_funds_from_user`
- **Purpose**: Allows admins to deduct funds from user wallets
- **Validation**: Checks for sufficient balance before deduction

### 2. Manage Jarvis Tokens
- **Endpoint**: `POST /api/admin/manage-jarvis-tokens`
- **Functions**: `admin_add_jarvis_tokens` and `admin_deduct_jarvis_tokens`
- **Purpose**: Allows admins to add or deduct Jarvis tokens from users
- **Validation**: Checks for sufficient tokens before deduction

## How to Execute SQL Files

1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of each SQL file
4. Execute them in the order listed above

## Testing the Endpoints

After running the SQL files, you can test the endpoints:

1. **Deduct Funds**: Use the orange "Deduct Funds" button in the admin users page
2. **Add JRV Tokens**: Use the yellow "Add JRV" button
3. **Deduct JRV Tokens**: Use the amber "Deduct JRV" button
4. **Unadmin**: Use the gray "Unadmin" button for admin users

All operations include proper validation, transaction logging, and admin privilege checks.

## Error Resolution

If you encounter a 404 error for any endpoint, ensure:
1. The SQL functions have been created successfully
2. The API route files exist in the correct directories
3. Your database user has the necessary permissions
4. You are logged in as an admin user

## Security Notes

- All functions include admin privilege checks
- Transaction records are created for audit trails
- Proper validation prevents invalid operations
- Admin notes are logged for accountability
