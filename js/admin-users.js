// ==================== admin-users.js ====================
// users، branch inventory admin، discounts، payments، invoices، payment to admin

// ==================== USERS SECTION ====================
function renderUsers() {
    let html = `
        <div class="header-actions"><h2 class="page-title">User Management</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <button class="action-btn" onclick="showAddAdminModal()"><i class="fas fa-user-plus"></i> Add Admin</button>
        <button class="action-btn" onclick="showAddBranchModal()"><i class="fas fa-user-plus"></i> Add Branch</button>
        <button class="action-btn" onclick="showAddMainClientModal()"><i class="fas fa-user-plus"></i> Add Main Client</button>`;

    let activeUsers = users.filter(u => !u.deleted);
    if (activeUsers.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-users"></i><h3>No Users Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table>
            <thead><tr><th>ID</th><th>Username</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${activeUsers.map(u => {
                let statusClass = u.blocked ? 'badge-blocked' : (u.frozen ? 'badge-frozen' : (u.role === 'admin' ? 'badge-admin' : (u.role === 'mainclient' ? 'badge-mainclient' : 'badge-active')));
                let statusText = u.blocked ? 'Blocked' : (u.frozen ? 'Frozen' : (u.role === 'admin' ? 'Admin' : (u.role === 'mainclient' ? 'Main Client' : 'Active')));
                let isMainAdmin = (u.role === 'admin' && u.username === 'admin');
                return `<tr>
                    <td>${u.id}</td>
                    <td>${u.username} ${u.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : (u.role === 'mainclient' ? '<span class="badge badge-mainclient">Main Client</span>' : '')}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-edit" onclick="showEditUserModal(${u.id})"><i class="fas fa-edit"></i> Edit</button>
                        ${u.role !== 'admin' ? `
                            <button class="btn btn-warning" onclick="toggleFreezeUser(${u.id})">${u.frozen ? '<i class="fas fa-unlock"></i> Unfreeze' : '<i class="fas fa-snowflake"></i> Freeze'}</button>
                            <button class="btn btn-delete" onclick="toggleBlockUser(${u.id})">${u.blocked ? '<i class="fas fa-unlock"></i> Unblock' : '<i class="fas fa-ban"></i> Block'}</button>` : ''}
                        ${!isMainAdmin ? `<button class="btn btn-delete" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i> Delete</button>` : ''}
                    </td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

window.showAddAdminModal = function () { _showAddUserModal('Admin', 'admin'); };
window.showAddBranchModal = function () { _showAddUserModal('Branch', 'branch'); };
window.showAddMainClientModal = function () { _showAddUserModal('Main Client', 'mainclient'); };

function _showAddUserModal(label, role) {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New ${label}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" placeholder="Enter username"></div>
        <div class="form-group"><label>Password</label><input type="text" id="newPassword" placeholder="Enter password"></div>
        <button class="save-btn" onclick="saveNewUser('${role}')">Add ${label}</button>`;
    document.getElementById('modal').classList.add('active');
}

window.saveNewUser = async function (role) {
    let username = document.getElementById('newUsername').value;
    let password = document.getElementById('newPassword').value;
    if (!username || !password) { alert('Please fill all fields'); return; }
    if (users.some(u => u.username === username && !u.deleted)) { alert('Username already exists!'); return; }
    const btn = document.querySelector('#modalContent .save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
    try {
        const newUser = await addUser({ username, password, role, frozen: false, blocked: false, deleted: false });
        users = await fetchUsers();
        if (role === 'branch') {
            if (!branchInventory[username]) branchInventory[username] = [];
            if (!branchFinance[username]) branchFinance[username] = { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalLoss: 0, totalExpenses: 0 };
            if (!branchExpenses[username]) branchExpenses[username] = [];
        } else if (role === 'mainclient') {
            if (!mainClientExpenses[username]) mainClientExpenses[username] = [];
        }
        saveData(); closeModal();
        if (currentUser.role === 'admin') renderUsers();
        else renderMainClientUsers();
        alert(`"${username}" added successfully!`);
    } catch (error) {
        if (btn) { btn.disabled = false; btn.textContent = 'Add'; }
        alert(error.message || 'Failed to add user.');
    }
};

window.showEditUserModal = function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit User: ${user.username}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Username</label><input type="text" id="editUserUsername" value="${escapeHtml(user.username)}"></div>
        <div class="form-group"><label>New Password</label><input type="text" id="editUserPassword" value="${escapeHtml(user.password)}"></div>
        <button class="save-btn" onclick="saveEditUser(${id})"><i class="fas fa-save"></i> Save Changes</button>`;
    document.getElementById('modal').classList.add('active');
};

window.saveEditUser = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    let newUsername = document.getElementById('editUserUsername').value.trim();
    let newPassword = document.getElementById('editUserPassword').value.trim();
    if (!newUsername || !newPassword) { alert('Please fill all fields'); return; }
    if (newUsername !== user.username && users.some(u => u.username === newUsername && !u.deleted && u.id !== id)) { alert('Username already exists!'); return; }
    const saveBtn = document.querySelector('#modalContent .save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    try {
        await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUsername, password: newPassword, role: user.role, frozen: user.frozen, blocked: user.blocked, deleted: user.deleted }) });
        user.username = newUsername; user.password = newPassword;
        closeModal(); renderUsers(); alert(`User "${newUsername}" updated successfully!`);
    } catch (error) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
        alert('Failed to update user: ' + error.message);
    }
};

window.toggleFreezeUser = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    let newFrozen = !user.frozen;
    if (!confirm(`Are you sure you want to ${newFrozen ? 'freeze' : 'unfreeze'} "${user.username}"?`)) return;
    try {
        await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password: user.password, role: user.role, frozen: newFrozen, blocked: user.blocked, deleted: user.deleted }) });
        user.frozen = newFrozen; renderUsers(); alert(`User "${user.username}" ${newFrozen ? 'frozen' : 'unfrozen'} successfully!`);
    } catch (err) { alert('Failed: ' + err.message); }
};

window.toggleBlockUser = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    let newBlocked = !user.blocked;
    if (!confirm(`Are you sure you want to ${newBlocked ? 'block' : 'unblock'} "${user.username}"?`)) return;
    try {
        await fetch(`/api/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password: user.password, role: user.role, frozen: user.frozen, blocked: newBlocked, deleted: user.deleted }) });
        user.blocked = newBlocked; renderUsers(); alert(`User "${user.username}" ${newBlocked ? 'blocked' : 'unblocked'} successfully!`);
    } catch (err) { alert('Failed: ' + err.message); }
};

