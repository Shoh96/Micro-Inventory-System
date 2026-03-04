/**
 * FILE: server/models/sale.js (V2)
 *
 * PURPOSE:
 *   Database operations for the `sales` table.
 *   V2 adds discount, tax_rate, clerk_id, total_revenue columns.
 *
 * EXPORTS:
 *   createSale, getSalesByOwner
 */

'use strict';

const db = require('../config/db');

/**
 * createSale
 * @param {object} d
 * @param {number} d.owner_id
 * @param {number} d.product_id
 * @param {number} d.clerk_id
 * @param {number} d.quantity_sold
 * @param {number} d.selling_price_at_sale
 * @param {number} d.cost_price_at_sale
 * @param {number} d.discount        — total discount amount for the transaction
 * @param {number} d.tax_rate        — fractional rate e.g. 0.1925 for 19.25% VAT
 * @param {number} d.total_revenue   — pre-calculated gross revenue after tax and discount
 * @param {number} d.total_profit    — pre-calculated net profit
 */
const createSale = (d) => {
    const info = db.prepare(`
    INSERT INTO sales
      (owner_id, product_id, clerk_id, quantity_sold,
       selling_price_at_sale, cost_price_at_sale,
       discount, tax_rate, total_revenue, total_profit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
        d.owner_id, d.product_id, d.clerk_id, d.quantity_sold,
        d.selling_price_at_sale, d.cost_price_at_sale,
        d.discount, d.tax_rate, d.total_revenue, d.total_profit,
    );
    return db.prepare('SELECT * FROM sales WHERE id = ?').get(info.lastInsertRowid);
};

/**
 * getSalesByOwner
 * Joins products (for name) and users (for clerk name).
 * LEFT JOIN products because a product may have been deleted after the sale.
 * LEFT JOIN users because a clerk may have been deactivated.
 *
 * @param {number} ownerId
 * @param {number} [limit=200]
 */
const getSalesByOwner = (ownerId, limit = 200) =>
    db.prepare(`
    SELECT
      s.*,
      COALESCE(p.name, '(deleted product)') AS product_name,
      COALESCE(u.name, '(unknown clerk)')   AS clerk_name
    FROM sales s
    LEFT JOIN products p ON s.product_id = p.id
    LEFT JOIN users    u ON s.clerk_id   = u.id
    WHERE s.owner_id = ?
    ORDER BY s.sale_date DESC
    LIMIT ?
  `).all(ownerId, limit);

module.exports = { createSale, getSalesByOwner };
