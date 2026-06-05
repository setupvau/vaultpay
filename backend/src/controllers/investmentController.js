// src/controllers/investmentController.js
const { query, transaction } = require('../config/database');
const { debitWallet, creditWallet } = require('../services/walletService');

// ── Get available plans ──────────────────────────────────────
const getPlans = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM investment_plans WHERE is_active = true ORDER BY min_amount ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── Buy a plan ───────────────────────────────────────────────
const buyPlan = async (req, res, next) => {
  try {
    const { plan_id, amount } = req.body;

    if (!plan_id || !amount) {
      return res.status(400).json({ success: false, message: 'Plan and amount are required' });
    }

    const planRes = await query(
      'SELECT * FROM investment_plans WHERE id = $1 AND is_active = true',
      [plan_id]
    );
    if (!planRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    const plan = planRes.rows[0];
    const amt  = parseFloat(amount);

    if (amt < parseFloat(plan.min_amount)) {
      return res.status(400).json({
        success: false,
        message: `Minimum investment for ${plan.name} is ₹${plan.min_amount}`,
      });
    }

    // Check balance
    const walletRes = await query(
      'SELECT balance_inr FROM wallets WHERE user_id = $1',
      [req.user.id]
    );
    if (parseFloat(walletRes.rows[0]?.balance_inr) < amt) {
      return res.status(400).json({ success: false, message: 'Insufficient INR balance' });
    }

    const profitAmt  = parseFloat(((amt * plan.return_pct) / 100).toFixed(2));
    const totalPayout = parseFloat((amt + profitAmt).toFixed(2));
    const lockedUntil = new Date(Date.now() + plan.lock_days * 24 * 60 * 60 * 1000);

    const investment = await transaction(async (client) => {
      // Debit wallet
      await debitWallet(client, {
        userId: req.user.id,
        currency: 'INR',
        amount: amt,
        type: 'admin_debit',
        referenceType: 'investment',
        note: `Invested in ${plan.name} — locked until ${lockedUntil.toDateString()}`,
        createdBy: req.user.id,
      });

      // Create investment record
      const inv = await client.query(
        `INSERT INTO user_investments
           (user_id, plan_id, amount, return_pct, profit_amount, total_payout, locked_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [req.user.id, plan_id, amt, plan.return_pct, profitAmt, totalPayout, lockedUntil]
      );

      // Notify user
      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
         VALUES ($1,$2,$3,'success',$4,'investment')`,
        [
          req.user.id,
          `${plan.name} Activated! 🔒`,
          `₹${amt} invested. You'll receive ₹${totalPayout} on ${lockedUntil.toDateString()}. Profit: ₹${profitAmt} (${plan.return_pct}%)`,
          inv.rows[0].id,
        ]
      );

      return inv.rows[0];
    });

    res.status(201).json({
      success: true,
      message: `Investment activated! ₹${totalPayout} will be credited on ${lockedUntil.toDateString()}`,
      data: investment,
    });
  } catch (err) { next(err); }
};

// ── Get user's investments ───────────────────────────────────
const getMyInvestments = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, p.name as plan_name, p.slug, p.lock_days
       FROM user_investments i
       JOIN investment_plans p ON p.id = i.plan_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── Process matured investments (called by cron or admin) ────
const processMaturedInvestments = async (req, res, next) => {
  try {
    const matured = await query(
      `SELECT i.*, u.full_name FROM user_investments i
       JOIN users u ON u.id = i.user_id
       WHERE i.status = 'active' AND i.locked_until <= NOW()`
    );

    let processed = 0;
    for (const inv of matured.rows) {
      try {
        await transaction(async (client) => {
          await creditWallet(client, {
            userId: inv.user_id,
            currency: 'INR',
            amount: inv.total_payout,
            type: 'profit_credit',
            referenceId: inv.id,
            referenceType: 'investment',
            note: `Investment matured — ₹${inv.amount} + ₹${inv.profit_amount} profit`,
            createdBy: req.admin?.id || inv.user_id,
          });

          await client.query(
            `UPDATE user_investments SET status='completed', paid_at=NOW(), updated_at=NOW() WHERE id=$1`,
            [inv.id]
          );

          await client.query(
            `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
             VALUES ($1,'💰 Investment Matured!',$2,'success',$3,'investment')`,
            [
              inv.user_id,
              `Your investment has matured! ₹${inv.total_payout} (principal + ${inv.return_pct}% profit) has been credited to your wallet.`,
              inv.id,
            ]
          );
        });
        processed++;
      } catch (e) {
        console.error(`Failed to process investment ${inv.id}:`, e.message);
      }
    }

    res.json({ success: true, message: `Processed ${processed} matured investments` });
  } catch (err) { next(err); }
};

// ── Admin: view all investments ──────────────────────────────
const adminListInvestments = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT i.*, p.name as plan_name, u.full_name, u.phone
       FROM user_investments i
       JOIN investment_plans p ON p.id = i.plan_id
       JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

module.exports = { getPlans, buyPlan, getMyInvestments, processMaturedInvestments, adminListInvestments };
