/**
 * FILE: server/seed.js (V3)
 *
 * PURPOSE: Seeds the database using the corrected data model:
 *   Owner → Shops → Branches → Clerks
 *   Products/sales remain owner-scoped (shared pool per owner).
 *
 * USAGE: node seed.js
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'inventory.db');
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');
db.pragma('journal_mode = WAL');

// ── Run schema migrations ─────────────────────────────────────────────────────
const schemaMigrations = [
  `ALTER TABLE users ADD COLUMN branch_id INTEGER`,
  `ALTER TABLE shop_settings ADD COLUMN allow_admin_visibility INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, name TEXT NOT NULL DEFAULT 'My Shop',
    address TEXT DEFAULT '', currency TEXT NOT NULL DEFAULT 'XAF', low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    tax_percentage REAL NOT NULL DEFAULT 0, allow_admin_visibility INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `ALTER TABLE branches ADD COLUMN shop_id INTEGER`,
  `ALTER TABLE branches ADD COLUMN owner_id INTEGER`,
];
schemaMigrations.forEach(sql => { try { db.prepare(sql).run(); } catch (_) { } });

console.log('🌱 Starting multi-owner seeder (V3)...');

const HASH = bcrypt.hashSync('secureP@ssw0rd!', 10);

const seed = db.transaction(() => {
  // ── 1. CLEAR EXISTING DATA ────────────────────────────────────────────────
  ['activity_log', 'sales', 'products', 'suppliers', 'categories', 'shop_settings', 'branches', 'shops', 'users'].forEach(t => {
    db.prepare(`DELETE FROM ${t}`).run();
    try { db.prepare(`DELETE FROM sqlite_sequence WHERE name='${t}'`).run(); } catch (_) { }
  });

  // ── 2. ADMIN ──────────────────────────────────────────────────────────────
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, owner_id, is_active)
    VALUES (1, 'System Admin', 'admin@system.local', ?, 'admin', 1, 1)`).run(HASH);

  // ── 3. OWNERS ─────────────────────────────────────────────────────────────
  const owners = [
    [2, 'Mama Ndu', 'owner@boutique.cm', 'owner'],
    [3, 'Emmanuel Tchinda', 'emmanuel@matbatiment.cm', 'owner'],
    [4, 'Christelle Kamga', 'christelle@elektro.cm', 'owner'],
    [5, 'Fatima Aboubakar', 'fatima@fashion.cm', 'owner'],
    [6, 'Dr. Paul Atangana', 'paul@pharmacie.cm', 'owner'],
  ];
  owners.forEach(([id, name, email]) => {
    db.prepare(`INSERT INTO users (id, name, email, password_hash, role, owner_id, is_active)
      VALUES (?, ?, ?, ?, 'owner', ?, 1)`).run(id, name, email, HASH, id);
  });

  // ── 4. SHOPS ──────────────────────────────────────────────────────────────
  // Format: [id, owner_id, name, currency, low_stock, allow_admin_visibility]
  const shops = [
    [1, 2, 'Boutique Mama Ndu', 'XAF', 5, 1],
    [2, 3, 'Mat-Batiment Tchinda', 'XAF', 3, 1],
    [3, 3, 'Quincaillerie Tchinda', 'XAF', 5, 1], // owner 3 has 2 shops
    [4, 4, 'Elektro Kamga', 'XAF', 5, 1],
    [5, 5, 'Fatima Fashion House', 'XAF', 8, 0],
    [6, 6, 'Pharmacie Atangana', 'XAF', 10, 1],
  ];
  shops.forEach(([id, owner_id, name, currency, lst, vis]) => {
    db.prepare(`INSERT INTO shops (id, owner_id, name, currency, low_stock_threshold, allow_admin_visibility)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, owner_id, name, currency, lst, vis);
    // Legacy shop_settings for compat (only primary shop per owner)
    try {
      db.prepare(`INSERT OR IGNORE INTO shop_settings (owner_id, shop_name, currency, low_stock_threshold, allow_admin_visibility)
        VALUES (?, ?, ?, ?, ?)`).run(owner_id, name, currency, lst, vis);
    } catch (_) { }
  });

  // ── 5. BRANCHES ───────────────────────────────────────────────────────────
  // Format: [id, shop_id, owner_id, name, address, phone]
  const branches = [
    [1, 1, 2, 'Marche Central', 'Marche Central, Bafoussam', '+237 650 000 001'],
    [2, 1, 2, 'Ngouache Branch', 'Quartier Ngouache', '+237 650 000 002'],
    [3, 2, 3, 'Depot Principal', 'Zone Industrielle, Yaounde', '+237 651 100 001'],
    [4, 2, 3, 'Showroom Douala', 'Akwa, Douala', '+237 651 100 002'],
    [5, 3, 3, 'Quincaillerie Main', 'Bafoussam Centre', '+237 651 100 003'],
    [6, 4, 4, 'Boutique Centrale', 'Rue du Commerce, Bafoussam', '+237 652 200 001'],
    [7, 5, 5, 'Marche des Robes', 'Marche des Fleurs, Douala', '+237 653 300 001'],
    [8, 5, 5, 'Maroua Outlet', 'Centre Maroua', '+237 653 300 002'],
    [9, 6, 6, 'Pharmacie Centrale', 'Mvog-Mbi, Yaounde', '+237 654 400 001'],
    [10, 6, 6, 'Annexe Bastos', 'Bastos, Yaounde', '+237 654 400 002'],
    [11, 6, 6, 'Depot Melen', 'Melen, Yaounde', '+237 654 400 003'],
  ];
  branches.forEach(([id, shop_id, owner_id, name, address, phone]) => {
    db.prepare(`INSERT INTO branches (id, shop_id, owner_id, name, address, phone)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, shop_id, owner_id, name, address, phone);
  });

  // ── 6. CLERKS ─────────────────────────────────────────────────────────────
  // Format: [id, name, email, owner_id, branch_id]
  const clerks = [
    [7, 'Agnes Fomeke', 'agnes@boutique.cm', 2, 1],
    [8, 'Joseph Ngum', 'joseph@boutique.cm', 2, 2],
    [9, 'Roger Meli', 'roger@matbatiment.cm', 3, 3],
    [10, 'Solange Mbarga', 'solange@matbatiment.cm', 3, 4],
    [11, 'Patrick Fouda', 'patrick@elektro.cm', 4, 6],
    [12, 'Halima Oumarou', 'halima@fashion.cm', 5, 7],
    [13, 'Ibrahim Garba', 'ibrahim@fashion.cm', 5, 8],
    [14, 'Dr. Marie Essomba', 'marie@pharmacie.cm', 6, 9],
    [15, 'Thierry Nkodo', 'thierry@pharmacie.cm', 6, 10],
    [16, 'Cecile Ombolo', 'cecile@pharmacie.cm', 6, 11],
  ];
  clerks.forEach(([id, name, email, owner_id, branch_id]) => {
    db.prepare(`INSERT INTO users (id, name, email, password_hash, role, owner_id, branch_id, is_active)
      VALUES (?, ?, ?, ?, 'clerk', ?, ?, 1)`).run(id, name, email, HASH, owner_id, branch_id);
  });

  // ── 7. CATEGORIES ─────────────────────────────────────────────────────────
  const cats = [
    [1, 2, 'Boissons'], [2, 2, 'Alimentaire'], [3, 2, 'Hygiene'], [4, 2, 'Snacks'],
    [5, 3, 'Ciment & Beton'], [6, 3, 'Fer & Metaux'], [7, 3, 'Peinture'], [8, 3, 'Carrelage'],
    [9, 4, 'Telephones'], [10, 4, 'Accessoires'], [11, 4, 'Audio/Video'], [12, 4, 'Electromenager'],
    [13, 5, 'Robes'], [14, 5, 'Tissus'], [15, 5, 'Accessoires Mode'],
    [16, 6, 'Medicaments'], [17, 6, 'Soins'], [18, 6, 'Vitamines'],
  ];
  cats.forEach(([id, o, n]) => db.prepare('INSERT INTO categories (id, owner_id, name) VALUES (?, ?, ?)').run(id, o, n));

  // ── 8. SUPPLIERS ──────────────────────────────────────────────────────────
  const sups = [
    [1, 2, 'Brasseries du Cameroun', 'brasco@cm.net'],
    [2, 2, 'Nestle Cameroun', 'nestle@cm.net'],
    [3, 3, 'CIMENCAM', 'cimencam@cm.net'],
    [4, 3, 'Alucam', 'alucam@cm.net'],
    [5, 4, 'Samsung Africa', 'samsung@africa.net'],
    [6, 4, 'Transsion Holdings', 'transsion@africa.net'],
    [7, 5, 'CICAM Tissu', 'cicam@cm.net'],
    [8, 6, 'LABOREX Cameroun', 'laborex@cm.net'],
  ];
  sups.forEach(([id, o, n, c]) => db.prepare('INSERT INTO suppliers (id, owner_id, name, contact_info) VALUES (?, ?, ?, ?)').run(id, o, n, c));

  // ── 9. PRODUCTS ───────────────────────────────────────────────────────────
  const insP = db.prepare(`INSERT INTO products (id, owner_id, category_id, supplier_id, name, quantity, cost_price, selling_price, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now',? || ' days'))`);
  const prods = [
    // Owner 2 – Provisions
    [1, 2, 1, 1, 'Beaufort Lager (65cl)', 48, 700, 954, '-20'],
    [2, 2, 1, 1, 'Top Pamplemousse (1.5L)', 4, 500, 667, '-15'],
    [3, 2, 2, 2, 'Nido Powdered Milk (400g)', 22, 3000, 3816, '-10'],
    [4, 2, 2, 2, 'Maggi Cubes (Box 100)', 60, 1200, 1788, '-5'],
    [5, 2, 3, null, 'Savon Mayor (400g)', 35, 350, 486, '-30'],
    [6, 2, 4, null, 'Biscuits Vitalo (250g)', 2, 300, 407, '-8'],
    [7, 2, 1, 1, 'Coca-Cola (1.5L)', 30, 600, 800, '-3'],
    [8, 2, 2, 2, 'Milo Tin (400g)', 15, 2200, 2900, '-12'],
    [9, 2, 3, null, 'Lessive OMO (1kg)', 20, 900, 1200, '-25'],
    [10, 2, 2, null, "Riz Uncle Ben's (5kg)", 10, 4500, 5800, '-7'],
    // Owner 3 – Building Materials
    [11, 3, 5, 3, 'Ciment CPA 42.5 (50kg)', 200, 4500, 6500, '-45'],
    [12, 3, 5, 3, 'Sable (m3)', 80, 8000, 12000, '-30'],
    [13, 3, 6, 4, 'Fer a beton 10mm (12m)', 1, 15000, 22000, '-20'],
    [14, 3, 6, 4, 'Tole Galvanisee 3m', 30, 9000, 14500, '-15'],
    [15, 3, 7, null, 'Peinture Dulux 4L (Blanc)', 25, 12000, 17000, '-10'],
    [16, 3, 8, null, 'Carrelage 60x60 (m2)', 2, 8500, 13000, '-5'],
    [17, 3, 8, null, 'Colle a carrelage (25kg)', 40, 3500, 5500, '-25'],
    // Owner 4 – Electronics
    [18, 4, 9, 5, 'Samsung Galaxy A15 (128GB)', 12, 65000, 89000, '-30'],
    [19, 4, 9, 6, 'Itel P40 (64GB)', 20, 35000, 48000, '-20'],
    [20, 4, 9, 6, 'Tecno Spark Go 2024', 15, 28000, 38000, '-15'],
    [21, 4, 10, null, 'Cable USB-C (2m)', 2, 800, 1500, '-10'],
    [22, 4, 10, null, 'Coque Samsung A15', 50, 1500, 3000, '-5'],
    [23, 4, 11, null, 'Enceinte Bluetooth', 8, 12000, 19000, '-25'],
    // Owner 5 – Fashion
    [24, 5, 13, 7, 'Robe Bazin Brodee (L)', 10, 15000, 25000, '-20'],
    [25, 5, 14, 7, 'Tissu Ankara (6 yards)', 3, 4500, 8000, '-15'],
    [26, 5, 13, null, 'Robe de Soiree (M)', 8, 22000, 38000, '-10'],
    [27, 5, 15, null, 'Sac a main cuir', 15, 8000, 15000, '-30'],
    // Owner 6 – Pharmacy
    [28, 6, 16, 8, 'Paracetamol 500mg', 100, 250, 500, '-15'],
    [29, 6, 16, 8, 'Amoxicilline 500mg', 50, 1500, 2800, '-10'],
    [30, 6, 17, 8, 'Solution antiseptique 500ml', 30, 1200, 2000, '-20'],
    [31, 6, 17, null, 'Gel hydroalcoolique 250ml', 8, 800, 1500, '-5'],
    [32, 6, 18, null, 'Vitamine C 1000mg (60cp)', 40, 2000, 3500, '-12'],
    [33, 6, 16, 8, 'Metronidazole 250mg', 60, 600, 1100, '-25'],
  ];
  prods.forEach(args => insP.run(...args));

  // ── 10. SALES ─────────────────────────────────────────────────────────────
  const insS = db.prepare(`INSERT INTO sales
    (owner_id, product_id, clerk_id, quantity_sold, cost_price_at_sale, selling_price_at_sale,
     discount, tax_rate, total_revenue, total_profit, sale_date)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, datetime('now', ? || ' days'))`);
  const sale = (o, p, c, q, cost, sell, d) =>
    insS.run(o, p, c, q, cost, sell, q * sell, q * (sell - cost), `-${d}`);

  // Owner 2 sales
  [[2, 1, 7, 4, 700, 954, 1], [2, 3, 7, 2, 3000, 3816, 2], [2, 4, 8, 5, 1200, 1788, 3], [2, 5, 7, 3, 350, 486, 4],
  [2, 7, 8, 6, 600, 800, 5], [2, 8, 7, 1, 2200, 2900, 6], [2, 2, 8, 3, 500, 667, 7], [2, 9, 7, 2, 900, 1200, 8],
  [2, 1, 8, 5, 700, 954, 10], [2, 3, 7, 3, 3000, 3816, 12], [2, 4, 7, 8, 1200, 1788, 15], [2, 7, 8, 4, 600, 800, 18],
  ].forEach(([o, p, c, q, cost, s, d]) => sale(o, p, c, q, cost, s, d));

  // Owner 3 sales
  [[3, 11, 9, 5, 4500, 6500, 2], [3, 12, 9, 2, 8000, 12000, 4], [3, 13, 10, 1, 15000, 22000, 6],
  [3, 14, 10, 3, 9000, 14500, 8], [3, 15, 9, 2, 12000, 17000, 10], [3, 17, 10, 6, 3500, 5500, 12],
  [3, 11, 10, 8, 4500, 6500, 18], [3, 14, 9, 1, 9000, 14500, 22],
  ].forEach(([o, p, c, q, cost, s, d]) => sale(o, p, c, q, cost, s, d));

  // Owner 4 sales
  [[4, 18, 11, 1, 65000, 89000, 3], [4, 19, 11, 2, 35000, 48000, 5], [4, 20, 11, 1, 28000, 38000, 8],
  [4, 22, 11, 8, 1500, 3000, 10], [4, 23, 11, 1, 12000, 19000, 14], [4, 19, 11, 1, 35000, 48000, 20],
  ].forEach(([o, p, c, q, cost, s, d]) => sale(o, p, c, q, cost, s, d));

  // Owner 5 sales
  [[5, 24, 12, 2, 15000, 25000, 4], [5, 25, 13, 2, 4500, 8000, 6], [5, 26, 12, 1, 22000, 38000, 8],
  [5, 27, 13, 3, 8000, 15000, 12],
  ].forEach(([o, p, c, q, cost, s, d]) => sale(o, p, c, q, cost, s, d));

  // Owner 6 sales
  [[6, 28, 14, 15, 250, 500, 1], [6, 29, 14, 3, 1500, 2800, 2], [6, 30, 15, 3, 1200, 2000, 3],
  [6, 32, 15, 6, 2000, 3500, 5], [6, 33, 16, 10, 600, 1100, 7], [6, 28, 15, 20, 250, 500, 10],
  [6, 29, 16, 2, 1500, 2800, 12], [6, 30, 14, 4, 1200, 2000, 15],
  ].forEach(([o, p, c, q, cost, s, d]) => sale(o, p, c, q, cost, s, d));

  console.log('');
  console.log('✅ Seeding complete!');
  console.log('');
  console.log('Hierarchy:');
  console.log('  Owner -> Shops -> Branches -> Clerks');
  console.log('  - Mama Ndu (owner@boutique.cm): 1 shop, 2 branches, 2 clerks');
  console.log('  - Emmanuel Tchinda (emmanuel@matbatiment.cm): 2 shops, 3 branches, 2 clerks');
  console.log('  - Christelle Kamga (christelle@elektro.cm): 1 shop, 1 branch, 1 clerk');
  console.log('  - Fatima Aboubakar (fatima@fashion.cm): 1 shop, 2 branches, 2 clerks');
  console.log('  - Dr. Paul Atangana (paul@pharmacie.cm): 1 shop, 3 branches, 3 clerks');
  console.log('');
  console.log('All passwords: secureP@ssw0rd!');
});

seed();
db.close();
