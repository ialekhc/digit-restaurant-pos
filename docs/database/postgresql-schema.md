# PostgreSQL Schema Overview

## Extensions

The schema enables:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
```

UUID primary keys use `gen_random_uuid()`. Emails use `CITEXT`. Money uses `NUMERIC(14,2)`. Stock quantities use `NUMERIC(14,3)`. Unit costs use `NUMERIC(14,4)`. Timestamps use `TIMESTAMPTZ`.

## Key Relationships

- `restaurants` is the tenant root and is owned by vendor-service.
- `branches.restaurant_id` references `restaurants.id`.
- `user_restaurant_roles` maps users to a restaurant role and optional approval limits.
- `user_branch_assignments` scopes a restaurant role to branches.
- `orders` own immutable `order_items` snapshots.
- `payments` allow multiple rows per order for split payment support.
- `inventory_movements` is the immutable stock ledger.
- `branch_inventory` is the current stock balance and must only be updated through inventory transactions.
- `audit_logs` stores sanitized operational changes only.

## Historical Snapshots

Order item rows store `item_name`, `item_sku`, `unit_price`, `tax_amount`, and `line_total`. These fields must not be recalculated from current menu rows after order placement.

## Number Sequences

`number_sequences` generates branch-scoped document numbers such as:

- `ORD-KTM-000001`
- `PAY-KTM-000001`
- `PO-KTM-000001`
- `GRN-KTM-000001`
- `EXP-KTM-000001`

Numbers must be generated inside a transaction using row locking.

## Soft Deletion

Completed financial records must not be physically deleted. Soft deletion is available on vendor, menu, branch, customer, inventory, and supplier master records using `deleted_at`.
