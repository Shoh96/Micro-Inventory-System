/**
 * FILE: server/utils/exportHelper.js
 *
 * PURPOSE:
 *   Converts an array of plain JS objects into a CSV string.
 *   Zero external dependencies — pure implementation.
 *
 * EXPORTS:
 *   toCsv(rows, columns?) — returns a UTF-8 CSV string
 *
 * HOW IT FITS:
 *   Called by analyticsController when "export CSV" is requested.
 *   The controller sets Content-Type and Content-Disposition headers,
 *   then writes the CSV string directly to the response.
 */

'use strict';

/**
 * escapeCsvCell
 * Wraps a cell value in double quotes if it contains commas, quotes, or newlines.
 * Escapes internal double quotes by doubling them (RFC 4180 §2.7).
 *
 * @param {*} value — raw cell value (will be coerced to string)
 * @returns {string}  CSV-safe cell string
 */
const escapeCsvCell = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Wrap in quotes if contains comma, double-quote, or newline.
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

/**
 * toCsv
 * @param {object[]} rows    — array of plain objects (each row is one CSV line)
 * @param {string[]} [columns] — explicit column order; defaults to keys of first row
 * @returns {string}           Complete CSV string including header line
 */
const toCsv = (rows, columns) => {
    if (!rows || !rows.length) return '';

    // Derive column order from the first row if not explicitly provided.
    const cols = columns || Object.keys(rows[0]);

    // Header line.
    const header = cols.map(escapeCsvCell).join(',');

    // Data lines.
    const lines = rows.map((row) =>
        cols.map((col) => escapeCsvCell(row[col])).join(','),
    );

    return [header, ...lines].join('\r\n');
};

module.exports = { toCsv };
