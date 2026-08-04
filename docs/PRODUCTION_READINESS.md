# Production readiness

The repository has a production baseline, but a signed installer is not the same as an operationally complete production system. Complete the deployment-specific items below before processing real restaurant or customer data.

## Automated release gate

Run:

```bash
npm run verify
```

This checks server and desktop JavaScript syntax, runs configuration/security tests, and builds both web and desktop interfaces. GitHub Actions runs the same gate on pull requests and pushes to `main`.

For a signed Windows installer, provide the code-signing certificate and run:

```powershell
$env:CSC_LINK='C:\secure\digit-pos-signing.pfx'
$env:CSC_KEY_PASSWORD='use-a-secret-store'
npm.cmd run release:windows
```

Never commit the certificate or password. The release command refuses to build a production installer without signing credentials.

## Required architecture decision

Choose one supported operating model before launch:

1. **Cloud-connected desktop:** Electron connects over HTTPS to a managed backend and managed PostgreSQL. This is the recommended model for multiple branches, centralized reporting, controlled backups, and remote support.
2. **Offline single-site desktop:** PostgreSQL, backups, migrations, and recovery must be installed and managed on every POS machine. Add an installer-managed database service and an encrypted off-device backup/synchronization strategy before calling this mode production-ready.

The current local desktop mode expects PostgreSQL to already be available. It is suitable for development and controlled pilots, not unattended customer installation.

## Production environment

The backend intentionally fails fast when production configuration is unsafe. Set at least:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=5500
DATABASE_URL=postgresql://unique_user:strong_password@database-host/restaurant_pos
DATABASE_SSL=true
JWT_SECRET=<unique random value of at least 32 characters>
CORS_ORIGINS=https://pos.example.com
TRUST_PROXY=1
```

Keep secrets in the deployment platform's secret manager. Do not reuse the sample database password or development login credentials.

Packaged desktop builds use `https://digitnp.com/api` by default. To use another hosted API, edit `desktop-config.json` in the app-data directory and set `apiBaseUrl` to its HTTPS URL. A packaged app rejects non-local plain HTTP endpoints.

## Database and recovery

- Run migrations as an explicit release step before replacing the backend.
- Take an encrypted backup immediately before migration.
- Define retention, off-device replication, and access controls.
- Perform and document a full restore drill before launch and at least quarterly.
- Monitor database capacity, connection exhaustion, slow queries, and backup age.
- Never run development seed commands against production. Production seeding is blocked unless explicitly overridden.

## Operational launch checklist

- Use TLS with automatic renewal for every public endpoint.
- Restrict PostgreSQL to the application network; never expose port 5432 publicly.
- Replace all sample users and passwords, and verify each role's least-privilege access.
- Configure QZ Tray signing certificates for trusted receipt and kitchen printing.
- Set up centralized error reporting, uptime monitoring, alert ownership, and log retention.
- Sign the Windows installer with an organization-validated certificate.
- Add an authenticated update channel and staged rollback plan before enabling automatic updates.
- Run end-to-end tests for login, order creation, kitchen flow, payment, refunds, printing, inventory, shift close, backup, and restore using production-like hardware.
- Complete privacy, tax, payment, employee-data, and retention review for every jurisdiction where the system operates.

## Current safeguards

- Explicit CORS allowlist and loopback-aware desktop mode
- Helmet security headers, response compression, API and login throttling
- Request IDs and non-leaking production error responses
- Strict upload types with randomized filenames and persistent upload storage
- Graceful API shutdown and database pool cleanup
- Non-root backend container and health-gated Compose startup
- Encrypted desktop JWT secret when OS encryption is available
- Single-instance desktop process, renderer sandboxing, HTTPS enforcement, and crash log file
- Route-level UI code splitting
- Locked server/client Docker dependencies and zero known npm production advisories at the time of verification
