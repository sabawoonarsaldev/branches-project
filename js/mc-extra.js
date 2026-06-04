// ==================== mc-extra.js ====================
// Main Client: users، shipments، alerts، returns، history

// ==================== MAIN CLIENT USERS (BRANCH MANAGEMENT) ====================
async function renderMainClientUsers() {
    try {
        const response = await fetch('/api/users');
        if (response.ok) users = await response.json();
    } catch (err) { console.log('Error loading users:', err); }

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Branch Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <button class="action-btn" onclick="showMainClientAddBranchModal()"><i class="fas fa-user-plus"></i> Add Branch</button>`;

    let branches = users.filter(u => u.role === 'branch' && !u.deleted);

    if (branches.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-users"></i><h3>No Branches Yet</h3><p>Click the button above to add your first branch</p></div>`;
    } else {
        html += `<div class="table-wrapper"><table>
            <thead><tr><th>ID</th><th>Username</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${branches.map(u => {
                let statusClass = u.blocked ? 'badge-blocked' : (u.frozen ? 'badge-frozen' : 'badge-active');
                let statusText = u.blocked ? 'Blocked' : (u.frozen ? 'Frozen' : 'Active');
                return `<tr>
                    <td>${u.id}</td><td>${u.username}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-edit" onclick="mainClientChangePassword(${u.id})">Change Password</button>
                        <button class="btn ${u.frozen ? 'btn-success' : 'btn-edit'}" onclick="mainClientToggleFreeze(${u.id})">${u.frozen ? 'Unfreeze' : 'Freeze'}</button>
                        <button class="btn ${u.blocked ? 'btn-success' : 'btn-delete'}" onclick="mainClientToggleBlock(${u.id})">${u.blocked ? 'Unblock' : 'Block'}</button>
                        <button class="btn btn-delete" onclick="mainClientDeleteUser(${u.id})">Delete</button>
                    </td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

window.showMainClientAddBranchModal = function () {
    document.getElementById('modalContent').innerHTML = `
        <div class="modal-header"><h3>Add New Branch</h3><button onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Username</label><input type="text" id="newUsername" placeholder="Enter username"></div>
        <div class="form-group"><label>Password</label><input type="text" id="newPassword" placeholder="Enter password"></div>
        <button class="save-btn" onclick="mainClientSaveNewBranch()">Add Branch</button>`;
    document.getElementById('modal').classList.add('active');
};

window.mainClientSaveNewBranch = async function () {
    let username = document.getElementById('newUsername').value;
    let password = document.getElementById('newPassword').value;
    if (!username || !password) { alert('Please fill all fields'); return; }

    try {
        const checkResponse = await fetch('/api/users');
        const existingUsers = await checkResponse.json();
        if (existingUsers.some(u => u.username === username && !u.deleted)) { alert('Username already exists!'); return; }
    } catch (err) { console.log('Error checking users:', err); }

    try {
        const response = await fetch('/api/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role: 'branch', frozen: false, blocked: false, deleted: false })
        });
        if (response.ok) {
            const newUser = await response.json();
            users.push({ id: newUser.id, username, password, role: 'branch', frozen: false, blocked: false, deleted: false });
            if (!branchInventory[username]) branchInventory[username] = [];
            if (!branchFinance[username]) branchFinance[username] = { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalLoss: 0, totalExpenses: 0 };
            if (!branchExpenses[username]) branchExpenses[username] = [];
            closeModal(); renderMainClientUsers();
            alert(`Branch "${username}" added successfully!`);
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to add branch');
        }
    } catch (err) { alert('Failed to add branch. Make sure server is running.'); }
};

