/**
 * FILE: server/routes/branches.js
 * PURPOSE: Branch management routes.
 */
'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const ctrl = require('../controllers/branchController');

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'owner', 'clerk'), ctrl.listBranches);
router.post('/', requireRole('admin', 'owner'), ctrl.createBranch);
router.put('/:id', requireRole('admin', 'owner'), ctrl.updateBranch);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteBranch);

module.exports = router;
