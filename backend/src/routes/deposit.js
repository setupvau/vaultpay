// src/routes/deposit.js
const router  = require('express').Router();
const multer  = require('multer');
const ctrl    = require('../controllers/depositController');
const { authenticate }    = require('../middleware/auth');
const { depositLimiter }  = require('../middleware/rateLimiter');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg','image/png','image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP images allowed'));
  },
});
const { query } = require('../config/database');

// Public — get current USDT rate
router.get('/usdt-rate', async (req, res, next) => {
  try {
    const result = await query(
      "SELECT key, value FROM settings WHERE key IN ('usdt_rate_inr', 'usdt_bonus_percent')"
    );
    const s = {};
    result.rows.forEach(r => { s[r.key] = r.value; });
    res.json({
      success: true,
      rate: parseFloat(s.usdt_rate_inr || '110'),
      bonus_percent: parseFloat(s.usdt_bonus_percent || '0'),
    });
  } catch (err) { next(err); }
});
router.use(authenticate);

// USDT
router.post('/usdt',            depositLimiter, ctrl.createUSDTDeposit);
router.post('/usdt/proof',      upload.single('screenshot'), ctrl.submitUSDTProof);

// INR - smart flow
router.post('/inr',             depositLimiter, ctrl.createINRDeposit);
router.get('/inr/:order_id',    ctrl.checkINROrderStatus);   // user polls this
router.post('/inr/proof',       upload.single('screenshot'), ctrl.submitINRProof);

// History
router.get('/history',          ctrl.getDepositHistory);

module.exports = router;
