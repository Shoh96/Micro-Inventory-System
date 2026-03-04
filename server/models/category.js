/**
 * FILE: server/models/category.js
 *
 * PURPOSE:
 *   Database operations for the `categories` table.
 *   Each category belongs to a specific shop owner.
 *
 * EXPORTS:
 *   getCategoriesByOwner, getCategoryById,
 *   createCategory, deleteCategory
 */

'use strict';

const db = require('../config/db');

const getCategoriesByOwner = (ownerId) =>
    db.prepare('SELECT * FROM categories WHERE owner_id = ? ORDER BY name ASC').all(ownerId);

const getCategoryById = (id, ownerId) =>
    db.prepare('SELECT * FROM categories WHERE id = ? AND owner_id = ?').get(id, ownerId);

/**
 * createCategory
 * The UNIQUE(owner_id, name) constraint prevents duplicate categories per owner.
 * @param {number} ownerId
 * @param {string} name
 */
const createCategory = (ownerId, name) => {
    const info = db.prepare('INSERT INTO categories (owner_id, name) VALUES (?, ?)').run(ownerId, name.trim());
    return getCategoryById(info.lastInsertRowid, ownerId);
};

const deleteCategory = (id, ownerId) => {
    // Products referencing this category will have category_id set to NULL (ON DELETE SET NULL).
    const info = db.prepare('DELETE FROM categories WHERE id = ? AND owner_id = ?').run(id, ownerId);
    return info.changes > 0;
};

module.exports = { getCategoriesByOwner, getCategoryById, createCategory, deleteCategory };
