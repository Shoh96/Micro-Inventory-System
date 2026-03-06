/**
 * FILE: server/app.js (V2)
 *
 * PURPOSE:
 *   Main Express application entry point for the V2 API.
 *   Loads env, configures middleware, mounts all routes, and starts the server.
 *
 * V2 CHANGES vs V1:
 *   - Mounts /api/users and /api/analytics in addition to auth/products/sales.
 *   - /api/products now serves categories and suppliers as sub-routes.
 *   - Static frontend served from client/ directory.
 *
 * DESIGN:
 *   - CORS is driven by CLIENT_ORIGIN env so the same codebase works locally
 *     and on Render/Railway/Fly without code changes.
 *   - The self-bootstrapping db.js is required at startup so the app fails
 *     fast if the database path is invalid or permissions are missing.
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Bootstrap database on startup (creates tables if they don't exist).
require('./config/db');

// Route modules.
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes = require('./routes/settings');
const branchRoutes = require('./routes/branches');
const shopRoutes = require('./routes/shops');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Static frontend ───────────────────────────────────────────────────────────
// In production, Express serves the client/ folder directly.
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
    res.status(200).json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() }),
);

// ── SPA fallback ──────────────────────────────────────────────────────────────
// Serves index.html for any unrecognised path so client-side routing works.
app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
});

// ── Centralised error handler (always last) ───────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    process.stdout.write(
        `[server v2] Community Micro-Inventory API running on port ${PORT}\n`,
    );
});

module.exports = app;
