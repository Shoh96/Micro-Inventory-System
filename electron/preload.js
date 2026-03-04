/**
 * FILE: electron/preload.js
 *
 * PURPOSE:
 *   Electron preload script runs in a sandboxed context bridging main and renderer.
 *   Currently exposes nothing — kept minimal because the app is a web page served
 *   over localhost and all backend communication is via plain HTTP fetch calls.
 *   Extend this file if you ever need to expose Node APIs to the browser page.
 */

'use strict';

const { contextBridge } = require('electron');

// Expose app version to the browser page via window.electronApp.version
contextBridge.exposeInMainWorld('electronApp', {
    version: process.env.npm_package_version || '2.0.0',
});
