/**
 * FILE: server/controllers/saleController.js
 *
 * PURPOSE:
 *   Handles recording a sale transaction and retrieving sale history.
 *   Uses a database transaction to ensure that the sale record and the
 *   stock deduction either both succeed or both fail (atomicity).
 *
 * EXPORTS:
 *   recordSale — POST /api/sales
 *   getSales   — GET  /api/sales
 *
 * HOW IT FITS:
 *   Called by saleRoutes.js.
 *   Delegates DB work to saleModel.js and productModel.js.
 *   Uses calculateSaleProfit from utils/calculations.js.
 */

'use strict';

const db = require('../config/db');
const saleModel = require('../models/saleModel');
const productModel = require('../models/productModel');
const { calculateSaleProfit } = require('../utils/calculations');

/**
 * recordSale
 * Records a sale and deducts stock from the product atomically.
 *
 * Business rules enforced:
 *   1. The product must exist and belong to the authenticated owner.
 *   2. quantity_sold must be a positive integer.
 *   3. quantity_sold must not exceed the product's current stock.
 *      This prevents selling items that are not physically available.
 *
 * Transaction design:
 *   better-sqlite3 provides synchronous transactions.  We wrap both the
 *   INSERT into sales and the UPDATE to products inside a single
 *   db.transaction() call so the database is never left in a partial state.
 *
 * @route  POST /api/sales
 * @access Private
 * @body   { product_id, quantity_sold }
 */
const recordSale = (req, res, next) => {
    try {
        const { product_id, quantity_sold } = req.body;

        // ── Input validation ────────────────────────────────────────────────────
        if (!product_id || !quantity_sold) {
            return res.status(400).json({
                success: false,
                message: 'product_id and quantity_sold are required.',
            });
        }

        const qty = parseInt(quantity_sold, 10);
        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'quantity_sold must be a positive integer.',
            });
        }

        // ── Fetch the product (also verifies ownership) ─────────────────────────
        const product = productModel.getProductById(
            parseInt(product_id, 10),
            req.user.id,
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found.',
            });
        }

        // ── Stock availability check ────────────────────────────────────────────
        // Prevent recording a sale if there is insufficient stock.
        if (product.quantity < qty) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Available: ${product.quantity}, requested: ${qty}.`,
            });
        }

        // ── Atomic transaction ──────────────────────────────────────────────────
        // Calculate profit using the current prices.
        const totalProfit = calculateSaleProfit(
            product.selling_price,
            product.cost_price,
            qty,
        );

        // Wrap both writes in a transaction so they are always consistent.
        const sale = db.transaction(() => {
            // 1. Insert the sale record (captures prices at time of sale).
            const newSale = saleModel.createSale({
                owner_id: req.user.id,
                product_id: product.id,
                quantity_sold: qty,
                selling_price_at_sale: product.selling_price,
                cost_price_at_sale: product.cost_price,
                total_profit: totalProfit,
            });

            // 2. Deduct stock from the product.
            productModel.deductStock(product.id, qty, req.user.id);

            return newSale;
        })();

        return res.status(201).json({
            success: true,
            message: 'Sale recorded successfully.',
            data: sale,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * getSales
 * Returns the full sale history for the authenticated owner.
 * Results are joined with the product name for display purposes.
 *
 * @route  GET /api/sales
 * @access Private
 */
const getSales = (req, res, next) => {
    try {
        const sales = saleModel.getSalesByOwner(req.user.id);
        return res.status(200).json({ success: true, data: sales });
    } catch (err) {
        next(err);
    }
};

module.exports = { recordSale, getSales };
