// ==================== mc-payments.js ====================
// Main Client: payments، billing، invoices، report، payment to admin


function getCorrectShipmentTotal(s) {
    let totalQty = parseInt(s.qty) || 0;
    let basePrice = s.sellingPrice || 0;
    
    // چک کن shipment پاید شده یا نه
    let paidAmount = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
        ? shipmentPayments[s.uniqueKey] : 0;
    let fullPrice = basePrice * totalQty;
    
    // اگر کاملاً پاید شده، تغییر نده
    if (paidAmount >= fullPrice && fullPrice > 0) {
        return fullPrice;
    }
    
    // discount را چک کن
    let discount = getItemDiscount(s.item);
    if (!discount) {
        return fullPrice;
    }
    
    let originalPrice = parseFloat(discount.originalPrice) || basePrice;
    let currentPrice = parseFloat(discount.newPrice) || basePrice;
    
    // چقدر از این item در این branch فروخته شده
    let allSoldInBranch = salesHistory
        .filter(sale => sale.branch === s.branch && sale.item === s.item)
        .reduce((sum, sale) => sum + (parseInt(sale.qty) || 0), 0);
    
    // نسبت فروش به کل shipment
    let soldFromThis = Math.min(allSoldInBranch, totalQty);
    let unsoldQty = Math.max(0, totalQty - soldFromThis);
    
    // sold × original + unsold × discounted
    return (soldFromThis * originalPrice) + (unsoldQty * currentPrice);
}


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
                    <select id="paymentBranchSelect" onchange="updatePaymentBillNumberOptions(); loadPaymentsByDate()">                        <option value="">-- All Branches --</option>
                        ${[...branches].sort((a, b) => b.id - a.id).map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
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
                <div class="filter-group" id="paymentBillNumberGroup" style="display:none;">
                    <label><i class="fas fa-receipt"></i> Bill Number</label>
                    <select id="paymentBillNumberSelect" onchange="onPaymentBillNumberChange()">
                        <option value="">-- All Bills --</option>
                    </select>
                </div>
            </div>
            <button class="btn-filter" onclick="loadPaymentsByDate()"><i class="fas fa-filter"></i> Load Payments</button>        </div>
        <div id="paymentsContainer" style="display:none;"></div>`;
    document.getElementById('content').innerHTML = html;
}

window.togglePaymentDateInput = function () {
    let mode = document.getElementById('paymentViewMode').value;
    document.getElementById('paymentDateGroup').style.display = mode === 'alltime' ? 'none' : 'block';
};


window.updatePaymentBillNumberOptions = function() {
    let branch = document.getElementById('paymentBranchSelect')?.value;
    let group = document.getElementById('paymentBillNumberGroup');
    let select = document.getElementById('paymentBillNumberSelect');
    if (!branch) { if (group) group.style.display = 'none'; return; }

    let billNumbers = [...new Set(
        mainClientToBranchShipments
            .filter(s => s.branch === branch && s.billNumber && s.billNumber.trim() !== '')
            .map(s => s.billNumber)
    )];

    if (select) {
        select.innerHTML = `<option value="">-- All Bills --</option>` + billNumbers.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
        select.value = '';
    }
    if (group) group.style.display = billNumbers.length > 0 ? 'flex' : 'none';
};

window.onPaymentBillNumberChange = function() {
    let billNumber = document.getElementById('paymentBillNumberSelect')?.value;
    if (billNumber) {
        let shipment = mainClientToBranchShipments.find(s => s.billNumber === billNumber);
        if (shipment) {
            let dateInput = document.getElementById('paymentDate');
            let viewMode = document.getElementById('paymentViewMode');
            if (dateInput) dateInput.value = shipment.date;
            if (viewMode) viewMode.value = 'date';
            togglePaymentDateInput();
        }
    }
    loadPaymentsByDate();
};


window.loadPaymentsByDate = async function () {
    let branch = document.getElementById('paymentBranchSelect').value;
    let mode = document.getElementById('paymentViewMode')?.value || 'date';
    let date = document.getElementById('paymentDate')?.value || getTodayDate();
    let selectedDate = formatDateForCompare(date);
    let billNumber = document.getElementById('paymentBillNumberSelect')?.value || '';
    await refreshDataFromServer();

    try {
        const discRes = await fetch('/api/discounts');
        if (discRes.ok) {
            const discData = await discRes.json();
            itemDiscounts = {};
            for (const d of discData) {
                itemDiscounts[d.item_name] = {
                    discountPercent: d.discount_percent,
                    newPrice: parseFloat(d.new_price),
                    originalPrice: parseFloat(d.original_price),
                    isPercent: d.is_percent,
                    appliedDate: d.applied_date
                };
            }
        }
    } catch(err) { console.log('Error loading discounts:', err); }

        let allShipments = branch 
        ? mainClientToBranchShipments.filter(s => s.branch === branch) 
        : [...mainClientToBranchShipments];

    let baseShipments = billNumber
        ? allShipments.filter(s => s.billNumber === billNumber)
        : (mode === 'alltime' ? allShipments : allShipments.filter(s => {
            let sd = s.date ? s.date.split('T')[0] : '';
            return sd === selectedDate;
          }));

    let filteredShipments = baseShipments.map(s => {
        let correctTotal = getCorrectShipmentTotal(s);
        let paidAmount = Math.min(
            (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
                ? shipmentPayments[s.uniqueKey] 
                : getShipmentPaidAmount(s),
            correctTotal
        );
        let unpaidAmount = Math.max(0, correctTotal - paidAmount);
        let status = paidAmount >= correctTotal 
            ? 'paid' 
            : (paidAmount > 0 ? 'partial' : 'unpaid');
        
        return { ...s, totalPrice: correctTotal, paidAmount, unpaidAmount, status };
    });
    
    window._lastPaymentShipments = filteredShipments;
    let displayLabel = billNumber ? `Bill Number: ${billNumber} (${filteredShipments[0]?.date || ''})` : selectedDate;
    displayPayments(filteredShipments, displayLabel, branch, mode);
};

function displayPayments(shipments, selectedDate, selectedBranch, mode = 'date') {
    let processedShipments = shipments.map(s => {
        let currency = getItemCurrency(s.item);
        let breakdown = getShipmentAmountBreakdown(s);
        return { ...s, ...breakdown, currency };
    });

    let afgShipments = processedShipments.filter(s => s.currency !== 'USD');
    let usdShipments = processedShipments.filter(s => s.currency === 'USD');

    function sums(list) {
        return {
            count: list.length,
            totalValue: list.reduce((sum,s)=>sum+s.total,0),
            totalPaid: list.reduce((sum,s)=>sum+s.paidConfirmed,0),
            totalPartial: list.reduce((sum,s)=>sum+s.partial,0),
            totalUnpaid: list.reduce((sum,s)=>sum+s.unpaid,0)
        };
    }
    let afgSummary = sums(afgShipments);
    let usdSummary = sums(usdShipments);

    let html = `<div id="paymentsContainer">
        <div class="payment-summary">
            <h3><i class="fas fa-chart-pie"></i> Payment Summary (AFG) ${mode === 'alltime' ? '(All Time)' : 'for ' + selectedDate}</h3>
            <div class="summary-stats" style="grid-template-columns:repeat(4,1fr);">
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatMoney(afgSummary.totalValue)}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatMoney(afgSummary.totalPaid)}</div></div>
                <div class="summary-item"><div class="label">Total Partial</div><div class="value" style="color:#f59e0b;">${formatMoney(afgSummary.totalPartial)}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatMoney(afgSummary.totalUnpaid)}</div></div>
            </div>
        </div>
        <div class="payment-actions" style="text-align:right;margin-bottom:20px;">
            <button class="btn-bulk-payment" onclick="showBulkPaymentModal('${selectedDate}', '${mode}', 'AFG')" ${afgSummary.count === 0 ? 'disabled' : ''}><i class="fas fa-money-bill-wave"></i> Bulk Payment (AFG)</button>
        </div>

        ${usdSummary.count > 0 ? `
        <div class="payment-summary" style="border:2px solid #3b82f6;">
            <h3 style="color:#2563eb;"><i class="fas fa-dollar-sign"></i> Payment Summary (USD) ${mode === 'alltime' ? '(All Time)' : 'for ' + selectedDate}</h3>
            <div class="summary-stats" style="grid-template-columns:repeat(4,1fr);">
                <div class="summary-item"><div class="label">Total Value</div><div class="value">${formatByCurrency(usdSummary.totalValue,'USD')}</div></div>
                <div class="summary-item"><div class="label">Total Paid</div><div class="value" style="color:#22c55e;">${formatByCurrency(usdSummary.totalPaid,'USD')}</div></div>
                <div class="summary-item"><div class="label">Total Partial</div><div class="value" style="color:#f59e0b;">${formatByCurrency(usdSummary.totalPartial,'USD')}</div></div>
                <div class="summary-item"><div class="label">Total Unpaid</div><div class="value" style="color:#ef4444;">${formatByCurrency(usdSummary.totalUnpaid,'USD')}</div></div>
            </div>
        </div>
        <div class="payment-actions" style="text-align:right;margin-bottom:20px;">
            <button class="btn-bulk-payment" onclick="showBulkPaymentModal('${selectedDate}', '${mode}', 'USD')" ${usdSummary.count === 0 ? 'disabled' : ''}><i class="fas fa-money-bill-wave"></i> Bulk Payment (USD)</button>
        </div>` : ''}

        <h3 style="margin-bottom:20px;">Payment Details</h3>`;

    if (processedShipments.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-box"></i><h3>No Bills Found</h3><p>No shipments for the selected date: ${selectedDate}</p></div>`;
    } else {
        html += `<div class="table-wrapper"><table class="inventory-table" style="width:100%;">
                <thead><tr><th>Bill Number</th><th>Date</th><th>Branch</th><th>Item</th><th>Currency</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th>Paid</th><th>Partial</th><th>Unpaid</th><th>Action</th></tr></thead>
                <tbody>${processedShipments.map((s, index) => {
                    let fmt = (v) => formatByCurrency(v, s.currency);
                    let hasRemainder = (s.partial + s.unpaid) > 0.01;
                    return `<tr>
                        <td><strong>${s.billNumber || '-'}</strong></td><td>${s.date}</td><td>${s.branch}</td><td>${s.item}</td>
                    <td><span class="badge ${s.currency === 'USD' ? 'badge-mainclient' : 'badge-active'}">${s.currency}</span></td>
                    <td>${s.qty}</td>
                    <td>${fmt(s.sellingPrice)}${getItemDiscount(s.item) && s.unpaid > 0.01 ? `<br><small style="color:#22c55e;">Discounted</small>` : ''}</td>
                    <td class="total-value">${fmt(s.total)}</td>
                    <td style="color:#22c55e;font-weight:600;">${fmt(s.paidConfirmed)}</td>
                    <td style="color:#f59e0b;font-weight:600;">${fmt(s.partial)}</td>
                    <td style="color:#ef4444;font-weight:600;">${fmt(s.unpaid)}</td>
                    <td>${hasRemainder ? `<button class="btn btn-reminder" onclick="showReminderModal('${s.branch}','${s.date}','${s.item}',${s.qty},${s.sellingPrice})"><i class="fas fa-bell"></i> Pay</button>` : `<span class="badge badge-paid">✓ PAID</span>`}</td>
                </tr>`;
            }).join('')}</tbody>
            <tfoot><tr class="grand-total" style="background:#f0fdf4;">
                <td colspan="7"><strong>Grand Total (AFG)</strong></td>
                <td><strong>${formatMoney(afgSummary.totalValue)}</strong></td>
                <td><strong>${formatMoney(afgSummary.totalPaid)}</strong></td>
                <td><strong>${formatMoney(afgSummary.totalPartial)}</strong></td>
                <td><strong>${formatMoney(afgSummary.totalUnpaid)}</strong></td>
                <td></td>
            </tr>
            ${usdSummary.count > 0 ? `<tr class="grand-total" style="background:#eff6ff;">
                <td colspan="7"><strong>Grand Total (USD)</strong></td>
                <td><strong>${formatByCurrency(usdSummary.totalValue,'USD')}</strong></td>
                <td><strong>${formatByCurrency(usdSummary.totalPaid,'USD')}</strong></td>
                <td><strong>${formatByCurrency(usdSummary.totalPartial,'USD')}</strong></td>
                <td><strong>${formatByCurrency(usdSummary.totalUnpaid,'USD')}</strong></td>
                <td></td>
            </tr>` : ''}</tfoot>
        </table></div>`;
    }
    html += `</div>`;
    let container = document.getElementById('paymentsContainer');
    if (container) { container.style.display = 'block'; container.innerHTML = html; }
}


