# Community Micro-Inventory System — V3

A production-structured, full-stack inventory management platform for small shop owners in emerging markets. V3 extends V2 with a full multi-owner, multi-shop, multi-branch architecture, complete admin CRUD over owner accounts, and a shops/branches management layer.

> **V1** (simple single-owner CRUD) is preserved as git tag `v1.0.0`.  
> **V2** (role-based access, analytics, Electron) lives on the `v2` branch.  
> **V3** (this) — multi-shop/branch architecture + full admin owner management.

---

## Problem Statement

Small retail businesses in sub-Saharan Africa and similar markets manage stock manually — paper notebooks, mental tracking, or nothing at all. The consequences are overstocking, stockouts, and profit blindness. This system replaces those notebooks with a structured digital tool that works on a laptop, a phone browser, or as an installed desktop application.

---

## What's New in V3

| Feature | V2 | V3 |
|---------|----|----|
| Multi-shop per owner | ❌ | ✅ owners can have multiple shops |
| Multi-branch per shop | ❌ | ✅ branches linked to shops |
| Admin creates owners inline | ❌ | ✅ shops + branches in one form |
| Admin edits/deletes owners | ❌ | ✅ full owner CRUD |
| Clerk → branch assignment | optional | ✅ required + validated |
| Admin filter inventory/sales by owner | ❌ | ✅ |
| Shops manager (UI) | ❌ | ✅ |
| Branches manager (UI) | ❌ | ✅ |
| Danger Zone: clear all data | ❌ | ✅ admin-only |
| Seed data | basic | ✅ 4 owners, 5 shops, 10 branches, 9 clerks |

## What's in V2 (still present)

| Feature | V1 | V2 |
|---------|----|-----|
| User roles | ❌ single owner | ✅ Admin / Owner / Clerk |
| Activity audit log | ❌ | ✅ all create/update/delete events |
| Product categories | ❌ | ✅ owner-scoped |
| Suppliers | ❌ | ✅ full CRUD |
| Batch / serial / expiry | ❌ | ✅ |
| Discount + tax on sales | ❌ | ✅ |
| Analytics charts (Chart.js) | ❌ | ✅ revenue, top products, categories |
| Stock depletion prediction | ❌ | ✅ velocity-based forecast |
| CSV export | ❌ | ✅ sales + products |
| Duplicate detection | ❌ | ✅ 3-tier name similarity check |
| Desktop installer (.exe) | ❌ | ✅ Electron + NSIS |
| Docker | ❌ | ✅ multi-stage Dockerfile |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| API server | Express 4 |
| Database | SQLite (better-sqlite3 v11) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Frontend | HTML5, Vanilla JS, CSS3 |
| Charts | Chart.js 4 (CDN) |
| Desktop | Electron 29 |
| Installer | electron-builder (NSIS) |
| Container | Docker + docker-compose |

---

## Architecture

