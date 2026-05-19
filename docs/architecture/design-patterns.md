# Design Patterns Standard (Engineering Guide)

These are the required patterns for sustainable growth and easier maintenance.

## 1) Bounded Context Pattern

Each domain is owned by one service/module only.

- `core-service`: restaurant operations
- `vendor-service`: vendor + subscription + vendor payment records

No cross-service writes to another service's database collections.

## 2) API Gateway Pattern

Frontend and external clients call only `api-gateway`.

Rules:
- No direct frontend calls to internal service hosts.
- Path ownership is declared in `services/api-gateway/src/config/serviceRoutes.js`.

## 3) Layered Architecture Pattern

Use this structure for every extracted service:

1. `routes/`
- Endpoint definitions + middleware chain only.
2. `controllers/`
- HTTP mapping only, no business logic.
3. `services/`
- Business rules and use-cases.
4. `repositories/`
- DB access and query operations.
5. `models/`
- Persistence schema.

## 4) Validation/DTO Pattern

- All request payloads are validated before controller logic.
- Keep parsing/normalization in `validators/`.
- Controllers consume `req.validated` instead of raw `req.body`.

## 5) Error Envelope Pattern

Business errors throw typed errors (`HttpError`) and are translated centrally.

Responses:
- Success: `{ success: true, message, data }`
- Error: `{ success: false, message, details? }`

## 6) Strangler Migration Pattern

When extracting any module from `core-service`:

1. Build new service with layered template.
2. Add new gateway route mapping.
3. Keep core endpoint temporarily for rollback window.
4. Cut traffic by switching client base/gateway route.
5. Retire old core endpoint.

## 7) Configuration Pattern

Configuration is environment-only. No secrets/constants hardcoded in logic.

Required env groups:
- Runtime: `PORT`
- Data: `MONGO_URI`
- Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`
- Routing: `CORE_SERVICE_URL`, `VENDOR_SERVICE_URL`

## 8) Operational Patterns

- Add `health` endpoint in each service.
- Handle `EADDRINUSE` explicitly with actionable startup messages.
- Keep services independently deployable (container + env-ready).

## 9) Next Service Templates

Use same layering/patterns for:
- `billing-service`
- `kitchen-service`
- `inventory-service`
- `subscription-service` (if split from vendor domain later)
