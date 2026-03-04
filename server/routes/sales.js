/**
 * FILE: server/routes/sales.js (V2)
 *
 * PURPOSE:
 *   Sale recording and history. All roles can record sales.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { recordSale, getSales } = require('../controllers/salesController');

const router = Router();
router.use(authenticate);

router.get('/', getSales);
router.post('/', recordSale);

module.exports = router;
