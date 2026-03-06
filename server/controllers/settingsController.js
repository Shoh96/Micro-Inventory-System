/**
 * FILE: server/controllers/settingsController.js
 * 
 * PURPOSE:
 *   Handles API requests for user profile management, shop global settings, 
 *   and database backup operations.
 */

'use strict';

const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const userModel = require('../models/user');
const shopSettingsModel = require('../models/shopSettings');
const dbConfig = require('../config/db'); // Just to get the path context if needed, but we'll use env or default.

const SALT_ROUNDS = 12;

// Helper to get exactly which owner's data we are dealing with
const resolveOwnerId = (user) => (user.role === 'clerk' ? user.owner_id : user.id);

/**
 * getProfile
 * Returns the logged-in user's profile info.
 */
const getProfile = (req, res, next) => {
    try {
        const user = userModel.findUserById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { password_hash: _removed, ...safeUser } = user;
        return res.status(200).json({ success: true, data: safeUser });
    } catch (err) { next(err); }
};

/**
 * updateProfile
 * Updates name and email.
 */
const updateProfile = (req, res, next) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) {
            return res.status(400).json({ success: false, message: 'Name and email are required.' });
        }

        // Use the db connection directly for a quick update 
        // (ideally we'd add updateUserProfile to the model)
        const db = require('../config/db');
        try {
            db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email.toLowerCase(), req.user.id);
        } catch (dbErr) {
            if (dbErr.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ success: false, message: 'Email is already in use.' });
            }
            throw dbErr;
        }

        const updated = userModel.findUserById(req.user.id);
        const { password_hash: _removed, ...safeUser } = updated;
        return res.status(200).json({ success: true, message: 'Profile updated.', data: safeUser });
    } catch (err) { next(err); }
};

/**
 * changePassword
 * Verifies current password before setting a new one.
 */
const changePassword = async (req, res, next) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Current and new password are required.' });
        }
        if (new_password.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
        }

        const user = userModel.findUserById(req.user.id);
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
        }

        const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);
        userModel.updateUserPassword(user.id, password_hash);

        return res.status(200).json({ success: true, message: 'Password changed successfully.' });
    } catch (err) { next(err); }
};

/**
 * getShopSettings
 * Returns shop configuration. Accessible by Owner and Admin.
 */
const getShopSettings = (req, res, next) => {
    try {
        // Clerks shouldn't even reach here due to route middleware, but just in case:
        if (req.user.role === 'clerk') return res.status(403).json({ success: false, message: 'Forbidden' });

        // Admin viewing settings? By default we'll show the admin's (empty) or 
        // we'd need an owner_id query param. For now, admin acts on their own ID 
        // which might return empty defaults. Realistically only owner edits this.
        const ownerId = req.user.role === 'admin' && req.query.owner_id
            ? parseInt(req.query.owner_id, 10)
            : req.user.id;

        const settings = shopSettingsModel.getSettings(ownerId);
        return res.status(200).json({ success: true, data: settings });
    } catch (err) { next(err); }
};

/**
 * updateShopSettings
 * Updates shop configuration.
 */
const updateShopSettings = (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const updated = shopSettingsModel.updateSettings(ownerId, req.body);
        return res.status(200).json({ success: true, message: 'Shop settings updated.', data: updated });
    } catch (err) { next(err); }
};

/**
 * exportDatabase
 * Sends the SQLite file down for backup.
 */
const exportDatabase = (req, res, next) => {
    try {
        const dbPath = process.env.DB_PATH
            ? path.resolve(process.env.DB_PATH)
            : path.join(__dirname, '..', 'data', 'inventory.db');

        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ success: false, message: 'Database file not found.' });
        }

        res.download(dbPath, `backup_${new Date().toISOString().slice(0, 10)}.db`);
    } catch (err) { next(err); }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    getShopSettings,
    updateShopSettings,
    exportDatabase
};
