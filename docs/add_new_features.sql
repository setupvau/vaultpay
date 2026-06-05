-- ============================================================
-- VAULTPAY — NEW FEATURES MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. Investment Plans ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS investment_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  slug          VARCHAR(50) UNIQUE NOT NULL,
  min_amount    DECIMAL(18,2) NOT NULL,
  lock_days     INTEGER NOT NULL,
  return_pct    DECIMAL(5,2) NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO investment_plans (name, slug, min_amount, lock_days, return_pct, description) VALUES
  ('Basic Plan',   'basic',   500,   3, 3.00,  'Lock ₹500+ for 3 days and earn 3% total return'),
  ('Premium Plan', 'premium', 10000, 7, 15.00, 'Lock ₹10,000+ for 7 days and earn 15% total return')
ON CONFLICT (slug) DO NOTHING;

-- ── 2. User Investments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_investments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  plan_id         UUID NOT NULL REFERENCES investment_plans(id),
  amount          DECIMAL(18,2) NOT NULL,
  return_pct      DECIMAL(5,2) NOT NULL,
  profit_amount   DECIMAL(18,2) NOT NULL,
  total_payout    DECIMAL(18,2) NOT NULL,
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  locked_until    TIMESTAMP WITH TIME ZONE NOT NULL,
  paid_at         TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON user_investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_status  ON user_investments(status);
CREATE INDEX IF NOT EXISTS idx_investments_locked  ON user_investments(locked_until);

-- ── 3. Referral Commissions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_commissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  earner_id       UUID NOT NULL REFERENCES users(id),  -- who earns
  from_user_id    UUID NOT NULL REFERENCES users(id),  -- who deposited
  level           INTEGER NOT NULL CHECK (level IN (1,2)), -- 1=direct, 2=indirect
  source_type     VARCHAR(20) DEFAULT 'deposit',
  source_id       UUID,
  deposit_amount  DECIMAL(18,2) NOT NULL,
  commission_pct  DECIMAL(5,2) NOT NULL,
  commission_amt  DECIMAL(18,2) NOT NULL,
  status          VARCHAR(20) DEFAULT 'paid',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_earner  ON referral_commissions(earner_id);
CREATE INDEX IF NOT EXISTS idx_commissions_from    ON referral_commissions(from_user_id);

-- ── 4. Broadcasts (Admin → Users popup) ──────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  type        VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info','warning','success','promo')),
  priority    INTEGER DEFAULT 1,
  is_active   BOOLEAN DEFAULT TRUE,
  show_once   BOOLEAN DEFAULT TRUE,  -- show only on first login after creation
  starts_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ends_at     TIMESTAMP WITH TIME ZONE,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 5. Broadcast Read Tracking ────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_reads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id  UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user ON broadcast_reads(user_id);

-- ── 6. Notices (persistent announcements in app) ─────────────
CREATE TABLE IF NOT EXISTS notices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  priority    INTEGER DEFAULT 1,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 7. New settings ───────────────────────────────────────────
INSERT INTO settings (key, value, description) VALUES
  ('referral_level1_pct',  '0.8',  'Level 1 referral commission % on deposits'),
  ('referral_level2_pct',  '0.4',  'Level 2 referral commission % on deposits'),
  ('referral_enabled',     'true', 'Enable/disable referral commissions'),
  ('investment_enabled',   'true', 'Enable/disable investment plans'),
  ('recaptcha_enabled',    'false','Enable Google reCAPTCHA on register/login'),
  ('recaptcha_site_key',   '',     'Google reCAPTCHA v2 site key (public)')
ON CONFLICT (key) DO NOTHING;

-- ── 8. Add wallet_ledger type for investment/commission ───────
-- (investment_debit, investment_credit, commission_credit already
--  handled by admin_credit type — no schema change needed)

-- ── 9. Triggers for updated_at ───────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON broadcasts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'New features migration complete ✅' as status;
