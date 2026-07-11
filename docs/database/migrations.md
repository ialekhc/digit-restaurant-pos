# PostgreSQL Migrations

## Commands

From the repository root:

```bash
npm run db:migrate
npm run db:status
npm run db:rollback
npm run db:seed
```

Per service:

```bash
npm run db:migrate --workspace @pos/vendor-service
npm run db:migrate --workspace server
```

## Migration Framework

Both services use a lightweight `pg` runner:

- Core: `server/src/database/migrationRunner.js`
- Vendor: `services/vendor-service/src/database/migrationRunner.js`

Each migration exports:

```js
export const name = 'timestamp_name';
export const up = async (client) => {};
export const down = async (client) => {};
```

Migrations run inside a PostgreSQL transaction. Applied migration names are stored in:

- Core: `schema_migrations`
- Vendor: `vendor_schema_migrations`

## Order

Run vendor migrations before core migrations. Core tables reference `restaurants`, which is vendor-service-owned.

## Rollback

Rollback removes the latest migration per runner:

```bash
npm run db:rollback --workspace server
npm run db:rollback --workspace @pos/vendor-service
```

Do not rollback production without a tested database backup.
