/**
 * FILE: server/controllers/userController.js (V3)
 *
 * PURPOSE:
 *   Admin + owner user management.
 *   - Admin: full CRUD over owners; createOwner includes shops + branches inline.
 *   - Owner: CRUD over their clerks; createClerk requires owner_id + branch_id (validated).
 *   - clearAllData: admin-only wipe of all business data.
 *   - Default credentials (plaintext) returned on create/reset.
 */

'use strict';

const bcrypt = require('bcryptjs');
const userModel = require('../models/user');
const shopModel = require('../models/shop');
const branchModel = require('../models/branch');
const db = require('../config/db');

const SALT_ROUNDS = 12;

const makeDefaultPassword = (name) => {
    const word = (name || 'User').split(' ')[0];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${word}${num}!`;
};

/* ── listUsers ──────────────────────────────────────────────────────────────── */
const listUsers = (req, res, next) => {
    try {
        if (req.user.role === 'admin') {
            const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.role, u.owner_id, u.branch_id, u.is_active, u.created_at,
               o.name          AS owner_name,
               b.name          AS branch_name,
               s.name          AS shop_name
        FROM users u
        LEFT JOIN users   o ON u.owner_id  = o.id
        LEFT JOIN branches b ON u.branch_id = b.id
        LEFT JOIN shops    s ON b.shop_id   = s.id
        ORDER BY u.created_at DESC
      `).all();
            return res.status(200).json({ success: true, data: users });
        }
        const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.owner_id, u.branch_id, u.is_active, u.created_at,
             b.name AS branch_name,
             s.name AS shop_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      LEFT JOIN shops    s ON b.shop_id   = s.id
      WHERE u.owner_id = ? OR u.id = ?
      ORDER BY u.created_at DESC
    `).all(req.user.id, req.user.id);
        return res.status(200).json({ success: true, data: users });
    } catch (err) { next(err); }
};

/* ── createOwner ─────────────────────────────────────────────────────────────── */
/**
 * POST /api/users/owner
 * Body: { name, email, shops: [{ name, address, currency, low_stock_threshold, tax_percentage,
 *           allow_admin_visibility, branches: [{ name, address, phone }] }] }
 * Returns default credentials.
 */
const createOwner = async (req, res, next) => {
    try {
        const { name, email, shops: shopsData = [] } = req.body;
        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'name and email are required.' });
        }

        const defaultPassword = makeDefaultPassword(name);
        const password_hash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

        const runAll = db.transaction(() => {
            const info = db.prepare(
                `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'owner')`
            ).run(name, email.toLowerCase(), password_hash);
            const newId = info.lastInsertRowid;
            // Self-referential owner_id
            db.prepare('UPDATE users SET owner_id = id WHERE id = ?').run(newId);

            // Create shops (default at least one)
            const shopList = shopsData.length ? shopsData : [{ name: `${name}'s Shop` }];
            shopList.forEach(shopData => {
                const shopInfo = db.prepare(
                    `INSERT INTO shops (owner_id, name, address, currency, low_stock_threshold, tax_percentage, allow_admin_visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
                ).run(
                    newId,
                    shopData.name || `${name}'s Shop`,
                    shopData.address || '',
                    shopData.currency || 'XAF',
                    shopData.low_stock_threshold ?? 10,
                    shopData.tax_percentage ?? 0,
                    shopData.allow_admin_visibility ? 1 : 0
                );
                const shopId = shopInfo.lastInsertRowid;

                // Create branches for this shop
                const branchesList = shopData.branches?.length
                    ? shopData.branches
                    : [{ name: 'Main Branch' }];
                branchesList.forEach(branchData => {
                    db.prepare(
                        `INSERT INTO branches (shop_id, owner_id, name, address, phone) VALUES (?, ?, ?, ?, ?)`
                    ).run(shopId, newId, branchData.name || 'Main Branch', branchData.address || '', branchData.phone || '');
                });
            });

            // Legacy shop_settings entry for backward-compat
            const firstShop = shopList[0];
            try {
                db.prepare(`INSERT OR IGNORE INTO shop_settings (owner_id, shop_name, currency, low_stock_threshold)
          VALUES (?, ?, ?, ?)`).run(newId, firstShop.name || `${name}'s Shop`, firstShop.currency || 'XAF', firstShop.low_stock_threshold ?? 10);
            } catch (_) { }

            return userModel.findUserById(newId);
        });

        const owner = runAll();
        return res.status(201).json({
            success: true,
            message: 'Owner account created.',
            data: owner,
            credentials: { email: email.toLowerCase(), password: defaultPassword },
        });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ success: false, message: 'Email already in use.' });
        }
        next(err);
    }
};

