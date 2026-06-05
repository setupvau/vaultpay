// src/controllers/depositController.js
const { query, transaction } = require('../config/database');
const cloudinary = require('../config/cloudinary');
const Joi = require('joi');

const usdtDepositSchema = Joi.object({
  amount_usdt: Joi.number().positive().required(),
  chain_type:  Joi.string().valid('TRC20','BEP20').required(),
});

const inrDepositSchema = Joi.object({
  amount_inr: Joi.number().positive().min(1).required(),
});

const generateOrderNumber = () => {
  const d = new Date().toISOString().replace(/[-T:.Z]/g,'').substring(0,14);
  const r = Math.floor(Math.random()*100000000).toString().padStart(8,'0');
  return `U${d}${r}`;
};

const getSettings = async () => {
  const r = await query('SELECT key, value FROM settings');
  const s = {};
  r.rows.forEach(({ key, value }) => { s[key] = value; });
  return s;
};

// ─── USDT Deposit — create order ────────────────────────────
const createUSDTDeposit = async (req, res, next) => {
  try {
    const { error, value } = usdtDepositSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { amount_usdt, chain_type } = value;
    const settings = await getSettings();

    if (amount_usdt < parseFloat(settings.min_deposit_usdt || '1')) {
      return res.status(400).json({ success: false, message: `Minimum USDT deposit is ${settings.min_deposit_usdt}` });
    }

    const addrRes = await query(
      'SELECT address FROM usdt_addresses WHERE chain_type = $1 AND is_active = true LIMIT 1',
      [chain_type]
    );
    if (!addrRes.rows.length) {
      return res.status(503).json({ success: false, message: 'This network is temporarily unavailable.' });
    }

    const walletAddress = addrRes.rows[0].address;
    const usdtRate    = parseFloat(settings.usdt_rate_inr || '110');
    const bonusPct    = parseFloat(settings.usdt_bonus_percent || '0');
    const inrEquiv    = (amount_usdt * usdtRate).toFixed(2);
    const bonusAmt    = ((amount_usdt * bonusPct) / 100).toFixed(8);
    const orderNumber = generateOrderNumber();

    const orderResult = await query(
      `INSERT INTO deposit_orders
         (user_id, order_number, type, requested_amount, requested_currency,
          chain_type, wallet_address, usdt_rate_inr, bonus_percent, bonus_amount, user_ip)
       VALUES ($1,$2,'USDT',$3,'USDT',$4,$5,$6,$7,$8,$9)
       RETURNING id, order_number, wallet_address, chain_type, status, created_at`,
      [req.user.id, orderNumber, amount_usdt, chain_type, walletAddress,
       usdtRate, bonusPct, bonusAmt, req.ip]
    );

    const order = orderResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Order created. Send USDT to the address below.',
      data: {
        order_id:      order.id,
        order_number:  order.order_number,
        wallet_address:order.wallet_address,
        chain_type:    order.chain_type,
        amount_usdt,
        inr_equivalent: inrEquiv,
        bonus_amount:   bonusAmt,
        usdt_rate:      usdtRate,
        status:         order.status,
        created_at:     order.created_at,
      },
    });
  } catch (err) { next(err); }
};

// ─── USDT Proof Upload ───────────────────────────────────────
const submitUSDTProof = async (req, res, next) => {
  try {
    const { order_id, txid } = req.body;
    if (!order_id || !txid) return res.status(400).json({ success: false, message: 'Order ID and TXID required' });
    if (!req.file)           return res.status(400).json({ success: false, message: 'Screenshot required' });

    const orderRes = await query(
      'SELECT id, status FROM deposit_orders WHERE id=$1 AND user_id=$2 AND type=$3',
      [order_id, req.user.id, 'USDT']
    );
    if (!orderRes.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    if (orderRes.rows[0].status !== 'pending') return res.status(400).json({ success: false, message: 'Order is no longer pending' });

    const txCheck = await query('SELECT id FROM deposit_orders WHERE txid=$1', [txid]);
    if (txCheck.rows.length) return res.status(409).json({ success: false, message: 'This TXID has already been used' });

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'vaultpay/deposits', transformation: [{ width:1200, crop:'limit' }, { quality:'auto:good' }] },
        (err, r) => err ? reject(err) : resolve(r)
      );
      stream.end(req.file.buffer);
    });

    await query(
      `UPDATE deposit_orders
       SET txid=$1, screenshot_url=$2, screenshot_public_id=$3, status='reviewing', updated_at=NOW()
       WHERE id=$4`,
      [txid, uploadResult.secure_url, uploadResult.public_id, order_id]
    );

    res.json({ success: true, message: 'Proof submitted! Your deposit is under review.', data: { order_id, status: 'reviewing' } });
  } catch (err) { next(err); }
};

