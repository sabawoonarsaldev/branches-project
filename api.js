// API Service for BranchFlow

const API_URL = 'http://localhost:5000/api';



// ============= INVENTORY API =============
async function fetchInventory() {
    const response = await fetch(`${API_URL}/inventory`);
    return await response.json();
}

async function addInventoryItem(item) {
    const response = await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });
    return await response.json();
}

async function updateInventoryItem(id, item) {
    const response = await fetch(`${API_URL}/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });
    return await response.json();
}

async function deleteInventoryItem(id) {
    const response = await fetch(`${API_URL}/inventory/${id}`, {
        method: 'DELETE'
    });
    return await response.json();
}

// ============= USER API =============
async function fetchUsers() {
    const response = await fetch(`${API_URL}/users`);
    return await response.json();
}

async function loginUser(username, password, role) {
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
    }
    return await response.json();
}

async function addUser(user) {
    const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add user');
    }
    return await response.json();
}

async function updateUser(id, user) {
    const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
    }
    return await response.json();
}

async function deleteUserAPI(id) {
    const response = await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
    }
    return await response.json();
}

// ============= BRANCH INVENTORY API =============
async function fetchBranchInventory(branch) {
    const response = await fetch(`${API_URL}/branch-inventory/${branch}`);
    return await response.json();
}

async function addBranchInventory(item) {
    const response = await fetch(`${API_URL}/branch-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
    });
    return await response.json();
}

// ============= SALES API =============
async function fetchSales(branch) {
    const response = await fetch(`${API_URL}/sales/${branch}`);
    return await response.json();
}

async function addSale(sale) {
    const response = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale)
    });
    return await response.json();
}

// ============= SHIPMENTS API =============
async function fetchShipments() {
    const response = await fetch(`${API_URL}/shipments`);
    return await response.json();
}


async function addShipment(shipment) {
    console.log('Sending shipment to server:', shipment);
    const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipment)
    });
    const result = await response.json();
    console.log('Shipment saved response:', result);
    return result;
}

async function addShipment(shipment) {
    console.log('addShipment called with date:', shipment.date);
    const response = await fetch(`${API_URL}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipment)
    });
    const result = await response.json();
    console.log('addShipment response, saved date:', result.date);
    return result;
}

// ============= EXPENSES API =============
async function fetchExpenses(role, username) {
    const response = await fetch(`${API_URL}/expenses/${role}/${username}`);
    return await response.json();
}

async function addExpense(expense) {
    const response = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense)
    });
    return await response.json();
}

// ============= MAIN CLIENT PAYMENTS API =============

// ============= MAIN CLIENT PAYMENTS API =============
async function markItemAsPaid(main_client, item_name, quantity, date) {
    const response = await fetch(`${API_URL}/main-client-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_client, item_name, quantity, date })
    });
    return await response.json();
}

async function getPaymentStatus(mainClient, itemName, quantity) {
    const response = await fetch(`${API_URL}/main-client-payments/${mainClient}/${itemName}/${quantity}`);
    if (!response.ok) {
        return { is_paid: false };
    }
    return await response.json();
}

async function fetchPaidItems(mainClient) {
    const response = await fetch(`${API_URL}/main-client-payments/${mainClient}`);
    return await response.json();
}

// ============= MAIN CLIENT DISTRIBUTED API =============
async function updateDistributedQuantity(main_client, item_name, distributed_quantity) {
    const response = await fetch(`${API_URL}/main-client-distributed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ main_client, item_name, distributed_quantity })
    });
    return await response.json();
}

async function getDistributedQuantity(mainClient, itemName) {
    const response = await fetch(`${API_URL}/main-client-distributed/${mainClient}/${itemName}`);
    return await response.json();
}


// ============= SHIPMENT REMINDERS API =============
async function markShipmentAsReceived(shipment_id, branch, item_name) {
    const response = await fetch(`${API_URL}/shipment-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipment_id, branch, item_name })
    });
    return await response.json();
}

async function getShipmentReceivedStatus(shipmentId) {
    const response = await fetch(`${API_URL}/shipment-received/${shipmentId}`);
    return await response.json();
}

async function fetchBranchReceivedShipments(branch) {
    const response = await fetch(`${API_URL}/shipment-received/branch/${branch}`);
    return await response.json();
}


// ============= DISCOUNTS API =============
async function fetchDiscounts() {
    const response = await fetch(`${API_URL}/discounts`);
    return await response.json();
}

async function saveDiscount(discount) {
    const response = await fetch(`${API_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discount)
    });
    return await response.json();
}

async function deleteDiscount(itemName) {
    const response = await fetch(`${API_URL}/discounts/${encodeURIComponent(itemName)}`, {
        method: 'DELETE'
    });
    return await response.json();
}