// ==================== branch-extra.js ====================
// Branch: finance، payments، returns، history، complete report

// ==================== BRANCH FINANCE ====================

// ==================== BRANCH PAYMENTS ====================
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
                category: e.category, amount: parseFloat(e.amount), description: e.description,
                currency: e.currency || 'AFG'
            }));
        }
    } catch (err) { console.log('Error loading expenses:', err); }

    let branchSalesAll = salesHistory.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let branchShipmentsAll = mainClientToBranchShipments.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let expensesList = branchExpenses[branch] || [];

    function buildFinanceBlock(currency) {
        let fmt = (v) => formatByCurrency(v, currency);
        let sales = branchSalesAll.filter(s => s.currency === currency);
        let shipments = branchShipmentsAll.filter(s => s.currency === currency);
        let exps = expensesList.filter(e => (e.currency||'AFG') === currency);

        let totalSale = sales.reduce((sum, s) => sum + (s.revenue || 0), 0);
        let totalPurchase = shipments.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
        let totalExpenses = exps.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        let netProfit = totalSale - totalPurchase - totalExpenses;

        let bgClass = currency === 'USD' ? 'style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"' : '';
        let iconStyle = currency === 'USD' ? 'style="color:white;"' : '';
        let hStyle = currency === 'USD' ? 'style="color:rgba(255,255,255,0.8);"' : '';
        let smallStyle = currency === 'USD' ? 'style="color:rgba(255,255,255,0.7);"' : '';

        let html = `
        <div class="stats-grid">
            <div class="stat-card" ${bgClass}><i class="fas fa-shopping-cart" ${iconStyle}></i><h4 ${hStyle}>Total Sales (Revenue)</h4><div class="stat-value ${currency!=='USD'?'total-value':''}" style="${currency==='USD'?'color:white;':'color:#22c55e;'}">${fmt(totalSale)}</div><small ${smallStyle}>From all sales</small></div>
            <div class="stat-card" ${bgClass}><i class="fas fa-truck" ${iconStyle}></i><h4 ${hStyle}>Total Purchases (Cost)</h4><div class="stat-value ${currency!=='USD'?'total-value':''}" style="${currency==='USD'?'color:white;':'color:#f59e0b;'}">${fmt(totalPurchase)}</div><small ${smallStyle}>From main client shipments</small></div>
            <div class="stat-card ${currency!=='USD'?'expense-card':''}" ${currency==='USD'?'style="background:#64748b;color:white;"':''}><i class="fas fa-file-invoice" ${iconStyle}></i><h4 ${hStyle}>Total Expenses</h4><div class="stat-value" style="${currency==='USD'?'color:white;':'color:#dc2626;'}">${fmt(totalExpenses)}</div><small ${smallStyle}>${exps.length} expense(s)</small></div>
        </div>
        <div class="stat-card" style="background:${netProfit>=0 ? 'linear-gradient(145deg,#22c55e,#16a34a)' : 'linear-gradient(145deg,#ef4444,#b91c1c)'};color:white;margin-top:20px;">
            <i class="fas fa-wallet" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Net Profit</h4>
            <div class="stat-value" style="color:white;font-size:32px;">${fmt(netProfit)}</div>
            <small style="color:rgba(255,255,255,0.7);">Gross Profit - Expenses</small>
        </div>`;

        if (exps.length > 0) {
            html += `<h4 style="margin:20px 0 12px;">Expense History</h4>
            <div class="table-wrapper"><table class="inventory-table">
                <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
                <tbody>${exps.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
                    <tr>
                        <td>${exp.date}</td>
                        <td><span class="badge badge-blocked">${exp.category}</span></td>
                        <td>${exp.description || '-'}</td>
                        <td style="color:#dc2626;font-weight:600;">${fmt(exp.amount)}</td>
                    </tr>`).join('')}
                </tbody>
                <tfoot><tr class="grand-total"><td colspan="3"><strong>Total Expenses</strong></td><td><strong>${fmt(totalExpenses)}</strong></td></tr></tfoot>
            </table></div>`;
        }

        if (sales.length > 0) {
            let lastTen = sales.slice(-10).reverse();
            html += `<h4 style="margin:20px 0 12px;">Recent Sales (Last 10)</h4>
            <div class="table-wrapper"><table class="inventory-table">
                <thead><tr><th>Date</th><th>Item</th><th>Quantity</th><th>Selling Price</th><th>Revenue</th><th>Bill Number</th></tr></thead>
                <tbody>${lastTen.map(s => `
                    <tr>
                        <td>${s.date}</td><td>${s.item}</td><td>${s.qty}</td>
                        <td>${fmt(s.price)}</td>
                        <td style="color:#22c55e;font-weight:600;">${fmt(s.revenue)}</td>
                        <td>${s.billNumber || '-'}</td>
                    </tr>`).join('')}
                </tbody>
                <tfoot><tr class="grand-total">
                    <td colspan="4"><strong>Total (Last 10)</strong></td>
                    <td><strong>${fmt(lastTen.reduce((sum, s) => sum + s.revenue, 0))}</strong></td>
                    <td></td>
                </tr></tfoot>
            </table></div>`;
        }
        return html;
    }

    let html = `
        <div class="header-actions">
            <h2 class="page-title">My Finance</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <h3 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
        ${buildFinanceBlock('AFG')}
        <h3 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
        ${buildFinanceBlock('USD')}`;

    document.getElementById('content').innerHTML = html;
}

function renderBranchPayments() {
    let branch = currentUser.username;
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));

    let shipmentsWithCalc = branchShipments.map(s => {
        let correctTotal = getShipmentCorrectTotal(s);
        let paidAmount = Math.min(
            (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
                ? shipmentPayments[s.uniqueKey] : 0,
            correctTotal
        );
        let unpaidAmount = Math.max(0, correctTotal - paidAmount);
        let status = paidAmount >= correctTotal ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
        return { ...s, totalPrice: correctTotal, paidAmount, unpaidAmount, status };
    });

    let afgList = shipmentsWithCalc.filter(s => s.currency !== 'USD');
    let usdList = shipmentsWithCalc.filter(s => s.currency === 'USD');

    function calcSummary(list) {
        return {
            count: list.length,
            paidCount: list.filter(s => s.status === 'paid').length,
            partialCount: list.filter(s => s.status === 'partial').length,
            totalValue: list.reduce((sum, s) => sum + s.totalPrice, 0),
            totalPaid: list.reduce((sum, s) => sum + s.paidAmount, 0),
            totalUnpaid: list.reduce((sum, s) => sum + s.unpaidAmount, 0)
        };
    }

    let afgSummary = calcSummary(afgList);
    let usdSummary = calcSummary(usdList);

    let html = `
        <div class="header-actions">
            <h2 class="page-title">My Payments</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="payment-summary">
            <h3><i class="fas fa-chart-pie"></i> Payment Summary (AFG)</h3>
            <div class="summary-stats">
                <div class="summary-item"><div class="label">Total Shipments</div><div class="value">${afgSummary.count}</div></div>
                <div class="summary-item"><div class="label">Paid</div><div class="value" style="color:#22c55e;">${afgSummary.paidCount}</div></div>
                <div class="summary-item"><div class="label">Partial</div><div class="value" style="color:#f59e0b;">${afgSummary.partialCount}</div></div>
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatMoney(afgSummary.totalValue)}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatMoney(afgSummary.totalPaid)}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatMoney(afgSummary.totalUnpaid)}</div></div>
            </div>
        </div>
        ${usdList.length > 0 ? `
        <div class="payment-summary" style="border:2px solid #3b82f6;">
            <h3 style="color:#2563eb;"><i class="fas fa-dollar-sign"></i> Payment Summary (USD)</h3>
            <div class="summary-stats">
                <div class="summary-item"><div class="label">Total Shipments</div><div class="value">${usdSummary.count}</div></div>
                <div class="summary-item"><div class="label">Paid</div><div class="value" style="color:#22c55e;">${usdSummary.paidCount}</div></div>
                <div class="summary-item"><div class="label">Partial</div><div class="value" style="color:#f59e0b;">${usdSummary.partialCount}</div></div>
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatByCurrency(usdSummary.totalValue,'USD')}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatByCurrency(usdSummary.totalPaid,'USD')}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatByCurrency(usdSummary.totalUnpaid,'USD')}</div></div>
            </div>
        </div>` : ''}
        <h3 style="margin-bottom:20px;">Payment Details</h3>
        ${shipmentsWithCalc.length === 0 
            ? `<div class="empty-state"><i class="fas fa-box"></i><h3>No Payments Yet</h3></div>`
            : `<div class="table-wrapper"><table>
                <thead><tr><th>#</th><th>Date</th><th>Item</th><th>Currency</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>${shipmentsWithCalc.sort((a,b) => new Date(b.date)-new Date(a.date)).map((s,i) => {
                    let sc = s.status === 'paid' ? 'badge-paid' : (s.status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                    let fmt = (v) => formatByCurrency(v, s.currency);
                    return `<tr>
                        <td>${i+1}</td><td>${s.date}</td><td>${s.item}</td>
                        <td><span class="badge ${s.currency==='USD'?'badge-mainclient':'badge-active'}">${s.currency}</span></td>
                        <td>${s.qty}</td>
                        <td>${fmt(s.sellingPrice)}</td>
                        <td class="total-value">${fmt(s.totalPrice)}</td>
                        <td class="status-paid">${fmt(s.paidAmount)}</td>
                        <td class="reminder-amount">${fmt(s.unpaidAmount)}</td>
                        <td><span class="badge ${sc}">${s.status.toUpperCase()}</span></td>
                    </tr>`;
                }).join('')}</tbody>
                <tfoot>
                    <tr class="grand-total" style="background:#f0fdf4;">
                        <td colspan="6"><strong>Grand Total (AFG)</strong></td>
                        <td><strong>${formatMoney(afgSummary.totalValue)}</strong></td>
                        <td><strong>${formatMoney(afgSummary.totalPaid)}</strong></td>
                        <td><strong>${formatMoney(afgSummary.totalUnpaid)}</strong></td>
                        <td></td>
                    </tr>
                    ${usdList.length > 0 ? `<tr class="grand-total" style="background:#eff6ff;">
                        <td colspan="6"><strong>Grand Total (USD)</strong></td>
                        <td><strong>${formatByCurrency(usdSummary.totalValue,'USD')}</strong></td>
                        <td><strong>${formatByCurrency(usdSummary.totalPaid,'USD')}</strong></td>
                        <td><strong>${formatByCurrency(usdSummary.totalUnpaid,'USD')}</strong></td>
                        <td></td>
                    </tr>` : ''}
                </tfoot>
            </table></div>`
        }`;
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
                <thead><tr><th>ID</th><th>Item Name</th><th>Currency</th><th>Stock</th><th>Selling Price</th><th>Total Value</th><th>Payment Status</th><th>Action</th></tr></thead>
                <tbody>${branchInv.map((item, index) => {
                    let currency = getItemCurrency(item.name);
                    let originalShipment = mainClientToBranchShipments.find(s => s.branch === branch && s.item === item.name);
                    let totalValue = item.sellingPrice * item.quantity;
                    let paymentStatus = originalShipment ? getShipmentStatus(originalShipment) : 'unpaid';
                    let isPaid = paymentStatus === 'paid';
                    let totalReturnedQty = returns.filter(r => r.itemName === item.name && (r.status === 'approved' || r.status === 'paid')).reduce((sum, r) => sum + r.quantity, 0);
                    let paymentBadge = isPaid ? '<span class="badge badge-paid">PAID</span>' : (paymentStatus === 'partial' ? '<span class="badge badge-partial">PARTIAL</span>' : '<span class="badge badge-unpaid">UNPAID</span>');

                    return `<tr>
                        <td>${index + 1}</td>
                        <td>${item.name}</td>
                        <td><span class="badge ${currency==='USD'?'badge-mainclient':'badge-active'}">${currency}</span></td>
                        <td>${item.quantity}</td>
                        <td>${formatByCurrency(item.sellingPrice, currency)}</td>
                        <td class="total-value">${formatByCurrency(totalValue, currency)}</td>
                        <td>${paymentBadge}</td>
                        <td>
                        ${item.quantity > 0
                            ? `<button class="btn btn-return" onclick="showReturnModal('${item.name}',${item.quantity},${item.sellingPrice},${isPaid})"><i class="fas fa-undo-alt"></i> Return (Available: ${item.quantity})</button>`
                            : `<span class="badge badge-unpaid">Out of Stock</span>`
                        }                  
                            ${totalReturnedQty > 0 ? `<br><small style="color:#f59e0b;">Returned: ${totalReturnedQty}</small>` : ''}
                        </td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>

            <h3 style="margin-top:40px;"><i class="fas fa-history"></i> Return History</h3>
            <div class="table-wrapper"><table>
                <thead><tr><th>Date</th><th>Item Name</th><th>Currency</th><th>Quantity</th><th>Price per Unit</th><th>Refund Amount</th><th>Description</th><th>Status</th></tr></thead>
                <tbody>${returns.length === 0
                    ? `<tr><td colspan="8" style="text-align:center;">No returns yet</td></tr>`
                    : returns.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
                        let currency = getItemCurrency(r.itemName);
                        let status = getReturnStatus(r);
                        let statusClass = status === 'paid' ? 'return-badge-paid' : (status === 'approved' ? 'return-badge-approved' : (status === 'rejected' ? 'return-badge-rejected' : 'return-badge-pending'));
                        let statusText = status === 'paid' ? '💰 PAID' : (status === 'approved' ? '✓ APPROVED' : (status === 'rejected' ? '❌ REJECTED' : '⏳ PENDING'));
                        return `<tr>
                            <td>${r.date}</td><td>${r.itemName}</td>
                            <td><span class="badge ${currency==='USD'?'badge-mainclient':'badge-active'}">${currency}</span></td>
                            <td>${r.quantity}</td>
                            <td>${formatByCurrency(r.pricePerUnit, currency)}</td>
                            <td class="total-value">${formatByCurrency(r.refundAmount || (r.quantity * r.pricePerUnit), currency)}</td>
                            <td>${r.description || '-'}</td>
                            <td><span class="${statusClass}">${statusText}</span></td>
                        </tr>`;
                    }).join('')
                }</tbody>
            </table></div>
        </div>`;

    document.getElementById('content').innerHTML = html;
}

window.showReturnModal = function (itemName, maxQuantity, pricePerUnit, isPaid) {
    if (maxQuantity <= 0) { alert('No stock available to return!'); return; }
    let paymentNote = isPaid 
        ? '<div style="background:#f0fdf4;padding:10px;border-radius:8px;margin-bottom:10px;color:#166534;"><i class="fas fa-check-circle"></i> This item is <strong>PAID</strong> - return will credit your account</div>'
        : '<div style="background:#fef3c7;padding:10px;border-radius:8px;margin-bottom:10px;color:#92400e;"><i class="fas fa-exclamation-triangle"></i> This item is <strong>UNPAID</strong> - return will remove shipment debt</div>';
    
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Return Item: ${itemName}</h3><button onclick="closeModal()">&times;</button></div>
        ${paymentNote}
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
        <input type="hidden" id="returnIsPaid" value="${isPaid ? '1' : '0'}">
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
    let isPaid = document.getElementById('returnIsPaid').value === '1';
    let branch = currentUser.username;
    if (!quantity || quantity < 1) { alert('Please enter a valid quantity'); return; }

    let branchItems = (branchInventory[branch] || []).filter(i => i.name === itemName);
    let currentStock = branchItems.reduce((sum, i) => sum + i.quantity, 0);
    if (quantity > currentStock) { alert(`You only have ${currentStock} units available.`); return; }

    try {
        const response = await fetch('/api/returns', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                date: getTodayDate(), branch, item_name: itemName, 
                quantity, price_per_unit: pricePerUnit, description, 
                status: 'pending', is_paid: isPaid 
            })
        });
        if (response.ok) {
            const newReturn = await response.json();
            branchReturns.push({ id: newReturn.id, date: getTodayDate(), branch, itemName, quantity, pricePerUnit, description, status: 'pending', isPaid });
            closeModal();
            renderBranchReturns();
            alert(`✅ Return request submitted for ${quantity} x ${itemName}.\n${isPaid ? 'Waiting for approval and refund.' : 'Waiting for approval - shipment debt will be removed.'}`);
        } else alert('Failed to submit return: ' + (await response.json()).error);
    } catch (err) { alert('Failed to submit return. Make sure server is running.'); }
};


// ==================== BRANCH COMPLETE REPORT ====================
function renderBranchCompleteReport() {
    let branch = currentUser.username;
    let inventory = branchInventory[branch] || [];
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);

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
        <div style="background:#f0fdf4;border-radius:16px;padding:16px;margin-bottom:20px;border:2px solid #bbf7d0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
            <label style="color:#166534;font-weight:600;"><i class="fas fa-calendar" style="margin-right:6px;"></i>Time Period:</label>
            <select id="branchReportTimeFilter" onchange="applyBranchTimeFilter()" style="padding:10px 16px;border:2px solid #bbf7d0;border-radius:12px;background:white;color:#166534;font-weight:600;">
                <option value="all">All Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom Range</option>
            </select>
            <div id="branchReportCustomRange" style="display:none;gap:8px;align-items:center;flex-wrap:wrap;">
                <input type="date" id="branchReportStart" value="${getWeekAgoDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                <span style="color:#166534;">to</span>
                <input type="date" id="branchReportEnd" value="${getTodayDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
                <button onclick="applyBranchTimeFilter()" class="btn-filter" style="width:auto;margin-top:0;padding:10px 16px;">Apply</button>
            </div>
        </div>
        <div class="search-container">
            <div class="search-box"><i class="fas fa-search"></i>
                <input type="text" id="productSearchInput" placeholder="Search products..." onkeyup="searchBranchProducts()">
            </div>
            <div class="search-results" id="productSearchResults">Showing ${inventory.length} products</div>
        </div>
        <div id="branchReportDynamicContent"></div>`;

    document.getElementById('content').innerHTML = html;
    applyBranchTimeFilter();
}

