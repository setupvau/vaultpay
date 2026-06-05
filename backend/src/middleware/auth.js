// src/middleware/auth.js
const { verifyAccessToken, verifyAdminToken } = require('../utils/jwt');
const { query } = require('../config/database');

// Middleware: verify user JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Fetch user from DB to ensure account is still active
    const result = await query(
      'SELECT id, phone, full_name, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    if (user.status === 'frozen' || user.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account is frozen. Contact support.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Middleware: verify admin JWT (uses separate secret)
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Admin token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAdminToken(token);

    const result = await query(
      'SELECT id, phone, full_name, role, status FROM users WHERE id = $1 AND role IN ($2, $3)',
      [decoded.userId, 'admin', 'superadmin']
    );

    if (!result.rows.length) {
      return res.status(403).json({ success: false, message: 'Admin access denied' });
    }

    req.admin = result.rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
};

// Middleware: superadmin only
const requireSuperAdmin = (req, res, next) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Superadmin access required' });
  }
  next();
};

module.exports = { authenticate, authenticateAdmin, requireSuperAdmin };
