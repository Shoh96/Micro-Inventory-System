/**
 * FILE: server/controllers/productController.js
 *
 * PURPOSE:
 *   Handles all CRUD operations for products.
 *   All operations are scoped to the authenticated user (req.user.id).
 *
 * EXPORTS:
 *   getProducts     — GET  /api/products
 *   getProduct      — GET  /api/products/:id
 *   createProduct   — POST /api/products
 *   updateProduct   — PUT  /api/products/:id
 *   deleteProduct   — DELETE /api/products/:id
 *   getLowStock     — GET  /api/products/low-stock
 *
 * HOW IT FITS:
 *   Called by productRoutes.js.
 *   Delegates DB work to productModel.js.
 */

'use strict';

const productModel = require('../models/productModel');

/**
 * getProducts
 * Returns all products belonging to the authenticated owner.
 * Each row includes an is_low_stock flag for frontend display.
 *
 * @route  GET /api/products
 * @access Private
 */
const getProducts = (req, res, next) => {
    try {
        const products = productModel.getAllProducts(req.user.id);
        return res.status(200).json({ success: true, data: products });
    } catch (err) {
        next(err);
    }
};

/**
 * getLowStock
 * Returns only products at or below the low-stock threshold.
 * Route must be declared BEFORE /:id routes to avoid param capture.
 *
 * @route  GET /api/products/low-stock
 * @access Private
 */
const getLowStock = (req, res, next) => {
    try {
        const products = productModel.getLowStockProducts(req.user.id);
        return res.status(200).json({ success: true, data: products });
    } catch (err) {
        next(err);
    }
};

/**
 * getProduct
 * Returns a single product by ID, scoped to the logged-in owner.
 * Returns 404 if the product does not exist or belongs to another owner.
 *
 * @route  GET /api/products/:id
 * @access Private
 */
const getProduct = (req, res, next) => {
    try {
        const product = productModel.getProductById(
            parseInt(req.params.id, 10),
            req.user.id,
        );

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        return res.status(200).json({ success: true, data: product });
    } catch (err) {
        next(err);
    }
};

/**
 * createProduct
 * Creates a new product for the authenticated owner.
 *
 * Validation:
 *   - name, cost_price, and selling_price are required.
 *   - quantity defaults to 0 if not supplied.
 *   - Prices must be non-negative numbers.
 *
 * @route  POST /api/products
 * @access Private
 * @body   { name, description?, quantity?, cost_price, selling_price }
 */
const createProduct = (req, res, next) => {
    try {
        const { name, description, quantity, cost_price, selling_price } = req.body;

        // ── Validation ──────────────────────────────────────────────────────────
        if (!name || cost_price === undefined || selling_price === undefined) {
            return res.status(400).json({
                success: false,
                message: 'name, cost_price, and selling_price are required.',
            });
        }

        if (parseFloat(cost_price) < 0 || parseFloat(selling_price) < 0) {
            return res.status(400).json({
                success: false,
                message: 'Prices must be non-negative.',
            });
        }

        if (quantity !== undefined && parseInt(quantity, 10) < 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be a non-negative integer.',
            });
        }

        const product = productModel.createProduct({
            owner_id: req.user.id,
            name: name.trim(),
            description: description ? description.trim() : '',
            quantity: quantity !== undefined ? parseInt(quantity, 10) : 0,
            cost_price: parseFloat(cost_price),
            selling_price: parseFloat(selling_price),
        });

        return res.status(201).json({
            success: true,
            message: 'Product created.',
            data: product,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * updateProduct
 * Updates one or more fields of an existing product.
 * Only fields present in the request body are updated.
 *
 * @route  PUT /api/products/:id
 * @access Private
 * @body   { name?, description?, quantity?, cost_price?, selling_price? }
 */
const updateProduct = (req, res, next) => {
    try {
        const productId = parseInt(req.params.id, 10);

        // Confirm the product exists and belongs to this owner before updating.
        const existing = productModel.getProductById(productId, req.user.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        // Sanitise incoming values.
        const updates = {};
        if (req.body.name !== undefined) updates.name = req.body.name.trim();
        if (req.body.description !== undefined) updates.description = req.body.description.trim();
        if (req.body.quantity !== undefined) updates.quantity = parseInt(req.body.quantity, 10);
        if (req.body.cost_price !== undefined) updates.cost_price = parseFloat(req.body.cost_price);
        if (req.body.selling_price !== undefined) updates.selling_price = parseFloat(req.body.selling_price);

        const updated = productModel.updateProduct(productId, req.user.id, updates);

        return res.status(200).json({
            success: true,
            message: 'Product updated.',
            data: updated,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * deleteProduct
 * Permanently removes a product and its related sales (ON DELETE CASCADE).
 *
 * @route  DELETE /api/products/:id
 * @access Private
 */
const deleteProduct = (req, res, next) => {
    try {
        const deleted = productModel.deleteProduct(
            parseInt(req.params.id, 10),
            req.user.id,
        );

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Product deleted successfully.',
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProducts,
    getLowStock,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
};
