/**************************************************************************
 * Copyright © 2026 Bangladeshi Software Ltd. All rights reserved.
 * Distributed under the license terms specified in this repository.
 *
 * ORIGINAL AUTHOR: Muhammad Nasim (Developer)
 **************************************************************************/

const express = require('express');
const auth = require('../middleware/auth.middleware');
const activityCtrl = require('../controller/activity.controller');

const router = express.Router();

router.get('/activity-logs', auth, activityCtrl.getLogs);
router.get('/activity-logs/stats', auth, activityCtrl.getStats);

module.exports = router;
