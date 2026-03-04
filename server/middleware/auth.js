/**
 * FILE: server/middleware/auth.js
 *
 * PURPOSE:
 *   Express middleware that validates a JWT passed in the Authorization
 *   header and attaches the decoded payload to req.user.
 *
 * EXPORTS:
 *   authenticate — Express middleware function (req, res, next)
 *
 * HOW IT FITS:
 *   Imported by all protected route files (products, sales, dashboard).
 *   Applied to individual routes or entire routers that require a
 *   logged-in user.
 *
 * SECURITY REASONING:
 *   - Tokens are signed with HS256 using a secret loaded from the
 *     environment; the secret never travels over the wire.
 *   - We only accept tokens in the standard "Bearer <token>" format.
 *   - If the token is missing, malformed, or expired, a 401 is returned
 *     immediately and next() is never called, protecting downstream handlers.
 *   - The owner_id embedded in the token is used inside controllers to
 *     scope all database queries to the authenticated user, preventing
 *     one user from accessing another user's data.
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * authenticate
 *
 * @param {import('express').Request}  req  - Express request object.
 *        Expects req.headers.authorization = "Bearer <jwt>"
 * @param {import('express').Response} res  - Express response object.
 * @param {import('express').NextFunction} next - Calls the next middleware.
 *
 * @returns {void}  Calls next() on success; sends a 401 JSON response on failure.
 *
 * Side-effect: attaches req.user = { id, email, name, iat, exp } on success.
 */
const authenticate = (req, res, next) => {
    // Extract the Authorization header.
    const authHeader = req.headers.authorization;

    // Reject requests that have no Authorization header or that do not
    // follow the "Bearer <token>" convention.
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No token provided.',
        });
    }

    // Isolate the token string after "Bearer ".
    const token = authHeader.split(' ')[1];

    try {
        // Verify signature and expiry.  jwt.verify throws on failure.
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach the full decoded payload as req.user so controllers can use
        // decoded.id to scope their queries without touching the database again.
        req.user = decoded;

        next();
    } catch (err) {
        // TokenExpiredError or JsonWebTokenError — both are authentication failures.
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Please log in again.',
        });
    }
};

module.exports = { authenticate };
