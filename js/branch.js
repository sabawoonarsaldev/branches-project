// ==================== branch.js ====================
// Branch: inventory، sale، billing، expenses

// ==================== BRANCH INVENTORY ====================
async function renderBranchInventory() {
    let branch = currentUser.username;
    await refreshDataFromServer();
    let items = branchInventory[branch] || [];
    let lowStockItems = items.filter(item => item.quantity < 10);

    let html = `
        <div class="header-actions">
            <h2 class="page-title">My Inventory</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="search-container">
            <div class="search-box"><i class="fas fa-search"></i>
                <input type="text" id="branchSearchInput" placeholder="Search items by name..." onkeyup="searchBranchInventory()">
            </div>
            <div class="search-results" id="branchSearchResults">Showing ${items.length} items</div>
        </div>`;

    if (items.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No Items in Inventory</h3><p>Wait for main client to distribute items to your branch</p></div>`;
    } else {
        if (lowStockItems.length > 0) {
            html += `<div class="alert-box"><i class="fas fa-exclamation-triangle"></i><strong>Warning:</strong> You have ${lowStockItems.length} item(s) with low stock</div>`;
        }
        html += `<div class="table-wrapper"><table class="inventory-table">
            <thead><tr><th>#</th><th>Item Name</th><th>Initial Stock</th><th>Current Stock</th><th>Selling Price</th><th>Discount</th><th>Total Value</th><th>Payment Status</th><th>Remaining Payment</th><th>Receive Status</th><th>Actions</th></tr></thead>
            <tbody id="branchInventoryTableBody">${renderBranchInventoryRows(items)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderBranchInventoryRows(items) {
    let branch = currentUser.username;
    if (!items || items.length === 0) return '<tr><td colspan="11" style="text-align:center;">No items in inventory</td></tr>';

    return items.map((item, index) => {
        let isLowStock = item.quantity < 10;
        let discount = getItemDiscount(item.name);
        let currentStock = item.quantity;
        let initialStock = (item.originalQuantity && item.originalQuantity >= item.quantity) ? item.originalQuantity : item.quantity;
        let totalValue = (item.sellingPrice || 0) * currentStock;
        let uniqueId = item.distributionId || `item_${item.id}_${Date.now()}_${index}`;
        let shipmentDate = item.shipmentDate || item.distributionDate || getTodayDate();

        let originalShipment = mainClientToBranchShipments.find(s => s.branch === branch && s.uniqueKey === uniqueId);
        let paymentStatus = originalShipment ? getShipmentStatus(originalShipment) : 'unpaid';
        let isPaid = paymentStatus === 'paid';

        let storageKey = `branch_received_${branch}_${uniqueId}`;
        let isMarkedReceived = localStorage.getItem(storageKey) === 'true';
        if (!isMarkedReceived && originalShipment) {
            let shipmentId = generateMainClientToBranchShipmentId(originalShipment);
            isMarkedReceived = shipmentReminders[shipmentId + '_received'] === true;
        }

        let paymentBadge = isPaid ? '<span class="badge badge-paid">PAID</span>' : (paymentStatus === 'partial' ? '<span class="badge badge-partial">PARTIAL</span>' : '<span class="badge badge-unpaid">UNPAID</span>');

        let remainingValue = 0;
        if (originalShipment) {
            let totalPrice = (originalShipment.sellingPrice || 0) * (originalShipment.qty || 0);
            remainingValue = Math.max(0, totalPrice - getShipmentPaidAmount(originalShipment));
        }

        let receiveBadge = isMarkedReceived
            ? '<span class="badge badge-paid" style="background:#22c55e;">✓ Received</span>'
            : '<span class="badge badge-warning" style="background:#f59e0b;">⏳ Pending</span>';

        let remainingPercent = initialStock > 0 ? Math.round((currentStock / initialStock) * 100) : 0;
        let stockBarColor = remainingPercent > 50 ? '#22c55e' : (remainingPercent > 20 ? '#f59e0b' : '#ef4444');
        let rowStyle = isLowStock ? 'style="background:#fff5f5;"' : '';

        return `<tr ${rowStyle}>
            <td>${index + 1}</td>
            <td>
                ${escapeHtml(item.name)}
                ${isLowStock ? '<span class="badge badge-frozen" style="background:#ef4444;">Low Stock!</span>' : ''}
                ${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : ''}
                <br><small style="color:#64748b;">ID: ${uniqueId.substring(0, 8)}...</small>
                <br><small style="color:#64748b;">Received: ${shipmentDate}</small>
            </td>
            <td class="original-stock" style="background:#f0fdf4;font-weight:bold;"><strong>${initialStock}</strong> <small>(Initial)</small></td>
            <td class="remaining-stock" style="background:#fef3c7;">
                <strong>${currentStock}</strong> <small>(Current)</small>
                <div style="width:100%;background:#e2e8f0;border-radius:10px;margin-top:5px;height:6px;">
                    <div style="width:${remainingPercent}%;background:${stockBarColor};border-radius:10px;height:6px;"></div>
                </div>
            </td>
            <td>${formatMoney(item.sellingPrice)}</td>
            <td>${discount ? `<span class="discount-badge">-${discount.discountPercent}%</span>` : '-'}</td>
            <td class="total-value">${formatMoney(totalValue)}</td>
            <td>${paymentBadge}</td>
            <td class="reminder-amount ${remainingValue > 0 ? 'unpaid-value' : 'paid-value'}">${formatMoney(remainingValue)}</td>
            <td style="text-align:center;">${receiveBadge}</td>
            <td>
                ${!isMarkedReceived
                    ? `<button class="btn btn-success" onclick="markSpecificShipmentAsReceived('${uniqueId}','${escapeHtml(item.name)}',${currentStock},'${shipmentDate}')" style="width:100%;margin-bottom:5px;"><i class="fas fa-check"></i> Receive</button>`
                    : '<span class="badge badge-paid" style="display:block;text-align:center;margin-bottom:5px;">✓ Received</span>'
                }
                <button class="btn btn-warning" onclick="lowStockAlert('${uniqueId}','${escapeHtml(item.name)}',${currentStock})" style="width:100%;"><i class="fas fa-bell"></i> Alert</button>
            </td>
        </tr>`;
    }).join('');
}

window.searchBranchInventory = function () {
    let branch = currentUser.username;
    let items = branchInventory[branch] || [];
    let searchTerm = document.getElementById('branchSearchInput').value.toLowerCase();
    let filtered = items.filter(item => item.name.toLowerCase().includes(searchTerm));
    document.getElementById('branchInventoryTableBody').innerHTML = renderBranchInventoryRows(filtered);
    document.getElementById('branchSearchResults').innerHTML = `Showing ${filtered.length} of ${items.length} items`;
};

window.markSpecificShipmentAsReceived = async function (uniqueId, itemName, qty, shipmentDate) {
    if (confirm(`Have you received ${qty} x ${itemName} from shipment dated ${shipmentDate}?`)) {
        let branch = currentUser.username;
        try {
            await markShipmentAsReceived(uniqueId, branch, itemName);
            localStorage.setItem(`branch_received_${branch}_${uniqueId}`, 'true');
            let shipment = mainClientToBranchShipments.find(s => s.uniqueKey === uniqueId);
            if (shipment) {
                let shipmentId = generateMainClientToBranchShipmentId(shipment);
                shipmentReminders[shipmentId + '_received'] = true;
            }
            saveData();
            await renderBranchInventory();
            showSmallAlert(`✅ ${qty} x ${itemName} received!`);
        } catch (error) { showSmallAlert('❌ Failed to mark as received'); }
    }
};

window.lowStockAlert = async function (uniqueId, itemName, currentQuantity) {
    let branch = currentUser.username;
    let alertMessage = `Low stock alert for ${itemName}. Current stock: ${currentQuantity} units.`;
    try {
        const response = await fetch('/api/alerts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch, item_name: itemName, quantity: currentQuantity, message: alertMessage, date: getTodayDate() })
        });
        if (response.ok) {
            const newAlert = await response.json();
            lowStockAlerts.push({ id: newAlert.id, branch, itemName, quantity: currentQuantity, date: getTodayDate(), message: alertMessage, resolved: false });
            showSmallAlert(`✅ Alert sent for "${itemName}"`);
            let btn = event?.target;
            if (btn) {
                let originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Sent!';
                btn.style.background = '#22c55e';
                setTimeout(() => { btn.innerHTML = originalText; btn.style.background = 'linear-gradient(145deg,#f59e0b,#d97706)'; }, 1500);
            }
        } else { showSmallAlert('❌ Failed to send alert'); }
    } catch (err) { showSmallAlert('❌ Failed to send alert'); }
};

function showSmallAlert(message) {
    let alertDiv = document.createElement('div');
    alertDiv.style.cssText = `position:fixed;bottom:20px;right:20px;background:#22c55e;color:white;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:fadeInOut 2s ease;`;
    alertDiv.innerHTML = message;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 2000);
}

const _branchAlertStyle = document.createElement('style');
_branchAlertStyle.textContent = `@keyframes fadeInOut{0%{opacity:0;transform:translateY(20px)}15%{opacity:1;transform:translateY(0)}85%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(20px)}}`;
document.head.appendChild(_branchAlertStyle);

// ==================== BRANCH SALE ====================
async function renderBranchSale() {
    let branch = currentUser.username;
    await refreshDataFromServer();
    let items = branchInventory[branch] || [];

    let groupedItems = {};
    items.forEach(item => {
        let key = item.name;
        if (!groupedItems[key]) groupedItems[key] = { id: item.id, name: item.name, quantity: 0, sellingPrice: item.sellingPrice, purchasePrice: item.purchasePrice };
        groupedItems[key].quantity += item.quantity;
    });
    let groupedItemsArray = Object.values(groupedItems);

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Record Sale</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>`;

    if (groupedItemsArray.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-cash-register"></i><h3>No Items to Sell</h3><p>Your inventory is empty.</p></div>`;
    } else {
        let options = groupedItemsArray.map(i => {
            let discount = getItemDiscount(i.name);
            let displayPrice = i.sellingPrice;
            let originalPrice = discount ? discount.originalPrice : i.sellingPrice;
            let priceDisplay = discount ? `${formatMoney(originalPrice)} → ${formatMoney(displayPrice)}` : formatMoney(displayPrice);
            return `<option value="${i.id}" data-price="${displayPrice}" data-original="${originalPrice}" data-purchase="${i.purchasePrice}" data-name="${i.name}" data-quantity="${i.quantity}" data-discount="${discount ? discount.discountPercent : 0}">
                ${i.name} (Stock: ${i.quantity}) - ${priceDisplay}${discount ? ` [${discount.discountPercent}% OFF]` : ''}
            </option>`;
        }).join('');

        html += `
            <div style="background:#f8fafc;padding:32px;border-radius:24px;">
                <div class="alert-box" style="margin-bottom:20px;background:#f0f9ff;border-color:#38bdf8;">
                    <i class="fas fa-info-circle"></i><strong>Note:</strong> Selling price is fixed based on admin settings.
                </div>
                <div class="form-group"><label>Bill Number (Invoice Number)</label>
                    <input type="text" id="billNumber" placeholder="Enter bill number (e.g., INV-001)" required>
                    <small style="color:#64748b;">Enter a unique bill number for this sale</small>
                </div>
                <div class="form-group"><label>Select Product</label>
                    <select id="saleItem" onchange="updateSaleDetails()">${options}</select>
                </div>
                <div id="discountInfo" style="display:none;background:#fef2f2;padding:15px;border-radius:12px;margin:15px 0;border:1px solid #fecaca;">
                    <div style="display:flex;align-items:center;gap:10px;"><i class="fas fa-tag" style="color:#ef4444;"></i><span style="color:#991b1b;font-weight:600;">Special Discount Applied!</span></div>
                    <div style="margin-top:8px;color:#7f1d1d;">Original Price: <span id="originalPriceDisplay"></span><br>You save: <span id="savingsDisplay"></span></div>
                </div>
                <div class="form-group"><label>Quantity</label><input type="number" id="saleQty" min="1" value="1" onchange="calculateSaleTotal()"></div>
                <div class="form-group"><label>Selling Price (AFG) - Fixed</label><input type="number" id="salePrice" step="0.01" readonly style="background:#f1f5f9;cursor:not-allowed;"></div>
                <div class="form-group"><label>Total Amount</label><input type="text" id="saleTotal" value="AFG 0.00" readonly style="background:#f1f5f9;font-weight:700;color:#166534;"></div>
                <button class="action-btn" onclick="recordSale()" id="saleBtn" style="width:100%;"><i class="fas fa-cash-register"></i> Record Sale</button>
            </div>`;
    }
    document.getElementById('content').innerHTML = html;
    if (groupedItemsArray.length > 0) setTimeout(() => updateSaleDetails(), 100);
}

