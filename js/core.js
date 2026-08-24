// ==================== core.js ====================
// متغیرها، loadData، refreshData، helpers، توابع مالی

// ==================== INITIAL DATA ====================
const EMPTY_DATA = {
    users: [{ id: 1, username: 'admin', password: 'admin123', role: 'admin', frozen: false, blocked: false, deleted: false }],
    mainInventory: [],
    mainFinance: { totalPurchase: 0, totalSale: 0, totalProfit: 0, totalExpenses: 0 },
    branchInventory: {},
    branchFinance: {},
    branchExpenses: {},
    mainClientExpenses: {},
    shipments: [],
    mainClientItems: [],
    mainClientToBranchShipments: [],
    mainClientBranchPayments: {},
    expenses: [],
    lowStockAlerts: [],
    salesHistory: [],
    payments: {},
    mainClientPayments: {},
    shipmentReminders: {},
    invoices: [],
    branchReturns: [],
    mainClientDistributed: {},
    itemDiscounts: {},
    dailyPayments: {},
    billPayments: {},
    branchBills: {}
};

// ==================== GLOBAL VARIABLES ====================
let users = [];
let mainInventory = [];
let mainFinance = { totalPurchase: 0, totalSale: 0, totalProfit: 0, totalExpenses: 0 };
let branchInventory = {};
let branchFinance = {};
let branchExpenses = {};
let mainClientExpenses = {};
let shipments = [];
let mainClientItems = [];
let mainClientToBranchShipments = [];
let mainClientBranchPayments = {};
let expenses = [];
let lowStockAlerts = [];
let salesHistory = [];
let payments = {};
let mainClientPayments = {};
let shipmentReminders = {};
let invoices = [];
let branchReturns = [];
let mainClientDistributed = {};
let itemDiscounts = {};
let dailyPayments = {};
let billPayments = {};
let branchBills = {};
let shipmentPayments = {};
let currentUser = null;

