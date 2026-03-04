/**
 * FILE: server/middleware/role.js
 *
 * PURPOSE:
 *   Role-based access control (RBAC) middleware factory.
 *   Returns an Express middleware that enforces which roles may access a route.
 *
 * EXPORTS:
 *   requireRole(...roles) — factory returning Express middleware
 *
 * HOW IT FITS:
 *   Placed after `authenticate` in route definitions:
 *     router.get('/users', authenticate, requireRole('admin'), listUsers)
 *
 * ROLE HIERARCHY (loosely enforced):
 *   admin  — full access to all routes
 *   owner  — access to their own data management
 *   clerk  — limited to recording sales and viewing products
 *
 * SECURITY REASONING:
 *   We check req.user.role (decoded from the JWT) against the allowed list.
 *   Since the JWT is signed server-side, the role cannot be forged by a client
 *   without the JWT_SECRET. A mismatch returns 403 Forbidden (not 401) because
 *   the user IS authenticated but does NOT have permission for this action.
 */

'use strict';

/**
 * requireRole
 * @param {...string} roles - One or more role strings that are permitted.
 *        e.g. requireRole('admin') or requireRole('admin', 'owner')
 * @returns {Function} Express middleware that enforces the role check.
 */
const requireRole = (...roles) => (req, res, next) => {
    // req.user is set by the authenticate middleware that must precede this one.
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Access restricted. Required role: ${roles.join(' or ')}.`,
        });
    }
    next();
};

module.exports = { requireRole };
