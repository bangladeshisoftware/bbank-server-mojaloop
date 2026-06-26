/**************************************************************************
 * Copyright © 2026 Bangladeshi Software Ltd. All rights reserved.
 * Distributed under the license terms specified in this repository.
 *
 * ORIGINAL AUTHOR: Muhammad Nasim (Developer)
 **************************************************************************/

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const authCtrl = require('../controller/auth.controller');

// Public
router.post('/auth/login', authCtrl.login);
router.post('/auth/verify-otp', authCtrl.verifyOtp);
router.post('/auth/refresh', authCtrl.refresh);

// Protected (any authenticated user)
router.post('/auth/logout', auth, authCtrl.logout);
router.get('/auth/me', auth, authCtrl.getMe);
router.get('/auth/profile', auth, authCtrl.getProfile);
router.put('/auth/me', auth, authCtrl.updateMe);
router.put('/auth/change-password', auth, authCtrl.changePassword);

// Admin only
router.get('/auth/users', auth, auth.admin, authCtrl.getUsers);
router.post('/auth/users', auth, auth.admin, authCtrl.createUser);
router.put('/auth/users/:id', auth, auth.admin, authCtrl.updateUser);
router.delete('/auth/users/:id', auth, auth.admin, authCtrl.deleteUser);
router.put(
  '/auth/users/:id/reset-password',
  auth,
  auth.admin,
  authCtrl.resetPassword,
);

module.exports = router;