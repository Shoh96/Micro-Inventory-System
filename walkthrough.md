# Community Micro-Inventory System — Build Walkthrough

## What Was Built

A complete, production-structured inventory management web application with:

- **Express REST API** (Node.js + SQLite via better-sqlite3)
- **JWT Authentication** (bcrypt password hashing, user-enumeration protection)
- **Vanilla JS frontend** (no framework, no build step)
- **Professional README** ready to paste into GitHub

---

## Files Created

### Backend (`server/`)

| File | Purpose |
|------|---------|
| [app.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/app.js) | Entry point — CORS, body parsing, static serve, route mounting |
| [config/db.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/config/db.js) | SQLite connection with WAL mode, foreign keys, self-bootstrapping schema |
| [middleware/auth.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/middleware/auth.js) | JWT Bearer token verification; attaches `req.user` |
| [middleware/errorHandler.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/middleware/errorHandler.js) | Centralised JSON error envelope (hides stack in production) |
| [utils/calculations.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/utils/calculations.js) | Pure financial helpers: unit profit, batch profit, stock value |
| [models/userModel.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/models/userModel.js) | createUser, findUserByEmail, findUserById |
| [models/productModel.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/models/productModel.js) | Full CRUD + deductStock + LOW_STOCK_THRESHOLD |
| [models/saleModel.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/models/saleModel.js) | createSale (with price snapshots), getSalesByOwner (LEFT JOIN) |
| [models/dashboardModel.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/models/dashboardModel.js) | Three SQL aggregations merged into one metrics object |
| [controllers/authController.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/controllers/authController.js) | Register (hashing, JWT) + Login (constant-time compare) |
| [controllers/productController.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/controllers/productController.js) | CRUD + getLowStock, with input validation and owner scoping |
| [controllers/saleController.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/controllers/saleController.js) | Atomic transaction: INSERT sale + UPDATE stock in one tx |
| [controllers/dashboardController.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/controllers/dashboardController.js) | Merges KPIs + low-stock items list |
| [routes/authRoutes.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/routes/authRoutes.js) | POST /register, POST /login |
| [routes/productRoutes.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/routes/productRoutes.js) | All product routes (low-stock before /:id) |
| [routes/saleRoutes.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/routes/saleRoutes.js) | GET + POST /sales |
| [routes/dashboardRoutes.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/routes/dashboardRoutes.js) | GET /metrics |
| [package.json](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/package.json) | Dependencies with better-sqlite3 v11 (Node 24 compatible) |
| [.env.example](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/.env.example) | Environment variable template |
| [.env](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/server/.env) | Dev environment (gitignored) |

### Frontend (`client/`)

| File | Purpose |
|------|---------|
| [index.html](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/client/index.html) | Login/Register page with accessible tab switcher and ARIA roles |
| [dashboard.html](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/client/dashboard.html) | KPI cards, inventory table, quick-sale bar, sales history, add/edit modal |
| [css/style.css](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/client/css/style.css) | Full design system: dark navy/teal palette, Inter font, CSS animations |
| [js/app.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/client/js/app.js) | Auth page: tab switching, login/register form, JWT storage, redirect |
| [js/dashboard.js](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/client/js/dashboard.js) | Dashboard: KPIs, product CRUD, search, sale recording, sales history, XSS-safe rendering |

### Project root

| File | Purpose |
|------|---------|
| [README.md](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/README.md) | Professional README with problem statement, architecture, schema, API reference, deployment guide |
| [.gitignore](file:///c:/Users/chama/Desktop/Github/Micro-Inventory%20System/.gitignore) | Covers node_modules, .env, *.db, OS artifacts |

---

## Issue Resolved During Build

**`better-sqlite3` v9 had no prebuilt binary for Node v24.13.0**, and native compilation via MSBuild failed.

**Fix:** Updated to `better-sqlite3` v11.10.0, which ships prebuilt binaries for Node 22 and 24.

---

## Verification Results

All tests run via PowerShell against the live server:

```
GET /health
→ {"status":"ok","timestamp":"2026-03-04T11:59:55.500Z"}  ✅

POST /api/auth/register  { name, email, password }
→ Register success: True  ✅

POST /api/products  { name:"Maggi Cubes", qty:50, cost:100, sell:150 }
→ Product created: Maggi Cubes qty=50  ✅

GET /api/dashboard/metrics
→ Stock value: 5000 XAF  (50 × 100 = 5000 ✅)

POST /api/sales  { product_id, quantity_sold:10 }
→ Sale profit: 500 XAF  ((150-100) × 10 = 500 ✅)

GET /api/products/:id  (after sale)
→ Remaining qty: 40  (50 - 10 = 40 ✅ atomic deduction working)
```

---

## How to Run

```bash
cd server
npm install
cp .env.example .env   # set JWT_SECRET
node app.js            # or: npm run dev
# Open http://localhost:3000/index.html
```
