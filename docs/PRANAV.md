# Pranav — supporting business backend agent handoff

Read PROJECT_PLAN.md first. Own substantial supporting business functionality, not just documentation. Mathew owns core financial execution/security/schema integration; Lea owns all frontend. Read existing contracts before implementation; propose schema changes to Mathew. Update this file with verified work and blockers. Commit/push working features; do not run routine builds.

## Current state

Baseline 2026-10-31: no business services existed. Requirements review is complete; every task below is Not started.

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

- Connected catalog-backed quotation creation for staff/admin, server-resolved prices/taxes/variants, minimum quantity, plan availability, template validity and expiry checks. Billing snapshots product references and selects the largest eligible discount before tax. Capped use is consumed atomically; cancellation restores it once. All 24 PostgreSQL integration tests pass, including concurrent usage-cap and historical-price checks; TypeScript passes.

- Implemented products/archived variants, plan/tax/template/discount management APIs and normalized SQL migration with foreign keys, money/date/usage checks and report indexes. Active variants retain their IDs; removed variants remain available to historical records. Staff cannot modify configuration or inspect cost prices. Database integration and contract tests passed on PostgreSQL 17.
- Catalog snapshots, rule consumption, reporting, delivery and repeatable demo data are the current integration work. Deployment target requested by the user is mathewgeejo.dev.

- Done: responsibilities and dependencies agreed. No supporting backend implementation completed at baseline.
- Mathew has implemented the shared runtime/security, Prisma schema/migrations, subscription snapshots/lifecycle, invoice generation, durable billing/retry/heartbeat, recorded payments and Stripe reservation/webhook/reconciliation core. PostgreSQL/SMTP integration and live HTTP checks exist. Your catalog/plan/template/discount/report/notification tasks remain Not started.
- Existing Invoice/Payment/Subscription/CheckoutAttempt/ProviderEvent/ProviderReceipt/AuditEvent/WorkerHeartbeat models are authoritative. Do not recreate them. Shared guards are in src/server/core/permissions.ts; serializable financial retry support is in src/server/core/transaction.ts. Propose catalog/plan/outbox schema changes for Mathew to integrate.

## Concrete next backend steps

- Start with products/variants and plans, then templates. Define stable product/variant/plan/template IDs and coordinate snapshot lookup interfaces with Mathew. Current quotations accept manual snapshots for ADMIN only; Mathew must connect plan availability, minimum quantity, lifecycle flags, prices/taxes and template validity before STAFF quotation creation is enabled.
- Discount eligibility must identify the rule and eligible product/subscription lines as well as the saving. Mathew must add stable catalog references to snapshots and integrate line-specific allocation, atomic capped usage and cancellation restoration. The current calculator accepts an invoice-wide fixed saving; it does not automatically query discount rules.
- Reporting should use normal Payment records for collected/allocated revenue and Invoice totals for billed revenue. ProviderReceipt rows preserve signed provider receipts, including exceptional/unallocated ones; do not add those to Payment totals a second time. Report exceptions separately. Outstanding/overdue excludes cancelled invoices; active counts must exclude expired terms even when auto-close is disabled. Filter invoice dates and payment dates separately.
- Billing due jobs/retry state are implemented, but there is no generic email outbox yet. Propose a durable delivery/outbox model, idempotency rules and notification consumer interface; Mathew will enqueue within the invoice transaction and wire the consumer. Coordinate email/PDF presentation with Lea. Do not perform network email delivery inside billing transactions.
- Add the Odoo +560 variant example and business demo fixtures as your own feature; Mathew's uniquely named integration fixtures are isolated test data, not product/demo seed data. Keep all rule mutations admin-only using the shared guard.
