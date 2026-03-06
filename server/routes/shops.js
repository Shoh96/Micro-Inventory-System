/**
 * FILE: server/routes/shops.js
 * PURPOSE: Shop management routes.
 */
'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const ctrl = require('../controllers/shopController');

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'owner', 'clerk'), ctrl.listShops);
router.get('/:id/branches', requireRole('admin', 'owner', 'clerk'), ctrl.listShopBranches);
router.post('/', requireRole('admin', 'owner'), ctrl.createShop);
router.put('/:id', requireRole('admin', 'owner'), ctrl.updateShop);
router.delete('/:id', requireRole('admin', 'owner'), ctrl.deleteShop);

module.exports = router;
