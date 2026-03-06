/**
 * FILE: server/models/product.js (V2)
 *
 * PURPOSE:
 *   All database operations for the `products` table.
 *   Extended vs V1: LEFT JOINs to categories and suppliers for enriched reads,
 *   plus the new batch/serial/expiry fields.
 *   All queries are scoped to an owner_id for multi-tenancy.
 *
 * EXPORTS:
 *   getAllProducts, getLowStockProducts, getProductById,
 *   createProduct, updateProduct, deleteProduct, deductStock,
 *   searchProducts, LOW_STOCK_THRESHOLD
 */

'use strict';

const db = require('../config/db');
const shopSettings = require('./shopSettings');

// Shared SELECT with JOINs — used by most read functions to avoid repetition.
// LEFT JOIN means products without a category or supplier still appear.
const BASE_SELECT = `
  SELECT
    p.*,
    c.name AS category_name,
    s.name AS supplier_name,
    (p.quantity <= ?) AS is_low_stock
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN suppliers  s ON p.supplier_id  = s.id
`;

/**
 * getAllProducts
 * Returns all products for an owner with category + supplier names attached.
 * Supports optional filtering by category_id or low stock only.
 *
 * @param {number} ownerId
 * @param {{categoryId?, lowStockOnly?}} filters
 */
const getAllProducts = (ownerId, filters = {}) => {
    const threshold = shopSettings.getSettings(ownerId).low_stock_threshold;
    let sql = `${BASE_SELECT} WHERE p.owner_id = ?`;
    const args = [threshold, ownerId];

    if (filters.categoryId) {
        sql += ' AND p.category_id = ?';
        args.push(filters.categoryId);
    }
    if (filters.lowStockOnly) {
        sql += ' AND p.quantity <= ?';
        args.push(threshold);
    }

    sql += ' ORDER BY p.created_at DESC';
    return db.prepare(sql).all(...args);
};

/**
 * getLowStockProducts — products at or below the threshold.
 * @param {number} ownerId
 */
const getLowStockProducts = (ownerId) => {
    const threshold = shopSettings.getSettings(ownerId).low_stock_threshold;
    return db.prepare(`${BASE_SELECT} WHERE p.owner_id = ? AND p.quantity <= ? ORDER BY p.quantity ASC`)
        .all(threshold, ownerId, threshold);
};

/**
 * getProductById — single product, owner-scoped.
 * @param {number} productId
 * @param {number} ownerId
 */
const getProductById = (productId, ownerId) => {
    const threshold = shopSettings.getSettings(ownerId).low_stock_threshold;
    return db.prepare(`${BASE_SELECT} WHERE p.id = ? AND p.owner_id = ?`)
        .get(threshold, productId, ownerId);
};

/**
 * searchProducts — full-text search across name, description, batch, serial.
 * Uses SQLite LIKE which is case-insensitive for ASCII characters.
 *
 * @param {number} ownerId
 * @param {string} query
 */
const searchProducts = (ownerId, query) => {
    const threshold = shopSettings.getSettings(ownerId).low_stock_threshold;
    const q = `%${query}%`;
    return db.prepare(`
    ${BASE_SELECT}
    WHERE p.owner_id = ?
      AND (p.name LIKE ? OR p.description LIKE ? OR p.batch_number LIKE ? OR p.serial_number LIKE ?)
    ORDER BY p.name ASC
  `).all(threshold, ownerId, q, q, q, q);
};

/**
 * createProduct
 * @param {object} data — all product fields including owner_id
 */
const createProduct = (data) => {
    const {
        owner_id, category_id = null, supplier_id = null,
        name, description = '', batch_number = '', serial_number = '',
        expiry_date = null, quantity, cost_price, selling_price,
    } = data;

    const info = db.prepare(`
    INSERT INTO products
      (owner_id, category_id, supplier_id, name, description,
       batch_number, serial_number, expiry_date, quantity, cost_price, selling_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        owner_id, category_id, supplier_id, name, description,
        batch_number, serial_number, expiry_date, quantity, cost_price, selling_price,
    );

    return getProductById(info.lastInsertRowid, owner_id);
};

/**
 * updateProduct — dynamic update (only supplied fields are changed).
 * @param {number} productId
 * @param {number} ownerId
 * @param {object} fields
 */
const updateProduct = (productId, ownerId, fields) => {
    const allowed = [
        'name', 'description', 'category_id', 'supplier_id',
        'batch_number', 'serial_number', 'expiry_date',
        'quantity', 'cost_price', 'selling_price',
    ];
    const updates = [];
    const values = [];

    allowed.forEach((key) => {
        if (fields[key] !== undefined) {
            updates.push(`${key} = ?`);
            values.push(fields[key]);
        }
    });

    if (!updates.length) return getProductById(productId, ownerId);

    updates.push(`updated_at = datetime('now')`);
    values.push(productId, ownerId);

    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ? AND owner_id = ?`).run(...values);
    return getProductById(productId, ownerId);
};

/**
 * deleteProduct — hard delete; ON DELETE CASCADE removes related sales.
 */
const deleteProduct = (productId, ownerId) => {
    const info = db.prepare('DELETE FROM products WHERE id = ? AND owner_id = ?').run(productId, ownerId);
    return info.changes > 0;
};

/**
 * deductStock — atomic quantity decrement called inside a sale transaction.
 */
const deductStock = (productId, qty, ownerId) => {
    db.prepare(`
    UPDATE products SET quantity = quantity - ?, updated_at = datetime('now')
    WHERE id = ? AND owner_id = ?
  `).run(qty, productId, ownerId);
};

module.exports = {
    getAllProducts, getLowStockProducts, getProductById,
    createProduct, updateProduct, deleteProduct, deductStock,
    searchProducts,
};
