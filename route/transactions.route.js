/**************************************************************************
 * Copyright © 2026 Bangladeshi Software Ltd. All rights reserved.
 * Distributed under the license terms specified in this repository.
 *
 * ORIGINAL AUTHOR: Muhammad Nasim (Developer)
 **************************************************************************/

const express = require('express');
const auth = require('../middleware/auth.middleware');
const router = express.Router();

const {
  getTransactions,
  getTransactionSummary,
  getTransactionById,
  getMerchantDashboard,
} = require('../controller/transactions.controller');

router.get('/transactions/summary', auth, getTransactionSummary);
router.get('/transactions', auth, getTransactions);
router.get('/transactions/:id', auth, getTransactionById);
router.get(
  '/transactions/today/merchant/dashboard',
  auth,
  getMerchantDashboard,
);

module.exports = router;