/* ── createClerk ─────────────────────────────────────────────────────────────── */
/**
 * POST /api/users/clerk
 * Body: { name, email, owner_id (admin only), branch_id (REQUIRED) }
 * Validates branch belongs to owner.
 */
const createClerk = async (req, res, next) => {
    try {
        const { name, email, branch_id } = req.body;
        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'name and email are required.' });
        }
        if (!branch_id) {
            return res.status(400).json({ success: false, message: 'branch_id is required. A clerk must be assigned to a branch.' });
        }

        const ownerId = req.user.role === 'admin'
            ? (req.body.owner_id ? parseInt(req.body.owner_id, 10) : null)
            : req.user.id;

        if (!ownerId) {
            return res.status(400).json({ success: false, message: 'owner_id is required when creating a clerk as admin.' });
        }

        // Validate branch belongs to this owner
        const branch = branchModel.getBranchById(parseInt(branch_id, 10));
        if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
        if (branch.owner_id !== ownerId) {
            return res.status(403).json({ success: false, message: 'Branch does not belong to this owner.' });
        }

        const defaultPassword = makeDefaultPassword(name);
        const password_hash = await bcrypt.hash(defaultPassword, SALT_ROUNDS);

        const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, owner_id, branch_id)
      VALUES (?, ?, ?, 'clerk', ?, ?)
    `).run(name, email.toLowerCase(), password_hash, ownerId, parseInt(branch_id, 10));

        const clerk = userModel.findUserById(info.lastInsertRowid);
        return res.status(201).json({
            success: true,
            message: 'Clerk account created.',
            data: clerk,
            credentials: { email: email.toLowerCase(), password: defaultPassword },
        });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ success: false, message: 'Email already in use.' });
        }
        next(err);
    }
};

/* ── updateUser ─────────────────────────────────────────────────────────────── */
const updateUser = (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const target = userModel.findUserById(targetId);
        if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
        if (req.user.role === 'owner' && target.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your clerk.' });
        }

        const { name, email, branch_id } = req.body;

        // If branch_id provided, validate it belongs to the owner
        if (branch_id && target.role === 'clerk') {
            const branch = branchModel.getBranchById(parseInt(branch_id, 10));
            if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
            const ownerId = req.user.role === 'admin' ? target.owner_id : req.user.id;
            if (branch.owner_id !== ownerId) {
                return res.status(403).json({ success: false, message: 'Branch does not belong to this owner.' });
            }
        }

        const sets = [];
        const vals = [];
        if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
        if (email !== undefined) { sets.push('email = ?'); vals.push(email.toLowerCase()); }
        if (branch_id !== undefined) { sets.push('branch_id = ?'); vals.push(branch_id ? parseInt(branch_id, 10) : null); }

        if (sets.length) { vals.push(targetId); db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
        return res.json({ success: true, data: userModel.findUserById(targetId) });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ success: false, message: 'Email already in use.' });
        next(err);
    }
};

/* ── resetPassword ──────────────────────────────────────────────────────────── */
const resetPassword = async (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const target = userModel.findUserById(targetId);
        if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
        if (req.user.role === 'owner' && target.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your clerk.' });
        }
        if (target.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Cannot reset admin password.' });
        }
        const newPassword = req.body.new_password || makeDefaultPassword(target.name);
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        userModel.updateUserPassword(targetId, password_hash);
        return res.status(200).json({
            success: true,
            message: 'Password reset successfully.',
            credentials: { email: target.email, password: newPassword },
        });
    } catch (err) { next(err); }
};

/* ── updateRole ─────────────────────────────────────────────────────────────── */
const updateRole = (req, res, next) => {
    try {
        const { role } = req.body;
        if (!['admin', 'owner', 'clerk'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role.' });
        const user = userModel.updateUserRole(parseInt(req.params.id, 10), role);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        return res.status(200).json({ success: true, data: user });
    } catch (err) { next(err); }
};

/* ── deactivate ─────────────────────────────────────────────────────────────── */
const deactivate = (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const target = userModel.findUserById(targetId);
        if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
        if (req.user.role === 'owner' && target.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your clerk.' });
        }
        userModel.deactivateUser(targetId);
        return res.status(200).json({ success: true, message: 'User deactivated.' });
    } catch (err) { next(err); }
};

/* ── reactivate ─────────────────────────────────────────────────────────────── */
const reactivate = (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const target = userModel.findUserById(targetId);
        if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
        if (req.user.role === 'owner' && target.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not your clerk.' });
        }
        db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(targetId);
        return res.status(200).json({ success: true, message: 'User reactivated.' });
    } catch (err) { next(err); }
};

/* ── deleteOwner ─────────────────────────────────────────────────────────────── */
/**
 * DELETE /api/users/owner/:id  — ADMIN ONLY
 * Permanently deletes an owner and ALL their associated data:
 * clerks, shops, branches, products, sales, categories, suppliers.
 */
const deleteOwner = (req, res, next) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const target = userModel.findUserById(targetId);
        if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
        if (target.role === 'admin') return res.status(403).json({ success: false, message: 'Cannot delete admin accounts.' });
        if (target.role !== 'owner') return res.status(400).json({ success: false, message: 'This endpoint is for owner accounts only.' });

        db.transaction(() => {
            // Delete sales for this owner
            db.prepare('DELETE FROM sales WHERE owner_id = ?').run(targetId);
            // Delete products for this owner
            db.prepare('DELETE FROM products WHERE owner_id = ?').run(targetId);
            // Delete categories for this owner
            db.prepare('DELETE FROM categories WHERE owner_id = ?').run(targetId);
            // Delete suppliers for this owner
            db.prepare('DELETE FROM suppliers WHERE owner_id = ?').run(targetId);
            // Delete activity log
            db.prepare('DELETE FROM activity_log WHERE owner_id = ?').run(targetId);
            // Get shop ids for this owner
            const shopIds = db.prepare('SELECT id FROM shops WHERE owner_id = ?').all(targetId).map(s => s.id);
            if (shopIds.length) {
                // Delete branches belonging to their shops
                const placeholders = shopIds.map(() => '?').join(',');
                db.prepare(`DELETE FROM branches WHERE shop_id IN (${placeholders})`).run(...shopIds);
                // Delete shops
                db.prepare(`DELETE FROM shops WHERE id IN (${placeholders})`).run(...shopIds);
            }
            // Delete shop_settings
            db.prepare('DELETE FROM shop_settings WHERE owner_id = ?').run(targetId);
            // Deactivate/delete clerks belonging to this owner
            db.prepare('DELETE FROM users WHERE owner_id = ?').run(targetId);
            // Finally delete the owner
            db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        })();

        return res.json({ success: true, message: `Owner "${target.name}" and all their data have been permanently deleted.` });
    } catch (err) { next(err); }
};

/* ── clearAllData ────────────────────────────────────────────────────────────── */
/**
 * DELETE /api/users/clear-data  — ADMIN ONLY
 * Wipes all business data: sales, products, categories, suppliers, branches, shops,
 * and all non-admin users. Admin accounts are preserved.
 */
const clearAllData = (req, res, next) => {
    try {
        const confirm = req.body.confirm;
        if (confirm !== 'DELETE_ALL_DATA') {
            return res.status(400).json({ success: false, message: 'Send { confirm: "DELETE_ALL_DATA" } to confirm.' });
        }
        db.transaction(() => {
            db.prepare('DELETE FROM activity_log').run();
            db.prepare('DELETE FROM sales').run();
            db.prepare('DELETE FROM products').run();
            db.prepare('DELETE FROM suppliers').run();
            db.prepare('DELETE FROM categories').run();
            db.prepare('DELETE FROM branches').run();
            db.prepare('DELETE FROM shops').run();
            db.prepare('DELETE FROM shop_settings').run();
            db.prepare("DELETE FROM users WHERE role != 'admin'").run();
            // Reset sqlite sequences
            ['activity_log', 'sales', 'products', 'suppliers', 'categories', 'branches', 'shops', 'shop_settings'].forEach(t => {
                try { db.prepare(`DELETE FROM sqlite_sequence WHERE name='${t}'`).run(); } catch (_) { }
            });
        })();
        return res.json({ success: true, message: 'All data cleared. Admin accounts preserved.' });
    } catch (err) { next(err); }
};

module.exports = {
    listUsers, createClerk, createOwner, updateUser, updateRole,
    resetPassword, deactivate, reactivate, clearAllData, deleteOwner,
};
