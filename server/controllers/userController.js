/**
 * FILE: server/controllers/userController.js (V2)
 *
 * PURPOSE:
 *   Admin + owner user management: list users, update roles, deactivate.
 *   Admins see all users; owners see only their own clerks.
 *
 * EXPORTS:
 *   listUsers, updateRole, deactivate, createClerk
 *
 * ROUTES (admin/owner only):
 *   GET    /api/users
 *   POST   /api/users/clerk        (owner: create clerk)
 *   PUT    /api/users/:id/role     (admin only)
 *   DELETE /api/users/:id          (admin only)
 */

'use strict';

const bcrypt = require('bcryptjs');
const userModel = require('../models/user');

const SALT_ROUNDS = 12;

/**
 * listUsers — returns users visible to the calling user.
 * Admin: all users. Owner: themselves + their clerks.
 */
const listUsers = (req, res, next) => {
    try {
        const ownerId = req.user.role === 'admin' ? null : req.user.id;
        const users = userModel.getUsersByOwner(ownerId);
        return res.status(200).json({ success: true, data: users });
    } catch (err) { next(err); }
};

/**
 * createClerk — owner creates a clerk account subordinate to themselves.
 * @route POST /api/users/clerk
 */
const createClerk = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'name, email, and password required.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
        const clerk = userModel.createUser({
            name, email: email.toLowerCase(), password_hash,
            role: 'clerk', owner_id: req.user.id,
        });

        return res.status(201).json({ success: true, message: 'Clerk account created.', data: clerk });
    } catch (err) {
        if (err.message?.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ success: false, message: 'Email already in use.' });
        }
        next(err);
    }
};

/**
 * updateRole — admin changes a user's role.
 * @route PUT /api/users/:id/role
 */
const updateRole = (req, res, next) => {
    try {
        const { role } = req.body;
        if (!['admin', 'owner', 'clerk'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role.' });
        }
        const user = userModel.updateUserRole(parseInt(req.params.id, 10), role);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        return res.status(200).json({ success: true, data: user });
    } catch (err) { next(err); }
};

/**
 * deactivate — soft-deletes a user (admin only).
 * @route DELETE /api/users/:id
 */
const deactivate = (req, res, next) => {
    try {
        userModel.deactivateUser(parseInt(req.params.id, 10));
        return res.status(200).json({ success: true, message: 'User deactivated.' });
    } catch (err) { next(err); }
};

module.exports = { listUsers, createClerk, updateRole, deactivate };