window.showBulkPaymentModal = function (date, mode, currency = 'AFG') {
    let shipments = (window._lastPaymentShipments || []).filter(s => getItemCurrency(s.item) === currency);
    let totalUnpaid = shipments.reduce((sum, s) => {
        let correctTotal = getCorrectShipmentTotal(s);
        let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined)
            ? shipmentPayments[s.uniqueKey] : 0;
        return sum + Math.max(0, correctTotal - paid);
    }, 0);

    if (totalUnpaid <= 0.01) { alert(`All ${currency} shipments are already paid!`); return; }

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Bulk Payment (${currency}) ${mode === 'alltime' ? '(All Time)' : 'for ' + date}</h3><button onclick="closeModal()">&times;</button></div>
        <div class="bulk-payment-info"><h4><i class="fas fa-info-circle"></i> Payment Summary</h4>
            <ul>
                <li><strong>Total Bills:</strong> ${shipments.length}</li>
                <li><strong>Currency:</strong> ${currency}</li>
                <li><strong>Total Unpaid:</strong> ${formatByCurrency(totalUnpaid, currency)}</li>
                ${mode !== 'alltime' ? `<li><strong>Date:</strong> ${date}</li>` : '<li><strong>Period:</strong> All Time</li>'}
                ${(() => { let branch = document.getElementById('paymentBranchSelect')?.value; return branch ? `<li><strong>Branch:</strong> ${branch}</li>` : ''; })()}            </ul>
        </div>
        <div class="form-group">
            <label>Payment Amount (${currency})</label>
            <input type="number" id="bulkPaymentAmount" step="0.01" min="0.01" value="${totalUnpaid.toFixed(2)}">
            <small style="color:#166534;">Maximum: ${formatByCurrency(totalUnpaid, currency)}</small>
        </div>
        <button class="save-btn" onclick="processBulkPayment('${date}', ${totalUnpaid}, '${mode}', '${currency}')">
            <i class="fas fa-check"></i> Process Bulk Payment
        </button>`;
    document.getElementById('modal').classList.add('active');
};

window.processBulkPayment = async function (date, maxUnpaid, mode, currency = 'AFG') {
    let paymentAmount = parseFloat(document.getElementById('bulkPaymentAmount').value);
    if (isNaN(paymentAmount) || paymentAmount <= 0) { alert('Please enter a valid payment amount'); return; }
    if (paymentAmount > maxUnpaid + 0.01) { alert(`Payment cannot exceed ${formatByCurrency(maxUnpaid, currency)}`); return; }

    const btn = document.querySelector('#modalContent .save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }

    let shipments = (window._lastPaymentShipments || []).filter(s => getItemCurrency(s.item) === currency);
    let remaining = paymentAmount;
    for (const shipment of shipments) {
        if (remaining <= 0.01) break;
        if (!shipment.uniqueKey) continue;
        let alreadyPaid = shipmentPayments[shipment.uniqueKey] || 0;
        let total = getCorrectShipmentTotal(shipment);
        let unpaid = Math.max(0, total - alreadyPaid);
        if (unpaid <= 0.01) continue;
        let payThis = Math.min(remaining, unpaid);
        try {
            const res = await fetch('/api/shipment-payment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shipment_id: shipment.uniqueKey, paid_amount: payThis })
            });
            if (res.ok) {
                shipmentPayments[shipment.uniqueKey] = alreadyPaid + payThis;
                remaining -= payThis;
            }
        } catch(err) { console.error('Error:', err); }
    }

    closeModal();
    await refreshDataFromServer();
    await loadPaymentsByDate();
    alert(`✅ Bulk payment of ${formatByCurrency(paymentAmount, currency)} processed successfully!`);
};


window.showReminderModal = function (branch, date, item, qty, price) {
    let shipment = mainClientToBranchShipments.find(s => s.branch === branch && s.date === date && s.item === item && s.qty === qty);
    if (!shipment) return;
    let currency = getItemCurrency(item);
    let totalPrice = shipment.sellingPrice * qty;
    let currentPaid = getShipmentPaidAmount(shipment);
    let currentReminder = totalPrice - currentPaid;
    let fmt = (v) => formatByCurrency(v, currency);

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Payment - ${item} <span class="badge ${currency==='USD'?'badge-mainclient':'badge-active'}">${currency}</span></h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Branch</label><input type="text" value="${branch}" readonly></div>
        <div class="form-group"><label>Item</label><input type="text" value="${item} (${qty} units)" readonly></div>
        <div class="form-group"><label>Total Price</label><input type="text" value="${fmt(totalPrice)}" readonly></div>
        <div class="form-group"><label>Already Paid</label><input type="text" value="${fmt(currentPaid)}" readonly style="background:#dcfce7;color:#166534;"></div>
        <div class="form-group"><label>Remaining</label><input type="text" value="${fmt(currentReminder)}" readonly style="background:#fef3c7;color:#92400e;"></div>
        <div class="form-group"><label>Payment Amount (${currency})</label><input type="number" id="paymentAmount" step="0.01" min="0.01" max="${currentReminder}" value="${currentReminder}"><small style="color:#166534;">Maximum: ${fmt(currentReminder)}</small></div>
        <button class="save-btn" onclick="processPayment('${branch}','${date}','${item}',${qty},${shipment.sellingPrice})"><i class="fas fa-check"></i> Process Payment</button>`;
    document.getElementById('modal').classList.add('active');
};

