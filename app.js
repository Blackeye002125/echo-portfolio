// ============================================
// ECHO PORTFOLIO - Complete Application Logic
// ============================================

// ✅ YOUR SUPABASE CREDENTIALS - FIXED!
const SUPABASE_URL = 'https://mdiwyrwtwexvdikognuy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-bdW2xkTUtymZKzgmpZDeg_9kkHQfdO';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- GLOBAL STATE ----------
let currentUser = null;
let currentUserProfile = null;
let currentUnitId = null;
let currentUnits = [];
let modalCallback = null;
let currentPage = 'auth';

// ---------- PAGE NAVIGATION ----------
function showPage(page) {
    // Hide all pages
    document.getElementById('page-auth').style.display = 'none';
    document.getElementById('page-dashboard').style.display = 'none';
    document.getElementById('page-unitview').style.display = 'none';
    document.getElementById('page-admin').style.display = 'none';

    // Show target page
    const pageMap = {
        'auth': 'page-auth',
        'dashboard': 'page-dashboard',
        'unitview': 'page-unitview',
        'admin': 'page-admin'
    };
    const el = document.getElementById(pageMap[page]);
    if (el) el.style.display = 'block';
    currentPage = page;
}

// ---------- AUTHENTICATION ----------
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
            showPage('dashboard');
            initDashboard();
        } else {
            showPage('auth');
            setupAuthPage();
        }
    });

    // Setup modal close on overlay click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });

    // Setup item form if it exists
    const form = document.getElementById('add-item-form');
    if (form) {
        form.addEventListener('submit', handleAddItem);
    }
});

function setupAuthPage() {
    let isLogin = true;
    const form = document.getElementById('auth-form');
    const submitBtn = document.getElementById('auth-submit');
    const title = document.getElementById('auth-title');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const errorDiv = document.getElementById('auth-error');

    toggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        if (isLogin) {
            title.textContent = 'Welcome Back';
            submitBtn.textContent = 'Sign In';
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = 'Create one';
        } else {
            title.textContent = 'Create Account';
            submitBtn.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleLink.textContent = 'Sign in';
        }
        errorDiv.classList.remove('show');
        errorDiv.textContent = '';
        errorDiv.style.background = '';
        errorDiv.style.borderColor = '';
        errorDiv.style.color = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;

        errorDiv.classList.remove('show');
        errorDiv.textContent = '';

        try {
            let result;
            if (isLogin) {
                result = await supabase.auth.signInWithPassword({ email, password });
            } else {
                result = await supabase.auth.signUp({ email, password });
            }

            if (result.error) throw result.error;

            if (!isLogin) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase.from('users').insert([
                        { id: user.id, email: user.email, role: 'student', subscription_tier: 'free' }
                    ]);
                }
                errorDiv.style.background = 'rgba(52, 211, 153, 0.15)';
                errorDiv.style.borderColor = 'rgba(52, 211, 153, 0.3)';
                errorDiv.style.color = '#34d399';
                errorDiv.textContent = '✅ Account created! Please sign in.';
                errorDiv.classList.add('show');
                setTimeout(() => toggleLink.click(), 1500);
                return;
            }

            // Login success - reload page to show dashboard
            window.location.reload();

        } catch (err) {
            errorDiv.textContent = err.message || 'Authentication failed. Please try again.';
            errorDiv.classList.add('show');
        }
    });
}

// ---------- DASHBOARD ----------
async function initDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showPage('auth');
        return;
    }

    currentUser = user;

    // Get user profile
    const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error || !profile) {
        await supabase.from('users').insert([
            { id: user.id, email: user.email, role: 'student', subscription_tier: 'free' }
        ]);
        window.location.reload();
        return;
    }

    currentUserProfile = profile;
    updateUserUI();
    await loadUnits();
}

function updateUserUI() {
    const emailEl = document.getElementById('user-email');
    const badgeEl = document.getElementById('user-badge');
    const adminBadge = document.getElementById('admin-badge');
    const adminBtn = document.getElementById('admin-btn');
    const planDisplay = document.getElementById('plan-display');
    const limitEl = document.getElementById('unit-limit');

    if (emailEl) emailEl.textContent = currentUser.email;

    if (badgeEl && currentUserProfile) {
        const tier = currentUserProfile.subscription_tier || 'free';
        badgeEl.textContent = tier === 'premium' ? '⭐ Premium' : 'Free';
        badgeEl.className = `badge ${tier === 'premium' ? 'badge-premium' : 'badge-free'}`;
    }

    if (adminBadge && currentUserProfile && currentUserProfile.role === 'admin') {
        adminBadge.classList.remove('hidden');
    }

    if (adminBtn && currentUserProfile && currentUserProfile.role === 'admin') {
        adminBtn.classList.remove('hidden');
    }

    if (planDisplay && currentUserProfile) {
        const tier = currentUserProfile.subscription_tier || 'free';
        planDisplay.textContent = tier === 'premium' ? '⭐ Premium' : 'Free';
    }

    if (limitEl) {
        const limit = getUnitLimit();
        limitEl.textContent = limit;
    }
}

