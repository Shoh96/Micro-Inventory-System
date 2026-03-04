/**
 * FILE: server/utils/stockPredictor.js
 *
 * PURPOSE:
 *   Predicts how many days of stock remain for each product, based on
 *   average daily sales velocity over a configurable lookback window.
 *
 * ALGORITHM:
 *   1. Sum units sold per product over the last N days.
 *   2. Divide by N to get average daily velocity (units/day).
 *   3. Divide current quantity by daily velocity → days until stock-out.
 *   4. If velocity is 0 (no recent sales), days_remaining is set to Infinity.
 *
 * EXPORTS:
 *   predictStockDepletion — returns enriched product rows with prediction
 *
 * HOW IT FITS:
 *   Called by analyticsController for the low-stock analytics endpoint.
 *   Result is also used to generate restock recommendations.
 */

'use strict';

const db = require('../config/db');

/**
 * predictStockDepletion
 * @param {number} ownerId   — scope to this owner's products
 * @param {number} days      — lookback window (default: 30 days)
 * @returns {object[]} Products with added fields:
 *   - avg_daily_sales  : average units sold per day over the window
 *   - days_remaining   : estimated days until stockout (null if no sales data)
 *   - restock_needed   : true if days_remaining < 7
 */
const predictStockDepletion = (ownerId, days = 30) => {
    // ── Step 1: Sales velocity query ─────────────────────────────────────────
    // SUM(quantity_sold) grouped by product_id for the past `days` days.
    // We use a CTE (Common Table Expression) for clarity.
    //
    // CTE explanation:
    //   velocity — calculates total_sold per product in the lookback window.
    //   Main query — joins velocity back to products to compute the prediction.
    //   COALESCE(v.total_sold, 0) ensures products with no recent sales are included.
    const rows = db.prepare(`
    WITH velocity AS (
      SELECT
        product_id,
        SUM(quantity_sold) AS total_sold
      FROM sales
      WHERE owner_id = ?
        AND sale_date >= datetime('now', ? || ' days')
      GROUP BY product_id
    )
    SELECT
      p.id,
      p.name,
      p.quantity,
      p.selling_price,
      p.cost_price,
      COALESCE(v.total_sold, 0)       AS total_sold_in_window,
      ROUND(COALESCE(v.total_sold, 0) * 1.0 / ?, 2) AS avg_daily_sales
    FROM products p
    LEFT JOIN velocity v ON p.id = v.product_id
    WHERE p.owner_id = ?
    ORDER BY avg_daily_sales DESC
  `).all(ownerId, `-${days}`, days, ownerId);

    // ── Step 2: Calculate days_remaining in JavaScript ────────────────────────
    // SQLite doesn't handle division by zero or Infinity cleanly,
    // so we compute the final prediction here.
    return rows.map((row) => {
        const daysRemaining = row.avg_daily_sales > 0
            ? Math.floor(row.quantity / row.avg_daily_sales)
            : null; // null means "no sales data — cannot predict"

        return {
            ...row,
            days_remaining: daysRemaining,
            restock_needed: daysRemaining !== null && daysRemaining < 7,
        };
    });
};

module.exports = { predictStockDepletion };
