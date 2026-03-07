const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const authCtrl = require('../controller/auth.controller');

// ── Public ────────────────────────────────────────────────────
router.post('/auth/login', authCtrl.login);
router.post('/auth/verify-otp', authCtrl.verifyOtp);
router.post('/auth/refresh', authCtrl.refresh);

// ── Protected (any authenticated user) ───────────────────────
router.post('/auth/logout', auth, authCtrl.logout);
router.get('/auth/me', auth, authCtrl.getMe);
router.get('/auth/profile', auth, authCtrl.getProfile);
router.put('/auth/me', auth, authCtrl.updateMe);
router.put('/auth/change-password', auth, authCtrl.changePassword);

// ── Admin only ────────────────────────────────────────────────
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

// ================================================================
//  COMPLETE ROUTE TABLE
// ================================================================
//
//  METHOD  PATH                              AUTH     ROLE
//  ──────  ────────────────────────────────  ───────  ──────────
//  POST    /api/auth/login                   public
//  POST    /api/auth/verify-otp              public
//  POST    /api/auth/refresh                 public
//  POST    /api/auth/logout                  JWT
//  GET     /api/auth/me                      JWT
//  PUT     /api/auth/me                      JWT
//  PUT     /api/auth/change-password         JWT
//  GET     /api/auth/users                   JWT      ADMIN
//  POST    /api/auth/users                   JWT      ADMIN
//  PUT     /api/auth/users/:id               JWT      ADMIN
//  DELETE  /api/auth/users/:id               JWT      ADMIN
//  PUT     /api/auth/users/:id/reset-password JWT     ADMIN
//
// ================================================================
