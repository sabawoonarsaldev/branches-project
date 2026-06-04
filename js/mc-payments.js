// ==================== mc-payments.js ====================
// Main Client: payments، billing، invoices، report، payment to admin

// ==================== MAIN CLIENT PAYMENTS ====================
async function renderMainClientPayments() {
    let branches = getBranchUsers();
    let today = getTodayDate();
    await refreshDataFromServer();

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Branch Payment Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="report-billing-section">
            <div class="filter-row">
                <div class="filter-group">
                    <label><i class="fas fa-code-branch"></i> Select Branch</label>
                    <select id="paymentBranchSelect" onchange="loadPaymentsByDate()">
                        <option value="">-- All Branches --</option>
                        ${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label><i class="fas fa-calendar-alt"></i> View Mode</label>
                    <select id="paymentViewMode" onchange="togglePaymentDateInput()">
                        <option value="date">By Date</option>
                        <option value="alltime">All Time</option>
                    </select>
                </div>
                <div class="filter-group" id="paymentDateGroup">
                    <label><i class="fas fa-calendar"></i> Select Date</label>
                    <input type="date" id="paymentDate" value="${today}" onchange="loadPaymentsByDate()">
                </div>
            </div>
            <button class="btn-filter" onclick="loadPaymentsByDate()"><i class="fas fa-filter"></i> Load Payments</button>
        </div>
        <div id="paymentsContainer" style="display:none;"></div>`;
    document.getElementById('content').innerHTML = html;
}

window.togglePaymentDateInput = function () {
    let mode = document.getElementById('paymentViewMode').value;
    document.getElementById('paymentDateGroup').style.display = mode === 'alltime' ? 'none' : 'block';
};

window.loadPaymentsByDate = async function () {
    let branch = document.getElementById('paymentBranchSelect').value;
    let mode = document.getElementById('paymentViewMode')?.value || 'date';
    let date = document.getElementById('paymentDate')?.value || getTodayDate();
    let selectedDate = formatDateForCompare(date);
    await refreshDataFromServer();

    let allShipments = branch ? mainClientToBranchShipments.filter(s => s.branch === branch) : [...mainClientToBranchShipments];
    let filteredShipments = (mode === 'alltime' ? allShipments : allShipments.filter(s => s.date === selectedDate)).map(s => {
        let totalPrice = s.sellingPrice * s.qty;
        let paidAmount = Math.min((s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : getShipmentPaidAmount(s), totalPrice);
        let unpaidAmount = Math.max(0, totalPrice - paidAmount);
        let status = paidAmount >= totalPrice ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
        return { ...s, totalPrice, paidAmount, unpaidAmount, status };
    });
    displayPayments(filteredShipments, selectedDate, branch, mode);
};

function displayPayments(shipments, selectedDate, selectedBranch, mode = 'date') {
    let processedShipments = shipments.map(s => {
        let totalPrice = s.sellingPrice * s.qty;
        let paidAmount = Math.min(s.paidAmount || 0, totalPrice);
        let unpaidAmount = Math.max(0, totalPrice - paidAmount);
        let status = paidAmount >= totalPrice ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
        return { ...s, totalPrice, paidAmount, unpaidAmount, status };
    });

    let totalValue = processedShipments.reduce((sum, s) => sum + s.totalPrice, 0);
    let totalPaid = processedShipments.reduce((sum, s) => sum + s.paidAmount, 0);
    let totalUnpaid = processedShipments.reduce((sum, s) => sum + s.unpaidAmount, 0);
    let paidCount = processedShipments.filter(s => s.status === 'paid').length;
    let partialCount = processedShipments.filter(s => s.status === 'partial').length;
    let unpaidCount = processedShipments.filter(s => s.status === 'unpaid').length;

    let html = `<div id="paymentsContainer">
        <div class="payment-summary">
            <h3><i class="fas fa-chart-pie"></i> Payment Summary ${mode === 'alltime' ? '(All Time)' : 'for ' + selectedDate}</h3>
            <div class="summary-stats" style="grid-template-columns:repeat(4,1fr);">
                <div class="summary-item"><div class="label">Total Bills</div><div class="value">${processedShipments.length}</div></div>
                <div class="summary-item"><div class="label">Paid</div><div class="value" style="color:#22c55e;">${paidCount}</div></div>
                <div class="summary-item"><div class="label">Partial</div><div class="value" style="color:#f59e0b;">${partialCount}</div></div>
                <div class="summary-item"><div class="label">Unpaid</div><div class="value" style="color:#ef4444;">${unpaidCount}</div></div>
            </div>
            <div class="summary-stats" style="grid-template-columns:repeat(3,1fr);margin-top:20px;">
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatMoney(totalValue)}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatMoney(totalPaid)}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatMoney(totalUnpaid)}</div></div>
            </div>
        </div>
        <div class="payment-actions" style="text-align:right;margin-bottom:20px;">
            <button class="btn-bulk-payment" onclick="showBulkPaymentModal('${selectedDate}')" ${processedShipments.length === 0 ? 'disabled' : ''}><i class="fas fa-money-bill-wave"></i> Bulk Payment</button>
        </div>
        <h3 style="margin-bottom:20px;">Payment Details</h3>`;

    if (processedShipments.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box"></i><h3>No Bills Found</h3><p>No shipments for the selected date: ${selectedDate}</p></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="inventory-table" style="width:100%;">
            <thead><tr><th>Bill ID</th><th>Date</th><th>Branch</th><th>Item</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Paid</th><th>Unpaid</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${processedShipments.map((s, index) => {
                let sc = s.status === 'paid' ? 'badge-paid' : (s.status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                let billId = `BILL-${s.date}-${s.branch}-${String(index + 1).padStart(3, '0')}`;
                return `<tr>
                    <td><strong>${billId}</strong></td><td>${s.date}</td><td>${s.branch}</td><td>${s.item}</td><td>${s.qty}</td>
                    <td>${formatMoney(s.sellingPrice)}</td><td class="total-value">${formatMoney(s.totalPrice)}</td>
                    <td class="${s.status === 'paid' ? 'status-paid' : 'status-unpaid'}">${formatMoney(s.paidAmount)}</td>
                    <td class="${s.status === 'paid' ? 'status-paid' : 'reminder-amount'}">${formatMoney(s.unpaidAmount)}</td>
                    <td><span class="badge ${sc}">${s.status.toUpperCase()}</span></td>
                    <td>${s.status !== 'paid' ? `<button class="btn btn-reminder" onclick="showReminderModal('${s.branch}','${s.date}','${s.item}',${s.qty},${s.sellingPrice})"><i class="fas fa-bell"></i> Pay</button>` : `<span class="badge badge-paid">✓ PAID</span>`}</td>
                </tr>`;
            }).join('')}</tbody>
            <tfoot><tr class="grand-total" style="background:#f0fdf4;">
                <td colspan="5"><strong>Grand Total</strong></td>
                <td><strong>${formatMoney(totalValue)}</strong></td>
                <td><strong>${formatMoney(totalPaid)}</strong></td>
                <td><strong>${formatMoney(totalUnpaid)}</strong></td>
                <td colspan="2"></td>
            </tr></tfoot>
        </table></div>`;
    }
    html += `</div>`;
    let container = document.getElementById('paymentsContainer');
    if (container) { container.style.display = 'block'; container.innerHTML = html; }
}

