/**
 * FILE: client/js/users.js  (V3)
 *
 * Hierarchy: Owner → Shops → Branches → Clerks
 *
 * Admin capabilities:
 *  - Create Owner: expanded form with Shop config + unlimited branches inline
 *  - Create Clerk: Owner → auto-load branches (required)
 *  - Edit any user, reset password, deactivate/reactivate
 *  - Manage Shops & Branches (modal)
 *  - Clear all data (Danger Zone)
 *
 * Owner capabilities:
 *  - Create Clerk: branch dropdown (owner's own branches — required)
 *  - Edit own clerks, reset their password, deactivate/reactivate
 */

'use strict';

/* ── helpers ─────────────────────────────────────────────────────────────────── */
const esc = (s = '') =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
};

const openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
const closeModal = (id) => document.getElementById(id)?.classList.add('hidden');

/* global credential display */
const showCredentials = (title, email, password) => {
    document.getElementById('cred-modal-title').textContent = title || 'Account Credentials';
    document.getElementById('cred-email').value = email || '';
    document.getElementById('cred-password').value = password || '';
    openModal('credentials-modal');
};

/* ── Close any modal via [data-close-modal] ─────────────────────────────────── */
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-close-modal]');
    if (target) closeModal(target.dataset.closeModal);
});

/* copy credentials */
document.getElementById('btn-copy-creds')?.addEventListener('click', () => {
    const email = document.getElementById('cred-email')?.value || '';
    const pass = document.getElementById('cred-password')?.value || '';
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${pass}`)
        .then(() => { const btn = document.getElementById('btn-copy-creds'); if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => btn.textContent = '📋 Copy', 2000); } });
});

/* ── USERS TABLE ─────────────────────────────────────────────────────────────── */
// Cache for the user objects so onclick can reference by id (avoids JSON-in-HTML quote issues)
const _usersCache = new Map();

const loadUsers = async () => {
    const tbody = document.getElementById('users-tbody');
    const user = getUser();
    if (!tbody) return;

    // Show role-appropriate buttons
    if (user.role === 'admin') {
        document.getElementById('btn-create-owner')?.style.setProperty('display', 'inline-block');
        document.getElementById('btn-manage-shops')?.style.setProperty('display', 'inline-block');
    }
    if (user.role === 'owner' || user.role === 'admin') {
        document.getElementById('btn-create-clerk')?.style.setProperty('display', 'inline-block');
        document.getElementById('btn-manage-branches')?.style.setProperty('display', 'inline-block');
    }

    try {
        const json = await apiFetch('/users');
        const users = Array.isArray(json) ? json : (json.data || []);

        // Rebuild cache so editUser(id) can look up the full object safely
        _usersCache.clear();
        users.forEach(u => _usersCache.set(u.id, u));

        tbody.innerHTML = users.length ? users.map(u => {
            const branchOwnerCell = u.role === 'clerk'
                ? `${esc(u.branch_name || '\u2014')} <span style="font-size:0.75rem;color:var(--text-muted);">(${esc(u.shop_name || '')})</span>`
                : u.role === 'owner' ? `<span style="font-size:0.75rem;color:var(--text-muted);">${esc(u.email)}</span>` : 'Admin';

            const roleBadge = `<span class="badge badge-${u.role === 'admin' ? 'primary' : u.role === 'owner' ? 'success' : 'secondary'}">${u.role}</span>`;
            const statusBadge = u.is_active
                ? '<span class="badge badge-success">Active</span>'
                : '<span class="badge badge-danger">Inactive</span>';

            const canManage = user.role === 'admin' || (user.role === 'owner' && u.owner_id === user.id && u.role === 'clerk');
            // Use numeric id only in onclick — no JSON strings in HTML attributes to avoid quote conflicts
            const isOwnerRow = user.role === 'admin' && u.role === 'owner';
            const deleteOwnerBtn = isOwnerRow
                ? `<button class="btn btn-sm btn-danger" title="Permanently delete owner & all their data" onclick="Users.deleteOwner(${u.id},'${esc(u.name)}')">🗑️</button>`
                : '';
            const actions = canManage ? `
        <div class="actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="Users.editUser(${u.id})">✏️</button>
          <button class="btn btn-sm btn-secondary" onclick="Users.openResetPw(${u.id}, '${esc(u.name)}')">🔑</button>
          ${u.is_active
                    ? `<button class="btn btn-sm btn-danger" onclick="Users.toggleActive(${u.id},'${esc(u.name)}',false)">🚫</button>`
                    : `<button class="btn btn-sm btn-success" onclick="Users.toggleActive(${u.id},'${esc(u.name)}',true)">✅</button>`}
          ${deleteOwnerBtn}
        </div>` : '\u2014';

            return `<tr>
        <td>${esc(u.name)}</td>
        <td>${esc(u.email)}</td>
        <td>${roleBadge}</td>
        <td>${branchOwnerCell}</td>
        <td>${statusBadge}</td>
        <td>${(u.created_at || '').substring(0, 10)}</td>
        <td>${actions}</td>
      </tr>`;
        }).join('')
            : '<tr><td colspan="7" class="empty-state">No users found.</td></tr>';
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Error: ${esc(e.message)}</td></tr>`;
    }
};
window.loadUsers = loadUsers;

