/**
 * FILE: client/js/analytics.js
 *
 * PURPOSE:
 *   Renders all analytics charts and tables.
 *   For Admins: shows owner selector, comparison mode, per-owner drilldown.
 *   For Owners/Clerks: shows their own shop analytics unchanged.
 *
 * DEPENDS ON: window.apiFetch, window.user, Chart.js (global)
 */

(() => {
    'use strict';

    let revenueChart = null;
    let topChart = null;
    let categoryChart = null;
    let ownerRevenueChart = null;
    let comparisonChart = null;

    // ── Chart helpers ──────────────────────────────────────────────────────────
    const destroyAndCreate = (instance, canvasId, config) => {
        if (instance) instance.destroy();
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        return new Chart(ctx, config);
    };

    const makeGradient = (ctx, color) => {
        const g = ctx.createLinearGradient(0, 0, 0, 300);
        g.addColorStop(0, color.replace('1)', '0.3)'));
        g.addColorStop(1, color.replace('1)', '0.0)'));
        return g;
    };

    const CHART_COLORS = [
        'rgba(56, 189, 248, 1)', 'rgba(167, 243, 208, 1)', 'rgba(251, 191, 36, 1)',
        'rgba(252, 165, 165, 1)', 'rgba(196, 181, 253, 1)', 'rgba(249, 168, 212, 1)',
    ];

    const fmt = (n) => Number(n || 0).toLocaleString('fr-CM');
    const fmtDate = (d) => d?.substring(0, 10) || '—';

    // ── Own-shop charts (owner/clerk view) ────────────────────────────────────

    const loadRevenueChart = async () => {
        const json = await apiFetch('/analytics/revenue?days=30').catch(() => null);
        if (!json) return;
        const rows = json.data || [];
        const ctx = document.getElementById('revenue-chart')?.getContext('2d');
        if (!ctx) return;
        revenueChart = destroyAndCreate(revenueChart, 'revenue-chart', {
            type: 'line',
            data: {
                labels: rows.map(r => r.sale_day),
                datasets: [
                    {
                        label: 'Revenue',
                        data: rows.map(r => r.revenue),
                        borderColor: 'rgba(56, 189, 248, 1)',
                        backgroundColor: makeGradient(ctx, 'rgba(56, 189, 248, 1)'),
                        fill: true, tension: 0.4, pointRadius: 4,
                    },
                    {
                        label: 'Profit',
                        data: rows.map(r => r.profit),
                        borderColor: 'rgba(167, 243, 208, 1)',
                        backgroundColor: makeGradient(ctx, 'rgba(167, 243, 208, 1)'),
                        fill: true, tension: 0.4, pointRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#e2e8f0' } },
                    tooltip: { mode: 'index', intersect: false },
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                },
            },
        });
    };

    const loadTopProductsChart = async () => {
        const json = await apiFetch('/analytics/top-products?limit=8&days=30').catch(() => null);
        if (!json) return;
        const rows = json.data || [];
        topChart = destroyAndCreate(topChart, 'top-products-chart', {
            type: 'bar',
            data: {
                labels: rows.map(r => r.name),
                datasets: [{ label: 'Units Sold', data: rows.map(r => r.total_qty_sold), backgroundColor: CHART_COLORS, borderRadius: 6 }],
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                },
            },
        });
    };

    const loadCategoryChart = async () => {
        const json = await apiFetch('/analytics/categories').catch(() => null);
        if (!json) return;
        const rows = json.data || [];
        categoryChart = destroyAndCreate(categoryChart, 'category-chart', {
            type: 'doughnut',
            data: {
                labels: rows.map(r => r.category),
                datasets: [{ data: rows.map(r => r.total_revenue), backgroundColor: CHART_COLORS, hoverOffset: 8 }],
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'right', labels: { color: '#e2e8f0' } } },
            },
        });
    };

    const loadStockPredictions = async () => {
        const tbody = document.getElementById('predictions-tbody');
        if (!tbody) return;
        const json = await apiFetch('/analytics/stock-predictions').catch(() => null);
        if (!json) return;
        tbody.innerHTML = (json.data || []).map(p => `
          <tr class="${p.restock_needed ? 'row-low-stock' : ''}">
            <td>${p.name}</td><td>${p.quantity}</td><td>${p.avg_daily_sales}</td>
            <td>${p.days_remaining !== null ? p.days_remaining + ' days' : 'No recent sales'}</td>
            <td>${p.restock_needed ? '<span class="badge badge-danger">Restock Now</span>' : '<span class="badge badge-success">OK</span>'}</td>
          </tr>`).join('');
    };

    const loadActivityLog = async () => {
        const tbody = document.getElementById('activity-tbody');
        if (!tbody) return;
        const json = await apiFetch('/analytics/activity?limit=30').catch(() => null);
        if (!json) return;
        tbody.innerHTML = (json.data || []).map(a => `
          <tr>
            <td>${fmtDate(a.created_at)}</td>
            <td>${a.user_name}</td>
            <td><span class="badge badge-${a.action === 'DELETE' ? 'danger' : a.action === 'UPDATE' ? 'warning' : 'success'}">${a.action}</span></td>
            <td>${a.entity_type}</td>
            <td>${a.detail || '—'}</td>
          </tr>`).join('');
    };

    // ── Admin: owner selector & comparison ────────────────────────────────────

    let _owners = [];            // full owner list from API
    let _selectedOwnerIds = [];  // currently selected owner IDs

    const renderOwnerButtons = () => {
        const container = document.getElementById('owner-selector-buttons');
        if (!container) return;

        if (!_owners.length) {
            container.innerHTML = '<span style="color:var(--text-muted);font-size:0.875rem;">No owners have enabled admin visibility yet.</span>';
            return;
        }

        container.innerHTML = _owners.map(o => {
            const active = _selectedOwnerIds.includes(o.id);
            return `<button 
                class="btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}" 
                data-owner-id="${o.id}"
                title="${o.email}"
                onclick="Analytics._toggleOwner(${o.id})"
            >${o.shop_name || o.name}</button>`;
        }).join('');
    };

    const toggleOwner = (id) => {
        if (_selectedOwnerIds.includes(id)) {
            _selectedOwnerIds = _selectedOwnerIds.filter(x => x !== id);
        } else {
            _selectedOwnerIds.push(id);
        }
        renderOwnerButtons();
        applyOwnerSelection();
    };

    const applyOwnerSelection = async () => {
        const drilldown = document.getElementById('owner-drilldown');
        const compBar = document.getElementById('comparison-bar');
        const compKpiRow = document.getElementById('comparison-kpi-row');

        if (_selectedOwnerIds.length === 0) {
            // Show admin's own analytics
            if (drilldown) drilldown.style.display = 'none';
            if (compBar) compBar.style.display = 'none';
            if (compKpiRow) compKpiRow.style.display = 'none';
            loadAllOwnCharts();
            return;
        }

        if (_selectedOwnerIds.length === 1) {
            // Single owner drilldown
            if (compBar) compBar.style.display = 'none';
            if (compKpiRow) compKpiRow.style.display = 'none';
            await loadOwnerDrilldown(_selectedOwnerIds[0]);
            if (drilldown) drilldown.style.display = '';
        } else {
            // Multi-owner comparison
            if (drilldown) drilldown.style.display = 'none';
            await loadOwnerComparison(_selectedOwnerIds);
        }
    };

    const loadOwnerDrilldown = async (ownerId) => {
        const json = await apiFetch(`/analytics/owner-metrics?owner_id=${ownerId}`).catch(() => null);
        if (!json || !json.data) return;
        const d = json.data;
        const owner = _owners.find(o => o.id === ownerId);

        // Update title
        const title = document.getElementById('drilldown-title');
        if (title) title.textContent = `📊 ${d.shop_name || owner?.name} — Overview`;

        // KPI mini row
        const kpiRow = document.getElementById('drilldown-kpis');
        if (kpiRow) {
            kpiRow.innerHTML = [
                ['Stock Value', `${fmt(d.total_stock_value)} ${d.currency}`],
                ['Revenue', `${fmt(d.total_revenue)} ${d.currency}`],
                ['Profit', `${fmt(d.total_profit)} ${d.currency}`],
                ['Products', d.total_products],
                ['Sales', d.total_sales],
                ['Low Stock', d.low_stock_count],
            ].map(([label, value]) => `
                <div style="background:var(--surface-2,#0f172a);border-radius:8px;padding:0.75rem;text-align:center;">
                    <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
                    <div style="font-size:1.1rem;font-weight:700;color:var(--accent,#38bdf8);margin-top:0.25rem;">${value}</div>
                </div>`).join('');
        }

        // Products table
        const prodTbody = document.getElementById('drilldown-products-tbody');
        if (prodTbody) {
            prodTbody.innerHTML = (d.products || []).map(p => `
              <tr>
                <td>${p.name}</td>
                <td>${p.category_name || '—'}</td>
                <td class="${p.quantity <= 5 ? 'text-danger' : ''}">${p.quantity}</td>
                <td>${fmt(p.cost_price)}</td>
                <td>${fmt(p.selling_price)}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="empty-state">No products</td></tr>';
        }

        // Sales table
        const salesTbody = document.getElementById('drilldown-sales-tbody');
        if (salesTbody) {
            salesTbody.innerHTML = (d.sales || []).map(s => `
              <tr>
                <td>${fmtDate(s.sale_date)}</td>
                <td>${s.product_name}</td>
                <td>${s.quantity_sold}</td>
                <td>${fmt(s.total_revenue)}</td>
                <td>${fmt(s.total_profit)}</td>
              </tr>`).join('') || '<tr><td colspan="5" class="empty-state">No sales</td></tr>';
        }

        // Owner revenue chart
        const chartTitle = document.getElementById('drilldown-chart-title');
        if (chartTitle) chartTitle.textContent = `${d.shop_name || owner?.name} — Revenue & Profit (30 days)`;
        const ctx = document.getElementById('owner-revenue-chart')?.getContext('2d');
        if (ctx) {
            const rows = d.revenue || [];
            ownerRevenueChart = destroyAndCreate(ownerRevenueChart, 'owner-revenue-chart', {
                type: 'line',
                data: {
                    labels: rows.map(r => r.sale_day),
                    datasets: [
                        { label: 'Revenue', data: rows.map(r => r.revenue), borderColor: 'rgba(56,189,248,1)', backgroundColor: makeGradient(ctx, 'rgba(56,189,248,1)'), fill: true, tension: 0.4, pointRadius: 3 },
                        { label: 'Profit', data: rows.map(r => r.profit), borderColor: 'rgba(167,243,208,1)', backgroundColor: makeGradient(ctx, 'rgba(167,243,208,1)'), fill: true, tension: 0.4, pointRadius: 3 },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: { legend: { labels: { color: '#e2e8f0' } }, tooltip: { mode: 'index', intersect: false } },
                    scales: {
                        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                    },
                },
            });
        }
    };

    const loadOwnerComparison = async (ids) => {
        const json = await apiFetch(`/analytics/owner-comparison?owner_ids=${ids.join(',')}`).catch(() => null);
        if (!json || !json.data) return;
        const owners = json.data;

        const compBar = document.getElementById('comparison-bar');
        const label = document.getElementById('comparison-label');
        const kpiRow = document.getElementById('comparison-kpi-row');

        if (compBar) compBar.style.display = '';
        if (label) label.textContent = `Comparing: ${owners.map(o => o.shop_name || o.owner_name).join(' vs ')}`;

        // KPI cards per owner side-by-side
        if (kpiRow) {
            kpiRow.style.display = 'flex';
            kpiRow.innerHTML = owners.map(o => `
              <div style="flex:1;min-width:180px;background:var(--surface-2,#0f172a);border-radius:10px;padding:1rem;">
                <h4 style="color:var(--accent,#38bdf8);margin-bottom:0.75rem;font-size:0.95rem;">${o.shop_name || o.owner_name}</h4>
                <div style="display:grid;gap:0.5rem;">
                  ${[
                    ['Revenue', `${fmt(o.total_revenue)} ${o.currency}`],
                    ['Profit', `${fmt(o.total_profit)} ${o.currency}`],
                    ['Stock Value', `${fmt(o.total_stock_value)} ${o.currency}`],
                    ['Products', o.total_products],
                    ['Sales', o.total_sales],
                    ['Low Stock', o.low_stock_count],
                ].map(([k, v]) => `
                    <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
                      <span style="color:var(--text-muted);">${k}</span>
                      <span style="font-weight:600;">${v}</span>
                    </div>`).join('')}
                </div>
              </div>`).join('');
        }

        // Grouped comparison bar chart (reuse category-chart canvas)
        comparisonChart = destroyAndCreate(comparisonChart, 'category-chart', {
            type: 'bar',
            data: {
                labels: ['Revenue', 'Profit', 'Stock Value'],
                datasets: owners.map((o, i) => ({
                    label: o.shop_name || o.owner_name,
                    data: [o.total_revenue, o.total_profit, o.total_stock_value],
                    backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    borderRadius: 6,
                })),
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#e2e8f0' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                },
            },
        });
    };

    const loadAllOwnCharts = async () => {
        await Promise.all([
            loadRevenueChart(),
            loadTopProductsChart(),
            loadCategoryChart(),
            loadStockPredictions(),
            loadActivityLog(),
        ]);
    };

    // ── Admin owner panel button wiring ───────────────────────────────────────
    document.getElementById('btn-view-all-owners')?.addEventListener('click', async () => {
        _selectedOwnerIds = _owners.map(o => o.id);
        renderOwnerButtons();
        await applyOwnerSelection();
    });

    document.getElementById('btn-clear-owner')?.addEventListener('click', () => {
        _selectedOwnerIds = [];
        renderOwnerButtons();
        const drilldown = document.getElementById('owner-drilldown');
        const compBar = document.getElementById('comparison-bar');
        const kpiRow = document.getElementById('comparison-kpi-row');
        if (drilldown) drilldown.style.display = 'none';
        if (compBar) compBar.style.display = 'none';
        if (kpiRow) kpiRow.style.display = 'none';
        loadAllOwnCharts();
    });

    document.getElementById('btn-clear-comparison')?.addEventListener('click', () => {
        _selectedOwnerIds = [];
        renderOwnerButtons();
        applyOwnerSelection();
    });

    // ── CSV export ────────────────────────────────────────────────────────────
    document.getElementById('btn-export-sales')?.addEventListener('click', () => {
        API.downloadBlob('/analytics/export/sales', 'sales_export.csv');
    });
    document.getElementById('btn-export-products')?.addEventListener('click', () => {
        API.downloadBlob('/analytics/export/products', 'products_export.csv');
    });

    // ── Main load ─────────────────────────────────────────────────────────────
    const load = async () => {
        const isAdmin = window.user?.role === 'admin';

        if (isAdmin) {
            // Show admin owner panel
            const panel = document.getElementById('analytics-owner-panel');
            if (panel) panel.style.display = '';

            // Fetch opted-in owners
            try {
                const json = await apiFetch('/analytics/owners');
                _owners = (json.data || []).filter(o => o.allow_admin_visibility);
                renderOwnerButtons();
            } catch (e) {
                console.error('Failed to load owner list:', e);
            }
        }

        // Always load own charts (for owners/clerks, or admin's own view)
        await loadAllOwnCharts();
    };

    // Expose public API
    window.Analytics = { load, _toggleOwner: toggleOwner };
})();
