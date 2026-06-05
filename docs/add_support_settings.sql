-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Adds support contact settings (WhatsApp + Telegram)
-- ============================================================

INSERT INTO settings (key, value, description) VALUES
  ('support_whatsapp', '', 'WhatsApp support number e.g. +919876543210'),
  ('support_telegram', '', 'Telegram username e.g. @VaultPaySupport'),
  ('support_enabled',  'true', 'Show/hide support section in app'),
  ('min_withdrawal_inr',  '500',  'Minimum INR withdrawal amount'),
  ('withdrawal_fee_inr',  '0',    'Flat fee per INR withdrawal'),
  ('withdrawal_enabled',  'true', 'Enable/disable all withdrawals')
ON CONFLICT (key) DO NOTHING;

SELECT 'Support settings added ✅' as status;