window.applyBranchTimeFilter = function() {
    let filter = document.getElementById('branchReportTimeFilter')?.value || 'all';
    let customRange = document.getElementById('branchReportCustomRange');
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
        let s = document.getElementById('branchReportStart')?.value;
        let e = document.getElementById('branchReportEnd')?.value;
        if (!s || !e) return;
        startDate = new Date(s); endDate = new Date(e);
        endDate.setHours(23, 59, 59, 999);
    }

    renderBranchReportContent(startDate, endDate, filter);
};

function renderBranchReportContent(startDate, endDate, filter) {
    let branch = currentUser.username;
    let inventory = branchInventory[branch] || [];
    let allShipments = mainClientToBranchShipments.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let allSales = salesHistory.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let allReturns = getBranchReturns(branch).map(r => {
        let item = mainInventory.find(mi => mi.name === r.itemName);
        return { ...r, currency: item ? (item.currency || 'AFG') : 'AFG' };
    });
    let expensesList = branchExpenses[branch] || [];

    let isAll = filter === 'all';
    let filteredShipments = isAll ? allShipments : allShipments.filter(s => {
        let d = new Date(s.date); d.setHours(0,0,0,0);
        return d >= startDate && d <= endDate;
    });
    let filteredSales = isAll ? allSales : allSales.filter(s => {
        let d = new Date(s.date); d.setHours(0,0,0,0);
        return d >= startDate && d <= endDate;
    });
    let filteredReturns = isAll ? allReturns : allReturns.filter(r => {
        let d = new Date(r.date); d.setHours(0,0,0,0);
        return d >= startDate && d <= endDate;
    });
    let filteredExpenses = isAll ? expensesList : expensesList.filter(e => {
        let d = new Date(e.date); d.setHours(0,0,0,0);
        return d >= startDate && d <= endDate;
    });

    function buildCurrencyBlock(currency) {
        let fmt = (v) => formatByCurrency(v, currency);
        let inv = inventory.filter(i => getItemCurrency(i.name) === currency);
        let currentStock = inv.reduce((sum, i) => sum + (i.quantity || 0), 0);
        let currentStockValue = inv.reduce((sum, i) => sum + ((i.sellingPrice || 0) * (i.quantity || 0)), 0);

        let shipCur = filteredShipments.filter(s => s.currency === currency);
        let totalReceived = shipCur.reduce((sum, s) => sum + (s.qty || 0), 0);
        let totalReceivedValue = shipCur.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);

        let salesCur = filteredSales.filter(s => s.currency === currency);
        let totalSaleAmount = salesCur.reduce((sum, s) => sum + (s.revenue || 0), 0);

        let returnsCur = filteredReturns.filter(r => r.currency === currency);
        let approvedReturns = returnsCur.filter(r => r.status === 'approved' || r.status === 'paid');
        let totalReturns = approvedReturns.reduce((sum, r) => sum + (r.quantity || 0), 0);
        let totalReturnsValue = approvedReturns.reduce((sum, r) => sum + ((r.quantity || 0) * (r.pricePerUnit || 0)), 0);
        let pendingReturns = returnsCur.filter(r => r.status === 'pending').length;

        let expCur = filteredExpenses.filter(e => (e.currency||'AFG') === currency);
        let totalExpenses = expCur.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        let netProfit = totalSaleAmount - totalExpenses;

        return `
        <div class="report-grid">
            <div class="report-card">
                <h3><i class="fas fa-boxes"></i> Inventory Summary</h3>
                <div class="report-number">${currentStock}</div>
                <div class="report-label">Items Remaining</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;"><span>Stock Value (Selling):</span><span><strong>${fmt(currentStockValue)}</strong></span></div>
                </div>
            </div>
            <div class="report-card">
                <h3><i class="fas fa-truck"></i> Received</h3>
                <div class="report-number">${totalReceived}</div>
                <div class="report-label">Items Received</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;"><span>Value:</span><span><strong>${fmt(totalReceivedValue)}</strong></span></div>
                </div>
            </div>
            <div class="report-card">
                <h3><i class="fas fa-undo-alt"></i> Returns Summary</h3>
                <div class="report-number">${totalReturns}</div>
                <div class="report-label">Items Returned</div>
                <div style="margin-top:20px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Return Value:</span><span><strong>${fmt(totalReturnsValue)}</strong></span></div>
                    <div style="display:flex;justify-content:space-between;"><span>Pending Returns:</span><span><strong style="color:#f59e0b;">${pendingReturns}</strong></span></div>
                </div>
            </div>
        </div>
        <div class="stat-card" style="background:${netProfit>=0?'linear-gradient(145deg,#22c55e,#16a34a)':'linear-gradient(145deg,#ef4444,#b91c1c)'};color:white;margin-bottom:30px;">
            <i class="fas fa-cash-register" style="color:white;"></i>
            <h4 style="color:rgba(255,255,255,0.8);">Total Sale / Net (Sale - Expenses)</h4>
            <div class="stat-value" style="color:white;font-size:32px;">${fmt(totalSaleAmount)}</div>
            <small style="color:rgba(255,255,255,0.7);">Net after expenses: ${fmt(netProfit)}</small>
        </div>`;
    }

    let html = `
        <h3 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
        ${buildCurrencyBlock('AFG')}
        <h3 style="margin:30px 0 15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
        ${buildCurrencyBlock('USD')}

        <h3 style="margin:30px 0 20px;">Product Details</h3>
        <div id="productDetailsList">${renderProductDetails(inventory, filteredShipments, branch, allShipments)}</div>
        <h3 style="margin:30px 0 20px;">Return History</h3>
        <div class="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Item</th><th>Currency</th><th>Quantity</th><th>Price/Unit</th><th>Total Value</th><th>Description</th><th>Status</th></tr></thead>
            <tbody>${filteredReturns.length === 0
                ? `<tr><td colspan="8" style="text-align:center;">No returns yet</td></tr>`
                : filteredReturns.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => `
                    <tr>
                        <td>${r.date}</td><td>${r.itemName}</td>
                        <td><span class="badge ${r.currency==='USD'?'badge-mainclient':'badge-active'}">${r.currency}</span></td>
                        <td>${r.quantity}</td>
                        <td>${formatByCurrency(r.pricePerUnit, r.currency)}</td><td>${formatByCurrency(r.totalValue, r.currency)}</td>
                        <td>${r.description || '-'}</td>
                        <td><span class="${r.status === 'paid' ? 'return-badge-paid' : (r.status === 'approved' ? 'return-badge-approved' : (r.status === 'rejected' ? 'return-badge-rejected' : 'return-badge-pending'))}">${r.status.toUpperCase()}</span></td>
                    </tr>`).join('')
            }</tbody>
        </table></div>`;

    let container = document.getElementById('branchReportDynamicContent');
    if (container) container.innerHTML = html;
}

