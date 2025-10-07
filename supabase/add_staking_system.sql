-- Add JRC Staking System
-- This migration creates the necessary tables and functions for JRC staking with daily profit distribution

-- Create staking status enum
CREATE TYPE staking_status AS ENUM ('active', 'completed', 'withdrawn');

-- Create JRC staking plans table
CREATE TABLE public.jrc_staking_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount DECIMAL(20,8) NOT NULL,
    staking_period INTEGER NOT NULL, -- days
    daily_percentage DECIMAL(5,2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status staking_status DEFAULT 'active',
    total_profit_earned DECIMAL(20,8) DEFAULT 0,
    rewards_claimed DECIMAL(20,8) DEFAULT 0,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_jrc_staking_plans_user_id ON public.jrc_staking_plans(user_id);
CREATE INDEX idx_jrc_staking_plans_status ON public.jrc_staking_plans(status);
CREATE INDEX idx_jrc_staking_plans_end_date ON public.jrc_staking_plans(end_date);

-- Create JRC staking profit distributions table
CREATE TABLE public.jrc_staking_distributions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    staking_plan_id UUID REFERENCES public.jrc_staking_plans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    profit_amount DECIMAL(20,8) NOT NULL,
    distribution_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for JRC staking distributions
CREATE INDEX idx_jrc_staking_distributions_plan_id ON public.jrc_staking_distributions(staking_plan_id);
CREATE INDEX idx_jrc_staking_distributions_user_id ON public.jrc_staking_distributions(user_id);
CREATE INDEX idx_jrc_staking_distributions_date ON public.jrc_staking_distributions(distribution_date);

-- Create unique constraint to prevent duplicate distributions on same day
CREATE UNIQUE INDEX idx_jrc_staking_distributions_unique 
ON public.jrc_staking_distributions(staking_plan_id, distribution_date);

-- Function to calculate end date
CREATE OR REPLACE FUNCTION calculate_staking_end_date(start_date TIMESTAMP WITH TIME ZONE, period_days INTEGER)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN start_date + INTERVAL '1 day' * period_days;
END;
$$ LANGUAGE plpgsql;

-- Function to get staking daily percentage based on period
CREATE OR REPLACE FUNCTION get_staking_daily_percentage(period_days INTEGER)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    CASE 
        WHEN period_days = 30 THEN RETURN 3.00;
        WHEN period_days = 60 THEN RETURN 5.00;
        WHEN period_days = 90 THEN RETURN 6.00;
        WHEN period_days = 180 THEN RETURN 8.00;
        WHEN period_days = 365 THEN RETURN 10.00;
        ELSE RETURN 3.00; -- Default to 30-day rate
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON public.jrc_staking_plans TO authenticated;
GRANT ALL ON public.jrc_staking_distributions TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_staking_end_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_staking_daily_percentage TO authenticated;

-- Add RLS policies
ALTER TABLE public.jrc_staking_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jrc_staking_distributions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own staking plans
CREATE POLICY "Users can view own staking plans" ON public.jrc_staking_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own staking plans" ON public.jrc_staking_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see their own staking distributions
CREATE POLICY "Users can view own staking distributions" ON public.jrc_staking_distributions
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (assuming there's an is_admin field in profiles)
CREATE POLICY "Admins can view all staking plans" ON public.jrc_staking_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

CREATE POLICY "Admins can view all staking distributions" ON public.jrc_staking_distributions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.jrc_staking_plans IS 'JRC coin staking plans with daily profit distribution';
COMMENT ON TABLE public.jrc_staking_distributions IS 'Daily profit distributions for JRC staking plans';
COMMENT ON COLUMN public.jrc_staking_plans.daily_percentage IS 'Daily profit percentage (3%, 5%, 6%, 8%, 10% based on period)';
COMMENT ON COLUMN public.jrc_staking_plans.staking_period IS 'Staking lock period in days (30, 60, 90, 180, 365)';
