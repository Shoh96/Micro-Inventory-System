/**
 * FILE: server/routes/users.js
 *
 * PURPOSE:
 *   User management routes.
 *   admin: list all, update roles, deactivate.
 *   owner: list own clerks, create clerk.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { listUsers, createClerk, updateRole, deactivate } = require('../controllers/userController');

const router = Router();

router.use(authenticate);

// GET  /api/users              — admin sees all; owner sees own clerks
router.get('/', requireRole('admin', 'owner'), listUsers);

// POST /api/users/clerk        — owner creates a clerk account
router.post('/clerk', requireRole('owner', 'admin'), createClerk);

// PUT  /api/users/:id/role     — admin only
router.put('/:id/role', requireRole('admin'), updateRole);

// DELETE /api/users/:id        — admin only (soft deactivation)
router.delete('/:id', requireRole('admin'), deactivate);

module.exports = router;
