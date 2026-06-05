// src/routes/withdrawal.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { createWithdrawal, getWithdrawalHistory } = require('../controllers/withdrawalController');
const { depositLimiter } = require('../middleware/rateLimiter');

router.use(authenticate);
router.post('/',        depositLimiter, createWithdrawal);
router.get('/history',  getWithdrawalHistory);

module.exports = router;
