// src/middleware/rateLimiter.js
// ─── EDIT THESE VALUES TO CHANGE RATE LIMITS ─────────────────
const LIMITS = {
  general:  { windowMinutes: 15, maxRequests: 2000  },  // General API
  auth:     { windowMinutes: 15, maxRequests: 100   },  // Login / Register
  deposit:  { windowMinutes: 60, maxRequests: 200   },  // Deposit submissions
};
// ─────────────────────────────────────────────────────────────

const rateLimit = require('express-rate-limit');

const make = ({ windowMinutes, maxRequests }, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
  });

const rateLimiter  = make(LIMITS.general, 'Too many requests. Please slow down.');
const authLimiter  = make(LIMITS.auth,    'Too many login attempts. Wait 15 minutes.');
const depositLimiter = make(LIMITS.deposit, 'Too many deposit requests. Wait an hour.');

module.exports = { rateLimiter, authLimiter, depositLimiter };