window.mainClientChangePassword = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    let newPass = prompt('Enter new password for ' + user.username + ':');
    if (newPass && newPass.trim()) {
        try {
            const response = await fetch(`/api/users/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user.username, password: newPass, role: user.role, frozen: user.frozen, blocked: user.blocked, deleted: user.deleted })
            });
            if (response.ok) { user.password = newPass; renderMainClientUsers(); alert('Password changed successfully!'); }
            else alert((await response.json()).error || 'Failed to change password');
        } catch (err) { alert('Failed to change password.'); }
    }
};

window.mainClientToggleFreeze = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    let newFrozenState = !user.frozen;
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username, password: user.password, role: user.role, frozen: newFrozenState, blocked: user.blocked, deleted: user.deleted })
        });
        if (response.ok) { user.frozen = newFrozenState; renderMainClientUsers(); alert(`Branch "${user.username}" ${newFrozenState ? 'frozen' : 'unfrozen'} successfully!`); }
        else alert((await response.json()).error || 'Failed to update branch');
    } catch (err) { alert('Failed to update branch.'); }
};

window.mainClientToggleBlock = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    let newBlockedState = !user.blocked;
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.username, password: user.password, role: user.role, frozen: user.frozen, blocked: newBlockedState, deleted: user.deleted })
        });
        if (response.ok) { user.blocked = newBlockedState; renderMainClientUsers(); alert(`Branch "${user.username}" ${newBlockedState ? 'blocked' : 'unblocked'} successfully!`); }
        else alert((await response.json()).error || 'Failed to update branch');
    } catch (err) { alert('Failed to update branch.'); }
};

window.mainClientDeleteUser = async function (id) {
    let user = users.find(u => u.id === id);
    if (!user) return;
    if (confirm(`Delete branch "${user.username}" permanently?`)) {
        try {
            const response = await fetch(`/api/users/${id}/hard`, { method: 'DELETE' });
            if (response.ok) {
                users = users.filter(u => u.id !== id);
                delete branchInventory[user.username];
                delete branchFinance[user.username];
                delete branchExpenses[user.username];
                renderMainClientUsers();
                alert(`Branch "${user.username}" deleted successfully!`);
            } else alert((await response.json()).error || 'Failed to delete branch');
        } catch (err) { alert('Failed to delete branch.'); }
    }
};

// ==================== MAIN CLIENT SHIPMENTS ====================
function renderMainClientShipments() {
    let branches = getBranchUsers();
    document.getElementById('content').innerHTML = `
        <div class="header-actions">
            <h2 class="page-title">Shipment History to Branches</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="branch-selector" style="margin-bottom:30px;">
            <div class="form-group" style="flex:1;"><label><i class="fas fa-code-branch"></i> Filter by Branch</label>
                <select id="shipmentBranchFilter" onchange="filterMainClientShipments()">
                    <option value="">-- All Branches --</option>
                    ${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="flex:1;"><label><i class="fas fa-search"></i> Search Item</label>
                <input type="text" id="shipmentSearchInput" placeholder="Search by item name..." onkeyup="filterMainClientShipments()">
            </div>
        </div>
        <div id="shipmentsListContainer"></div>`;
    loadMainClientShipments();
}

window.loadMainClientShipments = function () {
    let branch = document.getElementById('shipmentBranchFilter')?.value || '';
    let searchTerm = document.getElementById('shipmentSearchInput')?.value.toLowerCase() || '';
    let shipments = mainClientToBranchShipments
        .filter(s => !branch || s.branch === branch)
        .filter(s => !searchTerm || s.item.toLowerCase().includes(searchTerm))
        .map(s => ({
            ...s,
            reminder: getShipmentReminder(s),
            paidAmount: getShipmentPaidAmount(s),
            status: getShipmentStatus(s),
            totalPrice: s.sellingPrice * s.qty
        }));
    displayMainClientShipments(shipments);
};

window.filterMainClientShipments = function () { loadMainClientShipments(); };

function displayMainClientShipments(shipments) {
    let html = '';
    if (shipments.length === 0) {
        html = `<div class="empty-state"><i class="fas fa-truck"></i><h3>No Shipments Found</h3><p>No shipments match your filter criteria.</p></div>`;
    } else {
        html = `<div class="table-wrapper"><table>
            <thead><tr><th>Date</th><th>Branch</th><th>Item</th><th>Quantity</th><th>Selling Price</th><th>Total Price</th><th>Paid Amount</th><th>Reminder</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>${shipments.sort((a, b) => new Date(b.date) - new Date(a.date)).map(s => {
                let shipmentId = generateMainClientToBranchShipmentId(s);
                let isReceived = shipmentReminders[shipmentId + '_received'] === true ||
                    (s.uniqueKey && shipmentReminders[s.uniqueKey + '_received'] === true) ||
                    localStorage.getItem(`branch_received_${s.branch}_${s.uniqueKey || shipmentId}`) === 'true';
                let receivedIcon = isReceived
                    ? '<span style="color:#22c55e;font-size:16px;"><i class="fas fa-check-circle"></i> Yes</span>'
                    : '<span style="color:#ef4444;font-size:16px;"><i class="fas fa-times-circle"></i> No</span>';
                let sc = s.status === 'paid' ? 'badge-paid' : (s.status === 'partial' ? 'badge-partial' : 'badge-unpaid');
                return `<tr>
                    <td>${s.date}</td><td>${s.branch}</td><td>${s.item}</td><td>${s.qty}</td>
                    <td>${formatMoney(s.sellingPrice)}</td>
                    <td class="total-value">${formatMoney(s.sellingPrice * s.qty)}</td>
                    <td class="status-paid">${formatMoney(s.paidAmount)}</td>
                    <td class="reminder-amount">${formatMoney(s.reminder)}</td>
                    <td><span class="badge ${sc}">${s.status.toUpperCase()}</span></td>
                    <td>${receivedIcon}</td>
                </tr>`;
            }).join('')}</tbody>
        </table></div>`;
    }
    document.getElementById('shipmentsListContainer').innerHTML = html;
}

// ==================== MAIN CLIENT ALERTS ====================
async function renderMainClientAlerts() {
    try {
        const response = await fetch(`/api/alerts/mainclient/${currentUser.username}`);
        if (response.ok) {
            const alerts = await response.json();
            lowStockAlerts = alerts.map(a => ({
                id: a.id, branch: a.branch, itemName: a.item_name,
                quantity: a.quantity, date: a.date ? a.date.split('T')[0] : getTodayDate(),
                message: a.message, resolved: a.resolved
            }));
        }
    } catch (err) { console.log('Error loading alerts:', err); }

    let unresolvedAlerts = lowStockAlerts.filter(a => !a.resolved);
    let html = `
        <div class="header-actions">
            <h2 class="page-title">Low Stock Alerts from Branches</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>`;

    if (unresolvedAlerts.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No Active Alerts</h3><p>All branches have sufficient stock.</p></div>`;
    } else {
        html += unresolvedAlerts.map(alert => `
            <div class="alert-box" style="background:#fee2e2;border-color:#ef4444;">
                <i class="fas fa-exclamation-triangle" style="color:#ef4444;"></i>
                <div style="flex:1;">
                    <strong style="color:#b91c1c;">${alert.branch} Branch</strong> reported low stock for <strong>${alert.itemName}</strong><br>
                    <span style="color:#64748b;">Current stock: ${alert.quantity} units | Date: ${alert.date}</span><br>
                    <small style="color:#64748b;">${alert.message || ''}</small>
                </div>
                <button class="btn btn-success" onclick="mainClientResolveAlert(${alert.id})" style="margin-left:auto;"><i class="fas fa-check"></i> Resolve</button>
            </div>`).join('');
    }
    document.getElementById('content').innerHTML = html;
}

window.mainClientResolveAlert = async function (alertId) {
    try {
        const response = await fetch(`/api/alerts/${alertId}/resolve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
        if (response.ok) {
            lowStockAlerts = lowStockAlerts.filter(a => a.id !== alertId);
            renderMainClientAlerts();
            alert('Alert resolved successfully!');
        } else { alert('Failed to resolve alert.'); }
    } catch (err) { alert('Failed to resolve alert. Make sure server is running.'); }
};

// ==================== MAIN CLIENT RETURNS ====================
function renderMainClientReturns() {
    let branches = getBranchUsers();
    let returns = getMainClientReturns();
    let summary = getReturnSummary();

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Return Management</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="summary-cards" style="margin-bottom:30px;">
            <div class="summary-card paid" style="flex:1;"><h4><i class="fas fa-undo-alt"></i> Total Returns</h4><div class="amount">${summary.totalReturns}</div></div>
            <div class="summary-card" style="flex:1;background:#f59e0b;"><h4 style="color:white;"><i class="fas fa-clock"></i> Pending</h4><div class="amount" style="color:white;">${summary.pendingReturns}</div></div>
            <div class="summary-card" style="flex:1;background:#22c55e;"><h4 style="color:white;"><i class="fas fa-check-circle"></i> Approved</h4><div class="amount" style="color:white;">${summary.approvedReturns}</div></div>
            <div class="summary-card" style="flex:1;background:#64748b;"><h4 style="color:white;"><i class="fas fa-times-circle"></i> Rejected</h4><div class="amount" style="color:white;">${summary.rejectedReturns}</div></div>
            <div class="summary-card" style="flex:1;background:#166534;"><h4 style="color:white;"><i class="fas fa-money-bill-wave"></i> Paid</h4><div class="amount" style="color:white;">${summary.paidReturns}</div></div>
        </div>
        <div class="branch-selector" style="margin-bottom:20px;">
            <div class="form-group" style="flex:1;"><label><i class="fas fa-code-branch"></i> Filter by Branch</label>
                <select id="returnBranchFilter" onchange="filterMainClientReturns()">
                    <option value="">-- All Branches --</option>
                    ${branches.map(b => `<option value="${b.username}">${b.username} Branch</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="flex:1;"><label><i class="fas fa-filter"></i> Filter by Status</label>
                <select id="returnStatusFilter" onchange="filterMainClientReturns()">
                    <option value="">-- All Status --</option>
                    <option value="pending">Pending</option><option value="approved">Approved</option>
                    <option value="rejected">Rejected</option><option value="paid">Paid</option>
                </select>
            </div>
        </div>
        <div class="table-wrapper"><table id="returnsTable">
            <thead><tr><th>Date</th><th>Branch</th><th>Item Name</th><th>Quantity</th><th>Price/Unit</th><th>Total Value</th><th>Description</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${returns.length === 0
                ? `<tr><td colspan="9" style="text-align:center;">No return requests yet</td></tr>`
                : returns.sort((a, b) => new Date(b.date) - new Date(a.date)).map(r => {
                    let statusClass = r.status === 'paid' ? 'return-badge-paid' : (r.status === 'approved' ? 'return-badge-approved' : (r.status === 'rejected' ? 'return-badge-rejected' : 'return-badge-pending'));
                    let statusText = r.status === 'paid' ? 'PAID' : (r.status === 'approved' ? 'APPROVED' : (r.status === 'rejected' ? 'REJECTED' : 'PENDING'));
                    return `<tr data-branch="${r.branch}" data-status="${r.status}">
                        <td>${r.date}</td><td>${r.branch}</td><td>${r.itemName}</td>
                        <td>${r.quantity}</td><td>${formatMoney(r.pricePerUnit)}</td>
                        <td>${formatMoney(r.totalValue)}</td><td>${r.description || '-'}</td>
                        <td><span class="${statusClass}">${statusText}</span></td>
                        <td>${r.status === 'pending'
                            ? `<button class="btn btn-success" onclick="approveReturn(${r.id})"><i class="fas fa-check"></i> Approve</button>
                               <button class="btn btn-delete" onclick="rejectReturn(${r.id})"><i class="fas fa-times"></i> Reject</button>`
                            : r.status === 'approved' ? `<span class="return-badge-approved">✓ APPROVED</span>`
                            : r.status === 'paid' ? `<span class="return-badge-paid">💰 PAID</span>`
                            : `<span class="return-badge-rejected">❌ REJECTED</span>`
                        }</td>
                    </tr>`;
                }).join('')
            }</tbody>
        </table></div>`;
    document.getElementById('content').innerHTML = html;
}

window.filterMainClientReturns = function () {
    let branchFilter = document.getElementById('returnBranchFilter').value;
    let statusFilter = document.getElementById('returnStatusFilter').value;
    let table = document.getElementById('returnsTable');
    if (!table) return;
    let rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    for (let row of rows) {
        let branch = row.getAttribute('data-branch');
        let status = row.getAttribute('data-status');
        row.style.display = (!branchFilter || branch === branchFilter) && (!statusFilter || status === statusFilter) ? '' : 'none';
    }
};

window.approveReturn = async function (returnId) {
    let returnRequest = branchReturns.find(r => r.id === returnId);
    if (!returnRequest) { alert('Return request not found!'); return; }
    if (!confirm(`Approve return of ${returnRequest.quantity} ${returnRequest.itemName} from ${returnRequest.branch}?`)) return;

    try {
        const approveResponse = await fetch(`/api/returns/${returnId}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
        if (!approveResponse.ok) throw new Error(`Server returned ${approveResponse.status}`);

        let { branch, itemName, quantity, pricePerUnit } = returnRequest;
        let returnValue = quantity * pricePerUnit;

        // Update branch inventory
        const branchInvRes = await fetch(`/api/branch-inventory/${branch}`);
        const branchItems = await branchInvRes.json();
        let remainingToRemove = quantity;
        for (let item of branchItems) {
            if (remainingToRemove <= 0) break;
            if (item.item_name === itemName) {
                let removeFromThis = Math.min(item.quantity, remainingToRemove);
                let newQuantity = item.quantity - removeFromThis;
                await fetch(`/api/branch-inventory/${item.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity: newQuantity, original_quantity: Math.max(0, (item.original_quantity || item.quantity) - removeFromThis) })
                });
                if (branchInventory[branch]) {
                    let localItem = branchInventory[branch].find(i => i.id === item.id);
                    if (localItem) localItem.quantity = newQuantity;
                }
                remainingToRemove -= removeFromThis;
            }
        }
        if (branchInventory[branch]) branchInventory[branch] = branchInventory[branch].filter(i => i.quantity > 0);

        // Update shipments and payments
        let remainingQty = quantity;
        for (let shipment of mainClientToBranchShipments.filter(s => s.branch === branch && s.item === itemName).sort((a, b) => new Date(b.date) - new Date(a.date))) {
            if (remainingQty <= 0) break;
            let qtyToSubtract = Math.min(shipment.qty, remainingQty);
            let newQty = shipment.qty - qtyToSubtract;
            let oldPaidAmount = (shipment.uniqueKey && shipmentPayments[shipment.uniqueKey] !== undefined) ? shipmentPayments[shipment.uniqueKey] : getShipmentPaidAmount(shipment);
            let returnedValue = shipment.sellingPrice * qtyToSubtract;
            let newPaidAmount = Math.max(0, Math.min(oldPaidAmount - returnedValue, shipment.sellingPrice * newQty));
            newPaidAmount = Math.round(newPaidAmount * 100) / 100;

            if (newQty <= 0) {
                mainClientToBranchShipments.splice(mainClientToBranchShipments.findIndex(s => s.id === shipment.id), 1);
                await fetch(`/api/shipments/${shipment.id}`, { method: 'DELETE' }).catch(() => {});
                if (shipment.uniqueKey) {
                    delete shipmentPayments[shipment.uniqueKey];
                    await fetch(`/api/shipment-payment/${shipment.uniqueKey}`, { method: 'DELETE' }).catch(() => {});
                }
            } else {
                shipment.qty = newQty;
                await fetch(`/api/shipments/${shipment.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: shipment.date, branch: shipment.branch, item: shipment.item, qty: newQty, selling_price: shipment.sellingPrice, purchase_price: shipment.purchasePrice, unique_key: shipment.uniqueKey }) }).catch(() => {});
                if (shipment.uniqueKey) {
                    await fetch(`/api/shipment-payment/${shipment.uniqueKey}`, { method: 'DELETE' }).catch(() => {});
                    await fetch('/api/shipment-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shipment_id: shipment.uniqueKey, paid_amount: newPaidAmount }) }).catch(() => {});
                    shipmentPayments[shipment.uniqueKey] = newPaidAmount;
                }
            }
            remainingQty -= qtyToSubtract;
        }

        // Update main client distributed
        let mainClientItem = mainClientItems.find(i => i.name === itemName);
        if (mainClientItem) {
            let currentDistributed = mainClientDistributed[itemName] || 0;
            mainClientDistributed[itemName] = Math.max(0, currentDistributed - quantity);
            await fetch('/api/main-client-distributed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ main_client: currentUser.username, item_name: itemName, distributed_quantity: -quantity }) });
        } else {
            const newItemRes = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: itemName, purchase_price: pricePerUnit, selling_price: pricePerUnit, quantity, supplier: `Returned from ${branch}`, date: getTodayDate() }) });
            const newItem = await newItemRes.json();
            mainInventory.push({ id: newItem.id, name: itemName, purchasePrice: pricePerUnit, sellingPrice: pricePerUnit, quantity, supplier: `Returned from ${branch}`, date: getTodayDate() });
            mainClientItems.push({ id: newItem.id, name: itemName, sellingPrice: pricePerUnit, purchasePrice: pricePerUnit, quantity, date: getTodayDate(), supplier: `Returned from ${branch}` });
        }

        returnRequest.status = 'approved';
        window._previousTotalUnpaid = null; window._previousGrandTotal = null;
        window._adminPreviousTotalUnpaid = null; window._adminPreviousGrandTotal = null;

        saveData(); recalcMainFinance(); recalcBranchFinance(branch);
        await refreshDataFromServer();
        alert(`✅ Return Approved!\n${quantity} ${itemName}(s) returned from ${branch}.`);
        renderMainClientReturns();
    } catch (error) { alert('Failed to approve return: ' + error.message); }
};

