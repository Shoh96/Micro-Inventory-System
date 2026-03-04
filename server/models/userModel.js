/**
 * FILE: server/models/userModel.js
 *
 * PURPOSE:
 *   All database operations relating to the `users` table.
 *   Keeps raw SQL out of controllers, making queries easy to test
 *   and modify independently.
 *
 * EXPORTS:
 *   createUser      — inserts a new user row and returns it
 *   findUserByEmail — looks up a user by email address
 *   findUserById    — looks up a user by primary key
 *
 * HOW IT FITS:
 *   Imported exclusively by authController.js.
 */

'use strict';

const db = require('../config/db');

/**
 * createUser
 * Inserts a new shop-owner account into the database.
 *
 * @param {object} userData
 * @param {string} userData.name          - The user's display name.
 * @param {string} userData.email         - The user's email (must be unique).
 * @param {string} userData.password_hash - bcrypt hash of the plain-text password.
 *
 * @returns {object} The complete newly-inserted user row (including id and created_at).
 * @throws  {Error}  If the email already exists (UNIQUE constraint violation).
 */
const createUser = ({ name, email, password_hash }) => {
    // INSERT and immediately SELECT the newly created row so we can
    // return the full record (including the auto-generated id).
    const stmt = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
  `);

    const info = stmt.run(name, email, password_hash);

    // Fetch and return the complete row using the lastInsertRowid.
    return db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?')
        .get(info.lastInsertRowid);
};

/**
 * findUserByEmail
 * Retrieves a user row by email address.
 * Used during login to locate the account before verifying the password.
 *
 * @param {string} email - The email address to look up.
 * @returns {object|undefined} The full user row (including password_hash), or
 *                             undefined if no account exists with that email.
 */
const findUserByEmail = (email) =>
    db.prepare('SELECT * FROM users WHERE email = ?').get(email);

/**
 * findUserById
 * Retrieves a user row by primary key.
 * Used when decoding a JWT and needing to confirm the account still exists.
 *
 * @param {number} id - The user's primary key.
 * @returns {object|undefined} The user row without password_hash, or undefined.
 */
const findUserById = (id) =>
    db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(id);

module.exports = { createUser, findUserByEmail, findUserById };
