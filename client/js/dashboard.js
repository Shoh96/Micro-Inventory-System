/**
 * FILE: client/js/dashboard.js
 *
 * PURPOSE:
 *   Powers the main dashboard page (dashboard.html).
 *   Handles:
 *     - Auth guard (redirect to login if no token)
 *     - Loading and rendering the KPI metrics
 *     - Loading and rendering the product table
 *     - Product search/filter
 *     - Add / Edit product modal
 *     - Record sale via the quick-sale bar
 *     - Loading and rendering the sales history table
 *     - Section tab switching (Inventory / Sales)
 *     - Logout
 *
 * HOW IT FITS:
 *   Loaded only by dashboard.html.
 *   Communicates with the API using the JWT stored in localStorage.
 *   All API calls use the shared `apiFetch` helper which injects the
 *   Authorization header automatically.
 *
 * API ENDPOINTS USED:
 *   GET    /api/dashboard/metrics
 *   GET    /api/products
 *   POST   /api/products
 *   PUT    /api/products/:id
 *   DELETE /api/products/:id
 *   GET    /api/sales
 *   POST   /api/sales
 */

'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api';

// ── Auth Guard ────────────────────────────────────────────────────────────────
// If no token exists the user should not be here — redirect to login.
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user) {
    window.location.href = 'index.html';
}

// ── DOM references ────────────────────────────────────────────────────────────
const navbarUsername = document.getElementById('navbar-username');
const logoutBtn = document.getElementById('logout-btn');

// KPI elements
const kpiStockValue = document.getElementById('kpi-stock-value');
const kpiProfit = document.getElementById('kpi-profit');
const kpiRevenue = document.getElementById('kpi-revenue');
const kpiLowStock = document.getElementById('kpi-low-stock');
const lowStockBanner = document.getElementById('low-stock-banner');
const lowStockNames = document.getElementById('low-stock-names');

// Section tabs
const tabInventory = document.getElementById('tab-inventory');
const tabSalesHistory = document.getElementById('tab-sales');
const sectionInventory = document.getElementById('section-inventory');
const sectionSales = document.getElementById('section-sales');

// Products
const productsTbody = document.getElementById('products-tbody');
const productSearch = document.getElementById('product-search');
const openAddBtn = document.getElementById('open-add-product-btn');
const saleSelect = document.getElementById('sale-product-select');
const saleQtyInput = document.getElementById('sale-qty-input');
const recordSaleBtn = document.getElementById('record-sale-btn');
const saleMsg = document.getElementById('sale-msg');

// Sales history
const salesTbody = document.getElementById('sales-tbody');

// Modal
const productModal = document.getElementById('product-modal');
const modalTitle = document.getElementById('modal-title');
const productForm = document.getElementById('product-form');
const productIdField = document.getElementById('product-id-field');
const fieldName = document.getElementById('field-name');
const fieldDesc = document.getElementById('field-description');
const fieldQty = document.getElementById('field-quantity');
const fieldCost = document.getElementById('field-cost');
const fieldSell = document.getElementById('field-sell');
const derivedProfit = document.getElementById('derived-profit');
const productFormMsg = document.getElementById('product-form-msg');
const saveProductBtn = document.getElementById('product-save-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// ── State ──────────────────────────────────────────────────────────────────────
// Cached product list used for search filtering without additional API calls.
let allProducts = [];

// ── Shared helper utilities ────────────────────────────────────────────────────

/**
 * formatCurrency
 * Formats a numeric value as a XAF currency string.
 *
 * @param {number} value - Raw numeric value.
 * @returns {string}       e.g. "12,500 XAF"
 */
const formatCurrency = (value) =>
    `${Number(value || 0).toLocaleString('fr-CM')} XAF`;

/**
 * formatDate
 * Converts an ISO datetime string to a human-readable local date.
 *
 * @param {string} iso - ISO datetime string from the API.
 * @returns {string}     e.g. "04 Mar 2026, 12:30"
 */
const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

/**
 * showFormMsg
 * Updates a form message element with text and a style class.
 *
 * @param {HTMLElement} el   - The message container element.
 * @param {string}      text - The message to display.
 * @param {'error'|'success'} type - Visual style.
 */
const showFormMsg = (el, text, type = 'error') => {
    el.textContent = text;
    el.className = `form-msg ${type}`;
};

/**
 * apiFetch
 * Shared authenticated fetch wrapper.
 * Automatically injects the Authorization header and parses JSON.
 * Throws an Error (with the API's message) on non-2xx responses.
 *
 * @param {string} path    - API path relative to API_BASE (e.g. '/products').
 * @param {object} options - Standard fetch init options (method, body, etc.)
 * @returns {Promise<object>} Parsed JSON response body.
 * @throws {Error} On network failure or non-2xx HTTP status.
 */
const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
        const err = new Error(json.message || 'API request failed.');
        err.statusCode = res.status;
        throw err;
    }

    return json;
};

