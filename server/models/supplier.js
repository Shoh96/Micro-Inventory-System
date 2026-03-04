/**
 * FILE: server/models/supplier.js
 *
 * PURPOSE:
 *   Database operations for the `suppliers` table.
 *   Each supplier belongs to a specific shop owner.
 *
 * EXPORTS:
 *   getSuppliersByOwner, getSupplierById,
 *   createSupplier, updateSupplier, deleteSupplier
 */

'use strict';

const db = require('../config/db');

const getSuppliersByOwner = (ownerId) =>
    db.prepare('SELECT * FROM suppliers WHERE owner_id = ? ORDER BY name ASC').all(ownerId);

const getSupplierById = (id, ownerId) =>
    db.prepare('SELECT * FROM suppliers WHERE id = ? AND owner_id = ?').get(id, ownerId);

/**
 * createSupplier
 * @param {number} ownerId
 * @param {{name, contact_info, email}} data
 */
const createSupplier = (ownerId, { name, contact_info = '', email = '' }) => {
    const info = db.prepare(`
    INSERT INTO suppliers (owner_id, name, contact_info, email) VALUES (?, ?, ?, ?)
  `).run(ownerId, name.trim(), contact_info, email);
    return getSupplierById(info.lastInsertRowid, ownerId);
};

const updateSupplier = (id, ownerId, { name, contact_info, email }) => {
    db.prepare(`
    UPDATE suppliers SET name = ?, contact_info = ?, email = ? WHERE id = ? AND owner_id = ?
  `).run(name, contact_info, email, id, ownerId);
    return getSupplierById(id, ownerId);
};

const deleteSupplier = (id, ownerId) => {
    const info = db.prepare('DELETE FROM suppliers WHERE id = ? AND owner_id = ?').run(id, ownerId);
    return info.changes > 0;
};

module.exports = { getSuppliersByOwner, getSupplierById, createSupplier, updateSupplier, deleteSupplier };
