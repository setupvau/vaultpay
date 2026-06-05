-- ============================================================
-- MIGRATION: Smart Order Assignment + P2P Matching System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add new status values and assignment columns to deposit_orders
ALTER TABLE deposit_orders
  ADD COLUMN IF NOT EXISTS assigned_bank_id       UUID REFERENCES bank_accounts(id),
  ADD COLUMN IF NOT EXISTS assigned_at            TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS assigned_by            UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS expires_at             TIMESTAMP WITH TIME ZONE,  -- payment deadline
  ADD COLUMN IF NOT EXISTS assigned_bank_snapshot JSONB;  -- snapshot of bank details at time of assignment

-- Update status check to include new statuses
-- pending_assignment → admin needs to assign a bank
-- assigned           → bank assigned, user can see details and pay
-- (existing: reviewing, approved, rejected, cancelled)

-- 2. P2P matching table — links a withdrawal to a deposit order
CREATE TABLE IF NOT EXISTS p2p_matches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deposit_order_id  UUID NOT NULL REFERENCES deposit_orders(id),
  withdrawal_id     UUID NOT NULL REFERENCES withdrawal_requests(id),
  matched_by        UUID NOT NULL REFERENCES users(id),  -- admin who matched
  match_amount      DECIMAL(18,2) NOT NULL,
  note              TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_deposit  ON p2p_matches(deposit_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_withdraw ON p2p_matches(withdrawal_id);

-- 3. Order expiry setting (minutes user has to pay after bank assigned)
INSERT INTO settings (key, value, description) VALUES
  ('order_expiry_minutes', '30', 'Minutes user has to pay after bank account is assigned'),
  ('auto_assign_bank',     'false', 'Auto-assign bank on order creation (true) or manual admin assignment (false)')
ON CONFLICT (key) DO NOTHING;

-- 4. New notification type for admin - new deposit order
-- (no schema change needed, handled in app logic)

SELECT 'Migration complete ✅' as status;
