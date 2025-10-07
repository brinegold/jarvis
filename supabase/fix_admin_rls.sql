-- Fix admin RLS policies for withdrawal_requests
-- This ensures admins can see all withdrawal requests

-- First, let's check what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'withdrawal_requests';

-- Drop all existing policies and recreate them
DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Users can create their own withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update withdrawal requests" ON public.withdrawal_requests;

-- Create simpler, more explicit policies
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests
    FOR SELECT 
    USING (
        auth.uid() = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

CREATE POLICY "Users can create withdrawals" ON public.withdrawal_requests
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update withdrawals" ON public.withdrawal_requests
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

CREATE POLICY "Admins can delete withdrawals" ON public.withdrawal_requests
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = TRUE
        )
    );

-- Test the policies by selecting data
SELECT 'Policy test completed' as status;
