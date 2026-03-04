/**
 * FILE: server/config/db.js (V2)
 *
 * PURPOSE:
 *   Opens the SQLite database and bootstraps the V2 schema on first run.
 *   V2 adds: categories, suppliers, activity_log, and extended columns on
 *   products (category_id, supplier_id, batch_number, serial_number, expiry_date)
 *   and sales (discount, tax_rate, clerk_id) and users (role, owner_id).
 *
 * EXPORTS:
 *   db — synchronous better-sqlite3 Database instance used by all models.
 *
 * DESIGN:
 *   All CREATE TABLE statements use IF NOT EXISTS so the file is safe to run
 *   multiple times (no migration runner required in development/demo contexts).
 *   WAL mode and foreign keys are always enabled for safety and performance.
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Resolve DB path from env or use a sensible default.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'inventory.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

// Enable WAL for better concurrency; enable FK enforcement (off by default in SQLite).
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema bootstrap ────────────────────────────────────────────────────────
db.exec(`
  -- ── Users ─────────────────────────────────────────────────────────────────
  -- role: 'admin' | 'owner' | 'clerk'
  -- owner_id: for clerks, points to the shop owner they belong to (NULL for admin/owner).
  -- is_active: allows soft-deactivation without losing data.
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'owner' CHECK(role IN ('admin','owner','clerk')),
    owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Categories ─────────────────────────────────────────────────────────────
  -- Belongs to an owner so each shop has its own category list.
  CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(owner_id, name)
  );

  -- ── Suppliers ──────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS suppliers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    contact_info TEXT    DEFAULT '',
    email        TEXT    DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Products ───────────────────────────────────────────────────────────────
  -- Extended vs V1: category_id, supplier_id, batch_number, serial_number, expiry_date.
  -- category_id and supplier_id use REFERENCES with SET NULL so deleting a category
  -- or supplier does not cascade-delete all the products.
  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id   INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    name          TEXT    NOT NULL,
    description   TEXT    DEFAULT '',
    batch_number  TEXT    DEFAULT '',
    serial_number TEXT    DEFAULT '',
    expiry_date   TEXT    DEFAULT NULL,
    quantity      INTEGER NOT NULL DEFAULT 0,
    cost_price    REAL    NOT NULL DEFAULT 0,
    selling_price REAL    NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Sales ──────────────────────────────────────────────────────────────────
  -- Extended vs V1: discount (absolute amount in currency), tax_rate (0–1 fraction),
  -- clerk_id (who recorded the sale).
  -- total_profit = (selling_price_at_sale * (1 + tax_rate) - discount/qty - cost_price_at_sale) * qty
  -- Exact formula is enforced in the controller; this table just stores the result.
  CREATE TABLE IF NOT EXISTS sales (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id            INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    clerk_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
    quantity_sold         INTEGER NOT NULL,
    selling_price_at_sale REAL    NOT NULL,
    cost_price_at_sale    REAL    NOT NULL,
    discount              REAL    NOT NULL DEFAULT 0,
    tax_rate              REAL    NOT NULL DEFAULT 0,
    total_revenue         REAL    NOT NULL,
    total_profit          REAL    NOT NULL,
    sale_date             TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Activity Log ───────────────────────────────────────────────────────────
  -- Immutable audit trail. Every write action (create/update/delete) appended here.
  -- entity_type: 'product' | 'sale' | 'user' | 'category' | 'supplier'
  -- detail: free-form JSON string with before/after snapshot or description.
  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name   TEXT    NOT NULL DEFAULT '',
    action      TEXT    NOT NULL,
    entity_type TEXT    NOT NULL,
    entity_id   INTEGER,
    detail      TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
