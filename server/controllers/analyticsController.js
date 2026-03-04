/**
 * FILE: server/controllers/analyticsController.js (V2)
 *
 * PURPOSE:
 *   Generates all analytics reports: KPI summary, revenue over time,
 *   top-selling products, category breakdown, predictive stock depletion,
 *   and CSV export of any of the above.
 *
 * EXPORTS:
 *   getMetrics, getRevenueOverTime, getTopProducts,
 *   getCategoryBreakdown, getStockPredictions,
 *   exportSalesCsv, exportProductsCsv
 */

'use strict';

const db = require('../config/db');
const productModel = require('../models/product');
const { logActivity: _log } = require('../models/activityLog');
const { getActivityLog } = require('../models/activityLog');
const { predictStockDepletion } = require('../utils/stockPredictor');
const { toCsv } = require('../utils/exportHelper');
const { LOW_STOCK_THRESHOLD } = require('../models/product');

const resolveOwnerId = (user) => (user.role === 'clerk' ? user.owner_id : user.id);

/**
 * getMetrics — dashboard KPIs with low-stock list.
 * @route GET /api/analytics/metrics
 */
const getMetrics = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);

        // ── Inventory aggregation ────────────────────────────────────────────────
        const inv = db.prepare(`
      SELECT
        COALESCE(SUM(cost_price * quantity),    0) AS total_stock_value,
        COALESCE(SUM(selling_price * quantity), 0) AS potential_revenue,
        COUNT(*) AS total_products
      FROM products WHERE owner_id = ?
    `).get(ownerId);

        // ── Sales aggregation ─────────────────────────────────────────────────────
        const sal = db.prepare(`
      SELECT
        COALESCE(SUM(total_profit),  0) AS total_profit,
        COALESCE(SUM(total_revenue), 0) AS total_revenue,
        COUNT(*) AS total_sales
      FROM sales WHERE owner_id = ?
    `).get(ownerId);

        // ── Low-stock ─────────────────────────────────────────────────────────────
        const low = db.prepare(`
      SELECT COUNT(*) AS low_stock_count FROM products
      WHERE owner_id = ? AND quantity <= ?
    `).get(ownerId, LOW_STOCK_THRESHOLD);

        const lowStockItems = productModel.getLowStockProducts(ownerId);

        return res.status(200).json({
            success: true,
            data: { ...inv, ...sal, ...low, low_stock_threshold: LOW_STOCK_THRESHOLD, low_stock_items: lowStockItems },
        });
    } catch (err) { next(err); }
};

/**
 * getRevenueOverTime
 * Returns daily revenue and profit for the last N days (default 30).
 * Used by the revenue line chart on the analytics page.
 *
 * SQL explanation:
 *   date(sale_date) truncates the datetime to a date string (YYYY-MM-DD).
 *   We GROUP BY that date to get one row per day.
 *   COALESCE ensures we return 0 for days with no data (via the frontend padding).
 *
 * @route GET /api/analytics/revenue?days=30
 */
const getRevenueOverTime = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const days = parseInt(req.query.days || '30', 10);

        const rows = db.prepare(`
      SELECT
        date(sale_date)           AS sale_day,
        ROUND(SUM(total_revenue), 2) AS revenue,
        ROUND(SUM(total_profit),  2) AS profit,
        COUNT(*)                  AS transactions
      FROM sales
      WHERE owner_id = ?
        AND sale_date >= datetime('now', ? || ' days')
      GROUP BY sale_day
      ORDER BY sale_day ASC
    `).all(ownerId, `-${days}`);

        return res.status(200).json({ success: true, data: rows });
    } catch (err) { next(err); }
};

/**
 * getTopProducts
 * Returns the top N products by units sold or by revenue, for the last M days.
 * Used by the bar chart.
 *
 * @route GET /api/analytics/top-products?limit=10&days=30
 */
