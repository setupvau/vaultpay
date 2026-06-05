// src/routes/wallet.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getWalletBalance, getLedgerHistory } = require('../services/walletService');
const { query } = require('../config/database');

router.use(authenticate);

// Get wallet balance
router.get('/balance', async (req, res, next) => {
  try {
    const balance = await getWalletBalance(req.user.id);
    res.json({ success: true, data: balance });
  } catch (error) {
    next(error);
  }
});

// Get transaction ledger history
router.get('/ledger', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { currency } = req.query;

    const history = await getLedgerHistory(req.user.id, { page, limit, currency });
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// Get notifications
router.get('/notifications', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, title, body, type, is_read, reference_id, reference_type, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );

    // Mark all as read
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get unread notification count
router.get('/notifications/count', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (error) {
    next(error);
  }
});

// Get support contact info (public, but still auth-gated so only users see it)
router.get('/support', async (req, res, next) => {
  try {
    const result = await query(
      "SELECT key, value FROM settings WHERE key IN ('support_whatsapp','support_telegram','support_enabled')"
    );
    const s = {};
    result.rows.forEach(r => { s[r.key] = r.value; });
    res.json({ success: true, data: s });
  } catch (error) {
    next(error);
  }
});

// Get referral stats — my invites + commissions earned
router.get('/referral-stats', async (req, res, next) => {
  try {
    const [invitesRes, commissionsRes, levelARes, levelBRes] = await Promise.all([
      // Direct invites (level 1)
      query('SELECT COUNT(*) FROM users WHERE referred_by = $1', [req.user.id]),
      // All commissions earned
      query(
        `SELECT level, COUNT(*) as count, COALESCE(SUM(commission_amt),0) as total
         FROM referral_commissions WHERE earner_id = $1 GROUP BY level`,
        [req.user.id]
      ),
      // Level A: total deposits by people I invited
      query(
        `SELECT COALESCE(SUM(d.actual_amount),0) as total
         FROM deposit_orders d
         JOIN users u ON u.id = d.user_id
         WHERE u.referred_by = $1 AND d.status = 'approved'`,
        [req.user.id]
      ),
      // Level B: total deposits by people my invitees invited
      query(
        `SELECT COALESCE(SUM(d.actual_amount),0) as total
         FROM deposit_orders d
         JOIN users u ON u.id = d.user_id
         JOIN users parent ON parent.id = u.referred_by
         WHERE parent.referred_by = $1 AND d.status = 'approved'`,
        [req.user.id]
      ),
    ]);

    const commMap = {};
    commissionsRes.rows.forEach(r => { commMap[r.level] = r; });

    res.json({
      success: true,
      data: {
        total_invites:       parseInt(invitesRes.rows[0].count),
        level_a: {
          total_recharge:    parseFloat(levelARes.rows[0].total).toFixed(2),
          commission_earned: parseFloat(commMap[1]?.total || 0).toFixed(2),
          commission_count:  parseInt(commMap[1]?.count || 0),
        },
        level_b: {
          total_recharge:    parseFloat(levelBRes.rows[0].total).toFixed(2),
          commission_earned: parseFloat(commMap[2]?.total || 0).toFixed(2),
          commission_count:  parseInt(commMap[2]?.count || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// Get list of users I invited with their deposit stats
router.get('/my-invites', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.full_name, u.phone, u.created_at,
              COALESCE(w.balance_inr, 0) as balance_inr,
              COALESCE(SUM(CASE WHEN d.status='approved' THEN d.actual_amount ELSE 0 END), 0) as total_deposited,
              COUNT(CASE WHEN d.status='approved' THEN 1 END) as deposit_count,
              MAX(d.reviewed_at) as last_deposit_at
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN deposit_orders d ON d.user_id = u.id AND d.type = 'INR'
       WHERE u.referred_by = $1
       GROUP BY u.id, u.full_name, u.phone, u.created_at, w.balance_inr
       ORDER BY u.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});