window.processPayment = async function (branch, date, item, qty, price) {
    let paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    if (isNaN(paymentAmount) || paymentAmount <= 0) { alert('Please enter a valid payment amount'); return; }
    let shipment = mainClientToBranchShipments.find(s => s.branch === branch && s.date === date && s.item === item && s.qty === qty);
    if (!shipment) { alert('Shipment not found!'); return; }
    let currency = getItemCurrency(item);
    let currentReminder = (shipment.sellingPrice * qty) - getShipmentPaidAmount(shipment);
    if (paymentAmount > currentReminder) { alert(`Payment cannot exceed ${formatByCurrency(currentReminder, currency)}`); return; }
    const success = await processShipmentPayment(shipment, paymentAmount);
    if (success) {
        closeModal();
        await refreshDataFromServer();
        await loadPaymentsByDate();
        alert(paymentAmount >= currentReminder ? `✅ Payment processed! Bill is fully paid.` : `✅ Payment of ${formatByCurrency(paymentAmount, currency)} processed! Remaining: ${formatByCurrency(currentReminder - paymentAmount, currency)}`);
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
                    <select id="billingBranchSelect" onchange="updateBillingBillNumberOptions()"><option value="">-- Choose a branch --</option>${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}</select>
                </div>
                <div class="filter-group" id="billingBillNumberGroup" style="display:none;">
                    <label><i class="fas fa-receipt"></i> Bill Number</label>
                    <select id="billingBillNumberSelect" onchange="toggleBillingTimePeriodDisabled()">
                        <option value="">-- Use Time Period --</option>
                    </select>
                </div>
                <div class="filter-group">
    <label><i class="fas fa-calendar-alt"></i> Time Period</label>
    <select id="billingTimePeriod" onchange="toggleBillingDateInput()" style="padding:10px;border:2px solid #e2e8f0;border-radius:8px;width:100%;">
        <option value="date">By Date</option>
        <option value="daily">Daily (Today)</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Custom Range</option>
    </select>
</div>
<div class="filter-group" id="billingDateGroup">
    <label><i class="fas fa-calendar"></i> Select Date</label>
    <input type="date" id="billingDate" value="${today}">
</div>
<div class="filter-group" id="billingCustomRange" style="display:none;">
    <label><i class="fas fa-calendar-alt"></i> Date Range</label>
    <div style="display:flex;gap:8px;align-items:center;">
        <input type="date" id="billingStartDate" value="${getWeekAgoDate()}" style="padding:8px;border:2px solid #e2e8f0;border-radius:8px;">
        <span>to</span>
        <input type="date" id="billingEndDate" value="${today}" style="padding:8px;border:2px solid #e2e8f0;border-radius:8px;">
    </div>
</div>
                <div class="filter-group"><label>&nbsp;</label><button class="btn-view" onclick="loadBillingData()" style="width:100%;"><i class="fas fa-search"></i> Load Data</button></div>
            </div>
        </div>
        <div id="billingDataContainer" style="display:none;"></div>`;
}

window.updateBillingBillNumberOptions = function() {
    let branch = document.getElementById('billingBranchSelect')?.value;
    let group = document.getElementById('billingBillNumberGroup');
    let select = document.getElementById('billingBillNumberSelect');
    if (!branch) { if (group) group.style.display = 'none'; return; }

    let billNumbers = [...new Set(
        mainClientToBranchShipments
            .filter(s => s.branch === branch && s.billNumber && s.billNumber.trim() !== '')
            .map(s => s.billNumber)
    )];

    if (select) {
        select.innerHTML = `<option value="">-- Use Time Period --</option>` + billNumbers.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    }
    if (group) group.style.display = billNumbers.length > 0 ? 'flex' : 'none';
    toggleBillingTimePeriodDisabled();
};

window.toggleBillingTimePeriodDisabled = function() {
    let billNumber = document.getElementById('billingBillNumberSelect')?.value;
    let periodSelect = document.getElementById('billingTimePeriod');
    let dateGroup = document.getElementById('billingDateGroup');
    let customRange = document.getElementById('billingCustomRange');
    let isBillSelected = !!billNumber;
    if (periodSelect) periodSelect.disabled = isBillSelected;
    if (dateGroup) dateGroup.style.opacity = isBillSelected ? '0.5' : '1';
    if (customRange) customRange.style.opacity = isBillSelected ? '0.5' : '1';
};

function isShipmentEditable(shipment) {
    if (!shipment.uniqueKey) return false;
    let paid = shipmentPayments[shipment.uniqueKey] || 0;
    if (paid > 0) return false;

    let hasReturn = branchReturns.some(r =>
        r.branch === shipment.branch && r.itemName === shipment.item &&
        (r.status === 'approved' || r.status === 'paid')
    );
    if (hasReturn) return false;

    let branchItem = (branchInventory[shipment.branch] || []).find(i => i.distributionId === shipment.uniqueKey);
    if (branchItem) {
        let orig = branchItem.originalQuantity || branchItem.quantity;
        if (branchItem.quantity !== orig) return false; // چیزی فروخته شده
    }
    return true;
}

window.showEditShipmentModal = function (uniqueKey) {
    let shipment = mainClientToBranchShipments.find(s => s.uniqueKey === uniqueKey);
    if (!shipment) return;
    if (!isShipmentEditable(shipment)) { alert('This item can no longer be edited (paid, sold, or returned).'); return; }

    let currency = getItemCurrency(shipment.item);
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Quantity: ${shipment.item} <span class="badge ${currency==='USD'?'badge-mainclient':'badge-active'}">${currency}</span></h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Current Quantity: ${shipment.qty}</label></div>
        <div class="form-group"><label>New Quantity</label><input type="number" id="editShipQty" min="1" value="${shipment.qty}">
            <small style="color:#166534;">Set to 0 to remove this item from the bill</small>
        </div>
        <div class="form-group"><label>Selling Price</label><input type="text" value="${formatByCurrency(shipment.sellingPrice, currency)}" readonly style="background:#f1f5f9;"></div>
        <button class="save-btn" onclick="saveEditedShipment('${uniqueKey}')"><i class="fas fa-save"></i> Save Changes</button>`;
    document.getElementById('modal').classList.add('active');
};

window.saveEditedShipment = async function (uniqueKey) {
    let shipment = mainClientToBranchShipments.find(s => s.uniqueKey === uniqueKey);
    if (!shipment) return;

    let newQty = parseInt(document.getElementById('editShipQty').value);
    if (isNaN(newQty) || newQty < 0) {
        alert('Please enter a valid quantity'); return;
    }

    if (newQty === 0) {
        await deleteShipmentItemInternal(shipment);
        return;
    }

    let qtyDiff = newQty - shipment.qty;

    try {
        await fetch(`/api/shipments/${shipment.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: shipment.date, branch: shipment.branch, item: shipment.item,
                qty: newQty, selling_price: shipment.sellingPrice, purchase_price: shipment.purchasePrice,
                unique_key: uniqueKey, bill_number: shipment.billNumber || ''
            })
        });

        let branchItem = (branchInventory[shipment.branch] || []).find(i => i.distributionId === uniqueKey);
        if (branchItem) {
            await fetch(`/api/branch-inventory/${branchItem.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty, original_quantity: newQty })
            });
        }

        if (qtyDiff !== 0) {
            await fetch('/api/main-client-distributed', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ main_client: currentUser.username, item_name: shipment.item, distributed_quantity: qtyDiff })
            });
        }

        closeModal();
        await refreshDataFromServer();
        await autoUpdateEditingInvoiceIfNeeded();
        await loadBillingData();
        alert(window._editingInvoiceNumber ? '✅ Quantity updated and invoice refreshed!' : '✅ Quantity updated successfully!');
    } catch (err) { alert('Failed to update item: ' + err.message); }
};

async function deleteShipmentItemInternal(shipment) {
    try {
        await fetch(`/api/shipments/${shipment.id}`, { method: 'DELETE' });
        await fetch(`/api/shipment-payment/${shipment.uniqueKey}`, { method: 'DELETE' });

        let branchItem = (branchInventory[shipment.branch] || []).find(i => i.distributionId === shipment.uniqueKey);
        if (branchItem) {
            await fetch(`/api/branch-inventory/item/${branchItem.id}`, { method: 'DELETE' });
        }

        await fetch('/api/main-client-distributed', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ main_client: currentUser.username, item_name: shipment.item, distributed_quantity: -shipment.qty })
        });

        closeModal();
        await refreshDataFromServer();
        await autoUpdateEditingInvoiceIfNeeded();
        await loadBillingData();
        alert('✅ Item removed from bill successfully!');
    } catch (err) { alert('Failed to remove item: ' + err.message); }
}

window.deleteShipmentItem = async function (uniqueKey) {
    let shipment = mainClientToBranchShipments.find(s => s.uniqueKey === uniqueKey);
    if (!shipment) return;
    if (!isShipmentEditable(shipment)) { alert('This item can no longer be deleted (paid, sold, or returned).'); return; }
    if (!confirm(`Delete ${shipment.qty} x ${shipment.item} from this bill? This cannot be undone.`)) return;
    await deleteShipmentItemInternal(shipment);
};

window.loadBillingData = async function () {
    let branch = document.getElementById('billingBranchSelect').value;
    if (!branch) { alert('Please select a branch'); return; }

    let billNumber = document.getElementById('billingBillNumberSelect')?.value || '';
    await refreshDataFromServer();

    let filteredShipments, periodLabel, startDate, endDate;

    if (billNumber) {
        filteredShipments = mainClientToBranchShipments.filter(s => s.branch === branch && s.billNumber === billNumber)
            .map(s => ({ ...s, currency: getItemCurrency(s.item) }));
        periodLabel = `Bill Number: ${billNumber}`;
        window._billingFilterContext = { type: 'billNumber', branch, billNumber };
    } else {
        let period = document.getElementById('billingTimePeriod')?.value || 'date';
        let today = getTodayDate();
        let now = new Date();

        if (period === 'date') {
            let dateInput = document.getElementById('billingDate')?.value || today;
            startDate = dateInput;
            endDate = dateInput;
        } else if (period === 'daily') {
            startDate = today;
            endDate = today;
        } else if (period === 'weekly') {
            let start = new Date(now);
            start.setDate(now.getDate() - 7);
            startDate = start.toISOString().split('T')[0];
            endDate = today;
        } else if (period === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = today;
        } else if (period === 'custom') {
            startDate = document.getElementById('billingStartDate')?.value;
            endDate = document.getElementById('billingEndDate')?.value;
            if (!startDate || !endDate) { alert('Please select date range'); return; }
        }

        filteredShipments = mainClientToBranchShipments.filter(s => {
            let shipmentDate = formatDateForCompare(s.date);
            if (s.branch !== branch) return false;
            if (startDate === endDate) return shipmentDate === startDate;
            return shipmentDate >= startDate && shipmentDate <= endDate;
        }).map(s => ({ ...s, currency: getItemCurrency(s.item) }));

        periodLabel = period === 'date' ? startDate :
                      period === 'daily' ? `Today (${today})` :
                      `${startDate} to ${endDate}`;

        window._billingFilterContext = { type: 'date', branch, startDate, endDate };
    }

    let afgShipments = filteredShipments.filter(s => s.currency !== 'USD');
    let usdShipments = filteredShipments.filter(s => s.currency === 'USD');

    let totalItems = filteredShipments.reduce((sum, s) => sum + s.qty, 0);
    let afgTotalValue = afgShipments.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
    let usdTotalValue = usdShipments.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);

    let html = `
        <div class="branch-inventory-header">
            <h3><i class="fas fa-truck"></i> Shipments Report</h3>
            <h4 style="color:#166534;margin-top:10px;">Branch: ${branch} | ${periodLabel}</h4>
        </div>
        ${filteredShipments.length === 0
            ? `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No Shipments Found</h3><p>No items match this filter.</p></div>`
            : `<div class="table-wrapper"><table class="report-table">
                                <thead><tr><th>Item Name</th><th>Currency</th><th>Date</th><th>Quantity</th><th>Selling Price/Unit</th><th>Total Price</th><th>Action</th></tr></thead>
                <tbody>${filteredShipments.sort((a,b) => new Date(b.date)-new Date(a.date)).map(s => {
                    let discount = getItemDiscount(s.item);
                    let isFullyPaid = getShipmentStatus(s) === 'paid';
                    let fmt = (v) => formatByCurrency(v, s.currency);
                    let priceDisplay = (discount && !isFullyPaid)
                        ? `<span style="text-decoration:line-through;color:#94a3b8;font-size:12px;">${fmt(discount.originalPrice)}</span><br><span style="color:#22c55e;font-weight:600;">${fmt(discount.newPrice)}</span>`
                        : fmt(s.sellingPrice);
                    let editable = isShipmentEditable(s);
                    let actionHtml = editable
                        ? `<button class="btn btn-edit" onclick="showEditShipmentModal('${s.uniqueKey}')"><i class="fas fa-edit"></i></button>
                           <button class="btn btn-delete" onclick="deleteShipmentItem('${s.uniqueKey}')"><i class="fas fa-trash"></i></button>`
                        : `<span class="badge badge-active" style="font-size:11px;">Locked</span>`;
                    return `<tr><td>${escapeHtml(s.item)}</td><td><span class="badge ${s.currency==='USD'?'badge-mainclient':'badge-active'}">${s.currency}</span></td><td>${s.date}</td><td>${s.qty}</td><td>${priceDisplay}</td><td class="total-value">${fmt(getShipmentCorrectTotal(s))}</td><td>${actionHtml}</td></tr>`;
                }).join('')}</tbody>
               </table></div>`
        }
        <div class="summary-box">
            <h3 style="margin-bottom:20px;color:#166534;">Summary</h3>
            <div class="summary-row"><span class="summary-label">Total Items Shipped:</span><span class="summary-value">${totalItems}</span></div>
            <div class="summary-row"><span class="summary-label">Total Value (AFG):</span><span class="summary-value">${formatMoney(afgTotalValue)}</span></div>
            ${usdShipments.length > 0 ? `<div class="summary-row"><span class="summary-label">Total Value (USD):</span><span class="summary-value">${formatByCurrency(usdTotalValue,'USD')}</span></div>` : ''}
            <div class="summary-row"><span class="summary-label">Number of Shipments:</span><span class="summary-value">${filteredShipments.length}</span></div>
        </div>
                ${filteredShipments.length > 0 ? (() => {
            let billNumbersInResult = [...new Set(filteredShipments.map(s => s.billNumber).filter(b => b && b.trim() !== ''))];
            if (billNumber) {
                return `<div style="text-align:right;margin-top:20px;">
                    <button class="action-btn" onclick="generateInvoice()"><i class="fas fa-file-invoice"></i> Print Bill: ${escapeHtml(billNumber)}</button>
                </div>`;
            } else if (billNumbersInResult.length === 1) {
                return `<div style="text-align:right;margin-top:20px;">
                    <button class="action-btn" onclick="generateInvoice()"><i class="fas fa-file-invoice"></i> Print Bill: ${escapeHtml(billNumbersInResult[0])}</button>
                </div>`;
            } else if (billNumbersInResult.length > 1) {
                return `<div style="margin-top:20px;">
                    <p style="color:#166534;margin-bottom:10px;"><i class="fas fa-info-circle"></i> Multiple bills found in this period. Select one to print:</p>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        ${billNumbersInResult.map(b => `<button class="action-btn" onclick="generateInvoiceForBillNumber('${b.replace(/'/g,"\\'")}')"><i class="fas fa-file-invoice"></i> ${escapeHtml(b)}</button>`).join('')}
                    </div>
                </div>`;
            } else {
                return `<div style="margin-top:20px;color:#94a3b8;">No bill number found for these shipments.</div>`;
            }
        })() : ''}`;

    document.getElementById('billingDataContainer').style.display = 'block';
    document.getElementById('billingDataContainer').innerHTML = html;
};

