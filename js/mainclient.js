// ==================== mainclient.js ====================
// Main Client: inventory، finance، expenses، distribute، total amount

// ==================== MAIN CLIENT INVENTORY ====================
async function renderMainClientInventory() {
    if (mainClientItems.length === 0 && mainInventory.length > 0) {
        mainClientItems = mainInventory.map(item => ({
            id: item.id, name: item.name, sellingPrice: item.sellingPrice,
            purchasePrice: item.purchasePrice, quantity: item.quantity,
            date: item.date || getTodayDate(), supplier: item.supplier
        }));
    }
    let clientItems = await getMainClientItems();

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Shared Inventory - Items from Admin</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="search-container">
            <div class="search-box"><i class="fas fa-search"></i>
                <input type="text" id="mainClientSearchInput" placeholder="Search items by name..." onkeyup="searchMainClientInventory()">
            </div>
            <div class="search-results" id="mainClientSearchResults">Showing ${clientItems.length} items</div>
        </div>`;

    if (clientItems.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No Items Yet</h3><p>Admin hasn't added any items yet.</p><button class="action-btn" onclick="refreshCurrentSection()" style="margin-bottom:0;"><i class="fas fa-sync-alt"></i> Refresh</button></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>ID</th><th>Date</th><th>Item Name</th><th>Selling Price</th><th>Discount</th><th>Stock</th><th>Remaining Stock</th><th>Total Sale Value</th><th>Status</th><th>Action</th></tr></thead>
            <tbody id="mainClientInventoryTableBody">${renderMainClientInventoryRows(clientItems)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderMainClientInventoryRows(items) {
    items = [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return items.map((item, index) => {
        let distributed = mainClientDistributed[item.name.trim()] || 0;
        let remainingQuantity = Math.max(0, item.quantity - distributed);
        let totalValue = (item.sellingPrice || 0) * remainingQuantity;
        let discount = getItemDiscount(item.name);
        let isReturnedItem = item.supplier && item.supplier.includes('Returned from');
        let shouldShowAsPaid = item.paid || isReturnedItem;

        let statusBadge = shouldShowAsPaid ? `<span class="badge badge-paid">PAID</span>` : `<span class="badge badge-unpaid">UNPAID</span>`;
        let actionButton = shouldShowAsPaid
            ? `<span class="badge" style="background:#22c55e;color:white;">✓ Ready</span>`
            : `<button class="btn btn-success" onclick="markMainClientItemAsPaidFromInventory('${item.name}', ${item.quantity})"><i class="fas fa-check"></i> Pay Now</button>`;

        return `<tr>
            <td>${index + 1}</td><td>${item.date || '-'}</td><td>${item.name}</td>
            <td>${renderPriceWithDiscount(discount ? discount.originalPrice : item.sellingPrice, item.sellingPrice, item.name)}</td>
            <td>${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : '-'}</td>
            <td>${item.quantity}</td>
            <td class="remainder-stock">${remainingQuantity}</td>
            <td class="total-value">${formatMoney(totalValue)}</td>
            <td>${statusBadge}</td>
            <td>${actionButton}</td>
        </tr>`;
    }).join('');
}

window.searchMainClientInventory = async function () {
    let searchTerm = document.getElementById('mainClientSearchInput').value.toLowerCase();
    let clientItems = await getMainClientItems();
    let filtered = clientItems.filter(item => item.name.toLowerCase().includes(searchTerm));
    let tbody = document.getElementById('mainClientInventoryTableBody');
    if (tbody) {
        tbody.innerHTML = renderMainClientInventoryRows(filtered);
        document.getElementById('mainClientSearchResults').innerHTML = `Showing ${filtered.length} of ${clientItems.length} items`;
    }
};

window.markMainClientItemAsPaidFromInventory = async function (itemName, quantity) {
    if (!currentUser || currentUser.role !== 'mainclient') { alert('You must be logged in as Main Client'); return; }
    let item = mainClientItems.find(i => i.name === itemName && i.quantity === quantity) || mainClientItems.find(i => i.name === itemName);
    if (!item) { alert('Item not found!'); return; }

    let rawDate = item.date || getTodayDate();
    let formattedDate = rawDate.includes('T') ? rawDate.split('T')[0] : (rawDate.includes('/') ? rawDate.replace(/\//g, '-') : rawDate);
    if (!formattedDate.match(/^\d{4}-\d{2}-\d{2}$/)) formattedDate = getTodayDate();

    try {
        const response = await fetch('/api/main-client-payments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ main_client: currentUser.username, item_id: item.id, item_name: itemName, quantity, date: formattedDate })
        });
        if (!response.ok) throw new Error(await response.text() || 'Failed to save payment');
        mainClientPayments[generateMainClientItemId(item)] = true;
        await refreshDataFromServer();
        await renderMainClientInventory();
        alert(`✅ Payment for ${itemName} (${quantity} units) marked as PAID successfully!`);
    } catch (error) { alert('❌ Failed to mark as paid: ' + error.message); }
};

// ==================== MAIN CLIENT FINANCE ====================
async function renderMainClientFinance() {
    let mainClient = currentUser.username;
    let clientExps = [];
    try {
        const response = await fetch(`/api/expenses/mainclient/${mainClient}`);
        if (response.ok) {
            clientExps = (await response.json()).map(e => ({ id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(), category: e.category, amount: parseFloat(e.amount), description: e.description }));
            mainClientExpenses[mainClient] = clientExps;
        } else clientExps = mainClientExpenses[mainClient] || [];
    } catch (err) { clientExps = mainClientExpenses[mainClient] || []; }

    let clientItems = await getMainClientItems();
    let approvedReturns = branchReturns.filter(r => r.status === 'approved' || r.status === 'paid');
    let totalReturnedItemsValue = approvedReturns.reduce((sum, r) => sum + (r.pricePerUnit || 0) * (r.quantity || 0), 0);
    let totalOriginalItemsValue = clientItems.reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.quantity || 0)), 0);
    let totalRemainingItemsValue = clientItems.reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.remainingQuantity || 0)), 0);
    let totalPaidToAdmin = clientItems.filter(i => i.paid === true).reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.quantity || 0)), 0);
    let totalUnpaidToAdmin = clientItems.filter(i => i.paid !== true).reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.quantity || 0)), 0);
    let totalExpenses = clientExps.reduce((sum, exp) => sum + exp.amount, 0);
    let totalDistributedValue = mainClientToBranchShipments.reduce((sum, s) => {
    return sum + ((s.sellingPrice || 0) * (s.qty || 0));
    }, 0);
    let approvedReturnValue = approvedReturns.reduce((sum, r) => sum + ((r.quantity || 0) * (r.pricePerUnit || 0)), 0);
    let netDistributedValue = totalOriginalItemsValue - (totalRemainingItemsValue);

    let html = `
        <div class="header-actions"><h2 class="page-title">My Financial Overview</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="stats-grid">
            <div class="stat-card"><i class="fas fa-boxes"></i><h4>Total Items Value (Original)</h4><div class="stat-value total-value">${formatMoney(totalOriginalItemsValue)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#f59e0b,#d97706);color:white;"><i class="fas fa-undo-alt" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Returned Items Value</h4><div class="stat-value" style="color:white;">${formatMoney(totalReturnedItemsValue)}</div><small style="color:rgba(255,255,255,0.7);">${approvedReturns.length} item(s) returned</small></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-chart-line" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Remaining Stock Value</h4><div class="stat-value" style="color:white;">${formatMoney(totalRemainingItemsValue)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><i class="fas fa-check-circle" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Paid to Admin</h4><div class="stat-value" style="color:white;">${formatMoney(totalPaidToAdmin)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><i class="fas fa-clock" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Unpaid to Admin</h4><div class="stat-value" style="color:white;">${formatMoney(totalUnpaidToAdmin)}</div></div>
            <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses</h4><div class="stat-value">${formatMoney(totalExpenses)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#8b5cf6,#7c3aed);color:white;">
                <i class="fas fa-share-alt" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Total Distribute Value</h4>
                <div class="stat-value" style="color:white;">${formatMoney(netDistributedValue)}</div>
                <small style="color:rgba(255,255,255,0.7);">Original - Remaining</small>
            </div>
        </div>
        <div class="payment-summary" style="margin-top:20px;">
            <h3><i class="fas fa-chart-pie"></i> Payment Summary</h3>
            <div class="summary-stats">
                <div class="summary-item"><div class="label">Total Items</div><div class="value">${clientItems.length}</div></div>
                <div class="summary-item"><div class="label">Paid Items</div><div class="value" style="color:#22c55e;">${clientItems.filter(i => i.paid).length}</div></div>
                <div class="summary-item"><div class="label">Unpaid Items</div><div class="value" style="color:#ef4444;">${clientItems.filter(i => !i.paid).length}</div></div>
            </div>
        </div>`;

    if (approvedReturns.length > 0) {
        html += `<h3 style="margin:30px 0 20px;">Returned Items from Branches</h3>
        <div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Date</th><th>Item Name</th><th>Quantity</th><th>Price/Unit</th><th>Total Value</th><th>Branch</th><th>Status</th></tr></thead>
            <tbody>${approvedReturns.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
                <tr><td>${r.date}</td><td>${r.itemName}</td><td>${r.quantity}</td><td>${formatMoney(r.pricePerUnit)}</td><td>${formatMoney(r.quantity * r.pricePerUnit)}</td><td>${r.branch}</td><td><span class="badge badge-paid">${r.status.toUpperCase()}</span></td></tr>`).join('')}
            </tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

// ==================== MAIN CLIENT EXPENSES ====================
async function renderMainClientExpenses() {
    let mainClient = currentUser.username;
    let expensesList = [];
    try {
        const response = await fetch(`/api/expenses/mainclient/${mainClient}`);
        if (response.ok) {
            expensesList = (await response.json()).map(e => ({ id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(), category: e.category, amount: parseFloat(e.amount), description: e.description }));
            mainClientExpenses[mainClient] = expensesList;
        } else expensesList = mainClientExpenses[mainClient] || [];
    } catch (err) { expensesList = mainClientExpenses[mainClient] || []; }

    let totalExpenses = expensesList.reduce((sum, exp) => sum + exp.amount, 0);

    let html = `
        <div class="header-actions"><h2 class="page-title">My Expenses</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="expense-section">
            <div class="expense-header">
                <h3><i class="fas fa-money-bill-wave"></i> Expense Management</h3>
                <button class="btn btn-primary" onclick="showAddMainClientExpenseModal()"><i class="fas fa-plus"></i> Add Expense</button>
            </div>
            <div style="background:#f0fdf4;border-radius:16px;padding:16px;margin-bottom:16px;border:2px solid #bbf7d0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <label style="color:#166534;font-weight:600;"><i class="fas fa-calendar" style="margin-right:6px;"></i>Time Period:</label>
                <select id="mcExpTimeFilter" onchange="filterMcExpenses()" style="padding:10px 16px;border:2px solid #bbf7d0;border-radius:12px;background:white;color:#166534;font-weight:600;">
                    <option value="all">All Time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom Range</option>
                </select>
                <div id="mcExpCustomRange" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;">
                    <input type="date" id="mcExpStart" value="${getWeekAgoDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                    <span style="color:#166534;">to</span>
                    <input type="date" id="mcExpEnd" value="${getTodayDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                    <button onclick="filterMcExpenses()" class="btn-filter" style="width:auto;margin-top:0;padding:10px 16px;">Apply</button>
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses</h4><div class="stat-value">${formatMoney(totalExpenses)}</div></div>
                <div class="stat-card"><i class="fas fa-calendar-alt"></i><h4>This Month</h4><div class="stat-value">${formatMoney(calculateMainClientMonthlyExpenses(expensesList))}</div></div>
            </div>
            <h3 style="margin-bottom:20px;">Expense History</h3>
            <div id="mainClientExpenseList">`;

    if (expensesList.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No Expenses Yet</h3><button class="action-btn" onclick="showAddMainClientExpenseModal()" style="margin-bottom:0;"><i class="fas fa-plus"></i> Add First Expense</button></div>`;
    } else {
        html += expensesList.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
            <div class="expense-item">
                <div class="expense-details"><h4>${escapeHtml(exp.category)}</h4><p>${exp.date} - ${escapeHtml(exp.description)}</p></div>
                <div class="expense-amount">${formatMoney(exp.amount)}</div>
                <div>
                    <button class="btn btn-edit" onclick="editMainClientExpense(${exp.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete" onclick="deleteMainClientExpense(${exp.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
    }
    html += `</div></div>`;
    document.getElementById('content').innerHTML = html;
}

function calculateMainClientMonthlyExpenses(expensesList) {
    let d = new Date();
    return expensesList.filter(exp => { let e = new Date(exp.date); return e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear(); }).reduce((sum, exp) => sum + exp.amount, 0);
}

window.showAddMainClientExpenseModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="mainClientExpCategory"><option value="Rent">Rent</option><option value="Utilities">Utilities</option><option value="Transport">Transport</option><option value="Marketing">Marketing</option><option value="Salary">Salary</option><option value="Other">Other</option></select>
        </div>
        <div class="form-group"><label>Amount (AFG)</label><input type="number" id="mainClientExpAmount" step="0.01" value="0"></div>
        <div class="form-group"><label>Description</label><textarea id="mainClientExpDescription" rows="3" placeholder="Enter expense description"></textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="mainClientExpDate" value="${getTodayDate()}"></div>
        <button class="save-btn" onclick="saveMainClientExpense()">Add Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.saveMainClientExpense = async function () {
    let mainClient = currentUser.username;
    let newExpense = { date: document.getElementById('mainClientExpDate').value, category: document.getElementById('mainClientExpCategory').value, amount: parseFloat(document.getElementById('mainClientExpAmount').value), description: document.getElementById('mainClientExpDescription').value, user_role: 'mainclient', username: mainClient };
    if (isNaN(newExpense.amount) || newExpense.amount <= 0) { alert('Please enter a valid amount'); return; }
    const btn = document.querySelector('#modalContent .save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
    try {
        const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newExpense) });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed');
        const savedExpense = await response.json();
        if (!mainClientExpenses[mainClient]) mainClientExpenses[mainClient] = [];
        mainClientExpenses[mainClient].push({ id: savedExpense.id, date: newExpense.date, category: newExpense.category, amount: newExpense.amount, description: newExpense.description });
        closeModal(); renderMainClientExpenses(); alert('Expense added successfully!');
    } catch (error) {
        if (btn) { btn.disabled = false; btn.textContent = 'Add Expense'; }
        alert('Failed to add expense: ' + error.message);
    }
};

