/**
 * FILE: server/models/productModel.js
 *
 * PURPOSE:
 *   All database operations relating to the `products` table.
 *   Every query is scoped to an owner_id to enforce multi-tenancy —
 *   a user can only see and modify their own products.
 *
 * EXPORTS:
 *   getAllProducts      — list all products for an owner
 *   getLowStockProducts — list products below a stock threshold
 *   getProductById      — fetch a single product (owner-scoped)
 *   createProduct       — insert a new product row
 *   updateProduct       — update mutable fields on a product
 *   deleteProduct       — remove a product row
 *   deductStock         — decrement quantity after a sale
 *
 * HOW IT FITS:
 *   Imported by productController.js and saleController.js.
 */

'use strict';

const db = require('../config/db');

// ── Low stock threshold ───────────────────────────────────────────────────────
// Products with quantity at or below this value are flagged as "low stock".
// Exposed as a named constant so it can easily be made configurable later.
const LOW_STOCK_THRESHOLD = 5;

/**
 * getAllProducts
 * Returns all products owned by the given user, ordered by creation date
 * (newest first), with an additional `is_low_stock` boolean column
 * calculated inline for easy frontend rendering.
 *
 * @param {number} ownerId - The authenticated user's id.
 * @returns {object[]} Array of product rows (may be empty).
 */
const getAllProducts = (ownerId) =>
    db.prepare(`
    SELECT
      *,
      (quantity <= ?) AS is_low_stock
    FROM products
    WHERE owner_id = ?
    ORDER BY created_at DESC
  `).all(LOW_STOCK_THRESHOLD, ownerId);

/**
 * getLowStockProducts
 * Returns only the products whose quantity is at or below the threshold.
 * Used by the dashboard metrics endpoint.
 *
 * @param {number} ownerId - The authenticated user's id.
 * @returns {object[]} Array of low-stock product rows.
 */
const getLowStockProducts = (ownerId) =>
    db.prepare(`
    SELECT * FROM products
    WHERE owner_id = ? AND quantity <= ?
    ORDER BY quantity ASC
  `).all(ownerId, LOW_STOCK_THRESHOLD);

/**
 * getProductById
 * Fetches a single product by id, scoped to the owner.
 * The owner_id check prevents users from accessing each other's products.
 *
 * @param {number} productId - The product's primary key.
 * @param {number} ownerId   - The authenticated user's id.
 * @returns {object|undefined} The product row, or undefined if not found / not owned.
 */
const getProductById = (productId, ownerId) =>
    db.prepare(`
    SELECT *, (quantity <= ?) AS is_low_stock
    FROM products
    WHERE id = ? AND owner_id = ?
  `).get(LOW_STOCK_THRESHOLD, productId, ownerId);

/**
 * createProduct
 * Inserts a new product row and returns the complete saved record.
 *
 * @param {object} data
 * @param {number} data.owner_id      - FK to the owning user.
 * @param {string} data.name          - Product display name.
 * @param {string} data.description   - Optional description.
 * @param {number} data.quantity      - Starting stock quantity.
 * @param {number} data.cost_price    - Unit cost price.
 * @param {number} data.selling_price - Unit selling price.
 *
 * @returns {object} The complete newly-inserted product row.
 */
const createProduct = ({ owner_id, name, description, quantity, cost_price, selling_price }) => {
    const info = db.prepare(`
    INSERT INTO products (owner_id, name, description, quantity, cost_price, selling_price)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(owner_id, name, description || '', quantity, cost_price, selling_price);

    return getProductById(info.lastInsertRowid, owner_id);
};

/**
 * updateProduct
 * Updates the mutable fields of a product.
 * updated_at is set to the current UTC timestamp by the query itself,
 * ensuring it always reflects the last DB write.
 *
 * @param {number} productId   - The product's primary key.
 * @param {number} ownerId     - The authenticated user's id (scope guard).
 * @param {object} fields      - The fields to update (all optional; unset fields are preserved).
 * @param {string} [fields.name]
 * @param {string} [fields.description]
 * @param {number} [fields.quantity]
 * @param {number} [fields.cost_price]
 * @param {number} [fields.selling_price]
 *
 * @returns {object|undefined} The updated product row, or undefined if not found.
 */
const updateProduct = (productId, ownerId, fields) => {
    // Build the SET clause dynamically so only provided fields are changed.
    // This avoids accidentally overwriting valid data with undefined values.
    const allowed = ['name', 'description', 'quantity', 'cost_price', 'selling_price'];
    const updates = [];
    const values = [];

    allowed.forEach((key) => {
        if (fields[key] !== undefined) {
            updates.push(`${key} = ?`);
            values.push(fields[key]);
        }
    });

    if (updates.length === 0) return getProductById(productId, ownerId); // nothing to change

    // Always refresh the updated_at timestamp.
    updates.push(`updated_at = datetime('now')`);

    // Append WHERE clause parameters.
    values.push(productId, ownerId);

    db.prepare(`
    UPDATE products SET ${updates.join(', ')}
    WHERE id = ? AND owner_id = ?
  `).run(...values);

    return getProductById(productId, ownerId);
};

/**
 * deleteProduct
 * Removes a product from the database.
 * The ON DELETE CASCADE on the sales table ensures related sale records
 * are also removed automatically.
 *
 * @param {number} productId - The product's primary key.
 * @param {number} ownerId   - The authenticated user's id (scope guard).
 * @returns {boolean} true if a row was deleted, false if no matching row found.
 */
const deleteProduct = (productId, ownerId) => {
    const info = db.prepare(`
    DELETE FROM products WHERE id = ? AND owner_id = ?
  `).run(productId, ownerId);

    return info.changes > 0;
};

/**
 * deductStock
 * Atomically decrements a product's quantity after a confirmed sale.
 * Called inside a transaction in saleController to ensure stock and sale
 * records are always consistent.
 *
 * @param {number} productId     - The product's primary key.
 * @param {number} quantitySold  - Number of units to deduct.
 * @param {number} ownerId       - The authenticated user's id (scope guard).
 * @returns {void}
 */
const deductStock = (productId, quantitySold, ownerId) => {
    db.prepare(`
    UPDATE products
    SET quantity    = quantity - ?,
        updated_at  = datetime('now')
    WHERE id = ? AND owner_id = ?
  `).run(quantitySold, productId, ownerId);
};

module.exports = {
    getAllProducts,
    getLowStockProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    deductStock,
    LOW_STOCK_THRESHOLD,
};