window.toggleBillingDateInput = function() {
    let period = document.getElementById('billingTimePeriod')?.value || 'date';
    let dateGroup = document.getElementById('billingDateGroup');
    let customRange = document.getElementById('billingCustomRange');
    
    if (period === 'custom') {
        if (dateGroup) dateGroup.style.display = 'none';
        if (customRange) customRange.style.display = 'block';
    } else if (period === 'date') {
        if (dateGroup) dateGroup.style.display = 'block';
        if (customRange) customRange.style.display = 'none';
    } else {
        if (dateGroup) dateGroup.style.display = 'none';
        if (customRange) customRange.style.display = 'none';
    }
};



window.generateInvoice = async function () {
    let ctx = window._billingFilterContext || {};
    let branch = ctx.branch;
    let mainClient = currentUser.username;

    let invoiceNumber = ctx.billNumber || '';
    if (!invoiceNumber) { alert('No bill number found for this selection.'); return; }
    await generateInvoiceCore(invoiceNumber, branch, mainClient, ctx);
};

window.generateInvoiceForBillNumber = async function (billNumber) {
    let ctx = window._billingFilterContext || {};
    let branch = ctx.branch;
    let mainClient = currentUser.username;
    await generateInvoiceCore(billNumber, branch, mainClient, { ...ctx, billNumber, type: 'billNumber' });
};

async function generateInvoiceCore(invoiceNumber, branch, mainClient, ctx) {
    let dailyShipments = mainClientToBranchShipments.filter(s => s.branch === branch && s.billNumber === invoiceNumber)
        .map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let dateLabel = `Bill Number: ${invoiceNumber}`;

    let afgShip = dailyShipments.filter(s => s.currency !== 'USD');
    let usdShip = dailyShipments.filter(s => s.currency === 'USD');

    let totalItems = dailyShipments.reduce((sum, s) => sum + s.qty, 0);
    let totalValueAFG = afgShip.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
    let totalValueUSD = usdShip.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);

    let allTimeShipments = mainClientToBranchShipments.filter(s => s.branch === branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let allTimeAfg = allTimeShipments.filter(s => s.currency !== 'USD');
    let allTimeUsd = allTimeShipments.filter(s => s.currency === 'USD');

    let allTimeTotalItems = allTimeShipments.reduce((sum, s) => sum + s.qty, 0);
    let allTimeTotalValueAFG = allTimeAfg.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
    let allTimeTotalValueUSD = allTimeUsd.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
    let allTimePaidAFG = allTimeAfg.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
    let allTimePaidUSD = allTimeUsd.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
    let allTimeUnpaidAFG = allTimeTotalValueAFG - allTimePaidAFG;
    let allTimeUnpaidUSD = allTimeTotalValueUSD - allTimePaidUSD;

    try {
        const checkRes = await fetch(`/api/invoices/${invoiceNumber}`);
        const method = checkRes.ok ? 'PUT' : 'POST';
        const url = checkRes.ok ? `/api/invoices/by-number/${invoiceNumber}` : '/api/invoices';
        const body = method === 'POST'
            ? { number: invoiceNumber, main_client: mainClient, branch, date: dateLabel,
                total_items: totalItems, total_value: totalValueAFG,
                all_time_total_items: allTimeTotalItems, all_time_total_value: allTimeTotalValueAFG,
                all_time_paid: allTimePaidAFG, all_time_unpaid: allTimeUnpaidAFG, items: dailyShipments }
            : { total_items: totalItems, total_value: totalValueAFG,
                all_time_total_items: allTimeTotalItems, all_time_total_value: allTimeTotalValueAFG,
                all_time_paid: allTimePaidAFG, all_time_unpaid: allTimeUnpaidAFG, items: dailyShipments };

        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error('Failed to save invoice');

        if (!invoices.find(i => i.number === invoiceNumber)) {
            invoices.push({ number: invoiceNumber, mainClient, branch, date: dateLabel, shipments: dailyShipments, totalItems, totalValue: totalValueAFG, createdAt: new Date().toISOString() });
        }
        showInvoicePrint(invoiceNumber, mainClient, branch, dateLabel, dailyShipments, totalItems, totalValueAFG, totalValueUSD, allTimeTotalItems, allTimeTotalValueAFG, allTimeTotalValueUSD, allTimePaidAFG, allTimePaidUSD, allTimeUnpaidAFG, allTimeUnpaidUSD);
    } catch (error) { alert('Failed to generate invoice: ' + error.message); }
}

