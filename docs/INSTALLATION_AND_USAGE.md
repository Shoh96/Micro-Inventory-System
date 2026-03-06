# Micro-Inventory System — Installation & Usage Guide

Welcome to the Micro-Inventory System V3! This guide explains how the system works and how to set it up.

---

## 1. How It Works (Overview)

The Micro-Inventory system is designed to replace paper notebooks for small retail shops. It tracks your products, sales, and profits in real-time.

It consists of three main components:
1. **The Database:** A local SQLite file that safely stores all your data.
2. **The Server:** A background API that securely handles the business logic (calculating taxes, detecting duplicate products, and enforcing user permissions).
3. **The User Interface:** The beautiful dark-mode dashboard where you interact with the system.

### Core Features

* **Multi-Tenant Architecture:** A single system can host multiple business owners, each with their own shops, branches, products, and staff — completely isolated from each other.
* **Multi-Shop / Multi-Branch:** Each owner can have multiple shops, and each shop can have multiple branches. Clerks are assigned to a specific branch.
* **Full Admin Control:** The Admin role can create, edit, and permanently delete owner accounts (including all their associated data) directly from the Users page.
* **Multi-User Access:** Owners can create "Clerk" accounts (can only record sales and view inventory). Admins can create Owner accounts.
* **Smart Analytics:** The Dashboard automatically calculates your Total Revenue, Total Profit, and Stock Value based on your historical sales.
* **Low Stock Alerts:** The system uses stock velocity to predict when you will run out of items and flags them for you automatically.
* **Audit Trail:** Every time a product is added, updated, or sold, the system silently records *who* did it and *when* in the Activity Log.

---

## 2. Installation Options

There are three ways to run the Micro-Inventory System depending on your needs.

### Option A: The Windows Desktop App (Easiest)
If you just want to run the system on a single Windows computer at the shop counter, use the `.exe` installer.

1. Locate the `Micro-Inventory-System Setup 3.0.0.exe` file inside the `dist/` folder (once built).
2. Double-click to install it like any regular Windows application.
3. Open "Micro-Inventory System" from your Desktop or Start Menu.
4. The application will automatically start the background server and open the dashboard in a window. Your data is stored safely in your standard Windows AppData folder.

### Option B: Local Network Server (Advanced)
If you want the database on one central computer, but want to access the dashboard from your phone or tablet on the same Wi-Fi network:

1. Install [Node.js](https://nodejs.org/) on the main computer.
2. Open a terminal in the `server/` directory.
3. Run `npm install` to download the code dependencies.
4. Copy `.env.example` to a new file named `.env`.
5. Run `node app.js`.
6. You can now open `http://localhost:3000` on the main computer. To access it from a phone, find the computer's local IP address (e.g., `192.168.1.5`) and type `http://192.168.1.5:3000` into your phone's browser.

### Option C: Cloud Deployment (For remote management)
If you want to access your inventory from *anywhere* in the world, deploy it to a cloud provider like Render.com.

1. Connect this GitHub repository to Render as a "Web Service".
2. Set the Root Directory to `server`.
3. Set the start command to `node app.js`.
4. Attach a "Persistent Disk" so your SQLite database isn't deleted when the server restarts.

---

## 3. Getting Started (First-Time Setup)

### Step 1: Log in as Admin
Use the default admin credentials to log in first. The admin account is the only one that can create owner accounts.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@system.local` | *(set in .env or seed file)* |

If you ran `node seed.js`, all demo accounts use `secureP@ssw0rd!`.

### Step 2: Create an Owner Account (Admin)
1. Go to the **Users** tab.
2. Click **+ Add Owner**.
3. Fill in the owner's name and email.
4. In the **Shops & Branches** section, add at least one shop (name, currency, address) with at least one branch.
5. Click **Create Owner**. A credentials modal will appear showing the auto-generated password — share this with the owner.

### Step 3: Owner Sets Up Their Shop
Once the owner logs in with their credentials, they should:

1. **Add Categories:** Go to 'Inventory' and click '+ Category'. Add your sections (e.g., Beverages, Toiletries).
2. **Add Suppliers:** Click '+ Supplier' to add the people you buy stock from.
3. **Add Products:** Click '+ Add Product'. Fill in the details. You MUST provide the Cost Price (what you bought it for) and Selling Price (what the customer pays). This is how the system calculates your profit!
4. **Record Sales:** When a customer buys something, go to the 'Sales' tab or click the blue 'Sell' button directly on the inventory table. You can apply a discount or a tax rate (e.g., `0.1925` for VAT), and the system will update the stock quantity immediately.
5. **View Analytics:** Let the system do the math! Your dashboard will immediately reflect the new sales in the Revenue and Profit charts.

---

## 4. Managing Users (Admin)

From the **Users** tab, the Admin can:

| Action | How |
|--------|-----|
| **Create an owner** | Click **+ Add Owner** → fill name, email, shops & branches |
| **Edit an owner** | Click the ✏️ Edit button on the owner's row |
| **Delete an owner** | Click **🗑 Delete Owner** — permanently removes the owner and ALL their data (products, sales, branches, shops, clerks) |
| **Create a clerk** | Click **+ Add Clerk** → select owner → select branch → submit |
| **Reset a password** | Click the 🔑 icon on any user row |
| **Deactivate / Reactivate** | Click the toggle button on any user row |

Owners can also create and manage their own clerks, but cannot create or delete other owners.

---

## 5. Managing Shops & Branches

From the **Users** page header:

- **🏪 Shops** button opens the Shops Manager. Admins see all owners' shops. Owners see only their own.
- **🏢 Branches** button opens the Branches Manager. When creating a new branch, you must first select the shop it belongs to.

---

## 6. Viewing Another Owner's Data (Admin only)

When viewing the **Inventory** or **Sales** pages as Admin, a **"🔍 View Owner's Inventory / Sales"** dropdown appears at the top. Select any owner to filter the table to their data only.

---

## 7. Exporting Data

Go to the **Analytics** tab and click the **Products CSV** or **Sales CSV** buttons at the top right. This will download a spreadsheet of your data that you can open in Microsoft Excel or Google Sheets.

---

## 8. Danger Zone (Admin only)

Go to **Settings** → scroll to the red **Danger Zone** card → click **Clear All System Data**.

> ⚠️ **This action is irreversible.** It permanently deletes all products, sales, shops, branches, and non-admin user accounts. Admin accounts are preserved.

You will be asked to confirm twice and type **DELETE** before the action executes.
