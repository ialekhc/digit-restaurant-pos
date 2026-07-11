# Restaurant Management System

A complete restaurant management web application built with PostgreSQL, Express, React (Vite), and Node.js.

## Features

- JWT authentication with role-based access control
- Roles: `SUPER_ADMIN`, `RESTAURANT_OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `WAITER`, `KITCHEN`
- Super Admin portal for platform analytics and plan distribution
- Vendor onboarding with dedicated vendor-owner login credentials
- SaaS plan engine with feature gating (`STARTER`, `STANDARD`, `PREMIUM`, `ENTERPRISE`)
- Dashboard with live metrics and Recharts analytics
- Menu category and menu item management (with image upload)
- Table management with status updates
- Order lifecycle management (`PENDING -> PREPARING -> READY -> SERVED -> COMPLETED`)
- Kitchen display with large action buttons
- Billing and payment processing with receipt print support
- Inventory management with low-stock tracking
- Supplier and customer management
- Reports: dashboard summary, daily sales, monthly sales, best-selling items, low-stock

## Tech Stack

### Frontend

- React + Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- Zod
- Recharts

### Backend

- Node.js + Express
- PostgreSQL + pg
- JWT Auth
- Bcrypt password hashing
- Multer image upload

## Project Structure

```txt
server/
  app.js
  server.js
  src/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
    utils/
    scripts/
    uploads/
client/
  src/
    api/
    components/
    layouts/
    pages/
    routes/
    hooks/
    utils/
    context/
    App.jsx
services/
  api-gateway/
    src/
      config/
      app.js
      server.js
  vendor-service/
    src/
      constants/
      controllers/
      middleware/
      models/
      repositories/
      routes/
      services/
      utils/
      validators/
README.md
```

## Prerequisites

- Node.js 18+
- PostgreSQL 16+ or Docker

## Database Setup

You can run PostgreSQL in either of these ways:

The backend stores the existing application documents in PostgreSQL using the `app_documents` JSONB table. This keeps the current API contracts stable on PostgreSQL.

## Quick Start

From the project root:

```bash
npm install
docker compose up -d postgres
npm run seed --workspace server
npm run dev:server
npm run dev:client
```

Open:

- Frontend: `http://localhost:5400`
- Backend health: `http://localhost:5500/api/health`

Use `npm run seed --workspace server` only for a fresh development database. It clears the app data and recreates sample records.

### Option A: Docker PostgreSQL

At the project root:

```bash
docker compose up -d postgres
```

This uses `docker-compose.yml` and exposes PostgreSQL on `127.0.0.1:5432`.

### Option B: Local PostgreSQL

Create a local database named `restaurant_pos`, then set:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restaurant_pos
DATABASE_SSL=false
```

## Backend Setup

1. Open terminal in `server`:

```bash
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Create environment file:

```bash
cp .env.example .env
```

4. Update `.env` as needed:

```env
PORT=5500
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restaurant_pos
DATABASE_SSL=false
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5400
```

5. Seed sample data:

```bash
npm run seed
```

6. Run backend:

```bash
npm run dev
```

Backend health check:

- `GET http://localhost:5500/api/health`

## Frontend Setup

1. Open terminal in `client`:

```bash
cd client
```

2. Install dependencies:

```bash
npm install
```

3. (Optional) configure API URL by creating `.env`:

```env
VITE_API_URL=http://localhost:5500/api
```

4. Run frontend:

```bash
npm run dev
```

Frontend runs at:

- `http://localhost:5400`

## Port Conflict Fix (`EADDRINUSE`)

If you get:

```txt
Error: listen EADDRINUSE: address already in use :::5000
```

use port `5500`:

- In `server/.env`, set `PORT=5500`
- In `client/.env`, set `VITE_API_URL=http://localhost:5500/api`
- Restart backend and frontend

## PostgreSQL Troubleshooting

If the backend prints `PostgreSQL is not reachable`, check:

- Docker Desktop is running.
- `docker compose up -d postgres` completed successfully.
- `server/.env` has `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restaurant_pos`.
- Port `5432` is not already used by another local PostgreSQL instance.

For hosted PostgreSQL, set:

```bash
cd server
DATABASE_URL="postgresql://user:password@host:5432/database" npm run db:use
```

## Seed Admin Credentials

- Super Admin: `superadmin@restaurant.local` / `SuperAdmin@12345`
- Email: `admin@restaurant.local`
- Password: `Admin@12345`

Additional seeded users:

- `manager@restaurant.local` / `Manager@12345`
- `cashier@restaurant.local` / `Cashier@12345`
- `waiter@restaurant.local` / `Waiter@12345`
- `kitchen@restaurant.local` / `Kitchen@12345`
- `vendor.himalayan@restaurant.local` / `Vendor@12345`
- `vendor.everest@restaurant.local` / `Vendor@12345`
- `vendor.terai@restaurant.local` / `Vendor@12345` (inactive example)

## API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/change-password`

### Users

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

### Categories

- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

### Menu Items

- `GET /api/menu-items`
- `POST /api/menu-items`
- `POST /api/menu-items/import`
- `GET /api/menu-items/:id`
- `PUT /api/menu-items/:id`
- `DELETE /api/menu-items/:id`

### Tables

- `GET /api/tables`
- `POST /api/tables`
- `PUT /api/tables/:id`
- `DELETE /api/tables/:id`
- `PATCH /api/tables/transfer`
- `PATCH /api/tables/:id/status`

