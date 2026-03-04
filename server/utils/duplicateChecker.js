/**
 * FILE: server/utils/duplicateChecker.js
 *
 * PURPOSE:
 *   Detects likely duplicate products before a new product is created.
 *   Uses normalised string comparison (lowercase, trimmed) to catch
 *   near-duplicates like "Maggi Cubes" vs "maggi cubes" vs "MAGGI CUBES".
 *
 * EXPORTS:
 *   findDuplicateCandidates — returns potential matches for a given name
 *
 * HOW IT FITS:
 *   Called by productController.createProduct before insertion.
 *   If matches are found, the controller returns a 409-style response with
 *   the candidates list, allowing the frontend to warn the user.
 */

'use strict';

const db = require('../config/db');

/**
 * findDuplicateCandidates
 * Searches for existing products with a similar name for the same owner.
 *
 * ALGORITHM:
 *   1. Exact case-insensitive match (highest confidence).
 *   2. Starts-with match (catches "Maggi" matching "Maggi Cubes").
 *   3. Contains match (catches typo prefixes).
 *   SQLite LIKE is case-insensitive for ASCII — sufficient for product names.
 *
 * @param {string} name    — the candidate product name to check
 * @param {number} ownerId — scope to this owner's products
 * @param {number} [excludeId] — exclude a product ID (for edit mode)
 *
 * @returns {object[]} Array of candidate product rows (may be empty).
 */
const findDuplicateCandidates = (name, ownerId, excludeId = null) => {
    const normalised = name.trim().toLowerCase();
    const prefix = `${normalised}%`;
    const contains = `%${normalised}%`;

    let sql = `
    SELECT id, name, quantity, category_id
    FROM products
    WHERE owner_id = ?
      AND (
        LOWER(TRIM(name)) = ?
        OR LOWER(TRIM(name)) LIKE ?
        OR LOWER(TRIM(name)) LIKE ?
      )
  `;
    const args = [ownerId, normalised, prefix, contains];

    if (excludeId) {
        sql += ' AND id != ?';
        args.push(excludeId);
    }

    return db.prepare(sql).all(...args);
};

module.exports = { findDuplicateCandidates };
