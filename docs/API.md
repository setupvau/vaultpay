# VaultPay API Documentation

Base URL: http://localhost:5000/api

All authenticated routes require:
  Header: Authorization: Bearer <access_token>

Admin routes require the admin JWT token (returned when admin logs in).

=====================================================================
AUTH ROUTES (/api/auth)
=====================================================================

POST /auth/register
  Body: { phone, password, full_name, referral_code? }
  Returns: { user, access_token, refresh_token }

POST /auth/login
  Body: { phone, password }
  Returns: { user, access_token, refresh_token }
  Note: Admin users get an admin JWT token automatically

GET /auth/me  [AUTH REQUIRED]
  Returns: { id, phone, full_name, role, status, balance_inr, balance_usdt }

=====================================================================
WALLET ROUTES (/api/wallet)  [AUTH REQUIRED]
=====================================================================

GET /wallet/balance
  Returns: { balance_inr, balance_usdt, total_deposited, total_withdrawn }

GET /wallet/ledger?page=1&limit=20&currency=INR
  Returns: Array of ledger entries (all balance changes)

GET /wallet/notifications
  Returns: Array of notifications (marks all as read)

GET /wallet/notifications/count
  Returns: { count: number }

=====================================================================
DEPOSIT ROUTES (/api/deposit)  [AUTH REQUIRED]
=====================================================================

POST /deposit/usdt
  Body: { amount_usdt, chain_type: "TRC20"|"BEP20" }
  Returns: { order_id, order_number, wallet_address, chain_type, amount_usdt, inr_equivalent, instructions[] }

POST /deposit/usdt/proof  (multipart/form-data)
  Body: { order_id, txid, screenshot: <file> }
  Returns: { order_id, status: "reviewing" }

POST /deposit/inr
  Body: { amount_inr }
  Returns: { order_id, bank_details, order_number }
  OR: { redirect_to_whatsapp: true, whatsapp_url }

POST /deposit/inr/proof  (multipart/form-data)
  Body: { order_id, utr_number, screenshot: <file> }
  Returns: { order_id, status: "reviewing" }

GET /deposit/history?page=1&limit=10&status=pending
  Status options: pending, reviewing, approved, rejected
  Returns: { orders[], pagination }

=====================================================================
ADMIN ROUTES (/api/admin)  [ADMIN TOKEN REQUIRED]
=====================================================================

GET /admin/dashboard
  Returns: { users: {total, new_this_week}, deposits: {...}, pending_reviews }

GET /admin/deposits?status=reviewing&type=USDT&search=xyz&page=1
  Returns: { deposits[], pagination }

PATCH /admin/deposits/:order_id/review
  Body: { action: "approve"|"reject", actual_amount?, note? }
  Action approve: Credits user wallet with actual_amount
  Returns: success message

GET /admin/users?search=xyz&status=active&page=1
  Returns: { users[] } with wallet balances

PATCH /admin/users/:user_id/freeze
  Body: { action: "freeze"|"unfreeze", reason }
  Returns: success

POST /admin/users/:user_id/wallet/adjust
  Body: { action: "credit"|"debit", amount, currency: "INR"|"USDT", reason }
  Returns: success

GET /admin/settings
  Returns: Array of { key, value, description, updated_at }

PUT /admin/settings/:key
  Body: { value }
  Returns: success

Available setting keys:
  usdt_rate_inr, usdt_bonus_percent, inr_daily_profit,
  inr_withdrawal_delay, min_deposit_inr, min_deposit_usdt,
  max_deposit_inr, bank_limit_threshold, whatsapp_number,
  maintenance_mode, allow_registrations

GET /admin/bank-accounts
  Returns: Array of bank accounts

POST /admin/bank-accounts
  Body: { bank_name, account_holder, account_number, ifsc_code, upi_id?, daily_limit, whatsapp_number? }
  Returns: Created bank account

POST /admin/usdt-addresses
  Body: { chain_type: "TRC20"|"BEP20", address, label? }
  Deactivates old address for that chain, creates new one

GET /admin/logs  [SUPERADMIN ONLY]
  Returns: Array of audit log entries

=====================================================================
ERROR RESPONSE FORMAT
=====================================================================

All errors return:
{
  "success": false,
  "message": "Human readable error message"
}

HTTP Status Codes:
  200 - Success
  201 - Created
  400 - Bad request (validation error)
  401 - Unauthorized (missing/invalid token)
  403 - Forbidden (wrong role or frozen account)
  404 - Not found
  409 - Conflict (duplicate phone, TXID, etc.)
  429 - Rate limit exceeded
  500 - Server error

=====================================================================
SUCCESS RESPONSE FORMAT
=====================================================================

{
  "success": true,
  "message": "Optional message",
  "data": { ... }
}