window.deleteUser = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    if (user.role === 'admin' && user.username === 'admin') { alert('Cannot delete the main admin user!'); return; }
    if (confirm(`Delete user "${user.username}" permanently?`)) {
        try {
            await fetch(`/api/users/${id}/hard`, { method: 'DELETE' });
            users = users.filter(u => u.id !== id);
            if (user.role === 'branch') { delete branchInventory[user.username]; delete branchFinance[user.username]; delete branchExpenses[user.username]; }
            else if (user.role === 'mainclient') { delete mainClientExpenses[user.username]; }
            renderUsers(); alert(`User "${user.username}" deleted successfully!`);
        } catch (error) { alert('Failed to delete user: ' + error.message); }
    }
};

// ==================== BRANCH INVENTORY ADMIN ====================
function renderBranchInventoryAdmin() {
    let allClients = getAllClientUsers();
    document.getElementById('content').innerHTML = `
        <div class="header-actions"><h2 class="page-title">Branch Inventory Management</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="branch-inventory-header">
            <h3><i class="fas fa-store"></i> Select Branch or Main Client to View Inventory</h3>
            <div class="branch-selector-large">
                <div class="form-group">
                    <label>Choose Branch or Main Client</label>
                    <select id="branchInventorySelect" onchange="loadBranchInventory()">
                        <option value="">-- Select --</option>
                        ${allClients.map(c => `<option value="${c.username}" data-role="${c.role}">${c.username} (${c.role === 'mainclient' ? 'Main Client' : 'Branch'})</option>`).join('')}
                    </select>
                </div>
                <button class="btn-view" onclick="loadBranchInventory()"><i class="fas fa-search"></i> Load Inventory</button>
            </div>
        </div>
        <div id="branchInventoryContainer" style="display:none;"></div>`;
}

