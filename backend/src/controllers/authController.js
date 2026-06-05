// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const { generateAccessToken, generateRefreshToken, generateAdminToken } = require('../utils/jwt');
const Joi = require('joi');

const registerSchema = Joi.object({
  phone:          Joi.string().min(8).max(16).required(),
  password:       Joi.string().min(8).required(),
  full_name:      Joi.string().min(2).max(100).required(),
  referral_code:  Joi.string().optional().allow(''),
  captcha_token:  Joi.string().optional().allow(''),
});

const loginSchema = Joi.object({
  phone:         Joi.string().required(),
  password:      Joi.string().required(),
  captcha_token: Joi.string().optional().allow(''),
});

// ── Register ─────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { phone, password, full_name, referral_code } = value;

    // Check if registrations are open
    try {
      const setting = await query("SELECT value FROM settings WHERE key = 'allow_registrations'");
      if (setting.rows[0]?.value === 'false') {
        return res.status(403).json({ success: false, message: 'Registrations are currently closed.' });
      }
    } catch (settingErr) {
      // If settings table doesn't exist yet, just continue
      console.error('Settings check failed (table may not exist yet):', settingErr.message);
    }

    // Check for duplicate phone
    const existing = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'This phone number is already registered.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Generate a short referral code
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Resolve referrer if code provided
    let referredBy = null;
    if (referral_code) {
      const referrer = await query('SELECT id FROM users WHERE referral_code = $1', [referral_code]);
      if (referrer.rows.length > 0) {
        referredBy = referrer.rows[0].id;
      }
    }

    // Create user and wallet together
    const newUser = await transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (phone, password_hash, full_name, referral_code, referred_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, phone, full_name, role`,
        [phone, password_hash, full_name, referralCode, referredBy]
      );
      const user = result.rows[0];

      await client.query('INSERT INTO wallets (user_id) VALUES ($1)', [user.id]);

      return user;
    });

    // Generate tokens
    const accessToken  = generateAccessToken({ userId: newUser.id, role: newUser.role });
    const refreshToken = generateRefreshToken({ userId: newUser.id });

    // Save refresh token (non-critical — don't fail registration if this errors)
    try {
      const tokenHash = await bcrypt.hash(refreshToken, 8);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address) VALUES ($1, $2, $3, $4)',
        [newUser.id, tokenHash, expiresAt, req.ip]
      );
    } catch (tokenErr) {
      console.error('Refresh token save failed (non-critical):', tokenErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id:        newUser.id,
          phone:     newUser.phone,
          full_name: newUser.full_name,
          role:      newUser.role,
        },
        access_token:  accessToken,
        refresh_token: refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { phone, password } = value;

    const result = await query(
      'SELECT id, phone, full_name, password_hash, role, status FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Incorrect phone number or password.' });
    }

    const user = result.rows[0];

    if (user.status === 'frozen') {
      return res.status(403).json({ success: false, message: 'Your account has been frozen. Please contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect phone number or password.' });
    }

    // Update last login timestamp
    await query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [req.ip, user.id]
    ).catch(() => {}); // non-critical

    const tokenPayload = { userId: user.id, role: user.role };

    // Admins get a token signed with the admin secret
    const accessToken = (user.role === 'admin' || user.role === 'superadmin')
      ? generateAdminToken(tokenPayload)
      : generateAccessToken(tokenPayload);

    const refreshToken = generateRefreshToken(tokenPayload);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id:        user.id,
          phone:     user.phone,
          full_name: user.full_name,
          role:      user.role,
        },
        access_token:  accessToken,
        refresh_token: refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Get Profile ───────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.phone, u.full_name, u.email, u.role, u.status,
              u.referral_code, u.created_at,
              w.balance_inr, w.balance_usdt, w.total_deposited
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getProfile };