/* ── Branch rows builder for create-owner form ──────────────────────────────── */
let _branchRowCount = 0;
const addBranchRow = (shopIdx) => {
    const cont = document.getElementById(`co-branches-${shopIdx}`);
    if (!cont) return;
    const idx = ++_branchRowCount;
    const row = document.createElement('div');
    row.className = 'branch-row';
    row.style = 'display:flex;gap:0.4rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;';
    row.innerHTML = `
    <input type="text" placeholder="Branch name *" name="branch-name-${shopIdx}-${idx}" style="flex:2;min-width:110px;" required />
    <input type="text" placeholder="Address"       name="branch-addr-${shopIdx}-${idx}" style="flex:3;min-width:110px;" />
    <input type="text" placeholder="Phone"         name="branch-phone-${shopIdx}-${idx}" style="flex:2;min-width:90px;" />
    <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.branch-row').remove()">✕</button>`;
    cont.appendChild(row);
};
window.addBranchRow = addBranchRow;

/* ── Shop rows builder for create-owner form ─────────────────────────────────── */
let _shopRowCount = 0;
const buildShopBlock = (idx) => {
    return `
  <div class="shop-block" id="shop-block-${idx}" style="border:1px solid var(--border-color);border-radius:8px;padding:0.75rem;margin-top:0.75rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <strong style="font-size:0.85rem;">🏪 Shop ${idx}</strong>
      ${idx > 1 ? `<button type="button" class="btn btn-sm btn-danger" onclick="document.getElementById('shop-block-${idx}').remove()">Remove Shop</button>` : ''}
    </div>
    <div class="form-group" style="margin-bottom:0.5rem;">
      <label style="font-size:0.8rem;">Shop Name *</label>
      <input type="text" name="shop-name-${idx}" required placeholder="e.g. Boutique Centrale" />
    </div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <div class="form-group" style="flex:1;min-width:100px;margin:0;">
        <label style="font-size:0.75rem;">Address</label>
        <input type="text" name="shop-addr-${idx}" placeholder="Street/Area" />
      </div>
      <div class="form-group" style="flex:1;min-width:80px;margin:0;">
        <label style="font-size:0.75rem;">Currency</label>
        <select name="shop-currency-${idx}">
          <option value="XAF" selected>XAF</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div class="form-group" style="flex:1;min-width:80px;margin:0;">
        <label style="font-size:0.75rem;">Low Stock Alert at</label>
        <input type="number" name="shop-lst-${idx}" value="10" min="0" style="width:100%;" />
      </div>
      <div class="form-group" style="flex:1;min-width:80px;margin:0;">
        <label style="font-size:0.75rem;">Tax %</label>
        <input type="number" name="shop-tax-${idx}" value="0" min="0" max="100" step="0.1" style="width:100%;" />
      </div>
    </div>
    <div style="margin-top:0.4rem;">
      <label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.8rem;">
        <input type="checkbox" name="shop-vis-${idx}" /> Allow admin to see sales & inventory
      </label>
    </div>
    <!-- Branches for this shop -->
    <div style="margin-top:0.75rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <label style="font-size:0.8rem;font-weight:600;">Branches</label>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addBranchRow(${idx})">+ Branch</button>
      </div>
      <div id="co-branches-${idx}"></div>
    </div>
  </div>`;
};
window.buildShopBlock = buildShopBlock;

