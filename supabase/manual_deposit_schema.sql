-- Manual Deposit Requests Table
CREATE TABLE IF NOT EXISTS deposit_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 10 AND amount <= 50000),
  currency TEXT NOT NULL DEFAULT 'USDT',
  network TEXT NOT NULL DEFAULT 'BEP20',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_created_at ON deposit_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_tx_hash ON deposit_requests(tx_hash);

-- RLS Policies
ALTER TABLE deposit_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own deposit requests
CREATE POLICY "Users can view own deposit requests" ON deposit_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own deposit requests
CREATE POLICY "Users can create deposit requests" ON deposit_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only admins can update deposit requests
CREATE POLICY "Admins can update deposit requests" ON deposit_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Only admins can view all deposit requests
CREATE POLICY "Admins can view all deposit requests" ON deposit_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Function to process approved deposit requests
CREATE OR REPLACE FUNCTION process_manual_deposit_approval(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request deposit_requests%ROWTYPE;
  v_fee_amount DECIMAL(15,2);
  v_net_amount DECIMAL(15,2);
  v_transaction_id UUID;
  v_result JSON;
BEGIN
  -- Get the deposit request
  SELECT * INTO v_request
  FROM deposit_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deposit request not found or already processed');
  END IF;
  
  -- Calculate fee (1%) and net amount
  v_fee_amount := v_request.amount * 0.01;
  v_net_amount := v_request.amount - v_fee_amount;
  
  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    transaction_type,
    amount,
    fee,
    net_amount,
    status,
    description,
    reference_id,
    created_at
  ) VALUES (
    v_request.user_id,
    'deposit'::transaction_type,
    v_net_amount,
    v_fee_amount,
    v_net_amount,
    'completed'::transaction_status,
    'Manual deposit - ' || v_request.currency || ' (' || v_request.network || ')',
    v_request.tx_hash,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update user balance
  UPDATE profiles
  SET 
    main_wallet_balance = main_wallet_balance + v_net_amount,
    updated_at = NOW()
  WHERE id = v_request.user_id;

  -- TODO: Process referral commissions (function needs to be created)
  -- PERFORM process_referral_commissions(v_request.user_id, v_net_amount);

  -- Update deposit request status
  UPDATE deposit_requests
  SET 
    status = 'approved',
    processed_by = p_admin_id,
    processed_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Return success result
  v_result := json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', v_request.amount,
    'fee', v_fee_amount,
    'net_amount', v_net_amount,
    'user_id', v_request.user_id
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback will happen automatically
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to reject deposit requests
CREATE OR REPLACE FUNCTION reject_manual_deposit(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update deposit request status
  UPDATE deposit_requests
  SET 
    status = 'rejected',
    processed_by = p_admin_id,
    processed_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Deposit request not found or already processed');
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Deposit request rejected');
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_deposit_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deposit_requests_updated_at
  BEFORE UPDATE ON deposit_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_deposit_requests_updated_at();
