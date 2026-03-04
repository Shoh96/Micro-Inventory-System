/**
 * FILE: electron/main.js
 *
 * PURPOSE:
 *   Electron main process for the Micro-Inventory Desktop App.
 *
 * HOW IT WORKS:
 *   1. Starts the Express server as a child Node process (or requires it directly).
 *   2. Creates a BrowserWindow that loads http://localhost:3000/index.html.
 *   3. Waits for the server to be ready before opening the window.
 *
 * PACKAGING:
 *   electron-builder packages this alongside the bundled server/ and client/
 *   directories into an NSIS one-click Windows installer (.exe).
 *   Node.js is bundled automatically by electron-builder's extraResources config.
 */

'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let serverProcess = null;

const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

/**
 * waitForServer
 * Polls the /health endpoint until the Express server responds.
 * Retries every 300ms up to 30 times (~9 seconds).
 *
 * @param {number} retries
 * @returns {Promise<void>}
 */
const waitForServer = (retries = 30) =>
    new Promise((resolve, reject) => {
        const check = () => {
            http.get(`${SERVER_URL}/health`, (res) => {
                if (res.statusCode === 200) resolve();
                else retry();
            }).on('error', retry);
        };
        const retry = () => {
            if (retries-- <= 0) return reject(new Error('Server did not start in time.'));
            setTimeout(check, 300);
        };
        check();
    });

/**
 * startServer
 * Forks the Express server as a child process.
 * Using fork() keeps the server in a separate OS process for stability.
 * The server's stdout/stderr is piped for debugging in development.
 */
const startServer = () => {
    // Path is relative to the app's resource directory when packaged.
    const serverPath = app.isPackaged
        ? path.join(process.resourcesPath, 'server', 'app.js')
        : path.join(__dirname, '..', 'server', 'app.js');

    serverProcess = fork(serverPath, [], {
        env: {
            ...process.env,
            PORT: String(SERVER_PORT),
            NODE_ENV: 'production',
            DB_PATH: path.join(app.getPath('userData'), 'inventory.db'),
            JWT_SECRET: 'micro_inv_electron_secret_change_in_production',
            CLIENT_ORIGIN: SERVER_URL,
        },
        silent: false,
    });

    serverProcess.on('error', (err) => console.error('[electron] Server error:', err));
    serverProcess.on('exit', (code) => console.log(`[electron] Server exited with code ${code}`));
};

/**
 * createWindow
 * Creates the Electron BrowserWindow after the server is ready.
 */
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'Micro-Inventory System',
        show: false, // Show only after content is ready to avoid white flash.
        backgroundColor: '#060d1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadURL(`${SERVER_URL}/index.html`);

    // Open external links in the default browser, not in Electron.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
};

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
    startServer();

    try {
        await waitForServer();
        createWindow();
    } catch (err) {
        console.error('[electron] Failed to connect to server:', err.message);
        app.quit();
    }

    // macOS: re-create window when dock icon is clicked.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
    if (serverProcess) serverProcess.kill();
});