function showInvoicePrint(invoiceNumber, mainClient, branch, date, shipments, totalItems, totalValueAFG, totalValueUSD, allTimeTotalItems, allTimeTotalValueAFG, allTimeTotalValueUSD, allTimePaidAFG, allTimePaidUSD, allTimeUnpaidAFG, allTimeUnpaidUSD) {
    let hasUSD = shipments.some(s => s.currency === 'USD');
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
                <thead><tr><th>Item Name</th><th>Currency</th><th>Date</th><th>Quantity</th><th>Selling Price/Unit</th><th>Total Price</th></tr></thead>
                <tbody>${shipments.map(s => {
                    let cur = s.currency || 'AFG';
                    return `<tr><td>${s.item}</td><td>${cur}</td><td>${s.date}</td><td>${s.qty}</td><td>${formatByCurrency(s.sellingPrice, cur)}</td><td class="total-value">${formatByCurrency(getShipmentCorrectTotal(s), cur)}</td></tr>`;
                }).join('')}</tbody>
                <tfoot>
                    <tr class="grand-total"><td colspan="5"><strong>Total Items (This Bill):</strong></td><td><strong>${totalItems}</strong></td></tr>
                    <tr class="grand-total"><td colspan="5"><strong>Total Value AFG (This Bill):</strong></td><td><strong>${formatMoney(totalValueAFG)}</strong></td></tr>
                    ${hasUSD ? `<tr class="grand-total"><td colspan="5"><strong>Total Value USD (This Bill):</strong></td><td><strong>${formatByCurrency(totalValueUSD,'USD')}</strong></td></tr>` : ''}
                </tfoot>
            </table>
            <div class="all-time-summary" style="margin-top:30px;padding-top:20px;border-top:2px solid #333;">
                <h3 style="text-align:center;margin-bottom:15px;">Branch Summary (All Time)</h3>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span><strong>Total Items Shipped (All Time):</strong></span><span><strong>${allTimeTotalItems}</strong></span></div>
                <h4 style="margin:15px 0 8px;color:#166534;">Afghani (AFG)</h4>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Value:</span><span><strong>${formatMoney(allTimeTotalValueAFG)}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Paid:</span><span style="color:#22c55e;"><strong>${formatMoney(allTimePaidAFG)}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Unpaid:</span><span style="color:#ef4444;"><strong>${formatMoney(allTimeUnpaidAFG)}</strong></span></div>
                ${hasUSD ? `
                <h4 style="margin:15px 0 8px;color:#2563eb;">US Dollar (USD)</h4>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Value:</span><span><strong>${formatByCurrency(allTimeTotalValueUSD,'USD')}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Paid:</span><span style="color:#22c55e;"><strong>${formatByCurrency(allTimePaidUSD,'USD')}</strong></span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Unpaid:</span><span style="color:#ef4444;"><strong>${formatByCurrency(allTimeUnpaidUSD,'USD')}</strong></span></div>` : ''}
            </div>
            <div class="invoice-total">Grand Total (This Bill): ${formatMoney(totalValueAFG)}${hasUSD ? ` + ${formatByCurrency(totalValueUSD,'USD')}` : ''}</div>
            <div class="invoice-footer"><p>Generated by ${mainClient}</p><p>This is a computer generated invoice.</p></div>
        </div>
        <div style="text-align:center;margin-top:20px;" class="no-print"><button class="close-btn" onclick="closeInvoiceModal()">Close</button></div>`;
    document.getElementById('invoiceModal').classList.add('active');
    setTimeout(() => window.print(), 500);
}

// ==================== MAIN CLIENT INVOICES ====================
async function renderMainClientInvoices() {
    await refreshDataFromServer();
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
                <td>
                    <button class="btn btn-edit" onclick="viewMainClientInvoice('${inv.number}')"><i class="fas fa-eye"></i> View</button>
                    ${isBillCurrentlyEditable(inv.branch, inv.date) ? `<button class="btn btn-warning" onclick="editMainClientInvoiceBill('${inv.branch}', '${inv.date.replace(/'/g,"\\'")}', '${inv.number}')"><i class="fas fa-edit"></i> Edit</button>` : ''}                </td>            
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

            let items = (invoice.items || []).map(item => {
                let name = item.item_name || item.item;
                let currency = getItemCurrency(name);
                let price = parseFloat(item.selling_price) || 0;
                let qty = parseInt(item.quantity) || 0;
                let total = parseFloat(item.total_price) || (price * qty);
                return { name, date: item.date || '-', qty, price, total, currency };
            });
            let afgItems = items.filter(i => i.currency !== 'USD');
            let usdItems = items.filter(i => i.currency === 'USD');
            let totalAFG = afgItems.reduce((sum, i) => sum + i.total, 0);
            let totalUSD = usdItems.reduce((sum, i) => sum + i.total, 0);
            let hasUSD = usdItems.length > 0;

            let allTimeShipments = mainClientToBranchShipments.filter(s => s.branch === invoice.branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
            let allTimeAfg = allTimeShipments.filter(s => s.currency !== 'USD');
            let allTimeUsd = allTimeShipments.filter(s => s.currency === 'USD');
            let allTimeTotalItems = allTimeShipments.reduce((sum, s) => sum + s.qty, 0);
            let allTimeTotalValueAFG = allTimeAfg.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
            let allTimeTotalValueUSD = allTimeUsd.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
            let allTimePaidAFG = allTimeAfg.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
            let allTimePaidUSD = allTimeUsd.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
            let allTimeUnpaidAFG = allTimeTotalValueAFG - allTimePaidAFG;
            let allTimeUnpaidUSD = allTimeTotalValueUSD - allTimePaidUSD;

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
                        <thead><tr><th>Item Name</th><th>Currency</th><th>Date</th><th>Quantity</th><th>Selling Price</th><th>Total Price</th></tr></thead>
                        <tbody>${items.length > 0 ? items.map(item => `<tr><td>${item.name}</td><td>${item.currency}</td><td>${item.date}</td><td>${item.qty}</td><td>${formatByCurrency(item.price, item.currency)}</td><td>${formatByCurrency(item.total, item.currency)}</td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;">No items found</td></tr>'}</tbody>
                        <tfoot>
                            <tr class="grand-total"><td colspan="5"><strong>Total Items: ${invoice.total_items || 0}</strong></td><td><strong>${formatMoney(totalAFG)}</strong></td></tr>
                            ${hasUSD ? `<tr class="grand-total"><td colspan="5"><strong>Grand Total (USD):</strong></td><td><strong>${formatByCurrency(totalUSD,'USD')}</strong></td></tr>` : ''}
                        </tfoot>
                    </table>
                    <div class="all-time-summary" style="margin-top:30px;padding-top:20px;border-top:2px solid #333;">
                        <h3 style="text-align:center;margin-bottom:15px;">Branch Summary (Current)</h3>
                        <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span><strong>Total Items Shipped (All Time):</strong></span><span><strong>${allTimeTotalItems}</strong></span></div>
                        <h4 style="margin:15px 0 8px;color:#166534;">Afghani (AFG)</h4>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Value:</span><span><strong>${formatMoney(allTimeTotalValueAFG)}</strong></span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Paid:</span><span style="color:#22c55e;"><strong>${formatMoney(allTimePaidAFG)}</strong></span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Unpaid:</span><span style="color:#ef4444;"><strong>${formatMoney(allTimeUnpaidAFG)}</strong></span></div>
                        ${allTimeUsd.length > 0 ? `
                        <h4 style="margin:15px 0 8px;color:#2563eb;">US Dollar (USD)</h4>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Value:</span><span><strong>${formatByCurrency(allTimeTotalValueUSD,'USD')}</strong></span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Paid:</span><span style="color:#22c55e;"><strong>${formatByCurrency(allTimePaidUSD,'USD')}</strong></span></div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total Unpaid:</span><span style="color:#ef4444;"><strong>${formatByCurrency(allTimeUnpaidUSD,'USD')}</strong></span></div>` : ''}
                    </div>
                    <div class="invoice-total">Grand Total (AFG): ${formatMoney(totalAFG)}${hasUSD ? ` + ${formatByCurrency(totalUSD,'USD')}` : ''}</div>
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

async function autoUpdateEditingInvoiceIfNeeded() {
    let invoiceNumber = window._editingInvoiceNumber;
    if (!invoiceNumber) return;

    let ctx = window._billingFilterContext;
    if (!ctx || !ctx.branch) return;

    let shipments;
    if (ctx.type === 'billNumber') {
        shipments = mainClientToBranchShipments.filter(s => s.branch === ctx.branch && s.billNumber === ctx.billNumber);
    } else {
        shipments = mainClientToBranchShipments.filter(s => {
            let d = formatDateForCompare(s.date);
            if (s.branch !== ctx.branch) return false;
            if (ctx.startDate === ctx.endDate) return d === ctx.startDate;
            return d >= ctx.startDate && d <= ctx.endDate;
        });
    }
    shipments = shipments.map(s => ({ ...s, currency: getItemCurrency(s.item) }));

    let afgShip = shipments.filter(s => s.currency !== 'USD');
    let totalItems = shipments.reduce((sum, s) => sum + s.qty, 0);
    let totalValueAFG = afgShip.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);

    let allTimeShipments = mainClientToBranchShipments.filter(s => s.branch === ctx.branch).map(s => ({ ...s, currency: getItemCurrency(s.item) }));
    let allTimeAfg = allTimeShipments.filter(s => s.currency !== 'USD');
    let allTimeTotalItems = allTimeShipments.reduce((sum, s) => sum + s.qty, 0);
    let allTimeTotalValueAFG = allTimeAfg.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
    let allTimePaidAFG = allTimeAfg.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);
    let allTimeUnpaidAFG = allTimeTotalValueAFG - allTimePaidAFG;

    try {
        await fetch(`/api/invoices/by-number/${invoiceNumber}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                total_items: totalItems, total_value: totalValueAFG,
                all_time_total_items: allTimeTotalItems, all_time_total_value: allTimeTotalValueAFG,
                all_time_paid: allTimePaidAFG, all_time_unpaid: allTimeUnpaidAFG,
                items: shipments
            })
        });
    } catch (err) { console.log('Error auto-updating invoice:', err); }
}

function getShipmentsForBillLabel(branch, dateLabel) {
    if (dateLabel && dateLabel.startsWith('Bill Number: ')) {
        let billNumber = dateLabel.replace('Bill Number: ', '');
        return mainClientToBranchShipments.filter(s => s.branch === branch && s.billNumber === billNumber);
    } else if (dateLabel && dateLabel.includes(' to ')) {
        let [start, end] = dateLabel.split(' to ');
        return mainClientToBranchShipments.filter(s => {
            let d = formatDateForCompare(s.date);
            return s.branch === branch && d >= start && d <= end;
        });
    } else if (dateLabel) {
        return mainClientToBranchShipments.filter(s => s.branch === branch && formatDateForCompare(s.date) === dateLabel);
    }
    return [];
}

function isBillCurrentlyEditable(branch, dateLabel) {
    let shipments = getShipmentsForBillLabel(branch, dateLabel);
    if (shipments.length === 0) return false;
    return shipments.every(s => isShipmentEditable(s));
}

window.editMainClientInvoiceBill = async function (branch, dateLabel, invoiceNumber) {
    window._editingInvoiceNumber = invoiceNumber || null;
    await renderMainClientBilling();
    document.getElementById('billingBranchSelect').value = branch;
    updateBillingBillNumberOptions();

    if (dateLabel.startsWith('Bill Number: ')) {
        let billNumber = dateLabel.replace('Bill Number: ', '');
        let sel = document.getElementById('billingBillNumberSelect');
        if (sel) sel.value = billNumber;
        toggleBillingTimePeriodDisabled();
    } else if (dateLabel.includes(' to ')) {
        let [start, end] = dateLabel.split(' to ');
        document.getElementById('billingTimePeriod').value = 'custom';
        toggleBillingDateInput();
        document.getElementById('billingStartDate').value = start;
        document.getElementById('billingEndDate').value = end;
    } else {
        document.getElementById('billingTimePeriod').value = 'date';
        toggleBillingDateInput();
        document.getElementById('billingDate').value = dateLabel;
    }
    await loadBillingData();
};

