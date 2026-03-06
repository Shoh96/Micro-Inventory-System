/**
 * FILE: client/js/dashboard.js
 *
 * PURPOSE:
 *   Powers the main dashboard page (dashboard.html).
 *   Handles:
 *     - Auth guard (redirect to login if no token)
 *     - Main sidebar navigation & section toggling (data-section nav buttons)
 *     - Role-based UI visibility (Clerk hides admin/owner nav items)
 *     - Loading and rendering KPI metrics
 *     - Admin user management (Users tab)
 *
 * NOTE:
 *   Products, Sales, Analytics sections are handled by their own JS modules
 *   (products.js, sales.js, analytics.js). This file only orchestrates the
 *   shell: navigation, auth, KPIs, and admin user management.
 */

'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
const API_BASE = '/api';

// ── Auth Guard ────────────────────────────────────────────────────────────────
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user) {
    window.location.href = 'index.html';
    throw new Error('Not authenticated'); // Stop further script execution
}

// Expose on window so other modules (products.js, sales.js) can read role/id
window.user = user;

// ── Core API fetch helper (shared by this file) ───────────────────────────────
const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
        const err = new Error(json.message || `API error ${res.status}`);
        err.statusCode = res.status;
        throw err;
    }
    return json;
};

// Expose globally so other modules can use the same authenticated fetch
window.apiFetch = apiFetch;

// ── Helper utilities ──────────────────────────────────────────────────────────
const formatCurrency = (value) => `${Number(value || 0).toLocaleString('fr-CM')} XAF`;
const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

// ── Sidebar user display ──────────────────────────────────────────────────────
const userDisplay = document.getElementById('user-display');
if (userDisplay) userDisplay.textContent = `${user.name} · ${user.role}`;

// ── Logout ────────────────────────────────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

// ── Role-based nav visibility ─────────────────────────────────────────────────
if (user.role === 'clerk') {
    // Clerks cannot see Analytics, Users, Settings nav items
    document.querySelectorAll('.nav-owner-only, .nav-admin-only, .nav-owner-admin').forEach(el => el.style.display = 'none');
    document.getElementById('btn-add-category')?.remove();
    document.getElementById('btn-add-supplier')?.remove();
    document.getElementById('btn-add-product')?.remove();
} else if (user.role === 'owner') {
    // Owners cannot see admin-only elements (e.g. Add Owner button)
    document.querySelectorAll('.nav-admin-only').forEach(el => el.style.display = 'none');
}
// Admins see everything — no hiding needed

// ── Section navigation ────────────────────────────────────────────────────────
const showSection = (name) => {
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
        s.hidden = true;
    });
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('active');
        b.removeAttribute('aria-current');
    });

    const section = document.getElementById(`section-${name}`);
    if (section) { section.classList.add('active'); section.hidden = false; }

    const btn = document.querySelector(`.nav-btn[data-section="${name}"]`);
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-current', 'page'); }

    // Lazy-load charts when analytics tab is first opened
    if (name === 'analytics' && window.Analytics) window.Analytics.load();
    // Load users table when users tab is opened
    if (name === 'users') loadUsers();
};

window.showSection = showSection;

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
});

// ── KPI Metrics ───────────────────────────────────────────────────────────────
const setKpi = (id, value) => {
    const el = document.getElementById(id)?.querySelector('.kpi-value');
    if (el) el.textContent = value;
};

