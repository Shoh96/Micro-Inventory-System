/**
 * FILE: server/middleware/auth.js (V2)
 *
 * PURPOSE:
 *   Validates the JWT Bearer token on every protected request.
 *   Attaches the decoded payload (id, email, name, role) to req.user.
 *
 * EXPORTS:
 *   authenticate — Express middleware (req, res, next)
 *
 * SECURITY:
 *   - Only Bearer scheme accepted.
 *   - Expired or tampered tokens return 401 immediately.
 *   - The decoded `id` and `role` are used downstream for both ownership
 *     scoping and role-based access checks.
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * authenticate
 * @param {Request}  req - Must carry Authorization: Bearer <jwt>
 * @param {Response} res
 * @param {Function} next
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid or expired token. Please log in again.' });
    }
};

module.exports = { authenticate };
