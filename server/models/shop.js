/**
 * FILE: server/models/shop.js
 * PURPOSE: Database operations for the shops table.
 * An owner can have multiple shops. Each shop has its own config + branches.
 */
'use strict';

const db = require('../config/db');

const getShopById = (id) =>
    db.prepare('SELECT * FROM shops WHERE id = ?').get(id);

const getShopsByOwner = (ownerId) =>
    db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM branches b WHERE b.shop_id = s.id) AS branch_count
    FROM shops s
    WHERE s.owner_id = ?
    ORDER BY s.created_at ASC
  `).all(ownerId);

const getAllShopsForAdmin = () =>
    db.prepare(`
    SELECT s.*, u.name AS owner_name, u.email AS owner_email,
      (SELECT COUNT(*) FROM branches b WHERE b.shop_id = s.id) AS branch_count
    FROM shops s
    JOIN users u ON s.owner_id = u.id
    ORDER BY u.name, s.name
  `).all();

const createShop = ({ owner_id, name, address = '', currency = 'XAF',
    low_stock_threshold = 10, tax_percentage = 0, allow_admin_visibility = 0 }) => {
    const info = db.prepare(`
    INSERT INTO shops (owner_id, name, address, currency, low_stock_threshold, tax_percentage, allow_admin_visibility)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(owner_id, name, address, currency, low_stock_threshold, tax_percentage, allow_admin_visibility ? 1 : 0);
    return getShopById(info.lastInsertRowid);
};

const updateShop = (id, { name, address, currency, low_stock_threshold, tax_percentage, allow_admin_visibility }) => {
    const sets = [];
    const vals = [];
    if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
    if (address !== undefined) { sets.push('address = ?'); vals.push(address); }
    if (currency !== undefined) { sets.push('currency = ?'); vals.push(currency); }
    if (low_stock_threshold !== undefined) { sets.push('low_stock_threshold = ?'); vals.push(low_stock_threshold); }
    if (tax_percentage !== undefined) { sets.push('tax_percentage = ?'); vals.push(tax_percentage); }
    if (allow_admin_visibility !== undefined) { sets.push('allow_admin_visibility = ?'); vals.push(allow_admin_visibility ? 1 : 0); }
    if (!sets.length) return getShopById(id);
    vals.push(id);
    db.prepare(`UPDATE shops SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return getShopById(id);
};

const deleteShop = (id) => {
    // Cascades to branches (shop_id FK), clerks get branch_id = NULL via user update
    const branches = db.prepare('SELECT id FROM branches WHERE shop_id = ?').all(id);
    branches.forEach(b => db.prepare('UPDATE users SET branch_id = NULL WHERE branch_id = ?').run(b.id));
    db.prepare('DELETE FROM shops WHERE id = ?').run(id);
};

module.exports = { getShopById, getShopsByOwner, getAllShopsForAdmin, createShop, updateShop, deleteShop };
