const express = require('express');
const auth = require('../middleware/auth.middleware');
const router = express.Router();

const {
  getTransactions,
  getTransactionSummary,
  getTransactionById,
  getMerchantDashboard,
} = require('../controller/transactions.controller');

// IMPORTANT: summary route MUST come before /:id
router.get('/transactions/summary', auth, getTransactionSummary);
router.get('/transactions', auth, getTransactions);
router.get('/transactions/:id', auth, getTransactionById);
router.get('/transactions/today/merchant/dashboard', auth, getMerchantDashboard);

module.exports = router;