function renderProductDetails(inventory, shipments, branch, allShipmentsForNames) {
    let sourceForNames = allShipmentsForNames || shipments;

    let groupedInventory = {};
    inventory.forEach(item => {
        if (!groupedInventory[item.name]) {
            groupedInventory[item.name] = { name: item.name, quantity: 0 };
        }
        groupedInventory[item.name].quantity += item.quantity;
    });


    sourceForNames.forEach(s => {
        if (!groupedInventory[s.item]) {
            groupedInventory[s.item] = { name: s.item, quantity: 0 };
        }
    });

        if (Object.keys(groupedInventory).length === 0) return '<p style="text-align:center;color:#64748b;">No products in inventory</p>';

        let sortedItemNames = Object.keys(groupedInventory).sort((a, b) => {
            let shipmentsA = shipments.filter(s => s.item === a);
            let shipmentsB = shipments.filter(s => s.item === b);
            let latestA = shipmentsA.length > 0 ? Math.max(...shipmentsA.map(s => new Date(s.date).getTime())) : 0;
            let latestB = shipmentsB.length > 0 ? Math.max(...shipmentsB.map(s => new Date(s.date).getTime())) : 0;
            return latestB - latestA;
        });

        let rows = sortedItemNames.map((name, index) => {
            let item = groupedInventory[name];        let currency = getItemCurrency(item.name);
            let fmt = (v) => formatByCurrency(v, currency);

            let itemShipments = shipments.filter(s => s.item === item.name);
            let totalReceived = itemShipments.reduce((sum, s) => sum + (s.qty || 0), 0);
            let itemSales = salesHistory.filter(s => s.branch === branch && s.item === item.name);
            let sold = itemSales.reduce((sum, s) => sum + s.qty, 0);

        let itemReturns = branchReturns.filter(r => {
            let returnBranch = r.branch || r.branchName;
            let returnItem = r.itemName || r.item;
            let isApproved = r.status === 'approved' || r.status === 'paid';
            return returnBranch === branch && returnItem === item.name && isApproved;
        });
        let returnedQty = itemReturns.reduce((sum, r) => sum + (r.quantity || 0), 0);

        let discount = getItemDiscount(item.name);
        let uniqueId = `product-${branch}-${item.name.replace(/\s+/g, '-')}-${index}`;

        let sellingPricePerUnit = itemShipments.length > 0 ? itemShipments[itemShipments.length - 1].sellingPrice : 0;
        let totalSellingPrice = sellingPricePerUnit * item.quantity;

        return `
            <tr>
                <td>${item.name}${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : ''}</td>
                <td><span class="badge ${currency==='USD'?'badge-mainclient':'badge-active'}">${currency}</span></td>
                <td>${totalReceived}</td>
                <td style="color:#22c55e;">${sold}</td>
                <td style="color:#f59e0b;">${returnedQty}</td>
                <td>${item.quantity}</td>
                <td>${fmt(sellingPricePerUnit)}</td>
                <td class="profit-text">${fmt(totalSellingPrice)}</td>
            </tr>`;
    });

    return `<div class="table-wrapper"><table class="inventory-table">
        <thead><tr><th>Item Name</th><th>Currency</th><th>Received</th><th>Sold</th><th>Returned</th><th>In Stock</th><th>Selling Price/Unit</th><th>Total Selling Price</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
    </table></div>`;
}


window.searchBranchProducts = function () {
    let branch = currentUser.username;
    let inventory = branchInventory[branch] || [];
    let allShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let searchTerm = document.getElementById('productSearchInput').value.toLowerCase();

    let namesSet = new Set();
    inventory.forEach(i => namesSet.add(i.name));
    allShipments.forEach(s => namesSet.add(s.item));
    let allNames = Array.from(namesSet).filter(n => n.toLowerCase().includes(searchTerm));

    let filteredInv = inventory.filter(item => allNames.includes(item.name));
    let filteredShipmentsForNames = allShipments.filter(s => allNames.includes(s.item));

    document.getElementById('productDetailsList').innerHTML = renderProductDetails(filteredInv, allShipments, branch, filteredShipmentsForNames);
    document.getElementById('productSearchResults').innerHTML = `Showing ${allNames.length} products`;
};

function applyBranchTimeFilter() { renderBranchCompleteReport(); }