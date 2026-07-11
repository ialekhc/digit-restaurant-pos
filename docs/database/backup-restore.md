# Backup and Restore

## Backup

Use `pg_dump` before running migrations or JSONB cutover:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=backup-before-normalized-schema.dump
```

For plain SQL:

```bash
pg_dump "$DATABASE_URL" --file=backup-before-normalized-schema.sql
```

## Restore

Custom format:

```bash
pg_restore --clean --if-exists --dbname "$DATABASE_URL" backup-before-normalized-schema.dump
```

Plain SQL:

```bash
psql "$DATABASE_URL" < backup-before-normalized-schema.sql
```

## Rollback Procedure

1. Stop application writes.
2. Run service rollbacks only if schema rollback is enough:

```bash
npm run db:rollback --workspace server
npm run db:rollback --workspace @pos/vendor-service
```

3. If data was transformed and must be reverted, restore from backup.
4. Re-enable `USE_LEGACY_DOCUMENT_STORAGE=true` if the runtime has been cut over.
5. Restart services and verify health endpoints.
