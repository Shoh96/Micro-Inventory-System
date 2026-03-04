/**
 * FILE: client/js/auth.js
 *
 * PURPOSE:
 *   Handles the login/register page (index.html).
 *   - Tabs: toggles between Login and Register panels.
 *   - Submission: calls API, stores JWT + user on success, redirects.
 *   - Guard: if already logged in, jumps straight to dashboard.
 */

(() => {
    'use strict';

    // If already authenticated, skip to dashboard.
    if (localStorage.getItem('token')) {
        window.location.href = '/dashboard.html';
        return;
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    document.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${target}`).classList.add('active');
            document.getElementById('form-error').textContent = '';
        });
    });

    const showError = (msg) => { document.getElementById('form-error').textContent = msg; };

    // ── Login form ────────────────────────────────────────────────────────────
    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value.trim();
        const password = e.target.password.value;
        const btn = e.target.querySelector('button');
        btn.disabled = true; btn.textContent = 'Signing in…';

        const { ok, data } = await API.post('/auth/login', { email, password });
        btn.disabled = false; btn.textContent = 'Sign In';

        if (!ok) return showError(data?.message || 'Login failed.');

        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        window.location.href = '/dashboard.html';
    });

    // ── Register form ─────────────────────────────────────────────────────────
    document.getElementById('form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.name.value.trim();
        const email = e.target.email.value.trim();
        const password = e.target.password.value;
        const btn = e.target.querySelector('button');
        btn.disabled = true; btn.textContent = 'Creating account…';

        const { ok, data } = await API.post('/auth/register', { name, email, password, role: 'owner' });
        btn.disabled = false; btn.textContent = 'Create Account';

        if (!ok) return showError(data?.message || 'Registration failed.');

        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        window.location.href = '/dashboard.html';
    });
})();