/* ── Open Create-Owner Modal ─────────────────────────────────────────────────── */
document.getElementById('btn-create-owner')?.addEventListener('click', () => {
    const form = document.getElementById('create-owner-form');
    if (form) { form.reset(); }
    _shopRowCount = 0;
    _branchRowCount = 0;
    const container = document.getElementById('co-shops-container');
    if (container) {
        container.innerHTML = '';
        _shopRowCount = 1;
        container.innerHTML = buildShopBlock(1);
        addBranchRow(1); // default first branch
    }
    openModal('create-owner-modal');
});

document.getElementById('btn-add-shop-block')?.addEventListener('click', () => {
    ++_shopRowCount;
    const idx = _shopRowCount;
    const container = document.getElementById('co-shops-container');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', buildShopBlock(idx));
    addBranchRow(idx);
});

/* ── Submit Create-Owner ─────────────────────────────────────────────────────── */
document.getElementById('create-owner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.querySelector('#co-name')?.value?.trim();
    const email = form.querySelector('#co-email')?.value?.trim();
    if (!name || !email) return;

    const shops = [];
    document.querySelectorAll('.shop-block').forEach(block => {
        const idx = block.id.replace('shop-block-', '');
        const shopName = block.querySelector(`[name="shop-name-${idx}"]`)?.value?.trim();
        if (!shopName) return;
        const branches = [];
        block.querySelectorAll('.branch-row').forEach(row => {
            const bName = row.querySelector(`[name^="branch-name-${idx}-"]`)?.value?.trim();
            if (bName) branches.push({
                name: bName,
                address: row.querySelector(`[name^="branch-addr-${idx}-"]`)?.value?.trim() || '',
                phone: row.querySelector(`[name^="branch-phone-${idx}-"]`)?.value?.trim() || '',
            });
        });
        shops.push({
            name: shopName,
            address: block.querySelector(`[name="shop-addr-${idx}"]`)?.value?.trim() || '',
            currency: block.querySelector(`[name="shop-currency-${idx}"]`)?.value || 'XAF',
            low_stock_threshold: parseInt(block.querySelector(`[name="shop-lst-${idx}"]`)?.value || '10', 10),
            tax_percentage: parseFloat(block.querySelector(`[name="shop-tax-${idx}"]`)?.value || '0'),
            allow_admin_visibility: block.querySelector(`[name="shop-vis-${idx}"]`)?.checked ? 1 : 0,
            branches,
        });
    });

    if (!shops.length) return alert('At least one shop is required.');
    const allHaveBranch = shops.every(s => s.branches.length > 0);
    if (!allHaveBranch) return alert('Each shop needs at least one branch.');

    try {
        const res = await apiFetch('/users/owner', { method: 'POST', body: JSON.stringify({ name, email, shops }) });
        closeModal('create-owner-modal');
        showCredentials('Owner Created ✅', res.credentials?.email, res.credentials?.password);
        loadUsers();
    } catch (err) { alert(err.message || 'Failed to create owner.'); }
});

