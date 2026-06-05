-- ============================================================
-- VAULTPAY — COMPLETE DATABASE SETUP
-- Run this ONE file in Supabase SQL Editor
-- Works for both fresh install AND existing databases
-- ============================================================

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           VARCHAR(15) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(100),
  email           VARCHAR(150) UNIQUE,
  role            VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','admin','superadmin')),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','frozen','suspended')),
  is_verified     BOOLEAN DEFAULT FALSE,
  kyc_status      VARCHAR(20) DEFAULT 'none',
  referral_code   VARCHAR(20) UNIQUE,
  referred_by     UUID REFERENCES users(id),
  last_login_at   TIMESTAMP WITH TIME ZONE,
  last_login_ip   INET,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone  ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ── Wallets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_inr     DECIMAL(18,2) DEFAULT 0.00 CHECK (balance_inr >= 0),
  balance_usdt    DECIMAL(18,8) DEFAULT 0.00,
  total_deposited DECIMAL(18,2) DEFAULT 0.00,
  total_withdrawn DECIMAL(18,2) DEFAULT 0.00,
  is_locked       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- ── Wallet Ledger (source of truth for all balance changes) ──
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id       UUID NOT NULL REFERENCES wallets(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(50) NOT NULL CHECK (type IN (
                    'deposit_credit','deposit_bonus','withdrawal_debit',
                    'admin_credit','admin_debit','profit_credit','referral_bonus'
                  )),
  currency        VARCHAR(10) DEFAULT 'INR',
  amount          DECIMAL(18,8) NOT NULL,
  balance_before  DECIMAL(18,8) NOT NULL,
  balance_after   DECIMAL(18,8) NOT NULL,
  reference_id    UUID,
  reference_type  VARCHAR(50),
  note            TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id  ON wallet_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id    ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type       ON wallet_ledger(type);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON wallet_ledger(created_at);

-- ── Bank Accounts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name           VARCHAR(100) NOT NULL,
  account_holder      VARCHAR(100) NOT NULL,
  account_number      VARCHAR(30) NOT NULL,
  ifsc_code           VARCHAR(15) NOT NULL,
  account_type        VARCHAR(20) DEFAULT 'savings',
  upi_id              VARCHAR(100),
  daily_limit         DECIMAL(12,2) DEFAULT 100000.00,
  current_daily_total DECIMAL(12,2) DEFAULT 0.00,
  total_received      DECIMAL(15,2) DEFAULT 0.00,
  is_active           BOOLEAN DEFAULT TRUE,
  is_full             BOOLEAN DEFAULT FALSE,
  whatsapp_number     VARCHAR(15),
  priority            INTEGER DEFAULT 1,
  note                TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);

-- ── USDT Addresses ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usdt_addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_type  VARCHAR(10) NOT NULL CHECK (chain_type IN ('TRC20','BEP20')),
  address     TEXT NOT NULL,
  label       VARCHAR(100),
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Deposit Orders ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposit_orders (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  order_number            VARCHAR(30) UNIQUE NOT NULL,
  type                    VARCHAR(10) NOT NULL CHECK (type IN ('INR','USDT')),
  requested_amount        DECIMAL(18,8) NOT NULL,
  requested_currency      VARCHAR(10) NOT NULL,
  actual_amount           DECIMAL(18,8),
  actual_currency         VARCHAR(10),
  chain_type              VARCHAR(10) CHECK (chain_type IN ('TRC20','BEP20')),
  wallet_address          TEXT,
  txid                    VARCHAR(200) UNIQUE,
  bank_account_id         UUID REFERENCES bank_accounts(id),
  assigned_bank_id        UUID REFERENCES bank_accounts(id),
  assigned_bank_snapshot  JSONB,
  assigned_at             TIMESTAMP WITH TIME ZONE,
  assigned_by             UUID REFERENCES users(id),
  expires_at              TIMESTAMP WITH TIME ZONE,
  utr_number              VARCHAR(50),
  usdt_rate_inr           DECIMAL(10,2),
  bonus_percent           DECIMAL(5,2),
  bonus_amount            DECIMAL(18,8),
  status                  VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
                            'pending','pending_assignment','assigned',
                            'reviewing','approved','rejected','cancelled'
                          )),
  screenshot_url          TEXT,
  screenshot_public_id    TEXT,
  reviewed_by             UUID REFERENCES users(id),
  admin_note              TEXT,
  reviewed_at             TIMESTAMP WITH TIME ZONE,
  user_ip                 INET,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON deposit_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON deposit_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type       ON deposit_orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON deposit_orders(created_at);

