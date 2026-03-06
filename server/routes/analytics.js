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
router.use(authenticate);

// Allow clerks to fetch basic dashboard metrics.
router.get('/metrics', ctrl.getMetrics);

// All other analytics require owner or admin role.
router.use(requireRole('owner', 'admin'));

router.get('/admin-metrics', requireRole('admin'), ctrl.getAdminMetrics);
router.get('/revenue', ctrl.getRevenueOverTime);
router.get('/top-products', ctrl.getTopProducts);
router.get('/categories', ctrl.getCategoryBreakdown);
router.get('/stock-predictions', ctrl.getStockPredictions);
router.get('/activity', ctrl.getLog);
router.get('/export/sales', ctrl.exportSalesCsv);
router.get('/export/products', ctrl.exportProductsCsv);

// ── Admin owner visibility routes ──────────────────────────────────────────────
router.get('/owners', requireRole('admin'), ctrl.getOwnerList);
router.get('/owner-metrics', requireRole('admin'), ctrl.getOwnerMetrics);
router.get('/owner-comparison', requireRole('admin'), ctrl.getOwnerComparison);

module.exports = router;
