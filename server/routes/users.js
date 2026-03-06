/**
 * FILE: server/routes/users.js
 *
 * PURPOSE:
 *   User management routes.
 *   admin: full CRUD over all users, owner management.
 *   owner: CRUD over their own clerks, branch assignment.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const {
    listUsers, createClerk, createOwner, updateUser,
    updateRole, resetPassword, deactivate, reactivate, clearAllData, deleteOwner,
} = require('../controllers/userController');

const router = Router();
router.use(authenticate);

// GET  /api/users              — admin sees all; owner sees own clerks
router.get('/', requireRole('admin', 'owner'), listUsers);

// POST /api/users/owner        — admin creates an owner with shops + branches inline
router.post('/owner', requireRole('admin'), createOwner);

// POST /api/users/clerk        — owner or admin creates a clerk (branch_id required)
router.post('/clerk', requireRole('owner', 'admin'), createClerk);

// DELETE /api/users/clear-data — ADMIN ONLY: wipe all business data
router.delete('/clear-data', requireRole('admin'), clearAllData);

// DELETE /api/users/owner/:id  — ADMIN ONLY: permanently delete an owner + all their data
router.delete('/owner/:id', requireRole('admin'), deleteOwner);

// PUT  /api/users/:id          — update name/email/branch_id (admin or owner for their clerks)
router.put('/:id', requireRole('admin', 'owner'), updateUser);

// PUT  /api/users/:id/role     — admin only
router.put('/:id/role', requireRole('admin'), updateRole);

// PUT  /api/users/:id/password — admin or owner (for their clerk)
router.put('/:id/password', requireRole('admin', 'owner'), resetPassword);

// PUT  /api/users/:id/reactivate — admin or owner
router.put('/:id/reactivate', requireRole('admin', 'owner'), reactivate);

// DELETE /api/users/:id        — soft deactivation (admin or owner for their clerks)
router.delete('/:id', requireRole('admin', 'owner'), deactivate);

module.exports = router;
