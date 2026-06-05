// src/routes/investment.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/investmentController');

router.use(authenticate);
router.get('/plans',  ctrl.getPlans);
router.post('/buy',   ctrl.buyPlan);
router.get('/mine',   ctrl.getMyInvestments);

module.exports = router;
