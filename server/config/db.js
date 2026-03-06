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
    branch_id     INTEGER,  -- populated for clerks assigned to a branch
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

  -- ── Shops ────────────────────────────────────────────────────────────────────
  -- An owner can have multiple shops. Each shop has its own configuration.
  -- Products/sales/categories/suppliers are still owner-scoped (shared pool).
  CREATE TABLE IF NOT EXISTS shops (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                    TEXT    NOT NULL DEFAULT 'My Shop',
    address                 TEXT    DEFAULT '',
    currency                TEXT    NOT NULL DEFAULT 'XAF',
    low_stock_threshold     INTEGER NOT NULL DEFAULT 10,
    tax_percentage          REAL    NOT NULL DEFAULT 0,
    allow_admin_visibility  INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Branches ─────────────────────────────────────────────────────────────────
  -- Each shop can have one or more branches.
  -- shop_id links branch to its parent shop.
  -- Clerks are assigned to a branch via users.branch_id.
  CREATE TABLE IF NOT EXISTS branches (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id    INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    address    TEXT    DEFAULT '',
    phone      TEXT    DEFAULT '',
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(shop_id, name)
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
  -- ── Shop Settings (legacy — kept for migration only; new code uses shops table) ─
  CREATE TABLE IF NOT EXISTS shop_settings (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id                INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    shop_name               TEXT    NOT NULL DEFAULT 'My Shop',
    shop_address            TEXT    DEFAULT '',
    currency                TEXT    NOT NULL DEFAULT 'XAF',
    low_stock_threshold     INTEGER NOT NULL DEFAULT 10,
    tax_percentage          REAL    NOT NULL DEFAULT 0,
    logo_url                TEXT    DEFAULT '',
    enable_low_stock_alerts INTEGER NOT NULL DEFAULT 1,
    enable_sales_summary    INTEGER NOT NULL DEFAULT 1,
    allow_admin_visibility  INTEGER NOT NULL DEFAULT 0,
    updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Safe Migrations (run on every startup, all idempotent) ─────────────────
const migrations = [
  // Legacy migrations
  `ALTER TABLE shop_settings ADD COLUMN allow_admin_visibility INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN branch_id INTEGER`,
  // New shops table
  `CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'My Shop',
    address TEXT DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'XAF',
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    tax_percentage REAL NOT NULL DEFAULT 0,
    allow_admin_visibility INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  // shop_id on branches
  `ALTER TABLE branches ADD COLUMN shop_id INTEGER`,
  `ALTER TABLE branches ADD COLUMN owner_id INTEGER`,
];
migrations.forEach(sql => { try { db.prepare(sql).run(); } catch (_) { } });

// Seed shops from legacy shop_settings if shops table is empty
try {
  const shopCount = db.prepare('SELECT COUNT(*) as c FROM shops').get().c;
  if (shopCount === 0) {
    const settings = db.prepare('SELECT * FROM shop_settings').all();
    const insertShop = db.prepare(
      `INSERT INTO shops (owner_id, name, currency, low_stock_threshold, tax_percentage, allow_admin_visibility)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const updateBranch = db.prepare('UPDATE branches SET shop_id = ?, owner_id = ? WHERE owner_id = ?');
    settings.forEach(s => {
      const info = insertShop.run(s.owner_id, s.shop_name || 'My Shop', s.currency || 'XAF',
        s.low_stock_threshold || 10, s.tax_percentage || 0, s.allow_admin_visibility || 0);
      updateBranch.run(info.lastInsertRowid, s.owner_id, s.owner_id);
    });
  } else {
    // Backfill shop_id on branches that have owner_id but no shop_id
    const orphans = db.prepare('SELECT DISTINCT owner_id FROM branches WHERE shop_id IS NULL').all();
    orphans.forEach(({ owner_id }) => {
      const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ? LIMIT 1').get(owner_id);
      if (shop) db.prepare('UPDATE branches SET shop_id = ?, owner_id = ? WHERE owner_id = ? AND shop_id IS NULL')
        .run(shop.id, owner_id, owner_id);
    });
  }
} catch (_) { }

module.exports = db;