async function loadBranchInventory() {
    let select = document.getElementById('branchInventorySelect');
    if (!select || !select.value) { alert('Please select a branch or main client'); return; }
    let client = select.value;
    let role = select.options[select.selectedIndex].dataset.role;
    let inventory = [];
    try {
        if (role === 'mainclient') {
            let originalUser = currentUser;
            currentUser = { username: client, role: 'mainclient' };
            inventory = await getMainClientItems();
            currentUser = originalUser;
        } else {
            try {
                const res = await fetch(`/api/branch-inventory/${client}`);
                const data = await res.json();
                inventory = data.map(b => ({ id: b.id, name: b.item_name, quantity: parseInt(b.quantity), purchasePrice: parseFloat(b.purchase_price), sellingPrice: parseFloat(b.selling_price), supplier: b.supplier }));
            } catch (err) { inventory = []; }
        }
    } catch (err) { inventory = []; }

    let totalStock = inventory.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
    let totalValue = inventory.reduce((s, i) => s + ((parseFloat(i.sellingPrice) || 0) * (parseInt(i.quantity) || 0)), 0);

    let html = `
        <div class="branch-stats">
            <div class="branch-stat-card"><div class="label">Total Items</div><div class="value">${inventory.length}</div></div>
            <div class="branch-stat-card"><div class="label">Total Stock</div><div class="value">${totalStock}</div></div>
            <div class="branch-stat-card"><div class="label">Total Value</div><div class="value total">${formatMoney(totalValue)}</div></div>
        </div>`;

    if (inventory.length === 0) {
        html += `<div class="empty-branch-inventory"><i class="fas fa-box-open"></i><h3>No Items in Inventory</h3></div>`;
    } else {
        html += `<div class="branch-inventory-table"><h3 style="margin-bottom:20px;">Inventory - ${client}</h3>
        <div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>#</th><th>Item Name</th><th>Stock</th>${role === 'mainclient' ? '<th>Remaining</th>' : ''}<th>Purchase Price</th><th>Selling Price</th><th>Discount</th><th>Total Value</th><th>Supplier</th>${role === 'mainclient' ? '<th>Payment</th>' : ''}</tr></thead>
            <tbody>${inventory.map((item, index) => {
                const qty = parseInt(item.quantity) || 0;
                const remainingQty = role === 'mainclient' ? (item.remainingQuantity || qty) : qty;
                const purchasePrice = parseFloat(item.purchasePrice) || 0;
                const sellingPrice = parseFloat(item.sellingPrice) || 0;
                const discount = getItemDiscount(item.name);
                return `<tr>
                    <td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${qty}</td>
                    ${role === 'mainclient' ? `<td class="remainder-stock">${remainingQty}</td>` : ''}
                    <td>${formatMoney(purchasePrice)}</td>
                    <td>${renderPriceWithDiscount(discount ? discount.originalPrice : sellingPrice, sellingPrice, item.name)}</td>
                    <td>${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : '-'}</td>
                    <td class="total-value">${formatMoney(purchasePrice * qty)}</td>
                    <td>${escapeHtml(item.supplier) || 'N/A'}</td>
                    ${role === 'mainclient' ? `<td><span class="badge ${item.paid ? 'badge-paid' : 'badge-unpaid'}">${item.paid ? 'PAID' : 'UNPAID'}</span></td>` : ''}
                </tr>`;
            }).join('')}</tbody>
        </table></div></div>`;
    }
    document.getElementById('branchInventoryContainer').style.display = 'block';
    document.getElementById('branchInventoryContainer').innerHTML = html;
}

