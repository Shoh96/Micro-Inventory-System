/**
 * FILE: server/models/saleModel.js
 *
 * PURPOSE:
 *   All database operations relating to the `sales` table.
 *   Keeps query logic out of the controller.
 *
 * EXPORTS:
 *   createSale    — insert a new sale record
 *   getSalesByOwner — retrieve sale history for an owner
 *
 * HOW IT FITS:
 *   Imported by saleController.js.
 *   The actual stock deduction is handled by productModel.deductStock,
 *   called within the same DB transaction in the controller.
 */

'use strict';

const db = require('../config/db');

/**
 * createSale
 * Inserts a completed sale transaction into the `sales` table.
 * The cost_price_at_sale is captured here so profit history remains
 * accurate even if the product's cost price is edited later.
 *
 * @param {object} saleData
 * @param {number} saleData.owner_id              - FK to the owning user.
 * @param {number} saleData.product_id            - FK to the product sold.
 * @param {number} saleData.quantity_sold         - Number of units sold.
 * @param {number} saleData.selling_price_at_sale - Unit selling price at time of sale.
 * @param {number} saleData.cost_price_at_sale    - Unit cost price at time of sale.
 * @param {number} saleData.total_profit          - Pre-calculated total profit for this sale.
 *
 * @returns {object} The complete newly-created sale row.
 */
const createSale = ({
    owner_id,
    product_id,
    quantity_sold,
    selling_price_at_sale,
    cost_price_at_sale,
    total_profit,
}) => {
    const info = db.prepare(`
    INSERT INTO sales
      (owner_id, product_id, quantity_sold, selling_price_at_sale, cost_price_at_sale, total_profit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
        owner_id,
        product_id,
        quantity_sold,
        selling_price_at_sale,
        cost_price_at_sale,
        total_profit,
    );

    // Return the full row so the controller can pass it back to the client.
    return db.prepare('SELECT * FROM sales WHERE id = ?').get(info.lastInsertRowid);
};

/**
 * getSalesByOwner
 * Retrieves all sales for a given owner, joined with the product name
 * for display purposes.  Ordered from newest to oldest.
 *
 * JOIN explanation:
 *   We left-join products because a product could have been deleted after
 *   the sale was recorded.  In that case, product_name will be NULL and
 *   we surface it as "(deleted product)" in the query alias.
 *
 * @param {number} ownerId - The authenticated user's id.
 * @returns {object[]} Array of enriched sale rows.
 */
const getSalesByOwner = (ownerId) =>
    db.prepare(`
    SELECT
      s.*,
      COALESCE(p.name, '(deleted product)') AS product_name
    FROM sales s
    LEFT JOIN products p ON s.product_id = p.id
    WHERE s.owner_id = ?
    ORDER BY s.sale_date DESC
  `).all(ownerId);

module.exports = { createSale, getSalesByOwner };
