# Production SaaS Refactor Audit

Last updated: 2026-07-15

## Current Codebase Assessment

The repository contains a working restaurant POS application with a React/Vite frontend, Express backend, PostgreSQL runtime, Docker setup, and early microservice scaffolding.

Current runtime shape:

- `server/` is the primary production backend.
- `client/` is the primary React application.
- `services/api-gateway/` and `services/vendor-service/` are early microservice scaffolds, but the monolith still owns most business workflows.
- PostgreSQL is connected through `pg`, but most active application models use `app_documents` JSONB through `createPostgresModel`.
- Normalized PostgreSQL migrations already exist for users, roles, restaurants, branches, orders, order items, payments, printers, and print jobs, but most controllers have not fully moved to those tables.
- RBAC constants are centralized in backend and mirrored in frontend, with permission middleware applied to most protected routes.
- Tenant scoping exists through `tenantScopeService`, but it is not yet enforced by repository-level database constraints because many queries still run over JSONB documents.
- Printing has a dedicated `printService` with preparation station grouping and idempotency keys.
- The UI has shared components and Tailwind tokens, but pages still contain mixed business logic, data formatting, and view rendering.

## Critical Issues

1. Data persistence is split between normalized schema and JSONB document storage.
   The normalized schema is the right long-term SaaS direction, but active controllers still use document-style models. This makes indexes, joins, constraints, branch isolation, reporting, and concurrency harder.

2. Order and payment workflows are not consistently transaction-backed.
   Order creation, payment creation, receipt jobs, table status updates, and loyalty updates can partially succeed independently.

3. Tenant and branch isolation is implemented at service/query-builder level, not guaranteed at the database level.
   A missed `buildTenantScopedQuery()` call can expose cross-vendor data.

4. RBAC is duplicated between backend and frontend.
   The backend is authoritative, but frontend constants can drift and cause hidden/visible action mismatch.

5. Controllers are still too large.
   `orderController` and `paymentController` contain validation, business rules, persistence, status transitions, table sync, and print-job creation.

6. There is no full automated test suite.
   The only visible test-like check is `server/src/scripts/printService.selftest.js`.

7. Observability was minimal before phase 1.
   API responses and logs did not consistently include request IDs, making production debugging difficult.

8. Subscription and feature gating exists, but plan enforcement is not consistently close to all mutation points.

9. UI consistency is improving, but icon usage, responsive layouts, empty states, table/card patterns, and form validation should be standardized through a design system.

## Proposed Backend Architecture

Use a modular monolith first, then extract true services only after boundaries are stable.

Recommended `server/src/features` structure:

```txt
server/src/
  app.js
  config/
  database/
  middleware/
  shared/
    errors/
    logger/
    request-context/
    validation/
    transactions/
  features/
    auth/
      auth.routes.js
      auth.controller.js
      auth.service.js
      auth.repository.js
      auth.schemas.js
    rbac/
      roles.js
      permissions.js
      role-policy.service.js
    tenants/
      tenant-scope.service.js
      tenant.repository.js
    vendors/
    branches/
    users/
    menu/
    tables/
    orders/
    preparation/
    billing/
    payments/
    receipts/
    printing/
    inventory/
    purchases/
    suppliers/
    customers/
    reports/
    subscriptions/
    audit/
```

Backend rules:

- Controllers accept HTTP input and return HTTP output only.
- Services own business rules and workflow orchestration.
- Repositories own SQL and tenant-safe data access.
- Validation schemas normalize request bodies before services run.
- Transactions wrap multi-write workflows.
- Audit logs are written for sensitive actions.
- Backend permission checks remain mandatory for every protected mutation.
- Tenant and branch scope must be applied at repository level, not only controller level.

## Proposed Frontend Architecture

Recommended `client/src/features` structure:

```txt
client/src/
  app/
    routes/
    providers/
  design-system/
    Button.jsx
    IconButton.jsx
    Input.jsx
    Select.jsx
    Card.jsx
    DataTable.jsx
    Badge.jsx
    Modal.jsx
    EmptyState.jsx
    Skeleton.jsx
  shared/
    api/
    auth/
    formatting/
    permissions/
    feature-gates/
  features/
    auth/
    super-admin/
    vendors/
    users/
    menu/
    tables/
    orders/
    kitchen/
    billing/
    print-station/
    inventory/
    purchases/
    customers/
    reports/
    settings/
```

Frontend rules:

- Pages compose feature components; they should not contain complex business rules.
- Permission and subscription guards hide unavailable actions and handle `403` API responses clearly.
- Data-loading hooks live near the feature.
- Reusable forms and tables use one design system.
- Lucide React should be the single icon library.
- Icon-only controls must include `aria-label` and tooltip/title text.

## Database Improvement Plan

Phase sequence:

1. Keep `app_documents` stable while adding observability and tests.
2. Move high-risk workflows to normalized SQL first:
   orders, order_items, payments, bills/receipts, print_jobs, tables.