/* ── Create Clerk — cascading Owner → Branch ─────────────────────────────────── */
document.getElementById('btn-create-clerk')?.addEventListener('click', async () => {
    const user = getUser();
    const form = document.getElementById('create-clerk-form');
    if (form) form.reset();

    const ownerGroup = document.getElementById('cc-owner-group');
    const ccOwner = document.getElementById('cc-owner');
    const ccBranch = document.getElementById('cc-branch');
    const branchGroup = document.getElementById('cc-branch-group');

    if (user.role === 'admin') {
        // Admin: show owner selector; loading branches on change
        if (ownerGroup) ownerGroup.style.display = '';
        if (ccOwner) {
            ccOwner.innerHTML = '<option value="">— Select Owner —</option>';
            try {
                const json = await apiFetch('/users');
                const owners = (json.data || []).filter(u => u.role === 'owner');
                owners.forEach(o => {
                    ccOwner.insertAdjacentHTML('beforeend', `<option value="${o.id}">${esc(o.name)}</option>`);
                });
            } catch (_) { }
        }
        if (ccBranch) ccBranch.innerHTML = '<option value="">— Select owner first —</option>';
    } else {
        // Owner: hide owner selector, load own branches immediately
        if (ownerGroup) ownerGroup.style.display = 'none';
        if (ccBranch) {
            ccBranch.innerHTML = '<option value="">— Loading… —</option>';
            try {
                const json = await apiFetch('/branches');
                const branches = json.data || [];
                ccBranch.innerHTML = branches.length
                    ? branches.map(b => `<option value="${b.id}">${esc(b.shop_name || '')} — ${esc(b.name)}</option>`).join('')
                    : '<option value="">No branches found</option>';
            } catch (_) { }
        }
    }

    openModal('create-clerk-modal');
});

/* Owner selection changes → load their branches */
document.getElementById('cc-owner')?.addEventListener('change', async function () {
    const ccBranch = document.getElementById('cc-branch');
    if (!this.value) {
        if (ccBranch) ccBranch.innerHTML = '<option value="">— Select owner first —</option>';
        return;
    }
    if (ccBranch) ccBranch.innerHTML = '<option value="">Loading…</option>';
    try {
        const json = await apiFetch('/branches');
        const all = json.data || [];
        const ownerBranches = all.filter(b => String(b.owner_id) === String(this.value));
        if (ccBranch) ccBranch.innerHTML = ownerBranches.length
            ? ownerBranches.map(b => `<option value="${b.id}">${esc(b.shop_name || '')} — ${esc(b.name)}</option>`).join('')
            : '<option value="">No branches for this owner</option>';
    } catch (_) { }
});

document.getElementById('create-clerk-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getUser();
    const name = document.getElementById('cc-name')?.value?.trim();
    const email = document.getElementById('cc-email')?.value?.trim();
    const branchId = document.getElementById('cc-branch')?.value;
    const ownerId = user.role === 'admin' ? document.getElementById('cc-owner')?.value : null;

    if (!name || !email) return alert('Name and email required.');
    if (!branchId) return alert('Please select a branch. A clerk must be assigned to a branch.');
    if (user.role === 'admin' && !ownerId) return alert('Please select an owner.');

    const body = { name, email, branch_id: parseInt(branchId, 10) };
    if (ownerId) body.owner_id = parseInt(ownerId, 10);

    try {
        const res = await apiFetch('/users/clerk', { method: 'POST', body: JSON.stringify(body) });
        closeModal('create-clerk-modal');
        showCredentials('Clerk Created ✅', res.credentials?.email, res.credentials?.password);
        loadUsers();
    } catch (err) { alert(err.message || 'Failed to create clerk.'); }
});

/* ── Edit User ───────────────────────────────────────────────────────────────── */
let _editUserId = null;
const editUser = (idOrObj) => {
    // Accept either a numeric id (looked up from cache) or a full user object
    const u = (typeof idOrObj === 'number' || typeof idOrObj === 'string')
        ? _usersCache.get(parseInt(idOrObj, 10))
        : idOrObj;
    if (!u) return alert('User data not found. Please refresh the page.');
    _editUserId = u.id;
    document.getElementById('eu-name').value = u.name || '';
    document.getElementById('eu-email').value = u.email || '';

    const euBranch = document.getElementById('eu-branch');
    if (euBranch && u.role === 'clerk') {
        euBranch.innerHTML = '<option value="">Loading…</option>';
        apiFetch('/branches').then(json => {
            const all = json.data || [];
            const user = getUser();
            const branches = user.role === 'admin' ? all.filter(b => b.owner_id === (u.owner_id || u.id)) : all;
            euBranch.innerHTML = '<option value="">— No Branch —</option>' +
                branches.map(b => `<option value="${b.id}" ${b.id === u.branch_id ? 'selected' : ''}>${esc(b.shop_name || '')} — ${esc(b.name)}</option>`).join('');
        }).catch(_ => { });
        document.getElementById('eu-branch-group').style.display = '';
    } else {
        document.getElementById('eu-branch-group').style.display = 'none';
    }
    openModal('edit-user-modal');
};
window.Users = window.Users || {};
window.Users.editUser = editUser;