// ==================== DATE HELPERS ====================
function getTodayDate() {
    let today = new Date();
    let year = today.getFullYear();
    let month = String(today.getMonth() + 1).padStart(2, '0');
    let day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateForCompare(dateString) {
    if (!dateString) return '';
    if (dateString.includes('T')) return dateString.split('T')[0];
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
    if (dateString.includes('/')) return dateString.replace(/\//g, '-');
    return dateString;
}

function getWeekAgoDate() {
    let date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
}

function getMonthAgoDate() {
    let date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
}

// ==================== FORMATTERS ====================
function formatMoney(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return 'AFG 0.00';
    let numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return 'AFG 0.00';
    return 'AFG ' + numAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== USER HELPERS ====================
function getAdminUsers() {
    return users.filter(u => u.role === 'admin' && !u.deleted);
}

function getBranchUsers() {
    return users.filter(u => u.role === 'branch' && !u.deleted);
}

function getMainClientUsers() {
    return users.filter(u => u.role === 'mainclient' && !u.deleted);
}

function getAllClientUsers() {
    return users.filter(u => (u.role === 'mainclient' || u.role === 'branch') && !u.deleted);
}

// ==================== MODAL HELPERS ====================
function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').classList.remove('active');
}

// ==================== LOAD DATA ====================
async function loadData() {
    try {
        const inventoryRes = await fetch('/api/inventory');
        const rawInventory = await inventoryRes.json();
        const mainInventory = rawInventory.map(item => ({
                    id: parseInt(item.id),
                    name: item.name,
                    purchasePrice: parseFloat(item.purchase_price) || parseFloat(item.purchasePrice) || 0,
                    sellingPrice: parseFloat(item.selling_price) || parseFloat(item.sellingPrice) || 0,
                    quantity: parseInt(item.quantity) || 0,
                    supplier: item.supplier || '',
                    date: item.date || getTodayDate(),
                    currency: item.currency || 'AFG'
                }));

        const usersRes = await fetch('/api/users');
        const users = await usersRes.json();

        let shipments = [];
        try {
            const shipmentsRes = await fetch('/api/shipments');
            if (shipmentsRes.ok) {
                const rawShipments = await shipmentsRes.json();
                shipments = rawShipments.map(s => ({
                    id: s.id,
                    date: s.date ? s.date.split('T')[0] : getTodayDate(),
                    branch: s.branch,
                    item: s.item,
                    qty: parseInt(s.qty),
                    sellingPrice: parseFloat(s.selling_price) || 0,
                    purchasePrice: parseFloat(s.purchase_price) || 0,
                    uniqueKey: s.unique_key
                }));
            }
        } catch (err) {
            console.log('No shipments yet:', err);
        }

        let itemDiscounts = {};
        try {
            const discountsRes = await fetch('/api/discounts');
            if (discountsRes.ok) {
                const discountsData = await discountsRes.json();
                for (const d of discountsData) {
                    itemDiscounts[d.item_name] = {
                        discountPercent: parseInt(d.discount_percent) || 0,
                        discountAmount: d.discount_amount ? parseFloat(d.discount_amount) : null,
                        isPercent: d.is_percent === 1 || d.is_percent === true,
                        newPrice: parseFloat(d.new_price),
                        originalPrice: parseFloat(d.original_price),
                        appliedDate: d.applied_date ? d.applied_date.split('T')[0] : getTodayDate()
                    };
                }
                for (const item of mainInventory) {
                    if (itemDiscounts[item.name]) item.sellingPrice = itemDiscounts[item.name].newPrice;
                }
            }
        } catch (err) {
            console.log('Error loading discounts:', err);
        }
        return {
            users, mainInventory,
            mainFinance: { totalPurchase: 0, totalSale: 0, totalProfit: 0, totalExpenses: 0 },
            branchInventory: {}, branchFinance: {}, branchExpenses: {}, mainClientExpenses: {},
            shipments: [], mainClientItems: [], mainClientToBranchShipments: shipments,
            mainClientBranchPayments: {}, expenses: [], lowStockAlerts: [], salesHistory: [],
            payments: {}, mainClientPayments: {}, shipmentReminders: {}, invoices: [],
            branchReturns: [], mainClientDistributed: {}, itemDiscounts,
            dailyPayments: {}, billPayments: {}, branchBills: {}
        };
    } catch (error) {
        console.error('Error loading data from API:', error);
        alert('Cannot connect to server. Make sure server is running on port 5000');
        return JSON.parse(JSON.stringify(EMPTY_DATA));
    }
}

// ==================== REFRESH DATA FROM SERVER ====================
async function refreshDataFromServer() {
    try {
        const freshInventory = await fetchInventory();
                const convertedInventory = freshInventory.map(item => ({
                    id: parseInt(item.id),
                    name: item.name,
                    purchasePrice: parseFloat(item.purchase_price) || parseFloat(item.purchasePrice) || 0,
                    sellingPrice: parseFloat(item.selling_price) || parseFloat(item.sellingPrice) || 0,
                    quantity: parseInt(item.quantity) || 0,
                    supplier: item.supplier || '',
                    date: item.date || getTodayDate(),
                    currency: item.currency || 'AFG'
                }));

        const freshUsers = await fetchUsers();

        let freshShipments = [];
        try {
            const shipmentsRes = await fetch('/api/shipments');
            if (shipmentsRes.ok) {
                freshShipments = await shipmentsRes.json();
            }
        } catch (err) { console.log('Error loading shipments:', err); }

        const convertedShipments = freshShipments.map(s => ({
            id: s.id,
            date: s.date ? formatDateForCompare(s.date) : getTodayDate(),
            branch: s.branch,
            item: s.item,
            qty: parseInt(s.qty),
            sellingPrice: parseFloat(s.selling_price) || parseFloat(s.sellingPrice) || 0,
            purchasePrice: parseFloat(s.purchase_price) || parseFloat(s.purchasePrice) || 0,
            uniqueKey: s.unique_key
        }));

        mainClientToBranchShipments = convertedShipments;

        // Load invoices
        try {
            if (currentUser && currentUser.role === 'admin') {
                const invoicesRes = await fetch('/api/invoices/admin');
                if (invoicesRes.ok) invoices = await invoicesRes.json();
            } else if (currentUser && currentUser.role === 'mainclient') {
                const invoicesRes = await fetch(`/api/invoices/mainclient/${currentUser.username}`);
                if (invoicesRes.ok) invoices = await invoicesRes.json();
            }
        } catch (err) { console.log('Error loading invoices:', err); }

        // Load received shipments
        shipmentReminders = {};
        try {
            const allBranches = freshUsers.filter(u => u.role === 'branch');
            for (const branch of allBranches) {
                const receivedRes = await fetch(`/api/shipment-received/branch/${branch.username}`);
                const receivedData = await receivedRes.json();
                receivedData.forEach(rec => {
                    if (rec.shipment_id) shipmentReminders[rec.shipment_id + '_received'] = true;
                });
            }
        } catch (err) { console.log('Error loading received shipments:', err); }

        // Load main client payments
        mainClientPayments = {};
        try {
            const allMainClients = freshUsers.filter(u => u.role === 'mainclient');
            for (const mainClient of allMainClients) {
                const paymentsRes = await fetch(`/api/main-client-payments/${mainClient.username}`);
                if (paymentsRes.ok) {
                    const paymentsData = await paymentsRes.json();
                    for (const payment of paymentsData) {
                        const itemId = `${payment.item_id}_${payment.item_name}_${payment.quantity}`;
                        mainClientPayments[itemId] = payment.is_paid === true || payment.is_paid === 1;
                    }
                }
            }
        } catch (err) { console.log('Error loading main client payments:', err); }

        // Load shipment payments
        let freshShipmentPayments = {};
        try {
            if (currentUser && currentUser.role === 'admin') {
                const paymentsRes = await fetch('/api/shipment-payments/all');
                if (paymentsRes.ok) {
                    const paymentsData = await paymentsRes.json();
                    for (const payment of paymentsData) {
                        freshShipmentPayments[payment.shipment_id] = parseFloat(payment.paid_amount) || 0;
                    }
                }
            } else if (currentUser && currentUser.role === 'mainclient') {
                const paymentsRes = await fetch(`/api/shipment-payments/mainclient/${currentUser.username}`);
                if (paymentsRes.ok) {
                    const paymentsData = await paymentsRes.json();
                    for (const payment of paymentsData) {
                        freshShipmentPayments[payment.shipment_id] = parseFloat(payment.paid_amount) || 0;
                    }
                }
            } else if (currentUser && currentUser.role === 'branch') {
                const paymentsRes = await fetch(`/api/shipment-payments/branch/${currentUser.username}`);
                if (paymentsRes.ok) {
                    const paymentsData = await paymentsRes.json();
                    for (const payment of paymentsData) {
                        freshShipmentPayments[payment.shipment_id] = parseFloat(payment.paid_amount) || 0;
                    }
                }
            }
        } catch (err) { console.log('Error loading shipment payments:', err); }
        shipmentPayments = freshShipmentPayments;

        // Load main client distributed
        mainClientDistributed = {};
        try {
            const allMainClients = freshUsers.filter(u => u.role === 'mainclient');
            for (const mainClient of allMainClients) {
                const distRes = await fetch(`/api/main-client-distributed/${mainClient.username}`);
                if (distRes.ok) {
                    const distData = await distRes.json();
                    for (const item of distData) {
                        mainClientDistributed[item.item_name] = parseInt(item.distributed_quantity);
                    }
                }
            }
        } catch (err) { console.log('Error loading main client distributed:', err); }

        // Load main client expenses
        if (currentUser && currentUser.role === 'mainclient') {
            try {
                const expensesRes = await fetch(`/api/expenses/mainclient/${currentUser.username}`);
                if (expensesRes.ok) {
                    const expensesData = await expensesRes.json();
                    mainClientExpenses[currentUser.username] = expensesData.map(e => ({
                        id: e.id,
                        date: e.date ? e.date.split('T')[0] : getTodayDate(),
                        category: e.category,
                        amount: parseFloat(e.amount),
                        description: e.description
                    }));
                }
            } catch (err) { console.log('Error loading main client expenses:', err); }
        }

        // Load all expenses for admin
        if (currentUser && currentUser.role === 'admin') {
            try {
                const allExpensesRes = await fetch('/api/expenses/all');
                if (allExpensesRes.ok) {
                    const allExpenses = await allExpensesRes.json();
                    for (const exp of allExpenses) {
                        if (exp.user_role === 'mainclient') {
                            const mc = exp.username;
                            if (!mainClientExpenses[mc]) mainClientExpenses[mc] = [];
                            if (!mainClientExpenses[mc].find(e => e.id === exp.id)) {
                                mainClientExpenses[mc].push({
                                    id: exp.id,
                                    date: exp.date ? exp.date.split('T')[0] : getTodayDate(),
                                    category: exp.category,
                                    amount: parseFloat(exp.amount),
                                    description: exp.description
                                });
                            }
                        }
                    }
                }
            } catch (err) { console.log('Error loading all expenses:', err); }
        }

        // Load branch returns
        try {
            if (currentUser && currentUser.role === 'mainclient') {
                const returnsRes = await fetch(`/api/returns/mainclient/${currentUser.username}`);
                if (returnsRes.ok) {
                    const returnsData = await returnsRes.json();
                    branchReturns = returnsData.map(r => ({
                        id: r.id,
                        date: r.date ? r.date.split('T')[0] : getTodayDate(),
                        branch: r.branch, itemName: r.item_name,
                        quantity: parseInt(r.quantity), pricePerUnit: parseFloat(r.price_per_unit),
                        description: r.description, status: r.status
                    }));
                }
            } else if (currentUser && currentUser.role === 'branch') {
                const returnsRes = await fetch(`/api/returns/branch/${currentUser.username}`);
                if (returnsRes.ok) {
                    const returnsData = await returnsRes.json();
                    branchReturns = returnsData.map(r => ({
                        id: r.id,
                        date: r.date ? r.date.split('T')[0] : getTodayDate(),
                        branch: r.branch, itemName: r.item_name,
                        quantity: parseInt(r.quantity), pricePerUnit: parseFloat(r.price_per_unit),
                        description: r.description, status: r.status
                    }));
                }
            }
        } catch (err) { console.log('Error loading branch returns:', err); }

        // Load low stock alerts
        if (currentUser && currentUser.role === 'mainclient') {
            try {
                const alertsRes = await fetch(`/api/alerts/mainclient/${currentUser.username}`);
                if (alertsRes.ok) {
                    const alertsData = await alertsRes.json();
                    lowStockAlerts = alertsData.map(a => ({
                        id: a.id, branch: a.branch, itemName: a.item_name,
                        quantity: a.quantity, date: a.date ? a.date.split('T')[0] : getTodayDate(),
                        message: a.message, resolved: a.resolved
                    }));
                }
            } catch (err) { console.log('Error loading alerts:', err); }
        }

        // Load branch inventory
        let freshBranchInventory = {};
        if (currentUser && currentUser.role === 'branch') {
            try {
                const branchInvRes = await fetch(`/api/branch-inventory/${currentUser.username}`);
                const branchInvData = await branchInvRes.json();
                freshBranchInventory[currentUser.username] = branchInvData.length > 0
                    ? branchInvData.map(b => ({
                        id: b.id, name: b.item_name,
                        quantity: parseInt(b.quantity), purchasePrice: parseFloat(b.purchase_price),
                        sellingPrice: parseFloat(b.selling_price), supplier: b.supplier,
                        shipmentDate: b.shipment_date, distributionId: b.distribution_id,
                        originalQuantity: parseInt(b.original_quantity) || parseInt(b.quantity)
                    }))
                    : [];
            } catch (err) {
                freshBranchInventory[currentUser.username] = [];
            }
        }

        // Load discounts
        try {
            const discountsRes = await fetch('/api/discounts');
            if (discountsRes.ok) {
                const discountsData = await discountsRes.json();
                itemDiscounts = {};
                for (const d of discountsData) {
                    itemDiscounts[d.item_name] = {
                        discountPercent: parseInt(d.discount_percent) || 0,
                        discountAmount: d.discount_amount ? parseFloat(d.discount_amount) : null,
                        isPercent: d.is_percent,
                        newPrice: parseFloat(d.new_price),
                        originalPrice: parseFloat(d.original_price),
                        appliedDate: d.applied_date ? d.applied_date.split('T')[0] : getTodayDate()
                    };
                }
                for (const item of convertedInventory) {
                    if (itemDiscounts[item.name]) item.sellingPrice = itemDiscounts[item.name].newPrice;
                }
            }
        } catch (err) { console.log('Error loading discounts:', err); }

        // Update globals
        mainInventory = convertedInventory;
        users = freshUsers;
        mainClientToBranchShipments = convertedShipments;
        if (currentUser && currentUser.role === 'branch') branchInventory = freshBranchInventory;
        mainClientItems = mainInventory.map(item => ({
                id: item.id, name: item.name,
                sellingPrice: item.sellingPrice, purchasePrice: item.purchasePrice,
                quantity: item.quantity, date: item.date || getTodayDate(), supplier: item.supplier,
                currency: item.currency || 'AFG'
            }));

        for (let shipment of mainClientToBranchShipments) {
            let discount = getItemDiscount(shipment.item);
            if (discount) {
                shipment._originalPrice = discount.originalPrice;
                shipment._discountedPrice = discount.newPrice;
            }
        }

if (Object.keys(itemDiscounts).length > 0) {
    for (let item of mainInventory) {
        let discount = itemDiscounts[item.name];
        if (discount) {
            item.sellingPrice = discount.newPrice;
            item.selling_price = discount.newPrice;
        }
    }
    for (let item of mainClientItems) {
        let discount = itemDiscounts[item.name];
        if (discount) {
            item.sellingPrice = discount.newPrice;
            item.selling_price = discount.newPrice;
        }
    }
}

if (Object.keys(itemDiscounts).length > 0) {
    for (let item of mainInventory) {
        let d = itemDiscounts[item.name];
        if (d) { item.sellingPrice = d.newPrice; item.selling_price = d.newPrice; }
    }
    for (let item of mainClientItems) {
        let d = itemDiscounts[item.name];
        if (d) { item.sellingPrice = d.newPrice; item.selling_price = d.newPrice; }
    }
    for (let s of mainClientToBranchShipments) {
        let d = itemDiscounts[s.item];
        if (d) { s._discountedPrice = d.newPrice; s._originalPrice = d.originalPrice; }
    }
}

try {
    const discRes = await fetch('/api/discounts');
    if (discRes.ok) {
        const discData = await discRes.json();
        if (discData.length > 0) {
            itemDiscounts = {};
            for (const d of discData) {
                itemDiscounts[d.item_name] = {
                    discountPercent: parseFloat(d.discount_percent),
                    newPrice: parseFloat(d.new_price),
                    originalPrice: parseFloat(d.original_price),
                    isPercent: d.is_percent === 1,
                    appliedDate: d.applied_date
                };
            }
            // اعمال به inventory
            for (let item of mainInventory) {
                let disc = itemDiscounts[item.name];
                if (disc) { item.sellingPrice = disc.newPrice; item.selling_price = disc.newPrice; }
            }
            for (let item of mainClientItems) {
                let disc = itemDiscounts[item.name];
                if (disc) { item.sellingPrice = disc.newPrice; item.selling_price = disc.newPrice; }
            }
        }
    }
} catch(err) { console.log('Discount load error:', err); }


// Load sales history for admin (needed for correct discount calculations in inventory)
   // Load sales history for admin (all) and branch (own) - needed for correct discount calculations
if (currentUser && currentUser.role === 'admin') {
    try {
        const allSalesRes = await fetch('/api/sales/all');
        if (allSalesRes.ok) {
            const allSalesData = await allSalesRes.json();
            salesHistory = allSalesData.map(s => ({
                id: s.id,
                date: s.date ? s.date.split('T')[0] : getTodayDate(),
                branch: s.branch,
                item: s.item,
                qty: parseInt(s.qty),
                price: parseFloat(s.price),
                purchasePrice: parseFloat(s.purchase_price),
                revenue: parseFloat(s.revenue),
                cost: parseFloat(s.cost),
                profit: parseFloat(s.profit),
                billNumber: s.bill_number,
                customer_name: s.customer_name || ''
            }));
        }
    } catch (err) { console.log('Error loading sales history:', err); }
} else if (currentUser && currentUser.role === 'branch') {
    try {
        const branchSalesRes = await fetch(`/api/sales/${currentUser.username}`);
        if (branchSalesRes.ok) {
            const branchSalesData = await branchSalesRes.json();
            salesHistory = branchSalesData.map(s => ({
                id: s.id,
                date: s.date ? s.date.split('T')[0] : getTodayDate(),
                branch: s.branch,
                item: s.item,
                qty: parseInt(s.qty),
                price: parseFloat(s.price),
                purchasePrice: parseFloat(s.purchase_price),
                revenue: parseFloat(s.revenue),
                cost: parseFloat(s.cost),
                profit: parseFloat(s.profit),
                billNumber: s.bill_number,
                customer_name: s.customer_name || ''
            }));
        }
    } catch (err) { console.log('Error loading branch sales history:', err); }
}
        recalcMainFinance();

        
        return true;
    } catch (error) {
        console.error('Error refreshing data:', error);
        return false;
    }
}

// ==================== SAVE DATA ====================
function saveData() {
    let data = {
        users, mainInventory, mainFinance, branchInventory, branchFinance, branchExpenses,
        mainClientExpenses, shipments, mainClientItems, mainClientToBranchShipments,
        mainClientBranchPayments, expenses, lowStockAlerts, salesHistory, payments,
        mainClientPayments, shipmentReminders, invoices, branchReturns, mainClientDistributed,
        itemDiscounts, dailyPayments, billPayments, branchBills
    };
    localStorage.setItem('branchflow_complete', JSON.stringify(data));
}

// ==================== FINANCE CALCULATIONS ====================
function calculateTotalPurchaseValue() {
    let total = 0;
    for (let i = 0; i < mainInventory.length; i++) {
        const item = mainInventory[i];
        total += (parseFloat(item.purchasePrice) || parseFloat(item.purchase_price) || 0) * (parseInt(item.quantity) || 0);
    }
    return total;
}



function calculateTotalSaleValue() {
    let total = 0;
    for (let item of mainInventory) {
        let currentPrice = parseFloat(item.sellingPrice) || 0;
        let quantity = parseInt(item.quantity) || 0;
        let discount = getItemDiscount(item.name);
        let originalPrice = discount ? discount.originalPrice : currentPrice;

        let soldQty = salesHistory.filter(s => s.item === item.name).reduce((sum, s) => sum + s.qty, 0);
        let remainingQty = quantity - soldQty;
        if (remainingQty < 0) remainingQty = 0;
        if (soldQty > quantity) soldQty = quantity;

        total += (soldQty * originalPrice) + (remainingQty * currentPrice);
    }
    return total;
}


function recalcMainFinance() {
    let totalPurchase = 0, totalSale = 0, totalExpenses = 0;
    let totalPurchaseUSD = 0, totalSaleUSD = 0;
    for (let item of mainInventory) {
        const qty = parseInt(item.quantity) || 0;
        const purchasePrice = parseFloat(item.purchase_price) || parseFloat(item.purchasePrice) || 0;
        const itemCurrency = item.currency || 'AFG';

        let currentPrice = parseFloat(item.selling_price) || parseFloat(item.sellingPrice) || 0;
        let discount = getItemDiscount(item.name);
        let originalPrice = discount ? discount.originalPrice : currentPrice;
        let soldQty = salesHistory.filter(s => s.item === item.name).reduce((sum, s) => sum + s.qty, 0);
        let remainingQty = Math.max(0, qty - soldQty);
        let actualSoldQty = Math.min(soldQty, qty);
        let saleValue = (actualSoldQty * originalPrice) + (remainingQty * currentPrice);

        if (itemCurrency === 'USD') {
            totalPurchaseUSD += purchasePrice * qty;
            totalSaleUSD += saleValue;
        } else {
            totalPurchase += purchasePrice * qty;
            totalSale += saleValue;
        }
    }
 
    let totalExpensesUSD = 0;
    for (let exp of expenses) {
        let amt = parseFloat(exp.amount) || 0;
        if (exp.currency === 'USD') totalExpensesUSD += amt;
        else totalExpenses += amt;
    }
    for (const client in mainClientExpenses) {
        if (Array.isArray(mainClientExpenses[client]))
            for (let exp of mainClientExpenses[client])
                totalExpenses += parseFloat(exp.amount) || 0;
    }
    mainFinance.totalPurchase = totalPurchase;
    mainFinance.totalSale = totalSale;
    mainFinance.totalExpenses = totalExpenses;
    mainFinance.totalProfit = totalSale - totalPurchase - totalExpenses;

    mainFinance.totalPurchaseUSD = totalPurchaseUSD;
    mainFinance.totalSaleUSD = totalSaleUSD;
    mainFinance.totalExpensesUSD = totalExpensesUSD;
    mainFinance.totalProfitUSD = totalSaleUSD - totalPurchaseUSD - totalExpensesUSD;

    saveData();
}

function recalcBranchFinance(branch) {
    if (!branchFinance[branch])
        branchFinance[branch] = { totalSale: 0, totalPurchase: 0, totalProfit: 0, totalLoss: 0, totalExpenses: 0 };
    let branchSales = salesHistory.filter(s => s.branch === branch);
    branchFinance[branch].totalSale = branchSales.reduce((sum, s) => sum + (s.revenue || 0), 0);
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    branchFinance[branch].totalPurchase = branchShipments.reduce((sum, s) => sum + ((s.sellingPrice || 0) * (s.qty || 0)), 0);
    let branchExps = branchExpenses[branch] || [];
    branchFinance[branch].totalExpenses = branchExps.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    branchFinance[branch].totalProfit = branchFinance[branch].totalSale - branchFinance[branch].totalPurchase;
    saveData();
}

// ==================== SHIPMENT PAYMENT HELPERS ====================
function generateMainClientToBranchShipmentId(shipment) {
    return `${shipment.date}_${shipment.branch}_${shipment.item}_${shipment.qty}`;
}

function getShipmentReminder(shipment) {
    let totalPrice = getShipmentCorrectTotal(shipment);
    if (shipment.uniqueKey && shipmentPayments[shipment.uniqueKey] !== undefined) {
        let paid = shipmentPayments[shipment.uniqueKey];
        let reminder = totalPrice - paid;
        return reminder < 0 ? 0 : reminder;
    }
    let id = generateMainClientToBranchShipmentId(shipment);
    if (shipmentReminders[id] !== undefined) {
        let reminder = shipmentReminders[id];
        return reminder < 0 ? 0 : reminder;
    }
    return totalPrice;
}

function getShipmentPaidAmount(shipment) {
    if (shipment.uniqueKey && shipmentPayments[shipment.uniqueKey] !== undefined)
        return shipmentPayments[shipment.uniqueKey];
    let total = getShipmentCorrectTotal(shipment);
    let reminder = getShipmentReminder(shipment);
    let paid = total - reminder;
    return paid < 0 ? 0 : paid;
}

function getShipmentStatus(shipment) {
    let totalPrice = getShipmentCorrectTotal(shipment);
    let paidAmount = getShipmentPaidAmount(shipment);
    if (paidAmount >= totalPrice || Math.abs(totalPrice - paidAmount) < 0.01) return 'paid';
    if (paidAmount > 0) return 'partial';
    return 'unpaid';
}

function updateShipmentReminder(shipment, paymentAmount) {
    let id = generateMainClientToBranchShipmentId(shipment);
    let currentReminder = getShipmentReminder(shipment);
    let newReminder = currentReminder - paymentAmount;
    if (Math.abs(newReminder) < 0.01) newReminder = 0;
    if (newReminder < 0) newReminder = 0;
    shipmentReminders[id] = newReminder;
    let totalPrice = getShipmentCorrectTotal(shipment);
    let paidSoFar = totalPrice - newReminder;
    if (shipment.uniqueKey) shipmentPayments[shipment.uniqueKey] = paidSoFar;
    updateDailyPayment(shipment.date, shipment, newReminder <= 0, paidSoFar);
    saveData();
}


function updateDailyPayment(date, shipment, isPaid, amount) {
    let key = `${date}`;
    if (!dailyPayments[key])
        dailyPayments[key] = { date, totalPaid: 0, totalUnpaid: 0, shipments: [] };
    let dailyRecord = dailyPayments[key];
    let shipmentId = generateMainClientToBranchShipmentId(shipment);
    let totalPrice = shipment.sellingPrice * shipment.qty;
    let existingShipment = dailyRecord.shipments.find(s => s.id === shipmentId);
    if (existingShipment) {
        let oldPaid = existingShipment.paidAmount;
        let oldUnpaid = existingShipment.totalPrice - oldPaid;
        dailyRecord.totalPaid = dailyRecord.totalPaid - oldPaid + (isPaid ? amount : 0);
        dailyRecord.totalUnpaid = dailyRecord.totalUnpaid - oldUnpaid + (!isPaid ? amount : 0);
        existingShipment.paidAmount = isPaid ? amount : 0;
        existingShipment.unpaidAmount = !isPaid ? amount : 0;
        existingShipment.isPaid = isPaid;
    } else {
        dailyRecord.shipments.push({
            id: shipmentId, date: shipment.date, branch: shipment.branch,
            item: shipment.item, qty: shipment.qty, totalPrice,
            paidAmount: isPaid ? amount : 0, unpaidAmount: !isPaid ? amount : 0, isPaid
        });
        if (isPaid) dailyRecord.totalPaid += amount;
        else dailyRecord.totalUnpaid += amount;
    }
    saveData();
}

function getDailyPayments(date) {
    return dailyPayments[`${date}`] || { date, totalPaid: 0, totalUnpaid: 0, shipments: [] };
}

function getAllDailyPayments() {
    return Object.values(dailyPayments).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ==================== MAIN CLIENT HELPERS ====================
function generateMainClientItemId(item) {
    let itemId = item.id || item.item_id;
    let date = item.date || getTodayDate();
    let itemName = item.name || '';
    return `${itemId}_${date}_${itemName}`;
}

async function isMainClientItemPaid(item) {
    if (item.supplier && item.supplier.includes('Returned from')) return true;
    if (!currentUser || !currentUser.username) return false;
    let itemKey = generateMainClientItemId(item);
    if (mainClientPayments[itemKey] === true) return true;
    try {
        const response = await fetch(`/api/main-client-payments/${currentUser.username}/${item.id}/${encodeURIComponent(item.name)}/${item.quantity}`);
        if (response.ok) {
            const status = await response.json();
            if (status.is_paid === true || status.is_paid === 1) {
                mainClientPayments[itemKey] = true;
                return true;
            }
        }
        return false;
    } catch (error) { return false; }
}

async function getMainClientItems() {
    try {
        const distRes = await fetch(`/api/main-client-distributed/${currentUser.username}`);
        if (distRes.ok) {
            const distData = await distRes.json();
            for (const item of distData)
                mainClientDistributed[item.item_name] = parseInt(item.distributed_quantity);
        }
    } catch (err) { console.log('Error loading distributed:', err); }

    if (mainClientItems.length !== mainInventory.length && mainInventory.length > 0) {
        mainClientItems = mainInventory.map(item => ({
            id: item.id, name: item.name, sellingPrice: item.sellingPrice,
            purchasePrice: item.purchasePrice, quantity: item.quantity,
            date: item.date || getTodayDate(), supplier: item.supplier
        }));
    }

    let results = [];
    for (let item of mainClientItems) {
        let cleanName = item.name.trim().toLowerCase();
        let distributed = 0;
        for (let key of Object.keys(mainClientDistributed)) {
            if (key.trim().toLowerCase() === cleanName) {
                distributed += mainClientDistributed[key] || 0;
            }
        }
        let remainingQuantity = Math.max(0, item.quantity - distributed);
        let isReturnedItem = item.supplier && item.supplier.includes('Returned from');
        let isPaid = isReturnedItem ? true : await isMainClientItemPaid(item);
        results.push({
            ...item, paid: isPaid, originalPaid: isReturnedItem ? true : isPaid,
            distributed, remainingQuantity,
            totalValue: (item.sellingPrice || 0) * remainingQuantity,
            discount: getItemDiscount(item.name)
        });
    }
    return results;
}


function calculateRemainingStockInMainClients(itemName) {
    let totalRemaining = 0;
    let cleanName = itemName.trim().toLowerCase();
    for (let mainItem of mainClientItems) {
        if (mainItem.name.trim().toLowerCase() === cleanName) {
            let distributed = 0;
            for (let key of Object.keys(mainClientDistributed)) {
                if (key.trim().toLowerCase() === cleanName) {
                    distributed += mainClientDistributed[key] || 0;
                }
            }
            let remaining = (mainItem.quantity || 0) - distributed;
            if (remaining > 0) totalRemaining += remaining;
        }
    }
    return totalRemaining;
}


async function getMainClientPaymentSummary() {
    let clientItems = await getMainClientItems();
    let totalPaid = 0, totalUnpaid = 0, paidItems = 0;
    for (const item of clientItems) {
        if (item.paid === true) { totalPaid += item.totalValue; paidItems++; }
        else totalUnpaid += (item.sellingPrice * item.remainingQuantity);
    }
    return { totalPaid, totalUnpaid, totalItems: clientItems.length, paidItems };
}

function markMainClientItemAsPaid(item) {
    let id = generateMainClientItemId(item);
    mainClientPayments[id] = true;
    saveData();
    if (currentUser && currentUser.role === 'admin') {
        if (document.querySelector('.nav-item.active')?.innerText.toLowerCase().includes('payments'))
            renderAdminPayments();
    } else if (currentUser && currentUser.role === 'mainclient') {
        renderMainClientInventory();
    }
}

// ==================== MAIN CLIENT SHIPMENTS HELPERS ====================
function getMainClientToBranchShipments() {
    return mainClientToBranchShipments.map(s => ({
        ...s, reminder: getShipmentReminder(s), paidAmount: getShipmentPaidAmount(s),
        status: getShipmentStatus(s), totalPrice: (s.sellingPrice || 0) * (s.qty || 0)
    }));
}

function getMainClientToBranchPaymentSummary() {
    let shipments = getMainClientToBranchShipments();
    let totalValue = shipments.reduce((sum, s) => sum + s.totalPrice, 0);
    let totalPaid = shipments.reduce((sum, s) => sum + s.paidAmount, 0);
    return {
        totalPaid, totalUnpaid: totalValue - totalPaid,
        totalItems: shipments.length,
        paidItems: shipments.filter(s => s.status === 'paid').length,
        partialItems: shipments.filter(s => s.status === 'partial').length
    };
}

// ==================== BRANCH HELPERS ====================
function getBranchShipments(branch) {
    return mainClientToBranchShipments.filter(s => s.branch === branch).map(s => ({
        id: generateMainClientToBranchShipmentId(s), date: s.date, item: s.item,
        quantity: s.qty, pricePerUnit: s.sellingPrice,
        totalPrice: s.sellingPrice * s.qty, reminder: getShipmentReminder(s),
        paidAmount: getShipmentPaidAmount(s), status: getShipmentStatus(s)
    }));
}

function getBranchPaymentSummary(branch) {
    let shipments = getBranchShipments(branch);
    let totalValue = shipments.reduce((sum, s) => sum + s.totalPrice, 0);
    let totalPaid = shipments.reduce((sum, s) => sum + s.paidAmount, 0);
    return {
        totalItems: shipments.length, totalValue, totalPaid,
        totalUnpaid: totalValue - totalPaid,
        paidItems: shipments.filter(s => s.status === 'paid').length,
        partialItems: shipments.filter(s => s.status === 'partial').length
    };
}

function getBranchSalesSummary(branch) {
    let branchSales = salesHistory.filter(s => s.branch === branch);
    return {
        totalItemsSold: branchSales.reduce((sum, s) => sum + s.qty, 0),
        totalRevenue: branchSales.reduce((sum, s) => sum + s.revenue, 0),
        totalCost: branchSales.reduce((sum, s) => sum + (s.cost || 0), 0),
        totalProfit: branchSales.reduce((sum, s) => sum + (s.profit || 0), 0)
    };
}

function getBranchReceivedSummary(branch) {
    let receivedShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    return {
        totalItemsReceived: receivedShipments.reduce((sum, s) => sum + s.qty, 0),
        totalValueReceived: receivedShipments.reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0)
    };
}

function getAllBranchesSummary() {
    let branches = getBranchUsers();
    let totalReceivedValue = 0, totalPaid = 0, totalSold = 0, totalRevenue = 0, totalProfit = 0;
    branches.forEach(branch => {
        mainClientToBranchShipments.filter(s => s.branch === branch.username).forEach(shipment => {
            totalReceivedValue += shipment.sellingPrice * shipment.qty;
            totalPaid += getShipmentPaidAmount(shipment);
        });
        salesHistory.filter(s => s.branch === branch.username).forEach(sale => {
            totalSold += sale.qty;
            totalRevenue += sale.revenue;
            totalProfit += sale.profit || 0;
        });
    });
    return { totalReceivedValue, totalPaid, totalUnpaid: totalReceivedValue - totalPaid, totalSold, totalRevenue, totalProfit };
}

// ==================== RETURN HELPERS ====================
function generateReturnId(returnRequest) {
    return `${returnRequest.date}_${returnRequest.branch}_${returnRequest.itemName}_${returnRequest.quantity}`;
}

function getReturnStatus(returnRequest) {
    if (returnRequest.status) return returnRequest.status;
    if (returnRequest.paid) return 'paid';
    if (returnRequest.approved) return 'approved';
    if (returnRequest.rejected) return 'rejected';
    return 'pending';
}

function getBranchReturns(branch) {
    return branchReturns.filter(r => r.branch === branch).map(r => ({
        ...r, status: getReturnStatus(r), totalValue: r.quantity * r.pricePerUnit
    }));
}

function getMainClientReturns() {
    return branchReturns.map(r => ({ ...r, status: getReturnStatus(r), totalValue: r.quantity * r.pricePerUnit }));
}

function getReturnSummary() {
    let returns = getMainClientReturns();
    return {
        totalReturns: returns.length,
        pendingReturns: returns.filter(r => r.status === 'pending').length,
        approvedReturns: returns.filter(r => r.status === 'approved').length,
        paidReturns: returns.filter(r => r.status === 'paid').length,
        rejectedReturns: returns.filter(r => r.status === 'rejected').length,
        totalValue: returns.reduce((sum, r) => sum + r.totalValue, 0),
        totalPaid: returns.filter(r => r.paid).reduce((sum, r) => sum + r.totalValue, 0)
    };
}

// ==================== DISCOUNT HELPERS ====================
function getItemDiscount(itemName) {
    return itemDiscounts[itemName] || null;
}

function getDiscountedPrice(originalPrice, itemName) {
    let discount = getItemDiscount(itemName);
    return discount ? discount.newPrice : originalPrice;
}

function getDiscountPercent(originalPrice, discountedPrice) {
    if (originalPrice === discountedPrice) return 0;
    return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

function formatByCurrency(amount, currency) {
    if (currency === 'USD') {
        if (amount === undefined || amount === null || isNaN(amount)) return '$ 0.00';
        let n = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(n)) return '$ 0.00';
        return '$ ' + n.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
    return formatMoney(amount);
}

function renderPriceWithDiscount(originalPrice, currentPrice, itemName, currency = 'AFG') {
    let discount = getItemDiscount(itemName);
    if (discount && originalPrice !== currentPrice) {
        let percent = getDiscountPercent(originalPrice, currentPrice);
        return `<span class="old-price">${formatByCurrency(originalPrice, currency)}</span>
                <span class="new-price">${formatByCurrency(currentPrice, currency)}</span>
                <span class="discount-percent">-${percent}%</span>`;
    }
    return formatByCurrency(currentPrice, currency);
}

async function applyDiscountToItem(itemName, discountValue, isPercent) {
    let mainItem = mainInventory.find(i => i.name === itemName);
    if (!mainItem) return false;

    let originalPrice = mainItem.sellingPrice;
    let newPrice, discountPercent;

    if (isPercent) {
        discountPercent = discountValue;
        newPrice = originalPrice * (1 - discountPercent / 100);
    } else {
        newPrice = Math.max(0, originalPrice - discountValue);
        discountPercent = Math.round((discountValue / originalPrice) * 100);
    }

    itemDiscounts[itemName] = {
        discountPercent, discountAmount: isPercent ? null : discountValue,
        isPercent, newPrice, originalPrice, appliedDate: getTodayDate()
    };

    mainItem.sellingPrice = newPrice;

    mainClientItems.forEach(item => {
        if (item.name === itemName) item.sellingPrice = newPrice;
    });

    Object.keys(branchInventory).forEach(branch => {
        branchInventory[branch].forEach(item => {
            if (item.name === itemName) item.sellingPrice = newPrice;
        });
    });

    mainClientToBranchShipments.forEach(shipment => {
        if (shipment.item === itemName) {
            let branchName = shipment.branch;
            let branchItems = branchInventory[branchName] || [];
            let hasRemainingStock = branchItems.some(i => 
                i.name === itemName && i.quantity > 0
            );
            if (hasRemainingStock) {
                shipment.sellingPrice = newPrice;
            }
        }
    });

    try {
        const branches = getBranchUsers();
        for (const branchUser of branches) {
            const branchItems = branchInventory[branchUser.username] || [];
            for (const bItem of branchItems) {
                if (bItem.name === itemName && bItem.id) {
                    await fetch(`/api/branch-inventory/${bItem.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            quantity: bItem.quantity,
                            selling_price: newPrice
                        })
                    });
                }
            }
        }
    } catch(err) { console.log('Error updating branch inventory prices:', err); }


    try {
        await fetch(`/api/branch-inventory/price/${encodeURIComponent(itemName)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selling_price: newPrice })
        });
    } catch(err) { console.log('Error updating branch prices:', err); }


    saveData();

    try {
        await saveDiscount({
            item_name: itemName,
            discount_percent: discountPercent,
            discount_amount: isPercent ? null : discountValue,
            is_percent: isPercent,
            new_price: newPrice,
            original_price: originalPrice,
            applied_date: getTodayDate()
        });
    } catch (err) { console.log('Error saving discount:', err); }

    if (currentUser) refreshCurrentSection();
    return true;
}

async function applyDiscountToAllItems(discountValue, isPercent) {
    for (const item of mainInventory) {
        let currentPrice = item.sellingPrice;
        let newPrice, discountPercent;

        if (isPercent) {
            discountPercent = discountValue;
            newPrice = currentPrice * (1 - discountPercent / 100);
        } else {
            newPrice = Math.max(0, currentPrice - discountValue);
            discountPercent = Math.round((discountValue / currentPrice) * 100);
        }

        itemDiscounts[item.name] = {
            discountPercent, discountAmount: isPercent ? null : discountValue,
            isPercent, newPrice, originalPrice: currentPrice, appliedDate: getTodayDate()
        };
        item.sellingPrice = newPrice;
    }

    // main client items
    mainClientItems.forEach(item => {
        if (itemDiscounts[item.name]) item.sellingPrice = itemDiscounts[item.name].newPrice;
    });

    Object.keys(branchInventory).forEach(branch => {
        branchInventory[branch].forEach(item => {
            if (itemDiscounts[item.name]) item.sellingPrice = itemDiscounts[item.name].newPrice;
        });
    });

    mainClientToBranchShipments.forEach(shipment => {
        if (itemDiscounts[shipment.item]) {
            let branchItems = branchInventory[shipment.branch] || [];
            let hasRemainingStock = branchItems.some(i =>
                i.name === shipment.item && i.quantity > 0
            );
            if (hasRemainingStock) {
                shipment.sellingPrice = itemDiscounts[shipment.item].newPrice;
            }
        }
    });

    try {
        await fetch(`/api/branch-inventory/price/${encodeURIComponent(item.name)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selling_price: itemDiscounts[item.name].newPrice })
        });
    } catch(err) {}

    saveData();

    try {
        for (const item of mainInventory) {
            if (itemDiscounts[item.name]) {
                await saveDiscount({
                    item_name: item.name,
                    discount_percent: itemDiscounts[item.name].discountPercent,
                    discount_amount: itemDiscounts[item.name].discountAmount,
                    is_percent: itemDiscounts[item.name].isPercent,
                    new_price: itemDiscounts[item.name].newPrice,
                    original_price: itemDiscounts[item.name].originalPrice,
                    applied_date: getTodayDate()
                });
            }
        }
    } catch (err) { console.log('Error saving discounts:', err); }

    if (currentUser) refreshCurrentSection();
}


// ==================== BILL HELPERS ====================
function generateBillId(branch, date) { return `BILL-${branch}-${date}`; }
function getBillShipments(branch, date) {
    return mainClientToBranchShipments.filter(s => s.branch === branch && s.date === date);
}
function calculateBillTotal(branch, date) {
    return getBillShipments(branch, date).reduce((sum, s) => sum + (s.sellingPrice * s.qty), 0);
}
function getBillPaidAmount(branch, date) { return billPayments[generateBillId(branch, date)] || 0; }
function getBillRemainingAmount(branch, date) { return calculateBillTotal(branch, date) - getBillPaidAmount(branch, date); }
function getBillStatus(branch, date) {
    let total = calculateBillTotal(branch, date);
    let paid = getBillPaidAmount(branch, date);
    if (paid <= 0) return 'unpaid';
    if (paid >= total) return 'paid';
    return 'partial';
}

// ==================== SYNC HELPERS ====================
function syncItemToAllLocations(itemId, updatedData) {
    let mainItem = mainInventory.find(i => i.id === itemId);
    if (mainItem) Object.assign(mainItem, { name: updatedData.name, purchasePrice: updatedData.purchasePrice, sellingPrice: updatedData.sellingPrice, quantity: updatedData.quantity, supplier: updatedData.supplier });
    mainClientItems.forEach(item => {
        if (item.name === updatedData.oldName) Object.assign(item, { name: updatedData.name, purchasePrice: updatedData.purchasePrice, sellingPrice: updatedData.sellingPrice, quantity: updatedData.quantity, supplier: updatedData.supplier });
    });
    Object.keys(branchInventory).forEach(branch => {
        branchInventory[branch].forEach(item => {
            if (item.name === updatedData.oldName) Object.assign(item, { name: updatedData.name, purchasePrice: updatedData.purchasePrice, sellingPrice: updatedData.sellingPrice, supplier: updatedData.supplier });
        });
    });
    [shipments, mainClientToBranchShipments].forEach(arr => {
        arr.forEach(s => {
            if (s.item === updatedData.oldName) { s.item = updatedData.name; s.purchasePrice = updatedData.purchasePrice; s.sellingPrice = updatedData.sellingPrice; }
        });
    });
    salesHistory.forEach(s => { if (s.item === updatedData.oldName) s.item = updatedData.name; });
    lowStockAlerts.forEach(a => { if (a.itemName === updatedData.oldName) a.itemName = updatedData.name; });
    saveData();
}

function deleteItemFromAllLocations(itemId, itemName) {
    mainInventory = mainInventory.filter(i => i.id !== itemId);
    mainClientItems = mainClientItems.filter(i => i.name !== itemName);
    Object.keys(branchInventory).forEach(branch => { branchInventory[branch] = branchInventory[branch].filter(i => i.name !== itemName); });
    shipments = shipments.filter(s => s.item !== itemName);
    mainClientToBranchShipments = mainClientToBranchShipments.filter(s => s.item !== itemName);
    salesHistory = salesHistory.filter(s => s.item !== itemName);
    lowStockAlerts = lowStockAlerts.filter(a => a.itemName !== itemName);
    saveData();
}

// ==================== INITIALIZE ====================
(async function init() {
    const data = await loadData();
    users = data.users; mainInventory = data.mainInventory; mainFinance = data.mainFinance;
    branchInventory = data.branchInventory; branchFinance = data.branchFinance;
    branchExpenses = data.branchExpenses; mainClientExpenses = data.mainClientExpenses;
    shipments = data.shipments; mainClientItems = data.mainClientItems;
    mainClientToBranchShipments = data.mainClientToBranchShipments;
    mainClientBranchPayments = data.mainClientBranchPayments;
    expenses = data.expenses; lowStockAlerts = data.lowStockAlerts;
    salesHistory = data.salesHistory; payments = data.payments;
    mainClientPayments = data.mainClientPayments; shipmentReminders = data.shipmentReminders;
    invoices = data.invoices; branchReturns = data.branchReturns;
    mainClientDistributed = data.mainClientDistributed; itemDiscounts = data.itemDiscounts;
    dailyPayments = data.dailyPayments; billPayments = data.billPayments; branchBills = data.branchBills;
    shipmentPayments = data.shipmentPayments || {};
    console.log('Initialization complete. Users:', users.length, 'Inventory:', mainInventory.length);
})();

function sortByDateDesc(arr, dateField = 'date') {
    return [...arr].sort((a, b) => {
        let da = new Date(a[dateField] || 0);
        let db = new Date(b[dateField] || 0);
        return db - da;
    });
}

function getShipmentCorrectTotal(s) {
    let totalQty = parseInt(s.qty) || 0;
    let basePrice = s.sellingPrice || 0;
    let fullPrice = basePrice * totalQty;
    
    let paidAmount = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
        ? shipmentPayments[s.uniqueKey] : 0;
    
    if (paidAmount >= fullPrice && fullPrice > 0) return fullPrice;
    
    let discount = getItemDiscount(s.item);
    if (!discount) return fullPrice;
    
    let originalPrice = parseFloat(discount.originalPrice) || basePrice;
    let currentPrice = parseFloat(discount.newPrice) || basePrice;
    
    let allSoldInBranch = salesHistory
        .filter(sale => sale.branch === s.branch && sale.item === s.item)
        .reduce((sum, sale) => sum + (parseInt(sale.qty) || 0), 0);
    
    let soldFromThis = Math.min(allSoldInBranch, totalQty);
    let unsoldQty = Math.max(0, totalQty - soldFromThis);
    
    return (soldFromThis * originalPrice) + (unsoldQty * currentPrice);
}

function getBranchRemainder(branch) {
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    let totalRemainder = 0;
    for (let s of branchShipments) {
        let correctTotal = getShipmentCorrectTotal(s);
        let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
            ? shipmentPayments[s.uniqueKey] : 0;
        totalRemainder += Math.max(0, correctTotal - paid);
    }
    return totalRemainder;
}

function getBranchTotalPaid(branch) {
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    return branchShipments.reduce((sum, s) => {
        let paid = (s.uniqueKey && shipmentPayments[s.uniqueKey] !== undefined) 
            ? shipmentPayments[s.uniqueKey] : 0;
        return sum + paid;
    }, 0);
}

function getBranchTotalValue(branch) {
    let branchShipments = mainClientToBranchShipments.filter(s => s.branch === branch);
    return branchShipments.reduce((sum, s) => sum + getShipmentCorrectTotal(s), 0);
}

// git status
// git add .
// git commit -m "Describe your changes"
// git push origin main