```
micro-inventory/
│
├── server/                     # Express REST API
│   ├── app.js                  # Entry point
│   ├── config/db.js            # SQLite + self-bootstrapping schema (incl. shops, branches)
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── role.js             # RBAC factory (requireRole)
│   │   └── errorHandler.js     # Centralised JSON error envelope
│   ├── models/                 # SQL-only, no logic
│   │   ├── user.js             # Users with role + owner_id + branch_id
│   │   ├── shop.js             # NEW: Shops with currency, tax %, admin visibility
│   │   ├── branch.js           # Updated: branches reference shop_id
│   │   ├── product.js          # Products with LEFT JOINs
│   │   ├── sale.js             # Sales with discount/tax/clerk
│   │   ├── category.js
│   │   ├── supplier.js
│   │   └── activityLog.js      # Append-only audit trail
│   ├── controllers/            # Business logic + validation
│   │   ├── authController.js
│   │   ├── userController.js   # V3: createOwner (shops+branches), createClerk (branch required),
│   │   │                       #     updateUser, resetPassword, deactivate, reactivate,
│   │   │                       #     deleteOwner, clearAllData
│   │   ├── shopController.js   # NEW: CRUD for shops + branch listing per shop
│   │   ├── productController.js # Admin ?owner_id filter
│   │   ├── salesController.js   # Admin ?owner_id filter; atomic transaction + activity log
│   │   └── analyticsController.js # KPIs, charts, CSV export
│   ├── routes/
│   │   └── auth/users/shops/products/sales/analytics/branches.js
│   ├── seed.js                 # V3 seed: 4 owners, 5 shops, 10 branches, 9 clerks
│   └── utils/
│       ├── calculations.js     # discount + tax profit formula
│       ├── duplicateChecker.js # 3-tier LIKE similarity search
│       ├── stockPredictor.js   # SQL CTE velocity → days remaining
│       └── exportHelper.js     # Pure CSV builder (RFC 4180)
│
├── client/                     # Vanilla JS SPA (no build step)
│   ├── index.html              # Login / Register
│   ├── dashboard.html          # Full app shell (incl. shops/branches modals)
│   ├── js/
│   │   ├── api.js             # Fetch wrapper (JWT, 401 redirect, blob download)
│   │   ├── auth.js            # Auth page logic
│   │   ├── users.js           # V3: full owner CRUD, cascading clerk form, shops/branches manager
│   │   ├── products.js        # Admin owner-filter dropdown
│   │   ├── sales.js           # Admin owner-filter dropdown
│   │   ├── analytics.js       # 3 Chart.js charts + predictions + activity
│   │   └── settings.js        # Hides Shop Config for admin (managed via owner creation)
│   └── css/styles.css         # Complete dark design system
│
├── electron/
│   ├── main.js                # Forks Express, polls /health, opens window
│   └── preload.js             # Context bridge
│
├── Dockerfile                 # Multi-stage, non-root production image
├── docker-compose.yml         # Volume-mounted SQLite + env forwarding
└── package.json               # electron-builder NSIS configuration (v3.0.0)
```

### Separation of Concerns

- **Routes**: declare paths + middleware chain only.
- **Controllers**: own the request/response cycle — validate input, call models, build response.
- **Models**: SQL only. No Express, no validation.
- **Middleware**: cross-cutting concerns — auth, RBAC, error handling.
- **Utils**: stateless pure functions — calculations, CSV, prediction, duplicate check.

---

## Database Schema

```sql
users         (id, name, email, password_hash, role, owner_id, branch_id, is_active, created_at)
shops         (id, owner_id, name, address, currency, low_stock_threshold, tax_percentage,
               allow_admin_visibility, created_at)                        -- NEW in V3
branches      (id, shop_id, owner_id, name, address, phone, created_at)  -- shop_id added in V3
categories    (id, owner_id, name, created_at)
suppliers     (id, owner_id, name, contact_info, email, created_at)
products      (id, owner_id, category_id, supplier_id, name, description,
               batch_number, serial_number, expiry_date,
               quantity, cost_price, selling_price, created_at, updated_at)
sales         (id, owner_id, product_id, clerk_id,
               quantity_sold, selling_price_at_sale, cost_price_at_sale,
               discount, tax_rate, total_revenue, total_profit, sale_date)
activity_log  (id, user_id, user_name, action, entity_type, entity_id, detail, created_at)
shop_settings (id, owner_id, shop_name, currency, low_stock_threshold)   -- legacy compat
```

**Key design decisions:**
- `selling_price_at_sale` and `cost_price_at_sale` are snapshots — profit history stays accurate after price changes.
- `total_profit` and `total_revenue` are persisted to keep dashboard aggregations fast.
- `is_active` on users enables soft-deactivation without data loss.
- WAL mode + `PRAGMA foreign_keys = ON` enabled at every connection.
- `shops.allow_admin_visibility` lets owners control whether the admin can see their data.
- Existing V2 databases auto-migrate on first boot (safe ALTER TABLE guards).

---

## Financial Calculation

