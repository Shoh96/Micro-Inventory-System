/**
 * FILE: client/js/sales.js
 *
 * PURPOSE:
 *   Handles the Sales section:
 *     - Sale recording modal (with discount and tax fields)
 *     - Sales history table
 *     - Quick-sell triggered from the products table
 *
 * DEPENDS ON: window.API
 */

(() => {
    'use strict';

    const modal = document.getElementById('sale-modal');
    const saleForm = document.getElementById('sale-form');
    const salesTbody = document.getElementById('sales-tbody');
    const saleSummary = document.getElementById('sale-summary');

    const escHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Pre-fill the sale modal (called from products table "Sell" button).
    const openQuick = (productId, name, sellingPrice, availableQty) => {
        showSection('sales');
        saleForm.reset();
        saleForm.elements['product_id'].value = productId;
        document.getElementById('sale-product-name').textContent = name;
        document.getElementById('sale-max-qty').textContent = `Available: ${availableQty}`;
        saleForm.elements['selling_price'].value = sellingPrice;
        if (modal) { modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); }
    };

    // Open blank sale modal.
    document.getElementById('btn-record-sale')?.addEventListener('click', () => {
        saleForm.reset();
        document.getElementById('sale-product-name').textContent = '';
        document.getElementById('sale-max-qty').textContent = '';
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    });

    document.getElementById('btn-close-sale-modal')?.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    });

    // Live profit preview as user types in the sale form.
    const previewProfit = () => {
        const sellingPrice = parseFloat(saleForm.elements['selling_price']?.value) || 0;
        const qty = parseInt(saleForm.elements['quantity_sold']?.value) || 0;
        const discount = parseFloat(saleForm.elements['discount']?.value) || 0;
        const taxRate = parseFloat(saleForm.elements['tax_rate']?.value) || 0;

        const gross = sellingPrice * qty;
        const tax = gross * taxRate;
        const revenue = gross + tax - discount;
        if (saleSummary) {
            saleSummary.textContent = `Estimated revenue: ${revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        }
    };
    ['selling_price', 'quantity_sold', 'discount', 'tax_rate'].forEach(name => {
        saleForm.elements[name]?.addEventListener('input', previewProfit);
    });

    // Submit sale.
    saleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(saleForm));
        const btn = saleForm.querySelector('button[type="submit"]');
        btn.disabled = true;

        const { ok, data } = await API.post('/sales', payload);
        btn.disabled = false;

        if (!ok) { alert(data?.message || 'Sale failed.'); return; }

        modal.classList.add('hidden');
        await loadSales();
        // Refresh products and KPIs.
        if (window.Products) window.Products.load();
        if (window.Dashboard) window.Dashboard.loadMetrics();
    });

    const getAdminSalesOwnerId = () => {
        const sel = document.getElementById('admin-sales-owner');
        return sel?.value || null;
    };

    const loadSales = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        let url = '/sales';
        if (user.role === 'admin') {
            const ownerId = getAdminSalesOwnerId();
            if (ownerId) url = `/sales?owner_id=${ownerId}`;
        }
        const { ok, data } = await API.get(url);
        if (!ok || !data?.data) return;
        const sales = data.data;

        if (!sales.length) {
            salesTbody.innerHTML = '<tr><td colspan="8" class="empty-state">No sales recorded yet.</td></tr>';
            return;
        }

        salesTbody.innerHTML = sales.map(s => `
      <tr>
        <td>${s.sale_date?.substring(0, 10) || '\u2014'}</td>
        <td>${escHtml(s.product_name)}</td>
        <td>${s.quantity_sold}</td>
        <td>${Number(s.selling_price_at_sale).toLocaleString()}</td>
        <td>${Number(s.discount).toLocaleString()}</td>
        <td>${(s.tax_rate * 100).toFixed(2)}%</td>
        <td>${Number(s.total_revenue).toLocaleString()}</td>
        <td class="profit-cell">${Number(s.total_profit).toLocaleString()}</td>
      </tr>
    `).join('');

        renderSalesAnalytics(sales);
    };

    /** Render KPI summary strip for admin sales analytics */
    const renderSalesAnalytics = (sales) => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const strip = document.getElementById('admin-sales-analytics');
        if (!strip || user.role !== 'admin') return;
        if (!sales || !sales.length) { strip.style.display = 'none'; return; }

        const totalRevenue = sales.reduce((s, r) => s + Number(r.total_revenue), 0);
        const totalProfit = sales.reduce((s, r) => s + Number(r.total_profit), 0);
        const totalQty = sales.reduce((s, r) => s + Number(r.quantity_sold), 0);
        const avgOrder = totalRevenue / sales.length;
        const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
        const fmt = n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

        strip.style.display = 'grid';
        strip.innerHTML = `
          <div class="kpi-mini"><span class="kpi-mini-label">Total Revenue</span><span class="kpi-mini-val">${fmt(totalRevenue)} <small>XAF</small></span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Total Profit</span><span class="kpi-mini-val">${fmt(totalProfit)} <small>XAF</small></span></div>
          <div class="kpi-mini"><span class="kpi-mini-label"># Sales</span><span class="kpi-mini-val">${sales.length}</span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Units Sold</span><span class="kpi-mini-val">${fmt(totalQty)}</span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Avg Order</span><span class="kpi-mini-val">${fmt(avgOrder)}</span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Profit Margin</span><span class="kpi-mini-val">${margin}%</span></div>
        `;
    };

    /** Build admin sales owner selector if admin */
    const initAdminSalesOwnerSelector = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') return;
        const container = document.getElementById('admin-sales-filter');
        if (!container) return;
        container.style.display = 'flex';
        const sel = document.getElementById('admin-sales-owner');
        if (!sel) return;
        try {
            const res = await API.get('/users');
            const owners = (res.data?.data || []).filter(u => u.role === 'owner');
            sel.innerHTML = '<option value="">— All Owners —</option>' +
                owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
            sel.addEventListener('change', loadSales);
        } catch (_) { }
    };

    window.Sales = { load: loadSales, openQuick };

    loadSales();
    initAdminSalesOwnerSelector();
})();

