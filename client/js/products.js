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
     * Re-applies the current filter/search after loading.
     */
    const loadProducts = async () => {
        const { ok, data } = await API.get('/products');
        if (!ok) return;
        allProducts = data.data;
        renderTable();
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

    [filterCategory, filterLowStock, searchInput].forEach((el) => {
        if (el) el.addEventListener('change', renderTable);
    });
    if (searchInput) searchInput.addEventListener('input', renderTable);

    // ── Render table ──────────────────────────────────────────────────────────

    const renderTable = () => {
        const rows = getFilteredProducts();
        if (!rows.length) {
            tableBody.innerHTML = '<tr><td colspan="9" class="empty-state">No products found.</td></tr>';
            return;
        }
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
          <button class="btn btn-sm btn-secondary" onclick="Products.edit(${p.id})">Edit</button>
          <button class="btn btn-sm btn-danger"    onclick="Products.del(${p.id})">Delete</button>
          <button class="btn btn-sm btn-primary"   onclick="Sales.openQuick(${p.id},'${escHtml(p.name)}',${p.selling_price},${p.quantity})">Sell</button>
        </td>
      </tr>
    `).join('');
    };

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
        if (!confirm(`Delete "${product?.name}"? This will also delete all its sales records.`)) return;

        const { ok, data } = await API.del(`/products/${id}`);
        if (!ok) return alert(data?.message || 'Delete failed.');
        await loadProducts();
        if (window.Dashboard) window.Dashboard.loadMetrics();
    };

    // ── Categories management ─────────────────────────────────────────────────

    document.getElementById('btn-add-category')?.addEventListener('click', async () => {
        const name = prompt('New category name:');
        if (!name) return;
        const { ok, data } = await API.post('/products/categories', { name });
        if (!ok) return alert(data?.message || 'Failed to create category.');
        await loadCategories();
    });

    // ── Suppliers management ──────────────────────────────────────────────────

    document.getElementById('btn-add-supplier')?.addEventListener('click', async () => {
        const name = prompt('Supplier name:');
        if (!name) return;
        const { ok, data } = await API.post('/products/suppliers', { name });
        if (!ok) return alert(data?.message || 'Failed to create supplier.');
        await loadSuppliers();
    });

    // ── Public interface ──────────────────────────────────────────────────────

    window.Products = { load: loadProducts, loadCategories, loadSuppliers, edit, del };

    // Initial load.
    (async () => {
        await Promise.all([loadCategories(), loadSuppliers()]);
        await loadProducts();
    })();
})();
