/**
 * FILE: server/models/branch.js (V2)
 * PURPOSE: Database operations for branches — now shop-scoped (shop_id) not owner-scoped.
 */
'use strict';

const db = require('../config/db');

const getBranchById = (id) =>
    db.prepare(`
    SELECT b.*, s.name AS shop_name, s.owner_id
    FROM branches b
    LEFT JOIN shops s ON b.shop_id = s.id
    WHERE b.id = ?
  `).get(id);

/** Get all branches for a specific shop */
const getBranchesByShop = (shopId) =>
    db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id AND u.role = 'clerk') AS clerk_count
    FROM branches b
    WHERE b.shop_id = ?
    ORDER BY b.name ASC
  `).all(shopId);

/** Get all branches belonging to any shop owned by ownerId */
const getBranchesByOwner = (ownerId) =>
    db.prepare(`
    SELECT b.*, s.name AS shop_name,
      (SELECT COUNT(*) FROM users u WHERE u.branch_id = b.id AND u.role = 'clerk') AS clerk_count
    FROM branches b
    JOIN shops s ON b.shop_id = s.id
    WHERE s.owner_id = ?
    ORDER BY s.name, b.name
  `).all(ownerId);

/** Admin: get all branches with shop + owner info */
const getAllBranchesForAdmin = () =>
    db.prepare(`
    SELECT b.*, s.name AS shop_name, u.name AS owner_name, u.id AS owner_id,
      (SELECT COUNT(*) FROM users cu WHERE cu.branch_id = b.id AND cu.role = 'clerk') AS clerk_count
    FROM branches b
    JOIN shops s ON b.shop_id = s.id
    JOIN users u ON s.owner_id = u.id
    ORDER BY u.name, s.name, b.name
  `).all();

const createBranch = ({ shop_id, owner_id, name, address = '', phone = '' }) => {
    const info = db.prepare(
        'INSERT INTO branches (shop_id, owner_id, name, address, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(shop_id, owner_id, name, address, phone);
    return getBranchById(info.lastInsertRowid);
};

const updateBranch = (id, { name, address, phone }) => {
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (address !== undefined) { sets.push('address = ?'); vals.push(address); }
    if (phone !== undefined) { sets.push('phone = ?'); vals.push(phone); }
    if (!sets.length) return getBranchById(id);
    vals.push(id);
    db.prepare(`UPDATE branches SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return getBranchById(id);
};

const deleteBranch = (id) => {
    db.prepare('UPDATE users SET branch_id = NULL WHERE branch_id = ?').run(id);
    db.prepare('DELETE FROM branches WHERE id = ?').run(id);
};

// Legacy: kept for backward-compat during transition
const getBranches = getBranchesByOwner;

module.exports = {
    getBranchById, getBranchesByShop, getBranchesByOwner,
    getAllBranchesForAdmin, createBranch, updateBranch, deleteBranch, getBranches,
};
