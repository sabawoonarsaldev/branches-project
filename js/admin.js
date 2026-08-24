// ==================== admin.js ====================
// inventory، finance، expenses، reports، totalAmount
// ==================== ADMIN INVENTORY ====================

function calculateItemSaleValue(item) {
    let currentPrice = parseFloat(item.sellingPrice) || 0;
    let qty = parseInt(item.quantity) || 0;
    let discount = getItemDiscount(item.name);
    let originalPrice = discount ? parseFloat(discount.originalPrice) : currentPrice;
    let soldQty = salesHistory.filter(s => s.item === item.name).reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);
    let distributedQty = mainClientDistributed[item.name] || 0;
    let inBranchUnsold = Math.max(0, distributedQty - soldQty);
    let inMainClient = Math.max(0, qty - distributedQty);
    return (Math.min(soldQty, qty) * originalPrice) + (inBranchUnsold * currentPrice) + (inMainClient * currentPrice);
}

function renderInventory() {
    let afgItems = mainInventory.filter(i => (i.currency || 'AFG') !== 'USD');
    let usdItems = mainInventory.filter(i => i.currency === 'USD');

    let afgTotalPurchase = afgItems.reduce((sum, item) => sum + ((parseFloat(item.purchasePrice) || 0) * (parseInt(item.quantity) || 0)), 0);
    let afgTotalSale = afgItems.reduce((sum, item) => sum + calculateItemSaleValue(item), 0);
    let usdTotalPurchase = usdItems.reduce((sum, item) => sum + ((parseFloat(item.purchasePrice) || 0) * (parseInt(item.quantity) || 0)), 0);
    let usdTotalSale = usdItems.reduce((sum, item) => sum + calculateItemSaleValue(item), 0);

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Inventory Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <i class="fas fa-shopping-cart"></i>
                <h4>Total Inventory Value (Purchase) - AFG</h4>
                <div class="stat-value total-value">${formatMoney(afgTotalPurchase)}</div>
            </div>
            <div class="stat-card">
                <i class="fas fa-tags"></i>
                <h4>Total Inventory Value (Sale) - AFG</h4>
                <div class="stat-value total-value">${formatMoney(afgTotalSale)}</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
                <i class="fas fa-shopping-cart" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Total Inventory Value (Purchase) - USD</h4>
                <div class="stat-value" style="color:white;">${formatByCurrency(usdTotalPurchase, 'USD')}</div>
            </div>
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
                <i class="fas fa-tags" style="color:white;"></i>
                <h4 style="color:rgba(255,255,255,0.8);">Total Inventory Value (Sale) - USD</h4>
                <div class="stat-value" style="color:white;">${formatByCurrency(usdTotalSale, 'USD')}</div>
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

    html += `<h3 style="margin:20px 0 10px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG) Items</h3>`;
    if (afgItems.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No AFG Items Yet</h3></div>`;
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
                    <tbody id="inventoryTableBodyAFG">${renderInventoryRows(afgItems)}</tbody>
                    <tfoot>
                        <tr class="grand-total">
                           <td colspan="7"><strong>Grand Total (AFG)</strong></td><td></td>
                            <td><strong>${formatMoney(afgTotalPurchase)}</strong></td>
                            <td><strong>${formatMoney(afgTotalSale)}</strong></td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    if (usdItems.length > 0) {
        html += `<h3 style="margin:30px 0 10px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD) Items</h3>`;
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
                    <tbody id="inventoryTableBodyUSD">${renderInventoryRows(usdItems)}</tbody>
                    <tfoot>
                        <tr class="grand-total">
                           <td colspan="7"><strong>Grand Total (USD)</strong></td><td></td>
                            <td><strong>${formatByCurrency(usdTotalPurchase, 'USD')}</strong></td>
                            <td><strong>${formatByCurrency(usdTotalSale, 'USD')}</strong></td>
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
    items = [...items].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return items.map((item, index) => {
        const itemCurrency = item.currency || 'AFG';
        const purchasePrice = parseFloat(item.purchasePrice) || parseFloat(item.purchase_price) || 0;
        const currentSellingPrice = parseFloat(item.sellingPrice) || parseFloat(item.selling_price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        let discount = getItemDiscount(item.name);
        let discountHtml = discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : '-';
        let remainderInMainClients = calculateRemainingStockInMainClients(item.name);
        let originalPrice = discount ? parseFloat(discount.originalPrice) : currentSellingPrice;

        let soldQty = salesHistory
            .filter(s => s.item === item.name)
            .reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);

        let distributedQty = mainClientDistributed[item.name] || 0;
        let inBranchUnsold = Math.max(0, distributedQty - soldQty);
        let inMainClient = Math.max(0, quantity - distributedQty);

        let correctTotalSaleValue = (Math.min(soldQty, quantity) * originalPrice) +
                                    (inBranchUnsold * currentSellingPrice) +
                                    (inMainClient * currentSellingPrice);
        return `
            <tr>
                <td>${item.id}</td><td>${item.date || '-'}</td>
                <td>${escapeHtml(item.name)}</td>
                <td>${formatByCurrency(purchasePrice, itemCurrency)}</td>
                <td>${renderPriceWithDiscount(discount ? discount.originalPrice : currentSellingPrice, currentSellingPrice, item.name, itemCurrency)}</td>
                <td>${discountHtml}</td><td>${quantity}</td>
                <td class="remainder-stock" style="background:#fef3c7;font-weight:bold;">${remainderInMainClients}</td>
                <td class="total-value">${formatByCurrency(purchasePrice * quantity, itemCurrency)}</td>
                <td class="total-value">${formatByCurrency(correctTotalSaleValue, itemCurrency)}</td>
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
    let filteredAfg = filtered.filter(i => (i.currency || 'AFG') !== 'USD');
    let filteredUsd = filtered.filter(i => i.currency === 'USD');
    let afgTbody = document.getElementById('inventoryTableBodyAFG');
    if (afgTbody) afgTbody.innerHTML = renderInventoryRows(filteredAfg);
    let usdTbody = document.getElementById('inventoryTableBodyUSD');
    if (usdTbody) usdTbody.innerHTML = renderInventoryRows(filteredUsd);
    let resultsEl = document.getElementById('searchResults');
    if (resultsEl) resultsEl.innerHTML = `Showing ${filtered.length} of ${mainInventory.length} items`;
};

window.showAddItemModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Item</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Item Name</label><input type="text" id="itemName" placeholder="Enter item name"></div>
        <div class="form-group">
            <label>Currency</label>
            <div style="display:flex;gap:20px;margin-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="itemCurrency" value="AFG" checked onchange="updateItemCurrencyLabels()" style="width:auto;"> Afghani (AFG)
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="itemCurrency" value="USD" onchange="updateItemCurrencyLabels()" style="width:auto;"> US Dollar (USD)
                </label>
            </div>
        </div>
        <div class="form-group"><label id="purchasePriceLabel">Purchase Price (AFG)</label><input type="number" id="purchasePrice" step="0.01" value="0"></div>
        <div class="form-group"><label id="sellingPriceLabel">Selling Price (AFG)</label><input type="number" id="sellingPrice" step="0.01" value="0"></div>
        <div class="form-group"><label>Quantity</label><input type="number" id="quantity" value="0"></div>
        <div class="form-group"><label>Supplier</label><input type="text" id="supplier" placeholder="Supplier name"></div>
        <div class="form-group"><label>Date Received</label><input type="date" id="itemDate" value="${getTodayDate()}"></div>
        <button class="save-btn" onclick="saveNewItem()">Save Item</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateItemCurrencyLabels = function() {
    let currency = document.querySelector('input[name="itemCurrency"]:checked')?.value || 'AFG';
    let pLabel = document.getElementById('purchasePriceLabel');
    let sLabel = document.getElementById('sellingPriceLabel');
    if (pLabel) pLabel.textContent = `Purchase Price (${currency})`;
    if (sLabel) sLabel.textContent = `Selling Price (${currency})`;
};

window.saveNewItem = async function () {
    let name = document.getElementById('itemName').value.trim();
    let currency = document.querySelector('input[name="itemCurrency"]:checked')?.value || 'AFG';
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
            body: JSON.stringify({ name, purchase_price: purchasePrice, selling_price: sellingPrice, quantity, supplier, date: itemDate, currency })
        });
        if (response.ok) {
            const newItem = await response.json();
            mainInventory.push({ id: newItem.id, name, purchasePrice, sellingPrice, quantity, supplier, date: itemDate, currency });
            mainClientItems.push({ id: newItem.id, name, sellingPrice, purchasePrice, quantity, date: itemDate, supplier, currency });
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
    let itemCurrency = item.currency || 'AFG';
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Item</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Item Name</label><input type="text" id="itemName" value="${escapeHtml(item.name)}"></div>
        <div class="form-group">
            <label>Currency</label>
            <div style="display:flex;gap:20px;margin-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="itemCurrency" value="AFG" ${itemCurrency === 'AFG' ? 'checked' : ''} onchange="updateItemCurrencyLabels()" style="width:auto;"> Afghani (AFG)
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="itemCurrency" value="USD" ${itemCurrency === 'USD' ? 'checked' : ''} onchange="updateItemCurrencyLabels()" style="width:auto;"> US Dollar (USD)
                </label>
            </div>
        </div>
        <div class="form-group"><label id="purchasePriceLabel">Purchase Price (${itemCurrency})</label><input type="number" id="purchasePrice" step="0.01" value="${item.purchasePrice}"></div>
        <div class="form-group"><label id="sellingPriceLabel">Selling Price (${itemCurrency})</label><input type="number" id="sellingPrice" step="0.01" value="${item.sellingPrice}"></div>
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
    let newCurrency = document.querySelector('input[name="itemCurrency"]:checked')?.value || 'AFG';
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
                body: JSON.stringify({ name: newName, purchase_price: newPurchasePrice, selling_price: newSellingPrice, quantity: newQuantity, supplier: newSupplier, date: newDate, currency: newCurrency })
            });
            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            item.name = newName; item.purchasePrice = newPurchasePrice; item.sellingPrice = newSellingPrice;
            item.quantity = newQuantity; item.supplier = newSupplier; item.date = newDate; item.currency = newCurrency;
            for (let mainItem of mainClientItems) {
                if (mainItem.id === id) { mainItem.name = newName; mainItem.purchasePrice = newPurchasePrice; mainItem.sellingPrice = newSellingPrice; mainItem.quantity = newQuantity; mainItem.supplier = newSupplier; mainItem.date = newDate; mainItem.currency = newCurrency; }
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
                delete itemDiscounts[item.name];
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
        const allSalesRes = await fetch('/api/sales/all');
        if (allSalesRes.ok) {
            const allSalesData = await allSalesRes.json();
            salesHistory = allSalesData.map(s => ({
                id: s.id, date: s.date ? s.date.split('T')[0] : getTodayDate(),
                branch: s.branch, item: s.item, qty: parseInt(s.qty),
                price: parseFloat(s.price), purchasePrice: parseFloat(s.purchase_price),
                revenue: parseFloat(s.revenue), cost: parseFloat(s.cost),
                profit: parseFloat(s.profit), billNumber: s.bill_number
            }));
        }
    } catch (err) { console.log('Error loading all sales:', err); }

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
        <h3 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
        <div class="stats-grid">
            <div class="stat-card"><i class="fas fa-shopping-cart"></i><h4>Total Purchases (Cost)</h4><div class="stat-value total-value">${formatMoney(mainFinance.totalPurchase)}</div><small>Sum of (Purchase Price × Quantity)</small></div>
            <div class="stat-card"><i class="fas fa-tags"></i><h4>Total Sales (Revenue)</h4><div class="stat-value total-value">${formatMoney(mainFinance.totalSale)}</div><small>Sum of (Selling Price × Quantity)</small></div>
            <div class="stat-card profit-card"><i class="fas fa-chart-line"></i><h4>Total Profit</h4><div class="stat-value ${mainFinance.totalProfit >= 0 ? 'profit-text' : 'loss-text'}">${formatMoney(mainFinance.totalProfit)}</div><small>Sales - Purchases - Expenses</small></div>
            <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses</h4><div class="stat-value">${formatMoney(mainFinance.totalExpenses)}</div><small>Admin + Main Client only</small></div>
        </div>

        <h3 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
        <div class="stats-grid">
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-shopping-cart" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Purchases (Cost)</h4><div class="stat-value" style="color:white;">${formatByCurrency(mainFinance.totalPurchaseUSD || 0, 'USD')}</div><small style="color:rgba(255,255,255,0.7);">Sum of (Purchase Price × Quantity)</small></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-tags" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Sales (Revenue)</h4><div class="stat-value" style="color:white;">${formatByCurrency(mainFinance.totalSaleUSD || 0, 'USD')}</div><small style="color:rgba(255,255,255,0.7);">Sum of (Selling Price × Quantity)</small></div>
            <div class="stat-card" style="background:${(mainFinance.totalProfitUSD || 0) >= 0 ? 'linear-gradient(145deg,#22c55e,#16a34a)' : 'linear-gradient(145deg,#ef4444,#b91c1c)'};color:white;"><i class="fas fa-chart-line" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Profit</h4><div class="stat-value" style="color:white;">${formatByCurrency(mainFinance.totalProfitUSD || 0, 'USD')}</div><small style="color:rgba(255,255,255,0.7);">Sales - Purchases - Expenses</small></div>
            <div class="stat-card" style="background:#64748b;color:white;"><i class="fas fa-file-invoice" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Expenses</h4><div class="stat-value" style="color:white;">${formatByCurrency(mainFinance.totalExpensesUSD || 0, 'USD')}</div><small style="color:rgba(255,255,255,0.7);">Coming in next phase</small></div>
        </div>

        <div class="btn-group"><button class="action-btn" onclick="showAddExpenseModal()"><i class="fas fa-plus-circle"></i> Add New Expense</button></div>`;
  

        let branchUsersList = getBranchUsers();
    if (branchUsersList.length > 0) {
        let branchData = branchUsersList.map(user => {
            const branch = user.username;
            let branchSales = salesHistory.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
            let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
            let branchExps = branchExpenses[branch] || [];

            let salesAFG = branchSales.filter(s => s.currency !== 'USD').reduce((sum, s) => sum + (s.revenue || 0), 0);
            let salesUSD = branchSales.filter(s => s.currency === 'USD').reduce((sum, s) => sum + (s.revenue || 0), 0);
            let purchaseAFG = branchShipments.filter(s => s.currency !== 'USD').reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
            let purchaseUSD = branchShipments.filter(s => s.currency === 'USD').reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
            let expAFG = branchExps.filter(e => (e.currency||'AFG') !== 'USD').reduce((sum, exp) => sum + (exp.amount || 0), 0);
            let expUSD = branchExps.filter(e => e.currency === 'USD').reduce((sum, exp) => sum + (exp.amount || 0), 0);

            return {
                username: branch,
                afg: { totalSale: salesAFG, totalPurchase: purchaseAFG, totalExpenses: expAFG, profit: salesAFG - purchaseAFG - expAFG },
                usd: { totalSale: salesUSD, totalPurchase: purchaseUSD, totalExpenses: expUSD, profit: salesUSD - purchaseUSD - expUSD },
                frozen: user.frozen, blocked: user.blocked
            };
        }).sort((a, b) => b.afg.profit - a.afg.profit);

        let grandAfgSale = branchData.reduce((s, b) => s + b.afg.totalSale, 0);
        let grandAfgPurchase = branchData.reduce((s, b) => s + b.afg.totalPurchase, 0);
        let grandAfgExp = branchData.reduce((s, b) => s + b.afg.totalExpenses, 0);
        let grandAfgProfit = branchData.reduce((s, b) => s + b.afg.profit, 0);
        let grandUsdSale = branchData.reduce((s, b) => s + b.usd.totalSale, 0);
        let grandUsdPurchase = branchData.reduce((s, b) => s + b.usd.totalPurchase, 0);
        let grandUsdExp = branchData.reduce((s, b) => s + b.usd.totalExpenses, 0);
        let grandUsdProfit = branchData.reduce((s, b) => s + b.usd.profit, 0);

        html += `<h3 style="margin:30px 0 20px;">Branch Performance Summary</h3>
        <div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Branch</th><th>Currency</th><th>Sales</th><th>Purchases</th><th>Expenses</th><th>Profit/Loss</th><th>Status</th></tr></thead>
            <tbody>${branchData.map(b => {
                let statusClass = b.blocked ? 'badge-blocked' : (b.frozen ? 'badge-frozen' : 'badge-active');
                let statusText = b.blocked ? 'Blocked' : (b.frozen ? 'Frozen' : 'Active');
                return `
                <tr>
                    <td rowspan="2"><span class="badge ${statusClass}">${b.username}</span></td>
                    <td><span class="badge badge-active">AFG</span></td>
                    <td>${formatMoney(b.afg.totalSale)}</td><td>${formatMoney(b.afg.totalPurchase)}</td>
                    <td>${formatMoney(b.afg.totalExpenses)}</td>
                    <td class="${b.afg.profit >= 0 ? 'profit-text' : 'loss-text'}"><strong>${formatMoney(b.afg.profit)}</strong></td>
                    <td rowspan="2"><span class="badge ${statusClass}">${statusText}</span></td>
                </tr>
                <tr style="background:#f8fafc;">
                    <td><span class="badge badge-mainclient">USD</span></td>
                    <td>${formatByCurrency(b.usd.totalSale,'USD')}</td><td>${formatByCurrency(b.usd.totalPurchase,'USD')}</td>
                    <td>${formatByCurrency(b.usd.totalExpenses,'USD')}</td>
                    <td class="${b.usd.profit >= 0 ? 'profit-text' : 'loss-text'}"><strong>${formatByCurrency(b.usd.profit,'USD')}</strong></td>
                </tr>`;
            }).join('')}</tbody>
            <tfoot>
                <tr class="grand-total">
                    <td rowspan="2"><strong>Grand Total</strong></td>
                    <td><strong>AFG</strong></td>
                    <td><strong>${formatMoney(grandAfgSale)}</strong></td>
                    <td><strong>${formatMoney(grandAfgPurchase)}</strong></td>
                    <td><strong>${formatMoney(grandAfgExp)}</strong></td>
                    <td><strong>${formatMoney(grandAfgProfit)}</strong></td>
                    <td rowspan="2"></td>
                </tr>
                <tr class="grand-total" style="background:#eff6ff;">
                    <td><strong>USD</strong></td>
                    <td><strong>${formatByCurrency(grandUsdSale,'USD')}</strong></td>
                    <td><strong>${formatByCurrency(grandUsdPurchase,'USD')}</strong></td>
                    <td><strong>${formatByCurrency(grandUsdExp,'USD')}</strong></td>
                    <td><strong>${formatByCurrency(grandUsdProfit,'USD')}</strong></td>
                </tr>
            </tfoot>
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
                user_role: e.user_role, username: e.username, currency: e.currency || 'AFG'
            }));
        }
    } catch (err) { console.log('Error loading expenses:', err); }
    recalcMainFinance();

    let afgExpenses = expenses.filter(e => (e.currency || 'AFG') !== 'USD');
    let usdExpenses = expenses.filter(e => e.currency === 'USD');

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

        <h3 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
        <div class="stats-grid">
            <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses (Admin Only)</h4><div class="stat-value">${formatMoney(mainFinance.totalExpenses)}</div></div>
            <div class="stat-card"><i class="fas fa-calendar-alt"></i><h4>This Month</h4><div class="stat-value">${formatMoney(calculateMonthlyExpenses('AFG'))}</div></div>
            <div class="stat-card"><i class="fas fa-chart-pie"></i><h4>Avg. Daily</h4><div class="stat-value">${formatMoney(calculateDailyAverage('AFG'))}</div></div>
        </div>

        <h3 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
        <div class="stats-grid">
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-file-invoice" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Expenses</h4><div class="stat-value" style="color:white;">${formatByCurrency(mainFinance.totalExpensesUSD || 0, 'USD')}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-calendar-alt" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">This Month</h4><div class="stat-value" style="color:white;">${formatByCurrency(calculateMonthlyExpenses('USD'), 'USD')}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-chart-pie" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Avg. Daily</h4><div class="stat-value" style="color:white;">${formatByCurrency(calculateDailyAverage('USD'), 'USD')}</div></div>
        </div>

        <h3 style="margin:30px 0 10px;">Afghani (AFG) Expense History</h3>`;

    if (afgExpenses.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No AFG Expenses Yet</h3><button class="action-btn" onclick="showAddExpenseModal()" style="margin-bottom:0;"><i class="fas fa-plus"></i> Add First Expense</button></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="expense-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody id="expenseTableBodyAFG">${renderExpenseRows(afgExpenses)}</tbody></table></div>`;
    }

    if (usdExpenses.length > 0) {
        html += `<h3 style="margin:30px 0 10px;">US Dollar (USD) Expense History</h3>
        <div class="table-wrapper"><table class="expense-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody id="expenseTableBodyUSD">${renderExpenseRows(usdExpenses)}</tbody></table></div>`;
    }

    document.getElementById('content').innerHTML = html;
}

function renderExpenseRows(list) {
    return [...list].sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
        <tr>
            <td>${exp.date}</td><td><span class="badge badge-blocked">${exp.category}</span></td>
            <td>${exp.description}</td><td style="color:#dc2626;font-weight:600;">${formatByCurrency(exp.amount, exp.currency || 'AFG')}</td>
            <td>
                <button class="btn btn-edit" onclick="editExpense(${exp.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-delete" onclick="deleteExpense(${exp.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

function calculateMonthlyExpenses(currency = 'AFG') {
    let d = new Date();
    return expenses.filter(exp => {
        let e = new Date(exp.date);
        let cur = exp.currency || 'AFG';
        return cur === currency && e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear();
    }).reduce((sum, exp) => sum + exp.amount, 0);
}

function calculateDailyAverage(currency = 'AFG') {
    let filtered = expenses.filter(exp => (exp.currency || 'AFG') === currency);
    if (filtered.length === 0) return 0;
    let total = filtered.reduce((sum, exp) => sum + exp.amount, 0);
    let dates = filtered.map(exp => new Date(exp.date).getTime());
    let daysDiff = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) || 1;
    return total / daysDiff;
}

window.showAddExpenseModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="expCategory"><option value="Rent">Rent</option><option value="Salary">Salary</option><option value="Utilities">Utilities</option><option value="Marketing">Marketing</option><option value="Transport">Transport</option><option value="Other">Other</option></select>
        </div>
        <div class="form-group">
            <label>Currency</label>
            <div style="display:flex;gap:20px;margin-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="expCurrency" value="AFG" checked onchange="updateExpenseCurrencyLabel()" style="width:auto;"> Afghani (AFG)
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="expCurrency" value="USD" onchange="updateExpenseCurrencyLabel()" style="width:auto;"> US Dollar (USD)
                </label>
            </div>
        </div>
        <div class="form-group"><label id="expAmountLabel">Amount (AFG)</label><input type="number" id="expAmount" step="0.01" value="0"></div>
        <div class="form-group"><label>Description</label><textarea id="expDescription" rows="3" placeholder="Enter expense description"></textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="expDate" value="${getTodayDate()}"></div>
        <button class="save-btn" onclick="saveNewExpense()">Add Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateExpenseCurrencyLabel = function() {
    let currency = document.querySelector('input[name="expCurrency"]:checked')?.value || 'AFG';
    let label = document.getElementById('expAmountLabel');
    if (label) label.textContent = `Amount (${currency})`;
};

window.saveNewExpense = async function () {
    let currency = document.querySelector('input[name="expCurrency"]:checked')?.value || 'AFG';
    let newExpense = { date: document.getElementById('expDate').value, category: document.getElementById('expCategory').value, amount: parseFloat(document.getElementById('expAmount').value), description: document.getElementById('expDescription').value, user_role: 'admin', username: currentUser ? currentUser.username : 'admin', currency };
    if (isNaN(newExpense.amount) || newExpense.amount <= 0) { alert('Please enter a valid amount'); return; }
    const btn = document.querySelector('#modalContent .save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
    try {
        const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newExpense) });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed');
        const savedExpense = await response.json();
        expenses.push({ id: savedExpense.id, date: newExpense.date, category: newExpense.category, amount: newExpense.amount, description: newExpense.description, user_role: 'admin', username: 'admin', currency });
        recalcMainFinance(); closeModal(); renderExpenses(); alert('Expense added successfully!');
    } catch (error) {
        if (btn) { btn.disabled = false; btn.textContent = 'Add Expense'; }
        alert('Failed to add expense. Make sure server is running.');
    }
};

window.editExpense = function (id) {
    let exp = expenses.find(e => e.id === id);
    if (!exp) return;
    let expCurrency = exp.currency || 'AFG';
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="expCategory"><option value="Rent" ${exp.category === 'Rent' ? 'selected' : ''}>Rent</option><option value="Salary" ${exp.category === 'Salary' ? 'selected' : ''}>Salary</option><option value="Utilities" ${exp.category === 'Utilities' ? 'selected' : ''}>Utilities</option><option value="Marketing" ${exp.category === 'Marketing' ? 'selected' : ''}>Marketing</option><option value="Transport" ${exp.category === 'Transport' ? 'selected' : ''}>Transport</option><option value="Other" ${exp.category === 'Other' ? 'selected' : ''}>Other</option></select>
        </div>
        <div class="form-group">
            <label>Currency</label>
            <div style="display:flex;gap:20px;margin-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="expCurrency" value="AFG" ${expCurrency === 'AFG' ? 'checked' : ''} onchange="updateExpenseCurrencyLabel()" style="width:auto;"> Afghani (AFG)
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="expCurrency" value="USD" ${expCurrency === 'USD' ? 'checked' : ''} onchange="updateExpenseCurrencyLabel()" style="width:auto;"> US Dollar (USD)
                </label>
            </div>
        </div>
        <div class="form-group"><label id="expAmountLabel">Amount (${expCurrency})</label><input type="number" id="expAmount" step="0.01" value="${exp.amount}"></div>
        <div class="form-group"><label>Description</label><textarea id="expDescription" rows="3">${exp.description}</textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="expDate" value="${exp.date}"></div>
        <button class="save-btn" onclick="updateExpense(${id})">Update Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateExpense = async function (id) {
    let exp = expenses.find(e => e.id === id);
    if (!exp) return;
    let currency = document.querySelector('input[name="expCurrency"]:checked')?.value || 'AFG';
    let updated = { date: document.getElementById('expDate').value, category: document.getElementById('expCategory').value, amount: parseFloat(document.getElementById('expAmount').value), description: document.getElementById('expDescription').value, user_role: 'admin', username: currentUser ? currentUser.username : 'admin', currency };
    try {
        const response = await fetch(`/api/expenses/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!response.ok) throw new Error('Failed to update');
        Object.assign(exp, { date: updated.date, category: updated.category, amount: updated.amount, description: updated.description, currency });
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

function buildShipmentStatsCardInner(purchaseValue, saleValue, shipmentsList, currency) {
    let fmt = (v) => formatByCurrency(v, currency);
    let isUSD = currency === 'USD';
    let totalShipmentValue = shipmentsList.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
    let totalPaid = shipmentsList.reduce((sum, s) => {
        let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : 0;
        return sum + Math.min(paid, getShipmentCorrectTotal(s));
    }, 0);
    let totalUnpaid = Math.max(0, totalShipmentValue - totalPaid);
    let hStyle = isUSD ? 'style="color:white;"' : '';
    let subStyle = isUSD ? 'style="color:rgba(255,255,255,0.8);"' : '';

    return `
        <h3 ${hStyle}><i class="fas fa-truck"></i> Shipment & Value Overview</h3>
        <div class="report-number" ${hStyle}>${fmt(totalShipmentValue)}</div>
        <div class="report-label" ${subStyle}>Total Shipment Value (${currency})</div>
        <div style="margin-top:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;" ${subStyle}><span>Total Purchase Value:</span><span><strong>${fmt(purchaseValue)}</strong></span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;" ${subStyle}><span>Total Sale Value:</span><span><strong>${fmt(saleValue)}</strong></span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;" ${subStyle}><span>Total Paid (by Branches):</span><span class="profit-text"><strong>${fmt(totalPaid)}</strong></span></div>
            <div style="display:flex;justify-content:space-between;" ${subStyle}><span>Total Unpaid (by Branches):</span><span class="loss-text"><strong>${fmt(totalUnpaid)}</strong></span></div>
        </div>`;
}

function buildDistributedCardInner(value, currency) {
    let isUSD = currency === 'USD';
    let hStyle = isUSD ? 'style="color:white;"' : '';
    let subStyle = isUSD ? 'style="color:rgba(255,255,255,0.8);"' : '';
    return `
        <h3 ${hStyle}><i class="fas fa-share-alt"></i> Distributed</h3>
        <div class="report-number" ${hStyle}>${formatByCurrency(value, currency)}</div>
        <div class="report-label" ${subStyle}>Sent to Branches</div>`;
}

function buildExpensesReportCardInner(adminExp, mainClientExp, branchExp, currency) {
    let fmt = (v) => formatByCurrency(v, currency);
    let isUSD = currency === 'USD';
    let hStyle = isUSD ? 'style="color:white;"' : '';
    let subStyle = isUSD ? 'style="color:rgba(255,255,255,0.8);"' : '';
    let rowBg = isUSD ? 'background:rgba(255,255,255,0.15);' : 'background:#f0fdf4;';

    return `
        <h3 ${hStyle}><i class="fas fa-file-invoice"></i> Expenses Summary (${currency})</h3>
        <div class="report-number" ${hStyle}>${fmt(adminExp + mainClientExp)}</div>
        <div class="report-label" ${subStyle}>Total Expenses (Admin + Main Client)</div>
        <div style="margin-top:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding:10px;${rowBg}border-radius:8px;" ${subStyle}>
                <span><i class="fas fa-user-shield" style="margin-right:6px;"></i>Admin Expenses:</span>
                <span><strong>${fmt(adminExp)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:12px;padding:10px;${rowBg}border-radius:8px;" ${subStyle}>
                <span><i class="fas fa-user-tie" style="margin-right:6px;"></i>Main Client Expenses:</span>
                <span><strong>${fmt(mainClientExp)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px;${rowBg}border-radius:8px;" ${subStyle}>
                <span><i class="fas fa-code-branch" style="margin-right:6px;"></i>Branches Expenses (Info Only):</span>
                <span><strong>${fmt(branchExp)}</strong></span>
            </div>
        </div>`;
}

function updateUsdExpensesReportCard(filter, startDate, endDate) {
    let card = document.getElementById('usdExpensesReportCard');
    if (!card) return;

    let adminExpUSD, mcExpUSD, brExpUSD;

    if (filter === 'all') {
        adminExpUSD = expenses.filter(e => e.currency === 'USD').reduce((s,e)=>s+e.amount,0);
        mcExpUSD = Object.values(mainClientExpenses).reduce((sum,arr)=>sum+arr.filter(e=>e.currency==='USD').reduce((s,e)=>s+e.amount,0),0);
        brExpUSD = Object.values(branchExpenses).reduce((sum, arr) => sum + arr.filter(e=>e.currency==='USD').reduce((s, exp) => s + exp.amount, 0), 0);
    } else {
        adminExpUSD = expenses.filter(e => {
            if (e.currency !== 'USD') return false;
            let d = new Date(e.date);
            return d >= startDate && d <= endDate;
        }).reduce((s,e)=>s+e.amount,0);
        mcExpUSD = Object.values(mainClientExpenses).reduce((sum,arr)=>sum+arr.filter(e=>{
            if (e.currency !== 'USD') return false;
            let d = new Date(e.date);
            return d >= startDate && d <= endDate;
        }).reduce((s,e)=>s+e.amount,0),0);
        brExpUSD = Object.values(branchExpenses).reduce((sum, arr) => sum + arr.filter(e=>{
            if (e.currency !== 'USD') return false;
            let d = new Date(e.date);
            return d >= startDate && d <= endDate;
        }).reduce((s, exp) => s + exp.amount, 0), 0);
    }

    card.innerHTML = buildExpensesReportCardInner(adminExpUSD, mcExpUSD, brExpUSD, 'USD');
}

function updateUsdShipmentReportCard(usdShipments, filter, startDate, endDate) {
    let card = document.getElementById('usdShipmentReportCard');
    if (!card) return;

    let usdItems = mainInventory.filter(i => i.currency === 'USD');
    let filteredUsdItems = filter === 'all' ? usdItems : usdItems.filter(item => {
        if (!item.date) return false;
        let d = new Date(item.date);
        let start = new Date(startDate); start.setHours(0,0,0,0);
        let end = new Date(endDate); end.setHours(23,59,59,999);
        return d >= start && d <= end;
    });

    let purchaseUSD = filteredUsdItems.reduce((sum, item) => sum + ((parseFloat(item.purchasePrice)||0) * (parseInt(item.quantity)||0)), 0);
    let saleUSD = filteredUsdItems.reduce((sum, item) => sum + calculateItemSaleValue(item), 0);

    card.innerHTML = buildShipmentStatsCardInner(purchaseUSD, saleUSD, usdShipments, 'USD');
}

// ==================== ADMIN REPORTS ====================

async function renderAdminReports() {
    try {
        const res = await fetch('/api/expenses/all');
        if (res.ok) {
            const allExp = await res.json();
            expenses = allExp.filter(e => e.user_role === 'admin').map(e => ({
                id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(),
                category: e.category, amount: parseFloat(e.amount), description: e.description,
                currency: e.currency || 'AFG'
            }));
            for (const exp of allExp) {
                if (exp.user_role === 'mainclient') {
                    const mc = exp.username;
                    if (!mainClientExpenses[mc]) mainClientExpenses[mc] = [];
                    if (!mainClientExpenses[mc].find(e => e.id === exp.id))
                        mainClientExpenses[mc].push({ id: exp.id, date: exp.date ? exp.date.split('T')[0] : getTodayDate(), category: exp.category, amount: parseFloat(exp.amount), description: exp.description });
                }
                if (exp.user_role === 'branch') {
                    const br = exp.username;
                    if (!branchExpenses[br]) branchExpenses[br] = [];
                    if (!branchExpenses[br].find(e => e.id === exp.id))
                        branchExpenses[br].push({ id: exp.id, date: exp.date ? exp.date.split('T')[0] : getTodayDate(), category: exp.category, amount: parseFloat(exp.amount), description: exp.description });
                }
            }
        }
    } catch (err) { console.log('Error loading expenses:', err); }


    recalcMainFinance();
    let totalPurchaseValue = mainFinance.totalPurchase;
    let totalSaleValue = mainFinance.totalSale;

    let adminExpAFG = expenses.filter(e => (e.currency || 'AFG') !== 'USD').reduce((s,e)=>s+e.amount,0);
    let adminExpUSD = expenses.filter(e => e.currency === 'USD').reduce((s,e)=>s+e.amount,0);
    let mainClientExpSum = Object.values(mainClientExpenses).reduce((sum,arr)=>sum+arr.filter(e=>(e.currency||'AFG')!=='USD').reduce((s,e)=>s+e.amount,0),0);
    let mainClientExpSumUSD = Object.values(mainClientExpenses).reduce((sum,arr)=>sum+arr.filter(e=>e.currency==='USD').reduce((s,e)=>s+e.amount,0),0);
    let branchExpSum = Object.values(branchExpenses).reduce((sum, arr) => sum + arr.filter(e=>(e.currency||'AFG')!=='USD').reduce((s, exp) => s + exp.amount, 0), 0);
    let branchExpSumUSD = Object.values(branchExpenses).reduce((sum, arr) => sum + arr.filter(e=>e.currency==='USD').reduce((s, exp) => s + exp.amount, 0), 0);
    let totalPurchaseUSD = calculateTotalPurchaseValueUSD();
    let totalSaleUSD = calculateTotalSaleValueUSD();
    let totalDistributedUSD = calculateTotalDistributedValueUSD();
    let usdProfit = totalSaleUSD - totalPurchaseUSD - adminExpUSD;

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Complete Reports</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div style="background:#f0fdf4;border-radius:16px;padding:16px;margin-bottom:20px;border:2px solid #bbf7d0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <label style="color:#166534;font-weight:600;"><i class="fas fa-calendar" style="margin-right:6px;"></i>Time Period:</label>
            <select id="adminReportTimeFilter" onchange="applyAdminReportTimeFilter()" style="padding:10px 16px;border:2px solid #bbf7d0;border-radius:12px;background:white;color:#166534;font-weight:600;">
                <option value="all">All Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Range</option>
            </select>
            <div id="adminReportCustomRange" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;">
                <input type="date" id="adminReportStart" value="${getWeekAgoDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                <span style="color:#166534;">to</span>
                <input type="date" id="adminReportEnd" value="${getTodayDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                <button onclick="applyAdminReportTimeFilter()" class="btn-filter" style="width:auto;margin-top:0;padding:10px 16px;">Apply</button>
            </div>
        </div>

        <h3 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
        <div class="report-grid" id="adminReportSummaryGrid">
            <div class="report-card">
                <h3><i class="fas fa-store"></i> Admin Summary</h3>
                <div class="report-number">${formatMoney(mainFinance.totalSale)}</div>
                <div class="report-label">Total Sales Value</div>
                <div style="margin-top:20px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Purchases Cost:</span><span><strong>${formatMoney(mainFinance.totalPurchase)}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span>Total Expenses:</span>
                <span><strong>${formatMoney(adminExpAFG + mainClientExpSum)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;border-top:2px solid #e2e8f0;padding-top:8px;">
                <span>Total Profit:</span>
                <span class="${(mainFinance.totalSale - mainFinance.totalPurchase - adminExpAFG - mainClientExpSum) >= 0 ? 'profit-text' : 'loss-text'}">
                    <strong>${formatMoney(mainFinance.totalSale - mainFinance.totalPurchase - adminExpAFG - mainClientExpSum)}</strong>
                </span>
            </div>
                </div>
            </div>
                <div class="report-card" id="afgShipmentReportCard">
                ${buildShipmentStatsCardInner(totalPurchaseValue, totalSaleValue, mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)!=='USD'), 'AFG')}
            </div>
            <div class="report-card" id="afgDistributedReportCard">
                ${buildDistributedCardInner(mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)!=='USD').reduce((sum,s)=>sum+getShipmentCorrectTotal(s),0), 'AFG')}
            </div>
            <div class="report-card">
                <h3><i class="fas fa-percent"></i> Discounts</h3>
                <div class="report-number">${Object.keys(itemDiscounts).length}</div>
                <div class="report-label">Active Discounts</div>
            </div>
            <div class="report-card" id="afgExpensesReportCard">
                ${buildExpensesReportCardInner(adminExpAFG, mainClientExpSum, branchExpSum, 'AFG')}
            </div>
        </div>

        <h3 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
        <div class="report-grid" id="usdReportGrid">
            ${renderUsdReportCardsHtml(totalPurchaseUSD, totalSaleUSD, totalDistributedUSD, adminExpUSD, usdProfit)}
            <div class="report-card" id="usdShipmentReportCard" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
                ${buildShipmentStatsCardInner(totalPurchaseUSD, totalSaleUSD, mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)==='USD'), 'USD')}
            </div>
            <div class="report-card" id="usdExpensesReportCard" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
                ${buildExpensesReportCardInner(adminExpUSD, mainClientExpSumUSD, branchExpSumUSD, 'USD')}
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

function renderUsdReportCardsHtml(purchase, sale, distributed, exp, profit) {
    return `
        <div class="report-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
            <h3 style="color:white;"><i class="fas fa-shopping-cart"></i> Purchased</h3>
            <div class="report-number" style="color:white;">${formatByCurrency(purchase, 'USD')}</div>
            <div class="report-label" style="color:rgba(255,255,255,0.8);">Total Purchase Value</div>
        </div>
        <div class="report-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
            <h3 style="color:white;"><i class="fas fa-tags"></i> For Sale</h3>
            <div class="report-number" style="color:white;">${formatByCurrency(sale, 'USD')}</div>
            <div class="report-label" style="color:rgba(255,255,255,0.8);">Total Sale Value</div>
        </div>
        <div class="report-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
            <h3 style="color:white;"><i class="fas fa-share-alt"></i> Distributed</h3>
            <div class="report-number" style="color:white;">${formatByCurrency(distributed, 'USD')}</div>
            <div class="report-label" style="color:rgba(255,255,255,0.8);">Sent to Branches</div>
        </div>
        <div class="report-card" style="background:${profit >= 0 ? 'linear-gradient(145deg,#22c55e,#16a34a)' : 'linear-gradient(145deg,#ef4444,#b91c1c)'};color:white;">
            <h3 style="color:white;"><i class="fas fa-wallet"></i> Profit</h3>
            <div class="report-number" style="color:white;">${formatByCurrency(profit, 'USD')}</div>
            <div class="report-label" style="color:rgba(255,255,255,0.8);">Sale - Purchase - Expenses (${formatByCurrency(exp,'USD')})</div>
        </div>`;
}

function calculateTotalPurchaseValueUSD() {
    let total = 0;
    for (let item of mainInventory) {
        if (item.currency === 'USD') {
            total += (parseFloat(item.purchasePrice) || parseFloat(item.purchase_price) || 0) * (parseInt(item.quantity) || 0);
        }
    }
    return total;
}

function calculateTotalSaleValueUSD() {
    let total = 0;
    for (let item of mainInventory) {
        if (item.currency === 'USD') total += calculateItemSaleValue(item);
    }
    return total;
}

function getItemCurrency(itemName) {
    let item = mainInventory.find(i => i.name === itemName);
    return (item && item.currency === 'USD') ? 'USD' : 'AFG';
}

function calculateTotalDistributedValueUSD() {
    let total = 0;
    for (let s of mainClientToBranchShipments) {
        if (getItemCurrency(s.item) === 'USD') total += (s.sellingPrice || 0) * (s.qty || 0);
    }
    return total;
}

function updateUsdReportGrid(startDate, endDate, filter) {
    let usdGrid = document.getElementById('usdReportGrid');
    if (!usdGrid) return;

    let purchase, sale, distributed, exp;

    if (filter === 'all') {
        purchase = calculateTotalPurchaseValueUSD();
        sale = calculateTotalSaleValueUSD();
        distributed = calculateTotalDistributedValueUSD();
        exp = expenses.filter(e => e.currency === 'USD').reduce((s,e)=>s+e.amount,0);
    } else {
        let filteredUsdItems = mainInventory.filter(item => {
            if (!item.date || item.currency !== 'USD') return false;
            let d = new Date(item.date);
            let start = new Date(startDate); start.setHours(0,0,0,0);
            let end = new Date(endDate); end.setHours(23,59,59,999);
            return d >= start && d <= end;
        });
        purchase = filteredUsdItems.reduce((sum, item) => sum + ((parseFloat(item.purchasePrice)||0) * (parseInt(item.quantity)||0)), 0);
        sale = filteredUsdItems.reduce((sum, item) => sum + ((parseFloat(item.sellingPrice)||0) * (parseInt(item.quantity)||0)), 0);

        let filteredUsdShipments = mainClientToBranchShipments.filter(s => {
            if (getItemCurrency(s.item) !== 'USD') return false;
            let d = new Date(s.date);
            return d >= startDate && d <= endDate;
        });
        distributed = filteredUsdShipments.reduce((sum, s) => sum + ((s.sellingPrice||0) * (s.qty||0)), 0);

        exp = expenses.filter(e => {
            if (e.currency !== 'USD') return false;
            let d = new Date(e.date);
            return d >= startDate && d <= endDate;
        }).reduce((s,e)=>s+e.amount,0);
    }

    let profit = sale - purchase - exp;
    usdGrid.innerHTML = renderUsdReportCardsHtml(purchase, sale, distributed, exp, profit) +
        `<div class="report-card" id="usdShipmentReportCard" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"></div>` +
        `<div class="report-card" id="usdExpensesReportCard" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"></div>`;
}

window.applyAdminReportTimeFilter = async function() {
    let filter = document.getElementById('adminReportTimeFilter')?.value || 'all';
    let customRange = document.getElementById('adminReportCustomRange');
    if (customRange) customRange.style.display = filter === 'custom' ? 'flex' : 'none';

    // لود sales اگر خالی است
    if (salesHistory.length === 0) {
        try {
            const res = await fetch('/api/sales/all');
            if (res.ok) {
                salesHistory = (await res.json()).map(s => ({
                    id: s.id, date: s.date ? s.date.split('T')[0] : getTodayDate(),
                    branch: s.branch, item: s.item, qty: parseInt(s.qty),
                    price: parseFloat(s.price), purchasePrice: parseFloat(s.purchase_price),
                    revenue: parseFloat(s.revenue), cost: parseFloat(s.cost),
                    profit: parseFloat(s.profit), billNumber: s.bill_number
                }));
            }
        } catch (err) {}
    }

    // لود expenses اگر خالی است
    if (expenses.length === 0) {
        try {
            const res = await fetch('/api/expenses/all');
            if (res.ok) {
                const allExp = await res.json();
                expenses = allExp.filter(e => e.user_role === 'admin').map(e => ({
                    id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(),
                    category: e.category, amount: parseFloat(e.amount), description: e.description
                }));
                for (const exp of allExp) {
                    if (exp.user_role === 'mainclient') {
                        const mc = exp.username;
                        if (!mainClientExpenses[mc]) mainClientExpenses[mc] = [];
                        if (!mainClientExpenses[mc].find(e => e.id === exp.id))
                            mainClientExpenses[mc].push({ id: exp.id, date: exp.date ? exp.date.split('T')[0] : getTodayDate(), category: exp.category, amount: parseFloat(exp.amount), description: exp.description });
                    }
                    if (exp.user_role === 'branch') {
                        const br = exp.username;
                        if (!branchExpenses[br]) branchExpenses[br] = [];
                        if (!branchExpenses[br].find(e => e.id === exp.id))
                            branchExpenses[br].push({ id: exp.id, date: exp.date ? exp.date.split('T')[0] : getTodayDate(), category: exp.category, amount: parseFloat(exp.amount), description: exp.description });
                    }
                }
            }
        } catch (err) {}
    }

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
        let s = document.getElementById('adminReportStart')?.value;
        let e = document.getElementById('adminReportEnd')?.value;
        if (!s || !e) return;
        startDate = new Date(s); endDate = new Date(e);
        endDate.setHours(23, 59, 59, 999);
    }

    _updateAdminReportByDate(startDate, endDate, filter);

    let select = document.getElementById('reportClientSelect');
    if (select && select.value) {
        let role = select.options[select.selectedIndex]?.dataset.role;
        if (role === 'branch') await showBranchReportInAdmin(select.value);
        else if (role === 'mainclient') await showMainClientReportInAdmin(select.value);
    }
};

function _getAdminReportDates() {
    let filter = document.getElementById('adminReportTimeFilter')?.value || 'all';
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
        let s = document.getElementById('adminReportStart')?.value;
        let e = document.getElementById('adminReportEnd')?.value;
        if (s) startDate = new Date(s);
        if (e) { endDate = new Date(e); endDate.setHours(23, 59, 59, 999); }
    }
    return { startDate, endDate, filter };
}



function _updateAdminReportByDate(startDate, endDate, filter) {
    let grid = document.getElementById('adminReportSummaryGrid');
    if (!grid) return;
    let cards = grid.querySelectorAll('.report-card');
    if (!cards || cards.length < 4) return;
    let adminExp = expenses.filter(e => (e.currency || 'AFG') !== 'USD').reduce((s, e) => s + e.amount, 0);
    let mcExp = Object.values(mainClientExpenses).reduce((sum, arr) => sum + arr.reduce((s, e) => s + e.amount, 0), 0);
    let brExp = Object.values(branchExpenses).reduce((sum, arr) => sum + arr.reduce((s, e) => s + e.amount, 0), 0);
    if (filter === 'all') {
        let totalSaleValue = mainFinance.totalSale;
        let totalPurchaseValue = mainFinance.totalPurchase;
        
        let totalExcludingBranch = adminExp + mcExp;

        cards[0].innerHTML = `
            <h3><i class="fas fa-store"></i> Admin Summary</h3>
            <div class="report-number">${formatMoney(totalSaleValue)}</div>
            <div class="report-label">Total Sales Value (${filter})</div>
            <div style="margin-top:20px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span>Total Purchases Cost:</span>
                    <span><strong>${formatMoney(totalPurchaseValue)}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span>Total Expenses (${filter}):</span>
                    <span><strong>${formatMoney(totalExcludingBranch)}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                    <span>Net Profit:</span>
                    <span class="${(totalSaleValue - totalPurchaseValue - totalExcludingBranch) >= 0 ? 'profit-text' : 'loss-text'}">
                        <strong>${formatMoney(totalSaleValue - totalPurchaseValue - totalExcludingBranch)}</strong>
                    </span>
                </div>
            </div>`;
        
        cards[1].innerHTML = buildShipmentStatsCardInner(totalPurchaseValue, totalSaleValue, mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)!=='USD'), 'AFG');
        updateUsdShipmentReportCard(mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)==='USD'), 'all', startDate, endDate);
        cards[2].innerHTML = `
            <h3><i class="fas fa-percent"></i> Discounts</h3>
            <div class="report-number">${Object.keys(itemDiscounts).length}</div>
            <div class="report-label">Active Discounts</div>`;

        cards[3].innerHTML = buildExpensesReportCardInner(adminExp, mcExp, brExp, 'AFG');
        let afgDistCardAll = document.getElementById('afgDistributedReportCard');
        if (afgDistCardAll) afgDistCardAll.innerHTML = buildDistributedCardInner(mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)!=='USD').reduce((sum,s)=>sum+getShipmentCorrectTotal(s),0), 'AFG');

        updateUsdReportGrid(startDate, endDate, filter);
        updateUsdShipmentReportCard(mainClientToBranchShipments.filter(s=>getItemCurrency(s.item)==='USD'), 'all', startDate, endDate);
        updateUsdExpensesReportCard('all');
        return;
    }

    let filteredItems = mainInventory.filter(item => {
        if (!item.date) return false;
        let d = new Date(item.date);
        let start = new Date(startDate);
        let end = new Date(endDate);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return d >= start && d <= end;
    });
    let filteredAdminExp = expenses.filter(e => { 
            if ((e.currency || 'AFG') === 'USD') return false;
            let d = new Date(e.date); 
            return d >= startDate && d <= endDate; 
        });
    
    let filteredMcExp = Object.values(mainClientExpenses).reduce((sum, arr) => sum + arr.filter(e => {
        let d = new Date(e.date); 
        return d >= startDate && d <= endDate;
    }).reduce((s, e) => s + e.amount, 0), 0);
    
    let filteredBrExp = Object.values(branchExpenses).reduce((sum, arr) => sum + arr.filter(e => {
        let d = new Date(e.date); 
        return d >= startDate && d <= endDate;
    }).reduce((s, e) => s + e.amount, 0), 0);

    let filteredShipments = mainClientToBranchShipments.filter(s => { 
        let d = new Date(s.date); 
        return d >= startDate && d <= endDate; 
    });

    let filteredItemsAFG = filteredItems.filter(i => (i.currency||'AFG') !== 'USD');
    let totalSaleValue = filteredItemsAFG.reduce((sum, item) => {
        let price = parseFloat(item.sellingPrice) || 0;
        let qty = parseInt(item.quantity) || 0;
        return sum + (price * qty);
    }, 0);
    
    let totalPurchaseValue = filteredItemsAFG.reduce((sum, item) => {
        let price = parseFloat(item.purchasePrice) || 0;
        let qty = parseInt(item.quantity) || 0;
        return sum + (price * qty);
    }, 0);
    
    let totalAdminExpense = filteredAdminExp.reduce((sum, e) => sum + (e.amount || 0), 0);
    let totalExcludingBranch = totalAdminExpense + filteredMcExp;

    let filteredPaid = filteredShipments.reduce((sum, s) => {
        let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : 0;
        return sum + Math.min(paid, (s.sellingPrice || 0) * (s.qty || 0));
    }, 0);

    cards[0].innerHTML = `
        <h3><i class="fas fa-store"></i> Admin Summary</h3>
        <div class="report-number">${formatMoney(totalSaleValue)}</div>
        <div class="report-label">Total Sales Value (${filter})</div>
        <div style="margin-top:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span>Total Purchases Cost:</span>
                <span><strong>${formatMoney(totalPurchaseValue)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span>Total Expenses (${filter}):</span>
                <span><strong>${formatMoney(totalExcludingBranch)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;border-top:2px solid #e2e8f0;padding-top:8px;">
                <span>Net Profit:</span>
                <span class="${(totalSaleValue - totalPurchaseValue - totalExcludingBranch) >= 0 ? 'profit-text' : 'loss-text'}">
                    <strong>${formatMoney(totalSaleValue - totalPurchaseValue - totalExcludingBranch)}</strong>
                </span>
            </div>
        </div>`;

    let filteredShipmentsAFG = filteredShipments.filter(s => getItemCurrency(s.item) !== 'USD');
    cards[1].innerHTML = buildShipmentStatsCardInner(totalPurchaseValue, totalSaleValue, filteredShipmentsAFG, 'AFG');
    updateUsdShipmentReportCard(filteredShipments.filter(s => getItemCurrency(s.item) === 'USD'), filter, startDate, endDate);
    cards[2].innerHTML = `
        <h3><i class="fas fa-percent"></i> Discounts</h3>
        <div class="report-number">${Object.keys(itemDiscounts).length}</div>
        <div class="report-label">Active Discounts</div>`;

    cards[3].innerHTML = buildExpensesReportCardInner(totalAdminExpense, filteredMcExp, filteredBrExp, 'AFG');

    let afgDistCard = document.getElementById('afgDistributedReportCard');
    if (afgDistCard) afgDistCard.innerHTML = buildDistributedCardInner(filteredShipmentsAFG.reduce((sum,s)=>sum+getShipmentCorrectTotal(s),0), 'AFG');

    updateUsdReportGrid(startDate, endDate, filter);
    updateUsdShipmentReportCard(filteredShipments.filter(s => getItemCurrency(s.item) === 'USD'), filter, startDate, endDate);
    updateUsdExpensesReportCard(filter, startDate, endDate);
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
    let { startDate, endDate, filter } = _getAdminReportDates();

    await refreshDataFromServer();
    let originalUser = currentUser;
    currentUser = { username: client, role: 'mainclient' };
    let clientItems = await getMainClientItems();
    currentUser = originalUser;

    let filteredItems = filter === 'all' ? clientItems : clientItems.filter(item => {
        let d = new Date(item.date || 0);
        return d >= startDate && d <= endDate;
    });

    let clientExps = mainClientExpenses[client] || [];
    let filteredExps = filter === 'all' ? clientExps : clientExps.filter(e => {
        let d = new Date(e.date);
        return d >= startDate && d <= endDate;
    });

    let clientReturns = branchReturns.filter(r => {
        if (filter === 'all') return true;
        let d = new Date(r.date);
        return d >= startDate && d <= endDate;
    });

    function buildClientReportBlock(currency) {
        let fmt = (v) => formatByCurrency(v, currency);
        let itemsCur = filteredItems.filter(i => (i.currency || 'AFG') === currency);

        let paidItemsCount = 0, unpaidItemsCount = 0;
        for (const item of itemsCur) {
            if (item.paid === true) paidItemsCount++;
            else unpaidItemsCount++;
        }

        let expensesCur = filteredExps.filter(e => (e.currency || 'AFG') === currency);
        let totalExpenses = expensesCur.reduce((sum, exp) => sum + exp.amount, 0);

        let returnsCur = clientReturns.filter(r => {
            let item = mainInventory.find(mi => mi.name === r.itemName);
            return (item ? (item.currency || 'AFG') : 'AFG') === currency;
        });
        let totalReturns = returnsCur.length;
        let pendingReturns = returnsCur.filter(r => r.status === 'pending').length;
        let totalReturnValue = returnsCur.reduce((sum, r) => sum + ((r.quantity || 0) * (r.pricePerUnit || 0)), 0);

        let adminInvCur = mainInventory.filter(i => (i.currency || 'AFG') === currency);
        let adminToClientItems = filter === 'all' ? adminInvCur : adminInvCur.filter(item => {
            let d = new Date(item.date || 0);
            return d >= startDate && d <= endDate;
        });
        let totalAdminToClientValue = adminToClientItems.reduce((sum, item) =>
            sum + calculateItemSaleValue(item), 0);

        let clientShipments = mainClientToBranchShipments.filter(s => {
            if (getItemCurrency(s.item) !== currency) return false;
            if (filter === 'all') return true;
            let d = new Date(s.date);
            return d >= startDate && d <= endDate;
        });
        let totalShipmentValue = clientShipments.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
        let totalShipmentPaid = clientShipments.reduce((sum, s) => {
            let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : 0;
            return sum + Math.min(paid, getShipmentCorrectTotal(s));
        }, 0);
        let totalShipmentUnpaid = Math.max(0, totalShipmentValue - totalShipmentPaid);

        return `
        <div class="report-grid">
            <div class="report-card"><h3><i class="fas fa-user-tie"></i> ${client}</h3>
                <div class="report-number">${itemsCur.length}</div>
                <div class="report-label">Total Items</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Paid Items:</span><span class="profit-text"><strong>${paidItemsCount}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Unpaid Items:</span><span class="loss-text"><strong>${unpaidItemsCount}</strong></span></div>
                </div>
            </div>
            <div class="report-card">
                <h3><i class="fas fa-credit-card"></i> Payment Status</h3>
                <div style="margin-top:10px;">
                    <div style="background:#f0fdf4;padding:12px;border-radius:8px;margin-bottom:12px;border:1px solid #bbf7d0;">
                        <div style="font-weight:600;color:#166534;margin-bottom:10px;">
                            <i class="fas fa-arrow-circle-down"></i> Admin → Main Client
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span>Total Items Value:</span>
                            <span><strong>${fmt(totalAdminToClientValue)}</strong></span>
                        </div>
                    </div>
                    <div style="background:#eff6ff;padding:12px;border-radius:8px;border:1px solid #bfdbfe;">
                        <div style="font-weight:600;color:#1d4ed8;margin-bottom:10px;">
                            <i class="fas fa-arrow-circle-up"></i> Main Client → Branches
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                            <span>Total Shipments:</span>
                            <span><strong>${fmt(totalShipmentValue)}</strong></span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                            <span>Paid by Branches:</span>
                            <span class="profit-text"><strong>${fmt(totalShipmentPaid)}</strong></span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span>Unpaid by Branches:</span>
                            <span class="loss-text"><strong>${fmt(totalShipmentUnpaid)}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="report-card"><h3><i class="fas fa-file-invoice"></i> Expenses</h3>
                <div class="report-number">${fmt(totalExpenses)}</div>
                <div class="report-label">Total Expenses</div>
            </div>
            <div class="report-card"><h3><i class="fas fa-undo-alt"></i> Returns</h3>
                <div class="report-number">${totalReturns}</div>
                <div class="report-label">Total Returns</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Pending:</span><span style="color:#f59e0b;"><strong>${pendingReturns}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Return Value:</span><span><strong>${fmt(totalReturnValue)}</strong></span></div>
                </div>
            </div>
        </div>`;
    }

    document.getElementById('clientReportContainer').style.display = 'block';
    document.getElementById('clientReportContainer').innerHTML = `
        <h3 style="margin-bottom:20px;">Client Report: ${client} (Main Client) ${filter !== 'all' ? `<small style="color:#64748b;font-size:14px;">(${filter})</small>` : ''}</h3>
        <h4 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h4>
        ${buildClientReportBlock('AFG')}
        <h4 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h4>
        ${buildClientReportBlock('USD')}`;
}