window.showBulkPaymentModal = function (date) {
    let branch = document.getElementById('paymentBranchSelect').value;
    let shipments = mainClientToBranchShipments.filter(s => s.date === date && (!branch || s.branch === branch));
    let totalUnpaid = shipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty - getShipmentPaidAmount(s)), 0);

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Bulk Payment for ${date}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="bulk-payment-info"><h4><i class="fas fa-info-circle"></i> Payment Summary</h4>
            <ul><li><strong>Total Bills:</strong> ${shipments.length}</li><li><strong>Total Unpaid:</strong> ${formatMoney(totalUnpaid)}</li><li><strong>Date:</strong> ${date}</li>${branch ? `<li><strong>Branch:</strong> ${branch}</li>` : ''}</ul>
        </div>
        <div class="form-group"><label>Payment Amount (AFG)</label><input type="number" id="bulkPaymentAmount" step="0.01" min="0.01" max="${totalUnpaid}" value="${totalUnpaid}"><small style="color:#166534;">Maximum: ${formatMoney(totalUnpaid)}</small></div>
        <div class="form-group"><label>Payment Description (Optional)</label><input type="text" id="bulkPaymentDescription" placeholder="e.g., Bulk payment for ${date}"></div>
        <button class="save-btn" onclick="processBulkPayment('${date}')"><i class="fas fa-check"></i> Process Bulk Payment</button>`;
    document.getElementById('modal').classList.add('active');
};

window.processBulkPayment = async function (date) {
    let paymentAmount = parseFloat(document.getElementById('bulkPaymentAmount').value);
    let branch = document.getElementById('paymentBranchSelect').value;
    if (isNaN(paymentAmount) || paymentAmount <= 0) { alert('Please enter a valid payment amount'); return; }

    let shipments = mainClientToBranchShipments.filter(s => s.date === date && (!branch || s.branch === branch));
    let totalUnpaid = shipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty - getShipmentPaidAmount(s)), 0);
    if (paymentAmount > totalUnpaid) { alert(`Payment cannot exceed ${formatMoney(totalUnpaid)}`); return; }

    let remainingPayment = paymentAmount;
    let sortedShipments = [...shipments].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (const shipment of sortedShipments) {
        if (remainingPayment <= 0) break;
        let shipmentReminder = (shipment.sellingPrice * shipment.qty) - getShipmentPaidAmount(shipment);
        if (shipmentReminder <= 0) continue;
        let paymentForThis = Math.min(remainingPayment, shipmentReminder);
        await processShipmentPayment(shipment, paymentForThis);
        remainingPayment -= paymentForThis;
    }
    closeModal();
    await refreshDataFromServer();
    await loadPaymentsByDate();
    alert(`✅ Bulk payment of ${formatMoney(paymentAmount)} processed for ${date}!`);
};

window.showReminderModal = function (branch, date, item, qty, price) {
    let shipment = mainClientToBranchShipments.find(s => s.branch === branch && s.date === date && s.item === item && s.qty === qty);
    if (!shipment) return;
    let totalPrice = shipment.sellingPrice * qty;
    let currentPaid = getShipmentPaidAmount(shipment);
    let currentReminder = totalPrice - currentPaid;

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Payment - ${item}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Branch</label><input type="text" value="${branch}" readonly></div>
        <div class="form-group"><label>Item</label><input type="text" value="${item} (${qty} units)" readonly></div>
        <div class="form-group"><label>Total Price</label><input type="text" value="${formatMoney(totalPrice)}" readonly></div>
        <div class="form-group"><label>Already Paid</label><input type="text" value="${formatMoney(currentPaid)}" readonly style="background:#dcfce7;color:#166534;"></div>
        <div class="form-group"><label>Remaining</label><input type="text" value="${formatMoney(currentReminder)}" readonly style="background:#fef3c7;color:#92400e;"></div>
        <div class="form-group"><label>Payment Amount (AFG)</label><input type="number" id="paymentAmount" step="0.01" min="0.01" max="${currentReminder}" value="${currentReminder}"><small style="color:#166534;">Maximum: ${formatMoney(currentReminder)}</small></div>
        <button class="save-btn" onclick="processPayment('${branch}','${date}','${item}',${qty},${shipment.sellingPrice})"><i class="fas fa-check"></i> Process Payment</button>`;
    document.getElementById('modal').classList.add('active');
};

