/**
 * FILE: server/routes/settings.js
 * 
 * PURPOSE:
 *   Settings and profile management endpoints.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const ctrl = require('../controllers/settingsController');

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// ── Profile (All Roles) ───────────────────────────────────────────────────────
router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.put('/password', ctrl.changePassword);

// ── Shop Configuration (Owner / Admin) ────────────────────────────────────────
// Using requireRole inline to securely block clerks from modifying shop globals
router.get('/shop', requireRole('owner', 'admin'), ctrl.getShopSettings);
router.put('/shop', requireRole('owner', 'admin'), ctrl.updateShopSettings);

// ── Data Management (Owner / Admin) ───────────────────────────────────────────
router.get('/backup', requireRole('owner', 'admin'), ctrl.exportDatabase);

module.exports = router;
