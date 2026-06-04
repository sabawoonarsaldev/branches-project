// ==================== auth.js ====================
// login، logout، sidebar، showSection، refreshCurrentSection، togglePassword

// ==================== TOGGLE PASSWORD ====================
function togglePassword(inputId, icon) {
    let input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// ==================== RENDER SIDEBAR ====================
function renderSidebar() {
    let html = '';
    if (currentUser.role === 'admin') {
        html = `
            <div class="nav-item active" onclick="showSection('inventory')"><i class="fas fa-box"></i> Inventory</div>
            <div class="nav-item" onclick="showSection('branchInventoryAdmin')"><i class="fas fa-store"></i> Branch Inventory</div>
            <div class="nav-item" onclick="showSection('finance')"><i class="fas fa-chart-line"></i> Finance</div>
            <div class="nav-item" onclick="showSection('expenses')"><i class="fas fa-money-bill-wave"></i> Expenses</div>
            <div class="nav-item" onclick="showSection('adminReports')"><i class="fas fa-chart-bar"></i> Reports</div>
            <div class="nav-item" onclick="showSection('adminPayments')"><i class="fas fa-credit-card"></i> Payments</div>
            <div class="nav-item" onclick="showSection('adminInvoices')"><i class="fas fa-file-invoice"></i> Invoices</div>
            <div class="nav-item" onclick="showSection('discounts')"><i class="fas fa-percent"></i> Discounts</div>
            <div class="nav-item" onclick="showSection('users')"><i class="fas fa-users"></i> Users</div>
            <div class="nav-item" onclick="showSection('adminPaymentsToAdmin')"><i class="fas fa-hand-holding-usd"></i> Payment to Admin</div>
            <div class="nav-item" onclick="showSection('totalAmount')"><i class="fas fa-chart-pie"></i> Total Amount</div>
            <div class="nav-item" onclick="showSection('adminHistory')"><i class="fas fa-history"></i> History</div>
            <div class="nav-item logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</div>
        `;
    } else if (currentUser.role === 'mainclient') {
        html = `
            <div class="nav-item active" onclick="showSection('mainClientInventory')"><i class="fas fa-box"></i> Shared Inventory</div>
            <div class="nav-item" onclick="showSection('mainClientPaymentToAdmin')"><i class="fas fa-hand-holding-usd"></i> Payment to Admin</div>
            <div class="nav-item" onclick="showSection('mainClientFinance')"><i class="fas fa-chart-line"></i> My Finance</div>
            <div class="nav-item" onclick="showSection('mainClientExpenses')"><i class="fas fa-money-bill-wave"></i> My Expenses</div>
            <div class="nav-item" onclick="showSection('mainClientDistribute')"><i class="fas fa-share-alt"></i> Distribute</div>
            <div class="nav-item" onclick="showSection('mainClientPayments')"><i class="fas fa-credit-card"></i> Payments</div>
            <div class="nav-item" onclick="showSection('mainClientBilling')"><i class="fas fa-file-invoice"></i> Billing</div>
            <div class="nav-item" onclick="showSection('mainClientInvoices')"><i class="fas fa-file-invoice-dollar"></i> Invoices</div>
            <div class="nav-item" onclick="showSection('mainClientReport')"><i class="fas fa-chart-pie"></i> Report</div>
            <div class="nav-item" onclick="showSection('mainClientUsers')"><i class="fas fa-users"></i> Branch Users</div>
            <div class="nav-item" onclick="showSection('mainClientShipments')"><i class="fas fa-truck"></i> Shipments</div>
            <div class="nav-item" onclick="showSection('mainClientAlerts')"><i class="fas fa-bell"></i> Alerts ${lowStockAlerts.length > 0 ? `<span style="background:#22c55e;color:white;padding:2px 8px;border-radius:40px;margin-left:8px;">${lowStockAlerts.length}</span>` : ''}</div>
            <div class="nav-item" onclick="showSection('mainClientReturns')"><i class="fas fa-undo-alt"></i> Returns ${branchReturns.filter(r => r.status === 'pending').length > 0 ? `<span style="background:#f59e0b;color:white;padding:2px 8px;border-radius:40px;margin-left:8px;">${branchReturns.filter(r => r.status === 'pending').length}</span>` : ''}</div>
            <div class="nav-item" onclick="showSection('totalAmountMain')"><i class="fas fa-chart-pie"></i> Total Amount</div>
            <div class="nav-item" onclick="showSection('mainClientHistory')"><i class="fas fa-history"></i> History</div>
            <div class="nav-item logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</div>
        `;
    } else {
        html = `
            <div class="nav-item active" onclick="showSection('branchInventory')"><i class="fas fa-box"></i> My Inventory</div>
            <div class="nav-item" onclick="showSection('branchSale')"><i class="fas fa-cash-register"></i> Sell Items</div>
            <div class="nav-item" onclick="showSection('branchBilling')"><i class="fas fa-receipt"></i> Billing</div>
            <div class="nav-item" onclick="showSection('branchExpenses')"><i class="fas fa-money-bill-wave"></i> My Expenses</div>
            <div class="nav-item" onclick="showSection('branchFinance')"><i class="fas fa-wallet"></i> My Finance</div>
            <div class="nav-item" onclick="showSection('branchReport')"><i class="fas fa-flag"></i> Complete Report</div>
            <div class="nav-item" onclick="showSection('branchPayments')"><i class="fas fa-credit-card"></i> My Payments</div>
            <div class="nav-item" onclick="showSection('branchReturns')"><i class="fas fa-undo-alt"></i> Returns</div>
            <div class="nav-item" onclick="showSection('branchHistory')"><i class="fas fa-history"></i> History</div>
            <div class="nav-item logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Logout</div>
        `;
    }
    document.getElementById('sidebar').innerHTML = html;
}

// ==================== SHOW SECTION ====================
function showSection(section) {
    if (currentUser.role === 'admin') {
        if (section === 'inventory') renderInventory();
        else if (section === 'branchInventoryAdmin') renderBranchInventoryAdmin();
        else if (section === 'finance') renderFinance();
        else if (section === 'expenses') renderExpenses();
        else if (section === 'adminReports') renderAdminReports();
        else if (section === 'adminPayments') renderAdminPayments();
        else if (section === 'adminInvoices') renderAdminInvoices();
        else if (section === 'discounts') renderDiscountManagement();
        else if (section === 'users') renderUsers();
        else if (section === 'totalAmount') renderTotalAmount();
        else if (section === 'adminHistory') renderAdminHistory();
        else if (section === 'adminPaymentsToAdmin') renderAdminPaymentsToAdmin();
    } else if (currentUser.role === 'mainclient') {
        if (section === 'mainClientInventory') renderMainClientInventory();
        else if (section === 'mainClientFinance') renderMainClientFinance();
        else if (section === 'mainClientExpenses') renderMainClientExpenses();
        else if (section === 'mainClientDistribute') renderMainClientDistribute();
        else if (section === 'mainClientPayments') renderMainClientPayments();
        else if (section === 'mainClientBilling') renderMainClientBilling();
        else if (section === 'mainClientInvoices') renderMainClientInvoices();
        else if (section === 'mainClientReport') renderMainClientReport();
        else if (section === 'mainClientUsers') renderMainClientUsers();
        else if (section === 'mainClientShipments') renderMainClientShipments();
        else if (section === 'mainClientAlerts') renderMainClientAlerts();
        else if (section === 'mainClientReturns') renderMainClientReturns();
        else if (section === 'totalAmountMain') renderTotalAmountMain();
        else if (section === 'mainClientHistory') renderMainClientHistory();
        else if (section === 'mainClientPaymentToAdmin') renderMainClientPaymentToAdmin();
    } else {
        if (section === 'branchInventory') renderBranchInventory();
        else if (section === 'branchSale') renderBranchSale();
        else if (section === 'branchBilling') renderBranchBilling();
        else if (section === 'branchExpenses') renderBranchExpenses();
        else if (section === 'branchFinance') renderBranchFinance();
        else if (section === 'branchReport') renderBranchCompleteReport();
        else if (section === 'branchPayments') renderBranchPayments();
        else if (section === 'branchReturns') renderBranchReturns();
        else if (section === 'branchHistory') renderBranchHistory();
    }

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}

// ==================== REFRESH CURRENT SECTION ====================
window.refreshCurrentSection = async function () {
    if (!currentUser) return;

    if (currentUser.role === 'admin') {
        let activeSection = document.querySelector('.nav-item.active')?.innerText.toLowerCase();
        if (!activeSection) { renderInventory(); return; }
        if (activeSection.includes('inventory') && !activeSection.includes('branch')) renderInventory();
        else if (activeSection.includes('branch inventory')) renderBranchInventoryAdmin();
        else if (activeSection.includes('finance')) renderFinance();
        else if (activeSection.includes('expenses')) renderExpenses();
        else if (activeSection.includes('reports')) renderAdminReports();
        else if (activeSection.includes('payments') && !activeSection.includes('payment to')) renderAdminPayments();
        else if (activeSection.includes('payment to admin')) renderAdminPaymentsToAdmin();
        else if (activeSection.includes('invoices')) renderAdminInvoices();
        else if (activeSection.includes('discounts')) renderDiscountManagement();
        else if (activeSection.includes('users')) renderUsers();
        else if (activeSection.includes('history')) renderAdminHistory();
        else if (activeSection.includes('total amount')) renderTotalAmount();
        else renderInventory();

    } else if (currentUser.role === 'mainclient') {
        await refreshDataFromServer();
        let activeSection = document.querySelector('.nav-item.active')?.innerText.toLowerCase();
        if (!activeSection) { renderMainClientInventory(); return; }
        if (activeSection.includes('inventory')) renderMainClientInventory();
        else if (activeSection.includes('payment to admin')) renderMainClientPaymentToAdmin();
        else if (activeSection.includes('finance')) renderMainClientFinance();
        else if (activeSection.includes('expenses')) renderMainClientExpenses();
        else if (activeSection.includes('distribute')) renderMainClientDistribute();
        else if (activeSection.includes('payments') && !activeSection.includes('payment to')) renderMainClientPayments();
        else if (activeSection.includes('billing')) renderMainClientBilling();
        else if (activeSection.includes('invoices')) renderMainClientInvoices();
        else if (activeSection.includes('report')) renderMainClientReport();
        else if (activeSection.includes('users')) renderMainClientUsers();
        else if (activeSection.includes('shipments')) renderMainClientShipments();
        else if (activeSection.includes('alerts')) renderMainClientAlerts();
        else if (activeSection.includes('returns')) renderMainClientReturns();
        else if (activeSection.includes('total amount')) renderTotalAmountMain();
        else if (activeSection.includes('history')) renderMainClientHistory();
        else renderMainClientInventory();

    } else if (currentUser.role === 'branch') {
        await refreshDataFromServer();
        let activeSection = document.querySelector('.nav-item.active')?.innerText.toLowerCase();
        if (!activeSection) { renderBranchInventory(); return; }
        if (activeSection.includes('inventory')) renderBranchInventory();
        else if (activeSection.includes('sell')) renderBranchSale();
        else if (activeSection.includes('billing')) renderBranchBilling();
        else if (activeSection.includes('expenses')) renderBranchExpenses();
        else if (activeSection.includes('finance')) renderBranchFinance();
        else if (activeSection.includes('report')) renderBranchCompleteReport();
        else if (activeSection.includes('payments')) renderBranchPayments();
        else if (activeSection.includes('returns')) renderBranchReturns();
        else if (activeSection.includes('history')) renderBranchHistory();
        else renderBranchInventory();
    }
};

// ==================== LOGIN ====================
document.getElementById('loginAdminTab').addEventListener('click', function () {
    document.getElementById('loginAdminTab').classList.add('active');
    document.getElementById('loginBranchTab').classList.remove('active');
    document.getElementById('loginMainClientTab').classList.remove('active');
    document.getElementById('loginAdminSection').style.display = 'block';
    document.getElementById('loginBranchSection').style.display = 'none';
    document.getElementById('loginMainClientSection').style.display = 'none';
});

document.getElementById('loginBranchTab').addEventListener('click', function () {
    document.getElementById('loginBranchTab').classList.add('active');
    document.getElementById('loginAdminTab').classList.remove('active');
    document.getElementById('loginMainClientTab').classList.remove('active');
    document.getElementById('loginAdminSection').style.display = 'none';
    document.getElementById('loginBranchSection').style.display = 'block';
    document.getElementById('loginMainClientSection').style.display = 'none';
});

document.getElementById('loginMainClientTab').addEventListener('click', function () {
    document.getElementById('loginMainClientTab').classList.add('active');
    document.getElementById('loginAdminTab').classList.remove('active');
    document.getElementById('loginBranchTab').classList.remove('active');
    document.getElementById('loginAdminSection').style.display = 'none';
    document.getElementById('loginBranchSection').style.display = 'none';
    document.getElementById('loginMainClientSection').style.display = 'block';
});

document.getElementById('loginBtn').addEventListener('click', async function () {
    let isAdmin = document.getElementById('loginAdminTab').classList.contains('active');
    let isBranch = document.getElementById('loginBranchTab').classList.contains('active');
    let username, password, role;

    if (isAdmin) {
        username = document.getElementById('adminUser').value;
        password = document.getElementById('adminPass').value;
        role = 'admin';
    } else if (!isBranch) {
        username = document.getElementById('mainClientUser').value;
        password = document.getElementById('mainClientPass').value;
        role = 'mainclient';
    } else {
        username = document.getElementById('branchUser').value;
        password = document.getElementById('branchPass').value;
        role = 'branch';
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });

        if (response.ok) {
            const user = await response.json();
            currentUser = { role: user.role, username: user.username };

            await refreshDataFromServer();

            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            document.getElementById('roleDisplay').textContent =
                currentUser.role === 'admin' ? 'Admin' : (currentUser.role === 'mainclient' ? 'Main Client' : 'Branch');
            document.getElementById('userDisplay').textContent = currentUser.username;

            renderSidebar();

            if (currentUser.role === 'admin') renderInventory();
            else if (currentUser.role === 'mainclient') renderMainClientInventory();
            else renderBranchInventory();
        } else {
            const error = await response.json();
            alert(error.error || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Cannot connect to server. Make sure server is running on port 5000');
    }
});

// ==================== LOGOUT ====================
window.logout = function () {
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginPage').style.display = 'block';
    currentUser = null;
};

document.getElementById('logoutBtn').addEventListener('click', logout);