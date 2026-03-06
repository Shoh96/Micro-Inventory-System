/**
 * FILE: server/controllers/productController.js (V2)
 *
 * PURPOSE:
 *   Full CRUD for products, categories, and suppliers.
 *   Includes duplicate detection before creation.
 *   All product operations are activity-logged.
 *
 * EXPORTS:
 *   getProducts, getProduct, createProduct, updateProduct, deleteProduct, searchProducts,
 *   getCategories, createCategory, deleteCategory,
 *   getSuppliers, createSupplier, updateSupplier, deleteSupplier
 */

'use strict';

const productModel = require('../models/product');
const categoryModel = require('../models/category');
const supplierModel = require('../models/supplier');
const { logActivity } = require('../models/activityLog');
const { findDuplicateCandidates } = require('../utils/duplicateChecker');

// Helper: resolve owner_id regardless of whether the caller is an owner or clerk.
// Clerks operate under their assigned owner_id.
const resolveOwnerId = (user) => (user.role === 'clerk' ? user.owner_id : user.id);

// ── Products ──────────────────────────────────────────────────────────────────

const getProducts = (req, res, next) => {
    try {
        // Admin can pass ?owner_id=X to see a specific owner's inventory
        let ownerId;
        if (req.user.role === 'admin' && req.query.owner_id) {
            ownerId = parseInt(req.query.owner_id, 10);
        } else {
            ownerId = resolveOwnerId(req.user);
        }
        const filters = {
            categoryId: req.query.category_id ? parseInt(req.query.category_id, 10) : null,
            lowStockOnly: req.query.low_stock === 'true',
        };
        const products = productModel.getAllProducts(ownerId, filters);
        return res.status(200).json({ success: true, data: products, owner_id: ownerId });
    } catch (err) { next(err); }
};


const searchProducts = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const q = req.query.q || '';
        if (!q.trim()) return res.status(400).json({ success: false, message: 'Query parameter q is required.' });
        return res.status(200).json({ success: true, data: productModel.searchProducts(ownerId, q) });
    } catch (err) { next(err); }
};

const getProduct = (req, res, next) => {
    try {
        const product = productModel.getProductById(parseInt(req.params.id, 10), resolveOwnerId(req.user));
        if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
        return res.status(200).json({ success: true, data: product });
    } catch (err) { next(err); }
};

/**
 * createProduct
 * Runs duplicate detection first.  If duplicates are found, returns a 409
 * with the candidate list so the frontend can prompt the user to confirm.
 * A `force=true` query param allows bypassing the duplicate check.
 */
const createProduct = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const { name, description, category_id, supplier_id, batch_number,
            serial_number, expiry_date, quantity, cost_price, selling_price } = req.body;

        if (!name || cost_price === undefined || selling_price === undefined) {
            return res.status(400).json({ success: false, message: 'name, cost_price, and selling_price are required.' });
        }

        // Duplicate check — skip with ?force=true.
        if (req.query.force !== 'true') {
            const dupes = findDuplicateCandidates(name, ownerId);
            if (dupes.length) {
                return res.status(409).json({
                    success: false,
                    message: 'Possible duplicate products detected. Add ?force=true to proceed anyway.',
                    data: { duplicates: dupes },
                });
            }
        }

        const product = productModel.createProduct({
            owner_id: ownerId, name: name.trim(), description, category_id: category_id || null,
            supplier_id: supplier_id || null, batch_number, serial_number,
            expiry_date: expiry_date || null,
            quantity: parseInt(quantity, 10) || 0,
            cost_price: parseFloat(cost_price), selling_price: parseFloat(selling_price),
        });

        logActivity({
            userId: req.user.id, userName: req.user.name,
            action: 'CREATE', entityType: 'product', entityId: product.id,
            detail: JSON.stringify({ name: product.name }),
        });

        return res.status(201).json({ success: true, message: 'Product created.', data: product });
    } catch (err) { next(err); }
};