3. Add repository tests for tenant isolation and branch filtering.
4. Backfill JSONB documents into normalized tables with idempotent migration scripts.
5. Switch read paths to normalized tables behind repository interfaces.
6. Switch write paths to normalized tables inside transactions.
7. Keep read-only compatibility for legacy JSONB until verified.
8. Remove legacy document models after production data verification.

Required constraints and indexes:

- `restaurant_id` on every tenant-owned table.
- `branch_id` on branch-owned operational tables.
- Unique order, bill, payment, and print-job idempotency keys scoped by restaurant where applicable.
- Foreign keys between orders, order_items, payments, receipts, print_jobs, tables, users, branches, and restaurants.
- Soft-delete columns for operational records.
- Audit log table with actor, action, resource, before/after snapshot, request ID, restaurant ID, and branch ID.

## UI/UX And Icon-System Plan

Use a practical restaurant-operations design system:

- Consistent light theme with orange/aqua brand tokens already present in Tailwind.
- One icon source: Lucide React.
- Navigation icons for major modules.
- Text plus icon for primary actions.
- Icon-only buttons only for compact secondary actions like edit/delete/print/retry, with accessible labels.
- Shared status badges for table, order, payment, stock, subscription, and print-job states.
- Responsive patterns:
  - desktop: tables and multi-column dashboards;
  - tablet: two-column cards;
  - mobile: app-like stacked cards, sticky bottom actions, large touch targets;
  - kitchen/bar/smoke: full-screen, high-contrast operational boards.
- Standard empty/loading/error states for every list.
- PDF/receipt layouts should use dedicated React PDF components and fixed paper-width templates.

## Security Risks

- Missing transaction boundaries can create duplicate or partial payments.
- JSONB document access cannot enforce tenant isolation with foreign keys.
- Role-permission drift between frontend and backend can hide valid actions or expose invalid ones.
- JWT secret quality was not validated before phase 1.
- Audit logging is not yet implemented for sensitive actions.
- Print-station job claiming can race unless locked at the database layer.
- Uploaded images need file type, size, and storage hardening before production.
- CORS is currently permissive and should be configured per environment.

## Phased Refactoring Roadmap

### Phase 1: Production Foundation

Status: started.

- Add request IDs to all backend requests and error responses.
- Add structured request logs.
- Validate required environment variables at startup.
- Document the production SaaS target architecture.
- Do not alter business workflows.

### Phase 2: RBAC And Tenant Isolation Hardening

- Move backend role/permission matrix into one source of truth.
- Generate frontend permission metadata from backend or expose it through `/api/permissions`.
- Add repository-level tenant guard helpers.
- Add tests for cross-tenant denial.
- Add audit-log service and middleware hooks for sensitive actions.

### Phase 3: Orders And Preparation Refactor

- Extract order creation/update/status logic into `orders.service.js`.
- Add transaction-backed order creation and item mutation.
- Add explicit order status transition service.
- Persist preparation tickets separately from orders.
- Add station-ticket tests for food, bar, smoke, added items, and cancelled items.

### Phase 4: Billing, Payments, Receipts, And Printing

- Extract billing/payment service layer.
- Prevent duplicate payment with database constraints and idempotency keys.
- Create counter receipt jobs only inside successful payment transaction.
- Lock print-job claiming with SQL row locks.
- Add React PDF receipt and station-ticket test fixtures.

### Phase 5: Normalized PostgreSQL Migration

- Move active order/payment/print workflows from JSONB models to normalized repositories.
- Backfill legacy documents.
- Verify counts and financial totals.
- Remove legacy JSONB dependency only after parity checks.

### Phase 6: Frontend Feature Architecture And Design System

- Create `design-system` components.
- Move module pages into `features`.
- Add Lucide icons consistently.
- Add shared loading, empty, unauthorized, and error components.
- Improve mobile and tablet flows.

### Phase 7: Tests, CI/CD, Docker, And Deployment Hardening

- Add backend integration tests.
- Add frontend route/permission tests.
- Add Docker health checks.
- Add CI jobs for install, build, tests, migrations dry-run, and image build.
- Harden Nginx headers and environment handling.

## Exact Files To Create Or Modify

Phase 1 files changed:

- `server/src/config/envValidation.js`
- `server/src/middleware/requestContext.js`
- `server/src/app.js`
- `server/src/middleware/errorHandler.js`
- `server/server.js`
- `docs/architecture/production-saas-refactor-audit.md`
- `README.md`

Next phase candidate files:

- `server/src/config/constants.js`
- `server/src/services/permissionService.js`
- `server/src/middleware/permissions.js`
- `server/src/services/tenantScopeService.js`
- `server/src/controllers/orderController.js`
- `server/src/controllers/paymentController.js`
- `server/src/services/printService.js`
- `server/src/repositories/orderRepository.js`
- `server/src/repositories/paymentRepository.js`
- `server/src/database/migrations/*`
- `client/src/utils/constants.js`
- `client/src/routes/ProtectedRoute.jsx`
- `client/src/components/Sidebar.jsx`
- `client/src/components/ui/*`

