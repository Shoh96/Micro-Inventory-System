/**
 * FILE: server/controllers/authController.js (V2)
 *
 * PURPOSE:
 *   Registration, login, and profile retrieval.
 *   V2 allows specifying a role on registration (default: 'owner').
 *   Admins can also create clerk sub-accounts.
 *
 * EXPORTS:
 *   register, login, getProfile
 *
 * ROUTES:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/profile  (protected)
 */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user');

const SALT_ROUNDS = 12;

const signToken = (user) =>
    jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role, owner_id: user.owner_id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

/**
 * register
 * Public endpoint. Accepts { name, email, password, role? }.
 * role defaults to 'owner'. 'admin' role cannot be self-assigned in production
 * (only allowed if NODE_ENV !== 'production' for initial seeding).
 *
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password, role = 'owner' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'name, email, and password are required.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }
        if (!['admin', 'owner'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Role must be admin or owner for self-registration.' });
        }
        // Prevent self-assigning admin in production.
        if (role === 'admin' && process.env.NODE_ENV === 'production') {
            return res.status(403).json({ success: false, message: 'Admin accounts must be created by an existing admin.' });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = userModel.createUser({ name, email: email.toLowerCase(), password_hash, role });

        if (role === 'owner') {
            const db = require('../config/db');
            db.prepare(`INSERT INTO shop_settings (owner_id, shop_name) VALUES (?, ?)`).run(user.id, `${name}'s Shop`);
        }

        const token = signToken(user);

        return res.status(201).json({ success: true, message: 'Account created.', data: { user, token } });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ success: false, message: 'An account with that email already exists.' });
        }
        next(err);
    }
};

/**
 * login
 * Returns a JWT on success. Same error message for bad email and bad password
 * to prevent user enumeration.
 *
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'email and password are required.' });
        }

        const user = userModel.findUserByEmail(email.toLowerCase());
        const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

        if (!user || !valid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const { password_hash: _removed, ...safeUser } = user;
        const token = signToken(safeUser);

        return res.status(200).json({ success: true, message: 'Login successful.', data: { user: safeUser, token } });
    } catch (err) {
        next(err);
    }
};

/**
 * getProfile — returns the authenticated user's profile.
 * @route GET /api/auth/profile
 */
const getProfile = (req, res) => {
    const user = userModel.findUserById(req.user.id);
    return res.status(200).json({ success: true, data: user });
};

module.exports = { register, login, getProfile };
