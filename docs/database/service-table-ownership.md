# Service Table Ownership

## Routing Contract

- `/api/vendors/**` is owned by `services/vendor-service`.
- `/api/**` is owned by the core restaurant service in `server/`.

## Vendor-Service Owned Tables

The vendor service owns platform vendor lifecycle and subscription data:

- `restaurants`
- `subscription_plans`
- `restaurant_subscriptions`
- `subscription_payments`
- `vendor_onboarding_events`
- `vendor_schema_migrations`

Core code must not insert, update, or delete vendor-owned tables during runtime. Core code may validate tenant identity using a trusted token claim or a read-only integration path.

## Core-Service Owned Tables

The core service owns restaurant operations:

- Auth/RBAC: `users`, `roles`, `permissions`, `role_permissions`, `user_restaurant_roles`, `user_branch_assignments`, `user_permission_overrides`, `refresh_tokens`
- Restaurant operations: `branches`, `taxes`, `service_charges`, `payment_method_settings`
- Menu/catalog: `menu_categories`, `menu_items`, `branch_menu_items`, `menus`, `menu_menu_items`, `modifier_groups`, `modifier_options`, `menu_item_modifier_groups`
- Floor/tables: `restaurant_floors`, `restaurant_tables`, `table_assignments`
- Customers: `customers`, `customer_addresses`
- Register/shifts: `shifts`, `cash_registers`, `cash_register_sessions`, `cash_movements`
- Orders/payments: `orders`, `order_items`, `order_item_modifiers`, `order_status_history`, `order_discounts`, `order_cancellations`, `order_voids`, `payments`, `refunds`
- Kitchen: `kitchen_stations`, `menu_item_kitchen_stations`, `kitchen_tickets`, `kitchen_ticket_items`
- Inventory/purchases: `units`, `inventory_items`, `branch_inventory`, `recipe_items`, `inventory_movements`, `stock_adjustments`, `inventory_transfers`, `inventory_transfer_items`, `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`
- Other: `reservations`, `attendance_records`, `loyalty_transactions`, `customer_credit_transactions`, `audit_logs`, `number_sequences`, `app_document_migration_failures`

## Tenant Scoping Rule

Every restaurant-owned query must filter by `restaurant_id`. Every branch-owned query must filter by `restaurant_id` and `branch_id` or an approved branch list.

Example:

```sql
SELECT *
FROM orders
WHERE id = $1
  AND restaurant_id = $2
  AND branch_id = ANY($3::uuid[]);
```
