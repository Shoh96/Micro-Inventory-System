/**
 * FILE: server/routes/auth.js
 *
 * PURPOSE:
 *   Public authentication routes — no middleware required.
 *   Protected /profile requires authenticate.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { register, login, getProfile } = require('../controllers/authController');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);

module.exports = router;