// ==================== DISCOUNTS ====================
function renderDiscountManagement() {
    let html = `
        <div class="header-actions"><h2 class="page-title">Discount Management</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="stats-grid" style="margin-bottom:30px;">
            <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><i class="fas fa-tags" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Active Discounts</h4><div class="stat-value" style="color:white;">${Object.keys(itemDiscounts).length}</div></div>
            <div class="stat-card"><i class="fas fa-box"></i><h4>Total Items</h4><div class="stat-value">${mainInventory.length}</div></div>
        </div>
        <div class="btn-group" style="margin-bottom:30px;"><button class="action-btn" onclick="showAllItemsDiscountModal()"><i class="fas fa-percent"></i> Apply Discount to All Items</button></div>
        <div class="search-container">
            <div class="search-box"><i class="fas fa-search"></i><input type="text" id="discountSearchInput" placeholder="Search items..." onkeyup="searchDiscountItems()"></div>
            <div class="search-results" id="discountSearchResults">Showing ${mainInventory.length} items</div>
        </div>`;

    if (mainInventory.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-tags"></i><h3>No Items Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Item Name</th><th>Stock</th><th>Original Price</th><th>Current Price</th><th>Discount Status</th><th>Actions</th></tr></thead>
        <tbody id="discountTableBody">${renderDiscountRows(mainInventory)}</tbody></table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderDiscountRows(items) {
    return items.map((item, index) => {
        let discount = getItemDiscount(item.name);
        let originalPrice = discount ? discount.originalPrice : item.sellingPrice;
        let hasDiscount = discount && originalPrice !== item.sellingPrice;
        return `<tr>
            <td>${index + 1}</td><td>${item.name}</td><td>${item.quantity}</td>
            <td>${formatMoney(originalPrice)}</td>
            <td>${renderPriceWithDiscount(originalPrice, item.sellingPrice, item.name)}</td>
            <td>${hasDiscount ? `<span class="discount-badge">-${discount.discountPercent}% OFF</span>` : '<span style="color:#64748b;">No Discount</span>'}</td>
            <td><button class="btn btn-edit" onclick="showItemDiscountModal('${item.name}', ${item.sellingPrice})"><i class="fas fa-percent"></i> Apply Discount</button></td>
        </tr>`;
    }).join('');
}

window.searchDiscountItems = function () {
    let searchTerm = document.getElementById('discountSearchInput').value.toLowerCase();
    let filtered = mainInventory.filter(item => item.name.toLowerCase().includes(searchTerm));
    document.getElementById('discountTableBody').innerHTML = renderDiscountRows(filtered);
    document.getElementById('discountSearchResults').innerHTML = `Showing ${filtered.length} of ${mainInventory.length} items`;
};

window.showItemDiscountModal = function (itemName, currentPrice) {
    let discount = getItemDiscount(itemName);
    let originalPrice = discount ? discount.originalPrice : currentPrice;
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Apply Discount to ${itemName}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Current Price</label><input type="text" value="${formatMoney(currentPrice)}" readonly style="background:#f1f5f9;"></div>
        <div class="form-group"><label>Discount Type</label>
            <select id="discountType" onchange="toggleDiscountInput()">
                <option value="percent" ${discount && discount.isPercent ? 'selected' : ''}>Percentage (%)</option>
                <option value="fixed" ${discount && !discount.isPercent ? 'selected' : ''}>Fixed Amount (AFG)</option>
            </select>
        </div>
        <div class="form-group" id="percentInput"><label>Discount Percentage (%)</label><input type="number" id="discountPercent" min="0" max="100" value="${discount && discount.isPercent ? discount.discountPercent : 0}"></div>
        <div class="form-group" id="fixedInput" style="display:none;"><label>Discount Amount (AFG)</label><input type="number" id="discountAmount" min="0" step="0.01" value="${discount && !discount.isPercent ? discount.discountAmount : 0}"></div>
        <div class="form-group"><label>New Price</label><input type="text" id="newPriceDisplay" readonly style="background:#f1f5f9;"></div>
        <button class="save-btn" onclick="applyItemDiscount('${itemName}')"><i class="fas fa-check"></i> Apply Discount</button>`;
    document.getElementById('modal').classList.add('active');
    document.getElementById('discountPercent')?.addEventListener('input', updateNewPrice);
    document.getElementById('discountAmount')?.addEventListener('input', updateNewPrice);
    updateNewPrice();
};

window.toggleDiscountInput = function () {
    let type = document.getElementById('discountType').value;
    document.getElementById('percentInput').style.display = type === 'percent' ? 'block' : 'none';
    document.getElementById('fixedInput').style.display = type === 'fixed' ? 'block' : 'none';
    updateNewPrice();
};

function updateNewPrice() {
    let type = document.getElementById('discountType').value;
    let priceStr = document.querySelector('#modal input[value^="AFG"]')?.value || '0';
    let originalPrice = parseFloat(priceStr.replace(/[^0-9.-]+/g, '')) || 0;
    let newPrice = type === 'percent'
        ? originalPrice * (1 - (parseFloat(document.getElementById('discountPercent').value) || 0) / 100)
        : Math.max(0, originalPrice - (parseFloat(document.getElementById('discountAmount').value) || 0));
    if (document.getElementById('newPriceDisplay')) document.getElementById('newPriceDisplay').value = formatMoney(newPrice);
}

window.showAllItemsDiscountModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Apply Discount to All Items</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Discount Type</label>
            <select id="globalDiscountType" onchange="toggleGlobalDiscountInput()">
                <option value="percent">Percentage (%)</option><option value="fixed">Fixed Amount (AFG)</option>
            </select>
        </div>
        <div class="form-group" id="globalPercentInput"><label>Discount Percentage (%)</label><input type="number" id="globalDiscountPercent" min="0" max="100" value="0"></div>
        <div class="form-group" id="globalFixedInput" style="display:none;"><label>Discount Amount (AFG)</label><input type="number" id="globalDiscountAmount" min="0" step="0.01" value="0"></div>
        <div class="alert-box" style="margin:20px 0;"><i class="fas fa-info-circle"></i> This will apply to all ${mainInventory.length} items.</div>
        <button class="save-btn" onclick="applyGlobalDiscount()"><i class="fas fa-check"></i> Apply to All Items</button>`;
    document.getElementById('modal').classList.add('active');
};

window.toggleGlobalDiscountInput = function () {
    let type = document.getElementById('globalDiscountType').value;
    document.getElementById('globalPercentInput').style.display = type === 'percent' ? 'block' : 'none';
    document.getElementById('globalFixedInput').style.display = type === 'fixed' ? 'block' : 'none';
};

window.applyItemDiscount = function (itemName) {
    let type = document.getElementById('discountType').value;
    let discountValue = type === 'percent' ? parseFloat(document.getElementById('discountPercent').value) : parseFloat(document.getElementById('discountAmount').value);
    if (isNaN(discountValue) || discountValue < 0) { alert('Please enter a valid discount value'); return; }
    if (applyDiscountToItem(itemName, discountValue, type === 'percent')) {
        closeModal(); renderDiscountManagement(); alert(`Discount applied to ${itemName} successfully!`);
    }
};

window.applyGlobalDiscount = function () {
    let type = document.getElementById('globalDiscountType').value;
    let discountValue = type === 'percent' ? parseFloat(document.getElementById('globalDiscountPercent').value) : parseFloat(document.getElementById('globalDiscountAmount').value);
    if (isNaN(discountValue) || discountValue < 0) { alert('Please enter a valid discount value'); return; }
    if (confirm(`Apply this discount to all ${mainInventory.length} items?`)) {
        applyDiscountToAllItems(discountValue, type === 'percent');
        closeModal(); renderDiscountManagement(); alert('Discount applied to all items!');
    }
};

// ==================== ADMIN PAYMENTS ====================
function renderAdminPayments() {
    let branchUsersList = getBranchUsers();
    let mainClientUsersList = getMainClientUsers();
    let html = `<div class="header-actions"><h2 class="page-title">Branch Payment Management</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>`;

    if (branchUsersList.length === 0 || mainClientUsersList.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-credit-card"></i><h3>No Data Available</h3><p>Please add both main clients and branches first.</p></div>`;
        document.getElementById('content').innerHTML = html; return;
    }

    html += `
        <div class="branch-selector" style="flex-direction:column;align-items:stretch;">
            <div style="display:flex;gap:20px;margin-bottom:20px;">
                <div class="form-group" style="flex:1;"><label><i class="fas fa-user-tie"></i> Select Main Client</label>
                    <select id="adminPaymentMainClientSelect" onchange="updateAdminPaymentBranchList()">
                        <option value="">-- All Main Clients --</option>
                        ${mainClientUsersList.map(u => `<option value="${u.username}">${u.username}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="flex:1;"><label><i class="fas fa-code-branch"></i> Select Branch</label>
                    <select id="adminPaymentBranchSelect" disabled><option value="">-- First select a main client --</option></select>
                </div>
            </div>
            <div class="filter-row" style="grid-template-columns:1fr 1fr 1fr;">
                <div class="filter-group"><label><i class="fas fa-calendar"></i> Time Period</label>
                    <select id="adminPaymentTimePeriod" onchange="toggleAdminPaymentCustomDate()">
                        <option value="all">All Time</option><option value="daily">Daily</option>
                        <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>
                <div class="filter-group" id="adminPaymentCustomDate" style="display:none;grid-column:span 2;">
                    <label><i class="fas fa-calendar-alt"></i> Custom Date Range</label>
                    <div class="date-range">
                        <input type="date" id="adminPaymentStartDate" value="${getWeekAgoDate()}">
                        <span>to</span>
                        <input type="date" id="adminPaymentEndDate" value="${getTodayDate()}">
                    </div>
                </div>
            </div>
            <button class="btn-filter" onclick="loadAdminBranchPayments()"><i class="fas fa-search"></i> View Payments</button>
        </div>
        <div id="adminPaymentsContainer" style="display:none;"></div>`;
    document.getElementById('content').innerHTML = html;
}

window.updateAdminPaymentBranchList = function () {
    let branchSelect = document.getElementById('adminPaymentBranchSelect');
    let branches = getBranchUsers();
    branchSelect.innerHTML = '<option value="">-- All Branches --</option>' + branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('');
    branchSelect.disabled = false;
};

window.toggleAdminPaymentCustomDate = function () {
    let period = document.getElementById('adminPaymentTimePeriod').value;
    document.getElementById('adminPaymentCustomDate').style.display = period === 'custom' ? 'block' : 'none';
};

window.loadAdminBranchPayments = async function () {
    let branch = document.getElementById('adminPaymentBranchSelect').value;
    let period = document.getElementById('adminPaymentTimePeriod').value;
    let endDate = new Date(), startDate = new Date();
    if (period === 'daily') { startDate = new Date(endDate); startDate.setHours(0, 0, 0, 0); }
    else if (period === 'weekly') startDate.setDate(endDate.getDate() - 7);
    else if (period === 'monthly') startDate.setMonth(endDate.getMonth() - 1);
    else if (period === 'custom') {
        startDate = new Date(document.getElementById('adminPaymentStartDate').value);
        endDate = new Date(document.getElementById('adminPaymentEndDate').value);
        endDate.setHours(23, 59, 59, 999);
    } else startDate = new Date(2000, 0, 1);

    await refreshDataFromServer();
    let allShipments = branch ? mainClientToBranchShipments.filter(s => s.branch === branch) : [...mainClientToBranchShipments];
    let filteredShipments = allShipments.filter(s => { let d = new Date(s.date); return d >= startDate && d <= endDate; });

    let shipmentsWithStatus = filteredShipments.map(s => {
        let totalPrice = s.sellingPrice * s.qty;
        let paidAmount = Math.min(getShipmentPaidAmount(s), totalPrice);
        let reminder = totalPrice - paidAmount;
        return { ...s, totalPrice, paidAmount, reminder, status: paidAmount >= totalPrice ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid') };
    });

    let totalValue = shipmentsWithStatus.reduce((s, sh) => s + sh.totalPrice, 0);
    let totalPaid = shipmentsWithStatus.reduce((s, sh) => s + sh.paidAmount, 0);
    let totalUnpaid = totalValue - totalPaid;

    let html = `<div id="adminPaymentsContainer">
        <div class="payment-summary"><h3><i class="fas fa-chart-pie"></i> Payment Summary</h3>
            <div class="summary-stats" style="grid-template-columns:repeat(3,1fr);margin-top:20px;">
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatMoney(totalValue)}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatMoney(totalPaid)}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatMoney(totalUnpaid)}</div></div>
            </div>
        </div>`;

    if (shipmentsWithStatus.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box"></i><h3>No Shipments Found</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Date</th><th>Branch</th><th>Item</th><th>Qty</th><th>Selling Price</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
            <tbody>${shipmentsWithStatus.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => {
                let sc = s.status === 'paid' ? 'badge-paid' : (s.status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                return `<tr><td>${s.date}</td><td>${s.branch}</td><td>${s.item}</td><td>${s.qty}</td><td>${formatMoney(s.sellingPrice)}</td><td class="total-value">${formatMoney(s.totalPrice)}</td><td class="status-paid">${formatMoney(s.paidAmount)}</td><td class="reminder-amount">${formatMoney(s.reminder)}</td><td><span class="badge ${sc}">${s.status.toUpperCase()}</span></td></tr>`;
            }).join('')}</tbody>
            <tfoot><tr class="grand-total"><td colspan="5"><strong>Grand Total</strong></td><td><strong>${formatMoney(totalValue)}</strong></td><td><strong>${formatMoney(totalPaid)}</strong></td><td><strong>${formatMoney(totalUnpaid)}</strong></td><td></td></tr></tfoot>
        </table></div>`;
    }
    html += `</div>`;
    document.getElementById('adminPaymentsContainer').style.display = 'block';
    document.getElementById('adminPaymentsContainer').innerHTML = html;
};

