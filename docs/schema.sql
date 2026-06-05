-- ============================================================
-- VaultPay Database Schema
-- Run this ENTIRE file in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           VARCHAR(15) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  full_name       VARCHAR(100),
  email           VARCHAR(150) UNIQUE,
  role            VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended')),
  is_verified     BOOLEAN DEFAULT FALSE,
  kyc_status      VARCHAR(20) DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected')),
  referral_code   VARCHAR(20) UNIQUE,
  referred_by     UUID REFERENCES users(id),
  last_login_at   TIMESTAMP WITH TIME ZONE,
  last_login_ip   INET,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================
-- 2. WALLETS TABLE (one per user)
-- ============================================================
CREATE TABLE wallets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_inr     DECIMAL(18, 2) DEFAULT 0.00 CHECK (balance_inr >= 0),
  balance_usdt    DECIMAL(18, 8) DEFAULT 0.00000000 CHECK (balance_usdt >= 0),
  total_deposited DECIMAL(18, 2) DEFAULT 0.00,
  total_withdrawn DECIMAL(18, 2) DEFAULT 0.00,
  is_locked       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- ============================================================
-- 3. WALLET LEDGER (the source of truth for all balance changes)
-- NEVER edit wallet balance directly — always insert here
-- ============================================================
CREATE TABLE wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id       UUID NOT NULL REFERENCES wallets(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  type            VARCHAR(50) NOT NULL CHECK (type IN (
                    'deposit_credit',     -- User deposit approved
                    'deposit_bonus',      -- Bonus from deposit
                    'withdrawal_debit',   -- User withdrawal
                    'admin_credit',       -- Admin manually added funds
                    'admin_debit',        -- Admin manually removed funds
                    'profit_credit',      -- Daily profit added
                    'referral_bonus'      -- Referral reward
                  )),
  currency        VARCHAR(10) DEFAULT 'INR' CHECK (currency IN ('INR', 'USDT')),
  amount          DECIMAL(18, 8) NOT NULL,
  balance_before  DECIMAL(18, 8) NOT NULL,
  balance_after   DECIMAL(18, 8) NOT NULL,
  reference_id    UUID,                   -- Links to deposit/withdrawal ID
  reference_type  VARCHAR(50),            -- 'deposit', 'withdrawal', etc.
  note            TEXT,                   -- Admin or system note
  created_by      UUID REFERENCES users(id),  -- Who triggered this (user or admin)
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ledger_wallet_id ON wallet_ledger(wallet_id);
CREATE INDEX idx_ledger_user_id ON wallet_ledger(user_id);
CREATE INDEX idx_ledger_type ON wallet_ledger(type);
CREATE INDEX idx_ledger_created_at ON wallet_ledger(created_at);

-- ============================================================
-- 4. DEPOSIT ORDERS
-- ============================================================
CREATE TABLE deposit_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id),
  order_number      VARCHAR(30) UNIQUE NOT NULL,  -- e.g. U2026052701285057654102
  type              VARCHAR(10) NOT NULL CHECK (type IN ('INR', 'USDT')),
  
  -- Requested amounts
  requested_amount  DECIMAL(18, 8) NOT NULL,      -- What user requested
  requested_currency VARCHAR(10) NOT NULL,

  -- Actual amounts (may differ, set by admin on confirmation)
  actual_amount     DECIMAL(18, 8),               -- What admin confirms received
  actual_currency   VARCHAR(10),
  
  -- For USDT deposits
  chain_type        VARCHAR(10) CHECK (chain_type IN ('TRC20', 'BEP20')),
  wallet_address    TEXT,                          -- Which address was shown to user
  txid              VARCHAR(200) UNIQUE,           -- Blockchain transaction ID
  
  -- For INR deposits
  bank_account_id   UUID,                         -- Which bank account was assigned
  utr_number        VARCHAR(50),                  -- UTR reference number
  
  -- Exchange rate at time of order
  usdt_rate_inr     DECIMAL(10, 2),              -- e.g. 110.00 INR per USDT
  bonus_percent     DECIMAL(5, 2),               -- e.g. 5.00%
  bonus_amount      DECIMAL(18, 8),              -- Calculated bonus
  
  status            VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
                      'pending',    -- Just created
                      'reviewing',  -- Admin is looking at it
                      'approved',   -- Admin approved, wallet credited
                      'rejected',   -- Admin rejected
                      'cancelled'   -- User or system cancelled
                    )),
  
  -- Screenshot proof
  screenshot_url    TEXT,                        -- Cloudinary URL
  screenshot_public_id TEXT,                    -- Cloudinary public ID (for deletion)
  
  -- Admin action
  reviewed_by       UUID REFERENCES users(id),  -- Admin who acted
  admin_note        TEXT,                        -- Admin's comment
  reviewed_at       TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  user_ip           INET,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON deposit_orders(user_id);
