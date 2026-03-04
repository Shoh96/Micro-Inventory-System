/**
 * FILE: server/middleware/errorHandler.js (V2)
 *
 * PURPOSE:
 *   Centralised Express error-handling middleware.
 *   Registered last in app.js; catches all next(err) calls.
 *
 * EXPORTS:
 *   errorHandler — 4-argument Express error middleware
 */

'use strict';

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    res.status(statusCode).json({
        success: false,
        message: err.message || 'An unexpected server error occurred.',
        ...(isProduction ? {} : { stack: err.stack }),
    });
};

module.exports = { errorHandler };