```
grossRevenue = sellingPrice × quantity
taxAmount    = grossRevenue × taxRate
totalRevenue = grossRevenue + taxAmount − discount
totalProfit  = totalRevenue − (costPrice × quantity)
```

---

## API Reference

All responses use `{ "success": true/false, "data": ..., "message": "..." }`.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Create owner account |
| POST | /api/auth/login | No | Login → JWT |
| GET | /api/auth/profile | Yes | Current user |

### Users (admin/owner)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/users | owner+ | List users (admin sees all; owner sees own clerks) |
| POST | /api/users/owner | **admin** | Create owner (with inline shops + branches) |
| PUT | /api/users/:id | admin/owner | Update name, email, branch_id |
| PUT | /api/users/:id/role | **admin** | Change role |
| POST | /api/users/:id/reset-password | admin/owner | Reset password → returns new credentials |
| PUT | /api/users/:id/reactivate | admin/owner | Reactivate a deactivated user |
| DELETE | /api/users/:id | admin/owner | Deactivate user (soft delete) |
| DELETE | /api/users/owner/:id | **admin** | Permanently delete owner + all their data |
| POST | /api/users/clerk | owner+ | Create clerk (branch_id required) |
| DELETE | /api/users/clear-data | **admin** | Wipe all business data (confirm required) |

### Shops (NEW in V3)
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/shops | owner+ | List shops (admin sees all) |
| POST | /api/shops | owner+ | Create shop |
| PUT | /api/shops/:id | owner+ | Update shop |
| DELETE | /api/shops/:id | owner+ | Delete shop |
| GET | /api/shops/:id/branches | owner+ | List branches for a shop |

### Branches
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/branches | owner+ | List branches |
| POST | /api/branches | owner+ | Create branch (shop_id required) |
| PUT | /api/branches/:id | owner+ | Update branch |
| DELETE | /api/branches/:id | owner+ | Delete branch |

### Products
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/products | all | List with filters; admin supports `?owner_id=` |
| GET | /api/products/search?q= | all | Keyword search |
| POST | /api/products | owner+ | Create (409 on duplicate) |
| PUT | /api/products/:id | owner+ | Update |
| DELETE | /api/products/:id | owner+ | Delete |
| GET/POST/DELETE | /api/products/categories | owner+ | Category CRUD |
| GET/POST/PUT/DELETE | /api/products/suppliers | owner+ | Supplier CRUD |

### Sales
| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | /api/sales | all | History; admin supports `?owner_id=` |
| POST | /api/sales | all | Record (atomic stock deduction) |

### Analytics (owner/admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/metrics | KPI dashboard |
| GET | /api/analytics/revenue?days=30 | Daily revenue/profit |
| GET | /api/analytics/top-products?limit=10&days=30 | Top sellers |
| GET | /api/analytics/categories | Revenue by category |
| GET | /api/analytics/stock-predictions | Depletion forecast |
| GET | /api/analytics/activity | Audit log |
| GET | /api/analytics/export/sales | CSV download |
| GET | /api/analytics/export/products | CSV download |

---

## Setup & Development

### Prerequisites
- Node.js ≥ 18 (tested on v20 and v24)
- npm ≥ 9

### Local setup
```bash
git clone https://github.com/Shoh96/Micro-Inventory-System.git
cd Micro-Inventory-System

cd server
npm install

cp .env.example .env
# Edit .env — set a strong JWT_SECRET

node app.js
# API + frontend at http://localhost:3000

# Optional: seed demo data (4 owners, 5 shops, 10 branches, 9 clerks)
node seed.js
```

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | HTTP port |
| `JWT_SECRET` | **Yes** | — | 32+ char random string |
| `JWT_EXPIRES_IN` | No | 7d | Token expiry |
| `DB_PATH` | No | `./data/inventory.db` | SQLite file path |
| `CLIENT_ORIGIN` | No | `*` | CORS origin |
| `LOW_STOCK_THRESHOLD` | No | 5 | Alert threshold (units) |

---

## Deployment

