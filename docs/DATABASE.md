# Database design

PostgreSQL 17 is the source of truth. Apply the versioned SQL migrations with `npm run db:migrate`; do not use schema push against a deployed database.

- Identity: users, accounts, sessions and expiring verifications. Email is unique and normalized; public signup is always Customer.
- Catalog: products have archived variants and an optional tax rule. Plans hold cadence, base charge, quantity and lifecycle settings. Quotation templates contain relational product/variant lines. Discounts use a join table for targeted products.
- Contracts: subscriptions link a customer, optional plan/template and stable product/variant IDs. Descriptions, prices, taxes and permissions are copied at quotation creation, preserving agreed terms when catalog settings change. Legacy manual quotations remain supported for administrators.
- Finance: one invoice per subscription/billing period, immutable line amounts, recorded payments and unique idempotency references. Checkout reservations, provider events and receipts handle payment reconciliation. Monetary columns are decimal, never floating point.
- Discount use: one use per invoice, consumed in the billing transaction with row locking and restored at most once on cancellation. Discounts are allocated only to eligible lines before tax.
- Operations: audit events, worker heartbeat/retry fields and durable notification jobs. Delivery occurs outside financial transactions.

Foreign keys prevent orphaned commercial records. CHECK constraints reject negative prices, invalid tax percentages, invalid periods, quantity and usage limits. Indexes cover customer history, due billing, invoice status/due date, report dates and catalog lookup. Archive catalog entries instead of deleting historical references.

`scripts/seed-demo.ts` creates synthetic accounts/catalog and 18 subscriptions with 90 invoices in a separate demo database. Stable IDs and additive upserts make reruns repeatable. It does not wipe data or replace existing account passwords. Production seeding requires the explicit `ALLOW_DEMO_SEED=true` flag. The demo seed is not a performance benchmark.
