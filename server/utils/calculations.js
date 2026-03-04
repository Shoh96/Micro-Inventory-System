/**
 * FILE: server/utils/calculations.js
 *
 * PURPOSE:
 *   Pure utility functions for financial calculations used throughout
 *   the system (profit per unit, inventory value, etc.).
 *   Keeping these in one place makes them easy to test and reason about.
 *
 * EXPORTS:
 *   calculateUnitProfit   — profit on a single unit
 *   calculateSaleProfit   — profit on a batch sale
 *   calculateStockValue   — total stock value of a product
 *   roundCurrency         — rounds to 2 decimal places
 *
 * HOW IT FITS:
 *   Imported by saleController.js and dashboardController.js.
 *   No database access — pure functions only.
 */

'use strict';

/**
 * roundCurrency
 * Rounds a floating-point number to two decimal places to avoid
 * floating-point representation issues in financial totals.
 *
 * @param {number} value - The raw numeric value to round.
 * @returns {number}       Value rounded to 2 d.p.
 */
const roundCurrency = (value) => Math.round(value * 100) / 100;

/**
 * calculateUnitProfit
 * Computes the profit margin on a single unit of a product.
 *
 * @param {number} sellingPrice - The price at which one unit is sold.
 * @param {number} costPrice    - The price at which one unit was purchased.
 * @returns {number}              Profit per unit (can be negative if sold at loss).
 */
const calculateUnitProfit = (sellingPrice, costPrice) =>
    roundCurrency(sellingPrice - costPrice);

/**
 * calculateSaleProfit
 * Computes the total profit for a batch sale transaction.
 *
 * @param {number} sellingPrice - The price per unit at the time of the sale.
 * @param {number} costPrice    - The cost price per unit at the time of the sale.
 * @param {number} quantitySold - Number of units sold.
 * @returns {number}              Total profit for the entire sale.
 */
const calculateSaleProfit = (sellingPrice, costPrice, quantitySold) =>
    roundCurrency((sellingPrice - costPrice) * quantitySold);

/**
 * calculateStockValue
 * Computes the current monetary value of remaining stock for a product.
 * Uses cost price because that reflects the owner's actual investment.
 *
 * @param {number} costPrice - Cost price per unit.
 * @param {number} quantity  - Current quantity in stock.
 * @returns {number}           Total stock value at cost.
 */
const calculateStockValue = (costPrice, quantity) =>
    roundCurrency(costPrice * quantity);

module.exports = {
    roundCurrency,
    calculateUnitProfit,
    calculateSaleProfit,
    calculateStockValue,
};
