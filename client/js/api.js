/**
 * FILE: client/js/api.js
 *
 * PURPOSE:
 *   Central Fetch API wrapper. Every other JS module uses this rather than
 *   calling fetch() directly. This ensures:
 *   - The Authorization header is always sent.
 *   - HTTP 401 responses automatically redirect to login.
 *   - All errors return a consistent { ok, status, data } shape.
 *
 * EXPORTS (as window.API):
 *   API.get(path)
 *   API.post(path, body)
 *   API.put(path, body)
 *   API.del(path)
 */

(() => {
    'use strict';

    // Base URL — in production this is the same origin as the page.
    const BASE = '/api';

    /**
     * getToken — reads JWT from localStorage.
     * @returns {string|null}
     */
    const getToken = () => localStorage.getItem('token');

    /**
     * request — core fetch wrapper.
     * @param {string} method
     * @param {string} path   — relative path, e.g. '/products'
     * @param {object} [body] — JSON body for POST/PUT
     * @returns {Promise<{ok, status, data}>}
     */
    const request = async (method, path, body) => {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const options = { method, headers };
        if (body !== undefined) options.body = JSON.stringify(body);

        const resp = await fetch(`${BASE}${path}`, options);

        // Auto-redirect on expired/missing token.
        if (resp.status === 401) {
            localStorage.clear();
            window.location.href = '/index.html';
            return { ok: false, status: 401, data: null };
        }

        // Some endpoints (CSV export) return text, not JSON.
        const contentType = resp.headers.get('Content-Type') || '';
        const data = contentType.includes('text/csv')
            ? await resp.text()
            : await resp.json().catch(() => null);

        return { ok: resp.ok, status: resp.status, data };
    };

    /**
     * downloadBlob — triggers a browser file download for CSV responses.
     * @param {string} path — API path returning CSV
     * @param {string} filename
     */
    const downloadBlob = async (path, filename) => {
        const token = getToken();
        const resp = await fetch(`${BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    window.API = {
        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, body),
        put: (path, body) => request('PUT', path, body),
        del: (path) => request('DELETE', path),
        downloadBlob,
    };
})();
