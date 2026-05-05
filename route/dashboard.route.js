const express = require('express');

const router = express.Router();
const auth = require('../middleware/auth.middleware.js');
const {getSummary} = require('../controller/dashboard.controller.js');

router.route('/dashboard/summary').get(auth, getSummary);

module.exports = router;