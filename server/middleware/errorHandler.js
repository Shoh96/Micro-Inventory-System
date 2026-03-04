/**
 * FILE: server/middleware/errorHandler.js
 *
 * PURPOSE:
 *   Centralised Express error-handling middleware.
 *   Catches all errors forwarded via next(err) from any route or controller
 *   and returns a consistent JSON error envelope to the client.
 *
 * EXPORTS:
 *   errorHandler — Express error middleware (err, req, res, next)
 *
 * HOW IT FITS:
 *   Registered as the LAST middleware in app.js, after all routes.
 *   Controllers call next(err) or next(new Error(...)) to delegate here.
 *
 * DESIGN DECISION:
 *   - In production (NODE_ENV=production) we suppress the raw error stack
 *     to avoid leaking implementation details to clients.
 *   - Operational errors (e.g., validation failures) that intentionally
 *     carry a `statusCode` property are forwarded with that code.
 *   - Unrecognised errors fall back to HTTP 500.
 */

'use strict';

/**
 * errorHandler
 *
 * @param {Error}                      err  - The error object forwarded by next(err).
 *        May carry a `.statusCode` property set by the throwing code.
 * @param {import('express').Request}  req  - Express request (unused but required by Express).
 * @param {import('express').Response} res  - Express response.
 * @param {import('express').NextFunction} next - Required by Express to identify this as error middleware.
 *
 * @returns {void}  Always sends a JSON response; never calls next().
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    // Use the status code attached to the error object, or default to 500.
    const statusCode = err.statusCode || 500;

    // Only expose the raw stack trace in non-production environments.
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
        success: false,
        message: err.message || 'An unexpected server error occurred.',
        // Include the stack in development so engineers can debug quickly.
        ...(isProduction ? {} : { stack: err.stack }),
    });
};

module.exports = { errorHandler };
