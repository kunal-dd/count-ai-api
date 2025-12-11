const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const INVENTORY_FILE = path.join(__dirname, 'inventory.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// Helper functions
const readData = (file) => {
  try {
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

// 1. Get inventory items
app.get('/inventory', (req, res) => {
  const inventory = readData(INVENTORY_FILE);
  res.json(inventory);
});

// 2. Update inventory item
app.put('/inventory/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updates = req.body;
  const inventory = readData(INVENTORY_FILE);

  const itemIndex = inventory.findIndex(item => item.id === id);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Merge updates
  inventory[itemIndex] = { ...inventory[itemIndex], ...updates };
  writeData(INVENTORY_FILE, inventory);

  res.json(inventory[itemIndex]);
});

// 3. Get low stock items
app.get('/inventory/low-stock', (req, res) => {
  const inventory = readData(INVENTORY_FILE);
  const lowStockItems = inventory.filter(item => item.quantity < 10);
  res.json(lowStockItems);
});

// 4. Place order
app.post('/orders', (req, res) => {
  const orderItems = req.body.items; // Expecting [{ id: 1, quantity: 2 }]

  if (!orderItems || !Array.isArray(orderItems)) {
    return res.status(400).json({ error: 'Invalid order format' });
  }

  const inventory = readData(INVENTORY_FILE);
  let totalAmount = 0;
  const itemsToUpdate = [];

  // Validate stock and calculate total
  for (const orderItem of orderItems) {
    const item = inventory.find(i => i.id === orderItem.id);
    if (!item) {
      return res.status(404).json({ error: `Item with id ${orderItem.id} not found` });
    }
    if (item.quantity < orderItem.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
    }
    totalAmount += item.price * orderItem.quantity;
    itemsToUpdate.push({ index: inventory.indexOf(item), newQuantity: item.quantity - orderItem.quantity });
  }

  // Update inventory
  itemsToUpdate.forEach(update => {
    inventory[update.index].quantity = update.newQuantity;
  });
  writeData(INVENTORY_FILE, inventory);

  // Save order
  const orders = readData(ORDERS_FILE);
  const newOrder = {
    id: orders.length + 1,
    items: orderItems,
    total: totalAmount,
    date: new Date().toISOString()
  };
  orders.push(newOrder);
  writeData(ORDERS_FILE, orders);

  res.status(201).json(newOrder);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
