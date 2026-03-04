# Community Micro-Inventory System

A production-structured inventory management API and web application for small shop owners in emerging markets. Built with Node.js, Express, SQLite, and Vanilla JavaScript.

---

## Problem Statement

In many emerging markets across sub-Saharan Africa and similar regions, the majority of small retail businesses, roadside shops, and market stalls manage their stock manually — using paper notebooks, mental tracking, or no tracking at all. This results in predictable and costly failures:

- **Overstocking** ties up capital in goods that may spoil or become obsolete.
- **Stockouts** result in lost sales and damaged customer relationships.
- **Profit blindness** — shop owners frequently cannot determine whether their business is profitable because cost data and sales data live in separate notebooks or not at all.
- **No audit trail** — when discrepancies arise, there is no reliable record to investigate.

These are not technology failures. They are information failures. A small business with five product lines and two employees does not need an enterprise ERP. It needs a straightforward tool that records what came in, what went out, and what profit was made — accessible from a phone or a basic laptop, without requiring internet access during critical operations.

This system addresses that gap directly.

---

## Solution Overview

The Community Micro-Inventory System provides shop owners with:

- Secure, account-based access so that each owner's data is isolated.
- A full product catalogue with cost price, selling price, and quantity tracking.
- Automatic profit calculation on every recorded sale.
- Stock deduction on sale, with a hard constraint preventing sales that exceed available inventory.
- Low-stock alerts surfaced on the dashboard.
- Aggregated metrics: total inventory value, total revenue, and total realised profit.

The system is structured as a RESTful JSON API served by an Express application, consumed by a lightweight HTML/CSS/JavaScript frontend. There are no build tools, no transpilation, and no client-side framework dependencies — the frontend runs in any modern browser directly.

---

## Technical Architecture

```
micro-inventory/
│
├── server/                     # Express API
│   ├── app.js                  # Entry point: middleware, route mounting, server start
│   ├── config/
│   │   └── db.js               # SQLite connection; self-bootstrapping schema
│   ├── routes/                 # Route definitions (thin — delegate to controllers)
│   │   ├── authRoutes.js
│   │   ├── productRoutes.js
│   │   ├── saleRoutes.js
│   │   └── dashboardRoutes.js
│   ├── controllers/            # Request handling and input validation
│   │   ├── authController.js
│   │   ├── productController.js
│   │   ├── saleController.js
│   │   └── dashboardController.js
│   ├── models/                 # SQL queries — no logic, no validation
│   │   ├── userModel.js
│   │   ├── productModel.js
│   │   ├── saleModel.js
│   │   └── dashboardModel.js
│   ├── middleware/
│   │   ├── auth.js             # JWT verification middleware
│   │   └── errorHandler.js     # Centralised error response handler
│   └── utils/
│       └── calculations.js     # Pure financial calculation functions
│
├── client/                     # Vanilla JS frontend (no build step)
│   ├── index.html              # Login and registration page
│   ├── dashboard.html          # Main application view
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js              # Auth page logic
│       └── dashboard.js        # Dashboard page logic
│
└── README.md
```

### Separation of Concerns

**Routes** are intentionally thin. They declare the HTTP verb, path, and which middleware and controller function handles the request. No business logic lives in route files.

**Controllers** own the request/response cycle. They validate input, call model functions, calculate derived values using utility functions, and construct the response.

**Models** contain only database access code. Each function maps directly to a SQL statement. There is no validation or HTTP awareness in model files.

**Middleware** operates cross-cutting concerns: authentication (JWT verification) and error handling (centralised JSON error envelope).

**Utils** contain stateless, pure functions (profit calculation, currency rounding) that have no dependency on Express or the database.

### Authentication

Token-based authentication is implemented using JSON Web Tokens (JWT). On successful login or registration, the server signs a token containing the user's `id`, `name`, and `email`. This token is returned to the client and stored in `localStorage`. All protected API requests include this token in the `Authorization: Bearer <token>` header.

The server's `authenticate` middleware verifies the token's signature and expiry on every protected request before passing control to the controller. The decoded `id` is attached to `req.user` and used to scope all database queries to the authenticated user.

### Database Schema

