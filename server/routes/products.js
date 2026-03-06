/**
 * FILE: server/routes/products.js (V2)
 *
 * PURPOSE:
 *   Product CRUD routes plus category and supplier sub-resources.
 *   All routes require authentication.
 *   Clerks can GET products; only owners/admins can create/update/delete.
 *
 * NOTE:
 *   /search and /categories and /suppliers must be declared BEFORE /:id
 *   to prevent Express treating them as ID parameters.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const ctrl = require('../controllers/productController');

const router = Router();
router.use(authenticate);

// ── Categories ────────────────────────────────────────────────────────────────
router.get('/categories', ctrl.getCategories);
router.post('/categories', requireRole('owner', 'admin'), ctrl.createCategory);
router.delete('/categories/:id', requireRole('owner', 'admin'), ctrl.deleteCategory);

// ── Suppliers ─────────────────────────────────────────────────────────────────
router.get('/suppliers', ctrl.getSuppliers);
router.post('/suppliers', requireRole('owner', 'admin'), ctrl.createSupplier);
router.put('/suppliers/:id', requireRole('owner', 'admin'), ctrl.updateSupplier);
router.delete('/suppliers/:id', requireRole('owner', 'admin'), ctrl.deleteSupplier);

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/search', ctrl.searchProducts);
router.get('/', ctrl.getProducts);
router.post('/', requireRole('owner', 'admin'), ctrl.createProduct);
router.get('/:id', ctrl.getProduct);
router.put('/:id', requireRole('owner', 'admin'), ctrl.updateProduct);
router.delete('/:id', requireRole('owner', 'admin'), ctrl.deleteProduct);

module.exports = router;
