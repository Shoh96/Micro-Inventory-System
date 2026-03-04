/**
 * FILE: server/controllers/authController.js
 *
 * PURPOSE:
 *   Handles user registration and login.
 *   Validates input, hashes passwords with bcrypt, and issues JWTs.
 *
 * EXPORTS:
 *   register — POST /api/auth/register
 *   login    — POST /api/auth/login
 *
 * HOW IT FITS:
 *   Called by authRoutes.js.
 *   Delegates DB work to userModel.js.
 */

'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

// Number of bcrypt salt rounds.
// 12 is a good balance between security and performance on modest hardware.
const SALT_ROUNDS = 12;

/**
 * register
 * Creates a new shop-owner account.
 *
 * Validation:
 *   - name, email, password are required.
 *   - Password must be at least 8 characters.
 *   - If the email already exists the DB will throw a UNIQUE error;
 *     we catch it and return a 409 Conflict.
 *
 * @route  POST /api/auth/register
 * @access Public
 * @param {import('express').Request}  req - body: { name, email, password }
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // ── Input validation ────────────────────────────────────────────────────
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'name, email, and password are required.',
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters.',
            });
        }

        // Basic email format check (full validation is done at the DB UNIQUE constraint level).
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.',
            });
        }

        // ── Hash password ───────────────────────────────────────────────────────
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // ── Persist user ────────────────────────────────────────────────────────
        const user = userModel.createUser({ name, email: email.toLowerCase(), password_hash });

        // ── Issue JWT ───────────────────────────────────────────────────────────
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
        );

        return res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            data: { user, token },
        });
    } catch (err) {
        // better-sqlite3 surfaces UNIQUE constraint violations as a generic Error
        // with a message containing "UNIQUE constraint failed".
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                success: false,
                message: 'An account with that email address already exists.',
            });
        }
        next(err);
    }
};

/**
 * login
 * Authenticates an existing shop owner and returns a JWT.
 *
 * Security note:
 *   We deliberately send the same generic error for "email not found"
 *   and "wrong password" to prevent user-enumeration attacks.
 *
 * @route  POST /api/auth/login
 * @access Public
 * @param {import('express').Request}  req - body: { email, password }
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'email and password are required.',
            });
        }

        // Look up the account — includes the password_hash column.
        const user = userModel.findUserByEmail(email.toLowerCase());

        // Use constant-time comparison via bcrypt.compare even when user is not
        // found to avoid timing-based user-enumeration.
        const passwordIsValid = user
            ? await bcrypt.compare(password, user.password_hash)
            : false;

        if (!user || !passwordIsValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
            });
        }

        // Sign a new token.
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
        );

        // Return user without the password_hash.
        const { password_hash: _removed, ...safeUser } = user;

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            data: { user: safeUser, token },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login };
