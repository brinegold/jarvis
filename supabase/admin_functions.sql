-- Admin Functions for Jarvis AI Platform
-- These functions provide admin capabilities for managing users and withdrawals

-- NOTE: If you get function name conflicts, run cleanup_admin_functions.sql first

-- Add is_admin and is_banned columns to profiles table if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Create withdrawal_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL,
    wallet_address TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Enable RLS on withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can create their own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update withdrawal requests" ON public.withdrawal_requests;

-- Create RLS policies for withdrawal_requests
CREATE POLICY "Users can view their own withdrawal requests" ON public.withdrawal_requests
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdrawal requests" ON public.withdrawal_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all withdrawal requests" ON public.withdrawal_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

CREATE POLICY "Admins can update withdrawal requests" ON public.withdrawal_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Function to create a withdrawal request
CREATE OR REPLACE FUNCTION create_withdrawal_request(
    p_user_id UUID,
    p_amount DECIMAL,
    p_fee DECIMAL,
    p_net_amount DECIMAL,
    p_bsc_address TEXT
)
RETURNS UUID AS $$
DECLARE
    request_id UUID;
    user_balance DECIMAL;
BEGIN
    -- Check if user has sufficient balance
    SELECT main_wallet_balance INTO user_balance
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF user_balance IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;
    
    IF user_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: %, Requested: %', user_balance, p_amount;
    END IF;
    
    -- Create withdrawal request
    INSERT INTO public.withdrawal_requests (user_id, amount, wallet_address)
    VALUES (p_user_id, p_amount, p_bsc_address)
    RETURNING id INTO request_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        fee,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        'withdrawal',
        p_amount,
        p_fee,
        p_net_amount,
        'pending',
        'Withdrawal request to ' || p_bsc_address,
        request_id::TEXT
    );
    
    RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve withdrawal request (admin only)
CREATE OR REPLACE FUNCTION approve_withdrawal_request(
    p_request_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    withdrawal_record RECORD;
    user_balance DECIMAL;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Get withdrawal request details
    SELECT * INTO withdrawal_record
    FROM public.withdrawal_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF withdrawal_record IS NULL THEN
        RAISE EXCEPTION 'Withdrawal request not found or already processed';
    END IF;
    
    -- Check user's current balance
    SELECT main_wallet_balance INTO user_balance
    FROM public.profiles
    WHERE id = withdrawal_record.user_id;
    
    IF user_balance < withdrawal_record.amount THEN
        RAISE EXCEPTION 'User has insufficient balance for withdrawal';
    END IF;
    
    -- Deduct amount from user's main wallet
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance - withdrawal_record.amount
    WHERE id = withdrawal_record.user_id;
    
    -- Update withdrawal request status
    UPDATE public.withdrawal_requests
    SET 
        status = 'approved',
        processed_at = NOW(),
        admin_notes = p_admin_notes
    WHERE id = p_request_id;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        user_id,
        transaction_type,
        amount,
        net_amount,
        status,
        description,
        reference_id
    ) VALUES (
        withdrawal_record.user_id,
        'withdrawal',
        withdrawal_record.amount,
        withdrawal_record.amount,
        'completed',
        'Withdrawal to ' || withdrawal_record.wallet_address,
        p_request_id::TEXT
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject withdrawal request (admin only)
CREATE OR REPLACE FUNCTION reject_withdrawal_request(
    p_request_id UUID,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Update withdrawal request status
    UPDATE public.withdrawal_requests
    SET 
        status = 'rejected',
        processed_at = NOW(),
        admin_notes = p_admin_notes
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal request not found or already processed';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ban/unban user (admin only)
CREATE OR REPLACE FUNCTION update_user_status(
    p_user_id UUID,
    p_is_banned BOOLEAN DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Prevent self-modification of admin status
    IF p_user_id = auth.uid() AND p_is_admin IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot modify your own admin status';
    END IF;
    
    -- Update user status
    UPDATE public.profiles
    SET 
        is_banned = COALESCE(p_is_banned, is_banned),
        is_admin = COALESCE(p_is_admin, is_admin)
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM public.profiles),
        'active_users', (SELECT COUNT(*) FROM public.profiles WHERE is_banned = FALSE AND is_admin = FALSE),
        'banned_users', (SELECT COUNT(*) FROM public.profiles WHERE is_banned = TRUE),
        'admin_users', (SELECT COUNT(*) FROM public.profiles WHERE is_admin = TRUE),
        'pending_withdrawals', (SELECT COUNT(*) FROM public.withdrawal_requests WHERE status = 'pending'),
        'total_withdrawal_amount', (SELECT COALESCE(SUM(amount), 0) FROM public.withdrawal_requests WHERE status = 'approved'),
        'total_investment_amount', (SELECT COALESCE(SUM(investment_amount), 0) FROM public.investment_plans),
        'total_main_wallet_balance', (SELECT COALESCE(SUM(main_wallet_balance), 0) FROM public.profiles),
        'total_fund_wallet_balance', (SELECT COALESCE(SUM(fund_wallet_balance), 0) FROM public.profiles)
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user activity summary (admin only)
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    activity JSON;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_admin = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    SELECT json_build_object(
        'user_info', (
            SELECT json_build_object(
                'id', id,
                'username', username,
                'email', email,
                'referral_code', referral_code,
                'sponsor_id', sponsor_id,
                'main_wallet_balance', main_wallet_balance,
                'fund_wallet_balance', fund_wallet_balance,
                'total_jarvis_tokens', total_jarvis_tokens,
                'is_admin', is_admin,
                'is_banned', is_banned,
                'created_at', created_at
            )
            FROM public.profiles WHERE id = p_user_id
        ),
        'investment_summary', (
            SELECT json_build_object(
                'total_investments', COUNT(*),
                'total_amount', COALESCE(SUM(investment_amount), 0),
                'active_plans', COUNT(*) FILTER (WHERE status = 'active')
            )
            FROM public.investment_plans WHERE user_id = p_user_id
        ),
        'withdrawal_summary', (
            SELECT json_build_object(
                'total_requests', COUNT(*),
                'total_amount', COALESCE(SUM(amount), 0),
                'approved_count', COUNT(*) FILTER (WHERE status = 'approved'),
                'pending_count', COUNT(*) FILTER (WHERE status = 'pending'),
                'rejected_count', COUNT(*) FILTER (WHERE status = 'rejected')
            )
            FROM public.withdrawal_requests WHERE user_id = p_user_id
        ),
        'referral_summary', (
            SELECT json_build_object(
                'direct_referrals', COUNT(*),
                'total_commission_earned', COALESCE(SUM(commission_amount), 0)
            )
            FROM public.profiles p
            LEFT JOIN public.referral_commissions rc ON rc.referrer_id = p_user_id
            WHERE p.sponsor_id = (SELECT referral_code FROM public.profiles WHERE id = p_user_id)
        )
    ) INTO activity;
    
    RETURN activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_withdrawal_request TO authenticated;
GRANT EXECUTE ON FUNCTION approve_withdrawal_request TO authenticated;
GRANT EXECUTE ON FUNCTION reject_withdrawal_request TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity_summary TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- Create a default admin user (update the email to your admin email)
-- INSERT INTO public.profiles (id, email, username, referral_code, is_admin)
-- VALUES (
--     gen_random_uuid(),
--     'admin@jarvisai.com',
--     'admin',
--     'ADMIN001',
--     TRUE
-- )
-- ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;

SELECT 'Admin functions created successfully!' as status;
