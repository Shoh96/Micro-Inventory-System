/**
 * FILE: server/app.js
 *
 * PURPOSE:
 *   Application entry point for the Community Micro-Inventory System API.
 *   Configures Express, mounts middleware and all route groups, and starts
 *   the HTTP server.
 *
 * HOW IT FITS:
 *   This is the file referenced by the "main" field in package.json and
 *   the target of `npm start` / `npm run dev`.
 *
 * DESIGN DECISIONS:
 *   - dotenv is loaded first so environment variables are available to
 *     all subsequent require() calls (including db.js).
 *   - CORS is configured via the CLIENT_ORIGIN environment variable so
 *     the same codebase can serve both local development and production.
 *   - The 404 handler is placed after all routes but before the error
 *     handler so it only fires when no route matched.
 *   - The error handler is always last — Express identifies it by its
 *     four-argument signature (err, req, res, next).
 */

'use strict';

// Load environment variables from .env file before anything else.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes.
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Import centralised error handler.
const { errorHandler } = require('./middleware/errorHandler');

// Initialise the database (creates tables if they don't exist).
// This is done at startup so the app fails fast if the DB path is invalid.
require('./config/db');

// ── Express application ───────────────────────────────────────────────────────
const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow the front-end origin defined in .env to call this API.
// In production, set CLIENT_ORIGIN to your deployed frontend URL.
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
// Parse incoming JSON bodies (required for POST/PUT handlers).
app.use(express.json());

// ── Static frontend serving ───────────────────────────────────────────────────
// When deployed, the Express server can serve the client/ directory directly.
// In local development, you can use VS Code Live Server instead.
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
// Simple endpoint used by deployment platforms (Render, Railway, etc.)
// to verify the server is running.
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────
// Catches any request that did not match a defined route.
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found.`,
    });
});

// ── Centralised Error Handler ─────────────────────────────────────────────────
// Must be registered last. Express recognises the four-argument signature.
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    // A single startup log is acceptable here — it is not a debugging console.log.
    process.stdout.write(
        `[server] Community Micro-Inventory API running on port ${PORT}\n`,
    );
});

module.exports = app; // exported for potential integration testing