window.updateSaleDetails = function () {
    let select = document.getElementById('saleItem');
    if (!select || select.options.length === 0) return;
    let opt = select.options[select.selectedIndex];
    let price = parseFloat(opt.dataset.price);
    let originalPrice = parseFloat(opt.dataset.original);
    let discountPercent = parseInt(opt.dataset.discount);
    let availableQty = parseInt(opt.dataset.quantity);

    let priceInput = document.getElementById('salePrice');
    if (priceInput) priceInput.value = price;

    let qtyInput = document.getElementById('saleQty');
    if (qtyInput) { qtyInput.max = availableQty; if (parseInt(qtyInput.value) > availableQty) qtyInput.value = availableQty; }

    let discountInfo = document.getElementById('discountInfo');
    if (discountInfo) {
        if (discountPercent > 0) {
            discountInfo.style.display = 'block';
            if (document.getElementById('originalPriceDisplay')) document.getElementById('originalPriceDisplay').innerHTML = formatMoney(originalPrice);
            if (document.getElementById('savingsDisplay')) document.getElementById('savingsDisplay').innerHTML = `${formatMoney(originalPrice - price)} (${discountPercent}%)`;
        } else { discountInfo.style.display = 'none'; }
    }
    calculateSaleTotal();
};

window.calculateSaleTotal = function () {
    let qtyInput = document.getElementById('saleQty');
    let priceInput = document.getElementById('salePrice');
    let totalInput = document.getElementById('saleTotal');
    let select = document.getElementById('saleItem');
    let saleBtn = document.getElementById('saleBtn');
    if (!qtyInput || !priceInput || !totalInput) return;

    let qty = parseInt(qtyInput.value) || 0;
    let price = parseFloat(priceInput.value) || 0;
    totalInput.value = formatMoney(qty * price);

    if (select && select.selectedIndex > 0) {
        let maxQty = parseInt(select.options[select.selectedIndex].dataset.quantity) || 0;
        if (qty < 1 || qty > maxQty) { qtyInput.style.borderColor = '#ef4444'; if (saleBtn) saleBtn.disabled = true; }
        else { qtyInput.style.borderColor = '#bbf7d0'; if (saleBtn) saleBtn.disabled = false; }
    }
};

