/**
 * FILE: server/controllers/dashboardController.js
 *
 * PURPOSE:
 *   Aggregates and returns key business metrics for the dashboard view.
 *
 * EXPORTS:
 *   getMetrics — GET /api/dashboard/metrics
 *
 * HOW IT FITS:
 *   Called by dashboardRoutes.js.
 *   Delegates all SQL aggregations to dashboardModel.js.
 */

'use strict';

const dashboardModel = require('../models/dashboardModel');
const productModel = require('../models/productModel');

/**
 * getMetrics
 * Returns a single JSON object containing all dashboard KPIs:
 *   - total_stock_value      (cost value of remaining inventory)
 *   - potential_revenue      (if all current stock were sold at selling_price)
 *   - total_products         (number of distinct products)
 *   - total_profit           (cumulative profit from all recorded sales)
 *   - total_revenue          (cumulative revenue from all recorded sales)
 *   - total_sales            (number of sale transactions)
 *   - low_stock_count        (products needing restocking)
 *   - low_stock_threshold    (the threshold value used)
 *   - low_stock_items        (array of low-stock product rows for display)
 *
 * @route  GET /api/dashboard/metrics
 * @access Private
 */
const getMetrics = (req, res, next) => {
    try {
        // Fetch aggregated KPI values from the model.
        const metrics = dashboardModel.getDashboardMetrics(req.user.id);

        // Also fetch the list of low-stock items so the frontend can display
        // them inline in the dashboard (saves a second HTTP round-trip).
        const lowStockItems = productModel.getLowStockProducts(req.user.id);

        return res.status(200).json({
            success: true,
            data: {
                ...metrics,
                low_stock_items: lowStockItems,
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { getMetrics };
