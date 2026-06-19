// ==================== branch-extra.js ====================
// Branch: finance، payments، returns، history، complete report

// ==================== BRANCH FINANCE ====================
async function renderBranchFinance() {
    let branch = currentUser.username;

    try {
        const salesResponse = await fetch(`/api/sales/${branch}`);
        if (salesResponse.ok) {
            const salesData = await salesResponse.json();
            salesHistory = salesData.map(s => ({
                id: s.id, date: s.date ? s.date.split('T')[0] : getTodayDate(),
                branch: s.branch, item: s.item, qty: parseInt(s.qty),
                price: parseFloat(s.price), purchasePrice: parseFloat(s.purchase_price),
                revenue: parseFloat(s.revenue), cost: parseFloat(s.cost),
                profit: parseFloat(s.profit), billNumber: s.bill_number
            }));
        }
    } catch (err) { console.log('Error loading sales:', err); }

    try {
        const expensesResponse = await fetch(`/api/expenses/branch/${branch}`);
        if (expensesResponse.ok) {
            branchExpenses[branch] = (await expensesResponse.json()).map(e => ({
                id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(),
                category: e.category, amount: parseFloat(e.amount), description: e.description
            }));
        }
    } catch (err) { console.log('Error loading expenses:', err); }

    let branchSales = salesHistory.filter(s => s.branch === branch);
    let totalSale = branchSales.reduce((sum, s) => sum + (s.revenue || 0), 0);
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let totalPurchase = branchShipments.reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);
    let expensesList = branchExpenses[branch] || [];
    let totalExpenses = expensesList.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    let grossProfit = totalSale - totalPurchase;
    let netProfit = grossProfit - totalExpenses;

    if (!branchFinance[branch]) branchFinance[branch] = { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalLoss: 0, totalExpenses: 0 };
    branchFinance[branch].totalSale = totalSale;
    branchFinance[branch].totalPurchase = totalPurchase;
    branchFinance[branch].totalExpenses = totalExpenses;
    branchFinance[branch].totalProfit = netProfit;

    let html = `
        <div class="header-actions">
            <h2 class="page-title">My Finance</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><i class="fas fa-shopping-cart"></i><h4>Total Sales (Revenue)</h4><div class="stat-value total-value" style="color:#22c55e;">${formatMoney(totalSale)}</div><small>From all sales</small></div>
            <div class="stat-card"><i class="fas fa-truck"></i><h4>Total Purchases (Cost)</h4><div class="stat-value total-value" style="color:#f59e0b;">${formatMoney(totalPurchase)}</div><small>From main client shipments</small></div>
            <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses</h4><div class="stat-value" style="color:#dc2626;">${formatMoney(totalExpenses)}</div><small>${expensesList.length} expense(s)</small></div>
        </div>
        <div class="stat-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;margin-top:20px;">
            <i class="fas fa-wallet" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Net Profit</h4>
            <div class="stat-value" style="color:white;font-size:32px;">${formatMoney(netProfit)}</div>
            <small style="color:rgba(255,255,255,0.7);">Gross Profit - Expenses</small>
        </div>`;

    if (expensesList.length > 0) {
        html += `<h3 style="margin:30px 0 20px;">Expense History</h3>
        <div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>${expensesList.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
                <tr>
                    <td>${exp.date}</td>
                    <td><span class="badge badge-blocked">${exp.category}</span></td>
                    <td>${exp.description || '-'}</td>
                    <td style="color:#dc2626;font-weight:600;">${formatMoney(exp.amount)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr class="grand-total"><td colspan="3"><strong>Total Expenses</strong></td><td><strong>${formatMoney(totalExpenses)}</strong></td></tr></tfoot>
        </table></div>`;
    } else {
        html += `<div class="empty-state" style="margin-top:30px;"><i class="fas fa-file-invoice"></i><h3>No Expenses Yet</h3>
            <button class="action-btn" onclick="showSection('branchExpenses')" style="margin-bottom:0;"><i class="fas fa-plus"></i> Add Expense</button></div>`;
    }

    if (branchSales.length > 0) {
        let lastTen = branchSales.slice(-10).reverse();
        html += `<h3 style="margin:30px 0 20px;">Recent Sales (Last 10)</h3>
        <div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Selling Price</th><th>Revenue</th><th>Bill Number</th></tr></thead>
            <tbody>${lastTen.map(s => `
                <tr>
                    <td>${s.date}</td><td>${s.item}</td><td>${s.qty}</td>
                    <td>${formatMoney(s.price)}</td>
                    <td style="color:#22c55e;font-weight:600;">${formatMoney(s.revenue)}</td>
                    <td>${s.billNumber || '-'}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot><tr class="grand-total">
                <td colspan="4"><strong>Total (Last 10)</strong></td>
                <td><strong>${formatMoney(lastTen.reduce((sum, s) => sum + s.revenue, 0))}</strong></td>
                <td></td>
            </tr></tfoot>
        </table></div>`;
    }

    document.getElementById('content').innerHTML = html;
}

// ==================== BRANCH PAYMENTS ====================
function renderBranchPayments() {
    let branch = currentUser.username;
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let totalValue = branchShipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);
    let totalPaid = branchShipments.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
    let totalUnpaid = totalValue - totalPaid;
    let paidItems = branchShipments.filter(s => getShipmentStatus(s) === 'paid').length;
    let partialItems = branchShipments.filter(s => getShipmentStatus(s) === 'partial').length;

    let html = `
        <div class="header-actions">
            <h2 class="page-title">My Payments</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="payment-summary">
            <h3><i class="fas fa-chart-pie"></i> Payment Summary</h3>
            <div class="summary-stats">
                <div class="summary-item"><div class="label">Total Shipments</div><div class="value">${branchShipments.length}</div></div>
                <div class="summary-item"><div class="label">Paid Shipments</div><div class="value" style="color:#22c55e;">${paidItems}</div></div>
                <div class="summary-item"><div class="label">Partial Shipments</div><div class="value" style="color:#f59e0b;">${partialItems}</div></div>
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatMoney(totalValue)}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatMoney(totalPaid)}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatMoney(totalUnpaid)}</div></div>
            </div>
        </div>
        <h3 style="margin-bottom:20px;">Payment Details</h3>`;

    if (branchShipments.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box"></i><h3>No Payments Yet</h3><p>You haven't received any items from main client.</p></div>`;
    } else {
        html += `<div class="table-wrapper"><table>
            <thead><tr><th>#</th><th>Date</th><th>Item Name</th><th>Quantity</th><th>Selling Price</th><th>Total Price</th><th>Paid Amount</th><th>Remaining</th><th>Status</th></tr></thead>
            <tbody>${branchShipments.sort((a, b) => new Date(b.date) - new Date(a.date)).map((s, index) => {
                let totalPrice = s.sellingPrice * s.qty;
                let paidAmount = getShipmentPaidAmount(s);
                let reminder = totalPrice - paidAmount;
                let status = getShipmentStatus(s);
                let sc = status === 'paid' ? 'badge-paid' : (status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                return `<tr>
                    <td>${index + 1}</td><td>${s.date}</td><td>${s.item}</td><td>${s.qty}</td>
                    <td>${formatMoney(s.sellingPrice)}</td>
                    <td class="total-value">${formatMoney(totalPrice)}</td>
                    <td class="status-paid">${formatMoney(paidAmount)}</td>
                    <td class="reminder-amount">${formatMoney(reminder)}</td>
                    <td><span class="badge ${sc}">${status.toUpperCase()}</span></td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

// ==================== BRANCH RETURNS ====================
async function renderBranchReturns() {
    let branch = currentUser.username;

    try {
        const response = await fetch(`/api/branch-inventory/${branch}`);
        if (response.ok) {
            const data = await response.json();
            branchInventory[branch] = data.map(item => ({
                id: item.id, name: item.item_name,
                quantity: parseInt(item.quantity), sellingPrice: parseFloat(item.selling_price),
                purchasePrice: parseFloat(item.purchase_price), supplier: item.supplier,
                shipmentDate: item.shipment_date, distributionId: item.distribution_id,
                originalQuantity: parseInt(item.original_quantity) || parseInt(item.quantity)
            }));
        }
    } catch (err) { console.log('Error loading branch inventory:', err); }

    let branchInv = branchInventory[branch] || [];
    let returns = getBranchReturns(branch);

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Return Items to Main Client</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="returns-section">
            <h3><i class="fas fa-undo-alt"></i> Items Received from Main Client</h3>
            <div class="table-wrapper"><table>
                <thead><tr><th>ID</th><th>Item Name</th><th>Stock</th><th>Selling Price</th><th>Total Value</th><th>Payment Status</th><th>Action</th></tr></thead>
                <tbody>${branchInv.map((item, index) => {
                    let originalShipment = mainClientToBranchShipments.find(s => s.branch === branch && s.item === item.name);
                    let totalValue = item.sellingPrice * item.quantity;
                    let paymentStatus = originalShipment ? getShipmentStatus(originalShipment) : 'unpaid';
                    let isPaid = paymentStatus === 'paid';
                    let totalReturnedQty = returns.filter(r => r.itemName === item.name && (r.status === 'approved' || r.status === 'paid')).reduce((sum, r) => sum + r.quantity, 0);
                    let paymentBadge = isPaid ? '<span class="badge badge-paid">PAID</span>' : (paymentStatus === 'partial' ? '<span class="badge badge-partial">PARTIAL</span>' : '<span class="badge badge-unpaid">UNPAID</span>');

                    return `<tr>
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${formatMoney(item.sellingPrice)}</td>
                        <td class="total-value">${formatMoney(totalValue)}</td>
                        <td>${paymentBadge}</td>
                        <td>
                            ${item.quantity > 0 && isPaid
                                ? `<button class="btn btn-return" onclick="showReturnModal('${item.name}',${item.quantity},${item.sellingPrice})"><i class="fas fa-undo-alt"></i> Return (Available: ${item.quantity})</button>`
                                : !isPaid
                                    ? `<span class="badge badge-unpaid">Payment Required</span>`
                                    : `<span class="badge badge-unpaid">Out of Stock</span>`
                            }
                            ${totalReturnedQty > 0 ? `<br><small style="color:#f59e0b;">Returned: ${totalReturnedQty}</small>` : ''}
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>

            <h3 style="margin-top:40px;"><i class="fas fa-history"></i> Return History</h3>
            <div class="table-wrapper"><table>
                <thead><tr><th>Date</th><th>Item Name</th><th>Quantity</th><th>Price per Unit</th><th>Refund Amount</th><th>Description</th><th>Status</th></tr></thead>
                <tbody>${returns.length === 0
                    ? `<tr><td colspan="7" style="text-align:center;">No returns yet</td></tr>`
                    : returns.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
                        let status = getReturnStatus(r);
                        let statusClass = status === 'paid' ? 'return-badge-paid' : (status === 'approved' ? 'return-badge-approved' : (status === 'rejected' ? 'return-badge-rejected' : 'return-badge-pending'));
                        let statusText = status === 'paid' ? '💰 PAID' : (status === 'approved' ? '✓ APPROVED' : (status === 'rejected' ? '❌ REJECTED' : '⏳ PENDING'));
                        return `<tr>
                            <td>${r.date}</td><td>${r.itemName}</td><td>${r.quantity}</td>
                            <td>${formatMoney(r.pricePerUnit)}</td>
                            <td class="total-value">${formatMoney(r.refundAmount || (r.quantity * r.pricePerUnit))}</td>
                            <td>${r.description || '-'}</td>
                            <td><span class="${statusClass}">${statusText}</span></td>
                        </tr>`;
                    }).join('')
                }</tbody>
            </table></div>
        </div>`;

    document.getElementById('content').innerHTML = html;
}

window.showReturnModal = function (itemName, maxQuantity, pricePerUnit) {
    if (maxQuantity <= 0) { alert('No stock available to return!'); return; }
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Return Item: ${itemName}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Available Stock: ${maxQuantity}</label></div>
        <div class="form-group"><label>Quantity to Return</label>
            <input type="number" id="returnQuantity" min="1" max="${maxQuantity}" value="1">
            <small style="color:#166534;">Maximum available: ${maxQuantity}</small>
        </div>
        <div class="form-group"><label>Description / Reason for Return</label>
            <textarea id="returnDescription" rows="3" placeholder="Enter reason for returning items..."></textarea>
        </div>
        <div class="form-group"><label>Total Return Value</label>
            <input type="text" id="returnTotal" value="${formatMoney(pricePerUnit)}" readonly style="background:#f1f5f9;">
        </div>
        <button class="save-btn" onclick="submitReturn('${itemName}',${pricePerUnit})"><i class="fas fa-check"></i> Submit Return Request</button>`;
    document.getElementById('modal').classList.add('active');

    document.getElementById('returnQuantity').addEventListener('input', function () {
        let qty = Math.min(parseInt(this.value) || 0, maxQuantity);
        if (qty > maxQuantity) { this.value = maxQuantity; qty = maxQuantity; }
        document.getElementById('returnTotal').value = formatMoney(qty * pricePerUnit);
    });
};

window.submitReturn = async function (itemName, pricePerUnit) {
    let quantity = parseInt(document.getElementById('returnQuantity').value);
    let description = document.getElementById('returnDescription').value;
    let branch = currentUser.username;
    if (!quantity || quantity < 1) { alert('Please enter a valid quantity'); return; }

    let branchItems = (branchInventory[branch] || []).filter(i => i.name === itemName);
    let currentStock = branchItems.reduce((sum, i) => sum + i.quantity, 0);
    if (quantity > currentStock) { alert(`You only have ${currentStock} units available.`); return; }

    try {
        const response = await fetch('/api/returns', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: getTodayDate(), branch, item_name: itemName, quantity, price_per_unit: pricePerUnit, description, status: 'pending' })
        });
        if (response.ok) {
            const newReturn = await response.json();
            branchReturns.push({ id: newReturn.id, date: getTodayDate(), branch, itemName, quantity, pricePerUnit, description, status: 'pending' });
            closeModal();
            renderBranchReturns();
            alert(`✅ Return request submitted for ${quantity} x ${itemName}. Waiting for approval.`);
        } else alert('Failed to submit return: ' + (await response.json()).error);
    } catch (err) { alert('Failed to submit return. Make sure server is running.'); }
};

// ==================== BRANCH COMPLETE REPORT ====================
function renderBranchCompleteReport() {
    let branch = currentUser.username;
    let inventory = branchInventory[branch] || [];
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let fin = branchFinance[branch] || { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalExpenses: 0 };
    let expensesList = branchExpenses[branch] || [];
    let returns = getBranchReturns(branch);

    let totalReceived = branchShipments.reduce((sum, s) => sum + (s.qty || 0), 0);
    let totalReceivedValue = branchShipments.reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);
    let currentStock = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
    let currentStockValue = inventory.reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.quantity || 0)), 0);
    let totalExpenses = expensesList.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    let netProfit = fin.totalSale - totalExpenses;

    let approvedReturns = returns.filter(r => r.status === 'approved' || r.status === 'paid');
    let totalReturns = approvedReturns.reduce((sum, r) => sum + (r.quantity || 0), 0);
    let totalReturnsValue = approvedReturns.reduce((sum, r) => sum + ((r.quantity || 0) * (r.pricePerUnit || 0)), 0);
    let pendingReturns = returns.filter(r => r.status === 'pending').length;

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Complete Branch Report - ${branch}</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>`;

    if (inventory.length === 0 && branchShipments.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-chart-bar"></i><h3>No Data Available</h3><p>Your branch has no items in inventory yet</p></div>`;
        document.getElementById('content').innerHTML = html;
        return;
    }

        html += `
        <div class="search-container">
            <div class="search-box"><i class="fas fa-search"></i>
                <input type="text" id="productSearchInput" placeholder="Search products..." onkeyup="searchBranchProducts()">
            </div>
            <div class="search-results" id="productSearchResults">Showing ${inventory.length} products</div>
        </div>
        <div class="report-grid">
            <div class="report-card">
                <h3><i class="fas fa-boxes"></i> Inventory Summary</h3>
                <div class="report-number">${currentStock}</div>
                <div class="report-label">Items Remaining</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;"><span>Stock Value (Selling):</span><span><strong>${formatMoney(currentStockValue)}</strong></span></div>
                </div>
            </div>
            <div class="report-card">
                <h3><i class="fas fa-undo-alt"></i> Returns Summary</h3>
                <div class="report-number">${totalReturns}</div>
                <div class="report-label">Items Returned</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Return Value:</span><span><strong>${formatMoney(totalReturnsValue)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Pending Returns:</span><span><strong style="color:#f59e0b;">${pendingReturns}</strong></span></div>
                </div>
            </div>
        </div>`;

    let branchSalesAll = salesHistory.filter(s => s.branch === branch);
    let totalSaleAmount = branchSalesAll.reduce((sum, s) => sum + (s.revenue || 0), 0);

    html += `
        <div class="stat-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;margin-bottom:30px;">
            <i class="fas fa-cash-register" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Total Sale</h4>
            <div class="stat-value" style="color:white;font-size:32px;">${formatMoney(totalSaleAmount)}</div>
            <small style="color:rgba(255,255,255,0.7);">Total revenue from all sales</small>
        </div>

        <h3 style="margin:30px 0 20px;">Product Details</h3>
        <div id="productDetailsList">${renderProductDetails(inventory, branchShipments, branch)}</div>

        <h3 style="margin:30px 0 20px;">Return History</h3>
        <div class="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Price/Unit</th><th>Total Value</th><th>Description</th><th>Status</th></tr></thead>
            <tbody>${returns.length === 0
                ? `<tr><td colspan="7" style="text-align:center;">No returns yet</td></tr>`
                : returns.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
                    <tr>
                        <td>${r.date}</td><td>${r.itemName}</td><td>${r.quantity}</td>
                        <td>${formatMoney(r.pricePerUnit)}</td><td>${formatMoney(r.totalValue)}</td>
                        <td>${r.description || '-'}</td>
                        <td><span class="${r.status === 'paid' ? 'return-badge-paid' : (r.status === 'approved' ? 'return-badge-approved' : (r.status === 'rejected' ? 'return-badge-rejected' : 'return-badge-pending'))}">${r.status.toUpperCase()}</span></td>
                    </tr>`).join('')
            }</tbody>
        </table></div>`;

    document.getElementById('content').innerHTML = html;
}

function renderProductDetails(inventory, shipments, branch) {
    if (!inventory || inventory.length === 0) return '<p style="text-align:center;color:#64748b;">No products in inventory</p>';

    return inventory.map((item, index) => {
        let itemShipments = shipments.filter(s => s.item === item.name);
        let totalReceived = itemShipments.reduce((sum, s) => sum + (s.qty || 0), 0);
        let itemSales = salesHistory.filter(s => s.branch === branch && s.item === item.name);
        let sold = itemSales.reduce((sum, s) => sum + s.qty, 0);
        let revenue = itemSales.reduce((sum, s) => sum + s.revenue, 0);
        let profit = itemSales.reduce((sum, s) => sum + s.profit, 0);
        let itemReturns = branchReturns.filter(r => {
            let returnBranch = r.branch || r.branchName || r.branchUsername;
            let returnItem = r.itemName || r.item || r.name;
            let isApproved = r.status === 'approved' || r.status === 'paid' || r.approved === true || r.paid === true;
            return returnBranch === branch && returnItem === item.name && isApproved;
        });
        let returnedQty = itemReturns.reduce((sum, r) => sum + (r.quantity || r.qty || 0), 0);
        let discount = getItemDiscount(item.name);
        let uniqueId = `product-${branch}-${item.name.replace(/\s+/g, '-')}-${index}`;

        return `
            <div class="product-report-card">
                <div class="product-report-header" onclick="toggleProductDetails('${uniqueId}')">
                    <h4>${item.name}${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : ''}</h4>
                    <i class="fas fa-chevron-down" id="chevron-${uniqueId}"></i>
                </div>
                <div class="product-stats">
                    <div class="stat-item"><div class="stat-label">Received</div><div class="stat-value">${totalReceived}</div></div>
                    <div class="stat-item"><div class="stat-label">Sold</div><div class="stat-value" style="color:#22c55e;">${sold}</div></div>
                    <div class="stat-item"><div class="stat-label">Returned</div><div class="stat-value" style="color:#f59e0b;">${returnedQty}</div></div>
                    <div class="stat-item"><div class="stat-label">In Stock</div><div class="stat-value">${item.quantity}</div></div>
                    <div class="stat-item"><div class="stat-label">Revenue</div><div class="stat-value profit-text">${formatMoney(revenue)}</div></div>
                </div>
                <div id="${uniqueId}" style="display:none;margin-top:20px;">
                    ${itemShipments.length > 0 ? `
                        <h5 style="margin-bottom:10px;">Shipment History</h5>
                        <table style="width:100%;font-size:14px;border-collapse:collapse;">
                            <thead><tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Received</th><th style="padding:8px;text-align:left;">Selling Price</th></tr></thead>
                            <tbody>${itemShipments.map(s => `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">${s.date}</td><td style="padding:8px;">${s.qty}</td><td style="padding:8px;">${formatMoney(s.sellingPrice)}</td></tr>`).join('')}</tbody>
                        </table>` : '<p style="color:#64748b;">No shipment history</p>'}
                    ${itemSales.length > 0 ? `
                        <h5 style="margin:15px 0 10px;">Sales History</h5>
                        <table style="width:100%;font-size:14px;border-collapse:collapse;">
                            <thead><tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;">Date</th><th style="padding:8px;text-align:left;">Qty</th><th style="padding:8px;text-align:left;">Price</th><th style="padding:8px;text-align:left;">Revenue</th></tr></thead>
                            <tbody>${itemSales.map(s => `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">${s.date}</td><td style="padding:8px;">${s.qty}</td><td style="padding:8px;">${formatMoney(s.price)}</td><td style="padding:8px;">${formatMoney(s.revenue)}</td></tr>`).join('')}</tbody>
                        </table>` : ''}
                </div>
            </div>`;
    }).join('');
}

window.toggleProductDetails = function (productId) {
    let details = document.getElementById(productId);
    let chevron = document.getElementById(`chevron-${productId}`);
    if (details) {
        let isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
        if (chevron) {
            chevron.classList.toggle('fa-chevron-down', !isHidden);
            chevron.classList.toggle('fa-chevron-up', isHidden);
        }
    }
};

window.searchBranchProducts = function () {
    let branch = currentUser.username;
    let inventory = branchInventory[branch] || [];
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let searchTerm = document.getElementById('productSearchInput').value.toLowerCase();
    let filtered = inventory.filter(item => item.name.toLowerCase().includes(searchTerm));
    document.getElementById('productDetailsList').innerHTML = renderProductDetails(filtered, branchShipments, branch);
    document.getElementById('productSearchResults').innerHTML = `Showing ${filtered.length} of ${inventory.length} products`;
};

function applyBranchTimeFilter() { renderBranchCompleteReport(); }