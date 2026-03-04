/**
 * FILE: server/models/activityLog.js
 *
 * PURPOSE:
 *   Append-only audit trail for every create/update/delete action.
 *   Never updates or deletes rows — only inserts.
 *
 * EXPORTS:
 *   logActivity   — write a new log entry
 *   getActivityLog — retrieve paginated log for an owner
 */

'use strict';

const db = require('../config/db');

/**
 * logActivity
 * Records who did what to which entity.
 *
 * @param {object} params
 * @param {number}  params.userId      - User who performed the action.
 * @param {string}  params.userName    - Snapshot of user's name (preserved if user is deleted).
 * @param {string}  params.action      - 'CREATE' | 'UPDATE' | 'DELETE' | custom.
 * @param {string}  params.entityType  - 'product' | 'sale' | 'category' | 'supplier' | 'user'.
 * @param {number}  params.entityId    - Primary key of the affected row.
 * @param {string}  [params.detail]    - Optional JSON string with context.
 */
const logActivity = ({ userId, userName, action, entityType, entityId, detail = '' }) => {
    db.prepare(`
    INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, action, entityType, entityId, detail);
};

/**
 * getActivityLog
 * Returns recent activity for reporting. Ordered newest-first.
 * Limit defaults to 100 to avoid enormous payloads.
 *
 * @param {number} ownerId - Scope to one owner's actions.
 * @param {number} limit
 */
const getActivityLog = (ownerId, limit = 100) =>
    db.prepare(`
    SELECT al.*
    FROM activity_log al
    WHERE al.user_id IN (
      SELECT id FROM users WHERE id = ? OR owner_id = ?
    )
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(ownerId, ownerId, limit);

module.exports = { logActivity, getActivityLog };
