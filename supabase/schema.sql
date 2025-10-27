-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to generate random string for referral codes
CREATE OR REPLACE FUNCTION generate_random_string(length INTEGER)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create custom types
CREATE TYPE plan_type AS ENUM ('A', 'B', 'C');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'profit', 'referral_bonus');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    country TEXT,
    mobile_no TEXT,
    sponsor_id TEXT,
    referral_code TEXT UNIQUE NOT NULL DEFAULT generate_random_string(8),
    total_jarvis_tokens DECIMAL(20,8) DEFAULT 0,
    main_wallet_balance DECIMAL(20,8) DEFAULT 0,
    fund_wallet_balance DECIMAL(20,8) DEFAULT 0,
    bsc_wallet_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investment plans table
CREATE TABLE public.investment_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_type plan_type NOT NULL,
    investment_amount DECIMAL(20,8) NOT NULL,
    daily_percentage DECIMAL(5,2) NOT NULL,
    jarvis_tokens_earned DECIMAL(20,8) NOT NULL,
    total_profit_earned DECIMAL(20,8) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    fee DECIMAL(20,8) DEFAULT 0,
    net_amount DECIMAL(20,8) NOT NULL,
    status transaction_status DEFAULT 'pending',
    plan_id UUID REFERENCES public.investment_plans(id) ON DELETE SET NULL,
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral structure table
CREATE TABLE public.referrals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    level INTEGER NOT NULL CHECK (level >= 1 AND level <= 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

-- Referral commissions table
CREATE TABLE public.referral_commissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    commission_percentage DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profit distributions table
CREATE TABLE public.profit_distributions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    plan_id UUID REFERENCES public.investment_plans(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    profit_amount DECIMAL(20,8) NOT NULL,
    distribution_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(plan_id, distribution_date)
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX idx_profiles_sponsor_id ON public.profiles(sponsor_id);
CREATE INDEX idx_investment_plans_user_id ON public.investment_plans(user_id);
CREATE INDEX idx_investment_plans_active ON public.investment_plans(is_active);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX idx_referral_commissions_referrer_id ON public.referral_commissions(referrer_id);
CREATE INDEX idx_profit_distributions_plan_id ON public.profit_distributions(plan_id);
CREATE INDEX idx_profit_distributions_date ON public.profit_distributions(distribution_date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investment_plans_updated_at BEFORE UPDATE ON public.investment_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to build referral chain
CREATE OR REPLACE FUNCTION build_referral_chain(referred_user_id UUID, sponsor_referral_code TEXT)
RETURNS VOID AS $$
DECLARE
    current_referrer_id UUID;
    current_level INTEGER := 1;
BEGIN
    -- Find the sponsor by referral code
    SELECT id INTO current_referrer_id 
    FROM public.profiles 
    WHERE referral_code = sponsor_referral_code;
    
    IF current_referrer_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Build the referral chain up to 10 levels
    WHILE current_referrer_id IS NOT NULL AND current_level <= 10 LOOP
        -- Insert referral relationship
        INSERT INTO public.referrals (referrer_id, referred_id, level)
        VALUES (current_referrer_id, referred_user_id, current_level)
        ON CONFLICT (referrer_id, referred_id) DO NOTHING;
        
        -- Move to next level
        current_level := current_level + 1;
        
        -- Get the next referrer in the chain
        SELECT p.id INTO current_referrer_id
        FROM public.profiles p
        JOIN public.profiles current_p ON current_p.sponsor_id = p.referral_code
        WHERE current_p.id = current_referrer_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to add amount to main wallet
CREATE OR REPLACE FUNCTION add_to_main_wallet(user_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET main_wallet_balance = main_wallet_balance + amount
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate referral commissions
CREATE OR REPLACE FUNCTION calculate_referral_commissions(deposit_transaction_id UUID)
RETURNS VOID AS $$
DECLARE
    deposit_record RECORD;
    referral_record RECORD;
    commission_rates DECIMAL[] := ARRAY[15.0, 10.0, 5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.1, 0.05];
    commission_amount DECIMAL(20,8);
BEGIN
    -- Get deposit transaction details
    SELECT * INTO deposit_record
    FROM public.transactions
    WHERE id = deposit_transaction_id AND transaction_type = 'deposit';
    
    IF deposit_record IS NULL THEN
        RETURN;
    END IF;
    
    -- Calculate commissions for each referral level
    FOR referral_record IN 
        SELECT r.referrer_id, r.level
        FROM public.referrals r
        WHERE r.referred_id = deposit_record.user_id
        ORDER BY r.level
    LOOP
        -- Calculate commission amount
        commission_amount := deposit_record.amount * (commission_rates[referral_record.level] / 100);
        
        -- Insert commission record
        INSERT INTO public.referral_commissions (
            referrer_id, 
            referred_id, 
            transaction_id, 
            level, 
            commission_percentage, 
            commission_amount
        ) VALUES (
            referral_record.referrer_id,
            deposit_record.user_id,
            deposit_transaction_id,
            referral_record.level,
            commission_rates[referral_record.level],
            commission_amount
        );
        
        -- Add commission to referrer's main wallet
        UPDATE public.profiles
        SET main_wallet_balance = main_wallet_balance + commission_amount
        WHERE id = referral_record.referrer_id;
        
        -- Create commission transaction record
        INSERT INTO public.transactions (
            user_id,
            transaction_type,
            amount,
            net_amount,
            status,
            description
        ) VALUES (
            referral_record.referrer_id,
            'referral_bonus',
            commission_amount,
            commission_amount,
            'completed',
            'Level ' || referral_record.level || ' referral commission'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_distributions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own investment plans" ON public.investment_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own referrals" ON public.referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can view own commissions" ON public.referral_commissions
    FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own profit distributions" ON public.profit_distributions
    FOR SELECT USING (auth.uid() = user_id);