// ── Navbar ─────────────────────────────────────────────────────────────────────
navbarUsername.textContent = `Hello, ${user.name.split(' ')[0]}`;

/**
 * handleLogout
 * Clears the session from localStorage and redirects to the login page.
 */
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});

// ── Section tabs ───────────────────────────────────────────────────────────────

/**
 * switchSection
 * Shows the Inventory or Sales History section.
 *
 * @param {'inventory'|'sales'} which
 */
const switchSection = (which) => {
    const isInventory = which === 'inventory';
    tabInventory.classList.toggle('active', isInventory);
    tabSalesHistory.classList.toggle('active', !isInventory);
    tabInventory.setAttribute('aria-selected', String(isInventory));
    tabSalesHistory.setAttribute('aria-selected', String(!isInventory));
    sectionInventory.classList.toggle('active', isInventory);
    sectionSales.classList.toggle('active', !isInventory);

    // Lazy-load sales history only when that tab is first activated.
    if (!isInventory) loadSales();
};

tabInventory.addEventListener('click', () => switchSection('inventory'));
tabSalesHistory.addEventListener('click', () => switchSection('sales'));

// ── KPI Metrics ────────────────────────────────────────────────────────────────

/**
 * loadMetrics
 * Fetches dashboard KPI data and updates the metric cards.
 * Also triggers the low-stock banner if needed.
 */
const loadMetrics = async () => {
    try {
        const json = await apiFetch('/dashboard/metrics');
        const d = json.data;

        kpiStockValue.textContent = formatCurrency(d.total_stock_value);
        kpiProfit.textContent = formatCurrency(d.total_profit);
        kpiRevenue.textContent = formatCurrency(d.total_revenue);
        kpiLowStock.textContent = d.low_stock_count;

        // Show an alert banner if any products have critically low stock.
        if (d.low_stock_count > 0 && d.low_stock_items.length) {
            const names = d.low_stock_items.map((p) => `${p.name} (${p.quantity} left)`).join(', ');
            lowStockNames.textContent = names;
            lowStockBanner.classList.remove('hidden');
        } else {
            lowStockBanner.classList.add('hidden');
        }
    } catch (err) {
        // Metrics failing should not break the whole page — fail silently.
        kpiStockValue.textContent = '—';
    }
};

// ── Products ───────────────────────────────────────────────────────────────────

/**
 * loadProducts
 * Fetches all products from the API, stores them in `allProducts`,
 * and renders them in the table.  Also refreshes the KPIs.
 */
const loadProducts = async () => {
    try {
        const json = await apiFetch('/products');
        allProducts = json.data;
        renderProducts(allProducts);
        populateSaleSelect(allProducts);
        loadMetrics(); // Refresh KPIs after product data changes.
    } catch {
        productsTbody.innerHTML = '<tr class="empty-row"><td colspan="8">Failed to load products.</td></tr>';
    }
};

/**
 * renderProducts
 * Renders a given array of products into the products table.
 * Called both on initial load and when the search filter changes.
 *
 * @param {object[]} products - Array of product objects from the API.
 */