window.processPayment = async function (branch, date, item, qty, price) {
    let paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    if (isNaN(paymentAmount) || paymentAmount <= 0) { alert('Please enter a valid payment amount'); return; }
    let shipment = mainClientToBranchShipments.find(s => s.branch === branch && s.date === date && s.item === item && s.qty === qty);
    if (!shipment) { alert('Shipment not found!'); return; }
    let currentReminder = (shipment.sellingPrice * qty) - getShipmentPaidAmount(shipment);
    if (paymentAmount > currentReminder) { alert(`Payment cannot exceed ${formatMoney(currentReminder)}`); return; }
    const success = await processShipmentPayment(shipment, paymentAmount);
    if (success) {
        closeModal();
        await refreshDataFromServer();
        await loadPaymentsByDate();
        alert(paymentAmount >= currentReminder ? `✅ Payment processed! Bill is fully paid.` : `✅ Payment of ${formatMoney(paymentAmount)} processed! Remaining: ${formatMoney(currentReminder - paymentAmount)}`);
    } else { alert('Failed to process payment. Please try again.'); }
};

async function processShipmentPayment(shipment, paymentAmount) {
    if (!shipment.uniqueKey) { console.error('Shipment has no uniqueKey:', shipment); return false; }
    try {
        const response = await fetch('/api/shipment-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: shipment.uniqueKey, paid_amount: paymentAmount }) });
        if (!response.ok) return false;
        if (!shipmentPayments[shipment.uniqueKey]) shipmentPayments[shipment.uniqueKey] = 0;
        shipmentPayments[shipment.uniqueKey] += paymentAmount;
        let totalPrice = shipment.sellingPrice * shipment.qty;
        let shipmentId = generateMainClientToBranchShipmentId(shipment);
        shipmentReminders[shipmentId] = Math.max(0, totalPrice - shipmentPayments[shipment.uniqueKey]);
        return true;
    } catch (err) { console.error('Error processing payment:', err); return false; }
}

// ==================== MAIN CLIENT BILLING ====================
async function renderMainClientBilling() {
    let branches = getBranchUsers();
    let today = getTodayDate();
    await refreshDataFromServer();

    document.getElementById('content').innerHTML = `
        <div class="header-actions"><h2 class="page-title">Billing - Shipments to Branches</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="report-billing-section">
            <div class="filter-row">
                <div class="filter-group"><label><i class="fas fa-code-branch"></i> Select Branch</label>
                    <select id="billingBranchSelect"><option value="">-- Choose a branch --</option>${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}</select>
                </div>
                <div class="filter-group"><label><i class="fas fa-calendar"></i> Select Date</label><input type="date" id="billingDate" value="${today}"></div>
                <div class="filter-group"><label>&nbsp;</label><button class="btn-view" onclick="loadBillingData()" style="width:100%;"><i class="fas fa-search"></i> Load Data</button></div>
            </div>
        </div>
        <div id="billingDataContainer" style="display:none;"></div>`;
}

window.loadBillingData = async function () {
    let branch = document.getElementById('billingBranchSelect').value;
    let dateInput = document.getElementById('billingDate').value || getTodayDate();
    if (!branch) { alert('Please select a branch'); return; }
    let selectedDate = formatDateForCompare(dateInput);
    await refreshDataFromServer();

    let dailyShipments = mainClientToBranchShipments.filter(s => {
        let shipmentDate = formatDateForCompare(s.date);
        return s.branch === branch && shipmentDate === selectedDate;
    });

    let totalItems = dailyShipments.reduce((sum, s) => sum + s.qty, 0);
    let totalValue = dailyShipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);

    let html = `<div id="billingDataContainer">
        <div class="branch-inventory-header"><h3><i class="fas fa-truck"></i> Shipments Report</h3><h4 style="color:#166534;margin-top:10px;">Branch: ${branch} | Date: ${selectedDate}</h4></div>
        ${dailyShipments.length === 0
            ? `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No Shipments Found</h3><p>No items were sent to ${branch} on ${selectedDate}.</p></div>`
            : `<div class="table-wrapper"><table class="report-table"><thead><tr><th>Item Name</th><th>Date</th><th>Quantity</th><th>Selling Price/Unit</th><th>Total Price</th></tr></thead>
               <tbody>${dailyShipments.map(s => `<tr><td>${escapeHtml(s.item)}</td><td>${s.date}</td><td>${s.qty}</td><td>${formatMoney(s.sellingPrice)}</td><td class="total-value">${formatMoney(s.sellingPrice * s.qty)}</td></tr>`).join('')}</tbody>
               </table></div>`
        }
        <div class="summary-box"><h3 style="margin-bottom:20px;color:#166534;">Summary</h3>
            <div class="summary-row"><span class="summary-label">Total Items Shipped:</span><span class="summary-value">${totalItems}</span></div>
            <div class="summary-row"><span class="summary-label">Total Value (Selling Price):</span><span class="summary-value">${formatMoney(totalValue)}</span></div>
            <div class="summary-row"><span class="summary-label">Number of Shipments:</span><span class="summary-value">${dailyShipments.length}</span></div>
        </div>
        ${dailyShipments.length > 0 ? `<div style="text-align:right;margin-top:20px;"><button class="action-btn" onclick="showInvoiceNumberModal('${branch}','${selectedDate}')"><i class="fas fa-file-invoice"></i> Generate Bill</button></div>` : ''}
    </div>`;

    document.getElementById('billingDataContainer').style.display = 'block';
    document.getElementById('billingDataContainer').innerHTML = html;
};

