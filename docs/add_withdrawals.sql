-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- (Only needed if you already ran schema.sql before)
-- If starting fresh, schema.sql already includes this
-- ============================================================

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  order_number    VARCHAR(30) UNIQUE NOT NULL,
  currency        VARCHAR(10) NOT NULL CHECK (currency IN ('INR', 'USDT')),
  amount          DECIMAL(18, 8) NOT NULL,
  method          VARCHAR(20) NOT NULL CHECK (method IN ('bank', 'upi', 'usdt_wallet')),
  bank_name       VARCHAR(100),
  account_holder  VARCHAR(100),
  account_number  VARCHAR(30),
  ifsc_code       VARCHAR(20),
  upi_id          VARCHAR(100),
  wallet_address  VARCHAR(200),
  chain_type      VARCHAR(10) CHECK (chain_type IN ('TRC20', 'BEP20')),
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processing')),
  reviewed_by     UUID REFERENCES users(id),
  admin_note      TEXT,
  txid            VARCHAR(200),
  reviewed_at     TIMESTAMP WITH TIME ZONE,
  user_ip         INET,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawal_requests(status);

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_withdrawals BEFORE UPDATE ON withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO settings (key, value, description) VALUES
  ('min_withdrawal_inr',   '500',   'Minimum INR withdrawal'),
  ('min_withdrawal_usdt',  '1',     'Minimum USDT withdrawal'),
  ('withdrawal_fee_inr',   '0',     'Flat fee per INR withdrawal'),
  ('withdrawal_enabled',   'true',  'Enable/disable withdrawals')
ON CONFLICT (key) DO NOTHING;

-- Confirm
SELECT 'withdrawal_requests table ready' as status;

-- Add support contact settings
INSERT INTO settings (key, value, description) VALUES
  ('support_whatsapp', '', 'WhatsApp support number e.g. +919876543210'),
  ('support_telegram', '', 'Telegram username e.g. @VaultPaySupport'),
  ('support_enabled',  'true', 'Show/hide support section in app')
ON CONFLICT (key) DO NOTHING;

SELECT 'support settings added' as status;
