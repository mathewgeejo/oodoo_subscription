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

- Done: responsibilities and dependencies agreed. No supporting backend implementation completed at baseline.
