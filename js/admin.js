// ==================== admin.js ====================
// inventory، finance، expenses، reports، totalAmount
// ==================== ADMIN INVENTORY ====================
function renderInventory() {
    let totalPurchaseValue = 0, totalSaleValue = 0;
    for (let i = 0; i < mainInventory.length; i++) {
        const item = mainInventory[i];
        const purchasePrice = parseFloat(item.purchasePrice) || parseFloat(item.purchase_price) || 0;
        const sellingPrice = parseFloat(item.sellingPrice) || parseFloat(item.selling_price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        totalPurchaseValue += purchasePrice * quantity;
        totalSaleValue += sellingPrice * quantity;
    }

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Inventory Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <i class="fas fa-shopping-cart"></i>
                <h4>Total Inventory Value (Purchase)</h4>
                <div class="stat-value total-value">${formatMoney(totalPurchaseValue)}</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-tags"></i>
                <h4>Total Inventory Value (Sale)</h4>
                <div class="stat-value total-value">${formatMoney(totalSaleValue)}</div>
            </div>
        </div>
        <div class="search-container">
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="searchInput" placeholder="Search items by name, supplier, or price..." onkeyup="searchInventory()">
            </div>
            <div class="search-results" id="searchResults">Showing ${mainInventory.length} items</div>
        </div>
        <button class="action-btn" onclick="showAddItemModal()"><i class="fas fa-plus"></i> Add New Item</button>
    `;

    if (mainInventory.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No Items Yet</h3><p>Start by adding your first item to inventory</p><button class="action-btn" onclick="showAddItemModal()" style="margin-bottom:0;"><i class="fas fa-plus"></i> Add First Item</button></div>`;
    } else {
        html += `
            <div class="table-wrapper">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>ID</th><th>Date</th><th>Item Name</th><th>Purchase Price</th>
                            <th>Selling Price</th><th>Discount</th><th>Stock</th>
                            <th>Remainder Stock<br><small>(In Main Clients)</small></th>
                            <th>Total Purchase Value</th><th>Total Sale Value</th>
                            <th>Supplier</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="inventoryTableBody">${renderInventoryRows(mainInventory)}</tbody>
                    <tfoot>
                        <tr class="grand-total">
                            <td colspan="7"><strong>Grand Total</strong></td><td></td>
                            <td><strong>${formatMoney(totalPurchaseValue)}</strong></td>
                            <td><strong>${formatMoney(totalSaleValue)}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderInventoryRows(items) {
    if (!items || items.length === 0) return '<tr><td colspan="12" style="text-align:center;">No items found</td></tr>';
    return items.map((item, index) => {
        const purchasePrice = parseFloat(item.purchasePrice) || parseFloat(item.purchase_price) || 0;
        const sellingPrice = parseFloat(item.sellingPrice) || parseFloat(item.selling_price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        let discount = getItemDiscount(item.name);
        let discountHtml = discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : '-';
        let remainderInMainClients = calculateRemainingStockInMainClients(item.name);
        return `
            <tr>
                <td>${item.id}</td><td>${item.date || '-'}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${formatMoney(purchasePrice)}</td>
                <td>${renderPriceWithDiscount(discount ? discount.originalPrice : sellingPrice, sellingPrice, item.name)}</td>
                <td>${discountHtml}</td><td>${quantity}</td>
                <td class="remainder-stock" style="background:#fef3c7;font-weight:bold;">${remainderInMainClients}</td>
                <td class="total-value">${formatMoney(purchasePrice * quantity)}</td>
                <td class="total-value">${formatMoney(sellingPrice * quantity)}</td>
                <td>${escapeHtml(item.supplier) || '-'}</td>
                <td>
                    <button class="btn btn-edit" onclick="editItem(${item.id})"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-delete" onclick="deleteItem(${item.id})"><i class="fas fa-trash"></i> Delete</button>
                </td>
            </tr>`;
    }).join('');
}

window.searchInventory = function () {
    let searchTerm = document.getElementById('searchInput').value.toLowerCase();
    let filtered = mainInventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        (item.supplier && item.supplier.toLowerCase().includes(searchTerm)) ||
        item.purchasePrice.toString().includes(searchTerm) ||
        item.sellingPrice.toString().includes(searchTerm)
    );
    let tbody = document.getElementById('inventoryTableBody');
    if (tbody) {
        tbody.innerHTML = renderInventoryRows(filtered);
        document.getElementById('searchResults').innerHTML = `Showing ${filtered.length} of ${mainInventory.length} items`;
    }
};

window.showAddItemModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Item</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Item Name</label><input type="text" id="itemName" placeholder="Enter item name"></div>
        <div class="form-group"><label>Purchase Price (AFG)</label><input type="number" id="purchasePrice" step="0.01" value="0"></div>
        <div class="form-group"><label>Selling Price (AFG)</label><input type="number" id="sellingPrice" step="0.01" value="0"></div>
        <div class="form-group"><label>Quantity</label><input type="number" id="quantity" value="0"></div>
        <div class="form-group"><label>Supplier</label><input type="text" id="supplier" placeholder="Supplier name"></div>
        <div class="form-group"><label>Date Received</label><input type="date" id="itemDate" value="${getTodayDate()}"></div>
        <button class="save-btn" onclick="saveNewItem()">Save Item</button>`;
    document.getElementById('modal').classList.add('active');
};

window.saveNewItem = async function () {
    let name = document.getElementById('itemName').value.trim();
    let purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
    let sellingPrice = parseFloat(document.getElementById('sellingPrice').value);
    let quantity = parseInt(document.getElementById('quantity').value);
    let supplier = document.getElementById('supplier').value.trim();
    let itemDate = document.getElementById('itemDate').value;
    if (!name || isNaN(purchasePrice) || purchasePrice < 0 || isNaN(sellingPrice) || sellingPrice < 0 || isNaN(quantity) || quantity < 0 || !supplier) {
        alert('Please fill all fields correctly'); return;
    }
    const saveBtn = document.querySelector('#modalContent .save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
    try {
        const response = await fetch('/api/inventory', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, purchase_price: purchasePrice, selling_price: sellingPrice, quantity, supplier, date: itemDate })
        });
        if (response.ok) {
            const newItem = await response.json();
            mainInventory.push({ id: newItem.id, name, purchasePrice, sellingPrice, quantity, supplier, date: itemDate });
            mainClientItems.push({ id: newItem.id, name, sellingPrice, purchasePrice, quantity, date: itemDate, supplier });
            closeModal();
            await refreshDataFromServer();
            renderInventory();
            alert(`Item "${name}" added successfully!`);
        } else {
            const error = await response.json();
            alert('Failed to add item: ' + error.error);
        }
    } catch (error) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = 'Save Item'; }
        alert('Failed to add item. Make sure server is running.');
    }
};

