/**
 * FILE: client/js/settings.js
 * 
 * PURPOSE:
 *   Handles fetching and updating user profiles, passwords, global shop settings,
 *   and triggering database downloads.
 */

'use strict';

const loadProfile = async () => {
    try {
        const res = await apiFetch('/settings/profile');
        if (res.data) {
            document.getElementById('profile-name').value = res.data.name || '';
            document.getElementById('profile-email').value = res.data.email || '';
        }
    } catch (e) {
        console.error('Failed to load profile', e);
    }
};

const loadShopSettings = async () => {
    // Only Owners have shop settings; admins manage shops through the User Management page
    if (window.user?.role !== 'owner') {
        // Hide the shop settings card for non-owners
        const shopCard = document.getElementById('settings-shop-card');
        if (shopCard) shopCard.style.display = 'none';
        return;
    }

    // Show privacy card only for owners
    const privacyCard = document.getElementById('settings-privacy-card');
    if (privacyCard) privacyCard.style.display = '';

    try {
        const res = await apiFetch('/settings/shop');
        if (res.data) {
            document.getElementById('shop-name').value = res.data.shop_name || '';
            document.getElementById('shop-currency').value = res.data.currency || 'XAF';
            document.getElementById('shop-low-stock').value = res.data.low_stock_threshold || 10;

            // Privacy toggle (owner only)
            const toggle = document.getElementById('toggle-admin-visibility');
            if (toggle) toggle.checked = res.data.allow_admin_visibility === 1;
        }
    } catch (e) {
        console.error('Failed to load shop settings', e);
    }
};


// -- Profile Updates --
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-update-profile');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const name = document.getElementById('profile-name').value;
        const email = document.getElementById('profile-email').value;

        await apiFetch('/settings/profile', {
            method: 'PUT',
            body: JSON.stringify({ name, email })
        });

        // Update local session
        const u = JSON.parse(localStorage.getItem('user'));
        u.name = name;
        u.email = email;
        localStorage.setItem('user', JSON.stringify(u));
        window.user = u;

        document.getElementById('user-display').textContent = `${u.name} · ${u.role}`;
        alert('Profile updated successfully!');
    } catch (err) {
        alert(err.message || 'Failed to update profile.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

// -- Password Change --
document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-change-password');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const current_password = document.getElementById('pwd-current').value;
        const new_password = document.getElementById('pwd-new').value;

        await apiFetch('/settings/password', {
            method: 'PUT',
            body: JSON.stringify({ current_password, new_password })
        });

        alert('Password changed successfully!');
        document.getElementById('password-form').reset();
    } catch (err) {
        alert(err.message || 'Failed to change password.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

// -- Shop Settings Update --
document.getElementById('shop-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-shop');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const shop_name = document.getElementById('shop-name').value;
        const currency = document.getElementById('shop-currency').value;
        const low_stock_threshold = parseInt(document.getElementById('shop-low-stock').value, 10);

        await apiFetch('/settings/shop', {
            method: 'PUT',
            body: JSON.stringify({ shop_name, currency, low_stock_threshold })
        });

        alert('Shop settings saved! You may need to refresh the page to see currency changes everywhere.');
    } catch (err) {
        alert(err.message || 'Failed to save shop settings.');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
});

// -- Database Backup --
document.getElementById('btn-backup-db')?.addEventListener('click', async () => {
    try {
        const token = localStorage.getItem('token');
        // Fetch as blob instead of json
        const res = await fetch('/api/settings/backup', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to download backup');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Extract filename from Content-Disposition if available
        const cd = res.headers.get('content-disposition');
        let filename = 'inventory_backup.db';
        if (cd && cd.includes('filename=')) {
            filename = cd.split('filename=')[1].replace(/"/g, '');
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (err) {
        alert(err.message || 'An error occurred while downloading backup.');
    }
});


// -- Privacy / Visibility Toggle (Owner only) --
document.getElementById('btn-save-visibility')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-visibility');
    const checked = document.getElementById('toggle-admin-visibility')?.checked;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
        await apiFetch('/settings/shop', {
            method: 'PUT',
            body: JSON.stringify({ allow_admin_visibility: checked ? 1 : 0 })
        });
        btn.textContent = checked ? '✅ Visibility Enabled' : '✅ Visibility Disabled';
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
    } catch (err) {
        alert(err.message || 'Failed to save privacy setting.');
        btn.disabled = false;
        btn.textContent = original;
    }
});

// Initialize Settings tab data on load
document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure window.user is populated by dashboard.js
    setTimeout(() => {
        loadProfile();
        loadShopSettings();
    }, 100);
});