-- ── Withdrawal Requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  order_number    VARCHAR(30) UNIQUE NOT NULL,
  currency        VARCHAR(10) DEFAULT 'INR',
  amount          DECIMAL(18,8) NOT NULL,
  method          VARCHAR(20) NOT NULL CHECK (method IN ('bank','upi')),
  bank_name       VARCHAR(100),
  account_holder  VARCHAR(100),
  account_number  VARCHAR(30),
  ifsc_code       VARCHAR(20),
  upi_id          VARCHAR(100),
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

-- ── P2P Matches ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS p2p_matches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deposit_order_id  UUID NOT NULL REFERENCES deposit_orders(id),
  withdrawal_id     UUID NOT NULL REFERENCES withdrawal_requests(id),
  matched_by        UUID NOT NULL REFERENCES users(id),
  match_amount      DECIMAL(18,2) NOT NULL,
  note              TEXT,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p2p_deposit  ON p2p_matches(deposit_order_id);
CREATE INDEX IF NOT EXISTS idx_p2p_withdraw ON p2p_matches(withdrawal_id);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  body            TEXT NOT NULL,
  type            VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  is_read         BOOLEAN DEFAULT FALSE,
  reference_id    UUID,
  reference_type  VARCHAR(50),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ── Admin Audit Logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID NOT NULL REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  target_type   VARCHAR(50),
  target_id     UUID,
  before_value  JSONB,
  after_value   JSONB,
  note          TEXT,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action     ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);

-- ── Refresh Tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked  BOOLEAN DEFAULT FALSE,
  ip_address  INET,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ── Profit Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  wallet_id    UUID NOT NULL REFERENCES wallets(id),
  amount       DECIMAL(18,2) NOT NULL,
  rate_applied DECIMAL(5,2) NOT NULL,
  deposit_base DECIMAL(18,2) NOT NULL,
  date         DATE NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ── Settings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO settings (key, value, description) VALUES
  ('usdt_rate_inr',          '110.00', 'USDT to INR exchange rate'),
  ('usdt_bonus_percent',     '0.00',   'Bonus % on USDT deposit'),
  ('inr_daily_profit',       '5.00',   'Daily profit % on INR deposits'),
  ('inr_withdrawal_delay',   '3',      'Days before INR can be withdrawn'),
  ('min_deposit_inr',        '500',    'Minimum INR deposit'),
  ('min_deposit_usdt',       '1',      'Minimum USDT deposit'),
  ('max_deposit_inr',        '500000', 'Maximum single INR deposit'),
  ('min_withdrawal_inr',     '500',    'Minimum INR withdrawal'),
  ('withdrawal_fee_inr',     '0',      'Flat fee per INR withdrawal'),
  ('withdrawal_enabled',     'true',   'Enable/disable all withdrawals'),
  ('bank_limit_threshold',   '90',     'Redirect to WhatsApp when bank is this % full'),
  ('order_expiry_minutes',   '30',     'Minutes user has to pay after bank is assigned'),
  ('auto_assign_bank',       'false',  'Auto-assign bank on order creation'),
  ('whatsapp_number',        '',       'WhatsApp number for bank redirect'),
  ('support_whatsapp',       '',       'Support WhatsApp number e.g. +919876543210'),
  ('support_telegram',       '',       'Support Telegram username e.g. @VaultPaySupport'),
  ('support_enabled',        'true',   'Show/hide support section in app'),
  ('maintenance_mode',       'false',  'Put app in maintenance mode'),
  ('allow_registrations',    'true',   'Allow new user signups')
ON CONFLICT (key) DO NOTHING;

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON deposit_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'VaultPay database ready ✅' as status;
