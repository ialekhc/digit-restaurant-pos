# Microservices Architecture (Sustainable Pattern)

This codebase follows an incremental microservices strategy using the **Strangler Fig** pattern.

## Service Topology

1. `services/api-gateway`
- Single entrypoint for frontend and external clients.
- Route orchestration by mount path.
- Upstream isolation (`core-service`, `vendor-service`).

2. `server` (core-service)
- Existing restaurant domains: auth, users, menu, tables, orders, kitchen, billing, inventory, reports.
- Runs as the stable base while extraction is in progress.

3. `services/vendor-service`
- Isolated superadmin vendor domain.
- Owns vendor/subscription/payment lifecycle.
- Implements strict layered pattern:
  - `routes` -> `controllers` -> `services` -> `repositories` -> `models`

## Gateway Contract

- `/api/vendors/**` -> `vendor-service`
- `/api/**` -> `core-service`

This preserves frontend compatibility while services are extracted.

## Reliability Patterns Included

- API gateway routing table (`serviceRoutes.js`) for centralized path ownership.
- Per-service `EADDRINUSE` handling for safer local/dev startup.
- Predictable error envelopes in vendor-service:
  - `{ success: false, message, details? }`
- Predictable success envelopes in vendor-service:
  - `{ success: true, message, data }`

## Extraction Roadmap

1. `billing-service`
- Billing, receipts, payment collection, credit ledgers.
2. `kitchen-service`
- KDS queues by station (`BAR`, `FOOD`, `ALL`), status transitions.
3. `inventory-service`
- Stock movements, purchase in/out, supplier ledgers.
4. `auth-identity-service`
- Tenant isolation, role/permission authority, token issuance.

## Local Startup (Microservices Mode)

1. Start MongoDB.
2. Install dependencies at root:
   - `npm install`
3. Start all services:
   - `npm run dev:microservices`
4. Start frontend separately:
   - `npm run dev:client`
5. Point client to gateway:
   - `VITE_API_URL=http://localhost:8080/api`

## Docker Startup (Microservices Mode)

- `docker compose -f docker-compose.microservices.yml up -d --build`
