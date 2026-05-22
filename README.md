# Restaurant Management System (MERN)

A complete restaurant management web application built with MongoDB, Express, React (Vite), and Node.js.

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
- MongoDB + Mongoose
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
- MongoDB (local or Atlas)

## Database Setup

You can run MongoDB in either of these ways:

### Option A: Local MongoDB (already used in this setup)

- Ensure MongoDB is running on `127.0.0.1:27017`
- Default backend URI already points to:

```env
MONGO_URI=mongodb://127.0.0.1:27017/restaurant_pos
```

### Option B: Docker MongoDB

At project root:

```bash
docker compose up -d
```

This uses `docker-compose.yml` and exposes MongoDB on `127.0.0.1:27017`.

### Option C: MongoDB Atlas

1. Create a cluster in Atlas.
2. Create a database user.
3. In Atlas Network Access, allow your current IP (or `0.0.0.0/0` for development only).
4. Copy `server/.env.atlas.example` to `server/.env`.
5. Replace `MONGO_URI` with your Atlas URI.

Example:

```env
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster-name>.mongodb.net/restaurant_pos?retryWrites=true&w=majority&appName=<app-name>
```

Or use the helper script:

```bash
cd server
ATLAS_URI="mongodb+srv://<db_user>:<db_password>@<cluster-name>.mongodb.net/restaurant_pos?retryWrites=true&w=majority" npm run atlas:use
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
MONGO_URI=mongodb://127.0.0.1:27017/restaurant_pos
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
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

- `http://localhost:5173`

## Port Conflict Fix (`EADDRINUSE`)

If you get:

```txt
Error: listen EADDRINUSE: address already in use :::5000
```

use port `5500`:

- In `server/.env`, set `PORT=5500`
- In `client/.env`, set `VITE_API_URL=http://localhost:5500/api`
- Restart backend and frontend

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
- `GET /api/menu-items/:id`
- `PUT /api/menu-items/:id`
- `DELETE /api/menu-items/:id`

### Tables

- `GET /api/tables`
- `POST /api/tables`
- `PUT /api/tables/:id`
- `DELETE /api/tables/:id`
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
- `GET /api/reports/monthly-sales`
- `GET /api/reports/best-selling-items`
- `GET /api/reports/low-stock`
- `GET /api/reports/super-admin` (SUPER_ADMIN only)

### Plans

- `GET /api/plans/catalog`
- `GET /api/plans/active`
- `PUT /api/plans/active`

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

## CI/CD Pipeline (GitHub Actions)

This repo includes a complete CI/CD workflow:

- File: `.github/workflows/ci-cd.yml`
- Trigger:
  - Pull requests to `main` → runs CI checks
  - Push to `main` → runs CI checks + deploys
  - Manual run via `workflow_dispatch`

### CI (Build Validation)

Runs automatically on PR/push:

- Installs workspace dependencies (`npm ci`)
- Builds frontend (`npm run build:client`)
- Performs backend syntax checks:
  - `server/server.js`
  - `server/src/app.js`
  - `services/api-gateway/src/server.js`
  - `services/vendor-service/src/server.js`

### CD (Auto Deploy on push to `main`)

- **Backend (Render)**: triggers deploy using `RENDER_DEPLOY_HOOK_URL`
- **Frontend (Vercel)**: deploys using Vercel CLI (`vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`)

### Required GitHub Repository Secrets

Add these in: `GitHub Repo → Settings → Secrets and variables → Actions`

#### For Render deploy

- `RENDER_DEPLOY_HOOK_URL`

#### For Vercel deploy

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VITE_API_URL_PROD` (example: `https://digit-restaurant-pos-api.onrender.com/api`)

If deploy secrets are missing, CI still runs; deploy jobs are skipped automatically.


## Notes

- Menu images are stored in `server/src/uploads` and served via `/uploads/*`.
- `register` is restricted to `ADMIN` users after authentication.
- Customer role is optional and not enabled in frontend routing by default.