CREATE INDEX idx_orders_status ON deposit_orders(status);
CREATE INDEX idx_orders_type ON deposit_orders(type);
CREATE INDEX idx_orders_created_at ON deposit_orders(created_at);
CREATE INDEX idx_orders_txid ON deposit_orders(txid);

-- ============================================================
-- 5. BANK ACCOUNTS (managed by admin for INR deposits)
-- ============================================================
CREATE TABLE bank_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name       VARCHAR(100) NOT NULL,
  account_holder  VARCHAR(100) NOT NULL,
  account_number  VARCHAR(30) NOT NULL,
  ifsc_code       VARCHAR(15) NOT NULL,
  account_type    VARCHAR(20) DEFAULT 'savings',
  upi_id          VARCHAR(100),
  daily_limit     DECIMAL(12, 2) DEFAULT 100000.00,   -- Max INR per day
  current_daily_total DECIMAL(12, 2) DEFAULT 0.00,    -- Resets daily
  total_received  DECIMAL(15, 2) DEFAULT 0.00,
  is_active       BOOLEAN DEFAULT TRUE,
  is_full         BOOLEAN DEFAULT FALSE,               -- Auto-set when near limit
  whatsapp_number VARCHAR(15),                         -- For redirect when full
  priority        INTEGER DEFAULT 1,                   -- 1 = highest priority
  note            TEXT,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);

-- ============================================================
-- 6. USDT WALLET ADDRESSES (managed by admin)
-- ============================================================
CREATE TABLE usdt_addresses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_type      VARCHAR(10) NOT NULL CHECK (chain_type IN ('TRC20', 'BEP20')),
  address         TEXT NOT NULL,
  label           VARCHAR(100),               -- e.g. "Main TRC20 Wallet"
  is_active       BOOLEAN DEFAULT TRUE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. PLATFORM SETTINGS (admin-controlled)
-- ============================================================
CREATE TABLE settings (
  key             VARCHAR(100) PRIMARY KEY,
  value           TEXT NOT NULL,
  description     TEXT,
  updated_by      UUID REFERENCES users(id),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value, description) VALUES
  ('usdt_rate_inr',         '110.00',  'USDT to INR exchange rate'),
  ('usdt_bonus_percent',    '0.00',    'Bonus % on USDT deposit'),
  ('inr_daily_profit',      '5.00',    'Daily profit % on INR deposits'),
  ('inr_withdrawal_delay',  '3',       'Days before INR can be withdrawn'),
  ('min_deposit_inr',       '500',     'Minimum INR deposit'),
  ('min_deposit_usdt',      '1',       'Minimum USDT deposit'),
  ('max_deposit_inr',       '500000',  'Maximum single INR deposit'),
  ('bank_limit_threshold',  '90',      'Redirect to WhatsApp when bank is % full'),
  ('whatsapp_number',       '',        'WhatsApp for INR bank details redirect'),
  ('maintenance_mode',      'false',   'Put app in maintenance mode'),
  ('allow_registrations',   'true',    'Allow new user signups'),
  ('support_whatsapp',      '',        'WhatsApp support number e.g. +919876543210'),
  ('support_telegram',      '',        'Telegram username e.g. @VaultPaySupport'),
  ('support_enabled',       'true',    'Show/hide support section in app');

