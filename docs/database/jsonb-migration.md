# JSONB Document Migration

The legacy table `app_documents` is retained as a rollback fallback. It is not dropped by any migration.

## Stages

1. Create normalized schemas.
2. Seed system roles, permissions, plans, and development tenant data.
3. Run document migration dry-run.
4. Execute document migration.
5. Verify counts and totals.
6. Switch runtime repositories to normalized tables behind `USE_LEGACY_DOCUMENT_STORAGE=false`.
7. Keep `app_documents` read-only during rollback window.
8. Archive/drop legacy storage only with separate approval.

## Commands

```bash
npm run db:migrate:documents:dry-run
npm run db:migrate:documents
npm run db:migrate:documents:verify
```

Per service:

```bash
npm run db:migrate:documents --workspace @pos/vendor-service -- --dry-run
npm run db:migrate:documents --workspace server -- --dry-run
npm run db:migrate:documents --workspace server -- --execute --collection=orders
npm run db:migrate:documents --workspace server -- --verify
```

## Current Core Collection Support

The core migration script currently supports these document collections:

- `users`
- `categories`
- `menu_items`
- `tables`
- `customers`
- `suppliers`
- `inventory_items`

Vendor-service migration supports:

- `vendors`

Unsupported collections are skipped and reported. Failures are stored in `app_document_migration_failures`.

## Known Limitations

The staged script is intentionally conservative. Complex financial migration for historical `orders`, `payments`, and `purchase_entries` should be executed after validating existing document shapes and tenant identifiers in the live database.