document.getElementById('edit-user-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!_editUserId) return;
    const body = {
        name: document.getElementById('eu-name')?.value?.trim(),
        email: document.getElementById('eu-email')?.value?.trim(),
        branch_id: document.getElementById('eu-branch')?.value || null,
    };
    try {
        await apiFetch(`/users/${_editUserId}`, { method: 'PUT', body: JSON.stringify(body) });
        closeModal('edit-user-modal');
        loadUsers();
    } catch (err) { alert(err.message || 'Failed to update user.'); }
});

/* ── Reset Password ──────────────────────────────────────────────────────────── */
const openResetPw = (id, name) => {
    document.getElementById('reset-pw-target-id').value = id;
    document.getElementById('reset-pw-target-name').value = name;
    document.getElementById('reset-modal-name').textContent = name;
    document.getElementById('reset-pw-input').value = '';
    openModal('reset-pw-modal');
};
window.Users.openResetPw = openResetPw;

document.getElementById('reset-pw-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('reset-pw-target-id').value;
    const pw = document.getElementById('reset-pw-input').value || '';
    try {
        const res = await apiFetch(`/users/${id}/password`, {
            method: 'PUT', body: JSON.stringify({ new_password: pw || undefined }),
        });
        closeModal('reset-pw-modal');
        showCredentials('Password Reset ✅', res.credentials?.email, res.credentials?.password);
    } catch (err) { alert(err.message || 'Failed to reset password.'); }
});

/* ── Deactivate / Reactivate ─────────────────────────────────────────────────── */
const toggleActive = async (id, name, activate) => {
    const action = activate ? 'reactivate' : 'deactivate';
    if (!confirm(`${activate ? 'Reactivate' : 'Deactivate'} "${name}"?`)) return;
    try {
        if (activate) await apiFetch(`/users/${id}/reactivate`, { method: 'PUT', body: '{}' });
        else await apiFetch(`/users/${id}`, { method: 'DELETE' });
        loadUsers();
    } catch (err) { alert(err.message || `Failed to ${action}.`); }
};
window.Users.toggleActive = toggleActive;

/* ── Delete Owner (hard delete with cascade) ─────────────────────────────────── */
const deleteOwner = async (id, name) => {
    if (!confirm(`⚠️ WARNING: This will PERMANENTLY delete owner "${name}" and ALL their data:\n\u2022 All shops and branches\n\u2022 All clerks\n\u2022 All inventory\n\u2022 All sales history\n\nThis CANNOT be undone. Continue?`)) return;
    // Second confirmation for extra safety
    const typed = prompt(`Type the owner's name exactly to confirm deletion:\n"${name}"`);
    if (typed !== name) return alert('Name did not match. Deletion cancelled.');
    try {
        await apiFetch(`/users/owner/${id}`, { method: 'DELETE' });
        loadUsers();
        // Also refresh dashboard metrics if available
        if (window.Dashboard) window.Dashboard.loadMetrics();
    } catch (err) { alert(err.message || 'Failed to delete owner.'); }
};
window.Users.deleteOwner = deleteOwner;