// ─── INR Deposit — NEW SMART FLOW ───────────────────────────
// Step 1: User places order → status = 'pending_assignment'
// Admin assigns bank → status = 'assigned'
// User sees bank details → pays → uploads proof → status = 'reviewing'
const createINRDeposit = async (req, res, next) => {
  try {
    const { error, value } = inrDepositSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    const { amount_inr } = value;
    const settings = await getSettings();

    if (amount_inr < parseFloat(settings.min_deposit_inr || '500')) {
      return res.status(400).json({ success: false, message: `Minimum INR deposit is ₹${settings.min_deposit_inr}` });
    }
    if (amount_inr > parseFloat(settings.max_deposit_inr || '500000')) {
      return res.status(400).json({ success: false, message: `Maximum INR deposit is ₹${settings.max_deposit_inr}` });
    }

    const orderNumber = generateOrderNumber();

    // Check if auto-assign is on
    const autoAssign = settings.auto_assign_bank === 'true';
    let bankId = null, bankSnapshot = null, expiresAt = null, initialStatus = 'pending_assignment';

    if (autoAssign) {
      const threshold = parseFloat(settings.bank_limit_threshold || '90') / 100;
      const bankRes = await query(
        `SELECT id, bank_name, account_holder, account_number, ifsc_code, upi_id
         FROM bank_accounts
         WHERE is_active=true AND is_full=false
           AND (current_daily_total / NULLIF(daily_limit,0)) < $1
         ORDER BY priority ASC, current_daily_total ASC LIMIT 1`,
        [threshold]
      );
      if (bankRes.rows.length) {
        const b = bankRes.rows[0];
        bankId       = b.id;
        bankSnapshot = { bank_name: b.bank_name, account_holder: b.account_holder, account_number: b.account_number, ifsc_code: b.ifsc_code, upi_id: b.upi_id };
        expiresAt    = new Date(Date.now() + parseInt(settings.order_expiry_minutes || '30') * 60000);
        initialStatus = 'assigned';
      }
    }

    const orderResult = await transaction(async (client) => {
      const oRes = await client.query(
        `INSERT INTO deposit_orders
           (user_id, order_number, type, requested_amount, requested_currency,
            bank_account_id, assigned_bank_id, assigned_bank_snapshot,
            assigned_at, expires_at, status, user_ip)
         VALUES ($1,$2,'INR',$3,'INR',$4,$5,$6,
                 ${bankId ? 'NOW()' : 'NULL'}, $7, $8, $9)
         RETURNING id, order_number, status, created_at, expires_at`,
        [
          req.user.id, orderNumber, amount_inr,
          bankId, bankId, bankSnapshot ? JSON.stringify(bankSnapshot) : null,
          expiresAt, initialStatus, req.ip,
        ]
      );

      // Notify ALL admins of new order
      const admins = await client.query("SELECT id FROM users WHERE role IN ('admin','superadmin')");
      for (const admin of admins.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
           VALUES ($1,'🔔 New INR Deposit Order',$2,'info',$3,'deposit')`,
          [
            admin.id,
            `New order ${orderNumber} for ₹${amount_inr.toLocaleString('en-IN')} is waiting for bank assignment.`,
            oRes.rows[0].id,
          ]
        );
      }

      return oRes.rows[0];
    });

    const responseData = {
      order_id:     orderResult.id,
      order_number: orderResult.order_number,
      amount:       amount_inr,
      status:       orderResult.status,
      created_at:   orderResult.created_at,
    };

    if (initialStatus === 'assigned' && bankSnapshot) {
      responseData.bank_details = bankSnapshot;
      responseData.expires_at   = expiresAt;
      responseData.message_detail = `Please complete payment within ${settings.order_expiry_minutes || 30} minutes.`;
    }

    res.status(201).json({
      success: true,
      message: initialStatus === 'assigned'
        ? 'Bank account assigned! Please transfer the amount shown.'
        : 'Order placed! Our team is assigning a bank account. Please wait — this usually takes a few minutes.',
      data: responseData,
    });
  } catch (err) { next(err); }
};

// ─── User polls this to check if bank has been assigned ──────
const checkINROrderStatus = async (req, res, next) => {
  try {
    const { order_id } = req.params;

    const result = await query(
      `SELECT id, order_number, status, requested_amount,
              assigned_bank_snapshot, expires_at, created_at,
              screenshot_url, utr_number, admin_note
       FROM deposit_orders
       WHERE id=$1 AND user_id=$2 AND type='INR'`,
      [order_id, req.user.id]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = result.rows[0];

    // Check expiry
    if (order.expires_at && new Date() > new Date(order.expires_at) && order.status === 'assigned') {
      await query(
        "UPDATE deposit_orders SET status='cancelled', updated_at=NOW() WHERE id=$1",
        [order_id]
      );
      return res.json({
        success: true,
        data: { ...order, status: 'cancelled', message: 'Order expired. Please create a new order.' },
      });
    }

    const response = {
      order_id:     order.id,
      order_number: order.order_number,
      status:       order.status,
      amount:       order.requested_amount,
      expires_at:   order.expires_at,
      created_at:   order.created_at,
      admin_note:   order.admin_note,
    };

    // Only reveal bank details if status is 'assigned'
    if (order.status === 'assigned' && order.assigned_bank_snapshot) {
      response.bank_details = order.assigned_bank_snapshot;
    }

    res.json({ success: true, data: response });
  } catch (err) { next(err); }
};

// ─── INR Proof Upload ────────────────────────────────────────
const submitINRProof = async (req, res, next) => {
  try {
    const { order_id, utr_number } = req.body;
    if (!order_id || !utr_number || !req.file) {
      return res.status(400).json({ success: false, message: 'Order ID, UTR number, and screenshot are required' });
    }

    const orderRes = await query(
      'SELECT id, status FROM deposit_orders WHERE id=$1 AND user_id=$2 AND type=$3',
      [order_id, req.user.id, 'INR']
    );
    if (!orderRes.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = orderRes.rows[0];
    if (!['assigned', 'pending'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot submit proof for order with status: ${order.status}` });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'vaultpay/deposits', transformation: [{ width:1200, crop:'limit' }, { quality:'auto:good' }] },
        (err, r) => err ? reject(err) : resolve(r)
      );
      stream.end(req.file.buffer);
    });

    await query(
      `UPDATE deposit_orders
       SET utr_number=$1, screenshot_url=$2, screenshot_public_id=$3,
           status='reviewing', updated_at=NOW()
       WHERE id=$4`,
      [utr_number, uploadResult.secure_url, uploadResult.public_id, order_id]
    );

    // Notify admins
    const admins = await query("SELECT id FROM users WHERE role IN ('admin','superadmin')");
    for (const admin of admins.rows) {
      await query(
        `INSERT INTO notifications (user_id, title, body, type, reference_id, reference_type)
         VALUES ($1,'💰 Payment Proof Submitted',$2,'info',$3,'deposit')`,
        [admin.id, `User submitted payment proof for INR order. Please review.`, order_id]
      );
    }

    res.json({ success: true, message: 'Payment proof submitted! Your deposit will be reviewed shortly.', data: { order_id, status: 'reviewing' } });
  } catch (err) { next(err); }
};

// ─── Deposit History ─────────────────────────────────────────
const getDepositHistory = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let where = 'WHERE d.user_id=$1';
    const params = [req.user.id];
    if (status) { params.push(status); where += ` AND d.status=$${params.length}`; }

    const result = await query(
      `SELECT d.id, d.order_number, d.type, d.requested_amount, d.actual_amount,
              d.chain_type, d.status, d.txid, d.utr_number, d.screenshot_url,
              d.usdt_rate_inr, d.bonus_amount, d.admin_note,
              d.expires_at, d.assigned_bank_snapshot,
              d.created_at, d.reviewed_at
       FROM deposit_orders d ${where}
       ORDER BY d.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );

    const count = await query(`SELECT COUNT(*) FROM deposit_orders d ${where}`, params);

    res.json({
      success: true,
      data: {
        orders: result.rows,
        pagination: {
          total: parseInt(count.rows[0].count), page, limit,
          pages: Math.ceil(parseInt(count.rows[0].count) / limit),
        },
      },
    });
  } catch (err) { next(err); }
};

module.exports = {
  createUSDTDeposit, submitUSDTProof,
  createINRDeposit,  submitINRProof,
  checkINROrderStatus,
  getDepositHistory,
};