```
users
  id            INTEGER PK AUTOINCREMENT
  name          TEXT NOT NULL
  email         TEXT NOT NULL UNIQUE
  password_hash TEXT NOT NULL
  created_at    TEXT DEFAULT (datetime('now'))

products
  id            INTEGER PK AUTOINCREMENT
  owner_id      INTEGER NOT NULL → users(id) ON DELETE CASCADE
  name          TEXT NOT NULL
  description   TEXT DEFAULT ''
  quantity      INTEGER NOT NULL DEFAULT 0
  cost_price    REAL NOT NULL
  selling_price REAL NOT NULL
  created_at    TEXT DEFAULT (datetime('now'))
  updated_at    TEXT DEFAULT (datetime('now'))

sales
  id                    INTEGER PK AUTOINCREMENT
  owner_id              INTEGER NOT NULL → users(id) ON DELETE CASCADE
  product_id            INTEGER NOT NULL → products(id) ON DELETE CASCADE
  quantity_sold         INTEGER NOT NULL
  selling_price_at_sale REAL NOT NULL
  cost_price_at_sale    REAL NOT NULL
  total_profit          REAL NOT NULL
  sale_date             TEXT DEFAULT (datetime('now'))
```

**Design notes:**
- `selling_price_at_sale` and `cost_price_at_sale` are denormalised snapshots captured at the time of the transaction. This ensures historical profit reports remain accurate even after the product's prices are updated.
- `total_profit` is persisted (not computed at query time) to make dashboard aggregation queries fast and to avoid rounding inconsistencies.
- Foreign key constraints with `ON DELETE CASCADE` ensure referential integrity: deleting a user removes their products and sales. Deleting a product removes its sales history.
- WAL (Write-Ahead Logging) mode is enabled for better read concurrency and crash safety.
- Foreign key enforcement is enabled explicitly (`PRAGMA foreign_keys = ON`), as SQLite disables it by default.

### Aggregation Queries (Dashboard)

The dashboard endpoint runs three SQL aggregations in a single request:

1. **Inventory value** — `SUM(cost_price * quantity)` and `SUM(selling_price * quantity)` across all owner products.
2. **Sales totals** — `SUM(total_profit)` and `SUM(quantity_sold * selling_price_at_sale)` across all owner sales.
3. **Low-stock count** — `COUNT(*)` of products at or below a configurable threshold (default: 5 units).

`COALESCE(..., 0)` is used throughout to handle the edge case of no data (new accounts), avoiding `NULL` values in the response.

---

## Key Features

- JWT-based authentication with bcrypt password hashing (12 salt rounds)
- Multi-tenant data isolation: all queries are scoped by `owner_id`
- Stock deduction on sale within an atomic SQLite transaction
- Hard constraint preventing sales that exceed available inventory
- Price snapshots in sales records for accurate historical profit tracking
- Automatic low-stock detection with configurable threshold
- Dynamic update queries that only modify fields present in the request body
- User-enumeration protection: identical error message for wrong email and wrong password
- Centralised JSON error handler with stack trace suppression in production
- Self-bootstrapping database schema (no separate migration step required)
- Static frontend served by Express in production (single deployable unit)
- XSS-safe frontend rendering via HTML entity escaping before DOM insertion

---

## API Reference

All endpoints return a consistent JSON envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "Error description." }
```

### Authentication

| Method | Endpoint               | Auth Required | Description                          |
|--------|------------------------|---------------|--------------------------------------|
| POST   | /api/auth/register     | No            | Create a new shop-owner account      |
| POST   | /api/auth/login        | No            | Authenticate and receive a JWT       |

### Products

| Method | Endpoint                    | Auth Required | Description                          |
|--------|-----------------------------|---------------|--------------------------------------|
| GET    | /api/products               | Yes           | List all products for the owner      |
| GET    | /api/products/low-stock     | Yes           | List products below stock threshold  |
| GET    | /api/products/:id           | Yes           | Retrieve a single product            |
| POST   | /api/products               | Yes           | Create a new product                 |
| PUT    | /api/products/:id           | Yes           | Update product fields                |
| DELETE | /api/products/:id           | Yes           | Delete a product                     |

### Sales

| Method | Endpoint    | Auth Required | Description                          |
|--------|-------------|---------------|--------------------------------------|
| GET    | /api/sales  | Yes           | Retrieve full sale history           |
| POST   | /api/sales  | Yes           | Record a sale and deduct stock       |

### Dashboard

| Method | Endpoint                | Auth Required | Description                          |
|--------|-------------------------|---------------|--------------------------------------|
| GET    | /api/dashboard/metrics  | Yes           | Aggregated KPIs and low-stock list   |

### Health Check

| Method | Endpoint  | Auth Required | Description                          |
|--------|-----------|---------------|--------------------------------------|
| GET    | /health   | No            | Server liveness check                |

---

## Setup and Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Local setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/micro-inventory-system.git
cd micro-inventory-system

# 2. Install server dependencies
cd server
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and set JWT_SECRET to a long random string

# 4. Start the development server
npm run dev

# The API will start on http://localhost:3000
# The frontend is served at http://localhost:3000/index.html
```

