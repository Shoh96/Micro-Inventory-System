/**
 * FILE: client/js/products.js
 *
 * PURPOSE:
 *   Manages the Inventory section of the dashboard.
 *   Features:
 *     - Load and render products table (with category/supplier names)
 *     - Filter by category, supplier, and low-stock
 *     - Search by keyword
 *     - Add product with duplicate detection warning
 *     - Edit product via modal
 *     - Delete with confirmation
 *     - Populate category and supplier dropdowns
 *
 * DEPENDS ON: window.API (api.js)
 */

(() => {
    'use strict';

    // In-memory state — avoids redundant API calls for filter/search operations.
    let allProducts = [];
    let categories = [];
    let suppliers = [];

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const tableBody = document.getElementById('products-tbody');
    const filterCategory = document.getElementById('filter-category');
    const filterSupplier = document.getElementById('filter-supplier');  // may be null
    const filterLowStock = document.getElementById('filter-low-stock');
    const searchInput = document.getElementById('product-search');
    const modal = document.getElementById('product-modal');
    const modalTitle = document.getElementById('modal-title');
    const productForm = document.getElementById('product-form');
    const dupWarning = document.getElementById('dup-warning');
    const dupList = document.getElementById('dup-list');

    /**
     * escHtml — prevents XSS when injecting user strings into the DOM.
     * @param {string} str
     * @returns {string} HTML-entity-encoded string
     */
    const escHtml = (str = '') => String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // ── Load data ─────────────────────────────────────────────────────────────

    const loadCategories = async () => {
        const { ok, data } = await API.get('/products/categories');
        if (!ok) return;
        categories = data.data;
        // Populate filter dropdown.
        if (filterCategory) {
            filterCategory.innerHTML = '<option value="">All categories</option>' +
                categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
        }
        // Populate modal dropdown.
        const sel = document.getElementById('product-category');
        if (sel) {
            sel.innerHTML = '<option value="">— None —</option>' +
                categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
        }
    };

    const loadSuppliers = async () => {
        const { ok, data } = await API.get('/products/suppliers');
        if (!ok) return;
        suppliers = data.data;
        const sel = document.getElementById('product-supplier');
        if (sel) {
            sel.innerHTML = '<option value="">— None —</option>' +
                suppliers.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
        }
    };

    /**
     * loadProducts — fetches product list and stores in allProducts.
     * Admin can pass an owner_id query param to view another owner's inventory.
     * Re-applies the current filter/search after loading.
     */
    const getAdminOwnerId = () => {
        const sel = document.getElementById('admin-inventory-owner');
        return sel?.value || null;
    };

    /** Render KPI summary strip for admin inventory analytics */
    const renderInventoryAnalytics = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const strip = document.getElementById('admin-inventory-analytics');
        if (!strip || user.role !== 'admin') return;

        const products = allProducts;
        if (!products.length) { strip.style.display = 'none'; return; }

        const totalValue = products.reduce((s, p) => s + (p.quantity * p.cost_price), 0);
        const sellValue = products.reduce((s, p) => s + (p.quantity * p.selling_price), 0);
        const lowStockCnt = products.filter(p => p.is_low_stock).length;
        const categories = new Set(products.map(p => p.category_id).filter(Boolean)).size;
        const currency = products[0]?.currency || 'XAF';
        const fmt = n => Number(n).toLocaleString();

        strip.style.display = 'grid';
        strip.innerHTML = `
          <div class="kpi-mini"><span class="kpi-mini-label">Cost Value</span><span class="kpi-mini-val">${fmt(totalValue)} <small>${currency}</small></span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Sell Value</span><span class="kpi-mini-val">${fmt(sellValue)} <small>${currency}</small></span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Total Products</span><span class="kpi-mini-val">${products.length}</span></div>
          <div class="kpi-mini ${lowStockCnt ? 'kpi-mini--danger' : ''}"><span class="kpi-mini-label">Low Stock &#9888;</span><span class="kpi-mini-val">${lowStockCnt}</span></div>
          <div class="kpi-mini"><span class="kpi-mini-label">Categories</span><span class="kpi-mini-val">${categories}</span></div>
        `;
    };

    const loadProducts = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        let url = '/products';
        if (user.role === 'admin') {
            const ownerId = getAdminOwnerId();
            if (ownerId) url = `/products?owner_id=${ownerId}`;
        }
        const { ok, data } = await API.get(url);
        if (!ok) return;
        allProducts = data.data || [];
        renderTable();
        renderInventoryAnalytics();
    };

    /** Build admin inventory owner selector if admin */
    const initAdminOwnerSelector = async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') return;
        const container = document.getElementById('admin-inventory-filter');
        if (!container) return;
        container.style.display = 'flex';
        const sel = document.getElementById('admin-inventory-owner');
        if (!sel) return;
        try {
            const res = await API.get('/users');
            const owners = (res.data?.data || []).filter(u => u.role === 'owner');
            sel.innerHTML = '<option value="">— All Owners —</option>' +
                owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
            sel.addEventListener('change', loadProducts);
        } catch (_) { }
    };

    // ── Filtering / search ────────────────────────────────────────────────────

    /**
     * getFilteredProducts — applies in-memory filter (no extra API calls).
     */
    const getFilteredProducts = () => {
        const catId = filterCategory?.value;
        const lowStock = filterLowStock?.checked;
        const q = searchInput?.value.toLowerCase().trim();

        return allProducts.filter((p) => {
            if (catId && String(p.category_id) !== catId) return false;
            if (lowStock && !p.is_low_stock) return false;
            if (q && !p.name.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false;
            return true;
        });
    };

    // ── Render table ──────────────────────────────────────────────────────────

    const renderTable = () => {
        const rows = getFilteredProducts();
        if (!rows.length) {
            tableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No products found.</td></tr>';
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isClerk = user.role === 'clerk';

        tableBody.innerHTML = rows.map((p) => `
      <tr class="${p.is_low_stock ? 'row-low-stock' : ''}">
        <td>${escHtml(p.name)}${p.is_low_stock ? ' <span class="badge badge-danger">Low</span>' : ''}</td>
        <td>${escHtml(p.category_name || '—')}</td>
        <td>${escHtml(p.supplier_name || '—')}</td>
        <td>${p.quantity}</td>
        <td>${Number(p.cost_price).toLocaleString()}</td>
        <td>${Number(p.selling_price).toLocaleString()}</td>
        <td>${p.expiry_date || '—'}</td>
        <td>${p.batch_number || '—'}</td>
        <td class="actions-cell">
          ${!isClerk ? `<button class="btn btn-sm btn-secondary" onclick="Products.edit(${p.id})">Edit</button>
                        <button class="btn btn-sm btn-danger"    onclick="Products.del(${p.id})">Delete</button>` : ''}
          <button class="btn btn-sm btn-primary"   onclick="Sales.openQuick(${p.id},'${escHtml(p.name)}',${p.selling_price},${p.quantity})">Sell</button>
        </td>
      </tr>
    `).join('');
    };

    [filterCategory, filterLowStock, searchInput].forEach((el) => {
        if (el) el.addEventListener('change', renderTable);
    });
    if (searchInput) searchInput.addEventListener('input', renderTable);

    // ── Modal: add product ────────────────────────────────────────────────────

    const openAddModal = () => {
        productForm.reset();
        productForm.dataset.editId = '';
        modalTitle.textContent = 'Add Product';
        dupWarning.classList.add('hidden');
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    };

    document.getElementById('btn-add-product')?.addEventListener('click', openAddModal);
    document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);

    // ── Edit product ──────────────────────────────────────────────────────────

    const edit = async (id) => {
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        productForm.dataset.editId = id;
        modalTitle.textContent = 'Edit Product';
        dupWarning.classList.add('hidden');

        // Populate form fields.
        ['name', 'description', 'quantity', 'cost_price', 'selling_price',
            'batch_number', 'serial_number', 'expiry_date'].forEach((f) => {
                const el = productForm.elements[f];
                if (el) el.value = product[f] ?? '';
            });
        const catEl = productForm.elements['category_id'];
        const supEl = productForm.elements['supplier_id'];
        if (catEl) catEl.value = product.category_id ?? '';
        if (supEl) supEl.value = product.supplier_id ?? '';

        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    };

    // ── Form submit (create / update) ─────────────────────────────────────────

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = productForm.dataset.editId;
        const force = e.submitter?.dataset.force === 'true';

        const payload = Object.fromEntries(new FormData(productForm));
        // Clean up empty strings to null for optional FK fields.
        ['category_id', 'supplier_id', 'expiry_date'].forEach(k => {
            if (payload[k] === '') payload[k] = null;
        });

        let resp;
        if (editId) {
            resp = await API.put(`/products/${editId}`, payload);
        } else {
            resp = await API.post(`/products${force ? '?force=true' : ''}`, payload);
        }

        const { ok, status, data } = resp;

        // Handle duplicate detection (409 with duplicate candidates).
        if (status === 409 && data?.data?.duplicates) {
            dupList.innerHTML = data.data.duplicates
                .map(d => `<li>${escHtml(d.name)} (qty: ${d.quantity})</li>`).join('');
            dupWarning.classList.remove('hidden');
            return;
        }

        if (!ok) return alert(data?.message || 'Error saving product.');

        closeModal();
        await loadProducts();
        // Refresh KPIs.
        if (window.Dashboard) window.Dashboard.loadMetrics();
    });

    // Confirm duplicate override.
    document.getElementById('btn-force-add')?.addEventListener('click', async () => {
        const submitBtn = document.getElementById('btn-submit-product');
        submitBtn.dataset.force = 'true';
        submitBtn.click();
        submitBtn.dataset.force = 'false';
    });

    // ── Delete product ────────────────────────────────────────────────────────

    const del = async (id) => {
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        const check = prompt(`SECURITY WARNING: You are about to irrevocably delete the product "${product.name}" and all of its associated sales history.\n\nTo confirm, type the exact name:\n${product.name}`);
        if (check !== product.name) {
            return alert('Name did not match. Deletion cancelled.');
        }

        const { ok, data } = await API.del(`/products/${id}`);
        if (!ok) return alert(data?.message || 'Delete failed.');
        await loadProducts();
        if (window.Dashboard) window.Dashboard.loadMetrics();
    };

    // ── Global event delegation for dynamically shown buttons ─────────────────
    document.body.addEventListener('click', async (e) => {
        // Add Product
        if (e.target.closest('#btn-add-product')) {
            openAddModal();
        }

        // Add Category
        if (e.target.closest('#btn-add-category')) {
            const modal = document.getElementById('category-modal');
            document.getElementById('category-form').reset();
            modal.classList.remove('hidden');
        }

        // Add Supplier
        if (e.target.closest('#btn-add-supplier')) {
            const modal = document.getElementById('supplier-modal');
            document.getElementById('supplier-form').reset();
            modal.classList.remove('hidden');
        }
    });

    // ── Categories & Suppliers Form Submissions ───────────────────────────────

    document.getElementById('category-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target));
        const { ok, data } = await API.post('/products/categories', payload);
        if (!ok) return alert(data?.message || 'Failed to create category.');

        document.getElementById('category-modal').classList.add('hidden');
        await loadCategories();
    });

    document.getElementById('supplier-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = Object.fromEntries(new FormData(e.target));
        const { ok, data } = await API.post('/products/suppliers', payload);
        if (!ok) return alert(data?.message || 'Failed to create supplier.');

        document.getElementById('supplier-modal').classList.add('hidden');
        await loadSuppliers();
    });

    // ── Public interface ──────────────────────────────────────────────────────

    window.Products = { load: loadProducts, loadCategories, loadSuppliers, edit, del };

    // Initial load.
    (async () => {
        await initAdminOwnerSelector();
        await Promise.all([loadCategories(), loadSuppliers()]);
        await loadProducts();
    })();
})();
