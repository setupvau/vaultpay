// src/controllers/adminController.js
const { query, transaction } = require('../config/database');
const { creditWallet, debitWallet } = require('../services/walletService');

// ─── Helper: Log Admin Action ───────────────────────────────

const logAdminAction = async (client, { adminId, action, targetType, targetId, before, after, note, req }) => {
  await client.query(
    `INSERT INTO admin_logs (admin_id, action, target_type, target_id, before_value, after_value, note, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      adminId, action, targetType, targetId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      note,
      req?.ip,
      req?.headers['user-agent'],
    ]
  );
};

// ─── Dashboard Analytics ────────────────────────────────────

const getDashboard = async (req, res, next) => {
  try {
    const [users, deposits, pending, revenue] = await Promise.all([
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL \'7 days\') as this_week FROM users WHERE role = \'user\''),
      query('SELECT COUNT(*) as total, SUM(actual_amount) as total_inr FROM deposit_orders WHERE type = \'INR\' AND status = \'approved\''),
      query('SELECT COUNT(*) as count FROM deposit_orders WHERE status = \'reviewing\''),
      query('SELECT SUM(CASE WHEN type = \'INR\' THEN actual_amount ELSE 0 END) as inr, SUM(CASE WHEN type = \'USDT\' THEN actual_amount ELSE 0 END) as usdt FROM deposit_orders WHERE status = \'approved\''),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: parseInt(users.rows[0].total),
          new_this_week: parseInt(users.rows[0].this_week),
        },
        deposits: {
          total_inr_orders: parseInt(deposits.rows[0].total),
          total_inr_amount: parseFloat(deposits.rows[0].total_inr) || 0,
          total_usdt_amount: parseFloat(revenue.rows[0].usdt) || 0,
        },
        pending_reviews: parseInt(pending.rows[0].count),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Approve or Reject Deposit ──────────────────────────────

const reviewDeposit = async (req, res, next) => {
  try {
    const { order_id } = req.params;
    const { action, actual_amount, note } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
    }

    if (action === 'approve' && (!actual_amount || actual_amount <= 0)) {
      return res.status(400).json({ success: false, message: 'Actual amount required for approval' });
    }

    const orderResult = await query(
      `SELECT d.*, u.full_name as user_name 
       FROM deposit_orders d 
       JOIN users u ON u.id = d.user_id
       WHERE d.id = $1`,
      [order_id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (!['pending', 'reviewing'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Order is already ${order.status}` });
    }

    if (action === 'approve') {
      await transaction(async (client) => {
        // For USDT deposits: convert to INR using the rate stored at order time
        // Always credit wallet in INR regardless of deposit type
        let inrCreditAmount;
        let creditNote;

        if (order.type === 'USDT') {
          // Use the rate stored when order was created, fallback to current setting
          const rateRes = await client.query(
            "SELECT value FROM settings WHERE key = 'usdt_rate_inr'"
          );
          const rate = parseFloat(order.usdt_rate_inr) ||
                       parseFloat(rateRes.rows[0]?.value) || 110;
          inrCreditAmount = (parseFloat(actual_amount) * rate).toFixed(2);
          creditNote = `USDT deposit #${order.order_number} approved — ${actual_amount} USDT × ₹${rate} = ₹${inrCreditAmount}`;
        } else {
          inrCreditAmount = actual_amount;
          creditNote = `INR deposit #${order.order_number} approved by admin`;
        }

        // Update order record
        await client.query(
          `UPDATE deposit_orders SET status = 'approved', actual_amount = $1, actual_currency = 'INR',
           reviewed_by = $2, admin_note = $3, reviewed_at = NOW(), updated_at = NOW()
           WHERE id = $4`,
          [inrCreditAmount, req.admin.id, note, order_id]
        );

        // Always credit INR
        await creditWallet(client, {
          userId: order.user_id,
          currency: 'INR',
          amount: inrCreditAmount,
          type: 'deposit_credit',
          referenceId: order.id,
          referenceType: 'deposit',
          note: creditNote,
          createdBy: req.admin.id,
        });

        // Credit bonus in INR if applicable
        if (order.bonus_amount && parseFloat(order.bonus_amount) > 0) {
          let bonusInr;
          if (order.type === 'USDT') {
            const rateRes = await client.query("SELECT value FROM settings WHERE key = 'usdt_rate_inr'");
            const rate = parseFloat(order.usdt_rate_inr) || parseFloat(rateRes.rows[0]?.value) || 110;
            bonusInr = (parseFloat(order.bonus_amount) * rate).toFixed(2);
          } else {
            bonusInr = order.bonus_amount;
          }
          await creditWallet(client, {
            userId: order.user_id,
            currency: 'INR',
            amount: bonusInr,
            type: 'deposit_bonus',
            referenceId: order.id,
            referenceType: 'deposit',
            note: `Bonus for deposit #${order.order_number}`,
            createdBy: req.admin.id,
          });
        }

        // Notify user
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
           VALUES ($1, 'Deposit Approved! 🎉', $2, 'success', $3, 'deposit')`,
          [
            order.user_id,
            order.type === 'USDT'
              ? `Your USDT deposit has been approved and ₹${inrCreditAmount} has been credited to your wallet.`
              : `Your deposit of ₹${inrCreditAmount} has been approved and credited to your wallet.`,
            order.id,
          ]
        );

        // ── Referral commissions ──────────────────────────────
        try {
          const settingsRes = await client.query(
            "SELECT key, value FROM settings WHERE key IN ('referral_enabled','referral_level1_pct','referral_level2_pct')"
          );
          const refSettings = {};
          settingsRes.rows.forEach(r => { refSettings[r.key] = r.value; });

          if (refSettings.referral_enabled === 'true') {
            const l1Pct = parseFloat(refSettings.referral_level1_pct || '0.8');
            const l2Pct = parseFloat(refSettings.referral_level2_pct || '0.4');

            // Find level 1 referrer (who invited this user)
            const l1Res = await client.query(
              'SELECT id, referred_by FROM users WHERE id = $1',
              [order.user_id]
            );
            const l1ReferrerId = l1Res.rows[0]?.referred_by;

            if (l1ReferrerId) {
              const l1Commission = parseFloat((parseFloat(inrCreditAmount) * l1Pct / 100).toFixed(2));
              if (l1Commission > 0) {
                await creditWallet(client, {
                  userId: l1ReferrerId,
                  currency: 'INR',
                  amount: l1Commission,
                  type: 'referral_bonus',
                  referenceId: order.id,
                  referenceType: 'referral_commission',
                  note: `Level 1 referral commission (${l1Pct}%) on deposit ₹${inrCreditAmount}`,
                  createdBy: req.admin.id,
                });
                await client.query(
                  `INSERT INTO referral_commissions
                     (earner_id, from_user_id, level, source_id, source_type, deposit_amount, commission_pct, commission_amt)
                   VALUES ($1,$2,1,$3,'deposit',$4,$5,$6)`,
                  [l1ReferrerId, order.user_id, order.id, inrCreditAmount, l1Pct, l1Commission]
                );
              }

              // Find level 2 referrer (who invited the level 1 referrer)
              const l2Res = await client.query(
                'SELECT referred_by FROM users WHERE id = $1',
                [l1ReferrerId]
              );
              const l2ReferrerId = l2Res.rows[0]?.referred_by;

              if (l2ReferrerId) {
                const l2Commission = parseFloat((parseFloat(inrCreditAmount) * l2Pct / 100).toFixed(2));
                if (l2Commission > 0) {
                  await creditWallet(client, {
                    userId: l2ReferrerId,
                    currency: 'INR',
                    amount: l2Commission,
                    type: 'referral_bonus',
                    referenceId: order.id,
                    referenceType: 'referral_commission',
                    note: `Level 2 referral commission (${l2Pct}%) on deposit ₹${inrCreditAmount}`,
                    createdBy: req.admin.id,
                  });
                  await client.query(
                    `INSERT INTO referral_commissions
                       (earner_id, from_user_id, level, source_id, source_type, deposit_amount, commission_pct, commission_amt)
                     VALUES ($1,$2,2,$3,'deposit',$4,$5,$6)`,
                    [l2ReferrerId, order.user_id, order.id, inrCreditAmount, l2Pct, l2Commission]
                  );
                }
              }
            }
          }
        } catch (refErr) {
          console.error('Referral commission error (non-critical):', refErr.message);
        }

        await logAdminAction(client, {
          adminId: req.admin.id,
          action: 'APPROVE_DEPOSIT',
          targetType: 'deposit',
          targetId: order.id,
          before: { status: order.status, amount: order.requested_amount },
          after: { status: 'approved', inr_credited: inrCreditAmount },
          note,
          req,
        });
      });
    } else {
      // Reject
      await transaction(async (client) => {
        await client.query(
          `UPDATE deposit_orders SET status = 'rejected', reviewed_by = $1, admin_note = $2,
           reviewed_at = NOW(), updated_at = NOW() WHERE id = $3`,
          [req.admin.id, note, order_id]
        );

        await client.query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
           VALUES ($1, 'Deposit Rejected', $2, 'error', $3, 'deposit')`,
          [order.user_id, `Your deposit request was rejected. Reason: ${note || 'No reason provided'}`, order.id]
        );

        await logAdminAction(client, {
          adminId: req.admin.id,
          action: 'REJECT_DEPOSIT',
          targetType: 'deposit',
          targetId: order.id,
          before: { status: order.status },
          after: { status: 'rejected' },
          note,
          req,
        });
      });
    }

    res.json({
      success: true,
      message: `Deposit ${action === 'approve' ? 'approved and wallet credited' : 'rejected'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── List All Deposits (with filters) ──────────────────────

const listDeposits = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, type, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) { params.push(status); where += ` AND d.status = $${params.length}`; }
    if (type)   { params.push(type);   where += ` AND d.type = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (d.order_number ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    const result = await query(
      `SELECT d.id, d.order_number, d.type, d.requested_amount, d.actual_amount,
              d.chain_type, d.txid, d.utr_number, d.status, d.screenshot_url,
              d.created_at, d.reviewed_at, d.admin_note,
              u.phone, u.full_name
       FROM deposit_orders d
       JOIN users u ON u.id = d.user_id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const count = await query(`SELECT COUNT(*) FROM deposit_orders d JOIN users u ON u.id = d.user_id ${where}`, params);

    res.json({
      success: true,
      data: {
        deposits: result.rows,
        pagination: { total: parseInt(count.rows[0].count), page, limit },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── User Management ────────────────────────────────────────

const listUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, status } = req.query;

    let where = "WHERE u.role = 'user'";
    const params = [];
    if (status) { params.push(status); where += ` AND u.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.phone ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    const result = await query(
      `SELECT u.id, u.phone, u.full_name, u.status, u.created_at, u.last_login_at,
              w.balance_inr, w.balance_usdt, w.total_deposited
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    next(error);
  }
};

const freezeUser = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { action, reason } = req.body;  // action: 'freeze' | 'unfreeze'

    const newStatus = action === 'freeze' ? 'frozen' : 'active';

    const before = await query('SELECT status FROM users WHERE id = $1', [user_id]);
    await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, user_id]);

    await transaction(async (client) => {
      await logAdminAction(client, {
        adminId: req.admin.id,
        action: action === 'freeze' ? 'FREEZE_USER' : 'UNFREEZE_USER',
        targetType: 'user',
        targetId: user_id,
        before: { status: before.rows[0]?.status },
        after: { status: newStatus },
        note: reason,
        req,
      });
    });

    res.json({ success: true, message: `User account ${newStatus}` });
  } catch (error) {
    next(error);
  }
};

// ─── Manual Wallet Adjustment ───────────────────────────────

const adjustWallet = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { action, amount, currency, reason } = req.body;

    if (!['credit', 'debit'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be credit or debit' });
    }

    await transaction(async (client) => {
      if (action === 'credit') {
        await creditWallet(client, {
          userId: user_id, currency, amount,
          type: 'admin_credit',
          note: reason || 'Manual admin credit',
          createdBy: req.admin.id,
        });
      } else {
        await debitWallet(client, {
          userId: user_id, currency, amount,
          type: 'admin_debit',
          note: reason || 'Manual admin debit',
          createdBy: req.admin.id,
        });
      }

      await logAdminAction(client, {
        adminId: req.admin.id,
        action: 'ADJUST_WALLET',
        targetType: 'user',
        targetId: user_id,
        after: { action, amount, currency },
        note: reason,
        req,
      });
    });

    res.json({ success: true, message: `Wallet ${action}ed successfully` });
  } catch (error) {
    next(error);
  }
};

// ─── Settings Management ─────────────────────────────────────

const getSettings = async (req, res, next) => {
  try {
    const result = await query('SELECT key, value, description, updated_at FROM settings ORDER BY key');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const before = await query('SELECT value FROM settings WHERE key = $1', [key]);
    await query(
      'UPDATE settings SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3',
      [value, req.admin.id, key]
    );

    await transaction(async (client) => {
      await logAdminAction(client, {
        adminId: req.admin.id,
        action: 'UPDATE_SETTING',
        targetType: 'setting',
        before: { key, value: before.rows[0]?.value },
        after: { key, value },
        req,
      });
    });

    res.json({ success: true, message: 'Setting updated' });
  } catch (error) {
    next(error);
  }
};

// ─── Bank Account Management ─────────────────────────────────

const addBankAccount = async (req, res, next) => {
  try {
    const { bank_name, account_holder, account_number, ifsc_code, upi_id, daily_limit, whatsapp_number } = req.body;

    const result = await query(
      `INSERT INTO bank_accounts (bank_name, account_holder, account_number, ifsc_code, upi_id, daily_limit, whatsapp_number, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [bank_name, account_holder, account_number, ifsc_code, upi_id, daily_limit || 100000, whatsapp_number, req.admin.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

const listBankAccounts = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM bank_accounts ORDER BY priority ASC, created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// ─── USDT Address Management ─────────────────────────────────

const updateUSDTAddress = async (req, res, next) => {
  try {
    const { chain_type, address, label } = req.body;

    // Deactivate old address for this chain
    await query('UPDATE usdt_addresses SET is_active = false WHERE chain_type = $1', [chain_type]);

    // Insert new active address
    const result = await query(
      'INSERT INTO usdt_addresses (chain_type, address, label, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [chain_type, address, label, req.admin.id]
    );

    await transaction(async (client) => {
      await logAdminAction(client, {
        adminId: req.admin.id,
        action: 'UPDATE_USDT_ADDRESS',
        targetType: 'setting',
        after: { chain_type, address },
        req,
      });
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// ─── Audit Logs ──────────────────────────────────────────────

const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT l.*, u.full_name as admin_name, u.phone as admin_phone
       FROM admin_logs l
       JOIN users u ON u.id = l.admin_id
       ORDER BY l.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// ─── Assign Bank to INR Deposit Order ────────────────────────
// Admin can assign a bank account OR a pending withdrawer's bank details
const assignBankToOrder = async (req, res, next) => {
  try {
    const { order_id } = req.params;
    const { bank_account_id, withdrawal_id, custom_bank } = req.body;
    // bank_account_id: assign from saved bank accounts
    // withdrawal_id:   P2P match — use withdrawer's bank details
    // custom_bank:     { bank_name, account_holder, account_number, ifsc_code, upi_id }

    const orderRes = await query(
      `SELECT d.*, u.full_name, u.phone FROM deposit_orders d
       JOIN users u ON u.id = d.user_id
       WHERE d.id=$1 AND d.type='INR'`,
      [order_id]
    );
    if (!orderRes.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = orderRes.rows[0];
    if (!['pending_assignment', 'pending'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Order already has status: ${order.status}` });
    }

    let bankSnapshot = null;
    let assignedBankId = null;

    if (withdrawal_id) {
      // P2P MATCH: use the withdrawer's bank/UPI details
      const wRes = await query(
        `SELECT w.*, u.full_name as withdrawer_name FROM withdrawal_requests w
         JOIN users u ON u.id = w.user_id
         WHERE w.id=$1 AND w.status='pending' AND w.currency='INR'`,
        [withdrawal_id]
      );
      if (!wRes.rows.length) return res.status(404).json({ success: false, message: 'Withdrawal not found or not pending' });

      const w = wRes.rows[0];
      bankSnapshot = w.method === 'upi'
        ? { upi_id: w.upi_id, account_holder: w.withdrawer_name, method: 'upi' }
        : { bank_name: w.bank_name, account_holder: w.account_holder, account_number: w.account_number, ifsc_code: w.ifsc_code, method: 'bank' };

      // Record the P2P match
      await query(
        `INSERT INTO p2p_matches (deposit_order_id, withdrawal_id, matched_by, match_amount, note)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [order_id, withdrawal_id, req.admin.id, order.requested_amount, 'P2P match by admin']
      );

    } else if (bank_account_id) {
      const bRes = await query(
        'SELECT * FROM bank_accounts WHERE id=$1 AND is_active=true',
        [bank_account_id]
      );
      if (!bRes.rows.length) return res.status(404).json({ success: false, message: 'Bank account not found' });
      const b = bRes.rows[0];
      bankSnapshot  = { bank_name: b.bank_name, account_holder: b.account_holder, account_number: b.account_number, ifsc_code: b.ifsc_code, upi_id: b.upi_id, method: b.upi_id ? 'upi_or_bank' : 'bank' };
      assignedBankId = bank_account_id;

    } else if (custom_bank) {
      bankSnapshot = { ...custom_bank, method: custom_bank.upi_id ? 'upi_or_bank' : 'bank' };

    } else {
      return res.status(400).json({ success: false, message: 'Provide bank_account_id, withdrawal_id, or custom_bank' });
    }

    const settingsRes = await query("SELECT value FROM settings WHERE key='order_expiry_minutes'");
    const expiryMins  = parseInt(settingsRes.rows[0]?.value || '30');
    const expiresAt   = new Date(Date.now() + expiryMins * 60000);

    await transaction(async (client) => {
      await client.query(
        `UPDATE deposit_orders
         SET status='assigned', assigned_bank_id=$1, assigned_bank_snapshot=$2,
             assigned_at=NOW(), assigned_by=$3, expires_at=$4, updated_at=NOW()
         WHERE id=$5`,
        [assignedBankId, JSON.stringify(bankSnapshot), req.admin.id, expiresAt, order_id]
      );

      // Notify the user
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
         VALUES ($1,'✅ Bank Account Assigned',$2,'success',$3,'deposit')`,
        [
          order.user_id,
          `Your INR deposit order is ready! Bank details have been assigned. Please complete payment within ${expiryMins} minutes.`,
          order_id,
        ]
      );

      await logAdminAction(client, {
        adminId: req.admin.id,
        action: 'ASSIGN_BANK_TO_ORDER',
        targetType: 'deposit',
        targetId: order_id,
        after: { bank_snapshot: bankSnapshot, p2p: !!withdrawal_id },
        req,
      });
    });

    res.json({
      success: true,
      message: `Bank assigned. User has ${expiryMins} minutes to pay.`,
      data: { order_id, bank_snapshot: bankSnapshot, expires_at: expiresAt },
    });
  } catch (err) { next(err); }
};

// ─── Get orders waiting for bank assignment ──────────────────
const getPendingAssignments = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.id, d.order_number, d.requested_amount, d.status,
              d.created_at, d.expires_at,
              u.full_name, u.phone
       FROM deposit_orders d
       JOIN users u ON u.id = d.user_id
       WHERE d.type='INR' AND d.status IN ('pending_assignment','pending')
       ORDER BY d.created_at ASC`
    );

    // Also get pending withdrawals for P2P matching suggestions
    const pendingWithdrawals = await query(
      `SELECT w.id, w.order_number, w.amount, w.method,
              w.bank_name, w.account_holder, w.account_number, w.ifsc_code, w.upi_id,
              u.full_name, u.phone
       FROM withdrawal_requests w
       JOIN users u ON u.id = w.user_id
       WHERE w.status='pending' AND w.currency='INR'
       ORDER BY w.created_at ASC`
    );

    res.json({
      success: true,
      data: {
        pending_orders:      result.rows,
        pending_withdrawals: pendingWithdrawals.rows, // for P2P matching
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  getDashboard,
  reviewDeposit,
  listDeposits,
  getPendingAssignments,
  assignBankToOrder,
  listUsers,
  getUserDetail,
  freezeUser,
  adjustWallet,
  getSettings,
  updateSetting,
  addBankAccount,
  listBankAccounts,
  updateUSDTAddress,
  getAuditLogs,
};

// ─── Get full user detail + transaction history ──────────────
async function getUserDetail(req, res, next) {
  try {
    const { user_id } = req.params;

    const [userRes, walletRes, depositsRes, withdrawalsRes, commissionsRes, investmentsRes] = await Promise.all([
      query(
        `SELECT u.id, u.phone, u.full_name, u.status, u.role, u.created_at,
                u.last_login_at, u.referral_code,
                r.full_name as referred_by_name, r.phone as referred_by_phone
         FROM users u
         LEFT JOIN users r ON r.id = u.referred_by
         WHERE u.id = $1`,
        [user_id]
      ),
      query('SELECT * FROM wallets WHERE user_id = $1', [user_id]),
      query(
        `SELECT id, order_number, type, requested_amount, actual_amount, status,
                chain_type, created_at, reviewed_at
         FROM deposit_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [user_id]
      ),
      query(
        `SELECT id, order_number, amount, method, status, created_at, reviewed_at
         FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [user_id]
      ),
      query(
        `SELECT level, COUNT(*) as count, SUM(commission_amt) as total_earned
         FROM referral_commissions WHERE earner_id = $1 GROUP BY level`,
        [user_id]
      ),
      query(
        `SELECT i.*, p.name as plan_name FROM user_investments i
         JOIN investment_plans p ON p.id = i.plan_id
         WHERE i.user_id = $1 ORDER BY i.created_at DESC`,
        [user_id]
      ),
    ]);

    if (!userRes.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const wallet     = walletRes.rows[0];
    const deposits   = depositsRes.rows;
    const lastDeposit  = deposits.find(d => d.status === 'approved');
    const lastWithdraw = withdrawalsRes.rows.find(w => w.status === 'approved');

    const totalDepositedINR = deposits
      .filter(d => d.status === 'approved')
      .reduce((sum, d) => sum + parseFloat(d.actual_amount || 0), 0);

    const totalWithdrawnINR = withdrawalsRes.rows
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

    res.json({
      success: true,
      data: {
        user:              userRes.rows[0],
        wallet,
        stats: {
          total_deposited_inr:  totalDepositedINR.toFixed(2),
          total_withdrawn_inr:  totalWithdrawnINR.toFixed(2),
          last_deposit:         lastDeposit || null,
          last_withdrawal:      lastWithdraw || null,
          total_deposit_orders: deposits.length,
        },
        deposits:    deposits,
        withdrawals: withdrawalsRes.rows,
        commissions: commissionsRes.rows,
        investments: investmentsRes.rows,
      },
    });
  } catch (err) { next(err); }
}