// ==================== MAIN CLIENT REPORT ====================
async function renderMainClientReport() {
    let branches = getBranchUsers();
    let mainClient = currentUser.username;
    let clientExps = [];
    try {
        const response = await fetch(`/api/expenses/mainclient/${mainClient}`);
        if (response.ok) {
            clientExps = (await response.json()).map(e => ({ id: e.id, date: e.date ? e.date.split('T')[0] : getTodayDate(), category: e.category, amount: parseFloat(e.amount), description: e.description, currency: e.currency || 'AFG' }));
            mainClientExpenses[mainClient] = clientExps;
        } else clientExps = mainClientExpenses[mainClient] || [];
    } catch (err) { clientExps = mainClientExpenses[mainClient] || []; }

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

    let clientItems = await getMainClientItems();
    let approvedReturns = branchReturns.filter(r => r.status === 'approved' || r.status === 'paid');

   
    let paymentToAdminTotalAFG = 0, paymentToAdminTotalUSD = 0;
    try {
        const paRes = await fetch(`/api/payments-to-admin/${currentUser.username}`);
        if (paRes.ok) {
            const paData = await paRes.json();
            paymentToAdminTotalAFG = paData.filter(p => p.status === 'paid' && (p.currency||'AFG') !== 'USD').reduce((sum, p) => sum + parseFloat(p.amount), 0);
            paymentToAdminTotalUSD = paData.filter(p => p.status === 'paid' && p.currency === 'USD').reduce((sum, p) => sum + parseFloat(p.amount), 0);
        }
    } catch(err) { console.log('Error loading payment to admin:', err); }

    function buildMyReportBlock(currency) {
        let fmt = (v) => formatByCurrency(v, currency);
        let itemsCur = clientItems.filter(i => (i.currency || 'AFG') === currency);
        let returnsCur = approvedReturns.filter(r => {
            let item = mainInventory.find(mi => mi.name === r.itemName);
            return (item ? (item.currency || 'AFG') : 'AFG') === currency;
        });

        function getCorrectItemValue(item) {
            let discount = getItemDiscount(item.name);
            let curP = item.sellingPrice || 0;
            let origP = discount ? parseFloat(discount.originalPrice) : curP;
            let sold = salesHistory.filter(s => s.item === item.name).reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);
            let actualSold = Math.min(sold, item.quantity || 0);
            let unsold = Math.max(0, (item.quantity || 0) - actualSold);
            return (actualSold * origP) + (unsold * curP);
        }

        let paidItemsCount = itemsCur.filter(i => i.paid === true).length;
        let unpaidItemsCount = itemsCur.length - paidItemsCount;
        let totalPaid = itemsCur.filter(i => i.paid === true).reduce((sum,i) => sum + getCorrectItemValue(i), 0);
        let totalUnpaid = itemsCur.filter(i => i.paid !== true).reduce((sum,i) => sum + getCorrectItemValue(i), 0);
        let totalExpenses = clientExps.filter(e => (e.currency || 'AFG') === currency).reduce((sum, exp) => sum + exp.amount, 0);
        let returnsValue = returnsCur.reduce((sum, r) => sum + ((r.quantity||0)*(r.pricePerUnit||0)), 0);

        let salesInCur = salesHistory.filter(s => getItemCurrency(s.item) === currency);
        let totalSold = salesInCur.reduce((sum, s) => sum + s.qty, 0);
        let totalRevenue = salesInCur.reduce((sum, s) => sum + s.revenue, 0);

        let invInCur = mainInventory.filter(i => (i.currency || 'AFG') === currency);
        let totalItemsValue = invInCur.reduce((sum, item) => sum + calculateItemSaleValue(item), 0);

        let shipmentsInCur = mainClientToBranchShipments.filter(s => getItemCurrency(s.item) === currency);
        let paymentFromBranchesConfirmed = 0, paymentFromBranchesPartial = 0;
        shipmentsInCur.forEach(s => {
            let paid = getShipmentPaidAmount(s);
            let displayStatus = getShipmentDisplayStatus(s);
            if (displayStatus === 'paid') paymentFromBranchesConfirmed += paid;
            else if (displayStatus === 'partial') paymentFromBranchesPartial += paid;
        });

        return `
        <div class="summary-cards-grid">
            <div class="summary-card-large">
                <h4><i class="fas fa-box"></i> Shared Inventory</h4>
                <div class="amount">${itemsCur.length}</div><div class="subtitle">Total Items</div>
                <div style="margin-top:15px;">
                    <div class="summary-stats-row"><span class="label">Paid Items:</span><span class="value profit">${paidItemsCount}</span></div>
                    <div class="summary-stats-row"><span class="label">Unpaid Items:</span><span class="value loss">${unpaidItemsCount}</span></div>
                </div>
            </div>
            <div class="summary-card-large paid">
                <h4><i class="fas fa-credit-card"></i> My Payments</h4>
                <div class="amount">${fmt(totalPaid)}</div><div class="subtitle">Remaining Stock Value</div>
                <div style="margin-top:15px;">
                    <div class="summary-stats-row"><span class="label">Unpaid to Admin:</span><span class="value">${fmt(totalUnpaid)}</span></div>
                </div>
            </div>
            <div class="summary-card-large warning">
                <h4><i class="fas fa-file-invoice"></i> My Expenses & Returns</h4>
                <div class="amount">${fmt(totalExpenses)}</div><div class="subtitle">Total Expenses</div>
                <div style="margin-top:15px;">
                    <div class="summary-stats-row"><span class="label">Returns Value:</span><span class="value">${fmt(returnsValue)}</span></div>
                    <div class="summary-stats-row"><span class="label">Net Balance:</span><span class="value ${(totalPaid - totalExpenses) >= 0 ? 'profit' : 'loss'}">${fmt(totalPaid - totalExpenses)}</span></div>
                </div>
            </div>
        </div>
        <div class="summary-cards-grid">
            <div class="summary-card-large">
                <h4><i class="fas fa-shopping-cart"></i> Branches Sales</h4>
                <div class="amount">${totalSold}</div><div class="subtitle">Total Items Sold</div>
                <div style="margin-top:15px;">
                <div class="summary-stats-row"><span class="label">Total Revenue:</span><span class="value">${fmt(totalRevenue)}</span></div>
                </div>
            </div>
            <div class="summary-card-large" style="background:linear-gradient(145deg,#3b82f6,#2563eb);">
                <h4 style="color:white;"><i class="fas fa-tags"></i> Total Sales Price</h4>
                <div class="amount" style="color:white;font-size:22px;">${fmt(totalItemsValue)}</div>
                <div class="subtitle" style="color:rgba(255,255,255,0.8);">Total Items Value from Admin</div>
            </div>
            <div class="summary-card-large" style="background:linear-gradient(145deg,#166534,#14532d);">
                <h4 style="color:white;"><i class="fas fa-hand-holding-usd"></i> Payment to Admin</h4>
                <div class="amount" style="color:white;font-size:22px;">${currency === 'USD' ? fmt(paymentToAdminTotalUSD) : fmt(paymentToAdminTotalAFG)}</div>
                <div class="subtitle" style="color:rgba(255,255,255,0.8);">Confirmed paid payments</div>
            </div>
            <div class="summary-card-large" style="background:linear-gradient(145deg,#22c55e,#16a34a);">
                <h4 style="color:white;"><i class="fas fa-store"></i> Payment from All Branches</h4>
                <div class="amount" style="color:white;font-size:22px;">${fmt(paymentFromBranchesConfirmed)}</div>
                <div class="subtitle" style="color:rgba(255,255,255,0.8);">Confirmed by Admin (Paid)</div>
            </div>
            <div class="summary-card-large" style="background:linear-gradient(145deg,#f59e0b,#d97706);">
                <h4 style="color:white;"><i class="fas fa-hourglass-half"></i> Partial Amount</h4>
                <div class="amount" style="color:white;font-size:22px;">${fmt(paymentFromBranchesPartial)}</div>
                <div class="subtitle" style="color:rgba(255,255,255,0.8);">Received, awaiting Admin confirmation</div>
            </div>
        </div>`;
    }

    let html = `
        <div class="header-actions"><h2 class="page-title">Complete Reports</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
        <div class="report-tabs">
            <button class="report-tab active" onclick="showMainClientOwnReport()">My Report</button>
            <button class="report-tab" onclick="showMainClientBranchReportSelector()">Branch Report</button>
        </div>

        <div id="mainClientOwnReport">
            <h3 style="margin-bottom:20px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
            ${buildMyReportBlock('AFG')}
            <h3 style="margin:30px 0 20px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
            ${buildMyReportBlock('USD')}
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
    let topFilter = document.getElementById('mcReportTopFilter');
    if (topFilter) topFilter.style.display = 'none';
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
    try {
        const res = await fetch(`/api/branch-inventory/${branch}`);
        branchInv = (await res.json()).map(b => ({ name: b.item_name, quantity: parseInt(b.quantity), sellingPrice: parseFloat(b.selling_price), purchasePrice: parseFloat(b.purchase_price) }));
    } catch (err) {}
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

    let allShipments = mainClientToBranchShipments.filter(s => s.branch === branch);

    let filteredShipments = allShipments.filter(s => {
        let d = new Date(s.date); d.setHours(0, 0, 0, 0);
        let sd = new Date(startDate); sd.setHours(0, 0, 0, 0);
        let ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
        return d >= sd && d <= ed;
    }).map(s => {
        let currency = getItemCurrency(s.item);
        let totalPrice = getShipmentCorrectTotal(s);
        let paidAmount = Math.min((s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) ? shipmentPayments[s.uniqueKey] : 0, totalPrice);
        let reminder = totalPrice - paidAmount;
        let status = getShipmentDisplayStatus(s);
        return { ...s, date: formatDateForCompare(s.date), reminder, paidAmount, status, totalPrice, currency };
    });

    let afgShip = filteredShipments.filter(s => s.currency !== 'USD');
    let usdShip = filteredShipments.filter(s => s.currency === 'USD');

    function sumOf(list, field) { return list.reduce((sum, s) => sum + s[field], 0); }

    let currentStock = branchInv.reduce((sum, i) => sum + (i.quantity || 0), 0);

    let html = `<div id="reportResultContainer">
        <h3 style="margin:30px 0 20px;">Branch Report: ${branch}</h3>
        <h4 style="color:#166534;margin-bottom:20px;">Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</h4>
        <div class="summary-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:15px;">
            <div class="summary-card paid" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><h4 style="color:white;"><i class="fas fa-check-circle"></i> Total Paid (AFG)</h4><div class="amount" style="color:white;font-size:26px;">${formatMoney(sumOf(afgShip,'paidAmount'))}</div></div>
            <div class="summary-card unpaid" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><h4 style="color:white;"><i class="fas fa-clock"></i> Total Unpaid (AFG)</h4><div class="amount" style="color:white;font-size:26px;">${formatMoney(sumOf(afgShip,'reminder'))}</div></div>
            <div class="summary-card today" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><h4 style="color:white;"><i class="fas fa-boxes"></i> Current Stock</h4><div class="amount" style="color:white;font-size:26px;">${currentStock}</div></div>
        </div>
        ${usdShip.length > 0 ? `
        <div class="summary-cards" style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:30px;">
            <div class="summary-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><h4 style="color:white;"><i class="fas fa-check-circle"></i> Total Paid (USD)</h4><div class="amount" style="color:white;font-size:26px;">${formatByCurrency(sumOf(usdShip,'paidAmount'),'USD')}</div></div>
            <div class="summary-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><h4 style="color:white;"><i class="fas fa-clock"></i> Total Unpaid (USD)</h4><div class="amount" style="color:white;font-size:26px;">${formatByCurrency(sumOf(usdShip,'reminder'),'USD')}</div></div>
        </div>` : `<div style="margin-bottom:30px;"></div>`}

        ${filteredShipments.length === 0
            ? `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No shipments in this period</h3></div>`
            : `<div class="table-wrapper"><table class="report-table">
                <thead><tr><th>Date</th><th>Item</th><th>Currency</th><th>Qty</th><th>Selling Price</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
                <tbody>${filteredShipments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => {
                    let bc = s.status === 'paid' ? 'badge-paid' : (s.status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                    let fmt = (v) => formatByCurrency(v, s.currency);
                    return `<tr><td>${s.date}</td><td>${s.item}</td><td><span class="badge ${s.currency==='USD'?'badge-mainclient':'badge-active'}">${s.currency}</span></td><td>${s.qty}</td><td>${fmt(s.sellingPrice)}</td><td class="total-value">${fmt(s.totalPrice)}</td><td class="status-paid">${fmt(s.paidAmount)}</td><td class="reminder-amount">${fmt(s.reminder)}</td><td><span class="badge ${bc}">${s.status.toUpperCase()}</span></td></tr>`;
                }).join('')}</tbody>
                <tfoot>
                    <tr class="grand-total"><td colspan="5"><strong>Grand Total (AFG)</strong></td><td><strong>${formatMoney(sumOf(afgShip,'totalPrice'))}</strong></td><td><strong>${formatMoney(sumOf(afgShip,'paidAmount'))}</strong></td><td><strong>${formatMoney(sumOf(afgShip,'reminder'))}</strong></td><td></td></tr>
                    ${usdShip.length > 0 ? `<tr class="grand-total" style="background:#eff6ff;"><td colspan="5"><strong>Grand Total (USD)</strong></td><td><strong>${formatByCurrency(sumOf(usdShip,'totalPrice'),'USD')}</strong></td><td><strong>${formatByCurrency(sumOf(usdShip,'paidAmount'),'USD')}</strong></td><td><strong>${formatByCurrency(sumOf(usdShip,'reminder'),'USD')}</strong></td><td></td></tr>` : ''}
                </tfoot>
            </table></div>`
        }
    </div>`;

    let branchSalesFiltered = salesHistory.filter(s => {
        let d = new Date(s.date); d.setHours(0,0,0,0);
        let sd = new Date(startDate); sd.setHours(0,0,0,0);
        let ed = new Date(endDate); ed.setHours(23,59,59,999);
        return s.branch === branch && d >= sd && d <= ed;
    }).map(s => ({ ...s, currency: getItemCurrency(s.item) }));

    html += `<h3 style="margin:30px 0 20px;">Branch Sales</h3>`;

    if (branchSalesFiltered.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-shopping-cart"></i><h3>No Sales in This Period</h3></div>`;
    } else {
        let afgSales = branchSalesFiltered.filter(s => s.currency !== 'USD');
        let usdSales = branchSalesFiltered.filter(s => s.currency === 'USD');
        let totalSaleAFG = afgSales.reduce((sum, s) => sum + s.revenue, 0);
        let totalSaleUSD = usdSales.reduce((sum, s) => sum + s.revenue, 0);
        html += `
            <div class="table-wrapper"><table class="inventory-table">
                <thead><tr><th>Item Name</th><th>Currency</th><th>Stock Sold</th><th>Sale Date</th><th>Price per Unit</th><th>Total Price</th></tr></thead>
                <tbody>${branchSalesFiltered.sort((a,b) => new Date(b.date) - new Date(a.date)).map(s => `
                    <tr>
                        <td>${s.item}</td><td><span class="badge ${s.currency==='USD'?'badge-mainclient':'badge-active'}">${s.currency}</span></td><td>${s.qty}</td><td>${s.date}</td>
                        <td>${formatByCurrency(s.price, s.currency)}</td>
                        <td class="total-value">${formatByCurrency(s.revenue, s.currency)}</td>
                    </tr>`).join('')}
                </tbody>
                <tfoot>
                    <tr class="grand-total">
                        <td colspan="5"><strong>Total Sale Price (AFG)</strong></td>
                        <td><strong>${formatMoney(totalSaleAFG)}</strong></td>
                    </tr>
                    ${usdSales.length > 0 ? `<tr class="grand-total" style="background:#eff6ff;">
                        <td colspan="5"><strong>Total Sale Price (USD)</strong></td>
                        <td><strong>${formatByCurrency(totalSaleUSD,'USD')}</strong></td>
                    </tr>` : ''}
                </tfoot>
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

    let afgPayments = payments.filter(p => (p.currency || 'AFG') !== 'USD');
    let usdPayments = payments.filter(p => p.currency === 'USD');

    let totalPaidAFG = afgPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    let totalUnpaidAFG = afgPayments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    let totalPaidUSD = usdPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + parseFloat(p.amount), 0);
    let totalUnpaidUSD = usdPayments.filter(p => p.status === 'unpaid').reduce((sum, p) => sum + parseFloat(p.amount), 0);

    let html = `
        <div class="header-actions"><h2 class="page-title">Payment to Admin</h2><button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button></div>

        <h3 style="margin-bottom:15px;"><i class="fas fa-money-bill-wave"></i> Afghani (AFG)</h3>
        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card" style="background:linear-gradient(145deg,#22c55e,#16a34a);color:white;"><i class="fas fa-check-circle" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Paid</h4><div class="stat-value" style="color:white;">${formatMoney(totalPaidAFG)}</div></div>
            <div class="stat-card" style="background:linear-gradient(145deg,#ef4444,#b91c1c);color:white;"><i class="fas fa-clock" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Unpaid</h4><div class="stat-value" style="color:white;">${formatMoney(totalUnpaidAFG)}</div></div>
        </div>

        <h3 style="margin-bottom:15px;"><i class="fas fa-dollar-sign"></i> US Dollar (USD)</h3>
        <div class="stats-grid" style="margin-bottom:24px;">
            <div class="stat-card" style="background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;"><i class="fas fa-check-circle" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Paid</h4><div class="stat-value" style="color:white;">${formatByCurrency(totalPaidUSD,'USD')}</div></div>
            <div class="stat-card" style="background:#64748b;color:white;"><i class="fas fa-clock" style="color:white;"></i><h4 style="color:rgba(255,255,255,0.8);">Total Unpaid</h4><div class="stat-value" style="color:white;">${formatByCurrency(totalUnpaidUSD,'USD')}</div></div>
        </div>

        <div class="expense-section" style="margin-bottom:30px;">
            <h3 style="margin-bottom:20px;color:#166534;"><i class="fas fa-plus-circle"></i> Add New Payment</h3>
            <div class="form-group">
                <label>Currency</label>
                <div style="display:flex;gap:20px;margin-top:8px;">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                        <input type="radio" name="payToAdminCurrency" value="AFG" checked onchange="updatePayToAdminCurrencyLabel()" style="width:auto;"> Afghani (AFG)
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                        <input type="radio" name="payToAdminCurrency" value="USD" onchange="updatePayToAdminCurrencyLabel()" style="width:auto;"> US Dollar (USD)
                    </label>
                </div>
            </div>
            <div class="form-group"><label id="payToAdminAmountLabel">Amount (AFG)</label><input type="number" id="payToAdminAmount" step="0.01" min="0" placeholder="Enter amount" class="form-control"></div>
            <div class="form-group"><label>Description (Optional)</label><textarea id="payToAdminDesc" rows="2" placeholder="Enter description..." class="form-control"></textarea></div>
            <button class="action-btn" onclick="addPaymentToAdmin()" id="addPaymentBtn"><i class="fas fa-plus"></i> Add Payment</button>
        </div>
        <h3 style="margin-bottom:20px;color:#166534;">Payment History</h3>
        ${payments.length === 0
            ? `<div class="empty-state"><i class="fas fa-money-bill-wave"></i><h3>No Payments Yet</h3><p>Add your first payment above</p></div>`
            : `<div class="table-wrapper"><table class="inventory-table">
                <thead><tr><th>ID</th><th>Date</th><th>Currency</th><th>Amount</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${payments.map(p => {
                    let cur = p.currency || 'AFG';
                    return `
                    <tr>
                        <td>${p.id}</td>
                        <td>${p.date ? p.date.split('T')[0] : '-'}</td>
                        <td><span class="badge ${cur==='USD'?'badge-mainclient':'badge-active'}">${cur}</span></td>
                        <td class="total-value">${formatByCurrency(parseFloat(p.amount), cur)}</td>
                        <td>${p.description || '-'}</td>
                        <td><span class="badge ${p.status === 'paid' ? 'badge-paid' : 'badge-unpaid'}">${p.status === 'paid' ? 'PAID' : 'UNPAID'}</span></td>
                        <td>
                          <button class="btn btn-edit" onclick="editMcPaymentToAdmin(${p.id}, ${p.amount}, '${(p.description || '').replace(/'/g, "\\'")}', '${cur}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-delete" onclick="deleteMcPaymentToAdmin(${p.id})"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table></div>`
        }`;
    document.getElementById('content').innerHTML = html;
}

window.updatePayToAdminCurrencyLabel = function() {
    let currency = document.querySelector('input[name="payToAdminCurrency"]:checked')?.value || 'AFG';
    let label = document.getElementById('payToAdminAmountLabel');
    if (label) label.textContent = `Amount (${currency})`;
};


window.addPaymentToAdmin = async function () {
    let amount = parseFloat(document.getElementById('payToAdminAmount').value);
    let description = document.getElementById('payToAdminDesc').value.trim();
    let currency = document.querySelector('input[name="payToAdminCurrency"]:checked')?.value || 'AFG';
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }
    const btn = document.getElementById('addPaymentBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...'; }
    try {
        const res = await fetch('/api/payments-to-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ main_client: currentUser.username, amount, description: description || null, date: getTodayDate(), currency }) });
        if (!res.ok) throw new Error('Failed to add payment');
        await renderMainClientPaymentToAdmin();
        alert('Payment added successfully!');
    } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Add Payment'; }
        alert('Failed to add payment: ' + err.message);
    }
};

window.filterMcReportTime = async function() {
    let filter = document.getElementById('mcReportTimeFilter').value;
    let customRange = document.getElementById('mcReportCustomRange');
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
        let startVal = document.getElementById('mcReportStart')?.value;
        let endVal = document.getElementById('mcReportEnd')?.value;
        if (!startVal || !endVal) return;
        startDate = new Date(startVal);
        endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);
    }

    let isAll = filter === 'all';

    let filteredInventory = isAll ? mainInventory : mainInventory.filter(item => {
        let d = new Date(item.date || 0);
        return d >= startDate && d <= endDate;
    });
    let paidItems = filteredInventory.filter(i => {
        let key = `${i.id}_${i.name}_${i.quantity}`;
        return mainClientPayments[key] === true;
    }).length;

    // Expenses
    let mainClient = currentUser.username;
    let clientExps = mainClientExpenses[mainClient] || [];
    let filteredExps = isAll ? clientExps : clientExps.filter(e => {
        let d = new Date(e.date);
        return d >= startDate && d <= endDate;
    });
    let totalExpenses = filteredExps.reduce((sum, e) => sum + e.amount, 0);

    // Returns
    let filteredReturns = isAll ? branchReturns : branchReturns.filter(r => {
        let d = new Date(r.date);
        return d >= startDate && d <= endDate;
    });
    let returnsValue = filteredReturns.reduce((sum, r) => sum + ((r.quantity||0)*(r.pricePerUnit||0)), 0);

    // Branches Sales
    let filteredSales = isAll ? salesHistory : salesHistory.filter(s => {
        let d = new Date(s.date);
        return d >= startDate && d <= endDate;
    });
    let totalSold = filteredSales.reduce((sum, s) => sum + s.qty, 0);
    let totalRevenue = filteredSales.reduce((sum, s) => sum + s.revenue, 0);

    // Total Items Value from Admin
    let totalItemsValue = filteredInventory.reduce((sum, item) =>
        sum + ((item.sellingPrice||0)*(item.quantity||0)), 0);

    // Payment from Branches
    let filteredShipments = isAll ? mainClientToBranchShipments : mainClientToBranchShipments.filter(s => {
        let d = new Date(s.date);
        return d >= startDate && d <= endDate;
    });
    let paymentFromBranches = filteredShipments.reduce((sum, s) => sum + getShipmentPaidAmount(s), 0);


let paymentToAdminFiltered = 0;
try {
    const paRes = await fetch(`/api/payments-to-admin/${currentUser.username}`);
    if (paRes.ok) {
        const paData = await paRes.json();
        let filteredPa = isAll ? paData : paData.filter(p => {
            let d = new Date(p.date);
            return d >= startDate && d <= endDate;
        });
        paymentToAdminFiltered = filteredPa
            .filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    }
} catch(err) { console.log('Error:', err); }


    // My Payments (Remaining Stock Value)
    let filteredClientItems = isAll ? mainClientToBranchShipments : filteredShipments;
    let remainingStockValue = filteredInventory.reduce((sum, item) => {
        let distributed = mainClientDistributed[item.name] || 0;
        let remaining = Math.max(0, item.quantity - distributed);
        return sum + ((item.sellingPrice||0) * remaining);
    }, 0);

    let cards = document.querySelectorAll('#mainClientOwnReport .summary-card-large');
    if (!cards || cards.length === 0) return;

    if (cards[0]) cards[0].innerHTML = `
        <h4><i class="fas fa-box"></i> Shared Inventory</h4>
        <div class="amount">${filteredInventory.length}</div>
        <div class="subtitle">Total Items (${filter})</div>
        <div style="margin-top:15px;">
            <div class="summary-stats-row"><span class="label">Paid Items:</span><span class="value profit">${paidItems}</span></div>
            <div class="summary-stats-row"><span class="label">Unpaid Items:</span><span class="value loss">${filteredInventory.length - paidItems}</span></div>
        </div>`;

    if (cards[1]) cards[1].innerHTML = `
        <h4><i class="fas fa-credit-card"></i> My Payments</h4>
        <div class="amount">${formatMoney(remainingStockValue)}</div>
        <div class="subtitle">Remaining Stock Value (${filter})</div>
        <div style="margin-top:15px;">
            <div class="summary-stats-row"><span class="label">Total Items Value:</span><span class="value">${formatMoney(totalItemsValue)}</span></div>
        </div>`;

    if (cards[2]) cards[2].innerHTML = `
        <h4><i class="fas fa-file-invoice"></i> My Expenses & Returns</h4>
        <div class="amount">${formatMoney(totalExpenses)}</div>
        <div class="subtitle">Total Expenses (${filter})</div>
        <div style="margin-top:15px;">
            <div class="summary-stats-row"><span class="label">Returns Value:</span><span class="value">${formatMoney(returnsValue)}</span></div>
            <div class="summary-stats-row"><span class="label">Net Balance:</span><span class="value ${(remainingStockValue - totalExpenses) >= 0 ? 'profit' : 'loss'}">${formatMoney(remainingStockValue - totalExpenses)}</span></div>
        </div>`;

    let secondGrid = document.querySelectorAll('#mainClientOwnReport .summary-cards-grid');
    if (secondGrid && secondGrid[1]) {
        let cards2 = secondGrid[1].querySelectorAll('.summary-card-large');

        if (cards2[0]) cards2[0].innerHTML = `
            <h4><i class="fas fa-shopping-cart"></i> Branches Sales</h4>
            <div class="amount">${totalSold}</div>
            <div class="subtitle">Total Items Sold (${filter})</div>
            <div style="margin-top:15px;">
                <div class="summary-stats-row"><span class="label">Total Revenue:</span><span class="value">${formatMoney(totalRevenue)}</span></div>
            </div>`;

        if (cards2[1]) cards2[1].innerHTML = `
            <h4 style="color:white;"><i class="fas fa-tags"></i> Total Sales Price</h4>
            <div class="amount" style="color:white;font-size:22px;">${formatMoney(totalItemsValue)}</div>
            <div class="subtitle" style="color:rgba(255,255,255,0.8);">Total Items Value (${filter})</div>`;

            if (cards2[2]) {
                let amountEl = cards2[2].querySelector('.amount');
                if (amountEl) amountEl.textContent = formatMoney(paymentToAdminFiltered);
                let subtitleEl = cards2[2].querySelector('.subtitle');
                if (subtitleEl) subtitleEl.textContent = `Confirmed paid payments (${filter})`;
            }


        if (cards2[3]) {
            let amountEl = cards2[3].querySelector('.amount');
            if (amountEl) amountEl.textContent = formatMoney(paymentFromBranches);
            let subtitleEl = cards2[3].querySelector('.subtitle');
            if (subtitleEl) subtitleEl.textContent = `Total paid by branches (${filter})`;
        }
    }
};

window.editMcPaymentToAdmin = function(id, currentAmount, currentDesc, currentCurrency) {
    const escapedDesc = (currentDesc || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    let cur = currentCurrency || 'AFG';
    
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Edit Payment</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group">
            <label>Currency</label>
            <div style="display:flex;gap:20px;margin-top:8px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="editPayCurrency" value="AFG" ${cur==='AFG'?'checked':''} onchange="updateEditPayCurrencyLabel()" style="width:auto;"> Afghani (AFG)
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:500;">
                    <input type="radio" name="editPayCurrency" value="USD" ${cur==='USD'?'checked':''} onchange="updateEditPayCurrencyLabel()" style="width:auto;"> US Dollar (USD)
                </label>
            </div>
        </div>
        <div class="form-group"><label id="editPayAmountLabel">Amount (${cur})</label>
            <input type="number" id="editPayAmount" step="0.01" value="${currentAmount}">
        </div>
        <div class="form-group"><label>Description</label>
            <textarea id="editPayDesc" rows="2">${escapedDesc}</textarea>
        </div>
        <button class="save-btn" onclick="saveEditMcPaymentToAdmin(${id})"><i class="fas fa-save"></i> Save Changes</button>`;
    document.getElementById('modal').classList.add('active');
};

window.updateEditPayCurrencyLabel = function() {
    let currency = document.querySelector('input[name="editPayCurrency"]:checked')?.value || 'AFG';
    let label = document.getElementById('editPayAmountLabel');
    if (label) label.textContent = `Amount (${currency})`;
};

window.saveEditMcPaymentToAdmin  = async function(id) {
    let amount = parseFloat(document.getElementById('editPayAmount').value);
    let description = document.getElementById('editPayDesc').value.trim();
    let currency = document.querySelector('input[name="editPayCurrency"]:checked')?.value || 'AFG';
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }

    try {
        const res = await fetch(`/api/payments-to-admin/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, description, status: 'unpaid', currency })
        });
        if (!res.ok) throw new Error('Failed to update');
        closeModal();
        await renderMainClientPaymentToAdmin ();
        alert('Payment updated and set to UNPAID successfully!');
    } catch(err) { alert('Failed to update: ' + err.message); }
};


window.deleteMcPaymentToAdmin  = async function(id) {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    try {
        const res = await fetch(`/api/payments-to-admin/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        await renderMainClientPaymentToAdmin();
        alert('Payment deleted successfully!');
    } catch(err) { alert('Failed to delete: ' + err.message); }
};