-- ============================================================
-- 8. NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  body            TEXT NOT NULL,
  type            VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read         BOOLEAN DEFAULT FALSE,
  reference_id    UUID,        -- Optional: link to order/transaction
  reference_type  VARCHAR(50),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- 9. ADMIN AUDIT LOGS (every admin action recorded)
-- ============================================================
CREATE TABLE admin_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id        UUID NOT NULL REFERENCES users(id),
  action          VARCHAR(100) NOT NULL,   -- e.g. 'APPROVE_DEPOSIT', 'FREEZE_USER'
  target_type     VARCHAR(50),             -- e.g. 'user', 'deposit', 'setting'
  target_id       UUID,
  before_value    JSONB,                   -- State before change
  after_value     JSONB,                   -- State after change
  note            TEXT,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at);

-- ============================================================
-- 10. REFRESH TOKENS (for JWT token rotation)
-- ============================================================
CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked      BOOLEAN DEFAULT FALSE,
  ip_address      INET,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============================================================
-- 11. PROFIT CREDITS LOG (daily profit tracking)
-- ============================================================
CREATE TABLE profit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  wallet_id       UUID NOT NULL REFERENCES wallets(id),
  amount          DECIMAL(18, 2) NOT NULL,
  rate_applied    DECIMAL(5, 2) NOT NULL,
  deposit_base    DECIMAL(18, 2) NOT NULL,  -- Balance profit was calculated on
  date            DATE NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)                     -- One profit per user per day
);

-- ============================================================
-- AUTOMATIC UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deposit_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CREATE DEFAULT SUPERADMIN (change password after first login!)
-- ============================================================
-- Run this separately after setup, replace +91XXXXXXXXXX and password
-- INSERT INTO users (phone, password_hash, full_name, role)
-- VALUES ('+91XXXXXXXXXX', '<bcrypt_hash_here>', 'Super Admin', 'superadmin');
-- INSERT INTO wallets (user_id) SELECT id FROM users WHERE phone = '+91XXXXXXXXXX';

-- ============================================================
-- 12. WITHDRAWAL REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  order_number    VARCHAR(30) UNIQUE NOT NULL,
  currency        VARCHAR(10) NOT NULL CHECK (currency IN ('INR', 'USDT')),
  amount          DECIMAL(18, 8) NOT NULL,

  -- Payment method chosen by user
  method          VARCHAR(20) NOT NULL CHECK (method IN ('bank', 'upi', 'usdt_wallet')),

  -- Bank details (for INR bank transfer)
  bank_name       VARCHAR(100),
  account_holder  VARCHAR(100),
  account_number  VARCHAR(30),
  ifsc_code       VARCHAR(20),

  -- UPI (for INR UPI)
  upi_id          VARCHAR(100),

  -- Crypto (for USDT withdrawal)
  wallet_address  VARCHAR(200),
  chain_type      VARCHAR(10) CHECK (chain_type IN ('TRC20', 'BEP20')),

  -- Admin fields
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','processing')),
  reviewed_by     UUID REFERENCES users(id),
  admin_note      TEXT,
  txid            VARCHAR(200),           -- filled by admin after sending
  reviewed_at     TIMESTAMP WITH TIME ZONE,

  user_ip         INET,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawal_requests(status);

CREATE TRIGGER set_updated_at_withdrawals BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add withdrawal settings
INSERT INTO settings (key, value, description) VALUES
  ('min_withdrawal_inr',   '500',   'Minimum INR withdrawal amount'),
  ('min_withdrawal_usdt',  '1',     'Minimum USDT withdrawal amount'),
  ('withdrawal_fee_inr',   '0',     'Flat fee in INR per withdrawal'),
  ('withdrawal_enabled',   'true',  'Enable/disable all withdrawals')
ON CONFLICT (key) DO NOTHING;