### Environment Variables

| Variable         | Required | Default                  | Description                                 |
|------------------|----------|--------------------------|---------------------------------------------|
| `PORT`           | No       | `3000`                   | HTTP port for the server                    |
| `JWT_SECRET`     | Yes      | —                        | Secret key for signing JWTs                 |
| `JWT_EXPIRES_IN` | No       | `7d`                     | JWT expiry duration                         |
| `DB_PATH`        | No       | `./data/inventory.db`    | Path to the SQLite database file            |
| `CLIENT_ORIGIN`  | No       | `*`                      | CORS allowed origin for the frontend        |

### Accessing the Frontend

In development, the frontend is served by Express at `http://localhost:3000`. Open `http://localhost:3000/index.html` in a browser to use the application.

Alternatively, open `client/index.html` directly with VS Code Live Server on port `5500`, setting `CLIENT_ORIGIN=http://localhost:5500` in your `.env`.

---

## Deployment

### Render (recommended for zero-config deploy)

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repository.
3. Set **Root Directory** to `server`.
4. Set **Start Command** to `node app.js`.
5. Add the following environment variables in the Render dashboard:
   - `JWT_SECRET` — a random 64-character string
   - `NODE_ENV` — `production`
   - `CLIENT_ORIGIN` — your frontend URL (or `*` if serving from the same origin)
6. Deploy. Render will install dependencies and start the server automatically.

### Railway

1. Create a new project and connect your GitHub repository.
2. Add a service pointing to the `server/` directory.
3. Set environment variables as described above.
4. Railway will detect `package.json` and run `npm start`.

### Database persistence on managed platforms

SQLite writes to a local file. On platforms with ephemeral filesystems (e.g., Render free tier), the database will be reset on each deploy. For persistent storage, configure `DB_PATH` to point to a mounted disk volume, or migrate to PostgreSQL using the `pg` package as a drop-in replacement for the database layer.

---

## Why This Project Matters

Digital inventory management is not a novel concept. However, adoption among micro-businesses in developing markets remains low, primarily because the tools that exist are either too expensive, too complex, or require infrastructure (connectivity, cloud accounts, payment cards) that these businesses do not have reliable access to.

This system was designed with that constraint in mind. SQLite requires no separate database server. The frontend requires no build pipeline. The entire application can run on a $5/month VPS or a spare laptop running Node. The data model is simple enough that a shop owner can understand what is being tracked without training.

The engineering decisions made here, JWT authentication, atomic transactions, foreign key constraints, price snapshots, centralised error handling, represent standard backend patterns applied to a real-world problem rather than a contrived exercise. The goal is a codebase that is readable, auditable, and extendable by any engineer who picks it up.

---

## Future Improvements

- **PostgreSQL support** for production deployments requiring multi-process concurrency.
- **CSV export** of products and sales history for offline bookkeeping.
- **Multi-currency support** configurable per account.
- **Role-based access control** to allow shop employees to record sales without managing products.
- **Barcode scanning integration** via browser camera API for faster product lookup.
- **Offline-first PWA** using IndexedDB with background sync for low-connectivity environments.
- **Automated restock notifications** via SMS gateway (e.g., Africa's Talking API).
- **Automated test suite** using Vitest or Jest for unit-testing models and controllers.

---

## Resume Summary

The Community Micro-Inventory System is a full-stack web application built with Node.js, Express, SQLite, and Vanilla JavaScript. It implements JWT-based authentication, a RESTful CRUD API with owner-scoped multi-tenancy, atomic database transactions for sale recording and stock management, and server-side financial aggregations for a business metrics dashboard. The project follows a clean separation of concerns across route, controller, model, and middleware layers, and is structured for deployment on any Node-compatible platform without external service dependencies.

---

## Screenshots

*Screenshots will be added following initial deployment.*

---

## License

MIT