window.recordSale = async function () {
    let branch = currentUser.username;
    let select = document.getElementById('saleItem');
    if (!select || select.selectedIndex === -1) { showSmallAlert('Please select an item'); return; }

    let opt = select.options[select.selectedIndex];
    let sellingPrice = parseFloat(opt.dataset.price);
    let itemName = opt.dataset.name;
    let purchasePrice = parseFloat(opt.dataset.purchase);
    let qty = parseInt(document.getElementById('saleQty').value);
    let billNumber = document.getElementById('billNumber').value.trim();

    if (!billNumber) { showSmallAlert('Please enter a Bill Number'); return; }

    let itemsToSell = branchInventory[branch].filter(i => i.name === itemName);
    let totalAvailable = itemsToSell.reduce((sum, i) => sum + i.quantity, 0);
    if (totalAvailable < qty) { showSmallAlert(`Insufficient stock! Available: ${totalAvailable}`); return; }

    let remainingQty = qty;
    for (let item of itemsToSell) {
        if (remainingQty <= 0) break;
        let takeFromThis = Math.min(item.quantity, remainingQty);
        let newQuantity = item.quantity - takeFromThis;
        try {
            const updateResponse = await fetch(`/api/branch-inventory/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: newQuantity }) });
            if (updateResponse.ok) item.quantity = newQuantity;
        } catch (err) { console.error('Error updating branch inventory:', err); }
        remainingQty -= takeFromThis;
    }
    branchInventory[branch] = branchInventory[branch].filter(i => i.quantity > 0);

    let revenue = qty * sellingPrice;
    let cost = qty * purchasePrice;
    let profit = revenue - cost;

    try {
        const saleResponse = await fetch('/api/sales', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: getTodayDate(), branch, item: itemName, qty, price: sellingPrice, purchase_price: purchasePrice, revenue, cost, profit, bill_number: billNumber })
        });
        if (!saleResponse.ok) throw new Error('Failed to save sale');

        salesHistory.push({ id: salesHistory.length + 1, date: getTodayDate(), branch, item: itemName, qty, price: sellingPrice, purchasePrice, revenue, cost, profit, billNumber });
        if (!branchBills[branch]) branchBills[branch] = {};
        if (!branchBills[branch][billNumber]) branchBills[branch][billNumber] = [];
        branchBills[branch][billNumber].push({ date: getTodayDate(), item: itemName, qty, price: sellingPrice, revenue });
        if (!branchFinance[branch]) branchFinance[branch] = { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalLoss: 0, totalExpenses: 0 };
        branchFinance[branch].totalSale += revenue;
        branchFinance[branch].totalProfit += profit;
        saveData(); recalcMainFinance();
        showSmallAlert(`✅ Sale recorded! ${itemName} x${qty} = ${formatMoney(revenue)}`);
        await renderBranchSale();
    } catch (error) { showSmallAlert('❌ Failed to record sale: ' + error.message); }
};

// ==================== BRANCH BILLING ====================
async function renderBranchBilling() {
    let branch = currentUser.username;
    try {
        const response = await fetch(`/api/sales/${branch}`);
        if (response.ok) {
            const salesData = await response.json();
            let bills = {};
            salesData.forEach(sale => {
                if (!bills[sale.bill_number]) bills[sale.bill_number] = [];
                bills[sale.bill_number].push({ date: sale.date.split('T')[0], item: sale.item, qty: sale.qty, price: parseFloat(sale.price), revenue: parseFloat(sale.revenue) });
            });
            branchBills[branch] = bills;
        }
    } catch (err) { console.log('Error loading bills:', err); }

    let bills = branchBills[branch] || {};
    let billNumbers = Object.keys(bills).sort((a, b) => {
        let dateA = bills[a][0]?.date || ''; let dateB = bills[b][0]?.date || '';
        return new Date(dateB) - new Date(dateA);
    });

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Bill Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="branch-selector" style="margin-bottom:30px;flex-direction:column;">
            <div class="form-group" style="width:100%;"><label><i class="fas fa-receipt"></i> Select Bill Number</label>
                <select id="billNumberSelect" onchange="loadBillDetails()" style="width:100%;padding:12px;">
                    <option value="">-- Select a bill number --</option>
                    ${billNumbers.map(bill => {
                        let billDate = bills[bill][0]?.date || 'Unknown date';
                        let totalPrice = bills[bill].reduce((sum, item) => sum + item.revenue, 0);
                        return `<option value="${bill}">${bill} - ${formatMoney(totalPrice)} (${billDate})</option>`;
                    }).join('')}
                </select>
            </div>
            <button class="btn-filter" onclick="loadBillDetails()" style="margin-top:10px;width:200px;"><i class="fas fa-search"></i> Load Bill</button>
        </div>
        <div id="billDetailsContainer" style="display:none;"></div>`;

    if (billNumbers.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-receipt"></i><h3>No Bills Yet</h3><p>Start selling items with bill numbers to see them here.</p><button class="action-btn" onclick="showSection('branchSale')" style="margin-bottom:0;"><i class="fas fa-cash-register"></i> Go to Sell Items</button></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function loadBillDetails() {
    let branch = currentUser.username;
    let billNumber = document.getElementById('billNumberSelect').value;
    if (!billNumber) { alert('Please select a bill number'); return; }

    let bills = branchBills[branch] || {};
    let billItems = bills[billNumber] || [];
    if (billItems.length === 0) {
        document.getElementById('billDetailsContainer').innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No Items Found</h3></div>`;
        document.getElementById('billDetailsContainer').style.display = 'block';
        return;
    }

    let totalItems = billItems.reduce((sum, item) => sum + item.qty, 0);
    let totalPrice = billItems.reduce((sum, item) => sum + item.revenue, 0);

    document.getElementById('billDetailsContainer').style.display = 'block';
    document.getElementById('billDetailsContainer').innerHTML = `
        <div class="payment-summary" style="margin-bottom:20px;">
            <h3><i class="fas fa-receipt"></i> Bill Details: ${billNumber}</h3>
            <div class="summary-stats">
                <div class="summary-item"><div class="label">Total Items</div><div class="value">${totalItems}</div></div>
                <div class="summary-item"><div class="label">Total Price</div><div class="value" style="color:#22c55e;">${formatMoney(totalPrice)}</div></div>
                <div class="summary-item"><div class="label">Number of Products</div><div class="value">${billItems.length}</div></div>
                <div class="summary-item"><div class="label">Date</div><div class="value">${billItems[0]?.date || '-'}</div></div>
            </div>
        </div>
        <div class="table-wrapper"><table>
            <thead><tr><th>Item Name</th><th>Quantity</th><th>Selling Price</th><th>Total Price</th></tr></thead>
            <tbody>${billItems.map(item => `<tr><td>${escapeHtml(item.item)}</td><td>${item.qty}</td><td>${formatMoney(item.price)}</td><td class="total-value">${formatMoney(item.revenue)}</td></tr>`).join('')}</tbody>
            <tfoot><tr class="grand-total"><td colspan="2"><strong>Grand Total</strong></td><td><strong>${formatMoney(totalPrice)}</strong></td><td></td></tr></tfoot>
        </table></div>
        <div style="text-align:center;margin-top:20px;">
            <button class="action-btn" onclick="printBill('${billNumber}')"><i class="fas fa-print"></i> Print Bill</button>
        </div>`;
}

function printBill(billNumber) {
    let branch = currentUser.username;
    let bills = branchBills[branch] || {};
    let billItems = bills[billNumber] || [];
    let customerName = prompt('Enter Customer Name:');
    if (!customerName) { alert('Customer name is required!'); return; }
    let customerPhone = prompt('Enter Customer Phone Number:');
    if (!customerPhone) { alert('Customer phone number is required!'); return; }

    let totalItems = billItems.reduce((sum, item) => sum + item.qty, 0);
    let totalPrice = billItems.reduce((sum, item) => sum + item.revenue, 0);

    let printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>Invoice - ${billNumber}</title><style>
        *{margin:0;padding:0;box-sizing:border-box;}body{font-family:'Segoe UI',sans-serif;background:#f1f5f9;padding:40px 20px;}
        .invoice-print{max-width:900px;margin:0 auto;background:white;border-radius:24px;box-shadow:0 20px 35px -10px rgba(0,0,0,0.1);overflow:hidden;}
        .invoice-header{background:linear-gradient(145deg,#166534,#14532d);color:white;padding:30px;text-align:center;}
        .invoice-header h2{font-size:28px;margin-bottom:8px;}.invoice-header h3{font-size:20px;font-weight:500;opacity:0.95;}
        .invoice-info{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:25px 30px;background:#f8fafc;border-bottom:2px solid #e2e8f0;}
        .invoice-info-item{text-align:center;}.invoice-info-item .label{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;}
        .invoice-info-item .value{font-size:16px;font-weight:600;color:#1e293b;}
        .invoice-table{width:100%;border-collapse:collapse;}.invoice-table th{background:#f1f5f9;padding:15px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;}
        .invoice-table td{padding:12px 15px;border-bottom:1px solid #e2e8f0;color:#334155;}.invoice-table .total-value{font-weight:600;color:#166534;}
        .invoice-table tfoot tr{background:#f8fafc;}.invoice-table tfoot td{padding:15px;font-weight:600;border-top:2px solid #e2e8f0;}
        .invoice-total{background:linear-gradient(145deg,#f0fdf4,#dcfce7);margin:20px 30px 30px 30px;padding:20px;border-radius:16px;text-align:right;font-size:24px;font-weight:700;color:#166534;border:2px solid #bbf7d0;}
        .invoice-footer{text-align:center;padding:25px 30px;background:#f8fafc;border-top:2px solid #e2e8f0;color:#64748b;font-size:13px;}
        @media print{body{background:white;padding:0;}.invoice-print{box-shadow:none;border-radius:0;}.no-print{display:none!important;}}
    </style></head><body>
        <div class="invoice-print">
            <div class="invoice-header"><h2>Haqyar Mangal Trading Company</h2><h3>Sales Invoice</h3><p style="margin-top:5px;color:#d1fae5;">${branch} Branch</p></div>
            <div class="invoice-info">
                <div class="invoice-info-item"><div class="label">Bill Number</div><div class="value">${billNumber}</div></div>
                <div class="invoice-info-item"><div class="label">Customer Name</div><div class="value">${escapeHtml(customerName)}</div></div>
                <div class="invoice-info-item"><div class="label">Customer Phone</div><div class="value">${escapeHtml(customerPhone)}</div></div>
                <div class="invoice-info-item"><div class="label">Date</div><div class="value">${new Date().toLocaleString()}</div></div>
            </div>
            <table class="invoice-table">
                <thead><tr><th>Item Name</th><th>Quantity</th><th>Price per Unit</th><th>Total Price</th></tr></thead>
                <tbody>${billItems.map(item => `<tr><td>${escapeHtml(item.item)}</td><td>${item.qty}</td><td>${formatMoney(item.price)}</td><td class="total-value">${formatMoney(item.revenue)}</td></tr>`).join('')}</tbody>
                <tfoot><tr><td colspan="3"><strong>Total Items: ${totalItems}</strong></td><td><strong>${formatMoney(totalPrice)}</strong></td></tr></tfoot>
            </table>
            <div class="invoice-total">Grand Total: ${formatMoney(totalPrice)}</div>
            <div class="invoice-footer"><p>Generated by ${branch} Branch</p><p>Thank you for your purchase!</p></div>
        </div>
        <div class="no-print" style="text-align:center;margin-top:20px;">
            <button onclick="window.print()" style="padding:12px 24px;background:linear-gradient(145deg,#22c55e,#16a34a);color:white;border:none;border-radius:12px;cursor:pointer;font-size:16px;font-weight:600;margin-right:10px;">Print</button>
            <button onclick="window.close()" style="padding:12px 24px;background:#64748b;color:white;border:none;border-radius:12px;cursor:pointer;font-size:16px;font-weight:600;">Close</button>
        </div>
    </body></html>`);
    printWindow.document.close();
}

// ==================== BRANCH EXPENSES ====================
async function renderBranchExpenses() {
    let branch = currentUser.username;
    let expensesList = [];
    try {
        const response = await fetch(`/api/expenses/branch/${branch}`);
        if (response.ok) {
            expensesList = (await response.json()).map(e => ({ id: e.id, date: e.date.split('T')[0], category: e.category, amount: parseFloat(e.amount), description: e.description }));
            branchExpenses[branch] = expensesList;
        } else expensesList = branchExpenses[branch] || [];
    } catch (err) { expensesList = branchExpenses[branch] || []; }

    let totalExpenses = expensesList.reduce((sum, exp) => sum + exp.amount, 0);
    let monthlyExpenses = calculateBranchMonthlyExpenses(expensesList);

    let html = `
        <div class="header-actions">
            <h2 class="page-title">My Expenses</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="expense-section">
            <div class="expense-header">
                <h3><i class="fas fa-money-bill-wave"></i> Expense Management</h3>
                <button class="btn btn-primary" onclick="showAddBranchExpenseModal()"><i class="fas fa-plus"></i> Add Expense</button>
            </div>
            <div class="stats-grid">
                <div class="stat-card expense-card"><i class="fas fa-file-invoice"></i><h4>Total Expenses</h4><div class="stat-value">${formatMoney(totalExpenses)}</div></div>
                <div class="stat-card"><i class="fas fa-calendar-alt"></i><h4>This Month</h4><div class="stat-value">${formatMoney(monthlyExpenses)}</div></div>
                <div class="stat-card"><i class="fas fa-chart-pie"></i><h4>Number of Expenses</h4><div class="stat-value">${expensesList.length}</div></div>
            </div>
            <h3 style="margin-bottom:20px;">Expense History</h3>
            <div id="branchExpenseList">`;

    if (expensesList.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No Expenses Yet</h3><button class="action-btn" onclick="showAddBranchExpenseModal()" style="margin-bottom:0;"><i class="fas fa-plus"></i> Add First Expense</button></div>`;
    } else {
        html += expensesList.sort((a, b) => new Date(b.date) - new Date(a.date)).map(exp => `
            <div class="expense-item">
                <div class="expense-details"><h4>${escapeHtml(exp.category)}</h4><p>${exp.date} - ${escapeHtml(exp.description)}</p></div>
                <div class="expense-amount">${formatMoney(exp.amount)}</div>
                <div class="expense-actions">
                    <button class="btn btn-edit" onclick="editBranchExpense(${exp.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-delete" onclick="deleteBranchExpense(${exp.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
    }
    html += `</div></div>`;
    document.getElementById('content').innerHTML = html;
}

function calculateBranchMonthlyExpenses(expensesList) {
    let d = new Date();
    return expensesList.filter(exp => { let e = new Date(exp.date); return e.getMonth() === d.getMonth() && e.getFullYear() === d.getFullYear(); }).reduce((sum, exp) => sum + exp.amount, 0);
}

window.showAddBranchExpenseModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="branchExpCategory"><option value="Rent">Rent</option><option value="Utilities">Utilities</option><option value="Transport">Transport</option><option value="Marketing">Marketing</option><option value="Salary">Salary</option><option value="Other">Other</option></select>
        </div>
        <div class="form-group"><label>Amount (AFG)</label><input type="number" id="branchExpAmount" step="0.01" value="0"></div>
        <div class="form-group"><label>Description</label><textarea id="branchExpDescription" rows="3" placeholder="Enter expense description"></textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="branchExpDate" value="${getTodayDate()}"></div>
        <button class="save-btn" onclick="saveBranchExpense()">Add Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.saveBranchExpense = async function () {
    let branch = currentUser.username;
    let newExpense = { date: document.getElementById('branchExpDate').value, category: document.getElementById('branchExpCategory').value, amount: parseFloat(document.getElementById('branchExpAmount').value), description: document.getElementById('branchExpDescription').value, user_role: 'branch', username: branch };
    if (isNaN(newExpense.amount) || newExpense.amount <= 0) { alert('Please enter a valid amount'); return; }
    const btn = document.querySelector('#modalContent .save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Please wait...'; }
    try {
        const response = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newExpense) });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed');
        const savedExpense = await response.json();
        if (!branchExpenses[branch]) branchExpenses[branch] = [];
        branchExpenses[branch].push({ id: savedExpense.id, date: newExpense.date, category: newExpense.category, amount: newExpense.amount, description: newExpense.description });
        if (!branchFinance[branch]) branchFinance[branch] = { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalLoss: 0, totalExpenses: 0 };
        branchFinance[branch].totalExpenses += newExpense.amount;
        saveData(); closeModal(); renderBranchExpenses(); alert('Expense added successfully!');
    } catch (error) {
        if (btn) { btn.disabled = false; btn.textContent = 'Add Expense'; }
        alert('Failed to add expense: ' + error.message);
    }
};

window.editBranchExpense = function (id) {
    let branch = currentUser.username;
    let exp = (branchExpenses[branch] || []).find(e => e.id === id);
    if (!exp) return;
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Expense</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Category</label>
            <select id="branchExpCategory"><option value="Rent" ${exp.category === 'Rent' ? 'selected' : ''}>Rent</option><option value="Utilities" ${exp.category === 'Utilities' ? 'selected' : ''}>Utilities</option><option value="Transport" ${exp.category === 'Transport' ? 'selected' : ''}>Transport</option><option value="Marketing" ${exp.category === 'Marketing' ? 'selected' : ''}>Marketing</option><option value="Salary" ${exp.category === 'Salary' ? 'selected' : ''}>Salary</option><option value="Other" ${exp.category === 'Other' ? 'selected' : ''}>Other</option></select>
        </div>
        <div class="form-group"><label>Amount (AFG)</label><input type="number" id="branchExpAmount" step="0.01" value="${exp.amount}"></div>
        <div class="form-group"><label>Description</label><textarea id="branchExpDescription" rows="3">${exp.description}</textarea></div>
        <div class="form-group"><label>Date</label><input type="date" id="branchExpDate" value="${exp.date}"></div>
        <button class="save-btn" onclick="updateBranchExpense(${id})">Update Expense</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateBranchExpense = async function (id) {
    let branch = currentUser.username;
    let exp = (branchExpenses[branch] || []).find(e => e.id === id);
    if (!exp) return;
    let updated = { date: document.getElementById('branchExpDate').value, category: document.getElementById('branchExpCategory').value, amount: parseFloat(document.getElementById('branchExpAmount').value), description: document.getElementById('branchExpDescription').value, user_role: 'branch', username: branch };
    try {
        const response = await fetch(`/api/expenses/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!response.ok) throw new Error('Failed to update');
        Object.assign(exp, { date: updated.date, category: updated.category, amount: updated.amount, description: updated.description });
        saveData(); closeModal(); renderBranchExpenses(); alert('Expense updated successfully!');
    } catch (error) { alert('Failed to update expense.'); }
};

window.deleteBranchExpense = async function (id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        let branch = currentUser.username;
        try {
            const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            branchExpenses[branch] = (branchExpenses[branch] || []).filter(e => e.id !== id);
            saveData(); renderBranchExpenses(); alert('Expense deleted successfully!');
        } catch (error) { alert('Failed to delete expense.'); }
    }
};