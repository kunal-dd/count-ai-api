const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 2930;
const cors = require('cors');

app.use(cors());
app.use(bodyParser.json());

const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const SUPPLIERS_FILE = path.join(__dirname, 'suppliers.json');
const CHANGELOG_FILE = path.join(__dirname, 'changelog.json');

// Helper functions
const readData = (file) => {
  try {
    if (!fs.existsSync(file)) {
      return [];
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
  }
};

const writeData = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
};

// --- INVENTORY APIs ---

// 1. Get Inventory
app.get('/inventory', (req, res) => {
  const inventory = readData(INVENTORY_FILE);
  res.json(inventory);
});

// 2. Update Inventory Item
app.put('/inventory/:id', (req, res) => {
  const id = req.params.id; // ID is now a string
  const updates = req.body;
  const inventory = readData(INVENTORY_FILE);

  const itemIndex = inventory.findIndex(item => item.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Record changes in Changelog if quantity changes
  if (updates.quantity !== undefined && updates.quantity !== inventory[itemIndex].quantity) {
    const changeLog = readData(CHANGELOG_FILE);
    changeLog.push({
      id: `log-${Date.now()}`,
      itemId: id,
      timestamp: new Date().toISOString(),
      user: "System/User", // In a real app, get from auth context
      type: "inventory-count",
      previousQuantity: inventory[itemIndex].quantity,
      newQuantity: updates.quantity
    });
    writeData(CHANGELOG_FILE, changeLog);
  }

  inventory[itemIndex] = { ...inventory[itemIndex], ...updates, lastUpdated: new Date().toISOString().split('T')[0] };
  writeData(INVENTORY_FILE, inventory);

  res.json(inventory[itemIndex]);
});

// 3. Update Inventory Item by Name
app.put('/inventory/name/:name', (req, res) => {
  const name = req.params.name.trim().toLowerCase();
  const updates = req.body;
  const inventory = readData(INVENTORY_FILE);

  const itemIndex = inventory.findIndex(item => item.name.toLowerCase() === name);
  if (itemIndex === -1) {
    return res.status(404).json({ error: `Item '${req.params.name}' not found` });
  }

  // Reuse update logic for consistency could be better, but keeping simple for now
  if (updates.quantity !== undefined && updates.quantity !== inventory[itemIndex].quantity) {
    const changeLog = readData(CHANGELOG_FILE);
    changeLog.push({
      id: `log-${Date.now()}`,
      itemId: inventory[itemIndex].id,
      timestamp: new Date().toISOString(),
      user: "System/Agent",
      type: "inventory-count",
      previousQuantity: inventory[itemIndex].quantity,
      newQuantity: updates.quantity
    });
    writeData(CHANGELOG_FILE, changeLog);
  }

  inventory[itemIndex] = { ...inventory[itemIndex], ...updates, lastUpdated: new Date().toISOString().split('T')[0] };
  writeData(INVENTORY_FILE, inventory);

  res.json(inventory[itemIndex]);
});

// 4. Get Low Stock Items
app.get('/inventory/low-stock', (req, res) => {
  const inventory = readData(INVENTORY_FILE);
  const lowStockItems = inventory.filter(item => item.quantity < (item.reorderLevel || 10));
  res.json(lowStockItems);
});


// --- ORDER APIs ---

// 5. Get All Orders
app.get('/orders', (req, res) => {
  const orders = readData(ORDERS_FILE);
  res.json(orders);
});

// 6. Place New Order
app.post('/orders', (req, res) => {
  const { supplier, items, totalValue } = req.body;

  // Basic validation
  if (!supplier || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid order structure. Requires supplier, items string[].' });
  }

  const orders = readData(ORDERS_FILE);
  const newOrder = {
    id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
    supplier,
    items,
    status: 'low-stock', // Initial status
    orderDate: new Date().toISOString().split('T')[0],
    totalValue: totalValue || 0
  };

  orders.push(newOrder);
  writeData(ORDERS_FILE, orders);

  res.status(201).json(newOrder);
});

// 7. Update Order Status (e.g., "low-stock" -> "order-placed" -> "order-received")
app.put('/orders/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const orders = readData(ORDERS_FILE);

  const orderIndex = orders.findIndex(o => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const oldStatus = orders[orderIndex].status;
  orders[orderIndex].status = status;

  // If moving to "order-placed", set expected date (example 3 days out)
  if (status === 'order-placed' && oldStatus !== 'order-placed') {
    orders[orderIndex].orderDate = new Date().toISOString().split('T')[0];
    const date = new Date();
    date.setDate(date.getDate() + 3);
    orders[orderIndex].expectedDate = date.toISOString().split('T')[0];
  }

  // If moving to "order-received", UPDATE INVENTORY
  if (status === 'order-received' && oldStatus !== 'order-received') {
    const inventory = readData(INVENTORY_FILE);
    const itemsToUpdate = orders[orderIndex].items;
    const changeLog = readData(CHANGELOG_FILE);

    itemsToUpdate.forEach(orderItem => {
      const invItemIndex = inventory.findIndex(i => i.name.toLowerCase() === orderItem.itemName.toLowerCase());

      if (invItemIndex !== -1) {
        const oldQty = inventory[invItemIndex].quantity;
        const newQty = oldQty + orderItem.quantity;

        inventory[invItemIndex].quantity = newQty;
        inventory[invItemIndex].lastUpdated = new Date().toISOString().split('T')[0];

        // Log it
        changeLog.push({
          id: `log-${Date.now()}-${invItemIndex}`,
          itemId: inventory[invItemIndex].id,
          timestamp: new Date().toISOString(),
          user: "System",
          type: "order-received",
          previousQuantity: oldQty,
          newQuantity: newQty,
          orderId: id,
          supplier: orders[orderIndex].supplier
        });
      }
    });
    writeData(INVENTORY_FILE, inventory);
    writeData(CHANGELOG_FILE, changeLog);
  }

  writeData(ORDERS_FILE, orders);
  res.json(orders[orderIndex]);
});


// --- SUPPLIER APIs ---

app.get('/suppliers', (req, res) => {
  const suppliers = readData(SUPPLIERS_FILE);
  res.json(suppliers);
});

app.post('/suppliers', (req, res) => {
  const suppliers = readData(SUPPLIERS_FILE);
  const newSupplier = {
    id: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
    ...req.body
  };
  suppliers.push(newSupplier);
  writeData(SUPPLIERS_FILE, suppliers);
  res.status(201).json(newSupplier);
});

app.put('/suppliers/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const suppliers = readData(SUPPLIERS_FILE);

  const index = suppliers.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: "Supplier not found" });

  suppliers[index] = { ...suppliers[index], ...updates };
  writeData(SUPPLIERS_FILE, suppliers);
  res.json(suppliers[index]);
});


// --- CHANGELOG APIs ---

app.get('/changelog', (req, res) => {
  const logs = readData(CHANGELOG_FILE);
  // Sort by timestamp desc
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

