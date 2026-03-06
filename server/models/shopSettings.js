/**
 * FILE: server/models/shopSettings.js
 * 
 * PURPOSE:
 *   Handles database interactions for the shop_settings table.
 */

'use strict';

const db = require('../config/db');

/**
 * getSettings
 * Returns the shop settings for a specific owner.
 * If none exist for some reason, inserts defaults and returns them.
 */
const getSettings = (ownerId) => {
    let settings = db.prepare('SELECT * FROM shop_settings WHERE owner_id = ?').get(ownerId);

    if (!settings) {
        // Fallback for existing owners who registered before V2.1
        db.prepare(`
            INSERT INTO shop_settings (owner_id, shop_name)
            VALUES (?, 'My Shop')
        `).run(ownerId);
        settings = db.prepare('SELECT * FROM shop_settings WHERE owner_id = ?').get(ownerId);
    }

    return settings;
};

/**
 * updateSettings
 * Updates the given fields in shop_settings for a specific owner.
 */
const updateSettings = (ownerId, payload) => {
    const allowedFields = ['shop_name', 'shop_address', 'currency', 'low_stock_threshold', 'tax_percentage', 'logo_url', 'enable_low_stock_alerts', 'enable_sales_summary', 'allow_admin_visibility'];

    const sets = [];
    const values = [];

    Object.keys(payload).forEach((key) => {
        if (allowedFields.includes(key)) {
            sets.push(`${key} = ?`);
            values.push(payload[key]);
        }
    });

    if (sets.length === 0) return getSettings(ownerId);

    sets.push("updated_at = datetime('now')");
    values.push(ownerId);

    db.prepare(`
        UPDATE shop_settings
        SET ${sets.join(', ')}
        WHERE owner_id = ?
    `).run(...values);

    return getSettings(ownerId);
};

module.exports = {
    getSettings,
    updateSettings
};