window.editItem = function (id) {
    let item = mainInventory.find(i => i.id === id);
    if (!item) return;
    let formattedDate = item.date ? (item.date.includes('T') ? item.date.split('T')[0] : item.date) : getTodayDate();
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Item</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Item Name</label><input type="text" id="itemName" value="${escapeHtml(item.name)}"></div>
        <div class="form-group"><label>Purchase Price (AFG)</label><input type="number" id="purchasePrice" step="0.01" value="${item.purchasePrice}"></div>
        <div class="form-group"><label>Selling Price (AFG)</label><input type="number" id="sellingPrice" step="0.01" value="${item.sellingPrice}"></div>
        <div class="form-group"><label>Quantity</label><input type="number" id="quantity" value="${item.quantity}"></div>
        <div class="form-group"><label>Supplier</label><input type="text" id="supplier" value="${escapeHtml(item.supplier || '')}"></div>
        <div class="form-group"><label>Date Received</label><input type="date" id="itemDate" value="${formattedDate}"></div>
        <button class="save-btn" onclick="updateItem(${id})">Update Item</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateItem = async function (id) {
    let item = mainInventory.find(i => i.id === id);
    if (!item) return;
    let newName = document.getElementById('itemName').value;
    let newPurchasePrice = parseFloat(document.getElementById('purchasePrice').value);
    let newSellingPrice = parseFloat(document.getElementById('sellingPrice').value);
    let newQuantity = parseInt(document.getElementById('quantity').value);
    let newSupplier = document.getElementById('supplier').value;
    let newDate = document.getElementById('itemDate').value || getTodayDate();
    if (!newName || isNaN(newPurchasePrice) || newPurchasePrice < 0 || isNaN(newSellingPrice) || newSellingPrice < 0 || isNaN(newQuantity) || newQuantity < 0 || !newSupplier) {
        alert('Please fill all fields correctly'); return;
    }
    try {
        const response = await fetch(`/api/inventory/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, purchase_price: newPurchasePrice, selling_price: newSellingPrice, quantity: newQuantity, supplier: newSupplier, date: newDate })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        item.name = newName; item.purchasePrice = newPurchasePrice; item.sellingPrice = newSellingPrice;
        item.quantity = newQuantity; item.supplier = newSupplier; item.date = newDate;
        for (let mainItem of mainClientItems) {
            if (mainItem.id === id) { mainItem.name = newName; mainItem.purchasePrice = newPurchasePrice; mainItem.sellingPrice = newSellingPrice; mainItem.quantity = newQuantity; mainItem.supplier = newSupplier; mainItem.date = newDate; }
        }
        closeModal();
        await refreshDataFromServer();
        renderInventory();
        alert(`Item "${newName}" updated successfully!`);
    } catch (error) { alert('Failed to update item: ' + error.message); }
};

window.deleteItem = async function (id) {
    if (confirm('Are you sure you want to delete this item?')) {
        let item = mainInventory.find(i => i.id === id);
        if (item) {
            try {
                await deleteInventoryItem(id);
                mainClientItems = mainClientItems.filter(i => i.id !== id);
                mainInventory = mainInventory.filter(i => i.id !== id);
                await refreshDataFromServer();
                renderInventory();
                alert(`Item "${item.name}" deleted successfully!`);
            } catch (error) { alert('Failed to delete item. Make sure server is running.'); }
        }
    }
};

// ==================== ADMIN FINANCE ====================
async function renderFinance() {
    try {
        const response = await fetch('/api/expenses/all');
        if (response.ok) {
            const allExpenses = await response.json();
            for (const exp of allExpenses) {
                if (exp.user_role === 'branch') {
                    const branch = exp.username;
                    if (!branchExpenses[branch]) branchExpenses[branch] = [];
                    if (!branchExpenses[branch].find(e => e.id === exp.id)) {
                        branchExpenses[branch].push({ id: exp.id, date: exp.date ? exp.date.split('T')[0] : getTodayDate(), category: exp.category, amount: parseFloat(exp.amount), description: exp.description });
                    }
                }
            }
        }
    } catch (err) { console.log('Error loading branch expenses:', err); }
    recalcMainFinance();

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Financial Overview</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><i class="fas fa-shopping-cart"></i><h4>Total Purchases (Cost)</h4><div class="stat-value total-value">${formatMoney(mainFinance.totalPurchase)}</div><small>Sum of (Purchase Price × Quantity)</small></div>
            <div class="stat-card"><i class="fas fa-tags"></i><h4>Total Sales (Revenue)</h4><div class="stat-value total-value">${formatMoney(mainFinance.totalSale)}</div><small>Sum of (Selling Price × Quantity)</small></div>
            <div class="stat-card profit-card"><i class="fas fa-chart-line"></i><h4>Total Profit</h4><div class="stat-value ${mainFinance.totalProfit >= 0 ? 'profit-text' : 'loss-text'}">${formatMoney(mainFinance.totalProfit)}</div><small>Sales - Purchases - Expenses</small></div>
            <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses</h4><div class="stat-value">${formatMoney(mainFinance.totalExpenses)}</div></div>
            <small>Admin + Main Client only</small>
        </div>
        <div class="btn-group"><button class="action-btn" onclick="showAddExpenseModal()"><i class="fas fa-plus-circle"></i> Add New Expense</button></div>`;

    let branchUsersList = getBranchUsers();
    if (branchUsersList.length > 0) {
        let branchData = branchUsersList.map(user => {
            const branch = user.username;
            let totalSale = salesHistory.filter(s => s.branch === branch).reduce((sum, s) => sum + (s.revenue || 0), 0);
            let totalPurchase = mainClientToBranchShipments.filter(s => s.branch === branch).reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);
            let totalExpensesB = (branchExpenses[branch] || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
            return { username: branch, totalSale, totalPurchase, totalExpenses: totalExpensesB, profit: totalSale - totalPurchase - totalExpensesB, frozen: user.frozen, blocked: user.blocked };
        }).sort((a, b) => b.profit - a.profit);

        html += `<h3 style="margin:30px 0 20px;">Branch Performance Summary</h3>
        <div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Branch</th><th>Sales</th><th>Purchases</th><th>Expenses</th><th>Profit/Loss</th><th>Status</th></tr></thead>
            <tbody>${branchData.map(b => {
                let statusClass = b.blocked ? 'badge-blocked' : (b.frozen ? 'badge-frozen' : 'badge-active');
                let statusText = b.blocked ? 'Blocked' : (b.frozen ? 'Frozen' : 'Active');
                return `<tr>
                    <td><span class="badge ${statusClass}">${b.username}</span></td>
                    <td>${formatMoney(b.totalSale)}</td><td>${formatMoney(b.totalPurchase)}</td>
                    <td>${formatMoney(b.totalExpenses)}</td>
                    <td class="${b.profit >= 0 ? 'profit-text' : 'loss-text'}"><strong>${formatMoney(b.profit)}</strong></td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                </tr>`;
            }).join('')}</tbody>
            <tfoot><tr class="grand-total">
                <td><strong>Grand Total</strong></td>
                <td><strong>${formatMoney(branchData.reduce((s, b) => s + b.totalSale, 0))}</strong></td>
                <td><strong>${formatMoney(branchData.reduce((s, b) => s + b.totalPurchase, 0))}</strong></td>
                <td><strong>${formatMoney(branchData.reduce((s, b) => s + b.totalExpenses, 0))}</strong></td>
                <td><strong>${formatMoney(branchData.reduce((s, b) => s + b.profit, 0))}</strong></td>
                <td></td>
            </tr></tfoot>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

// ==================== ADMIN EXPENSES ====================
async function renderExpenses() {
    try {
        const response = await fetch('/api/expenses/admin');
        if (response.ok) {
            const dbExpenses = await response.json();
            expenses = dbExpenses.filter(e => e.user_role === 'admin').map(e => ({
                id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(),
                category: e.category, amount: parseFloat(e.amount), description: e.description,
                user_role: e.user_role, username: e.username
            }));
        }
    } catch (err) { console.log('Error loading expenses:', err); }
    recalcMainFinance();

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Expense Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="btn-group"><button class="action-btn" onclick="showAddExpenseModal()"><i class="fas fa-plus-circle"></i> Add New Expense</button></div>
        <div style="background:#f0fdf4;border-radius:16px;padding:16px;margin-bottom:20px;border:2px solid #bbf7d0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <label style="color:#166534;font-weight:600;"><i class="fas fa-calendar" style="margin-right:6px;"></i>Time Period:</label>
            <select id="adminExpTimeFilter" onchange="filterAdminExpenses()" style="padding:10px 16px;border:2px solid #bbf7d0;border-radius:12px;background:white;color:#166534;font-weight:600;">
                <option value="all">All Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Range</option>
            </select>
            <div id="adminExpCustomRange" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;">
                <input type="date" id="adminExpStart" value="${getWeekAgoDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                <span style="color:#166534;">to</span>
                <input type="date" id="adminExpEnd" value="${getTodayDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                <button onclick="filterAdminExpenses()" class="btn-filter" style="width:auto;margin-top:0;padding:10px 16px;">Apply</button>
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses (Admin Only)</h4><div class="stat-value">${formatMoney(mainFinance.totalExpenses)}</div></div>
            <div class="stat-card"><i class="fas fa-calendar-alt"></i><h4>This Month</h4><div class="stat-value">${formatMoney(calculateMonthlyExpenses())}</div></div>
            <div class="stat-card"><i class="fas fa-chart-pie"></i><h4>Avg. Daily</h4><div class="stat-value">${formatMoney(calculateDailyAverage())}</div></div>
        </div>`;

    if (expenses.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No Expenses Yet</h3><p>Start by adding your first expense</p><button class="action-btn" onclick="showAddExpenseModal()" style="margin-bottom:0;"><i class="fas fa-plus"></i> Add First Expense</button></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="expense-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>${expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
                <tr>
                    <td>${exp.date}</td><td><span class="badge badge-blocked">${exp.category}</span></td>
                    <td>${exp.description}</td><td style="color:#dc2626;font-weight:600;">${formatMoney(exp.amount)}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editExpense(${exp.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-delete" onclick="deleteExpense(${exp.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('')}
            </tbody></table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function calculateMonthlyExpenses() {
    let d = new Date();
    return expenses.filter(exp => { let e = new Date(exp.date); return e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear(); }).reduce((sum, exp) => sum + exp.amount, 0);
}

function calculateDailyAverage() {
    if (expenses.length === 0) return 0;
    let total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    let dates = expenses.map(exp => new Date(exp.date).getTime());
    let daysDiff = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) || 1;
    return total / daysDiff;
}

window.showAddExpenseModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="expCategory"><option value="Rent">Rent</option><option value="Salary">Salary</option><option value="Utilities">Utilities</option><option value="Marketing">Marketing</option><option value="Transport">Transport</option><option value="Other">Other</option></select>
        </div>
        <div class="form-group"><label>Amount (AFG)</label><input type="number" id="expAmount" step="0.01" value="0"></div>
        <div class="form-group"><label>Description</label><textarea id="expDescription" rows="3" placeholder="Enter expense description"></textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="expDate" value="${getTodayDate()}"></div>
        <button class="save-btn" onclick="saveNewExpense()">Add Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.saveNewExpense = async function () {
    let newExpense = { date: document.getElementById('expDate').value, category: document.getElementById('expCategory').value, amount: parseFloat(document.getElementById('expAmount').value), description: document.getElementById('expDescription').value, user_role: 'admin', username: currentUser ? currentUser.username : 'admin' };
    if (isNaN(newExpense.amount) || newExpense.amount <= 0) { alert('Please enter a valid amount'); return; }
    const btn = document.querySelector('#modalContent .save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
    try {
        const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newExpense) });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed');
        const savedExpense = await response.json();
        expenses.push({ id: savedExpense.id, date: newExpense.date, category: newExpense.category, amount: newExpense.amount, description: newExpense.description, user_role: 'admin', username: 'admin' });
        recalcMainFinance(); closeModal(); renderExpenses(); alert('Expense added successfully!');
    } catch (error) {
        if (btn) { btn.disabled = false; btn.textContent = 'Add Expense'; }
        alert('Failed to add expense. Make sure server is running.');
    }
};

window.editExpense = function (id) {
    let exp = expenses.find(e => e.id === id);
    if (!exp) return;
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="expCategory"><option value="Rent" ${exp.category === 'Rent' ? 'selected' : ''}>Rent</option><option value="Salary" ${exp.category === 'Salary' ? 'selected' : ''}>Salary</option><option value="Utilities" ${exp.category === 'Utilities' ? 'selected' : ''}>Utilities</option><option value="Marketing" ${exp.category === 'Marketing' ? 'selected' : ''}>Marketing</option><option value="Transport" ${exp.category === 'Transport' ? 'selected' : ''}>Transport</option><option value="Other" ${exp.category === 'Other' ? 'selected' : ''}>Other</option></select>
        </div>
        <div class="form-group"><label>Amount (AFG)</label><input type="number" id="expAmount" step="0.01" value="${exp.amount}"></div>
        <div class="form-group"><label>Description</label><textarea id="expDescription" rows="3">${exp.description}</textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="expDate" value="${exp.date}"></div>
        <button class="save-btn" onclick="updateExpense(${id})">Update Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateExpense = async function (id) {
    let exp = expenses.find(e => e.id === id);
    if (!exp) return;
    let updated = { date: document.getElementById('expDate').value, category: document.getElementById('expCategory').value, amount: parseFloat(document.getElementById('expAmount').value), description: document.getElementById('expDescription').value, user_role: 'admin', username: currentUser ? currentUser.username : 'admin' };
    try {
        const response = await fetch(`/api/expenses/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!response.ok) throw new Error('Failed to update');
        Object.assign(exp, { date: updated.date, category: updated.category, amount: updated.amount, description: updated.description });
        recalcMainFinance(); closeModal(); renderExpenses(); alert('Expense updated successfully!');
    } catch (error) { alert('Failed to update expense.'); }
};

window.deleteExpense = async function (id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            expenses = expenses.filter(e => e.id !== id);
            recalcMainFinance();
            let activeSection = document.querySelector('.nav-item.active')?.innerText.toLowerCase();
            if (activeSection?.includes('expenses')) renderExpenses();
            else if (activeSection?.includes('finance')) renderFinance();
            alert('Expense deleted successfully!');
        } catch (error) { alert('Failed to delete expense.'); }
    }
};

// ==================== ADMIN REPORTS ====================
function renderAdminReports() {
    recalcMainFinance();
    let totalPurchaseValue = calculateTotalPurchaseValue();
    let totalSaleValue = calculateTotalSaleValue();

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Complete Reports</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="report-grid">
            <div class="report-card">
                <h3><i class="fas fa-store"></i> Admin Summary</h3>
                <div class="report-number">${formatMoney(mainFinance.totalSale)}</div>
                <div class="report-label">Total Sales Value</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Purchases Cost:</span><span><strong>${formatMoney(mainFinance.totalPurchase)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Expenses:</span><span><strong>${formatMoney(mainFinance.totalExpenses)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;border-top:2px solid #e2e8f0;padding-top:8px;"><span>Total Profit:</span><span class="${mainFinance.totalProfit >= 0 ? 'profit-text' : 'loss-text'}"><strong>${formatMoney(mainFinance.totalProfit)}</strong></span></div>
                </div>
            </div>
            <div class="report-card">
                <h3><i class="fas fa-boxes"></i> Inventory Status</h3>
                <div class="report-number">${mainInventory.length}</div>
                <div class="report-label">Unique Items</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Purchase Value:</span><span><strong>${formatMoney(totalPurchaseValue)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Sale Value:</span><span><strong>${formatMoney(totalSaleValue)}</strong></span></div>
                </div>
            </div>
            <div class="report-card">
                <h3><i class="fas fa-percent"></i> Discounts</h3>
                <div class="report-number">${Object.keys(itemDiscounts).length}</div>
                <div class="report-label">Active Discounts</div>
            </div>

                    <div class="report-card">
            <h3><i class="fas fa-file-invoice"></i> Expenses Summary</h3>
            <div class="report-number">${formatMoney(mainFinance.totalExpenses)}</div>
            <div class="report-label">Total All Expenses</div>
            <div style="margin-top:20px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding:10px;background:#f0fdf4;border-radius:8px;">
                    <span><i class="fas fa-user-shield" style="color:#166534;margin-right:6px;"></i>Admin Expenses:</span>
                    <span><strong>${formatMoney(expenses.reduce((sum, exp) => sum + exp.amount, 0))}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding:10px;background:#f0fdf4;border-radius:8px;">
                    <span><i class="fas fa-user-tie" style="color:#166534;margin-right:6px;"></i>Main Client Expenses:</span>
                    <span><strong>${formatMoney(Object.values(mainClientExpenses).reduce((sum, arr) => sum + arr.reduce((s, exp) => s + exp.amount, 0), 0))}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding:10px;background:#f0fdf4;border-radius:8px;">
                    <span><i class="fas fa-code-branch" style="color:#166534;margin-right:6px;"></i>Branches Expenses:</span>
                    <span><strong>${formatMoney(Object.values(branchExpenses).reduce((sum, arr) => sum + arr.reduce((s, exp) => s + exp.amount, 0), 0))}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:12px;background:#166534;border-radius:8px;">
                    <span style="color:white;font-weight:600;"><i class="fas fa-calculator" style="margin-right:6px;"></i>Total Expenses (excl. Branches):</span>
                    <span style="color:white;font-weight:700;">${formatMoney(
                        expenses.reduce((sum, exp) => sum + exp.amount, 0) +
                        Object.values(mainClientExpenses).reduce((sum, arr) => sum + arr.reduce((s, exp) => s + exp.amount, 0), 0)
                    )}</span>
                </div>
            </div>
        </div>
        </div>
        <div class="branch-selector" style="margin-top:30px;">
            <div class="form-group">
                <label><i class="fas fa-users"></i> Select Client to View Report</label>
                <select id="reportClientSelect" onchange="showClientReport()">
                    <option value="">-- Select a Client --</option>
                    ${getAllClientUsers().map(u => `<option value="${u.username}" data-role="${u.role}">${u.username} (${u.role === 'mainclient' ? 'Main Client' : 'Branch'})</option>`).join('')}
                </select>
            </div>
            <button class="view-btn" onclick="showClientReport()"><i class="fas fa-chart-pie"></i> View Report</button>
        </div>
        <div id="clientReportContainer" style="margin-top:30px;display:none;"></div>`;
    document.getElementById('content').innerHTML = html;
}

window.showClientReport = async function () {
    let clientSelect = document.getElementById('reportClientSelect');
    if (!clientSelect || !clientSelect.value) { alert('Please select a client'); return; }
    let client = clientSelect.value;
    let role = clientSelect.options[clientSelect.selectedIndex].dataset.role;
    if (role === 'mainclient') await showMainClientReportInAdmin(client);
    else showBranchReportInAdmin(client);
};

async function showMainClientReportInAdmin(client) {
    await refreshDataFromServer();
    let originalUser = currentUser;
    currentUser = { username: client, role: 'mainclient' };
    let clientItems = await getMainClientItems();
    currentUser = originalUser;

    let paidItemsCount = 0, unpaidItemsCount = 0, totalPaidValue = 0, totalUnpaidValue = 0;
    for (const item of clientItems) {
        const itemTotalValue = item.sellingPrice * item.remainingQuantity;
        if (item.paid === true) { paidItemsCount++; totalPaidValue += itemTotalValue; }
        else { unpaidItemsCount++; totalUnpaidValue += itemTotalValue; }
    }
    let clientExps = mainClientExpenses[client] || [];
    let totalExpenses = clientExps.reduce((sum, exp) => sum + exp.amount, 0);
    let returnSummary = getReturnSummary();

    document.getElementById('clientReportContainer').style.display = 'block';
    document.getElementById('clientReportContainer').innerHTML = `
        <h3 style="margin-bottom:20px;">Client Report: ${client} (Main Client)</h3>
        <div class="report-grid">
            <div class="report-card"><h3><i class="fas fa-user-tie"></i> ${client}</h3><div class="report-number">${clientItems.length}</div><div class="report-label">Total Items Received</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Paid Items:</span><span class="profit-text"><strong>${paidItemsCount}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Unpaid Items:</span><span class="loss-text"><strong>${unpaidItemsCount}</strong></span></div>
                </div>
            </div>
            <div class="report-card"><h3><i class="fas fa-credit-card"></i> Payment Status</h3><div class="report-number">${formatMoney(totalPaidValue)}</div><div class="report-label">Total Paid</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Unpaid:</span><span class="loss-text"><strong>${formatMoney(totalUnpaidValue)}</strong></span></div>
                </div>
            </div>
            <div class="report-card"><h3><i class="fas fa-file-invoice"></i> Expenses</h3><div class="report-number">${formatMoney(totalExpenses)}</div><div class="report-label">Total Expenses</div></div>
            <div class="report-card"><h3><i class="fas fa-undo-alt"></i> Returns</h3><div class="report-number">${returnSummary.totalReturns}</div><div class="report-label">Total Returns</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Pending:</span><span style="color:#f59e0b;"><strong>${returnSummary.pendingReturns}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Return Value:</span><span><strong>${formatMoney(returnSummary.totalValue)}</strong></span></div>
                </div>
            </div>
        </div>`;
}

function showBranchReportInAdmin(branch) {
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let totalReceivedValue = branchShipments.reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);
    let inventory = branchInventory[branch] || [];
    let fin = branchFinance[branch] || { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalExpenses: 0 };
    let branchExps = branchExpenses[branch] || [];
    let totalExpenses = branchExps.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    let paymentSummary = getBranchPaymentSummary(branch);
    let salesSummary = getBranchSalesSummary(branch);

    document.getElementById('clientReportContainer').style.display = 'block';
    document.getElementById('clientReportContainer').innerHTML = `
        <h3 style="margin-bottom:20px;">Branch Report: ${branch}</h3>
        <div class="report-grid">
            <div class="report-card"><h3><i class="fas fa-truck"></i> Received</h3><div class="report-number">${branchShipments.reduce((s, sh) => s + sh.qty, 0)}</div><div class="report-label">Items Received</div>
                <div style="margin-top:15px;"><div style="display:flex;justify-content:space-between;"><span>Value:</span><span><strong>${formatMoney(totalReceivedValue)}</strong></span></div></div>
            </div>
            <div class="report-card"><h3><i class="fas fa-credit-card"></i> Payments</h3><div class="report-number">${formatMoney(paymentSummary.totalPaid)}</div><div class="report-label">Total Paid</div>
                <div style="margin-top:15px;"><div style="display:flex;justify-content:space-between;"><span>Unpaid:</span><span class="loss-text"><strong>${formatMoney(paymentSummary.totalUnpaid)}</strong></span></div></div>
            </div>
            <div class="report-card"><h3><i class="fas fa-shopping-cart"></i> Sales</h3><div class="report-number">${salesSummary.totalItemsSold}</div><div class="report-label">Items Sold</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;"><span>Revenue:</span><span><strong>${formatMoney(salesSummary.totalRevenue)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Profit:</span><span class="profit-text"><strong>${formatMoney(salesSummary.totalProfit)}</strong></span></div>
                </div>
            </div>
        </div>`;


        let branchSalesData = salesHistory.filter(s => s.branch === branch);

        html += `
            <h3 style="margin:30px 0 20px;">Branch Sales</h3>`;

        if (branchSalesData.length === 0) {
            html += `<div class="empty-state"><i class="fas fa-shopping-cart"></i><h3>No Sales Yet</h3></div>`;
        } else {
            let totalSalePrice = branchSalesData.reduce((sum, s) => sum + s.revenue, 0);
            html += `
                <div class="table-wrapper"><table class="inventory-table">
                    <thead><tr><th>Item Name</th><th>Stock Sold</th><th>Sale Date</th><th>Price per Unit</th><th>Total Price</th></tr></thead>
                    <tbody>${branchSalesData.sort((a,b) => new Date(b.date) - new Date(a.date)).map(s => `
                        <tr>
                            <td>${s.item}</td><td>${s.qty}</td><td>${s.date}</td>
                            <td>${formatMoney(s.price)}</td>
                            <td class="total-value">${formatMoney(s.revenue)}</td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr class="grand-total">
                        <td colspan="4"><strong>Total Sale Price</strong></td>
                        <td><strong>${formatMoney(totalSalePrice)}</strong></td>
                    </tr></tfoot>
                </table></div>`;
        }

        document.getElementById('clientReportContainer').style.display = 'block';
        document.getElementById('clientReportContainer').innerHTML = html;
}

// ==================== TOTAL AMOUNT (ADMIN) ====================
function renderTotalAmount() {
    let branches = getBranchUsers();
    document.getElementById('content').innerHTML = `
        <div class="header-actions">
            <h2 class="page-title">Branch Payment Summary</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="branch-selector" style="margin-bottom:30px;">
            <div class="form-group" style="width:100%;"><label><i class="fas fa-code-branch"></i> Select Branch</label>
                <select id="totalAmountBranchSelect" onchange="loadTotalAmount()" style="width:100%;padding:12px;">
                    <option value="">-- All Branches --</option>
                    ${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
                </select>
            </div>
            <button class="btn-filter" onclick="loadTotalAmount()" style="margin-top:10px;"><i class="fas fa-search"></i> View Summary</button>
        </div>
        <div id="totalAmountContainerResult" style="display:none;"></div>`;
}

function loadTotalAmount() {
    let branch = document.getElementById('totalAmountBranchSelect')?.value;
    let shipments = branch ? mainClientToBranchShipments.filter(s => s.branch === branch) : mainClientToBranchShipments;
    let grandTotal = shipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);
    let totalPaid = 0;
    for (let shipment of shipments) {
        let paid = (shipment.uniqueKey && shipmentPayments[shipment.uniqueKey] !== undefined) ? Math.min(shipmentPayments[shipment.uniqueKey], shipment.sellingPrice * shipment.qty) : getShipmentPaidAmount(shipment);
        totalPaid += paid;
    }
    totalPaid = Math.min(totalPaid, grandTotal);
    let totalUnpaid = Math.max(0, grandTotal - totalPaid);

    let container = document.getElementById('totalAmountContainerResult');
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

// ==================== ADMIN HISTORY ====================
async function renderAdminHistory() {
    await refreshDataFromServer();
    let items = [];
    let mainClients = users.filter(u => u.role === 'mainclient' && !u.deleted);
    for (let item of mainInventory) {
        let isPaid = false;
        for (let client of mainClients) {
            try {
                const response = await fetch(`/api/main-client-payments/${client.username}`);
                if (response.ok) {
                    const payments = await response.json();
                    if (payments.find(p => p.item_name === item.name && (p.is_paid === true || p.is_paid === 1))) { isPaid = true; break; }
                }
            } catch (err) {}
        }
        items.push({ name: item.name, date: item.date || '-', stock: item.quantity, sellingPrice: item.sellingPrice, purchasePrice: item.purchasePrice, totalSellingPrice: (item.sellingPrice || 0) * (item.quantity || 0), status: isPaid ? 'PAID' : 'UNPAID' });
    }

    let html = `
        <div class="header-actions"><h2 class="page-title">Inventory History</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="search-container"><div class="search-box"><i class="fas fa-search"></i><input type="text" id="adminHistorySearchInput" placeholder="Search items..." onkeyup="searchAdminHistory()"></div><div class="search-results" id="adminHistorySearchResults">Showing ${items.length} items</div></div>`;

    if (items.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-history"></i><h3>No Items Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="history-table">
            <thead><tr><th>Item Name</th><th>Date</th><th>Stock</th><th>Selling Price</th><th>Purchase Price</th><th>Total Selling Price</th><th>Status</th></tr></thead>
            <tbody id="adminHistoryTableBody">${renderAdminHistoryRows(items)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderAdminHistoryRows(items) {
    return items.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td><td>${item.date}</td><td>${item.stock}</td>
            <td>${formatMoney(item.sellingPrice)}</td><td>${formatMoney(item.purchasePrice)}</td>
            <td>${formatMoney(item.totalSellingPrice)}</td>
            <td><span class="badge ${item.status === 'PAID' ? 'badge-paid' : 'badge-unpaid'}">${item.status}</span></td>
        </tr>`).join('');
}

window.searchAdminHistory = async function () {
    let searchTerm = document.getElementById('adminHistorySearchInput').value.toLowerCase();
    let filtered = mainInventory.filter(item => item.name.toLowerCase().includes(searchTerm));
    let items = filtered.map(item => ({
        name: item.name, date: item.date || '-', stock: item.quantity,
        sellingPrice: item.sellingPrice, purchasePrice: item.purchasePrice,
        totalSellingPrice: (item.sellingPrice || 0) * (item.quantity || 0), status: 'UNPAID'
    }));
    document.getElementById('adminHistoryTableBody').innerHTML = renderAdminHistoryRows(items);
    document.getElementById('adminHistorySearchResults').innerHTML = `Showing ${items.length} of ${mainInventory.length} items`;
};

window.filterAdminExpenses = function() {
    let filter = document.getElementById('adminExpTimeFilter')?.value || 'all';
    let customRange = document.getElementById('adminExpCustomRange');
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
        let s = document.getElementById('adminExpStart')?.value;
        let e = document.getElementById('adminExpEnd')?.value;
        if (!s || !e) return;
        startDate = new Date(s); endDate = new Date(e);
        endDate.setHours(23, 59, 59, 999);
    }

    let filtered = expenses.filter(exp => {
        let d = new Date(exp.date);
        return d >= startDate && d <= endDate;
    });

    let tbody = document.querySelector('.expense-table tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#64748b;">No expenses found for selected period</td></tr>`;
    } else {
        tbody.innerHTML = filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
            <tr>
                <td>${exp.date}</td>
                <td><span class="badge badge-blocked">${exp.category}</span></td>
                <td>${exp.description}</td>
                <td style="color:#dc2626;font-weight:600;">${formatMoney(exp.amount)}</td>
                <td>
                    <button class="btn btn-edit" onclick="editExpense(${exp.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete" onclick="deleteExpense(${exp.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    }
};