// ==================== ADMIN INVOICES ====================
async function renderAdminInvoices() {
    try {
        const response = await fetch('/api/invoices/admin');
        if (response.ok) invoices = await response.json();
        else invoices = [];
    } catch (err) { invoices = []; }

    let html = `<div class="header-actions"><h2 class="page-title">All Invoices</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>`;
    if (!invoices || invoices.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No Invoices Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Invoice Number</th><th>Main Client</th><th>Branch</th><th>Date</th><th>Total Items</th><th>Total Value</th><th>Created At</th><th>Actions</th></tr></thead>
            <tbody>${invoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(inv => `
                <tr>
                    <td><strong>${escapeHtml(inv.number)}</strong></td>
                    <td>${escapeHtml(inv.main_client || 'N/A')}</td>
                    <td>${escapeHtml(inv.branch || 'N/A')}</td>
                    <td>${inv.date || '-'}</td>
                    <td>${inv.total_items || 0}</td>
                    <td class="total-value">${formatMoney(inv.total_value || 0)}</td>
                    <td>${inv.created_at ? new Date(inv.created_at).toLocaleString() : '-'}</td>
                    <td>
                        <button class="btn btn-edit" onclick="viewAdminInvoice('${inv.number}')"><i class="fas fa-eye"></i> View</button>
                        <button class="btn btn-delete" onclick="deleteAdminInvoice(${inv.id})"><i class="fas fa-trash"></i> Delete</button>
                    </td>
                </tr>`).join('')}
            </tbody></table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

window.deleteAdminInvoice = async function (invoiceId) {
    if (confirm('Are you sure you want to delete this invoice?')) {
        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
            if (response.ok) { invoices = invoices.filter(inv => inv.id !== invoiceId); renderAdminInvoices(); alert('Invoice deleted successfully!'); }
            else alert('Failed to delete invoice: ' + (await response.json()).error);
        } catch (err) { alert('Failed to delete invoice.'); }
    }
};

window.viewAdminInvoice = async function (invoiceNumber) {
    try {
        const response = await fetch(`/api/invoices/${invoiceNumber}`);
        if (response.ok) {
            const invoice = await response.json();
            document.getElementById('invoiceModalContent').innerHTML = `
                <div class="invoice-print">
                    <div class="invoice-header"><h2>Haqyar Mangal Trading Company</h2><h3>Shipment Invoice</h3></div>
                    <div class="invoice-info">
                        <div class="invoice-info-item"><div class="label">Invoice Number</div><div class="value">${invoice.number}</div></div>
                        <div class="invoice-info-item"><div class="label">Main Client</div><div class="value">${invoice.main_client || 'N/A'}</div></div>
                        <div class="invoice-info-item"><div class="label">Branch</div><div class="value">${invoice.branch || 'N/A'}</div></div>
                        <div class="invoice-info-item"><div class="label">Date</div><div class="value">${invoice.date || '-'}</div></div>
                    </div>
                    <table class="invoice-table">
                        <thead><tr><th>Item Name</th><th>Date</th><th>Quantity</th><th>Selling Price</th><th>Total Price</th></tr></thead>
                        <tbody>${invoice.items && invoice.items.length > 0 ? invoice.items.map(item => `<tr><td>${item.item_name || item.item}</td><td>${item.date || '-'}</td><td>${item.quantity || item.qty}</td><td>${formatMoney(item.selling_price || item.sellingPrice)}</td><td>${formatMoney(item.total_price || (item.selling_price * item.quantity))}</td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;">No items found</td></tr>'}</tbody>
                        <tfoot><tr class="grand-total"><td colspan="4"><strong>Grand Total:</strong></td><td><strong>${formatMoney(invoice.total_value || 0)}</strong></td></tr></tfoot>
                    </table>
                    <div class="invoice-total">Grand Total: ${formatMoney(invoice.total_value || 0)}</div>
                    <div class="invoice-footer"><p>Generated by ${invoice.main_client || 'Unknown'}</p><p>This is a computer generated invoice.</p></div>
                </div>
                <div style="text-align:center;margin-top:20px;" class="no-print">
                    <button class="close-btn" onclick="closeInvoiceModal()">Close</button>
                    <button class="action-btn" onclick="window.print()" style="margin-left:10px;"><i class="fas fa-print"></i> Print</button>
                </div>`;
            document.getElementById('invoiceModal').classList.add('active');
        }
    } catch (err) { alert('Failed to load invoice details'); }
};

// ==================== PAYMENT TO ADMIN (ADMIN VIEW) ====================
async function renderAdminPaymentsToAdmin() {
    let payments = [];
    try {
        const res = await fetch('/api/payments-to-admin');
        if (res.ok) payments = await res.json();
    } catch (err) { console.log('Error loading payments:', err); }

    let totalSaleValue = mainInventory.reduce((sum, item) => {
        return sum + ((parseFloat(item.sellingPrice) || 0) * (parseInt(item.quantity) || 0));
    }, 0);

    let totalPurchaseValue = mainInventory.reduce((sum, item) => {
        return sum + ((parseFloat(item.purchasePrice) || 0) * (parseInt(item.quantity) || 0));
    }, 0);

    let allExpenses = 0;
    for (const exp of expenses) allExpenses += parseFloat(exp.amount) || 0;
    for (const client in mainClientExpenses) {
        if (Array.isArray(mainClientExpenses[client]))
            for (const exp of mainClientExpenses[client]) allExpenses += parseFloat(exp.amount) || 0;
    }

    let profitValue = totalSaleValue - totalPurchaseValue - allExpenses;
    let totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    let totalUnpaid = payments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + parseFloat(p.amount), 0);

    let html = `
        <div class="header-actions"><h2 class="page-title">Payment to Admin</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="stats-grid" style="margin-bottom:24px;">


    <div style="background:#f0fdf4;border-radius:20px;padding:24px;margin-bottom:24px;border:2px solid #bbf7d0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <h3 style="color:#166534;"><i class="fas fa-chart-line" style="color:#22c55e;margin-right:8px;"></i>Financial Overview</h3>
            <div class="form-group" style="margin-bottom:0;min-width:180px;">
                <select id="financeTimeFilter" onchange="filterAdminPaymentsFinance()" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;background:white;color:#166534;font-weight:600;width:100%;">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="weekly">This Week</option>
                    <option value="monthly">This Month</option>
                </select>
            </div>
        </div>
        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:0;" id="financeOverviewGrid">
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;border:none;">
                <i class="fas fa-tags" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Total Sale Price</h4>
                <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(totalSaleValue)}</div>
                <small style="color:rgba(255,255,255,0.7);">Selling Price × Qty</small>
            </div>
            <div class="stat-card" style="background:linear-gradient(145deg,#f59e0b,#d97706);color:white;border:none;">
                <i class="fas fa-shopping-cart" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Total Purchase Price</h4>
                <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(totalPurchaseValue)}</div>
                <small style="color:rgba(255,255,255,0.7);">Purchase Price × Qty</small>
            </div>
            <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;border:none;">
                <i class="fas fa-file-invoice" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Total Expenses</h4>
                <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(allExpenses)}</div>
                <small style="color:rgba(255,255,255,0.7);">All expenses</small>
            </div>
            <div class="stat-card" style="background:${profitValue >= 0 ? 'linear-gradient(145deg,#22c55e,#16a34a)' : 'linear-gradient(145deg,#ef4444,#b91c1c)'};color:white;border:none;">
                <i class="fas fa-wallet" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Profit</h4>
                <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(profitValue)}</div>
                <small style="color:rgba(255,255,255,0.7);">Sale - Purchase - Expenses</small>
            </div>
        </div>
    </div>
            <div class="stat-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><i class="fas fa-check-circle" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Paid</h4><div class="stat-value" style="color:white;">${formatMoney(totalPaid)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><i class="fas fa-clock" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Unpaid</h4><div class="stat-value" style="color:white;">${formatMoney(totalUnpaid)}</div></div>
            <div class="stat-card"><i class="fas fa-list"></i><h4>Total Records</h4><div class="stat-value">${payments.length}</div></div>
        </div>
        <div class="search-container" style="margin-bottom:20px;"><div class="search-box"><i class="fas fa-search"></i><input type="text" id="payToAdminSearch" placeholder="Search by client name or description..." onkeyup="filterAdminPaymentsToAdmin()"></div></div>`;

    if (payments.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-money-bill-wave"></i><h3>No Payments Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="inventory-table" id="adminPayToAdminTable">
            <thead><tr><th>ID</th><th>Main Client</th><th>Date</th><th>Amount</th><th>Description</th><th>Status</th></tr></thead>
            <tbody id="adminPayToAdminBody">${renderAdminPayToAdminRows(payments)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
    window._allAdminPayments = payments;
}

function renderAdminPayToAdminRows(payments) {
    return payments.map(p => `
        <tr>
            <td>${p.id}</td>
            <td><span class="badge badge-mainclient">${p.main_client}</span></td>
            <td>${p.date ? p.date.split('T')[0] : '-'}</td>
            <td class="total-value">${formatMoney(parseFloat(p.amount))}</td>
            <td>${p.description || '-'}</td>
            <td><button class="btn ${p.status === 'paid' ? 'btn-success' : 'btn-warning'}" onclick="togglePaymentToAdminStatus(${p.id}, '${p.status}')">${p.status === 'paid' ? '✓ PAID' : '⏳ UNPAID'}</button></td>
        </tr>`).join('');
}

window.filterAdminPaymentsToAdmin = function () {
    let search = document.getElementById('payToAdminSearch').value.toLowerCase();
    let filtered = (window._allAdminPayments || []).filter(p => p.main_client.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search));
    let tbody = document.getElementById('adminPayToAdminBody');
    if (tbody) tbody.innerHTML = renderAdminPayToAdminRows(filtered);
};

window.togglePaymentToAdminStatus = async function (id, currentStatus) {
    let newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
        const res = await fetch(`/api/payments-to-admin/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
        if (!res.ok) throw new Error('Failed to update status');
        await renderAdminPaymentsToAdmin();
    } catch (err) { alert('Failed to update payment status: ' + err.message); }
};