### Orders

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/status`
- `PATCH /api/orders/:id/cancel`

### Payments

- `POST /api/payments`
- `GET /api/payments`
- `GET /api/payments/:id`

### Inventory

- `GET /api/inventory`
- `POST /api/inventory`
- `PUT /api/inventory/:id`
- `DELETE /api/inventory/:id`
- `PATCH /api/inventory/:id/stock`

### Purchases

- `GET /api/purchases`
- `POST /api/purchases`

### Suppliers

- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `DELETE /api/suppliers/:id`

### Customers

- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

### Reports

- `GET /api/reports/dashboard`
- `GET /api/reports/daily-sales`
- `GET /api/reports/weekly-sales`
- `GET /api/reports/monthly-sales`
- `GET /api/reports/yearly-sales`
- `GET /api/reports/best-selling-items`
- `GET /api/reports/low-stock`
- `GET /api/reports/super-admin` (SUPER_ADMIN only)

### Plans

- `GET /api/plans/catalog`
- `GET /api/plans/active`
- `PUT /api/plans/active`

### Vendors

- `GET /api/vendors/overview`
- `GET /api/vendors`
- `POST /api/vendors`
- `GET /api/vendors/:id`
- `PUT /api/vendors/:id`
- `DELETE /api/vendors/:id`
- `PUT /api/vendors/:id/subscription`
- `POST /api/vendors/:id/subscription/payments`
- `PUT /api/vendors/:id/subscription/payments/:paymentId`
- `DELETE /api/vendors/:id/subscription/payments/:paymentId`

### Public QR Ordering

- `GET /api/public/qr-menu/:tableId`
- `GET /api/public/qr-meta/:tableId`
- `POST /api/public/qr-menu/:tableId/orders`

## Smoke Test Checklist

After starting the app:

1. Login as `admin@restaurant.local` / `Admin@12345`.
2. Open dashboard and confirm cards load.
3. Open tables and confirm color/status cards render.
4. Create a dine-in order from a table.
5. Open kitchen and move the order through `PREPARING` and `READY`.
6. Open billing and create payment by table/order.
7. Open purchases and create a purchase-in or purchase-out entry.
8. Open reports and switch daily, weekly, monthly, and yearly views.
9. Login as `superadmin@restaurant.local` / `SuperAdmin@12345` and verify vendors, subscriptions, plans, and users.

## Microservices Mode (Architecture)

For sustainability and easier maintenance, this repository now includes a microservices-ready architecture with:

- `services/api-gateway` (API Gateway)
- `server` (Core Service / existing monolith domains)
- `services/vendor-service` (Vendor + Subscription bounded context)

### Run in Microservices Mode

1. Install workspace dependencies from root:

```bash
npm install
```

2. Start all microservices from root:

```bash
npm run dev:microservices
```

This runs:
- `core-service` on `:5500`
- `vendor-service` on `:5601`
- `api-gateway` on `:8080`

3. Start frontend:

```bash
npm run dev:client
```

4. Point frontend API to gateway:

```env
VITE_API_URL=http://localhost:8080/api
```

### Gateway Routing

- `/api/vendors/*` → `vendor-service`
- `/api/*` → `core-service`

### Docker (Microservices)

```bash
docker compose -f docker-compose.microservices.yml up -d --build
```

Architecture details are documented in:

- `docs/architecture/microservices-architecture.md`
- `docs/architecture/design-patterns.md`


## Notes

- Menu images are stored in `server/src/uploads` and served via `/uploads/*`.
- `register` is restricted to `ADMIN` users after authentication.
- Customer role is optional and not enabled in frontend routing by default.

## Normalized PostgreSQL Database

The project now includes a normalized PostgreSQL schema while retaining the legacy `app_documents` JSONB table as a migration fallback.

### Service Ownership

- `services/vendor-service` owns vendor lifecycle tables: `restaurants`, `subscription_plans`, `restaurant_subscriptions`, `subscription_payments`, `vendor_onboarding_events`.
- `server` owns core restaurant operations: users/RBAC, branches, menu, tables, orders, payments, kitchen, inventory, suppliers, customers, reports, and audit logs.
- The API gateway routing remains unchanged:
  - `/api/vendors/**` -> vendor-service
  - `/api/**` -> core-service

### Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restaurant_pos
CORE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restaurant_pos
VENDOR_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/restaurant_pos
DATABASE_SSL=false
USE_LEGACY_DOCUMENT_STORAGE=false
```

If `CORE_DATABASE_URL` or `VENDOR_DATABASE_URL` is not set, the services fall back to `DATABASE_URL`.

### Migration Commands

Run vendor migrations before core migrations:

```bash
npm run db:migrate
npm run db:status
npm run db:seed
```

Per service:

```bash
npm run db:migrate --workspace @pos/vendor-service
npm run db:migrate --workspace server
npm run db:seed --workspace @pos/vendor-service
npm run db:seed --workspace server
```

### JSONB Migration Commands

Dry run:

```bash
npm run db:migrate:documents:dry-run
```

Execute staged migration:

```bash
npm run db:migrate:documents
```

Verify counts:

```bash
npm run db:migrate:documents:verify
```

The JSONB migration does not drop `app_documents`. Failed rows are recorded in `app_document_migration_failures`.

### Database Documentation

- `docs/database/postgresql-schema.md`
- `docs/database/migrations.md`
- `docs/database/jsonb-migration.md`
- `docs/database/backup-restore.md`
- `docs/database/service-table-ownership.md`

### Development Credentials

Development seed credentials are for local development only:

- Super Admin: `superadmin@restaurant.local` / `SuperAdmin@12345`
- Owner: `owner@restaurant.local` / `Owner@12345`
- Admin: `admin@restaurant.local` / `Admin@12345`
- Manager: `manager@restaurant.local` / `Manager@12345`
- Cashier: `cashier@restaurant.local` / `Cashier@12345`
- Waiter: `waiter@restaurant.local` / `Waiter@12345`
- Kitchen: `kitchen@restaurant.local` / `Kitchen@12345`