function getUnitLimit() {
    if (!currentUserProfile) return 40;
    return currentUserProfile.subscription_tier === 'premium' ? 200 : 40;
}

function getItemLimit() {
    return 12;
}

async function loadUnits() {
    if (!currentUser) return;

    const { data: units, error } = await supabase
        .from('units')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading units:', error);
        return;
    }

    currentUnits = units;
    renderUnits(units);
    updateStats(units);
}

function renderUnits(units) {
    const grid = document.getElementById('units-grid');
    if (!grid) return;

    const limit = getUnitLimit();

    let html = '';

    units.forEach(unit => {
        html += `
            <div class="unit-card" data-id="${unit.id}">
                <div class="unit-icon">📁</div>
                <div class="unit-name">${escapeHtml(unit.name)}</div>
                <div class="unit-meta">${unit.item_count || 0} items</div>
                <div class="unit-actions">
                    <button class="btn-sm btn-sm-edit" onclick="openUnit('${unit.id}')">Open</button>
                    <button class="btn-sm btn-sm-danger" onclick="confirmDeleteUnit('${unit.id}')">×</button>
                </div>
            </div>
        `;
    });

    if (units.length < limit) {
        html += `
            <div class="add-unit-card" onclick="showCreateUnitModal()">
                <div class="plus-icon">+</div>
                <div class="add-text">New Unit</div>
            </div>
        `;
    } else {
        html += `
            <div class="add-unit-card" style="opacity:0.5;cursor:not-allowed;border-color:#e5e7eb;">
                <div class="plus-icon" style="background:#d1d5db;">+</div>
                <div class="add-text">Limit Reached (${limit})</div>
            </div>
        `;
    }

    grid.innerHTML = html;
}

function updateStats(units) {
    const countEl = document.getElementById('unit-count');
    const itemTotalEl = document.getElementById('item-total');
    if (countEl) countEl.textContent = units.length;

    let totalItems = 0;
    units.forEach(u => { totalItems += (u.item_count || 0); });
    if (itemTotalEl) itemTotalEl.textContent = totalItems;
}

function showCreateUnitModal() {
    const name = prompt('Enter unit name:');
    if (!name || name.trim() === '') return;

    const limit = getUnitLimit();
    if (currentUnits.length >= limit) {
        alert(`Unit limit reached! Maximum ${limit} units allowed.`);
        return;
    }

    createUnit(name.trim());
}

async function createUnit(name) {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('units')
        .insert([
            { user_id: currentUser.id, name: name, item_count: 0 }
        ])
        .select()
        .single();

    if (error) {
        alert('Error creating unit: ' + error.message);
        return;
    }

    await loadUnits();
}

async function deleteUnit(unitId) {
    if (!currentUser) return;

    await supabase
        .from('portfolio_items')
        .delete()
        .eq('unit_id', unitId);

    const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId)
        .eq('user_id', currentUser.id);

    if (error) {
        alert('Error deleting unit: ' + error.message);
        return;
    }

    await loadUnits();
}

function confirmDeleteUnit(unitId) {
    showModal(
        'Delete Unit?',
        'This will permanently delete this unit and all its items. This action cannot be undone.',
        () => deleteUnit(unitId)
    );
}

function openUnit(unitId) {
    currentUnitId = unitId;
    const unit = currentUnits.find(u => u.id === unitId);
    localStorage.setItem('currentUnitId', unitId);
    localStorage.setItem('currentUnitName', unit ? unit.name : 'Unit');
    showPage('unitview');
    loadItems();
}

// ---------- UNIT VIEW (ITEMS) ----------
async function loadItems() {
    const unitId = localStorage.getItem('currentUnitId');
    if (!unitId) {
        alert('No unit selected.');
        showPage('dashboard');
        return;
    }

    currentUnitId = unitId;

    const titleEl = document.getElementById('unit-title');
    if (titleEl) {
        const name = localStorage.getItem('currentUnitName') || 'Unit';
        titleEl.textContent = `📁 ${escapeHtml(name)}`;
    }

    const { data: items, error } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading items:', error);
        return;
    }

    renderItems(items);
}

