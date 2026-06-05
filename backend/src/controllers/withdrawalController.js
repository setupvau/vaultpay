// src/controllers/withdrawalController.js
// INR ONLY withdrawals — bank transfer or UPI
const { query, transaction } = require('../config/database');
const { debitWallet, creditWallet } = require('../services/walletService');
const Joi = require('joi');

const withdrawSchema = Joi.object({
  amount:          Joi.number().positive().required(),
  method:          Joi.string().valid('bank', 'upi').required(),
  // Bank fields
  bank_name:       Joi.string().max(100).when('method', { is: 'bank', then: Joi.required() }),
  account_holder:  Joi.string().max(100).when('method', { is: 'bank', then: Joi.required() }),
  account_number:  Joi.string().max(30).when('method', { is: 'bank', then: Joi.required() }),
  ifsc_code:       Joi.string().max(20).when('method', { is: 'bank', then: Joi.required() }),
  // UPI field
  upi_id:          Joi.string().max(100).when('method', { is: 'upi', then: Joi.required() }),
});

const generateOrderNumber = () => {
  const d = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);
  const r = Math.floor(Math.random()*100000000).toString().padStart(8,'0');
  return `W${d}${r}`;
};

// ─── Create Withdrawal (INR only) ────────────────────────────
const createWithdrawal = async (req, res, next) => {
  try {
    const { error, value } = withdrawSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { amount, method } = value;

    const settingsRes = await query(
      "SELECT key, value FROM settings WHERE key IN ('withdrawal_enabled','min_withdrawal_inr','withdrawal_fee_inr','inr_withdrawal_delay')"
    );
    const s = {};
    settingsRes.rows.forEach(r => { s[r.key] = r.value; });

    if (s.withdrawal_enabled === 'false') {
      return res.status(403).json({ success: false, message: 'Withdrawals are temporarily disabled.' });
    }

    const minAmount = parseFloat(s.min_withdrawal_inr || '500');
    if (amount < minAmount) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is ₹${minAmount}` });
    }

    // Check INR balance
    const walletRes = await query(
      'SELECT id, balance_inr FROM wallets WHERE user_id = $1',
      [req.user.id]
    );
    if (!walletRes.rows.length) return res.status(400).json({ success: false, message: 'Wallet not found' });

    const balance = parseFloat(walletRes.rows[0].balance_inr);
    if (balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient INR balance. Available: ₹${balance.toFixed(2)}`,
      });
    }

    const orderNumber = generateOrderNumber();
    const fee = parseFloat(s.withdrawal_fee_inr || '0');

    const result = await transaction(async (client) => {
      await debitWallet(client, {
        userId: req.user.id,
        currency: 'INR',
        amount,
        type: 'withdrawal_debit',
        referenceType: 'withdrawal',
        note: `Withdrawal request ${orderNumber}`,
        createdBy: req.user.id,
      });

      const wRes = await client.query(
        `INSERT INTO withdrawal_requests
          (user_id, order_number, currency, amount, method,
           bank_name, account_holder, account_number, ifsc_code, upi_id, user_ip)
         VALUES ($1,$2,'INR',$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, order_number, status, created_at`,
        [
          req.user.id, orderNumber, amount, method,
          value.bank_name || null, value.account_holder || null,
          value.account_number || null, value.ifsc_code || null,
          value.upi_id || null, req.ip,
        ]
      );

      await client.query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
         VALUES ($1,'Withdrawal Submitted',$2,'info',$3,'withdrawal')`,
        [
          req.user.id,
          `Your withdrawal of ₹${amount} has been submitted and is pending admin approval.`,
          wRes.rows[0].id,
        ]
      );

      return wRes.rows[0];
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted! Admin will process it within 24 hours.',
      data: {
        order_id: result.id,
        order_number: result.order_number,
        amount,
        fee,
        final_amount: amount - fee,
        currency: 'INR',
        status: result.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── User Withdrawal History ─────────────────────────────────
const getWithdrawalHistory = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, order_number, currency, amount, method,
              upi_id, bank_name, account_number,
              status, admin_note, txid, created_at, reviewed_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const count = await query(
      'SELECT COUNT(*) FROM withdrawal_requests WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        withdrawals: result.rows,
        pagination: {
          total: parseInt(count.rows[0].count),
          page, limit,
          pages: Math.ceil(parseInt(count.rows[0].count) / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── ADMIN: List Withdrawals ─────────────────────────────────
const adminListWithdrawals = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) { params.push(status); where += ` AND w.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.phone ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR w.order_number ILIKE $${params.length})`;
    }

    const result = await query(
      `SELECT w.id, w.order_number, w.currency, w.amount, w.method,
              w.bank_name, w.account_holder, w.account_number, w.ifsc_code,
              w.upi_id, w.status, w.admin_note, w.txid, w.created_at, w.reviewed_at,
              u.phone, u.full_name
       FROM withdrawal_requests w
       JOIN users u ON u.id = w.user_id
       ${where}
       ORDER BY w.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );

    const cnt = await query(
      `SELECT COUNT(*) FROM withdrawal_requests w JOIN users u ON u.id = w.user_id ${where}`,
      params
    );

    res.json({
      success: true,
      data: {
        withdrawals: result.rows,
        pagination: { total: parseInt(cnt.rows[0].count), page, limit },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── ADMIN: Approve / Reject ─────────────────────────────────
const adminReviewWithdrawal = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, txid, note } = req.body;

    if (!['approve','reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject' });
    }

    const wRes = await query(
      `SELECT w.*, u.full_name FROM withdrawal_requests w JOIN users u ON u.id = w.user_id WHERE w.id = $1`,
      [id]
    );
    if (!wRes.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const w = wRes.rows[0];
    if (w.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Already ${w.status}` });
    }

    await transaction(async (client) => {
      if (action === 'approve') {
        await client.query(
          `UPDATE withdrawal_requests SET status='approved', txid=$1, admin_note=$2,
           reviewed_by=$3, reviewed_at=NOW(), updated_at=NOW() WHERE id=$4`,
          [txid||null, note||null, req.admin.id, id]
        );
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
           VALUES ($1,'Withdrawal Approved ✅',$2,'success',$3,'withdrawal')`,
          [w.user_id, `Your withdrawal of ₹${w.amount} has been approved and sent.`, id]
        );
      } else {
        // Reject → refund INR back
        await client.query(
          `UPDATE withdrawal_requests SET status='rejected', admin_note=$1,
           reviewed_by=$2, reviewed_at=NOW(), updated_at=NOW() WHERE id=$3`,
          [note||null, req.admin.id, id]
        );
        await creditWallet(client, {
          userId: w.user_id,
          currency: 'INR',
          amount: w.amount,
          type: 'admin_credit',
          referenceId: w.id,
          referenceType: 'withdrawal_refund',
          note: `Refund: rejected withdrawal ${w.order_number}`,
          createdBy: req.admin.id,
        });
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
           VALUES ($1,'Withdrawal Rejected',$2,'error',$3,'withdrawal')`,
          [w.user_id, `Your withdrawal was rejected. Reason: ${note||'None'}. ₹${w.amount} refunded to wallet.`, id]
        );
      }

      await client.query(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, after_value, note, ip_address)
         VALUES ($1,$2,'withdrawal',$3,$4,$5,$6)`,
        [req.admin.id, action==='approve'?'APPROVE_WITHDRAWAL':'REJECT_WITHDRAWAL',
         id, JSON.stringify({status:action==='approve'?'approved':'rejected',txid}), note, req.ip]
      );
    });

    res.json({ success: true, message: `Withdrawal ${action}d successfully` });
  } catch (err) {
    next(err);
  }
};

module.exports = { createWithdrawal, getWithdrawalHistory, adminListWithdrawals, adminReviewWithdrawal };
