const express = require('express');
const auth = require('../middleware/auth.middleware');
const activityCtrl = require('../controller/activity.controller');

const router = express.Router();

router.get('/activity-logs', auth, activityCtrl.getLogs);
router.get('/activity-logs/stats', auth, activityCtrl.getStats);

module.exports = router;
