/**
 * FILE: server/routes/dashboardRoutes.js
 *
 * PURPOSE:
 *   Defines the dashboard metrics endpoint.
 *   Requires a valid JWT.
 *
 * EXPORTS:
 *   Express Router with dashboard routes.
 *
 * HOW IT FITS:
 *   Mounted in app.js at the /api/dashboard prefix.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { getMetrics } = require('../controllers/dashboardController');

const router = Router();

router.use(authenticate);

// GET /api/dashboard/metrics
router.get('/metrics', getMetrics);

module.exports = router;
