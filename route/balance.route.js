const express = require('express');
const balanceCtrl = require('../controller/balance.controller');
const auth = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/balance', auth, balanceCtrl.getBalance);
router.get('/balance/ledger', auth, balanceCtrl.getLedger);
router.get('/balance/summary', auth, auth.admin, balanceCtrl.getSummary);

router.post('/update-balance', auth, balanceCtrl.updateBalanceByAdmin);

module.exports = router;
