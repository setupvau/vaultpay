// src/routes/admin.js
const router = require('express').Router();
const { authenticateAdmin, requireSuperAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');
const { adminListWithdrawals, adminReviewWithdrawal } = require('../controllers/withdrawalController');
const { processMaturedInvestments, adminListInvestments } = require('../controllers/investmentController');
const {
  adminCreateBroadcast, adminListBroadcasts, adminToggleBroadcast, adminDeleteBroadcast,
  adminCreateNotice, adminListNotices, adminToggleNotice, adminDeleteNotice,
} = require('../controllers/broadcastController');

router.use(authenticateAdmin);

// Dashboard
router.get('/dashboard',                            ctrl.getDashboard);

// Deposits
router.get('/deposits/pending-assignments',         ctrl.getPendingAssignments);
router.get('/deposits',                             ctrl.listDeposits);
router.patch('/deposits/:order_id/review',          ctrl.reviewDeposit);
router.post('/deposits/:order_id/assign',           ctrl.assignBankToOrder);

// Withdrawals
router.get('/withdrawals',                          adminListWithdrawals);
router.patch('/withdrawals/:id/review',             adminReviewWithdrawal);

// Investments
router.get('/investments',                          adminListInvestments);
router.post('/investments/process-matured',         processMaturedInvestments);

// Users
router.get('/users',                                ctrl.listUsers);
router.get('/users/:user_id',                       ctrl.getUserDetail);
router.patch('/users/:user_id/freeze',              ctrl.freezeUser);
router.post('/users/:user_id/wallet/adjust',        ctrl.adjustWallet);

// Broadcasts
router.get('/broadcasts',                           adminListBroadcasts);
router.post('/broadcasts',                          adminCreateBroadcast);
router.patch('/broadcasts/:id/toggle',              adminToggleBroadcast);
router.delete('/broadcasts/:id',                    adminDeleteBroadcast);

// Notices
router.get('/notices',                              adminListNotices);
router.post('/notices',                             adminCreateNotice);
router.patch('/notices/:id/toggle',                 adminToggleNotice);
router.delete('/notices/:id',                       adminDeleteNotice);

// Settings
router.get('/settings',                             ctrl.getSettings);
router.put('/settings/:key',                        ctrl.updateSetting);

// Bank accounts
router.get('/bank-accounts',                        ctrl.listBankAccounts);
router.post('/bank-accounts',                       ctrl.addBankAccount);

// USDT addresses
router.post('/usdt-addresses',                      ctrl.updateUSDTAddress);

// Audit logs
router.get('/logs',                                 requireSuperAdmin, ctrl.getAuditLogs);

module.exports = router;
