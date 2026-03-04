/**
 * FILE: client/js/app.js
 *
 * PURPOSE:
 *   Handles the authentication page (index.html).
 *   Manages the login/register tab switching, form submission via Fetch API,
 *   JWT storage, and redirect to dashboard on success.
 *
 * HOW IT FITS:
 *   Loaded only by index.html.
 *   On load, checks if a JWT already exists in localStorage and redirects
 *   authenticated users immediately to the dashboard.
 *
 * API COMMUNICATION:
 *   POST /api/auth/register — create account
 *   POST /api/auth/login    — obtain JWT
 *
 * TOKEN STORAGE:
 *   The JWT is stored in localStorage under the key "token".
 *   The user object (id, name, email) is stored under "user".
 *   These are read by dashboard.js to make authenticated requests.
 */

'use strict';

// ── API base URL ──────────────────────────────────────────────────────
// In production set this to your deployed API URL, e.g. https://api.yourapp.com
const API_BASE = 'http://localhost:3000/api';

// ── Redirect if already logged in ─────────────────────────────────────
// Prevent authenticated users from seeing the login page again.
if (localStorage.getItem('token')) {
    window.location.href = 'dashboard.html';
}

// ── DOM references ─────────────────────────────────────────────────────
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const panelLogin = document.getElementById('panel-login');
const panelReg = document.getElementById('panel-register');

const loginForm = document.getElementById('login-form');
const loginMsg = document.getElementById('login-msg');
const loginBtn = document.getElementById('login-btn');

const registerForm = document.getElementById('register-form');
const registerMsg = document.getElementById('register-msg');
const registerBtn = document.getElementById('register-btn');

// ── Tab switching ──────────────────────────────────────────────────────

/**
 * switchTab
 * Shows the selected auth panel and updates ARIA attributes.
 *
 * @param {'login'|'register'} which - Which tab to activate.
 */
const switchTab = (which) => {
    const isLogin = which === 'login';

    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabRegister.setAttribute('aria-selected', String(!isLogin));

    panelLogin.classList.toggle('active', isLogin);
    panelReg.classList.toggle('active', !isLogin);
};

tabLogin.addEventListener('click', () => switchTab('login'));
tabRegister.addEventListener('click', () => switchTab('register'));

// ── Shared helper utilities ────────────────────────────────────────────

/**
 * showMsg
 * Displays a status message below a form.
 *
 * @param {HTMLElement} el      - The message container.
 * @param {string}      text    - Message text to display.
 * @param {'error'|'success'} type - Visual style.
 */
const showMsg = (el, text, type = 'error') => {
    el.textContent = text;
    el.className = `auth-msg ${type}`;
};

/**
 * setLoading
 * Toggles a button between its normal and loading states.
 *
 * @param {HTMLButtonElement} btn     - The submit button.
 * @param {boolean}           loading - Whether to show spinner.
 */
const setLoading = (btn, loading) => {
    const textEl = btn.querySelector('.btn-text');
    const spinnerEl = btn.querySelector('.btn-spinner');
    btn.disabled = loading;
    textEl.classList.toggle('hidden', loading);
    spinnerEl.classList.toggle('hidden', !loading);
};

/**
 * storeSession
 * Saves the JWT and user object to localStorage after successful auth.
 *
 * @param {string} token - JWT string returned from the API.
 * @param {object} user  - User object { id, name, email }.
 */
const storeSession = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
};

// ── Login ──────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg(loginMsg, '');
    setLoading(loginBtn, true);

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
            showMsg(loginMsg, json.message || 'Login failed.', 'error');
            return;
        }

        // Store credentials and redirect.
        storeSession(json.data.token, json.data.user);
        window.location.href = 'dashboard.html';
    } catch {
        showMsg(loginMsg, 'Could not reach the server. Is it running?', 'error');
    } finally {
        setLoading(loginBtn, false);
    }
});

// ── Register ───────────────────────────────────────────────────────────

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMsg(registerMsg, '');
    setLoading(registerBtn, true);

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
            showMsg(registerMsg, json.message || 'Registration failed.', 'error');
            return;
        }

        // Auto-login after successful registration.
        storeSession(json.data.token, json.data.user);
        window.location.href = 'dashboard.html';
    } catch {
        showMsg(registerMsg, 'Could not reach the server. Is it running?', 'error');
    } finally {
        setLoading(registerBtn, false);
    }
});