window.showInvoiceNumberModal = function (branch, date) {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Enter Invoice Number</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Invoice Number</label><input type="text" id="invoiceNumberInput" value="INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}"></div>
        <div class="form-group"><label>Branch</label><input type="text" value="${branch} Branch" readonly></div>
        <div class="form-group"><label>Date</label><input type="text" value="${date}" readonly></div>
        <button class="save-btn" onclick="generateInvoice('${branch}','${date}')"><i class="fas fa-print"></i> Generate & Print Invoice</button>`;
    document.getElementById('modal').classList.add('active');
};

window.generateInvoice = async function (branch, date) {
    let invoiceNumber = document.getElementById('invoiceNumberInput').value;
    if (!invoiceNumber.trim()) { alert('Please enter an invoice number'); return; }
    let mainClient = currentUser.username;
    let dailyShipments = mainClientToBranchShipments.filter(s => s.branch === branch && s.date === date);
    let totalItems = dailyShipments.reduce((sum, s) => sum + s.qty, 0);
    let totalValue = dailyShipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);
    let allTimeShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let allTimeTotalItems = allTimeShipments.reduce((sum, s) => sum + s.qty, 0);
    let allTimeTotalValue = allTimeShipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);
    let allTimePaid = allTimeShipments.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
    let allTimeUnpaid = allTimeTotalValue - allTimePaid;

    try {
        const response = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: invoiceNumber, main_client: mainClient, branch, date, total_items: totalItems, total_value: totalValue, all_time_total_items: allTimeTotalItems, all_time_total_value: allTimeTotalValue, all_time_paid: allTimePaid, all_time_unpaid: allTimeUnpaid, items: dailyShipments }) });
        if (!response.ok) throw new Error('Failed to save invoice');
        invoices.push({ number: invoiceNumber, mainClient, branch, date, shipments: dailyShipments, totalItems, totalValue, createdAt: new Date().toISOString() });
        showInvoicePrint(invoiceNumber, mainClient, branch, date, dailyShipments, totalItems, totalValue, allTimeTotalItems, allTimeTotalValue, allTimePaid, allTimeUnpaid);
        closeModal();
    } catch (error) { alert('Failed to save invoice: ' + error.message); }
};

function showInvoicePrint(invoiceNumber, mainClient, branch, date, shipments, totalItems, totalValue, allTimeTotalItems, allTimeTotalValue, allTimePaid, allTimeUnpaid) {
    document.getElementById('invoiceModalContent').innerHTML = `
        <div class="invoice-print">
            <div class="invoice-header"><h2>Haqyar Mangal Trading Company</h2><h3>Shipment Invoice</h3></div>
            <div class="invoice-info">
                <div class="invoice-info-item"><div class="label">Invoice Number</div><div class="value">${invoiceNumber}</div></div>
                <div class="invoice-info-item"><div class="label">Main Client</div><div class="value">${mainClient}</div></div>
                <div class="invoice-info-item"><div class="label">Branch</div><div class="value">${branch}</div></div>
                <div class="invoice-info-item"><div class="label">Date</div><div class="value">${date}</div></div>
            </div>
            <table class="invoice-table">
                <thead><tr><th>Item Name</th><th>Date</th><th>Quantity</th><th>Selling Price/Unit</th><th>Total Price</th></tr></thead>
                <tbody>${shipments.map(s => `<tr><td>${s.item}</td><td>${s.date}</td><td>${s.qty}</td><td>${formatMoney(s.sellingPrice)}</td><td class="total-value">${formatMoney(s.sellingPrice * s.qty)}</td></tr>`).join('')}</tbody>
                <tfoot>
                    <tr class="grand-total"><td colspan="4"><strong>Total Items (This Bill):</strong></td><td><strong>${totalItems}</strong></td></tr>
                    <tr class="grand-total"><td colspan="4"><strong>Total Value (This Bill):</strong></td><td><strong>${formatMoney(totalValue)}</strong></td></tr>
                </tfoot>
            </table>
            <div class="all-time-summary" style="margin-top:30px;padding-top:20px;border-top:2px solid #333;">
                <h3 style="text-align:center;margin-bottom:15px;">Branch Summary (All Time)</h3>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span><strong>Total Items Shipped (All Time):</strong></span><span><strong>${allTimeTotalItems}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span><strong>Total Value (All Time):</strong></span><span><strong>${formatMoney(allTimeTotalValue)}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span><strong>Total Paid (All Time):</strong></span><span style="color:#22c55e;"><strong>${formatMoney(allTimePaid)}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span><strong>Total Unpaid (All Time):</strong></span><span style="color:#ef4444;"><strong>${formatMoney(allTimeUnpaid)}</strong></span></div>
            </div>
            <div class="invoice-total">Grand Total (This Bill): ${formatMoney(totalValue)}</div>
            <div class="invoice-footer"><p>Generated by ${mainClient}</p><p>This is a computer generated invoice.</p></div>
        </div>
        <div style="text-align:center;margin-top:20px;" class="no-print"><button class="close-btn" onclick="closeInvoiceModal()">Close</button></div>`;
    document.getElementById('invoiceModal').classList.add('active');
    setTimeout(() => window.print(), 500);
}

// ==================== MAIN CLIENT INVOICES ====================
async function renderMainClientInvoices() {
    let branches = getBranchUsers();
    try {
        const response = await fetch(`/api/invoices/mainclient/${currentUser.username}`);
        if (response.ok) invoices = await response.json();
        else invoices = [];
    } catch (err) { invoices = []; }

    let html = `
        <div class="header-actions"><h2 class="page-title">My Invoices</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="branch-selector" style="margin-bottom:30px;">
            <div class="form-group" style="width:100%;"><label><i class="fas fa-code-branch"></i> Filter by Branch</label>
                <select id="mainClientInvoiceBranchFilter" onchange="filterMainClientInvoices()">
                    <option value="">-- All Branches --</option>
                    ${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
                </select>
            </div>
        </div>`;

    if (!invoices || invoices.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No Invoices Yet</h3><p>Generate invoices from the Billing section.</p><button class="action-btn" onclick="showSection('mainClientBilling')" style="margin-bottom:0;"><i class="fas fa-file-invoice"></i> Go to Billing</button></div>`;
    } else {
        html += `<div id="mainClientInvoicesList">${renderMainClientInvoicesList(invoices)}</div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderMainClientInvoicesList(invoicesList) {
    let branchFilter = document.getElementById('mainClientInvoiceBranchFilter')?.value || '';
    let filtered = branchFilter ? invoicesList.filter(inv => inv.branch === branchFilter) : invoicesList;
    if (!filtered || filtered.length === 0) return `<div class="empty-state"><i class="fas fa-file-invoice"></i><h3>No Invoices Found</h3></div>`;
    return `<div class="table-wrapper"><table class="inventory-table">
        <thead><tr><th>Invoice Number</th><th>Branch</th><th>Date</th><th>Total Items</th><th>Total Value</th><th>Created At</th><th>Actions</th></tr></thead>
        <tbody>${filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(inv => `
            <tr>
                <td><strong>${escapeHtml(inv.number)}</strong></td><td>${escapeHtml(inv.branch)}</td><td>${inv.date || '-'}</td>
                <td>${inv.total_items || 0}</td><td class="total-value">${formatMoney(inv.total_value || 0)}</td>
                <td>${inv.created_at ? new Date(inv.created_at).toLocaleString() : '-'}</td>
                <td><button class="btn btn-edit" onclick="viewMainClientInvoice('${inv.number}')"><i class="fas fa-eye"></i> View</button></td>
            </tr>`).join('')}
        </tbody>
    </table></div>`;
}

window.filterMainClientInvoices = function () {
    let container = document.getElementById('mainClientInvoicesList');
    if (container && invoices) container.innerHTML = renderMainClientInvoicesList(invoices);
};

window.viewMainClientInvoice = async function (invoiceNumber) {
    try {
        const response = await fetch(`/api/invoices/${invoiceNumber}`);
        if (response.ok) {
            const invoice = await response.json();
            document.getElementById('invoiceModalContent').innerHTML = `
                <div class="invoice-print">
                    <div class="invoice-header"><h2>Haqyar Mangal Trading Company</h2><h3>Shipment Invoice</h3></div>
                    <div class="invoice-info">
                        <div class="invoice-info-item"><div class="label">Invoice Number</div><div class="value">${invoice.number}</div></div>
                        <div class="invoice-info-item"><div class="label">Main Client</div><div class="value">${invoice.main_client}</div></div>
                        <div class="invoice-info-item"><div class="label">Branch</div><div class="value">${invoice.branch}</div></div>
                        <div class="invoice-info-item"><div class="label">Date</div><div class="value">${invoice.date}</div></div>
                    </div>
                    <table class="invoice-table">
                        <thead><tr><th>Item Name</th><th>Date</th><th>Quantity</th><th>Selling Price</th><th>Total Price</th></tr></thead>
                        <tbody>${invoice.items.map(item => `<tr><td>${item.item_name}</td><td>${item.date}</td><td>${item.quantity}</td><td>${formatMoney(item.selling_price)}</td><td>${formatMoney(item.total_price)}</td></tr>`).join('')}</tbody>
                        <tfoot><tr class="grand-total"><td colspan="3"><strong>Total Items: ${invoice.total_items}</strong></td><td></td><td><strong>${formatMoney(invoice.total_value)}</strong></td></tr></tfoot>
                    </table>
                    <div class="invoice-total">Grand Total: ${formatMoney(invoice.total_value)}</div>
                    <div class="invoice-footer"><p>Generated by ${invoice.main_client}</p><p>This is a computer generated invoice.</p></div>
                </div>
                <div style="text-align:center;margin-top:20px;" class="no-print">
                    <button class="close-btn" onclick="closeInvoiceModal()">Close</button>
                    <button class="action-btn" onclick="window.print()" style="margin-left:10px;"><i class="fas fa-print"></i> Print</button>
                </div>`;
            document.getElementById('invoiceModal').classList.add('active');
        }
    } catch (err) { alert('Failed to load invoice details'); }
};

// ==================== MAIN CLIENT REPORT ====================
async function renderMainClientReport() {
    let branches = getBranchUsers();
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
    let summary = await getMainClientPaymentSummary();
    let totalExpenses = clientExps.reduce((sum, exp) => sum + exp.amount, 0);
    let returnSummary = getReturnSummary();
    let branchesSummary = getAllBranchesSummary();

        // Payment to Admin (paid only)
    let paymentToAdminTotal = 0;
    try {
        const paRes = await fetch(`/api/payments-to-admin/${currentUser.username}`);
        if (paRes.ok) {
            const paData = await paRes.json();
            paymentToAdminTotal = paData
                .filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + parseFloat(p.amount), 0);
        }
    } catch(err) { console.log('Error loading payment to admin:', err); }

    // Payment from all branches (total paid)
    let paymentFromBranches = 0;
    for (const shipment of mainClientToBranchShipments) {
        paymentFromBranches += getShipmentPaidAmount(shipment);
    }

    // Total Items Value Original
    let totalItemsValueOriginal = mainInventory.reduce((sum, item) => {
        return sum + ((parseFloat(item.sellingPrice) || 0) * (parseInt(item.quantity) || 0));
    }, 0);
    let html = `
        <div class="header-actions"><h2 class="page-title">Complete Reports</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="report-tabs">
            <button class="report-tab active" onclick="showMainClientOwnReport()">My Report</button>
            <button class="report-tab" onclick="showMainClientBranchReportSelector()">Branch Report</button>
        </div>
        
    <div style="background:#f0fdf4;border-radius:16px;padding:16px;margin-bottom:20px;border:2px solid #bbf7d0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <label style="color:#166534;font-weight:600;"><i class="fas fa-calendar" style="margin-right:6px;"></i>Time Period:</label>
        <select id="mcReportTimeFilter" onchange="filterMcReportTime()" style="padding:10px 16px;border:2px solid #bbf7d0;border-radius:12px;background:white;color:#166634;font-weight:600;">
            <option value="all">All Time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom Range</option>
        </select>
        <div id="mcReportCustomRange" style="display:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="date" id="mcReportStart" value="${getWeekAgoDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
            <span style="color:#166534;">to</span>
            <input type="date" id="mcReportEnd" value="${getTodayDate()}" style="padding:10px;border:2px solid #bbf7d0;border-radius:12px;">
        </div>
    </div>
        <div id="mainClientOwnReport">
            <h3 style="margin-bottom:20px;">My Financial Summary</h3>
            <div class="summary-cards-grid">
                <div class="summary-card-large">
                    <h4><i class="fas fa-box"></i> Shared Inventory</h4>
                    <div class="amount">${clientItems.length}</div><div class="subtitle">Total Items</div>
                    <div style="margin-top:15px;">
                        <div class="summary-stats-row"><span class="label">Paid Items:</span><span class="value profit">${summary.paidItems}</span></div>
                        <div class="summary-stats-row"><span class="label">Unpaid Items:</span><span class="value loss">${summary.totalItems - summary.paidItems}</span></div>
                    </div>
                </div>

                
                <div class="summary-card-large paid">
                    <h4><i class="fas fa-credit-card"></i> My Payments</h4>
                    <div class="amount">${formatMoney(summary.totalPaid)}</div><div class="subtitle">Remaining Stock Value</div>
                    <div style="margin-top:15px;">
                        <div class="summary-stats-row"><span class="label">Unpaid to Admin:</span><span class="value">${formatMoney(summary.totalUnpaid)}</span></div>
                    </div>
                </div>
                <div class="summary-card-large warning">
                    <h4><i class="fas fa-file-invoice"></i> My Expenses & Returns</h4>
                    <div class="amount">${formatMoney(totalExpenses)}</div><div class="subtitle">Total Expenses</div>
                    <div style="margin-top:15px;">
                        <div class="summary-stats-row"><span class="label">Returns Value:</span><span class="value">${formatMoney(returnSummary.totalValue)}</span></div>
                        <div class="summary-stats-row"><span class="label">Net Balance:</span><span class="value ${(summary.totalPaid - totalExpenses) >= 0 ? 'profit' : 'loss'}">${formatMoney(summary.totalPaid - totalExpenses)}</span></div>
                    </div>
                </div>
            </div>
            <div class="summary-cards-grid">
                <div class="summary-card-large">
                    <h4><i class="fas fa-shopping-cart"></i> Branches Sales</h4>
                    <div class="amount">${branchesSummary.totalSold}</div><div class="subtitle">Total Items Sold</div>
                    <div style="margin-top:15px;">
                        <div class="summary-stats-row"><span class="label">Total Revenue:</span><span class="value">${formatMoney(branchesSummary.totalRevenue)}</span></div>
                        <div class="summary-stats-row"><span class="label">Total Profit:</span><span class="value profit">${formatMoney(branchesSummary.totalProfit)}</span></div>
                    </div>
                </div>
           
           
<div class="summary-card-large" style="background:linear-gradient(145deg,#3b82f6,#2563eb);">
    <h4 style="color:white;"><i class="fas fa-tags"></i> Total Sales Price</h4>
    <div class="amount" style="color:white;font-size:22px;">${formatMoney(totalItemsValueOriginal)}</div>
    <div class="subtitle" style="color:rgba(255,255,255,0.8);">Total Items Value from Admin</div>
</div>

<div class="summary-card-large" style="background:linear-gradient(145deg,#166534,#14532d);">
    <h4 style="color:white;"><i class="fas fa-hand-holding-usd"></i> Payment to Admin</h4>
    <div class="amount" style="color:white;font-size:22px;">${formatMoney(paymentToAdminTotal)}</div>
    <div class="subtitle" style="color:rgba(255,255,255,0.8);">Confirmed paid payments</div>
</div>

<div class="summary-card-large" style="background:linear-gradient(145deg,#22c55e,#16a34a);">
    <h4 style="color:white;"><i class="fas fa-store"></i> Payment from All Branches</h4>
    <div class="amount" style="color:white;font-size:22px;">${formatMoney(paymentFromBranches)}</div>
    <div class="subtitle" style="color:rgba(255,255,255,0.8);">Total paid by branches</div>
</div>
            </div>
        </div>
        <div id="mainClientBranchReport" style="display:none;">
            <div class="report-billing-section">
                <div class="filter-row">
                    <div class="filter-group"><label><i class="fas fa-code-branch"></i> Select Branch</label>
                        <select id="reportBranchSelect"><option value="">-- Choose a branch --</option>${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}</select>
                    </div>
                    <div class="filter-group"><label><i class="fas fa-calendar"></i> Time Period</label>
                        <select id="reportTimePeriod" onchange="toggleReportCustomDate()">
                            <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="custom">Custom Range</option>
                        </select>
                    </div>
                    <div class="filter-group" id="reportCustomDate" style="display:none;">
                        <label><i class="fas fa-calendar-alt"></i> Custom Date Range</label>
                        <div class="date-range"><input type="date" id="reportStartDate" value="${getWeekAgoDate()}"><span>to</span><input type="date" id="reportEndDate" value="${getTodayDate()}"></div>
                    </div>
                </div>
                <button class="btn-filter" onclick="generateBranchReport()"><i class="fas fa-filter"></i> Generate Report</button>
            </div>
            <div id="reportResultContainer" style="display:none;"></div>
        </div>`;
    document.getElementById('content').innerHTML = html;
}

window.showMainClientOwnReport = async function () {
    document.querySelectorAll('.report-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    await renderMainClientReport();
};

window.showMainClientBranchReportSelector = function () {
    document.querySelectorAll('.report-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('mainClientOwnReport').style.display = 'none';
    document.getElementById('mainClientBranchReport').style.display = 'block';
};

window.toggleReportCustomDate = function () {
    let period = document.getElementById('reportTimePeriod').value;
    document.getElementById('reportCustomDate').style.display = period === 'custom' ? 'block' : 'none';
};

window.generateBranchReport = async function () {
    let branch = document.getElementById('reportBranchSelect').value;
    if (!branch) { alert('Please select a branch'); return; }
    await refreshDataFromServer();
    let today = new Date();
    let startDate, endDate;
    let period = document.getElementById('reportTimePeriod').value;
    if (period === 'daily') {
        let todayStr = getTodayDate();
        startDate = new Date(todayStr + 'T00:00:00'); endDate = new Date(todayStr + 'T23:59:59');
    } else if (period === 'weekly') {
        startDate = new Date(today); startDate.setDate(today.getDate() - 7); startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today); endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
        startDate = new Date(today); startDate.setMonth(today.getMonth() - 1); startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today); endDate.setHours(23, 59, 59, 999);
    } else if (period === 'custom') {
        startDate = new Date(document.getElementById('reportStartDate').value); startDate.setHours(0, 0, 0, 0);
        endDate = new Date(document.getElementById('reportEndDate').value); endDate.setHours(23, 59, 59, 999);
    } else { startDate = new Date(2000, 0, 1); endDate = new Date(today); endDate.setHours(23, 59, 59, 999); }
    await displayBranchReport(branch, startDate, endDate, period);
};

async function displayBranchReport(branch, startDate, endDate, period) {
    let branchInv = [];
    let allShipments = [];
    try {
        const res = await fetch(`/api/branch-inventory/${branch}`);
        branchInv = (await res.json()).map(b => ({ name: b.item_name, quantity: parseInt(b.quantity), sellingPrice: parseFloat(b.selling_price), purchasePrice: parseFloat(b.purchase_price) }));
    } catch (err) {}

    allShipments = mainClientToBranchShipments.filter(s => s.branch === branch);

    let filteredShipments = allShipments.filter(s => {
        let d = new Date(s.date); d.setHours(0, 0, 0, 0);
        let sd = new Date(startDate); sd.setHours(0, 0, 0, 0);
        let ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
        return d >= sd && d <= ed;
    }).map(s => {
        let totalPrice = (s.sellingPrice || 0) * (s.qty || 0);
        let paidAmount = Math.min((s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : 0, totalPrice);
        let reminder = totalPrice - paidAmount;
        return { ...s, date: formatDateForCompare(s.date), reminder, paidAmount, status: paidAmount >= totalPrice ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'), totalPrice };
    });

    let totalValue = filteredShipments.reduce((sum, s) => sum + s.totalPrice, 0);
    let totalPaid = filteredShipments.reduce((sum, s) => sum + s.paidAmount, 0);
    let totalUnpaid = filteredShipments.reduce((sum, s) => sum + s.reminder, 0);
    let currentStock = branchInv.reduce((sum, i) => sum + (i.quantity || 0), 0);

    let html = `<div id="reportResultContainer">
        <h3 style="margin:30px 0 20px;">Branch Report: ${branch}</h3>
        <h4 style="color:#166534;margin-bottom:20px;">Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</h4>
        <div class="summary-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:30px;">
            <div class="summary-card paid" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><h4 style="color:white;"><i class="fas fa-check-circle"></i> Total Paid</h4><div class="amount" style="color:white;font-size:28px;">${formatMoney(totalPaid)}</div></div>
            <div class="summary-card unpaid" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><h4 style="color:white;"><i class="fas fa-clock"></i> Total Unpaid</h4><div class="amount" style="color:white;font-size:28px;">${formatMoney(totalUnpaid)}</div></div>
            <div class="summary-card today" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><h4 style="color:white;"><i class="fas fa-boxes"></i> Current Stock</h4><div class="amount" style="color:white;font-size:28px;">${currentStock}</div></div>
        </div>
        ${filteredShipments.length === 0
            ? `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No shipments in this period</h3></div>`
            : `<div class="table-wrapper"><table class="report-table">
                <thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Selling Price</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>${filteredShipments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => {
                    let bc = s.status === 'paid' ? 'badge-paid' : (s.status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                    return `<tr><td>${s.date}</td><td>${s.item}</td><td>${s.qty}</td><td>${formatMoney(s.sellingPrice)}</td><td class="total-value">${formatMoney(s.totalPrice)}</td><td class="status-paid">${formatMoney(s.paidAmount)}</td><td class="reminder-amount">${formatMoney(s.reminder)}</td><td><span class="badge ${bc}">${s.status.toUpperCase()}</span></td></tr>`;
                }).join('')}</tbody>
                <tfoot><tr class="grand-total"><td colspan="4"><strong>Grand Total</strong></td><td><strong>${formatMoney(totalValue)}</strong></td><td><strong>${formatMoney(totalPaid)}</strong></td><td><strong>${formatMoney(totalUnpaid)}</strong></td><td></td></tr></tfoot>
            </table></div>`
        }
    </div>`;

            let branchSalesFiltered = salesHistory.filter(s => {
            let d = new Date(s.date); d.setHours(0,0,0,0);
            let sd = new Date(startDate); sd.setHours(0,0,0,0);
            let ed = new Date(endDate); ed.setHours(23,59,59,999);
            return s.branch === branch && d >= sd && d <= ed;
        });

        html += `<h3 style="margin:30px 0 20px;">Branch Sales</h3>`;

        if (branchSalesFiltered.length === 0) {
            html += `<div class="empty-state"><i class="fas fa-shopping-cart"></i><h3>No Sales in This Period</h3></div>`;
        } else {
            let totalSalePrice = branchSalesFiltered.reduce((sum, s) => sum + s.revenue, 0);
            html += `
                <div class="table-wrapper"><table class="inventory-table">
                    <thead><tr><th>Item Name</th><th>Stock Sold</th><th>Sale Date</th><th>Price per Unit</th><th>Total Price</th></tr></thead>
                    <tbody>${branchSalesFiltered.sort((a,b) => new Date(b.date) - new Date(a.date)).map(s => `
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

    document.getElementById('reportResultContainer').style.display = 'block';
    document.getElementById('reportResultContainer').innerHTML = html;
}

// ==================== PAYMENT TO ADMIN (MAIN CLIENT) ====================
async function renderMainClientPaymentToAdmin() {
    let mainClient = currentUser.username;
    let payments = [];
    try {
        const res = await fetch(`/api/payments-to-admin/${mainClient}`);
        if (res.ok) payments = await res.json();
    } catch (err) { console.log('Error loading payments:', err); }

    let totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    let totalUnpaid = payments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + parseFloat(p.amount), 0);

    let html = `
        <div class="header-actions"><h2 class="page-title">Payment to Admin</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><i class="fas fa-check-circle" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Paid</h4><div class="stat-value" style="color:white;">${formatMoney(totalPaid)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><i class="fas fa-clock" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Unpaid</h4><div class="stat-value" style="color:white;">${formatMoney(totalUnpaid)}</div></div>
        </div>
        <div class="expense-section" style="margin-bottom:30px;">
            <h3 style="margin-bottom:20px;color:#166534;"><i class="fas fa-plus-circle"></i> Add New Payment</h3>
            <div class="form-group"><label>Amount (AFG)</label><input type="number" id="payToAdminAmount" step="0.01" min="0" placeholder="Enter amount" class="form-control"></div>
            <div class="form-group"><label>Description (Optional)</label><textarea id="payToAdminDesc" rows="2" placeholder="Enter description..." class="form-control"></textarea></div>
            <button class="action-btn" onclick="addPaymentToAdmin()" id="addPaymentBtn"><i class="fas fa-plus"></i> Add Payment</button>
        </div>
        <h3 style="margin-bottom:20px;color:#166534;">Payment History</h3>
        ${payments.length === 0
            ? `<div class="empty-state"><i class="fas fa-money-bill-wave"></i><h3>No Payments Yet</h3><p>Add your first payment above</p></div>`
            : `<div class="table-wrapper"><table class="inventory-table">
                <thead><tr><th>ID</th><th>Date</th><th>Amount</th><th>Description</th><th>Status</th></tr></thead>
                <tbody>${payments.map(p => `
                    <tr>
                        <td>${p.id}</td><td>${p.date ? p.date.split('T')[0] : '-'}</td>
                        <td class="total-value">${formatMoney(parseFloat(p.amount))}</td>
                        <td>${p.description || '-'}</td>
                        <td><span class="badge ${p.status === 'paid' ? 'badge-paid' : 'badge-unpaid'}">${p.status === 'paid' ? 'PAID' : 'UNPAID'}</span></td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`
        }`;
    document.getElementById('content').innerHTML = html;
}

window.addPaymentToAdmin = async function () {
    let amount = parseFloat(document.getElementById('payToAdminAmount').value);
    let description = document.getElementById('payToAdminDesc').value.trim();
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }
    const btn = document.getElementById('addPaymentBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...'; }
    try {
        const res = await fetch('/api/payments-to-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ main_client: currentUser.username, amount, description: description || null, date: getTodayDate() }) });
        if (!res.ok) throw new Error('Failed to add payment');
        await renderMainClientPaymentToAdmin();
        alert('Payment added successfully!');
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add Payment'; }
        alert('Failed to add payment: ' + err.message);
    }
};

window.filterMcReportTime = function() {
    let filter = document.getElementById('mcReportTimeFilter').value;
    let customRange = document.getElementById('mcReportCustomRange');
    if (customRange) {
        customRange.style.display = filter === 'custom' ? 'flex' : 'none';
    }

    let now = new Date();
    let startDate, endDate = new Date();

    if (filter === 'daily') {
        startDate = new Date(now.toDateString());
    } else if (filter === 'weekly') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
    } else if (filter === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'custom') {
        let startVal = document.getElementById('mcReportStart')?.value;
        let endVal = document.getElementById('mcReportEnd')?.value;
        if (!startVal || !endVal) return;
        startDate = new Date(startVal);
        endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
    } else {
        startDate = new Date(2000, 0, 1);
    }

    // فیلتر shipments
    let filteredShipments = mainClientToBranchShipments.filter(s => {
        if (filter === 'all') return true;
        let d = new Date(s.date);
        return d >= startDate && d <= endDate;
    });

    let paymentFromBranchesFiltered = filteredShipments.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
    let totalSaleFiltered = filteredShipments.reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);

    // آپدیت کارت ها
    let grid = document.querySelector('#mainClientOwnReport .summary-cards-grid:last-of-type');
    if (grid) {
        let cards = grid.querySelectorAll('.summary-card-large');
        // آپدیت Payment from Branches (آخرین کارت)
        if (cards.length > 0) {
            let lastCard = cards[cards.length - 1];
            let amountEl = lastCard.querySelector('.amount');
            if (amountEl) amountEl.textContent = formatMoney(paymentFromBranchesFiltered);
        }
    }
};