window.rejectReturn = async function (returnId) {
    let returnRequest = branchReturns.find(r => r.id === returnId);
    if (!returnRequest) return;
    if (confirm(`Reject return of ${returnRequest.quantity} ${returnRequest.itemName} from ${returnRequest.branch}?`)) {
        try {
            const response = await fetch(`/api/returns/${returnId}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
            if (response.ok) {
                returnRequest.status = 'rejected';
                saveData(); renderMainClientReturns();
                alert('❌ Return request rejected.');
            } else alert('Failed to reject return: ' + (await response.json()).error);
        } catch (err) { alert('Failed to reject return.'); }
    }
};

// ==================== BRANCH HISTORY ====================
function renderBranchHistory() {
    let branch = currentUser.username;
    let items = branchInventory[branch] || [];

    let html = `
        <div class="header-actions">
            <h2 class="page-title">Inventory History (Branch)</h2>
            <button class="refresh-btn" onclick="refreshCurrentSection()"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="search-container">
            <div class="search-box"><i class="fas fa-search"></i>
                <input type="text" id="branchHistorySearchInput" placeholder="Search items by name..." onkeyup="searchBranchHistory()">
            </div>
            <div class="search-results" id="branchHistorySearchResults">Showing ${items.length} items</div>
        </div>`;

    if (items.length === 0) {
        html += `<div class="empty-state"><i class="fas fa-history"></i><h3>No Items Yet</h3></div>`;
    } else {
        html += `<div class="table-wrapper"><table>
            <thead><tr><th>Item Name</th><th>Date</th><th>Stock</th><th>Selling Price</th><th>Total Selling Price</th></tr></thead>
            <tbody id="branchHistoryTableBody">${renderBranchHistoryRows(items)}</tbody>
        </table></div>`;
    }
    document.getElementById('content').innerHTML = html;
}

function renderBranchHistoryRows(items) {
    return items.map(item => {
        let totalSellingPrice = (item.sellingPrice || 0) * (item.quantity || 0);
        let shipmentDate = item.shipmentDate || item.distributionDate || getTodayDate();
        return `<tr>
            <td>${escapeHtml(item.name)}</td><td>${shipmentDate}</td><td>${item.quantity}</td>
            <td>${formatMoney(item.sellingPrice)}</td><td>${formatMoney(totalSellingPrice)}</td>
        </tr>`;
    }).join('');
}

window.searchBranchHistory = function () {
    let branch = currentUser.username;
    let searchTerm = document.getElementById('branchHistorySearchInput').value.toLowerCase();
    let items = (branchInventory[branch] || []).filter(item => item.name.toLowerCase().includes(searchTerm));
    document.getElementById('branchHistoryTableBody').innerHTML = renderBranchHistoryRows(items);
    document.getElementById('branchHistorySearchResults').innerHTML = `Showing ${items.length} of ${(branchInventory[branch] || []).length} items`;
};