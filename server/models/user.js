/**
 * FILE: server/models/user.js
 *
 * PURPOSE:
 *   All database operations for the `users` table.
 *   V2 adds role, owner_id, and is_active columns.
 *
 * EXPORTS:
 *   createUser, findUserByEmail, findUserById,
 *   getUsersByOwner, updateUserRole, deactivateUser
 */

'use strict';

const db = require('../config/db');

/**
 * createUser — inserts a new user and returns the safe (no hash) row.
 * @param {{name,email,password_hash,role,owner_id}} data
 */
const createUser = ({ name, email, password_hash, role = 'owner', owner_id = null }) => {
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, owner_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, email, password_hash, role, owner_id);
  return findUserById(info.lastInsertRowid);
};

/**
 * findUserByEmail — includes password_hash for login comparison.
 * @param {string} email
 */
const findUserByEmail = (email) =>
  db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);

/**
 * findUserById — excludes password_hash.
 * @param {number} id
 */
const findUserById = (id) =>
  db.prepare('SELECT id, name, email, role, owner_id, is_active, created_at FROM users WHERE id = ?').get(id);

/**
 * getUsersByOwner — list all clerks belonging to a given owner.
 * Admins can use this to see all users (pass null for ownerId to get all).
 * @param {number|null} ownerId
 */
const getUsersByOwner = (ownerId) => {
  if (ownerId === null) {
    // Admin view — all users.
    return db.prepare(`
      SELECT id, name, email, role, owner_id, is_active, created_at FROM users ORDER BY created_at DESC
    `).all();
  }
  return db.prepare(`
    SELECT id, name, email, role, owner_id, is_active, created_at
    FROM users WHERE owner_id = ? OR id = ? ORDER BY created_at DESC
  `).all(ownerId, ownerId);
};

/**
 * updateUserRole — changes a user's role. Admin only.
 * @param {number} userId
 * @param {string} newRole — 'admin' | 'owner' | 'clerk'
 */
const updateUserRole = (userId, newRole) => {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);
  return findUserById(userId);
};

/**
 * deactivateUser — soft-deletes a user by setting is_active = 0.
 * Data is preserved; the user simply cannot log in.
 * @param {number} userId
 */
const deactivateUser = (userId) => {
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);
};

/**
 * updateUserPassword — changes a user's password.
 * @param {number} userId
 * @param {string} newHash
 */
const updateUserPassword = (userId, newHash) => {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
};

module.exports = { createUser, findUserByEmail, findUserById, getUsersByOwner, updateUserRole, updateUserPassword, deactivateUser };