const getTopProducts = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const limit = parseInt(req.query.limit || '10', 10);
        const days = parseInt(req.query.days || '30', 10);

        const rows = db.prepare(`
      SELECT
        p.id,
        COALESCE(p.name, '(deleted)') AS name,
        SUM(s.quantity_sold)          AS total_qty_sold,
        ROUND(SUM(s.total_revenue),2) AS total_revenue,
        ROUND(SUM(s.total_profit), 2) AS total_profit
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.owner_id = ?
        AND s.sale_date >= datetime('now', ? || ' days')
      GROUP BY s.product_id
      ORDER BY total_qty_sold DESC
      LIMIT ?
    `).all(ownerId, `-${days}`, limit);

        return res.status(200).json({ success: true, data: rows });
    } catch (err) { next(err); }
};

/**
 * getCategoryBreakdown
 * Revenue and profit grouped by product category.
 * Used by the pie/doughnut chart.
 *
 * JOIN explanation:
 *   LEFT JOIN products for the name, then LEFT JOIN categories.
 *   Uncategorised products appear as 'Uncategorised'.
 *
 * @route GET /api/analytics/categories
 */
const getCategoryBreakdown = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);

        const rows = db.prepare(`
      SELECT
        COALESCE(c.name, 'Uncategorised')  AS category,
        SUM(s.quantity_sold)               AS total_qty,
        ROUND(SUM(s.total_revenue), 2)     AS total_revenue,
        ROUND(SUM(s.total_profit),  2)     AS total_profit
      FROM sales s
      LEFT JOIN products   p ON s.product_id  = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.owner_id = ?
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `).all(ownerId);

        return res.status(200).json({ success: true, data: rows });
    } catch (err) { next(err); }
};

/**
 * getStockPredictions — calls stockPredictor utility.
 * @route GET /api/analytics/stock-predictions?days=30
 */
const getStockPredictions = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const days = parseInt(req.query.days || '30', 10);
        const data = predictStockDepletion(ownerId, days);
        return res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
};

/**
 * getActivityLog — audit trail for the owner and their clerks.
 * @route GET /api/analytics/activity?limit=50
 */
const getLog = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const limit = parseInt(req.query.limit || '50', 10);
        return res.status(200).json({ success: true, data: getActivityLog(ownerId, limit) });
    } catch (err) { next(err); }
};

/**
 * exportSalesCsv — streams a CSV of the owner's sales.
 * Sets appropriate response headers so the browser triggers a download.
 * @route GET /api/analytics/export/sales
 */
const exportSalesCsv = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const rows = db.prepare(`
      SELECT
        s.id, date(s.sale_date) AS date,
        COALESCE(p.name,'(deleted)') AS product,
        s.quantity_sold, s.selling_price_at_sale, s.discount, s.tax_rate,
        s.total_revenue, s.total_profit
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.owner_id = ?
      ORDER BY s.sale_date DESC
    `).all(ownerId);

        const csv = toCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sales_export.csv"');
        return res.status(200).send(csv);
    } catch (err) { next(err); }
};

/**
 * exportProductsCsv — CSV of all products with stock values.
 * @route GET /api/analytics/export/products
 */
const exportProductsCsv = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const rows = db.prepare(`
      SELECT
        p.id, p.name, c.name AS category, s.name AS supplier,
        p.quantity, p.cost_price, p.selling_price,
        ROUND(p.cost_price * p.quantity, 2) AS stock_value,
        p.expiry_date, p.batch_number
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers  s ON p.supplier_id  = s.id
      WHERE p.owner_id = ?
      ORDER BY p.name ASC
    `).all(ownerId);

        const csv = toCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="products_export.csv"');
        return res.status(200).send(csv);
    } catch (err) { next(err); }
};

module.exports = {
    getMetrics, getRevenueOverTime, getTopProducts,
    getCategoryBreakdown, getStockPredictions, getLog,
    exportSalesCsv, exportProductsCsv,
};
