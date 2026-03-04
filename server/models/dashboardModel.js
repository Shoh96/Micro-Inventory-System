/**
 * FILE: server/models/dashboardModel.js
 *
 * PURPOSE:
 *   Aggregation queries that power the dashboard metrics endpoint.
 *   All calculations happen inside SQLite to minimise data transferred
 *   over the application layer.
 *
 * EXPORTS:
 *   getDashboardMetrics — single function returning all KPI values
 *
 * HOW IT FITS:
 *   Imported by dashboardController.js.
 *   Returns a single object so the controller has one clear data source.
 */

'use strict';

const db = require('../config/db');
const { LOW_STOCK_THRESHOLD } = require('./productModel');

/**
 * getDashboardMetrics
 * Runs three parallel SQL aggregations and returns a consolidated metrics
 * object for display on the owner's dashboard.
 *
 * Queries explained:
 *
 *  1. inventoryQuery
 *     SUM(cost_price * quantity)    → total stock value at cost (what is tied up in inventory)
 *     SUM(selling_price * quantity) → potential revenue if all stock is sold
 *     COUNT(*)                      → total number of distinct products
 *     All scoped to owner_id.
 *
 *  2. salesQuery
 *     SUM(total_profit)             → cumulative profit across all recorded sales
 *     SUM(quantity_sold * selling_price_at_sale) → total revenue recorded
 *     COUNT(*)                      → total number of sale transactions
 *     All scoped to owner_id.
 *
 *  3. lowStockQuery
 *     COUNT(*)                      → number of products at or below LOW_STOCK_THRESHOLD
 *
 * @param {number} ownerId - The authenticated user's id.
 * @returns {object} A flat metrics object:
 *   {
 *     total_stock_value,      // current inventory cost value
 *     potential_revenue,      // if all current stock were sold
 *     total_products,         // number of distinct products
 *     total_profit,           // cumulative realised profit
 *     total_revenue,          // cumulative sales revenue
 *     total_sales,            // number of sale transactions
 *     low_stock_count         // products needing restocking
 *   }
 */
const getDashboardMetrics = (ownerId) => {
    // ── 1. Inventory aggregation ──────────────────────────────────────────────
    const inventoryQuery = db.prepare(`
    SELECT
      COALESCE(SUM(cost_price * quantity),    0) AS total_stock_value,
      COALESCE(SUM(selling_price * quantity), 0) AS potential_revenue,
      COUNT(*)                                   AS total_products
    FROM products
    WHERE owner_id = ?
  `).get(ownerId);

    // ── 2. Sales aggregation ─────────────────────────────────────────────────
    const salesQuery = db.prepare(`
    SELECT
      COALESCE(SUM(total_profit),                            0) AS total_profit,
      COALESCE(SUM(quantity_sold * selling_price_at_sale),   0) AS total_revenue,
      COUNT(*)                                                   AS total_sales
    FROM sales
    WHERE owner_id = ?
  `).get(ownerId);

    // ── 3. Low-stock count ───────────────────────────────────────────────────
    const lowStockQuery = db.prepare(`
    SELECT COUNT(*) AS low_stock_count
    FROM products
    WHERE owner_id = ? AND quantity <= ?
  `).get(ownerId, LOW_STOCK_THRESHOLD);

    // Merge all three result rows into one flat object.
    return {
        ...inventoryQuery,
        ...salesQuery,
        ...lowStockQuery,
        low_stock_threshold: LOW_STOCK_THRESHOLD,
    };
};

module.exports = { getDashboardMetrics };