window.editMainClientExpense = function (id) {
    let mainClient = currentUser.username;
    let exp = mainClientExpenses[mainClient]?.find(e => e.id === id);
    if (!exp) return;
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="mainClientExpCategory"><option value="Rent" ${exp.category === 'Rent' ? 'selected' : ''}>Rent</option><option value="Utilities" ${exp.category === 'Utilities' ? 'selected' : ''}>Utilities</option><option value="Transport" ${exp.category === 'Transport' ? 'selected' : ''}>Transport</option><option value="Marketing" ${exp.category === 'Marketing' ? 'selected' : ''}>Marketing</option><option value="Salary" ${exp.category === 'Salary' ? 'selected' : ''}>Salary</option><option value="Other" ${exp.category === 'Other' ? 'selected' : ''}>Other</option></select>
        </div>
        <div class="form-group"><label>Amount (AFG)</label><input type="number" id="mainClientExpAmount" step="0.01" value="${exp.amount}"></div>
        <div class="form-group"><label>Description</label><textarea id="mainClientExpDescription" rows="3">${escapeHtml(exp.description)}</textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="mainClientExpDate" value="${exp.date}"></div>
        <button class="save-btn" onclick="updateMainClientExpense(${id})">Update Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateMainClientExpense = async function (id) {
    let mainClient = currentUser.username;
    let exp = mainClientExpenses[mainClient]?.find(e => e.id === id);
    if (!exp) return;
    let updated = { date: document.getElementById('mainClientExpDate').value, category: document.getElementById('mainClientExpCategory').value, amount: parseFloat(document.getElementById('mainClientExpAmount').value), description: document.getElementById('mainClientExpDescription').value, user_role: 'mainclient', username: mainClient };
    try {
        const response = await fetch(`/api/expenses/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!response.ok) throw new Error('Failed to update');
        Object.assign(exp, { date: updated.date, category: updated.category, amount: updated.amount, description: updated.description });
        closeModal(); renderMainClientExpenses(); alert('Expense updated successfully!');
    } catch (error) { alert('Failed to update expense: ' + error.message); }
};

window.deleteMainClientExpense = async function (id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        let mainClient = currentUser.username;
        try {
            const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            mainClientExpenses[mainClient] = mainClientExpenses[mainClient].filter(e => e.id !== id);
            renderMainClientExpenses(); alert('Expense deleted successfully!');
        } catch (error) { alert('Failed to delete expense: ' + error.message); }
    }
};

// ==================== MAIN CLIENT DISTRIBUTE ====================
async function renderMainClientDistribute() {
    await refreshDataFromServer();
    let clientItems = await getMainClientItems();
    let availableItems = clientItems.filter(i => i.originalPaid === true && i.remainingQuantity > 0);
    let branchUsersList = getBranchUsers();

    let html = `<div class="header-actions"><h2 class="page-title">Distribute Items to Branches</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>`;

    if (branchUsersList.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-code-branch"></i><h3>No Branches Available</h3><p>Please add branches first</p><button class="action-btn" onclick="showSection('mainClientUsers')" style="margin-bottom:0;"><i class="fas fa-users"></i> Go to Branch Users</button></div>`;
    } else if (availableItems.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box"></i><h3>No Items Available for Distribution</h3><p>Pay for items from Admin first</p><button class="action-btn" onclick="showSection('mainClientInventory')" style="margin-bottom:0;"><i class="fas fa-box"></i> Go to Shared Inventory</button></div>`;
    } else {
        window.currentAvailableItems = availableItems;
        let branchOptions = branchUsersList.filter(u => !u.blocked).map(u => `<option value="${u.username}">${u.username} Branch</option>`).join('');
        let itemOptions = availableItems.map(i => `<option value="${i.name}" data-price="${i.sellingPrice}" data-purchase="${i.purchasePrice}" data-id="${i.id}" data-quantity="${i.remainingQuantity}">${i.name} (Available: ${i.remainingQuantity}) - ${formatMoney(i.sellingPrice)}</option>`).join('');

        html += `
            <div style="background:#f0fdf4;padding:32px;border-radius:24px;border:2px solid #bbf7d0;">
                <h3 style="margin-bottom:20px;color:#166534;">Distribute Form</h3>
                <div class="form-group"><label><i class="fas fa-code-branch"></i> Select Branch</label>
                    <select id="distBranch" class="form-control" onchange="updateDistItemDetails()">
                        <option value="">-- Choose a branch --</option>${branchOptions}
                    </select>
                </div>
                <div class="form-group"><label><i class="fas fa-box"></i> Select Item</label>
                    <select id="distItem" class="form-control" onchange="updateDistItemDetails()">
                        <option value="">-- Choose an item --</option>${itemOptions}
                    </select>
                </div>
                <div id="itemDetails" style="display:none;background:white;padding:20px;border-radius:16px;margin-bottom:20px;border:2px solid #bbf7d0;">
                    <h4 style="color:#166534;margin-bottom:15px;">Item Details</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                        <div><label>Available Quantity:</label><p id="availableQty" style="font-size:18px;font-weight:600;color:#22c55e;"></p></div>
                        <div><label>Selling Price per Unit:</label><p id="unitPrice" style="font-size:18px;font-weight:600;color:#166534;"></p></div>
                    </div>
                </div>
                <div class="form-group"><label><i class="fas fa-sort-numeric-up"></i> Quantity to Distribute</label>
                    <input type="number" id="distQty" class="form-control" min="1" value="1" onchange="validateQuantity()">
                    <small id="qtyHelp" style="color:#166534;display:block;margin-top:5px;"></small>
                </div>
                <div class="form-group"><label><i class="fas fa-tag"></i> Selling Price (AFG)</label>
                    <input type="number" id="distSellingPrice" class="form-control" step="0.01" readonly style="background:#f0fdf4;">
                    <small style="color:#166534;">Price is fixed</small>
                </div>
                <button class="action-btn" onclick="distributeToBranch()" style="width:100%;" id="distributeBtn" disabled><i class="fas fa-share-alt"></i> Distribute to Branch</button>
                <button class="action-btn" onclick="showMultipleDistributeForm()" style="width:100%;margin-top:10px;background:#3b82f6;"><i class="fas fa-layer-group"></i> Multiple Distribute</button>
            </div>

            <div style="margin-top:30px;">
                <h3 style="color:#166534;margin-bottom:20px;">Your Paid Items (Available for Distribution)</h3>
                <div class="table-wrapper"><table class="inventory-table">
                    <thead><tr><th>Item Name</th><th>Selling Price</th><th>Discount</th><th>Total Stock</th><th>Available Stock</th><th>Total Value</th><th>Status</th></tr></thead>
                    <tbody>${availableItems.map(item => {
                        let discount = getItemDiscount(item.name);
                        return `<tr>
                            <td>${item.name}</td>
                            <td>${renderPriceWithDiscount(discount ? discount.originalPrice : item.sellingPrice, item.sellingPrice, item.name)}</td>
                            <td>${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : '-'}</td>
                            <td>${item.quantity}</td>
                            <td class="remainder-stock" style="background:#fef3c7;font-weight:bold;font-size:16px;">${item.remainingQuantity}</td>
                            <td>${formatMoney(item.sellingPrice * item.remainingQuantity)}</td>
                            <td><span class="badge badge-paid">PAID</span></td>
                        </tr>`;
                    }).join('')}</tbody>
                </table></div>
            </div>`;
    }
    document.getElementById('content').innerHTML = html;
}

window.updateDistItemDetails = function () {
    let itemSelect = document.getElementById('distItem');
    let branchSelect = document.getElementById('distBranch');
    let distributeBtn = document.getElementById('distributeBtn');
    let itemDetails = document.getElementById('itemDetails');
    if (!itemSelect || !branchSelect) return;

    distributeBtn.disabled = !(itemSelect.value && branchSelect.value);

    if (itemSelect.value) {
        let opt = itemSelect.options[itemSelect.selectedIndex];
        let price = parseFloat(opt.dataset.price);
        let availableQuantity = parseInt(opt.dataset.quantity);
        document.getElementById('distSellingPrice').value = price;
        document.getElementById('availableQty').innerHTML = availableQuantity;
        document.getElementById('unitPrice').innerHTML = formatMoney(price);
        document.getElementById('qtyHelp').innerHTML = `Maximum available: ${availableQuantity}`;
        let qtyInput = document.getElementById('distQty');
        qtyInput.max = availableQuantity; qtyInput.value = 1;
        itemDetails.style.display = 'block';
    } else { itemDetails.style.display = 'none'; }
    validateQuantity();
};

window.validateQuantity = function () {
    let qtyInput = document.getElementById('distQty');
    let itemSelect = document.getElementById('distItem');
    let distributeBtn = document.getElementById('distributeBtn');
    if (!qtyInput || !itemSelect) return;
    if (itemSelect.value) {
        let maxQty = parseInt(itemSelect.options[itemSelect.selectedIndex].dataset.quantity);
        let qty = parseInt(qtyInput.value) || 0;
        if (qty < 1 || qty > maxQty) {
            qtyInput.style.borderColor = '#ef4444'; distributeBtn.disabled = true;
        } else {
            qtyInput.style.borderColor = '#bbf7d0';
            if (document.getElementById('distBranch').value) distributeBtn.disabled = false;
        }
    }
};

window.distributeToBranch = async function () {
    let btn = document.getElementById('distributeBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }

    let branch = document.getElementById('distBranch').value;
    let itemName = document.getElementById('distItem').value;
    let qty = parseInt(document.getElementById('distQty').value);
    let sellingPrice = parseFloat(document.getElementById('distSellingPrice').value);

    if (!branch || !itemName || !qty) { alert('Please fill all fields'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-share-alt"></i> Distribute to Branch'; } return; }

    let sharedItem = mainClientItems.find(i => i.name === itemName);
    if (!sharedItem) { alert('Item not found!'); return; }

    let distributedKey = itemName.trim();
    let currentDistributed = mainClientDistributed[distributedKey] || 0;
    let remainingQuantity = sharedItem.quantity - currentDistributed;

    if (remainingQuantity < qty) { alert(`Insufficient remaining stock! Available: ${remainingQuantity}`); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-share-alt"></i> Distribute to Branch'; } return; }

    let uniqueDistributionId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
        await fetch('/api/main-client-distributed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ main_client: currentUser.username, item_name: itemName, distributed_quantity: qty }) });
        mainClientDistributed[distributedKey] = (mainClientDistributed[distributedKey] || 0) + qty;
        await addBranchInventory({ branch, item_name: itemName, quantity: qty, selling_price: sellingPrice, purchase_price: sharedItem.purchasePrice, shipment_date: getTodayDate(), distribution_id: uniqueDistributionId, supplier: sharedItem.supplier, original_quantity: qty });
        await addShipment({ date: getTodayDate(), branch, item: itemName, qty, selling_price: sellingPrice, purchase_price: sharedItem.purchasePrice, unique_key: uniqueDistributionId });
        await fetch('/api/shipment-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: uniqueDistributionId, paid_amount: 0 }) });

        if (!branchInventory[branch]) branchInventory[branch] = [];
        branchInventory[branch].push({ id: branchInventory[branch].length + 1, name: itemName, quantity: qty, purchasePrice: sharedItem.purchasePrice, sellingPrice, supplier: sharedItem.supplier, shipmentDate: getTodayDate(), distributionId: uniqueDistributionId, originalQuantity: qty });
        mainClientToBranchShipments.push({ id: mainClientToBranchShipments.length + 1, date: getTodayDate(), branch, item: itemName, qty, purchasePrice: sharedItem.purchasePrice, sellingPrice, uniqueKey: uniqueDistributionId });
        saveData(); recalcMainFinance();
        await refreshDataFromServer();
        await renderMainClientDistribute();
        alert(`✅ Successfully distributed ${qty} ${itemName}(s) to ${branch} branch!\nRemaining stock: ${remainingQuantity - qty}`);
    } catch (error) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-share-alt"></i> Distribute to Branch'; }
        alert('Failed to distribute. Error: ' + error.message);
    }
};

window.showMultipleDistributeForm = async function () {
    let clientItems = await getMainClientItems();
    let availableItems = clientItems.filter(i => i.originalPaid === true && i.remainingQuantity > 0);
    let branchUsersList = getBranchUsers().filter(u => !u.blocked);

    let branchOptions = branchUsersList.map(u => `<option value="${u.username}">${u.username} Branch</option>`).join('');
    let itemCheckboxes = availableItems.map(item => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;background:white;border-radius:12px;margin-bottom:8px;border:2px solid #bbf7d0;">
            <input type="checkbox" id="chk_${item.name.replace(/\s/g,'_')}" value="${item.name}" data-price="${item.sellingPrice}" data-max="${item.remainingQuantity}" onchange="updateMultipleDistributeTable()" style="width:20px;height:20px;cursor:pointer;">
            <label for="chk_${item.name.replace(/\s/g,'_')}" style="flex:1;cursor:pointer;color:#166534;font-weight:500;">${item.name} <span style="color:#64748b;font-size:13px;">(Available: ${item.remainingQuantity} | ${formatMoney(item.sellingPrice)})</span></label>
        </div>`).join('');

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3><i class="fas fa-layer-group"></i> Multiple Distribute</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label><i class="fas fa-code-branch"></i> Select Branch</label>
            <select id="multiDistBranch" class="form-control"><option value="">-- Choose a branch --</option>${branchOptions}</select>
        </div>
        <div class="form-group"><label><i class="fas fa-box"></i> Select Items</label>
            <div style="max-height:250px;overflow-y:auto;padding:10px;background:#f0fdf4;border-radius:12px;border:2px solid #bbf7d0;">${itemCheckboxes.length > 0 ? itemCheckboxes : '<p style="color:#64748b;text-align:center;">No items available</p>'}</div>
        </div>
        <div id="multiDistTable" style="display:none;margin-top:20px;">
            <h4 style="color:#166534;margin-bottom:12px;">Selected Items</h4>
            <div class="table-wrapper"><table class="inventory-table"><thead><tr><th>Item Name</th><th>Quantity</th><th>Total Price</th></tr></thead><tbody id="multiDistTableBody"></tbody></table></div>
        </div>
        <button class="save-btn" onclick="processMultipleDistribute()" id="multiDistBtn" style="margin-top:20px;" disabled><i class="fas fa-share-alt"></i> Distribute All</button>`;
    document.getElementById('modal').classList.add('active');
    window._multiDistItems = availableItems;
};

window.updateMultipleDistributeTable = function () {
    let checkboxes = document.querySelectorAll('#modalContent input[type="checkbox"]:checked');
    let tbody = document.getElementById('multiDistTableBody');
    let tableDiv = document.getElementById('multiDistTable');
    let btn = document.getElementById('multiDistBtn');
    if (checkboxes.length === 0) { tableDiv.style.display = 'none'; btn.disabled = true; return; }
    tableDiv.style.display = 'block';
    let rows = '';
    checkboxes.forEach(chk => {
        let itemName = chk.value, price = parseFloat(chk.dataset.price), max = parseInt(chk.dataset.max);
        let inputId = `qty_${itemName.replace(/\s/g,'_')}`;
        rows += `<tr><td><strong>${itemName}</strong><br><small style="color:#64748b;">Max: ${max} | ${formatMoney(price)}/unit</small></td>
            <td><input type="number" id="${inputId}" min="1" max="${max}" value="1" style="width:80px;padding:8px;border:2px solid #bbf7d0;border-radius:8px;text-align:center;" onchange="updateMultipleDistributeTotal('${itemName.replace(/'/g,"\\'")}', ${price}, ${max}, this)"></td>
            <td id="total_${itemName.replace(/\s/g,'_')}" class="total-value">${formatMoney(price)}</td></tr>`;
    });
    tbody.innerHTML = rows;
    btn.disabled = !document.getElementById('multiDistBranch').value;
    document.getElementById('multiDistBranch').onchange = function () {
        btn.disabled = !this.value || document.querySelectorAll('#modalContent input[type="checkbox"]:checked').length === 0;
    };
};

window.updateMultipleDistributeTotal = function (itemName, price, max, input) {
    let qty = parseInt(input.value) || 1;
    if (qty < 1) { qty = 1; input.value = 1; }
    if (qty > max) { qty = max; input.value = max; }
    let cell = document.getElementById(`total_${itemName.replace(/\s/g,'_')}`);
    if (cell) cell.textContent = formatMoney(price * qty);
};

window.processMultipleDistribute = async function () {
    let branch = document.getElementById('multiDistBranch').value;
    if (!branch) { alert('Please select a branch'); return; }
    let checkboxes = document.querySelectorAll('#modalContent input[type="checkbox"]:checked');
    if (checkboxes.length === 0) { alert('Please select at least one item'); return; }
    let btn = document.getElementById('multiDistBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }

    let errors = [], successCount = 0;
    for (let chk of checkboxes) {
        let itemName = chk.value, price = parseFloat(chk.dataset.price);
        let qty = parseInt(document.getElementById(`qty_${itemName.replace(/\s/g,'_')}`)?.value) || 1;
        let sharedItem = mainClientItems.find(i => i.name === itemName);
        if (!sharedItem) { errors.push(`${itemName}: not found`); continue; }
        let currentDistributed = mainClientDistributed[itemName] || 0;
        let remaining = sharedItem.quantity - currentDistributed;
        if (remaining < qty) { errors.push(`${itemName}: insufficient stock (available: ${remaining})`); continue; }
        let uniqueId = `${Date.now() + successCount}_${Math.random().toString(36).substring(2,8)}`;
        try {
            await fetch('/api/main-client-distributed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ main_client: currentUser.username, item_name: itemName, distributed_quantity: qty }) });
            await addBranchInventory({ branch, item_name: itemName, quantity: qty, selling_price: price, purchase_price: sharedItem.purchasePrice, shipment_date: getTodayDate(), distribution_id: uniqueId, supplier: sharedItem.supplier, original_quantity: qty });
            await addShipment({ date: getTodayDate(), branch, item: itemName, qty, selling_price: price, purchase_price: sharedItem.purchasePrice, unique_key: uniqueId });
            await fetch('/api/shipment-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: uniqueId, paid_amount: 0 }) });
            mainClientDistributed[itemName] = (mainClientDistributed[itemName] || 0) + qty;
            successCount++;
        } catch (err) { errors.push(`${itemName}: ${err.message}`); }
    }
    closeModal();
    await refreshDataFromServer();
    await renderMainClientDistribute();
    if (errors.length > 0) alert(`✅ ${successCount} item(s) distributed!\n\n❌ Errors:\n${errors.join('\n')}`);
    else alert(`✅ All ${successCount} item(s) distributed to ${branch} successfully!`);
};

// ==================== TOTAL AMOUNT (MAIN CLIENT) ====================
function renderTotalAmountMain() {
    let branches = getBranchUsers();
    document.getElementById('content').innerHTML = `
        <div class="header-actions"><h2 class="page-title">Branch Payment Summary</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="branch-selector" style="margin-bottom:30px;">
            <div class="form-group" style="width:100%;"><label><i class="fas fa-code-branch"></i> Select Branch</label>
                <select id="totalAmountBranchSelectMain" onchange="loadTotalAmountMain()" style="width:100%;padding:12px;">
                    <option value="">-- All Branches --</option>
                    ${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
                </select>
            </div>
            <button class="btn-filter" onclick="loadTotalAmountMain()" style="margin-top:10px;"><i class="fas fa-search"></i> View Summary</button>
        </div>
        <div id="totalAmountContainerMainResult" style="display:none;"></div>`;
}

function loadTotalAmountMain() {
    let branch = document.getElementById('totalAmountBranchSelectMain')?.value;
    let shipments = branch ? mainClientToBranchShipments.filter(s => s.branch === branch) : mainClientToBranchShipments;
    let grandTotal = shipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);
    let totalPaid = 0;
    for (let shipment of shipments) {
        let paid = (shipment.uniqueKey && shipmentPayments[shipment.uniqueKey] !== undefined) ? Math.min(shipmentPayments[shipment.uniqueKey], shipment.sellingPrice * shipment.qty) : getShipmentPaidAmount(shipment);
        totalPaid += paid;
    }
    totalPaid = Math.min(totalPaid, grandTotal);
    let totalUnpaid = Math.max(0, grandTotal - totalPaid);

    let container = document.getElementById('totalAmountContainerMainResult');
    if (container) {
        container.style.display = 'block';
        container.innerHTML = `<div class="payment-summary"><h3><i class="fas fa-chart-pie"></i> Payment Summary ${branch ? 'for ' + branch + ' Branch' : 'for All Branches'}</h3>
            <div class="summary-stats" style="grid-template-columns:repeat(3,1fr);">
                <div class="summary-item" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><div class="label" style="color:rgba(255,255,255,0.8);">Grand Total</div><div class="value" style="color:white;font-size:28px;">${formatMoney(grandTotal)}</div></div>
                <div class="summary-item" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><div class="label" style="color:rgba(255,255,255,0.8);">Total Paid</div><div class="value" style="color:white;font-size:28px;">${formatMoney(totalPaid)}</div></div>
                <div class="summary-item" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><div class="label" style="color:rgba(255,255,255,0.8);">Total Unpaid</div><div class="value" style="color:white;font-size:28px;">${formatMoney(totalUnpaid)}</div></div>
            </div></div>`;
    }
}

// ==================== MAIN CLIENT HISTORY ====================
async function renderMainClientHistory() {
    let clientItems = await getMainClientItems();
    let items = clientItems.map(item => ({
        name: item.name, date: item.date || '-', stock: item.quantity,
        sellingPrice: item.sellingPrice, totalSellingPrice: (item.sellingPrice || 0) * (item.quantity || 0),
        status: item.paid === true ? 'PAID' : 'UNPAID'
    }));

    let html = `
        <div class="header-actions"><h2 class="page-title">Inventory History (Main Client)</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="search-container"><div class="search-box"><i class="fas fa-search"></i><input type="text" id="mainClientHistorySearchInput" placeholder="Search items..." onkeyup="searchMainClientHistory()"></div><div class="search-results" id="mainClientHistorySearchResults">Showing ${items.length} items</div></div>`;

    if (items.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-history"></i><h3>No Items Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="history-table">
            <thead><tr><th>Item Name</th><th>Date</th><th>Stock</th><th>Selling Price</th><th>Total Selling Price</th><th>Status</th></tr></thead>
            <tbody id="mainClientHistoryTableBody">${renderMainClientHistoryRows(items)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderMainClientHistoryRows(items) {
    return items.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td><td>${item.date}</td><td>${item.stock}</td>
            <td>${formatMoney(item.sellingPrice)}</td><td>${formatMoney(item.totalSellingPrice)}</td>
            <td><span class="badge ${item.status === 'PAID' ? 'badge-paid' : 'badge-unpaid'}">${item.status}</span></td>
        </tr>`).join('');
}

window.searchMainClientHistory = async function () {
    let searchTerm = document.getElementById('mainClientHistorySearchInput').value.toLowerCase();
    let clientItems = await getMainClientItems();
    let items = clientItems.filter(item => item.name.toLowerCase().includes(searchTerm)).map(item => ({
        name: item.name, date: item.date || '-', stock: item.quantity,
        sellingPrice: item.sellingPrice, totalSellingPrice: (item.sellingPrice || 0) * (item.quantity || 0),
        status: item.paid === true ? 'PAID' : 'UNPAID'
    }));
    document.getElementById('mainClientHistoryTableBody').innerHTML = renderMainClientHistoryRows(items);
    document.getElementById('mainClientHistorySearchResults').innerHTML = `Showing ${items.length} of ${clientItems.length} items`;
};

window.filterMcExpenses = function() {
    let mainClient = currentUser.username;
    let filter = document.getElementById('mcExpTimeFilter')?.value || 'all';
    let customRange = document.getElementById('mcExpCustomRange');
    if (customRange) customRange.style.display = filter === 'custom' ? 'flex' : 'none';

    let now = new Date();
    let startDate = new Date(2000, 0, 1), endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (filter === 'daily') {
        startDate = new Date(now.toDateString());
    } else if (filter === 'weekly') {
        startDate = new Date(now); startDate.setDate(now.getDate() - 7);
    } else if (filter === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'custom') {
        let s = document.getElementById('mcExpStart')?.value;
        let e = document.getElementById('mcExpEnd')?.value;
        if (!s || !e) return;
        startDate = new Date(s); endDate = new Date(e);
        endDate.setHours(23, 59, 59, 999);
    }

    let expensesList = mainClientExpenses[mainClient] || [];
    let filtered = expensesList.filter(exp => {
        let d = new Date(exp.date);
        return d >= startDate && d <= endDate;
    });

    let container = document.getElementById('mainClientExpenseList');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#64748b;background:#f0fdf4;border-radius:16px;">No expenses found for selected period</div>`;
    } else {
        container.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
            <div class="expense-item">
                <div class="expense-details"><h4>${escapeHtml(exp.category)}</h4><p>${exp.date} - ${escapeHtml(exp.description)}</p></div>
                <div class="expense-amount">${formatMoney(exp.amount)}</div>
                <div>
                    <button class="btn btn-edit" onclick="editMainClientExpense(${exp.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete" onclick="deleteMainClientExpense(${exp.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
    }
};