window.filterAdminPaymentsFinance = function() {
    let filter = document.getElementById('financeTimeFilter').value;
    let now = new Date();

    let filteredInventory = mainInventory;

    // محاسبه بر اساس shipments در تایم انتخابی
    let filteredShipments = mainClientToBranchShipments.filter(s => {
        if (filter === 'all') return true;
        let d = new Date(s.date);
        if (filter === 'today') {
            return d.toDateString() === now.toDateString();
        } else if (filter === 'weekly') {
            let weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
            return d >= weekAgo;
        } else if (filter === 'monthly') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
    });

    let totalSale = filteredShipments.reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);
    let totalPurchase = filteredShipments.reduce((sum, s) => sum + ((s.purchasePrice || 0) * (s.qty || 0)), 0);

    let allExp = 0;
    for (const exp of expenses) allExp += parseFloat(exp.amount) || 0;
    for (const client in mainClientExpenses) {
        if (Array.isArray(mainClientExpenses[client]))
            for (const exp of mainClientExpenses[client]) allExp += parseFloat(exp.amount) || 0;
    }

    let profit = totalSale - totalPurchase - allExp;

    let grid = document.getElementById('financeOverviewGrid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;border:none;">
            <i class="fas fa-tags" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Total Sale Price</h4>
            <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(totalSale)}</div>
            <small style="color:rgba(255,255,255,0.7);">Selling Price × Qty</small>
        </div>
        <div class="stat-card" style="background:linear-gradient(145deg,#f59e0b,#d97706);color:white;border:none;">
            <i class="fas fa-shopping-cart" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Total Purchase Price</h4>
            <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(totalPurchase)}</div>
            <small style="color:rgba(255,255,255,0.7);">Purchase Price × Qty</small>
        </div>
        <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;border:none;">
            <i class="fas fa-file-invoice" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Total Expenses</h4>
            <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(allExp)}</div>
            <small style="color:rgba(255,255,255,0.7);">All expenses</small>
        </div>
        <div class="stat-card" style="background:${profit >= 0 ? 'linear-gradient(145deg,#22c55e,#16a34a)' : 'linear-gradient(145deg,#ef4444,#b91c1c)'};color:white;border:none;">
            <i class="fas fa-wallet" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Profit</h4>
            <div class="stat-value" style="color:white;font-size:20px;">${formatMoney(profit)}</div>
            <small style="color:rgba(255,255,255,0.7);">Sale - Purchase - Expenses</small>
        </div>`;
};