async function showBranchReportInAdmin(branch) {
    try {
        const allSalesRes = await fetch('/api/sales/all');
        if (allSalesRes.ok) {
            const allSalesData = await allSalesRes.json();
            salesHistory = allSalesData.map(s => ({
                id: s.id, date: s.date ? s.date.split('T')[0] : getTodayDate(),
                branch: s.branch, item: s.item, qty: parseInt(s.qty),
                price: parseFloat(s.price), purchasePrice: parseFloat(s.purchase_price),
                revenue: parseFloat(s.revenue), cost: parseFloat(s.cost),
                profit: parseFloat(s.profit), billNumber: s.bill_number,
                customer_name: s.customer_name || ''
            }));
        }
    } catch (err) { console.log('Error loading sales:', err); }

    try {
        const returnsRes = await fetch('/api/returns/mainclient/admin');
        if (returnsRes.ok) {
            const returnsData = await returnsRes.json();
            branchReturns = returnsData.map(r => ({
                id: r.id, date: r.date ? r.date.split('T')[0] : getTodayDate(),
                branch: r.branch, itemName: r.item_name,
                quantity: parseInt(r.quantity), pricePerUnit: parseFloat(r.price_per_unit),
                description: r.description, status: r.status
            }));
        }
    } catch (err) { console.log('Error loading returns:', err); }
    let { startDate, endDate, filter } = _getAdminReportDates();

    let branchShipmentsAll = mainClientToBranchShipments.filter(s => {
        if (filter === 'all') return s.branch === branch;
        let d = new Date(s.date);
        return s.branch === branch && d >= startDate && d <= endDate;
    }).map(s => ({ ...s, currency: getItemCurrency(s.item) }));

    let allReturnsRaw = branchReturns.filter(r => {
        if (r.branch !== branch) return false;
        if (filter === 'all') return true;
        let d = new Date(r.date);
        return d >= startDate && d <= endDate;
    }).map(r => {
        let item = mainInventory.find(mi => mi.name === r.itemName);
        return { ...r, currency: item ? (item.currency || 'AFG') : 'AFG' };
    });

    let filteredSalesRaw = salesHistory.filter(s => {
        if (filter === 'all') return s.branch === branch;
        let d = new Date(s.date);
        return s.branch === branch && d >= startDate && d <= endDate;
    }).map(s => ({ ...s, currency: getItemCurrency(s.item) }));

    function buildSummaryCards(currency) {
        let fmt = (v) => formatByCurrency(v, currency);
        let branchShipments = branchShipmentsAll.filter(s => s.currency === currency);
        let totalReceivedValue = branchShipments.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
        let totalPaid = branchShipments.reduce((sum, s) => {
            let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : 0;
            return sum + Math.min(paid, getShipmentCorrectTotal(s));
        }, 0);
        let totalUnpaid = Math.max(0, totalReceivedValue - totalPaid);

        let filteredSales = filteredSalesRaw.filter(s => s.currency === currency);
        let allReturns = allReturnsRaw.filter(r => r.currency === currency);
        let approvedReturns = allReturns.filter(r => r.status === 'approved' || r.status === 'paid');
        let totalReturnItems = allReturns.reduce((sum, r) => sum + (r.quantity || 0), 0);
        let approvedReturnValue = approvedReturns.reduce((sum, r) => sum + ((r.quantity || 0) * (r.pricePerUnit || 0)), 0);

        return `
        <div class="report-grid">
            <div class="report-card"><h3><i class="fas fa-truck"></i> Received</h3><div class="report-number">${branchShipments.reduce((s, sh) => s + sh.qty, 0)}</div><div class="report-label">Items Received</div>
                <div style="margin-top:15px;"><div style="display:flex;justify-content:space-between;"><span>Value:</span><span><strong>${fmt(totalReceivedValue)}</strong></span></div></div>
            </div>
            <div class="report-card"><h3><i class="fas fa-credit-card"></i> Payments</h3><div class="report-number">${fmt(totalPaid)}</div><div class="report-label">Total Paid</div>
                <div style="margin-top:15px;"><div style="display:flex;justify-content:space-between;"><span>Unpaid:</span><span class="loss-text"><strong>${fmt(totalUnpaid)}</strong></span></div></div>
            </div>
            <div class="report-card"><h3><i class="fas fa-shopping-cart"></i> Sales</h3><div class="report-number">${filteredSales.reduce((s, sale) => s + sale.qty, 0)}</div><div class="report-label">Items Sold</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;"><span>Revenue:</span><span><strong>${fmt(filteredSales.reduce((s, sale) => s + sale.revenue, 0))}</strong></span></div>
                </div>
            </div>
            <div class="report-card"><h3><i class="fas fa-undo-alt"></i> Returns</h3><div class="report-number">${totalReturnItems}</div><div class="report-label">Total Items Returned</div>
                <div style="margin-top:15px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Approved Value:</span><span class="profit-text"><strong>${fmt(approvedReturnValue)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Pending:</span><span style="color:#f59e0b;"><strong>${allReturns.filter(r => r.status === 'pending').length}</strong></span></div>
                </div>
            </div>
        </div>`;
    }

    let html = `<h3 style="margin-bottom:20px;">Branch Report: ${branch} ${filter !== 'all' ? `<small style="color:#64748b;font-size:14px;">(${filter})</small>` : ''}</h3>
        <h4 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h4>
        ${buildSummaryCards('AFG')}
        <h4 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h4>
        ${buildSummaryCards('USD')}`;

    // ==== Return Details (یک جدول مشترک با ستون Currency) ====
    html += `<h4 style="margin:30px 0 12px;"><i class="fas fa-undo-alt"></i> Return Details</h4>`;
    if (allReturnsRaw.length === 0) {
        html += `<div class="empty-state" style="padding:20px;"><i class="fas fa-undo-alt"></i><h3>No Returns</h3></div>`;
    } else {
        let approvedAll = allReturnsRaw.filter(r => r.status === 'approved' || r.status === 'paid');
        let approvedTotalAFG = approvedAll.filter(r => r.currency !== 'USD').reduce((sum, r) => sum + ((r.quantity||0)*(r.pricePerUnit||0)), 0);
        let approvedTotalUSD = approvedAll.filter(r => r.currency === 'USD').reduce((sum, r) => sum + ((r.quantity||0)*(r.pricePerUnit||0)), 0);

        html += `<div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Date</th><th>Item Name</th><th>Currency</th><th>Stock</th><th>Description</th><th>Total Value</th><th>Status</th></tr></thead>
            <tbody>${allReturnsRaw.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
                let totalVal = (r.quantity || 0) * (r.pricePerUnit || 0);
                let isApproved = r.status === 'approved' || r.status === 'paid';
                let statusClass = r.status === 'paid' ? 'badge-paid' : (r.status === 'approved' ? 'badge-active' : (r.status === 'rejected' ? 'badge-blocked' : 'badge-frozen'));
                return `<tr>
                    <td>${r.date}</td>
                    <td>${r.itemName}</td>
                    <td><span class="badge ${r.currency==='USD'?'badge-mainclient':'badge-active'}">${r.currency}</span></td>
                    <td>${r.quantity}</td>
                    <td>${r.description || '-'}</td>
                    <td class="${isApproved ? 'profit-text' : ''}">${formatByCurrency(totalVal, r.currency)}</td>
                    <td><span class="badge ${statusClass}">${(r.status || 'pending').toUpperCase()}</span></td>
                </tr>`;
            }).join('')}</tbody>
            <tfoot>
                <tr class="grand-total">
                    <td colspan="5"><strong>Grand Total Approved (AFG)</strong></td>
                    <td><strong class="profit-text">${formatMoney(approvedTotalAFG)}</strong></td>
                    <td></td>
                </tr>
                ${approvedAll.some(r => r.currency === 'USD') ? `<tr class="grand-total" style="background:#eff6ff;">
                    <td colspan="5"><strong>Grand Total Approved (USD)</strong></td>
                    <td><strong class="profit-text">${formatByCurrency(approvedTotalUSD,'USD')}</strong></td>
                    <td></td>
                </tr>` : ''}
            </tfoot>
        </table></div>`;
    }

    // ==== Branch Sales (یک جدول مشترک با ستون Currency) ====
    html += `<h4 style="margin:30px 0 12px;"><i class="fas fa-shopping-cart"></i> Branch Sales</h4>`;
    if (filteredSalesRaw.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-shopping-cart"></i><h3>No Sales</h3></div>`;
    } else {
        let totalSaleAFG = filteredSalesRaw.filter(s => s.currency !== 'USD').reduce((sum, s) => sum + s.revenue, 0);
        let totalSaleUSD = filteredSalesRaw.filter(s => s.currency === 'USD').reduce((sum, s) => sum + s.revenue, 0);

        html += `<div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Item Name</th><th>Currency</th><th>Qty Sold</th><th>Sale Date</th><th>Price/Unit</th><th>Total Price</th><th>Customer Name</th></tr></thead>
            <tbody>${filteredSalesRaw.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => `
                <tr>
                    <td>${s.item}</td>
                    <td><span class="badge ${s.currency==='USD'?'badge-mainclient':'badge-active'}">${s.currency}</span></td>
                    <td>${s.qty}</td><td>${s.date}</td>
                    <td>${formatByCurrency(s.price, s.currency)}</td>
                    <td class="total-value">${formatByCurrency(s.revenue, s.currency)}</td>
                    <td>${s.customer_name || s.customerName || '-'}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot>
                <tr class="grand-total">
                    <td colspan="5"><strong>Total Sale Price (AFG)</strong></td>
                    <td><strong>${formatMoney(totalSaleAFG)}</strong></td>
                    <td></td>
                </tr>
                ${filteredSalesRaw.some(s => s.currency === 'USD') ? `<tr class="grand-total" style="background:#eff6ff;">
                    <td colspan="5"><strong>Total Sale Price (USD)</strong></td>
                    <td><strong>${formatByCurrency(totalSaleUSD,'USD')}</strong></td>
                    <td></td>
                </tr>` : ''}
            </tfoot>
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
    let shipments = branch 
        ? mainClientToBranchShipments.filter(s => s.branch === branch) 
        : mainClientToBranchShipments;

    let afgShipments = shipments.filter(s => getItemCurrency(s.item) !== 'USD');
    let usdShipments = shipments.filter(s => getItemCurrency(s.item) === 'USD');

    function calcTotals(list) {
        let grandTotal = list.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
        let totalPaid = list.reduce((sum, s) => {
            let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
                ? shipmentPayments[s.uniqueKey] : 0;
            return sum + Math.min(paid, getShipmentCorrectTotal(s));
        }, 0);
        let totalUnpaid = Math.max(0, grandTotal - totalPaid);
        return { grandTotal, totalPaid, totalUnpaid };
    }

    let afgTotals = calcTotals(afgShipments);
    let usdTotals = calcTotals(usdShipments);

    let container = document.getElementById('totalAmountContainerResult');
    if (container) {
        container.style.display = 'block';
        container.innerHTML = `
            <div class="payment-summary">
                <h3><i class="fas fa-chart-pie"></i> Payment Summary (AFG) ${branch ? 'for ' + branch + ' Branch' : 'for All Branches'}</h3>
                <div class="summary-stats" style="grid-template-columns:repeat(3,1fr);">
                    <div class="summary-item" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;">
                        <div class="label" style="color:rgba(255,255,255,0.8);">Grand Total</div>
                        <div class="value" style="color:white;font-size:28px;">${formatMoney(afgTotals.grandTotal)}</div>
                    </div>
                    <div class="summary-item" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;">
                        <div class="label" style="color:rgba(255,255,255,0.8);">Total Paid</div>
                        <div class="value" style="color:white;font-size:28px;">${formatMoney(afgTotals.totalPaid)}</div>
                    </div>
                    <div class="summary-item" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;">
                        <div class="label" style="color:rgba(255,255,255,0.8);">Total Unpaid</div>
                        <div class="value" style="color:white;font-size:28px;">${formatMoney(afgTotals.totalUnpaid)}</div>
                    </div>
                </div>
            </div>
            ${usdShipments.length > 0 ? `
            <div class="payment-summary" style="border:2px solid #3b82f6;margin-top:20px;">
                <h3 style="color:#2563eb;"><i class="fas fa-dollar-sign"></i> Payment Summary (USD) ${branch ? 'for ' + branch + ' Branch' : 'for All Branches'}</h3>
                <div class="summary-stats" style="grid-template-columns:repeat(3,1fr);">
                    <div class="summary-item" style="background:linear-gradient(145deg,#1d4ed8,#1e40af);color:white;">
                        <div class="label" style="color:rgba(255,255,255,0.8);">Grand Total</div>
                        <div class="value" style="color:white;font-size:28px;">${formatByCurrency(usdTotals.grandTotal,'USD')}</div>
                    </div>
                    <div class="summary-item" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;">
                        <div class="label" style="color:rgba(255,255,255,0.8);">Total Paid</div>
                        <div class="value" style="color:white;font-size:28px;">${formatByCurrency(usdTotals.totalPaid,'USD')}</div>
                    </div>
                    <div class="summary-item" style="background:#64748b;color:white;">
                        <div class="label" style="color:rgba(255,255,255,0.8);">Total Unpaid</div>
                        <div class="value" style="color:white;font-size:28px;">${formatByCurrency(usdTotals.totalUnpaid,'USD')}</div>
                    </div>
                </div>
            </div>` : ''}`;
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
            items.push({ name: item.name, date: item.date || '-', stock: item.quantity, sellingPrice: item.sellingPrice, purchasePrice: item.purchasePrice, totalSellingPrice: getAdminItemHistoryValue(item), status: isPaid ? 'PAID' : 'UNPAID', currency: item.currency || 'AFG' });
        }

    let html = `
        <div class="header-actions"><h2 class="page-title">Inventory History</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="search-container"><div class="search-box"><i class="fas fa-search"></i><input type="text" id="adminHistorySearchInput" placeholder="Search items..." onkeyup="searchAdminHistory()"></div><div class="search-results" id="adminHistorySearchResults">Showing ${items.length} items</div></div>`;

    if (items.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-history"></i><h3>No Items Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="history-table">
            <thead><tr><th>Item Name</th><th>Currency</th><th>Date</th><th>Stock</th><th>Selling Price</th><th>Purchase Price</th><th>Total Selling Price</th><th>Status</th></tr></thead>
            <tbody id="adminHistoryTableBody">${renderAdminHistoryRows(items)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderAdminHistoryRows(items) {
    return items.map(item => {
        let cur = item.currency || 'AFG';
        return `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td><span class="badge ${cur === 'USD' ? 'badge-mainclient' : 'badge-active'}">${cur}</span></td>
            <td>${item.date}</td><td>${item.stock}</td>
            <td>${formatByCurrency(item.sellingPrice, cur)}</td><td>${formatByCurrency(item.purchasePrice, cur)}</td>
            <td>${formatByCurrency(item.totalSellingPrice, cur)}</td>
            <td><span class="badge ${item.status === 'PAID' ? 'badge-paid' : 'badge-unpaid'}">${item.status}</span></td>
        </tr>`;
    }).join('');
}

window.searchAdminHistory = async function () {
    let searchTerm = document.getElementById('adminHistorySearchInput').value.toLowerCase();
    let filtered = mainInventory.filter(item => item.name.toLowerCase().includes(searchTerm));
   
    let items = filtered.map(item => ({
        name: item.name, date: item.date || '-', stock: item.quantity,
        sellingPrice: item.sellingPrice, purchasePrice: item.purchasePrice,
        totalSellingPrice: getAdminItemHistoryValue(item), status: 'UNPAID', currency: item.currency || 'AFG'
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

    let filteredAfg = filtered.filter(e => (e.currency || 'AFG') !== 'USD');
    let filteredUsd = filtered.filter(e => e.currency === 'USD');

    let afgTbody = document.getElementById('expenseTableBodyAFG');
    if (afgTbody) {
        afgTbody.innerHTML = filteredAfg.length === 0
            ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#64748b;">No expenses found for selected period</td></tr>`
            : renderExpenseRows(filteredAfg);
    }

    let usdTbody = document.getElementById('expenseTableBodyUSD');
    if (usdTbody) {
        usdTbody.innerHTML = filteredUsd.length === 0
            ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#64748b;">No expenses found for selected period</td></tr>`
            : renderExpenseRows(filteredUsd);
    }
};

function getAdminItemHistoryValue(item) {
    let discount = getItemDiscount(item.name);
    let currentPrice = item.sellingPrice || 0;
    let originalPrice = discount ? parseFloat(discount.originalPrice) : currentPrice;
    let soldQty = salesHistory.filter(s => s.item === item.name).reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);
    let actualSoldQty = Math.min(soldQty, item.quantity || 0);
    let unsoldQty = Math.max(0, (item.quantity || 0) - actualSoldQty);
    return (actualSoldQty * originalPrice) + (unsoldQty * currentPrice);
}