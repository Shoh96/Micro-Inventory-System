/**
 * FILE: server/controllers/salesController.js (V2)
 *
 * PURPOSE:
 *   Records sales with discount and tax, deducts stock atomically,
 *   logs the activity, and returns the enriched sale record.
 *
 * EXPORTS:
 *   recordSale, getSales
 */

'use strict';

const db = require('../config/db');
const saleModel = require('../models/sale');
const productModel = require('../models/product');
const { logActivity } = require('../models/activityLog');
const { calculateSaleFinancials } = require('../utils/calculations');

// Helper: resolve ownerId for clerks.
const resolveOwnerId = (user) => (user.role === 'clerk' ? user.owner_id : user.id);

/**
 * recordSale
 * Business rules:
 *   1. Product must exist and belong to the owner (or owner's shop).
 *   2. quantity_sold must be positive.
 *   3. Stock must be sufficient.
 *   4. discount must be >= 0 and < total gross revenue.
 *   5. tax_rate must be >= 0.
 *
 * Both the sale INSERT and the stock UPDATE happen inside a single transaction.
 *
 * @route POST /api/sales
 * @body  { product_id, quantity_sold, discount?, tax_rate? }
 */
const recordSale = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const { product_id, quantity_sold, discount = 0, tax_rate = 0 } = req.body;

        if (!product_id || !quantity_sold) {
            return res.status(400).json({ success: false, message: 'product_id and quantity_sold are required.' });
        }

        const qty = parseInt(quantity_sold, 10);
        const disc = parseFloat(discount) || 0;
        const taxRate = parseFloat(tax_rate) || 0;

        if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ success: false, message: 'quantity_sold must be a positive integer.' });
        }
        if (disc < 0 || taxRate < 0) {
            return res.status(400).json({ success: false, message: 'discount and tax_rate cannot be negative.' });
        }

        const product = productModel.getProductById(parseInt(product_id, 10), ownerId);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

        if (product.quantity < qty) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock. Available: ${product.quantity}, requested: ${qty}.`,
            });
        }

        // Calculate financials using the utility function.
        const { totalRevenue, totalProfit } = calculateSaleFinancials(
            product.selling_price, product.cost_price, qty, disc, taxRate,
        );

        // Atomic transaction: insert sale + deduct stock.
        const sale = db.transaction(() => {
            const newSale = saleModel.createSale({
                owner_id: ownerId,
                product_id: product.id,
                clerk_id: req.user.id,
                quantity_sold: qty,
                selling_price_at_sale: product.selling_price,
                cost_price_at_sale: product.cost_price,
                discount: disc,
                tax_rate: taxRate,
                total_revenue: totalRevenue,
                total_profit: totalProfit,
            });
            productModel.deductStock(product.id, qty, ownerId);
            return newSale;
        })();

        logActivity({
            userId: req.user.id, userName: req.user.name,
            action: 'CREATE', entityType: 'sale', entityId: sale.id,
            detail: JSON.stringify({ product: product.name, qty, totalRevenue, totalProfit }),
        });

        return res.status(201).json({ success: true, message: 'Sale recorded.', data: sale });
    } catch (err) { next(err); }
};

/**
 * getSales — returns sale history enriched with product and clerk names.
 * Admin with no owner_id filter returns ALL sales across all owners.
 * @route GET /api/sales
 */
const getSales = (req, res, next) => {
    try {
        let sales;
        if (req.user.role === 'admin') {
            if (req.query.owner_id) {
                const ownerId = parseInt(req.query.owner_id, 10);
                sales = saleModel.getSalesByOwner(ownerId);
            } else {
                // Return all sales across all owners
                sales = saleModel.getAllSales ? saleModel.getAllSales() : saleModel.getSalesByOwner(null);
            }
        } else {
            const ownerId = resolveOwnerId(req.user);
            sales = saleModel.getSalesByOwner(ownerId);
        }
        return res.status(200).json({ success: true, data: sales || [] });
    } catch (err) { next(err); }
};

module.exports = { recordSale, getSales };
