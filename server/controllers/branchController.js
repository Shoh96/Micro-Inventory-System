/**
 * FILE: server/controllers/branchController.js (V2)
 * PURPOSE: CRUD for shop branches — branches now belong to shops (shop_id).
 */
'use strict';

const branchModel = require('../models/branch');
const shopModel = require('../models/shop');
const db = require('../config/db');

/** GET /api/branches — owner gets all their branches, admin gets all, clerk gets their branch's shop */
const listBranches = (req, res, next) => {
    try {
        if (req.user.role === 'admin') {
            return res.json({ success: true, data: branchModel.getAllBranchesForAdmin() });
        }
        const ownerId = req.user.role === 'clerk' ? req.user.owner_id : req.user.id;
        return res.json({ success: true, data: branchModel.getBranchesByOwner(ownerId) });
    } catch (err) { next(err); }
};

/** POST /api/branches — requires shop_id */
const createBranch = (req, res, next) => {
    try {
        const { shop_id, name, address, phone } = req.body;
        if (!shop_id) return res.status(400).json({ success: false, message: 'shop_id is required.' });
        if (!name) return res.status(400).json({ success: false, message: 'Branch name required.' });

        const shop = shopModel.getShopById(parseInt(shop_id, 10));
        if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });
        if (req.user.role === 'owner' && shop.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your shop.' });
        }
        const branch = branchModel.createBranch({ shop_id: shop.id, owner_id: shop.owner_id, name, address, phone });
        return res.status(201).json({ success: true, data: branch });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint')) {
            return res.status(409).json({ success: false, message: 'Branch name already exists for this shop.' });
        }
        next(err);
    }
};

/** PUT /api/branches/:id */
const updateBranch = (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const branch = branchModel.getBranchById(id);
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
        if (req.user.role === 'owner' && branch.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your branch.' });
        }
        const updated = branchModel.updateBranch(id, req.body);
        return res.json({ success: true, data: updated });
    } catch (err) { next(err); }
};

/** DELETE /api/branches/:id */
const deleteBranch = (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        const branch = branchModel.getBranchById(id);
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
        if (req.user.role === 'owner' && branch.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your branch.' });
        }
        branchModel.deleteBranch(id);
        return res.json({ success: true, message: 'Branch deleted.' });
    } catch (err) { next(err); }
};

module.exports = { listBranches, createBranch, updateBranch, deleteBranch };