function renderItems(items) {
    const grid = document.getElementById('items-grid');
    if (!grid) return;

    if (items.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light);">
                <div style="font-size:48px;margin-bottom:12px;">📭</div>
                <p>No items yet. Add your first portfolio item above!</p>
            </div>
        `;
        return;
    }

    let html = '';
    items.forEach(item => {
        const icon = getItemIcon(item.type);
        const fileUrl = item.file_url ? `<a href="${item.file_url}" target="_blank" style="color:var(--gold);">🔗</a>` : '';

        html += `
            <div class="item-card" data-id="${item.id}">
                <div class="item-thumb">
                    ${item.file_url ? `<img src="${item.file_url}" alt="${escapeHtml(item.name)}" />` : icon}
                </div>
                <div class="item-name">${escapeHtml(item.name)} ${fileUrl}</div>
                <div class="item-type">${item.type || 'Document'}</div>
                <div class="item-actions">
                    <button class="btn-sm btn-sm-danger" onclick="confirmDeleteItem('${item.id}')">Delete</button>
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

function getItemIcon(type) {
    const icons = {
        'document': '📄',
        'image': '🖼️',
        'video': '🎬',
        'link': '🔗',
        'other': '📎'
    };
    return icons[type] || '📄';
}

async function handleAddItem(e) {
    e.preventDefault();

    const name = document.getElementById('item-name').value.trim();
    const type = document.getElementById('item-type').value;
    const fileInput = document.getElementById('item-file');
    const file = fileInput.files[0];

    if (!name) {
        alert('Please enter an item name.');
        return;
    }

    const { data: existingItems, error: countError } = await supabase
        .from('portfolio_items')
        .select('id', { count: 'exact' })
        .eq('unit_id', currentUnitId);

    if (countError) {
        alert('Error checking item limit.');
        return;
    }

    const limit = getItemLimit();
    if (existingItems.length >= limit) {
        alert(`Maximum ${limit} items per unit reached!`);
        return;
    }

    let fileUrl = null;
    if (file) {
        if (file.size > 25 * 1024 * 1024) {
            alert('File too large! Maximum 25MB.');
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${currentUnitId}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('portfolio-files')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            alert('Error uploading file: ' + uploadError.message);
            return;
        }

        const { data: urlData } = supabase.storage
            .from('portfolio-files')
            .getPublicUrl(fileName);

        fileUrl = urlData.publicUrl;
    }

    const { data, error } = await supabase
        .from('portfolio_items')
        .insert([
            {
                unit_id: currentUnitId,
                name: name,
                type: type,
                file_url: fileUrl,
                user_id: currentUser.id
            }
        ])
        .select()
        .single();

    if (error) {
        alert('Error adding item: ' + error.message);
        return;
    }

    await supabase
        .from('units')
        .update({ item_count: existingItems.length + 1 })
        .eq('id', currentUnitId);

    document.getElementById('item-name').value = '';
    document.getElementById('item-file').value = '';

    await loadItems();
}

async function deleteItem(itemId) {
    if (!currentUser) return;

    const { error } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', currentUser.id);

    if (error) {
        alert('Error deleting item: ' + error.message);
        return;
    }

    const { data: remaining } = await supabase
        .from('portfolio_items')
        .select('id', { count: 'exact' })
        .eq('unit_id', currentUnitId);

    await supabase
        .from('units')
        .update({ item_count: remaining.length })
        .eq('id', currentUnitId);

    await loadItems();
}

function confirmDeleteItem(itemId) {
    showModal(
        'Delete Item?',
        'This will permanently delete this portfolio item.',
        () => deleteItem(itemId)
    );
}

// ---------- ADMIN ----------
async function goToAdmin() {
    const isAdmin = await verifyAdmin();
    if (isAdmin) {
        showPage('admin');
        loadAdminStats();
    }
}

async function verifyAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showPage('auth');
        return false;
    }

    const { data: profile, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error || profile.role !== 'admin') {
        alert('⚠️ Unauthorized Access Detected.\nYou do not have administrative privileges.');
        showPage('dashboard');
        return false;
    }

    return true;
}