### Render (recommended)
1. Create **Web Service**, connect repo, set **Root Directory** to `server`.
2. **Start Command**: `node app.js`
3. Set env vars: `JWT_SECRET`, `NODE_ENV=production`
4. Mount a **Persistent Disk** at `/var/data` and set `DB_PATH=/var/data/inventory.db`.

### Docker
```bash
# Build and run
docker-compose up --build -d

# View logs
docker-compose logs -f
```

### Desktop Installer (Windows .exe)
```bash
# From the project root
npm install          # installs electron + electron-builder

# First: add an icon at electron/assets/icon.ico (256×256 ICO)

npm run electron:build
# Produces dist/Micro-Inventory-System Setup 3.0.0.exe
```
The NSIS installer bundles the Electron runtime, the Express server, and the client. Users install it like any Windows application. The SQLite database is stored in `%APPDATA%\Micro-Inventory System\`.

---

## Role Permissions

| Action | Admin | Owner | Clerk |
|--------|-------|-------|-------|
| Create owner accounts | ✅ | ❌ | ❌ |
| Edit / delete owner accounts | ✅ | ❌ | ❌ |
| Register (self) | ✅ | ✅ | ❌ |
| Create clerks | ✅ | ✅ | ❌ |
| Change roles | ✅ | ❌ | ❌ |
| Reset passwords | ✅ | ✅ (own clerks) | ❌ |
| Manage shops | ✅ | ✅ (own) | ❌ |
| Manage branches | ✅ | ✅ (own) | ❌ |
| View products | ✅ | ✅ | ✅ |
| Create/edit/delete products | ✅ | ✅ | ❌ |
| Record sales | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ❌ |
| Export CSV | ✅ | ✅ | ❌ |
| View any owner's data | ✅ | ❌ | ❌ |
| Clear all system data | ✅ | ❌ | ❌ |

---

## Smart Features

### Duplicate Detection
Before creating a product, the API runs a 3-tier LIKE search:
1. Exact case-insensitive match
2. Starts-with match
3. Contains match

Returns `409` with the candidate list. Client shows a warning; `?force=true` bypasses the check.

### Stock Depletion Prediction
Uses a SQL CTE to calculate average daily sales velocity over the last 30 days, then divides current quantity by that velocity to estimate days until stockout. Products with `days_remaining < 7` are flagged for restock.

---

## Seed Data (V3)

Run `node seed.js` from the `server/` directory to populate demo data:

| Owner | Email | Shops | Branches | Clerks |
|-------|-------|-------|----------|--------|
| Mama Ndu | owner@boutique.cm | 1 | 2 | 2 |
| Emmanuel Tchinda | emmanuel@matbatiment.cm | 2 | 3 | 2 |
| Fatima Aboubakar | fatima@fashion.cm | 1 | 2 | 2 |
| Sylvie Pharmacie | sylvie@pharmacie.cm | 1 | 3 | 3 |

Default password for all seed accounts: `secureP@ssw0rd!`  
Admin: `admin@system.local` / `secureP@ssw0rd!`

---

## Future Improvements

- PostgreSQL support for high-concurrency deployments
- Offline PWA with IndexedDB + background sync
- SMS/email low-stock notifications (Africa's Talking API)
- Barcode scanning via browser camera
- Multi-currency with live exchange rates
- Automated test suite (Vitest + Supertest)
- Role-specific PIN login (for shared devices)

---

## Resume Summary

Community Micro-Inventory System V3 is a full-stack web + desktop application built with Node.js, Express, SQLite, Vanilla JavaScript, and Electron. It demonstrates role-based access control with JWT, a multi-owner / multi-shop / multi-branch relational schema with full foreign key integrity, atomic database transactions for sale recording, SQL CTEs for stock velocity prediction, Chart.js analytics visualisations, RFC 4180 CSV export, and an Electron NSIS desktop installer. The admin role has full CRUD over owner accounts including cascading deletion of all associated data. The codebase follows a strict separation of concerns: routes, controllers, models, middleware, and pure utility functions.

---

## License
MIT
