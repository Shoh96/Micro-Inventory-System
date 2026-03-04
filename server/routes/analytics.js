/**
 * FILE: server/routes/analytics.js (V2)
 *
 * PURPOSE:
 *   Analytics and reporting endpoints.
 *   Clerks are excluded; only owners and admins can view analytics.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const ctrl = require('../controllers/analyticsController');

const router = Router();
router.use(authenticate, requireRole('owner', 'admin'));

router.get('/metrics', ctrl.getMetrics);
router.get('/revenue', ctrl.getRevenueOverTime);
router.get('/top-products', ctrl.getTopProducts);
router.get('/categories', ctrl.getCategoryBreakdown);
router.get('/stock-predictions', ctrl.getStockPredictions);
router.get('/activity', ctrl.getLog);
router.get('/export/sales', ctrl.exportSalesCsv);
router.get('/export/products', ctrl.exportProductsCsv);

module.exports = router;
