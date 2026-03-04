/**
 * FILE: server/routes/saleRoutes.js
 *
 * PURPOSE:
 *   Defines the sales recording and history endpoints.
 *   All routes require a valid JWT.
 *
 * EXPORTS:
 *   Express Router with sale routes.
 *
 * HOW IT FITS:
 *   Mounted in app.js at the /api/sales prefix.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { recordSale, getSales } = require('../controllers/saleController');

const router = Router();

router.use(authenticate);

// GET  /api/sales — retrieve sale history
router.get('/', getSales);

// POST /api/sales — record a new sale
router.post('/', recordSale);

module.exports = router;
