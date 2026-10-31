# Pranav — supporting business backend agent handoff

Read PROJECT_PLAN.md first. Own substantial supporting business functionality, not just documentation. Mathew owns core financial execution/security/schema integration; Lea owns all frontend. Read existing contracts before implementation; propose schema changes to Mathew. Update this file with verified work and blockers. Commit/push working features; do not run routine builds.

## Current state

Current implementation: catalog/configuration APIs and normalized migration, catalog quotation integration, product discounts, financial report API, invoice email outbox and repeatable synthetic seed are implemented. Historical baseline and integration notes below record the original work order. Remaining acceptance covers actual external providers, automatic overdue reminders, PDF attachments and scale measurements.

## Ordered work and acceptance

1. Products/variants: validated admin-only CRUD, name/type/prices/cost/notes, variant surcharge; seed Odoo +560 example. Customer responses exclude cost.
2. Plans: base price, cadence, minimum quantity, date window and lifecycle permission settings. Mathew consumes these in confirmation and billing.
3. Quotation templates: associated plan/product lines and validity days; version-safe snapshot data for Mathew's subscription service.
4. Taxes/discounts: admin-only rule management; eligibility by dates, targets, quantities/subtotal and usage allowance. Choose greatest saving with stable tie-break. Provide pure eligibility functions/tests; Mathew owns transactional usage reservation/consumption.
5. Reports: paginated/filterable APIs for active subscriptions, billed revenue, collected payments, outstanding and overdue. Separate invoice dates from payment dates; exclude cancelled invoices. Reconcile totals with source records and enforce role visibility.
6. Notifications: invoice/reminder delivery jobs using Mathew's durable job infrastructure, Lea's templates and SMTP. Idempotent delivery tracking, retry and useful failure information.
7. Demo/performance fixtures: synthetic data for full workflows and scale checks; no real customer data. Add focused integration tests for assigned services.

## Interfaces and boundaries

Own src/server/catalog, src/server/plans, src/server/templates, src/server/discounts, src/server/reports and src/server/notifications plus corresponding API adapters/tests. Mathew reviews migrations and shared contracts. Use his authorization helpers; never duplicate auth or implement invoice/payment execution. Coordinate response fields and filters with Lea. Keep database queries bounded/indexed and avoid per-row report queries.

## Progress log

- Added optional DEMO_CUSTOMER_EMAIL seeding for an existing customer's portal: 7 subscriptions and 24 invoices with synthetic payment history. This addresses an empty portal when signing in with a personal account instead of a seeded demo login. Existing permissions and records are preserved. Seed executed for the current local customer; browser inspection showed dashboard counts of 7 subscriptions, 24 invoices, 12 paid and 11 awaiting payment, plus populated list rows. No tests or builds run for this change, as requested.

- Reporting uses PostgreSQL decimal aggregation, separate invoice/payment dates, bounded UTC date ranges, active unexpired subscriptions and customer access guards. Reconciliation tests passed. Invoice jobs enqueue atomically, use durable leases/retries and skip reserved demo recipients; concurrent claims/idempotency tests passed. All 26 database integration tests and 24 unit tests pass. Actual external SMTP delivery is not configured.

- Added repeatable synthetic demo seed: 14 accounts, linked catalog including Odoo +560, three plans, a quotation template, 18 subscriptions and 90 invoices with recorded/partial payments. Applied all eight migrations to a separate local brightloop_demo database and ran the seed twice successfully. Credentials stay in ignored local environment configuration; no secrets are committed.

- Connected catalog-backed quotation creation for staff/admin, server-resolved prices/taxes/variants, minimum quantity, plan availability, template validity and expiry checks. Billing snapshots product references and selects the largest eligible discount before tax. Capped use is consumed atomically; cancellation restores it once. All 24 PostgreSQL integration tests pass, including concurrent usage-cap and historical-price checks; TypeScript passes.

- Implemented products/archived variants, plan/tax/template/discount management APIs and normalized SQL migration with foreign keys, money/date/usage checks and report indexes. Active variants retain their IDs; removed variants remain available to historical records. Staff cannot modify configuration or inspect cost prices. Database integration and contract tests passed on PostgreSQL 17.
- Catalog snapshots, rule consumption, reporting, delivery and repeatable demo data are the current integration work. Deployment target requested by the user is mathewgeejo.dev.

- Done: responsibilities and dependencies agreed. No supporting backend implementation completed at baseline.
- Historical foundation: Mathew implemented the shared runtime/security, subscription/invoice/payment core and durable worker. The supporting catalog, template, discount, reporting and invoice notification work originally pending here is now integrated as described in the current progress entries above.
- Existing Invoice/Payment/Subscription/CheckoutAttempt/ProviderEvent/ProviderReceipt/AuditEvent/WorkerHeartbeat models are authoritative. Do not recreate them. Shared guards are in src/server/core/permissions.ts; serializable financial retry support is in src/server/core/transaction.ts. Propose catalog/plan/outbox schema changes for Mathew to integrate.

## Current interfaces and next backend steps

- Catalog: GET/POST `/api/v1/catalog/{products|plans|templates|taxes|discounts}` and PUT `/:id`. Lists support search/pagination; writes are admin-only. Staff reads omit cost prices. Variants archive by stable identity; template lines and discount targets are relational.
- Quotations: catalog-backed input is handled in `src/server/catalog/quotation.ts`; financial integration and product-specific discounts are complete. Preserve the serializable billing/cancellation boundaries and historical snapshots.
- Reporting should use normal Payment records for collected/allocated revenue and Invoice totals for billed revenue. ProviderReceipt rows preserve signed provider receipts, including exceptional/unallocated ones; do not add those to Payment totals a second time. Report exceptions separately. Outstanding/overdue excludes cancelled invoices; active counts must exclude expired terms even when auto-close is disabled. Filter invoice dates and payment dates separately.
- Reports: GET `/api/v1/reports?from=ISO&to=ISO` requires staff/admin. The upper bound is exclusive and ranges are limited to 366 days. Monetary totals are strings; monthly comparison converts only display proportions to numbers.
- Invoice delivery: POST `/api/v1/invoices/:id/send` queues once or retries a failed job. The worker consumes `NotificationJob` leases outside billing transactions. Extend this for automatic overdue reminders/PDF attachments, then verify with an external SMTP account. Stable Message-ID cannot guarantee exactly-once SMTP delivery.
- Demo seed: `npm run db:seed`; stable IDs, explicit demo password, separate *_demo database (or explicit override). Odoo +560 is included. Preserve real records and never reset existing passwords during seed reruns.
- Remaining: scheduled next-period line updates (coordinate core service), automatic reminders/attachments, actual provider verification, deployment and the scale benchmark. Do not report these as complete based on local unit tests.
