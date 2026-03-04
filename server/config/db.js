/**
 * FILE: server/config/db.js
 *
 * PURPOSE:
 *   Initialises the SQLite database using better-sqlite3.
 *   Creates all tables if they do not already exist, so there is
 *   no separate migration step — the schema is self-bootstrapping.
 *
 * EXPORTS:
 *   db — a synchronous better-sqlite3 Database instance that can be
 *        imported by any model file to execute queries.
 *
 * HOW IT FITS:
 *   Models import `db` and call db.prepare(...).run/get/all.
 *   No connection pooling is needed; SQLite handles concurrency internally.
 */

'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Resolve the database file path from the environment ──────────────────────
// Default to /data/inventory.db relative to this file's location so the
// project works out-of-the-box without an .env file.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'inventory.db');

// Ensure the parent directory exists before opening the file.
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ── Open / create the database ───────────────────────────────────────────────
const db = new Database(dbPath);

// Enable WAL mode for better read/write concurrency and crash safety.
db.pragma('journal_mode = WAL');

// Enforce foreign-key constraints (SQLite disables them by default).
db.pragma('foreign_keys = ON');

// ── Schema bootstrap ─────────────────────────────────────────────────────────
// All CREATE TABLE statements use IF NOT EXISTS so they are idempotent.
// Running the server multiple times will not duplicate tables.

db.exec(`
  -- ── Users ────────────────────────────────────────────────────────────────
  -- Stores shop-owner accounts.
  -- password_hash is produced by bcrypt (never stored in plain text).
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Products ─────────────────────────────────────────────────────────────
  -- Each product belongs to exactly one shop owner (owner_id → users.id).
  -- cost_price and selling_price are stored in the smallest currency unit
  -- (e.g., XAF centimes) as real numbers for simplicity.
  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    description   TEXT    DEFAULT '',
    quantity      INTEGER NOT NULL DEFAULT 0,
    cost_price    REAL    NOT NULL DEFAULT 0,
    selling_price REAL    NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Sales ─────────────────────────────────────────────────────────────────
  -- Records every transaction.  selling_price_at_sale captures the price
  -- at the time of sale so that later price changes do not distort history.
  -- total_profit is (selling_price_at_sale − cost_price_at_sale) × qty and
  -- is denormalised here to make dashboard aggregations fast.
  CREATE TABLE IF NOT EXISTS sales (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id           INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_sold        INTEGER NOT NULL,
    selling_price_at_sale REAL   NOT NULL,
    cost_price_at_sale   REAL    NOT NULL,
    total_profit         REAL    NOT NULL,
    sale_date            TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
