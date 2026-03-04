/**
 * FILE: server/utils/calculations.js (V2)
 *
 * PURPOSE:
 *   Pure financial calculation utilities used by controllers.
 *   V2 adds discount and tax handling to the profit formula.
 *
 * PROFIT FORMULA (per sale):
 *   grossRevenue  = sellingPrice × qty
 *   taxAmount     = grossRevenue × taxRate
 *   netRevenue    = grossRevenue + taxAmount - discount
 *   grossCost     = costPrice × qty
 *   profit        = netRevenue - grossCost
 *
 * EXPORTS:
 *   calculateSaleFinancials, calculateUnitProfit,
 *   calculateStockValue, roundCurrency
 */

'use strict';

const roundCurrency = (v) => Math.round(v * 100) / 100;

/**
 * calculateSaleFinancials
 * Returns all monetary values needed to persist a sale record.
 *
 * @param {number} sellingPrice  — unit price at time of sale
 * @param {number} costPrice     — unit cost at time of sale
 * @param {number} qty           — units sold
 * @param {number} discount      — total discount amount (not per-unit), default 0
 * @param {number} taxRate       — fractional rate (0.1925 = 19.25%), default 0
 *
 * @returns {{ totalRevenue, totalProfit }}
 */
const calculateSaleFinancials = (sellingPrice, costPrice, qty, discount = 0, taxRate = 0) => {
    const grossRevenue = sellingPrice * qty;
    const taxAmount = roundCurrency(grossRevenue * taxRate);
    const totalRevenue = roundCurrency(grossRevenue + taxAmount - discount);
    const totalCost = roundCurrency(costPrice * qty);
    const totalProfit = roundCurrency(totalRevenue - totalCost);
    return { totalRevenue, totalProfit };
};

/**
 * calculateUnitProfit — simple margin on one unit (no discount/tax).
 */
const calculateUnitProfit = (sellingPrice, costPrice) =>
    roundCurrency(sellingPrice - costPrice);

/**
 * calculateStockValue — total cost-value of remaining inventory for a product.
 */
const calculateStockValue = (costPrice, quantity) =>
    roundCurrency(costPrice * quantity);

module.exports = { roundCurrency, calculateSaleFinancials, calculateUnitProfit, calculateStockValue };