/* ── Manage Branches Modal ───────────────────────────────────────────────────── */
const loadBranchesModal = async () => {
    const tbody = document.getElementById('branches-tbody');
    const user = getUser();
    if (!tbody) return;
    try {
        const json = await apiFetch('/branches');
        const branches = json.data || [];
        tbody.innerHTML = branches.length ? branches.map(b => `
      <tr>
        <td>${esc(b.name)}</td>
        <td>${esc(b.shop_name || '')}</td>
        <td>${esc(b.address || '—')}</td>
        <td>${esc(b.phone || '—')}</td>
        <td>${b.clerk_count || 0} clerk(s)</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="Users.deleteBranch(${b.id},'${esc(b.name)}')">Delete</button>
        </td>
      </tr>`).join('')
            : '<tr><td colspan="6" class="empty-state">No branches yet.</td></tr>';

        // Populate shop selector in add-branch form
        const abShop = document.getElementById('ab-shop');
        if (abShop) {
            const shopJson = await apiFetch('/shops');
            const shops = shopJson.data || [];
            abShop.innerHTML = shops.map(s =>
                `<option value="${s.id}">${esc(user.role === 'admin' ? `${s.owner_name || ''} — ` : '')}${esc(s.name)}</option>`
            ).join('') || '<option value="">No shops found</option>';
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${esc(e.message)}</td></tr>`;
    }
};

document.getElementById('btn-manage-branches')?.addEventListener('click', () => {
    loadBranchesModal();
    openModal('branches-modal');
});

document.getElementById('add-branch-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const shop_id = document.getElementById('ab-shop')?.value;
    const name = document.getElementById('ab-name')?.value?.trim();
    const address = document.getElementById('ab-address')?.value?.trim();
    const phone = document.getElementById('ab-phone')?.value?.trim();
    if (!shop_id) return alert('Select a shop first.');
    if (!name) return alert('Branch name required.');
    try {
        await apiFetch('/branches', { method: 'POST', body: JSON.stringify({ shop_id: parseInt(shop_id, 10), name, address, phone }) });
        document.getElementById('add-branch-form')?.reset();
        loadBranchesModal();
    } catch (err) { alert(err.message || 'Failed to create branch.'); }
});

const deleteBranch = async (id, name) => {
    if (!confirm(`Delete branch "${name}"? Clerks assigned here will be unassigned.`)) return;
    try {
        await apiFetch(`/branches/${id}`, { method: 'DELETE' });
        loadBranchesModal();
    } catch (err) { alert(err.message || 'Failed to delete branch.'); }
};
window.Users.deleteBranch = deleteBranch;

/* ── Manage Shops Modal ──────────────────────────────────────────────────────── */
const loadShopsModal = async () => {
    const tbody = document.getElementById('shops-tbody');
    if (!tbody) return;
    try {
        const json = await apiFetch('/shops');
        const shops = json.data || [];
        tbody.innerHTML = shops.length ? shops.map(s => `
      <tr>
        <td>${esc(s.name)}</td>
        <td>${esc(s.owner_name || '')}</td>
        <td>${esc(s.currency)}</td>
        <td>${s.branch_count || 0}</td>
        <td>${s.allow_admin_visibility ? '✅ Yes' : '❌ No'}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="Users.deleteShop(${s.id},'${esc(s.name)}')">Delete</button>
        </td>
      </tr>`).join('')
            : '<tr><td colspan="6" class="empty-state">No shops yet.</td></tr>';
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${esc(e.message)}</td></tr>`;
    }
};

document.getElementById('btn-manage-shops')?.addEventListener('click', () => {
    loadShopsModal();
    openModal('shops-modal');
});

const deleteShop = async (id, name) => {
    if (!confirm(`Delete shop "${name}" and ALL its branches? This cannot be undone.`)) return;
    try {
        await apiFetch(`/shops/${id}`, { method: 'DELETE' });
        loadShopsModal();
    } catch (err) { alert(err.message || 'Failed to delete shop.'); }
};
window.Users.deleteShop = deleteShop;

/* ── Clear All Data ──────────────────────────────────────────────────────────── */
document.getElementById('btn-clear-all-data')?.addEventListener('click', async () => {
    const first = confirm(
        '⚠️ DANGER ZONE ⚠️\n\nThis will permanently delete ALL data:\n' +
        '• All owners and clerks\n• All shops and branches\n• All products, sales, categories, suppliers\n\n' +
        'Admin accounts will be preserved.\n\nAre you absolutely sure?'
    );
    if (!first) return;
    const confirmed = prompt('Type DELETE to confirm:');
    if (confirmed !== 'DELETE') return alert('Cancelled. No data was deleted.');
    try {
        await apiFetch('/users/clear-data', { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }) });
        alert('✅ All data cleared. Page will reload.');
        window.location.reload();
    } catch (err) { alert(err.message || 'Failed to clear data.'); }
});

/* expose loadUsers so dashboard.js can call it if needed */
window.Users.loadUsers = loadUsers;
