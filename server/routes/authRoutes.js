/**
 * FILE: server/routes/authRoutes.js
 *
 * PURPOSE:
 *   Defines the public authentication endpoints (no auth middleware required).
 *
 * EXPORTS:
 *   Express Router with /register and /login routes.
 *
 * HOW IT FITS:
 *   Mounted in app.js at the /api/auth prefix.
 */

'use strict';

const { Router } = require('express');
const { register, login } = require('../controllers/authController');

const router = Router();

// POST /api/auth/register — create a new shop-owner account
router.post('/register', register);

// POST /api/auth/login — authenticate and receive a JWT
router.post('/login', login);

module.exports = router;
