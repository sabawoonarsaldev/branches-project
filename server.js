const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require("fs")
require('dotenv').config();

// // Fix MySQL timezone issue
// const pool = mysql.createPool({
//     host: process.env.DB_HOST || 'localhost',
//     user: process.env.DB_USER || 'root',
//     password: process.env.DB_PASSWORD || 'shakeb123',
//     database: process.env.DB_NAME || 'branchflow_db',
//     waitForConnections: true,
//     connectionLimit: 10,
//     timezone: '+00:00'
// });
// // Test connection
// pool.getConnection().then(conn => {
//     console.log('Connected to MySQL successfully');
//     conn.release();
// }).catch(err => {
//     console.error('MySQL connection error:', err);
// });

// MySQL connection pool (Aiven / production ready)

const ca_path = process.env.CA || '/etc/secrets/ca.pem';
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,

    waitForConnections: true,
    connectionLimit: 10,

    // important for Aiven
    ssl: {
        ca: fs.readFileSync(ca_path),
        rejectUnauthorized: true
    },

    timezone: '+00:00'
});

pool.getConnection()
    .then(conn => {
        console.log('Connected to MySQL successfully');
        conn.release();
    })
    .catch(err => {
        console.error('MySQL connection error:', err);
    });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// ============= INVENTORY API =============