const loadMetrics = async () => {
    if (user.role === 'admin') {
        document.getElementById('kpi-grid').style.display = 'none';
        const lsContainer = document.getElementById('low-stock-container');
        if (lsContainer) lsContainer.style.display = 'none';
        const adminGrid = document.getElementById('admin-kpi-grid');
        if (adminGrid) adminGrid.style.display = 'grid';

        try {
            const json = await apiFetch('/analytics/admin-metrics');
            const data = json.data || json;
            setKpi('admin-kpi-users', data.total_users || 0);
            setKpi('admin-kpi-owners', data.total_owners || 0);
            setKpi('admin-kpi-clerks', data.total_clerks || 0);
            setKpi('admin-kpi-system-revenue', formatCurrency(data.total_system_revenue));
            setKpi('admin-kpi-transactions', data.total_transactions || 0);
        } catch (e) {
            console.error('Failed to load admin metrics:', e.message);
        }
        return;
    }

    // Owner and Clerk KPIs
    try {
        const json = await apiFetch('/analytics/metrics');
        const data = json.data || json; // handle both {success, data} and flat shapes
        setKpi('kpi-stock-value', formatCurrency(data.total_stock_value));
        setKpi('kpi-revenue', formatCurrency(data.total_revenue));
        setKpi('kpi-profit', formatCurrency(data.total_profit));
        setKpi('kpi-products', data.total_products || 0);
        setKpi('kpi-lowstock', data.low_stock_count || 0);
        setKpi('kpi-sales', data.total_sales || 0);

        // Low-stock alert list
        const list = document.getElementById('low-stock-list');
        if (list) {
            if (data.low_stock_items?.length) {
                list.innerHTML = data.low_stock_items
                    .map(p => `<li><strong>${p.name}</strong> — ${p.quantity} remaining</li>`)
                    .join('');
            } else {
                list.innerHTML = '<li class="empty-state">All stock levels are healthy ✅</li>';
            }
        }
    } catch (e) {
        console.error('Failed to load shop metrics:', e.message);
    }
};

// Expose so products.js and sales.js can trigger refresh
window.Dashboard = { loadMetrics };

// For admin users, show the owner overview cards panel on the dashboard
if (user.role === 'admin') {
    const ownerCardsContainer = document.getElementById('admin-owner-cards-container');
    if (ownerCardsContainer) ownerCardsContainer.style.display = '';
}

// ── Admin User Management (Users Tab) ─────────────────────────────────────────
// NOTE: All user CRUD is handled by /js/users.js (modal-based).
// This stub remains only for backward compatibility in case any other
// script calls window.loadUsers.
// window.loadUsers is defined in users.js.

// ── Admin Dashboard: Owner Overview Cards ──────────────────────────────────────
const loadAdminOwnerCards = async () => {
    const container = document.getElementById('admin-owner-cards');
    if (!container) return;
    try {
        const json = await apiFetch('/analytics/owners');
        const owners = (json.data || []).filter(o => o.allow_admin_visibility);
        if (!owners.length) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;">No owners have enabled admin visibility yet.</p>';
            return;
        }
        // Fetch metrics for each owner in parallel
        const metrics = await Promise.allSettled(
            owners.map(o => apiFetch(`/analytics/owner-metrics?owner_id=${o.id}`))
        );
        container.innerHTML = owners.map((o, i) => {
            const d = metrics[i].status === 'fulfilled' ? (metrics[i].value.data || {}) : {};
            return `
              <div class="card" style="flex:1;min-width:220px;max-width:320px;cursor:pointer;" onclick="showSection('analytics')">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
                  <span style="font-size:1.4rem;">🏪</span>
                  <div>
                    <div style="font-weight:700;font-size:0.95rem;">${esc(d.shop_name || o.name)}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${esc(o.email)}</div>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
                  ${[['Revenue', `${fmt(d.total_revenue)} ${d.currency || 'XAF'}`],
                ['Profit', `${fmt(d.total_profit)} XAF`],
                ['Products', d.total_products || 0],
                ['Low Stock', d.low_stock_count || 0]
                ].map(([k, v]) => `
                    <div style="text-align:center;padding:0.35rem;background:var(--surface-2);border-radius:6px;">
                      <div style="font-size:0.68rem;color:var(--text-muted);text-transform:uppercase;">${k}</div>
                      <div style="font-size:0.85rem;font-weight:700;color:var(--accent);">${v}</div>
                    </div>`).join('')}
                </div>
              </div>`;
        }).join('');
    } catch (_) { }
};

// ── Initial load ──────────────────────────────────────────────────────────────
loadMetrics().then(() => {
    if (user.role === 'admin') loadAdminOwnerCards();
});