const renderProducts = (products) => {
    if (!products.length) {
        productsTbody.innerHTML = '<tr class="empty-row"><td colspan="8">No products found. Add your first product above.</td></tr>';
        return;
    }

    productsTbody.innerHTML = products.map((p) => {
        const unitProfit = (p.selling_price - p.cost_price).toFixed(2);
        const isLow = p.is_low_stock;
        const statusBadge = isLow
            ? '<span class="badge badge-warning">Low Stock</span>'
            : '<span class="badge badge-ok">OK</span>';

        return `
      <tr>
        <td><strong>${escHtml(p.name)}</strong></td>
        <td style="color:var(--text-muted)">${escHtml(p.description || '—')}</td>
        <td class="text-right" style="${isLow ? 'color:var(--warning);font-weight:600' : ''}">${p.quantity}</td>
        <td class="text-right">${formatCurrency(p.cost_price)}</td>
        <td class="text-right">${formatCurrency(p.selling_price)}</td>
        <td class="text-right" style="color:var(--success)">${formatCurrency(unitProfit)}</td>
        <td class="text-center">${statusBadge}</td>
        <td class="text-center">
          <div class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal(${p.id})">Edit</button>
            <button class="btn btn-danger-outline" onclick="confirmDelete(${p.id}, '${escHtml(p.name)}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
};

/**
 * escHtml
 * Escapes unsafe HTML characters to prevent XSS when inserting
 * user-generated content into innerHTML.
 *
 * @param {string} str - Raw string to escape.
 * @returns {string}     HTML-safe string.
 */
const escHtml = (str) =>
    String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

/**
 * populateSaleSelect
 * Populates the product dropdown in the quick-sale bar.
 *
 * @param {object[]} products - Array of product objects.
 */
const populateSaleSelect = (products) => {
    const inStock = products.filter((p) => p.quantity > 0);
    saleSelect.innerHTML =
        '<option value="">— Choose product —</option>' +
        inStock.map((p) => `<option value="${p.id}">${escHtml(p.name)} (${p.quantity} in stock)</option>`).join('');
};

// ── Live product search ────────────────────────────────────────────────────────
productSearch.addEventListener('input', () => {
    const q = productSearch.value.toLowerCase().trim();
    const filtered = q
        ? allProducts.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
        : allProducts;
    renderProducts(filtered);
});

// ── Delete product ─────────────────────────────────────────────────────────────

/**
 * confirmDelete
 * Asks for confirmation then deletes a product via the API.
 * Exposed on window so inline onclick attributes in the table can call it.
 *
 * @param {number} id   - Product ID.
 * @param {string} name - Product name (for the confirmation dialog).
 */
window.confirmDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await apiFetch(`/products/${id}`, { method: 'DELETE' });
        loadProducts();
    } catch (err) {
        alert(`Failed to delete: ${err.message}`);
    }
};

// ── Product Modal ──────────────────────────────────────────────────────────────

/**
 * openModal
 * Opens the Add/Edit product modal.
 *
 * @param {'add'|'edit'} mode  - Which mode to open the modal in.
 * @param {object}       [product] - Existing product data (edit mode only).
 */
const openModal = (mode, product = null) => {
    productForm.reset();
    showFormMsg(productFormMsg, '');
    derivedProfit.textContent = '—';
    productIdField.value = '';

    if (mode === 'edit' && product) {
        modalTitle.textContent = 'Edit Product';
        productIdField.value = product.id;
        fieldName.value = product.name;
        fieldDesc.value = product.description || '';
        fieldQty.value = product.quantity;
        fieldCost.value = product.cost_price;
        fieldSell.value = product.selling_price;
        updateDerivedProfit();
    } else {
        modalTitle.textContent = 'Add Product';
    }

    productModal.classList.remove('hidden');
    fieldName.focus();
};

/**
 * openEditModal
 * Looks up the product from the cached list and opens the modal in edit mode.
 * Exposed on window for inline onclick usage.
 *
 * @param {number} id - Product ID.
 */
window.openEditModal = (id) => {
    const p = allProducts.find((x) => x.id === id);
    if (p) openModal('edit', p);
};

const closeModal = () => productModal.classList.add('hidden');

openAddBtn.addEventListener('click', () => openModal('add'));
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
productModal.addEventListener('click', (e) => { if (e.target === productModal) closeModal(); });

// Close modal on Escape key.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

/**
 * updateDerivedProfit
 * Recalculates and displays the unit profit in the modal whenever
 * the cost or selling price inputs change.
 */
const updateDerivedProfit = () => {
    const cost = parseFloat(fieldCost.value) || 0;
    const sell = parseFloat(fieldSell.value) || 0;
    const profit = sell - cost;
    derivedProfit.textContent = formatCurrency(profit);
    derivedProfit.style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';
};

fieldCost.addEventListener('input', updateDerivedProfit);
fieldSell.addEventListener('input', updateDerivedProfit);

// ── Save Product (Add / Edit) ──────────────────────────────────────────────────

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showFormMsg(productFormMsg, '');

    const id = productIdField.value;
    const body = {
        name: fieldName.value.trim(),
        description: fieldDesc.value.trim(),
        quantity: parseInt(fieldQty.value, 10),
        cost_price: parseFloat(fieldCost.value),
        selling_price: parseFloat(fieldSell.value),
    };

    if (!body.name || isNaN(body.cost_price) || isNaN(body.selling_price)) {
        showFormMsg(productFormMsg, 'Name, cost price, and selling price are required.', 'error');
        return;
    }

    saveProductBtn.disabled = true;

    try {
        if (id) {
            // Edit existing product.
            await apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            // Create new product.
            await apiFetch('/products', { method: 'POST', body: JSON.stringify(body) });
        }
        closeModal();
        loadProducts();
    } catch (err) {
        showFormMsg(productFormMsg, err.message, 'error');
    } finally {
        saveProductBtn.disabled = false;
    }
});

// ── Record Sale ────────────────────────────────────────────────────────────────

recordSaleBtn.addEventListener('click', async () => {
    showFormMsg(saleMsg, '');
    const productId = saleSelect.value;
    const quantitySold = parseInt(saleQtyInput.value, 10);

    if (!productId) {
        showFormMsg(saleMsg, 'Please select a product.', 'error');
        return;
    }
    if (!quantitySold || quantitySold < 1) {
        showFormMsg(saleMsg, 'Quantity must be at least 1.', 'error');
        return;
    }

    recordSaleBtn.disabled = true;

    try {
        await apiFetch('/sales', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity_sold: quantitySold }),
        });

        showFormMsg(saleMsg, 'Sale recorded successfully!', 'success');
        saleQtyInput.value = '';
        saleSelect.value = '';
        loadProducts(); // Refresh stock quantities and KPIs.
    } catch (err) {
        showFormMsg(saleMsg, err.message, 'error');
    } finally {
        recordSaleBtn.disabled = false;
    }
});

// ── Sales History ──────────────────────────────────────────────────────────────

/**
 * loadSales
 * Fetches and renders the sales history table.
 */
const loadSales = async () => {
    try {
        const json = await apiFetch('/sales');
        const sales = json.data;

        if (!sales.length) {
            salesTbody.innerHTML = '<tr class="empty-row"><td colspan="5">No sales recorded yet.</td></tr>';
            return;
        }

        salesTbody.innerHTML = sales.map((s) => `
      <tr>
        <td style="color:var(--text-muted)">${formatDate(s.sale_date)}</td>
        <td>${escHtml(s.product_name)}</td>
        <td class="text-right">${s.quantity_sold}</td>
        <td class="text-right">${formatCurrency(s.selling_price_at_sale)}</td>
        <td class="text-right" style="color:var(--success)">${formatCurrency(s.total_profit)}</td>
      </tr>
    `).join('');
    } catch {
        salesTbody.innerHTML = '<tr class="empty-row"><td colspan="5">Failed to load sales.</td></tr>';
    }
};

// ── Initial page load ──────────────────────────────────────────────────────────
// Load products and metrics together on page entry.
loadProducts();
loadMetrics();
