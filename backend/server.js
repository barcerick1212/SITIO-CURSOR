import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const ensureDb = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ products: [], sales: [], payout: null, users: [], config: {} }, null, 2));
  }
};
const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

ensureDb();
// Seed admin user
(() => {
  const db = readDb();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@admin.com').toLowerCase();
  const adminPass = process.env.ADMIN_PASS || 'admin12';
  const exists = db.users.find(u => (u.email || '').toLowerCase() === adminEmail);
  if (!exists) {
    db.users.push({ id: nanoid(), email: adminEmail, name: 'Administrador', role: 'admin', pass: adminPass, createdAt: Date.now() });
  } else {
    exists.pass = adminPass; // force reset admin pass
    exists.role = 'admin';
  }
  const DEFAULT_LOGO_URL = 'https://barpanch.com/wp-content/uploads/2025/09/6e50e389-b09d-4263-b313-dfea69e4c087.png';
  db.config = db.config || {};
  if (!db.config.logoUrl) db.config.logoUrl = DEFAULT_LOGO_URL;
  writeDb(db);
})();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/api/health', (_, res) => res.json({ ok: true }));

// Products
app.get('/api/products', (req, res) => {
  const db = readDb();
  res.json(db.products);
});
app.post('/api/products', (req, res) => {
  const { name, price, descShort, descLong, tags, categories, img } = req.body;
  if (!name || typeof price !== 'number') return res.status(400).json({ error: 'name and price required' });
  const db = readDb();
  const product = { id: nanoid(), name, price, descShort: descShort || '', descLong: descLong || '', tags: tags || [], categories: categories || [], img: img || '' };
  db.products.push(product);
  writeDb(db);
  res.status(201).json(product);
});
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const idx = db.products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.products[idx] = { ...db.products[idx], ...req.body };
  writeDb(db);
  res.json(db.products[idx]);
});
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const before = db.products.length;
  db.products = db.products.filter(p => p.id !== id);
  writeDb(db);
  res.json({ removed: before !== db.products.length });
});

// Sales
app.get('/api/sales', (req, res) => {
  const db = readDb();
  res.json(db.sales);
});
app.post('/api/sales', (req, res) => {
  const { productId, productName, total } = req.body;
  if (!productId || typeof total !== 'number') return res.status(400).json({ error: 'productId and total required' });
  const db = readDb();
  const sale = { id: nanoid(), productId, productName: productName || '', total, ts: Date.now() };
  db.sales.push(sale);
  writeDb(db);
  res.status(201).json(sale);
});

// Payout
app.get('/api/payout', (req, res) => {
  const db = readDb();
  res.json(db.payout || null);
});
app.post('/api/payout', (req, res) => {
  const { method, email, account } = req.body;
  if (!method) return res.status(400).json({ error: 'method required' });
  const db = readDb();
  db.payout = { method, email: email || null, account: account || null };
  writeDb(db);
  res.json(db.payout);
});

// Payments scaffolding
const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
async function getPayPalAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Missing PayPal credentials');
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!r.ok) throw new Error('paypal_oauth_failed');
  const data = await r.json();
  return data.access_token;
}
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { amount, currency = 'USD', description } = req.body;
    if (typeof amount !== 'number') return res.status(400).json({ error: 'amount required' });
    const token = await getPayPalAccessToken();
    const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: currency, value: amount.toFixed(2) }, description }] })
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    const token = await getPayPalAccessToken();
    const r = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});
app.post('/api/cards/charge', (req, res) => {
  const { amount, cardToken } = req.body;
  if (typeof amount !== 'number' || !cardToken) return res.status(400).json({ error: 'amount and cardToken required' });
  res.json({ id: nanoid(), status: 'APPROVED' });
});

// Users & roles
app.get('/api/users', (req, res) => {
  const db = readDb();
  res.json(db.users.map(u => ({ ...u, pass: undefined })));
});
app.post('/api/users/role', (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: 'email and role required' });
  const db = readDb();
  let user = db.users.find(u => u.email === email);
  if (!user) {
    user = { id: nanoid(), email, name: email.split('@')[0], role, createdAt: Date.now() };
    db.users.push(user);
  } else {
    user.role = role;
  }
  writeDb(db);
  res.json({ ...user, pass: undefined });
});

// Admin: purge all users except admin
app.delete('/api/users', (req, res) => {
  const db = readDb();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@admin.com').toLowerCase();
  db.users = (db.users || []).filter(u => (u.email || '').toLowerCase() === adminEmail);
  writeDb(db);
  res.json({ remaining: db.users.length });
});

// Users auth (demo only - plaintext)
app.post('/api/users/register', (req, res) => {
  const { name, email, pass } = req.body;
  if (!name || !email || !pass) return res.status(400).json({ error: 'name, email, pass required' });
  const db = readDb();
  const exists = db.users.find(u => u.email === email);
  if (exists) return res.status(409).json({ error: 'user_exists' });
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
  const role = email === adminEmail ? 'admin' : 'cliente';
  const user = { id: nanoid(), name, email, pass, role, photo: '', createdAt: Date.now() };
  db.users.push(user);
  writeDb(db);
  const { pass: _omit, ...safe } = user;
  res.status(201).json(safe);
});
app.post('/api/users/login', (req, res) => {
  const { email, pass } = req.body;
  if (!email || !pass) return res.status(400).json({ error: 'email and pass required' });
  const db = readDb();
  const user = db.users.find(u => (u.email || '').toLowerCase() === String(email).toLowerCase() && u.pass === pass);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const { pass: _omit, ...safe } = user;
  res.json(safe);
});

// Config (e.g., FiveM server connect info)
app.get('/api/config', (req, res) => {
  const db = readDb();
  res.json(db.config || {});
});
app.post('/api/config', (req, res) => {
  const { fivemHost, fivemPort, fivemPassword, paypalClientId, currency, logoUrl } = req.body;
  const db = readDb();
  db.config = { ...(db.config || {}), fivemHost: fivemHost || '', fivemPort: fivemPort || '', fivemPassword: fivemPassword || '', paypalClientId: paypalClientId || db.config?.paypalClientId || '', currency: currency || db.config?.currency || 'USD', logoUrl: logoUrl || db.config?.logoUrl || '' };
  writeDb(db);
  res.json(db.config);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});