app.get('/api/inventory', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM main_inventory ORDER BY id');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory', async (req, res) => {
    const { name, purchase_price, selling_price, quantity, supplier, date } = req.body;
    try {
        const [result] = await pool.execute(
            'INSERT INTO main_inventory (name, purchase_price, selling_price, quantity, supplier, date) VALUES (?, ?, ?, ?, ?, ?)',
            [name, purchase_price, selling_price, quantity, supplier, date]
        );

        // Also add to main_client_items
        await pool.execute(
            'INSERT INTO main_client_items (name, selling_price, purchase_price, quantity, supplier, date) VALUES (?, ?, ?, ?, ?, ?)',
            [name, selling_price, purchase_price, quantity, supplier, date]
        );

        const [rows] = await pool.execute('SELECT * FROM main_inventory WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { name, purchase_price, selling_price, quantity, supplier, date } = req.body;
    console.log(`Updating inventory item ${id}:`, { name, purchase_price, selling_price, quantity, supplier, date });

    try {
        const [existingItem] = await pool.execute('SELECT * FROM main_inventory WHERE id = ?', [id]);
        if (existingItem.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        await pool.execute(
            'UPDATE main_inventory SET name = ?, purchase_price = ?, selling_price = ?, quantity = ?, supplier = ?, date = ? WHERE id = ?',
            [name, purchase_price, selling_price, quantity, supplier, date, id]
        );

        await pool.execute(
            'UPDATE main_client_items SET name = ?, selling_price = ?, purchase_price = ?, quantity = ?, supplier = ?, date = ? WHERE id = ?',
            [name, selling_price, purchase_price, quantity, supplier, date, id]
        );

        const [rows] = await pool.execute('SELECT * FROM main_inventory WHERE id = ?', [id]);
        console.log('Item updated:', rows[0]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in PUT /api/inventory/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [item] = await pool.execute('SELECT name FROM main_inventory WHERE id = ?', [id]);
        await pool.execute('DELETE FROM main_inventory WHERE id = ?', [id]);
        if (item[0]) {
            await pool.execute('DELETE FROM main_client_items WHERE name = ?', [item[0].name]);
        }
        res.json({ message: 'Item deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= MAIN CLIENT DISTRIBUTED API =============
app.get('/api/main-client-distributed/:mainClient/:itemName', async (req, res) => {
    const { mainClient, itemName } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT distributed_quantity FROM main_client_distributed WHERE main_client = ? AND item_name = ?',
            [mainClient, itemName]
        );
        res.json({ distributed: rows.length > 0 ? parseInt(rows[0].distributed_quantity) : 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/main-client-distributed/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT item_name, distributed_quantity FROM main_client_distributed WHERE main_client = ?',
            [mainClient]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/main-client-distributed', async (req, res) => {
    const { main_client, item_name, distributed_quantity } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO main_client_distributed (main_client, item_name, distributed_quantity) 
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE distributed_quantity = distributed_quantity + ?`,
            [main_client, item_name, distributed_quantity, distributed_quantity]
        );

        const [rows] = await pool.execute(
            'SELECT * FROM main_client_distributed WHERE main_client = ? AND item_name = ?',
            [main_client, item_name]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in POST /api/main-client-distributed:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= USER MANAGEMENT API =============
app.post('/api/users', async (req, res) => {
    const { username, password, role, frozen, blocked, deleted } = req.body;
    try {
        const [existingUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const [result] = await pool.execute(
            'INSERT INTO users (username, password, role, frozen, blocked, deleted) VALUES (?, ?, ?, ?, ?, ?)',
            [username, password, role, frozen || false, blocked || false, deleted || false]
        );

        const [rows] = await pool.execute('SELECT id, username, role FROM users WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, role, frozen, blocked, deleted } = req.body;
    try {
        await pool.execute(
            'UPDATE users SET username = ?, password = ?, role = ?, frozen = ?, blocked = ?, deleted = ? WHERE id = ?',
            [username, password, role, frozen, blocked, deleted, id]
        );

        const [rows] = await pool.execute('SELECT id, username, role FROM users WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE users SET deleted = true WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, username, role, frozen, blocked, deleted FROM users WHERE deleted = false');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ? AND password = ? AND role = ? AND deleted = false',
            [username, password, role]
        );
        if (rows.length > 0) {
            const user = rows[0];
            if (user.blocked) return res.status(403).json({ error: 'Account is blocked' });
            if (user.frozen) return res.status(403).json({ error: 'Account is frozen' });
            res.json({ id: user.id, username: user.username, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= BRANCH INVENTORY API =============
app.get('/api/branch-inventory/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM branch_inventory WHERE branch = ?', [branch]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/branch-inventory', async (req, res) => {
    const { branch, item_name, quantity, selling_price, purchase_price, shipment_date, distribution_id, supplier, original_quantity } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO branch_inventory (branch, item_name, quantity, selling_price, purchase_price, shipment_date, distribution_id, supplier, original_quantity) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [branch, item_name, quantity, selling_price, purchase_price, shipment_date, distribution_id, supplier, original_quantity || quantity]
        );

        const [rows] = await pool.execute('SELECT * FROM branch_inventory WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= SALES API =============
app.get('/api/sales/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM sales_history WHERE branch = ? ORDER BY date DESC', [branch]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales', async (req, res) => {
    const { date, branch, item, qty, price, purchase_price, revenue, cost, profit, bill_number } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO sales_history (date, branch, item, qty, price, purchase_price, revenue, cost, profit, bill_number) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [date, branch, item, qty, price, purchase_price, revenue, cost, profit, bill_number]
        );

        const [rows] = await pool.execute('SELECT * FROM sales_history WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= SHIPMENTS API =============
app.get('/api/shipments', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM shipments_to_branches ORDER BY date DESC');

        const shipments = rows.map(s => ({
            id: s.id,
            date: s.date ? (typeof s.date === 'string' ? s.date.split('T')[0] : s.date.toISOString().split('T')[0].replace(/(\d{4})-(\d{2})-(\d{2}).*/, '$1-$2-$3')) : null,
            branch: s.branch,
            item: s.item,
            qty: s.qty,
            selling_price: s.selling_price,
            purchase_price: s.purchase_price,
            unique_key: s.unique_key
        }));
        console.log('Shipments with cleaned dates:', shipments.map(s => ({ id: s.id, date: s.date })));
        res.json(shipments);
    } catch (err) {
        console.error('Error in /api/shipments:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shipments', async (req, res) => {
    const { date, branch, item, qty, selling_price, purchase_price, unique_key } = req.body;
    let cleanDate = date;
    if (date && date.includes('T')) {
        cleanDate = date.split('T')[0];
    }
    if (date && date.includes('/')) {
        cleanDate = date.replace(/\//g, '-');
    }

    console.log('Original date:', date, 'Cleaned date:', cleanDate);

    try {
        const [result] = await pool.execute(
            `INSERT INTO shipments_to_branches (date, branch, item, qty, selling_price, purchase_price, unique_key) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [cleanDate, branch, item, qty, selling_price, purchase_price, unique_key]
        );

        const [rows] = await pool.execute('SELECT * FROM shipments_to_branches WHERE id = ?', [result.insertId]);
        console.log('Shipment saved with date:', rows[0].date);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in POST /api/shipments:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= EXPENSES API =============


app.post('/api/expenses', async (req, res) => {
    const { date, category, amount, description, user_role, username } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO expenses (date, category, amount, description, user_role, username) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [date, category, amount, description, user_role, username]
        );

        const [rows] = await pool.execute('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Get all expenses for admin
app.get('/api/expenses/admin', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM expenses WHERE user_role = 'admin' ORDER BY date DESC");
        res.json(rows);
    } catch (err) {
        console.error('Error in GET /api/expenses/admin:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= MAIN CLIENT PAYMENTS API =============
app.get('/api/main-client-payments/:mainClient/:itemId/:itemName/:quantity', async (req, res) => {
    const { mainClient, itemId, itemName, quantity } = req.params;
    console.log(`Checking payment status for: ${mainClient}, itemId: ${itemId}, itemName: ${itemName}, quantity: ${quantity}`);

    try {
        const [rows] = await pool.execute(
            'SELECT is_paid FROM main_client_payments WHERE main_client = ? AND item_id = ? AND item_name = ? AND quantity = ?',
            [mainClient, parseInt(itemId), itemName, parseInt(quantity)]
        );


        const isPaid = rows.length > 0 ? (rows[0].is_paid === 1 || rows[0].is_paid === true) : false;
        res.json({ is_paid: isPaid });

        console.log(`Payment status: ${isPaid}`);
    } catch (err) {
        console.error('Error in GET /api/main-client-payments:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/main-client-payments', async (req, res) => {
    const { main_client, item_id, item_name, quantity, date } = req.body;
    console.log(`Marking item as paid:`, { main_client, item_id, item_name, quantity, date });

    try {
        const [existing] = await pool.execute(
            'SELECT * FROM main_client_payments WHERE main_client = ? AND item_id = ? AND item_name = ? AND quantity = ? AND date = ?',
            [main_client, item_id, item_name, quantity, date]
        );

        let result;
        if (existing.length > 0) {
            await pool.execute(
                `UPDATE main_client_payments 
                 SET is_paid = 1, paid_date = CURRENT_DATE 
                 WHERE main_client = ? AND item_id = ? AND item_name = ? AND quantity = ? AND date = ?`,
                [main_client, item_id, item_name, quantity, date]
            );
            const [rows] = await pool.execute(
                'SELECT * FROM main_client_payments WHERE main_client = ? AND item_id = ? AND item_name = ? AND quantity = ? AND date = ?',
                [main_client, item_id, item_name, quantity, date]
            );
            result = rows[0];
            console.log('Updated existing payment record');
        } else {
            const [insertResult] = await pool.execute(
                `INSERT INTO main_client_payments (main_client, item_id, item_name, quantity, date, is_paid, paid_date) 
                 VALUES (?, ?, ?, ?, ?, 1, CURRENT_DATE)`,
                [main_client, item_id, item_name, quantity, date]
            );
            const [rows] = await pool.execute('SELECT * FROM main_client_payments WHERE id = ?', [insertResult.insertId]);
            result = rows[0];
            console.log('Created new payment record');
        }

        res.json(result);
    } catch (err) {
        console.error('Error in POST /api/main-client-payments:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/main-client-payments/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    console.log(`Getting all paid items for: ${mainClient}`);

    try {


        const [rows] = await pool.execute(
            'SELECT item_id, item_name, quantity, date, is_paid FROM main_client_payments WHERE main_client = ? AND is_paid = 1',
            [mainClient]
        );
        res.json(rows.map(r => ({
            ...r,
            is_paid: r.is_paid === 1 || r.is_paid === true
        })));

        console.log(`Found ${rows.length} paid items for ${mainClient}`);
        res.json(rows);
    } catch (err) {
        console.error('Error in GET /api/main-client-payments/:mainClient:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= SHIPMENT REMINDERS API =============


app.get('/api/shipment-received/branch/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        const [rows] = await pool.execute('SELECT shipment_id, is_received FROM shipment_reminders WHERE branch = ?', [branch]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shipment-received/:shipmentId', async (req, res) => {
    const { shipmentId } = req.params;
    try {
        const [rows] = await pool.execute('SELECT is_received FROM shipment_reminders WHERE shipment_id = ?', [shipmentId]);
        res.json({ is_received: rows.length > 0 ? rows[0].is_received : false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shipment-received', async (req, res) => {
    const { shipment_id, branch, item_name } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO shipment_reminders (shipment_id, is_received, received_date, branch, item_name) 
             VALUES (?, true, CURRENT_DATE, ?, ?)
             ON DUPLICATE KEY UPDATE is_received = true, received_date = CURRENT_DATE`,
            [shipment_id, branch, item_name]
        );

        const [rows] = await pool.execute('SELECT * FROM shipment_reminders WHERE shipment_id = ?', [shipment_id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= SHIPMENT PAYMENTS API =============


app.get('/api/shipment-payments/all', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT sp.shipment_id, sp.paid_amount, s.branch, s.item, s.qty, s.selling_price, s.date
             FROM shipment_payments sp
             JOIN shipments_to_branches s ON sp.shipment_id = s.unique_key
             ORDER BY s.date DESC`
        );
        console.log(`Found ${rows.length} total payments for admin`);
        res.json(rows);
    } catch (err) {
        console.error('Error in /api/shipment-payments/all:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shipment-payments/mainclient/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT sp.shipment_id, sp.paid_amount, s.branch, s.item, s.qty, s.selling_price, s.date
             FROM shipment_payments sp
             JOIN shipments_to_branches s ON sp.shipment_id = s.unique_key
             ORDER BY s.date DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error('Error in /api/shipment-payments/mainclient/:mainClient:', err);
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/shipment-payments/branch/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        const [rows] = await pool.execute(
            `SELECT sp.shipment_id, sp.paid_amount 
             FROM shipment_payments sp
             JOIN shipments_to_branches s ON sp.shipment_id = s.unique_key
             WHERE s.branch = ?`,
            [branch]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shipment-payment/:shipmentId', async (req, res) => {
    const { shipmentId } = req.params;
    try {
        const [rows] = await pool.execute('SELECT paid_amount FROM shipment_payments WHERE shipment_id = ?', [shipmentId]);
        if (rows.length > 0) {
            res.json({ paid_amount: parseFloat(rows[0].paid_amount) });
        } else {
            res.json({ paid_amount: 0 });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shipment-payment', async (req, res) => {
    const { shipment_id, paid_amount } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO shipment_payments (shipment_id, paid_amount, payment_date) 
             VALUES (?, ?, CURRENT_DATE)
             ON DUPLICATE KEY UPDATE paid_amount = paid_amount + ?`,
            [shipment_id, paid_amount, paid_amount]
        );

        const [rows] = await pool.execute('SELECT * FROM shipment_payments WHERE shipment_id = ?', [shipment_id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Hard delete user
app.delete('/api/users/:id/hard', async (req, res) => {
    const { id } = req.params;
    try {
        const [userRes] = await pool.execute('SELECT username, role FROM users WHERE id = ?', [id]);
        const user = userRes[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`Hard deleting user: ${user.username} with role: ${user.role}`);

        if (user.role === 'branch') {
            await pool.execute('DELETE FROM branch_inventory WHERE branch = ?', [user.username]);
            await pool.execute('DELETE FROM shipments_to_branches WHERE branch = ?', [user.username]);
            await pool.execute('DELETE FROM sales_history WHERE branch = ?', [user.username]);
            await pool.execute('DELETE FROM branch_returns WHERE branch = ?', [user.username]);
            await pool.execute('DELETE FROM shipment_reminders WHERE branch = ?', [user.username]);
            await pool.execute('DELETE FROM expenses WHERE user_role = ? AND username = ?', ['branch', user.username]);
            console.log(`Deleted branch data for ${user.username}`);
        } else if (user.role === 'mainclient') {
            await pool.execute('DELETE FROM main_client_payments WHERE main_client = ?', [user.username]);
            await pool.execute('DELETE FROM main_client_distributed WHERE main_client = ?', [user.username]);
            try {
                await pool.execute('DELETE FROM expenses WHERE user_role = ? AND username = ?', ['mainclient', user.username]);
            } catch (err) {
                console.log('Note: expenses table may not have mainclient records');
            }
            console.log(`Deleted main client data for ${user.username}`);
        } else if (user.role === 'admin') {
            if (user.username === 'admin') {
                return res.status(403).json({ error: 'Cannot delete the main admin user' });
            }
            console.log(`Deleting admin user: ${user.username}`);
        }

        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        console.log(`User ${user.username} deleted successfully`);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error hard deleting user:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete branch inventory
app.delete('/api/branch-inventory/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        await pool.execute('DELETE FROM branch_inventory WHERE branch = ?', [branch]);
        res.json({ message: 'Branch inventory deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete shipments by branch
app.delete('/api/shipments/branch/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        await pool.execute('DELETE FROM shipments_to_branches WHERE branch = ?', [branch]);
        res.json({ message: 'Shipments deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete main client payments
app.delete('/api/main-client-payments/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    try {
        await pool.execute('DELETE FROM main_client_payments WHERE main_client = ?', [mainClient]);
        res.json({ message: 'Payments deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete main client distributed
app.delete('/api/main-client-distributed/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    try {
        await pool.execute('DELETE FROM main_client_distributed WHERE main_client = ?', [mainClient]);
        res.json({ message: 'Distributed records deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update expense
app.put('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    const { date, category, amount, description, user_role, username } = req.body;
    try {
        await pool.execute(
            `UPDATE expenses SET date = ?, category = ?, amount = ?, description = ?, user_role = ?, username = ? 
             WHERE id = ?`,
            [date, category, amount, description, user_role, username, id]
        );

        const [rows] = await pool.execute('SELECT * FROM expenses WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete expense
app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM expenses WHERE id = ?', [id]);
        res.json({ message: 'Expense deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all expenses for admin (all users)
app.get('/api/expenses/all', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM expenses ORDER BY date DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get expenses for main client
app.get('/api/expenses/mainclient/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM expenses WHERE user_role = ? AND username = ? ORDER BY date DESC',
            ['mainclient', username]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get expenses for branch
app.get('/api/expenses/branch/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM expenses WHERE user_role = ? AND username = ? ORDER BY date DESC',
            ['branch', username]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/expenses/:role/:username', async (req, res) => {
    const { role, username } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM expenses WHERE user_role = ? AND username = ? ORDER BY date DESC', [role, username]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update branch inventory quantity
app.put('/api/branch-inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { quantity, original_quantity } = req.body;
    try {
        if (original_quantity !== undefined) {
            await pool.execute(
                'UPDATE branch_inventory SET quantity = ?, original_quantity = ? WHERE id = ?',
                [quantity, original_quantity, id]
            );
        } else {
            await pool.execute(
                'UPDATE branch_inventory SET quantity = ? WHERE id = ?',
                [quantity, id]
            );
        }

        const [rows] = await pool.execute('SELECT * FROM branch_inventory WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete shipment payment
app.delete('/api/shipment-payment/:shipmentId', async (req, res) => {
    const { shipmentId } = req.params;
    try {
        await pool.execute('DELETE FROM shipment_payments WHERE shipment_id = ?', [shipmentId]);
        res.json({ message: 'Payment deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= LOW STOCK ALERTS API =============
app.get('/api/alerts/mainclient/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    try {
        const [branchesRes] = await pool.execute('SELECT username FROM users WHERE role = ? AND deleted = false', ['branch']);
        const branches = branchesRes.map(b => b.username);

        if (branches.length === 0) {
            return res.json([]);
        }

        const placeholders = branches.map(() => '?').join(',');
        const [rows] = await pool.execute(
            `SELECT * FROM low_stock_alerts WHERE branch IN (${placeholders}) ORDER BY date DESC`,
            branches
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/alerts/branch/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM low_stock_alerts WHERE branch = ? AND resolved = false ORDER BY date DESC',
            [branch]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/alerts', async (req, res) => {
    const { branch, item_name, quantity, message, date } = req.body;
    try {
        const [result] = await pool.execute(
            `INSERT INTO low_stock_alerts (branch, item_name, quantity, message, date, resolved) 
             VALUES (?, ?, ?, ?, ?, false)`,
            [branch, item_name, quantity, message, date]
        );

        const [rows] = await pool.execute('SELECT * FROM low_stock_alerts WHERE id = ?', [result.insertId]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/alerts/:id/resolve', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute(
            'UPDATE low_stock_alerts SET resolved = true, resolved_date = CURRENT_DATE WHERE id = ?',
            [id]
        );

        const [rows] = await pool.execute('SELECT * FROM low_stock_alerts WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/alerts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM low_stock_alerts WHERE id = ?', [id]);
        res.json({ message: 'Alert deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= BRANCH RETURNS API =============
app.get('/api/returns/mainclient/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    try {
        const [rows] = await pool.execute('SELECT * FROM branch_returns ORDER BY date DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error in GET /api/returns/mainclient:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/returns/branch/:branch', async (req, res) => {
    const { branch } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM branch_returns WHERE branch = ? ORDER BY date DESC',
            [branch]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error in GET /api/returns/branch:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/returns', async (req, res) => {
    const { date, branch, item_name, quantity, price_per_unit, description, status } = req.body;
    console.log('Creating return:', { date, branch, item_name, quantity, price_per_unit, description });
    try {
        const [result] = await pool.execute(
            `INSERT INTO branch_returns (date, branch, item_name, quantity, price_per_unit, description, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [date, branch, item_name, quantity, price_per_unit, description, status || 'pending']
        );

        const [rows] = await pool.execute('SELECT * FROM branch_returns WHERE id = ?', [result.insertId]);
        console.log('Return created:', rows[0]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in POST /api/returns:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/returns/:id/approve', async (req, res) => {
    const { id } = req.params;
    console.log('Approving return ID:', id);
    try {
        const [checkResult] = await pool.execute('SELECT * FROM branch_returns WHERE id = ?', [id]);
        if (checkResult.length === 0) {
            return res.status(404).json({ error: 'Return not found' });
        }

        console.log('Found return:', checkResult[0]);

        await pool.execute(
            'UPDATE branch_returns SET status = ?, approved_date = CURRENT_DATE WHERE id = ?',
            ['approved', id]
        );

        const [rows] = await pool.execute('SELECT * FROM branch_returns WHERE id = ?', [id]);
        console.log('Return approved:', rows[0]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in PUT /api/returns/:id/approve:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/returns/:id/reject', async (req, res) => {
    const { id } = req.params;
    console.log('Rejecting return ID:', id);
    try {
        const [checkResult] = await pool.execute('SELECT * FROM branch_returns WHERE id = ?', [id]);
        if (checkResult.length === 0) {
            return res.status(404).json({ error: 'Return not found' });
        }

        await pool.execute(
            'UPDATE branch_returns SET status = ? WHERE id = ?',
            ['rejected', id]
        );

        const [rows] = await pool.execute('SELECT * FROM branch_returns WHERE id = ?', [id]);
        console.log('Return rejected:', rows[0]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in PUT /api/returns/:id/reject:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/returns/:id/paid', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute(
            'UPDATE branch_returns SET status = ?, paid_date = CURRENT_DATE WHERE id = ?',
            ['paid', id]
        );

        const [rows] = await pool.execute('SELECT * FROM branch_returns WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in PUT /api/returns/:id/paid:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a shipment
app.delete('/api/shipments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM shipments_to_branches WHERE id = ?', [id]);
        res.json({ message: 'Shipment deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a shipment
app.put('/api/shipments/:id', async (req, res) => {
    const { id } = req.params;
    const { date, branch, item, qty, selling_price, purchase_price, unique_key } = req.body;
    try {
        await pool.execute(
            `UPDATE shipments_to_branches 
             SET date = ?, branch = ?, item = ?, qty = ?, selling_price = ?, purchase_price = ?, unique_key = ? 
             WHERE id = ?`,
            [date, branch, item, qty, selling_price, purchase_price, unique_key, id]
        );

        const [rows] = await pool.execute('SELECT * FROM shipments_to_branches WHERE id = ?', [id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a sale
app.delete('/api/sales/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM sales_history WHERE id = ?', [id]);
        res.json({ message: 'Sale deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============= INVOICES API =============
app.post('/api/invoices', async (req, res) => {
    const { number, main_client, branch, date, total_items, total_value,
        all_time_total_items, all_time_total_value, all_time_paid, all_time_unpaid, items } = req.body;
    try {
        const [invoiceResult] = await pool.execute(
            `INSERT INTO invoices (number, main_client, branch, date, total_items, total_value, 
             all_time_total_items, all_time_total_value, all_time_paid, all_time_unpaid) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [number, main_client, branch, date, total_items, total_value,
                all_time_total_items, all_time_total_value, all_time_paid, all_time_unpaid]
        );

        const invoiceId = invoiceResult.insertId;
        for (const item of items) {
            await pool.execute(
                `INSERT INTO invoice_items (invoice_id, item_name, quantity, selling_price, total_price, date) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [invoiceId, item.item, item.qty, item.sellingPrice, item.sellingPrice * item.qty, item.date]
            );
        }

        const [rows] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in POST /api/invoices:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/admin', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT i.* FROM invoices i ORDER BY i.created_at DESC`
        );

        const invoices = [];
        for (const inv of rows) {
            const [itemsRows] = await pool.execute(
                'SELECT item_name, quantity, selling_price, date FROM invoice_items WHERE invoice_id = ?',
                [inv.id]
            );
            invoices.push({
                ...inv,
                total_items: parseInt(inv.total_items) || 0,
                total_value: parseFloat(inv.total_value) || 0,
                items: itemsRows
            });
        }

        res.json(invoices);
    } catch (err) {
        console.error('Error in GET /api/invoices/admin:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/mainclient/:mainClient', async (req, res) => {
    const { mainClient } = req.params;
    const { branch } = req.query;

    try {
        let query = 'SELECT * FROM invoices WHERE main_client = ?';
        let params = [mainClient];

        if (branch) {
            query += ' AND branch = ?';
            params.push(branch);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.execute(query, params);

        const invoices = rows.map(inv => ({
            ...inv,
            total_items: parseInt(inv.total_items) || 0,
            total_value: parseFloat(inv.total_value) || 0,
            all_time_total_items: parseInt(inv.all_time_total_items) || 0,
            all_time_total_value: parseFloat(inv.all_time_total_value) || 0,
            all_time_paid: parseFloat(inv.all_time_paid) || 0,
            all_time_unpaid: parseFloat(inv.all_time_unpaid) || 0
        }));

        res.json(invoices);
    } catch (err) {
        console.error('Error in GET /api/invoices/mainclient:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/:number', async (req, res) => {
    const { number } = req.params;
    try {
        const [invoiceResult] = await pool.execute('SELECT * FROM invoices WHERE number = ?', [number]);
        if (invoiceResult.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const [itemsResult] = await pool.execute(
            'SELECT * FROM invoice_items WHERE invoice_id = ?',
            [invoiceResult[0].id]
        );

        res.json({
            ...invoiceResult[0],
            items: itemsResult
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/invoices/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [checkResult] = await pool.execute('SELECT id FROM invoices WHERE id = ?', [id]);
        if (checkResult.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        await pool.execute('DELETE FROM invoices WHERE id = ?', [id]);
        console.log(`Invoice ${id} deleted successfully`);
        res.json({ message: 'Invoice deleted successfully' });
    } catch (err) {
        console.error('Error in DELETE /api/invoices/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============= DISCOUNTS API =============
app.get('/api/discounts', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM discounts ORDER BY applied_date DESC');
        res.json(rows);
    } catch (err) {
        console.error('Error in GET /api/discounts:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/discounts', async (req, res) => {
    const { item_name, discount_percent, discount_amount, is_percent, new_price, original_price, applied_date } = req.body;
    try {
        await pool.execute(
            `INSERT INTO discounts (item_name, discount_percent, discount_amount, is_percent, new_price, original_price, applied_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                discount_percent = VALUES(discount_percent),
                discount_amount = VALUES(discount_amount),
                is_percent = VALUES(is_percent),
                new_price = VALUES(new_price),
                original_price = VALUES(original_price),
                applied_date = VALUES(applied_date)`,
            [item_name, discount_percent, discount_amount, is_percent, new_price, original_price, applied_date]
        );

        const [rows] = await pool.execute('SELECT * FROM discounts WHERE item_name = ?', [item_name]);
        res.json(rows[0]);
    } catch (err) {
        console.error('Error in POST /api/discounts:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/discounts/:itemName', async (req, res) => {
    const { itemName } = req.params;
    try {
        await pool.execute('DELETE FROM discounts WHERE item_name = ?', [itemName]);
        res.json({ message: 'Discount deleted successfully' });
    } catch (err) {
        console.error('Error in DELETE /api/discounts/:itemName:', err);
        res.status(500).json({ error: err.message });
    }
});


// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});