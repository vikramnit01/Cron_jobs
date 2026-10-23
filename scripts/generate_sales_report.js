#!/usr/bin/env node
// Generates a sales report and writes it to data/reports/.
// Sales data is simulated, because this project has no sales database.
const fs = require('node:fs');
const path = require('node:path');

const REPORTS_DIR = path.join(__dirname, '..', 'data', 'reports');
const PRODUCTS = [
  { name: 'Laptop', price: 1200 },
  { name: 'Monitor', price: 300 },
  { name: 'Keyboard', price: 80 },
  { name: 'Mouse', price: 40 },
];
const REGIONS = ['North', 'South', 'East', 'West'];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function simulateOrders(count) {
  return Array.from({ length: count }, (_, i) => {
    const product = pick(PRODUCTS);
    const quantity = 1 + Math.floor(Math.random() * 5);
    return { orderId: i + 1, product: product.name, region: pick(REGIONS), quantity, amount: quantity * product.price };
  });
}

function sumBy(orders, key) {
  const totals = {};
  for (const o of orders) {
    totals[o[key]] ??= { orders: 0, units: 0, revenue: 0 };
    totals[o[key]].orders += 1;
    totals[o[key]].units += o.quantity;
    totals[o[key]].revenue += o.amount;
  }
  return totals;
}

function main() {
  const generatedAt = new Date();
  const orders = simulateOrders(50 + Math.floor(Math.random() * 50));

  const report = {
    generated_at: generatedAt.toISOString(),
    total_orders: orders.length,
    total_units: orders.reduce((s, o) => s + o.quantity, 0),
    total_revenue: orders.reduce((s, o) => s + o.amount, 0),
    by_product: sumBy(orders, 'product'),
    by_region: sumBy(orders, 'region'),
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = generatedAt.toISOString().replace(/[:.]/g, '-');
  const file = path.join(REPORTS_DIR, `sales-report-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');

  console.log(`report written: ${file} (orders=${report.total_orders}, revenue=${report.total_revenue})`);
}

try {
  main();
} catch (err) {
  console.error(`report failed: ${err.message}`);
  process.exit(1);
}