async function loadAdminStats() {
    try {
        const { count: studentCount } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true });

        const { count: unitCount } = await supabase
            .from('units')
            .select('id', { count: 'exact', head: true });

        const { count: itemCount } = await supabase
            .from('portfolio_items')
            .select('id', { count: 'exact', head: true });

        const { count: premiumCount } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('subscription_tier', 'premium');

        document.getElementById('stat-students').textContent = studentCount || 0;
        document.getElementById('stat-units').textContent = unitCount || 0;
        document.getElementById('stat-items').textContent = itemCount || 0;
        document.getElementById('stat-premium').textContent = premiumCount || 0;

        await loadRecentActivity();

    } catch (err) {
        console.error('Error loading admin stats:', err);
        document.getElementById('stat-students').textContent = '⚠️ Error';
        document.getElementById('stat-units').textContent = '⚠️ Error';
        document.getElementById('stat-items').textContent = '⚠️ Error';
        document.getElementById('stat-premium').textContent = '⚠️ Error';
    }
}

async function loadRecentActivity() {
    const activityDiv = document.getElementById('recent-activity');

    try {
        const { data: recentUnits } = await supabase
            .from('units')
            .select('name, created_at, users!inner(email)')
            .order('created_at', { ascending: false })
            .limit(5);

        const { data: recentItems } = await supabase
            .from('portfolio_items')
            .select('name, created_at, units!inner(name)')
            .order('created_at', { ascending: false })
            .limit(5);

        let html = '';

        if (recentUnits && recentUnits.length > 0) {
            html += '<strong>📚 Recent Units Created:</strong><ul style="margin:8px 0 16px 20px;">';
            recentUnits.forEach(u => {
                const email = u.users ? u.users.email : 'Unknown user';
                const date = new Date(u.created_at).toLocaleDateString();
                html += `<li>${escapeHtml(u.name)} — <span style="color:var(--text-light);font-size:13px;">${escapeHtml(email)} • ${date}</span></li>`;
            });
            html += '</ul>';
        }

        if (recentItems && recentItems.length > 0) {
            html += '<strong>📎 Recent Items Uploaded:</strong><ul style="margin:8px 0 0 20px;">';
            recentItems.forEach(item => {
                const unitName = item.units ? item.units.name : 'Unknown unit';
                const date = new Date(item.created_at).toLocaleDateString();
                html += `<li>${escapeHtml(item.name)} — <span style="color:var(--text-light);font-size:13px;">in ${escapeHtml(unitName)} • ${date}</span></li>`;
            });
            html += '</ul>';
        }

        if (!html) {
            html = 'No recent activity found.';
        }

        activityDiv.innerHTML = html;

    } catch (err) {
        console.error('Error loading recent activity:', err);
        activityDiv.textContent = 'Unable to load recent activity.';
    }
}

// ---------- UPGRADE PLAN ----------
function upgradePlan() {
    if (!currentUserProfile) return;

    if (currentUserProfile.subscription_tier === 'premium') {
        alert('You are already on the Premium plan! 🎉');
        return;
    }

    if (confirm('Upgrade to Premium for unlimited units? (This is a demo - no payment will be processed)')) {
        simulateUpgrade();
    }
}

async function simulateUpgrade() {
    const { error } = await supabase
        .from('users')
        .update({ subscription_tier: 'premium' })
        .eq('id', currentUser.id);

    if (error) {
        alert('Error upgrading: ' + error.message);
        return;
    }

    currentUserProfile.subscription_tier = 'premium';
    alert('🎉 Successfully upgraded to Premium! You now have 200 unit limit.');
    updateUserUI();
    await loadUnits();
}

// ---------- LOGOUT ----------
async function handleLogout() {
    await supabase.auth.signOut();
    localStorage.removeItem('currentUnitId');
    localStorage.removeItem('currentUnitName');
    window.location.reload();
}

// ---------- NAVIGATION ----------
function goBack() {
    showPage('dashboard');
    initDashboard();
}

function goToDashboard() {
    showPage('dashboard');
    initDashboard();
}

// ---------- MODAL SYSTEM ----------
function showModal(title, message, onConfirm) {
    const overlay = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    if (!overlay) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    modalCallback = onConfirm;

    confirmBtn.onclick = () => {
        closeModal();
        if (modalCallback) modalCallback();
    };

    overlay.classList.add('active');
}

function closeModal() {
    const overlay = document.getElementById('confirm-modal');
    if (overlay) overlay.classList.remove('active');
    modalCallback = null;
}

// ---------- UTILITIES ----------
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---------- AUTO-LOGIN CHECK ----------
// Check auth state on load
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        if (currentPage === 'auth') {
            window.location.reload();
        }
    }
    if (event === 'SIGNED_OUT') {
        showPage('auth');
    }
});

console.log('🚀 ECHO Portfolio loaded successfully!');
console.log('📡 Connected to Supabase:', SUPABASE_URL);