const updateProduct = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const productId = parseInt(req.params.id, 10);

        const existing = productModel.getProductById(productId, ownerId);
        if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });

        // Sanitise — only pass defined fields to the dynamic update.
        const fields = {};
        const allowed = ['name', 'description', 'category_id', 'supplier_id', 'batch_number',
            'serial_number', 'expiry_date', 'quantity', 'cost_price', 'selling_price'];
        allowed.forEach((k) => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });

        const updated = productModel.updateProduct(productId, ownerId, fields);

        logActivity({
            userId: req.user.id, userName: req.user.name,
            action: 'UPDATE', entityType: 'product', entityId: productId,
            detail: JSON.stringify(fields),
        });

        return res.status(200).json({ success: true, data: updated });
    } catch (err) { next(err); }
};

const deleteProduct = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const deleted = productModel.deleteProduct(parseInt(req.params.id, 10), ownerId);
        if (!deleted) return res.status(404).json({ success: false, message: 'Product not found.' });

        logActivity({
            userId: req.user.id, userName: req.user.name,
            action: 'DELETE', entityType: 'product', entityId: parseInt(req.params.id, 10),
        });

        return res.status(200).json({ success: true, message: 'Product deleted.' });
    } catch (err) { next(err); }
};

// ── Categories ────────────────────────────────────────────────────────────────

const getCategories = (req, res, next) => {
    try {
        return res.status(200).json({ success: true, data: categoryModel.getCategoriesByOwner(resolveOwnerId(req.user)) });
    } catch (err) { next(err); }
};

const createCategory = (req, res, next) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'name is required.' });
        const category = categoryModel.createCategory(resolveOwnerId(req.user), name);
        return res.status(201).json({ success: true, data: category });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ success: false, message: 'Category already exists.' });
        }
        next(err);
    }
};

const deleteCategory = (req, res, next) => {
    try {
        const deleted = categoryModel.deleteCategory(parseInt(req.params.id, 10), resolveOwnerId(req.user));
        if (!deleted) return res.status(404).json({ success: false, message: 'Category not found.' });
        return res.status(200).json({ success: true, message: 'Category deleted.' });
    } catch (err) { next(err); }
};

// ── Suppliers ─────────────────────────────────────────────────────────────────

const getSuppliers = (req, res, next) => {
    try {
        return res.status(200).json({ success: true, data: supplierModel.getSuppliersByOwner(resolveOwnerId(req.user)) });
    } catch (err) { next(err); }
};

const createSupplier = (req, res, next) => {
    try {
        const { name, contact_info, email } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'name is required.' });
        const supplier = supplierModel.createSupplier(resolveOwnerId(req.user), { name, contact_info, email });
        return res.status(201).json({ success: true, data: supplier });
    } catch (err) { next(err); }
};

const updateSupplier = (req, res, next) => {
    try {
        const ownerId = resolveOwnerId(req.user);
        const supplierId = parseInt(req.params.id, 10);
        const existing = supplierModel.getSupplierById(supplierId, ownerId);
        if (!existing) return res.status(404).json({ success: false, message: 'Supplier not found.' });
        const updated = supplierModel.updateSupplier(supplierId, ownerId, req.body);
        return res.status(200).json({ success: true, data: updated });
    } catch (err) { next(err); }
};

const deleteSupplier = (req, res, next) => {
    try {
        const deleted = supplierModel.deleteSupplier(parseInt(req.params.id, 10), resolveOwnerId(req.user));
        if (!deleted) return res.status(404).json({ success: false, message: 'Supplier not found.' });
        return res.status(200).json({ success: true, message: 'Supplier deleted.' });
    } catch (err) { next(err); }
};

module.exports = {
    getProducts, searchProducts, getProduct, createProduct, updateProduct, deleteProduct,
    getCategories, createCategory, deleteCategory,
    getSuppliers, createSupplier, updateSupplier, deleteSupplier,
};
