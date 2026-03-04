/**
 * FILE: server/routes/productRoutes.js
 *
 * PURPOSE:
 *   Defines all product CRUD endpoints.
 *   All routes require a valid JWT (authenticate middleware).
 *
 * EXPORTS:
 *   Express Router with product routes.
 *
 * HOW IT FITS:
 *   Mounted in app.js at the /api/products prefix.
 *   authenticate is applied to the entire router so every route is protected.
 *
 * IMPORTANT:
 *   /low-stock must be declared BEFORE /:id to prevent Express from
 *   interpreting "low-stock" as a product ID value.
 */

'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const {
    getProducts,
    getLowStock,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} = require('../controllers/productController');

const router = Router();

// Apply JWT authentication to all product routes.
router.use(authenticate);

// GET  /api/products/low-stock — must be before /:id
router.get('/low-stock', getLowStock);

// GET  /api/products
router.get('/', getProducts);

// POST /api/products
router.post('/', createProduct);

// GET  /api/products/:id
router.get('/:id', getProduct);

// PUT  /api/products/:id
router.put('/:id', updateProduct);

// DELETE /api/products/:id
router.delete('/:id', deleteProduct);

module.exports = router;
