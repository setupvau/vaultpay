// src/routes/broadcast.js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/broadcastController');

router.use(authenticate);
router.get('/active',              ctrl.getActiveBroadcasts);
router.post('/:broadcast_id/read', ctrl.markBroadcastRead);
router.get('/notices',             ctrl.getNotices);

module.exports = router;
