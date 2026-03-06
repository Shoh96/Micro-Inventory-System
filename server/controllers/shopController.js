/**
 * FILE: server/controllers/shopController.js
 * PURPOSE: CRUD for shops.
 * Owners manage their own shops. Admins can see and manage all.
 */
'use strict';

const shopModel = require('../models/shop');
const branchModel = require('../models/branch');

/** GET /api/shops — owner gets own shops, admin gets all */
const listShops = (req, res, next) => {
    try {
        if (req.user.role === 'admin') {
            return res.json({ success: true, data: shopModel.getAllShopsForAdmin() });
        }
        const ownerId = req.user.role === 'clerk' ? req.user.owner_id : req.user.id;
        return res.json({ success: true, data: shopModel.getShopsByOwner(ownerId) });
    } catch (err) { next(err); }
};

/** GET /api/shops/:id/branches — branches for a specific shop */
const listShopBranches = (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const shop = shopModel.getShopById(id);
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });
        if (req.user.role === 'owner' && shop.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your shop.' });
        }
        return res.json({ success: true, data: branchModel.getBranchesByShop(id) });
    } catch (err) { next(err); }
};

/** POST /api/shops */
const createShop = (req, res, next) => {
    try {
        const { name, address, currency, low_stock_threshold, tax_percentage, allow_admin_visibility } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Shop name required.' });
        const ownerId = req.user.role === 'admin' ? (req.body.owner_id) : req.user.id;
        if (!ownerId) return res.status(400).json({ success: false, message: 'owner_id required for admin.' });
        const shop = shopModel.createShop({ owner_id: ownerId, name, address, currency, low_stock_threshold, tax_percentage, allow_admin_visibility });
        return res.status(201).json({ success: true, data: shop });
    } catch (err) { next(err); }
};

/** PUT /api/shops/:id */
const updateShop = (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const shop = shopModel.getShopById(id);
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });
        if (req.user.role === 'owner' && shop.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your shop.' });
        }
        const updated = shopModel.updateShop(id, req.body);
        return res.json({ success: true, data: updated });
    } catch (err) { next(err); }
};

/** DELETE /api/shops/:id */
const deleteShop = (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const shop = shopModel.getShopById(id);
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });
        if (req.user.role === 'owner' && shop.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your shop.' });
        }
        shopModel.deleteShop(id);
        return res.json({ success: true, message: 'Shop deleted.' });
    } catch (err) { next(err); }
};

module.exports = { listShops, listShopBranches, createShop, updateShop, deleteShop };
