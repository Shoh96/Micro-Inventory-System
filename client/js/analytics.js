/**
 * FILE: client/js/analytics.js
 *
 * PURPOSE:
 *   Renders all analytics charts using Chart.js (loaded via CDN in dashboard.html).
 *   Charts:
 *     1. Revenue & Profit Line Chart — daily trend over last 30 days
 *     2. Top Products Bar Chart    — by units sold
 *     3. Category Doughnut Chart  — revenue by category
 *   Also renders:
 *     - Stock predictions table with restock flags
 *     - Activity log table
 *     - CSV export buttons
 *
 * DEPENDS ON: window.API, Chart.js (global Chart)
 */

(() => {
    'use strict';

    let revenueChart = null;
    let topChart = null;
    let categoryChart = null;

    // ── Chart.js helpers ──────────────────────────────────────────────────────

    /**
     * destroyAndCreate — prevents Chart.js duplicate canvas error when section
     * is refreshed. Destroys existing instance before creating a new one.
     */
    const destroyAndCreate = (instance, canvasId, config) => {
        if (instance) instance.destroy();
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        return new Chart(ctx, config);
    };

    // Shared gradient background for area charts.
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

    // ── Revenue chart ─────────────────────────────────────────────────────────

    const loadRevenueChart = async () => {
        const { ok, data } = await API.get('/analytics/revenue?days=30');
        if (!ok) return;
        const rows = data.data;

        const labels = rows.map(r => r.sale_day);
        const revenue = rows.map(r => r.revenue);
        const profit = rows.map(r => r.profit);

        const ctx = document.getElementById('revenue-chart')?.getContext('2d');
        if (!ctx) return;

        revenueChart = destroyAndCreate(revenueChart, 'revenue-chart', {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenue,
                        borderColor: 'rgba(56, 189, 248, 1)',
                        backgroundColor: makeGradient(ctx, 'rgba(56, 189, 248, 1)'),
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                    },
                    {
                        label: 'Profit',
                        data: profit,
                        borderColor: 'rgba(167, 243, 208, 1)',
                        backgroundColor: makeGradient(ctx, 'rgba(167, 243, 208, 1)'),
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
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

    // ── Top products chart ────────────────────────────────────────────────────

    const loadTopProductsChart = async () => {
        const { ok, data } = await API.get('/analytics/top-products?limit=8&days=30');
        if (!ok) return;
        const rows = data.data;

        topChart = destroyAndCreate(topChart, 'top-products-chart', {
            type: 'bar',
            data: {
                labels: rows.map(r => r.name),
                datasets: [{
                    label: 'Units Sold',
                    data: rows.map(r => r.total_qty_sold),
                    backgroundColor: CHART_COLORS,
                    borderRadius: 6,
                }],
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

    // ── Category doughnut chart ───────────────────────────────────────────────

    const loadCategoryChart = async () => {
        const { ok, data } = await API.get('/analytics/categories');
        if (!ok) return;
        const rows = data.data;

        categoryChart = destroyAndCreate(categoryChart, 'category-chart', {
            type: 'doughnut',
            data: {
                labels: rows.map(r => r.category),
                datasets: [{
                    data: rows.map(r => r.total_revenue),
                    backgroundColor: CHART_COLORS,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'right', labels: { color: '#e2e8f0' } },
                },
            },
        });
    };

    // ── Stock predictions table ───────────────────────────────────────────────

    const loadStockPredictions = async () => {
        const tbody = document.getElementById('predictions-tbody');
        if (!tbody) return;
        const { ok, data } = await API.get('/analytics/stock-predictions');
        if (!ok) return;

        tbody.innerHTML = data.data.map(p => `
      <tr class="${p.restock_needed ? 'row-low-stock' : ''}">
        <td>${p.name}</td>
        <td>${p.quantity}</td>
        <td>${p.avg_daily_sales}</td>
        <td>${p.days_remaining !== null ? p.days_remaining + ' days' : 'No recent sales'}</td>
        <td>${p.restock_needed ? '<span class="badge badge-danger">Restock Now</span>' : '<span class="badge badge-success">OK</span>'}</td>
      </tr>
    `).join('');
    };

    // ── Activity log table ────────────────────────────────────────────────────

    const loadActivityLog = async () => {
        const tbody = document.getElementById('activity-tbody');
        if (!tbody) return;
        const { ok, data } = await API.get('/analytics/activity?limit=30');
        if (!ok) return;

        tbody.innerHTML = data.data.map(a => `
      <tr>
        <td>${a.created_at?.substring(0, 16) || '—'}</td>
        <td>${a.user_name}</td>
        <td><span class="badge badge-${a.action === 'DELETE' ? 'danger' : a.action === 'UPDATE' ? 'warning' : 'success'}">${a.action}</span></td>
        <td>${a.entity_type}</td>
        <td>${a.detail || '—'}</td>
      </tr>
    `).join('');
    };

    // ── CSV export ────────────────────────────────────────────────────────────

    document.getElementById('btn-export-sales')?.addEventListener('click', () => {
        API.downloadBlob('/analytics/export/sales', 'sales_export.csv');
    });
    document.getElementById('btn-export-products')?.addEventListener('click', () => {
        API.downloadBlob('/analytics/export/products', 'products_export.csv');
    });

    // ── Public load ───────────────────────────────────────────────────────────

    const load = async () => {
        await Promise.all([
            loadRevenueChart(),
            loadTopProductsChart(),
            loadCategoryChart(),
            loadStockPredictions(),
            loadActivityLog(),
        ]);
    };

    // Load when the analytics section is shown (dashboard.js calls Analytics.load()).
    window.Analytics = { load };
})();
