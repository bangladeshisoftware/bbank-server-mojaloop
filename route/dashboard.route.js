/**************************************************************************
 * Copyright © 2026 Bangladeshi Software Ltd. All rights reserved.
 * Distributed under the license terms specified in this repository.
 *
 * ORIGINAL AUTHOR: Muhammad Nasim (Developer)
 **************************************************************************/

const express = require('express');

const router = express.Router();
const auth = require('../middleware/auth.middleware.js');
const { getSummary } = require('../controller/dashboard.controller.js');

router.route('/dashboard/summary').get(auth, getSummary);

module.exports = router;
