# Mathew — core backend agent handoff

Read PROJECT_PLAN.md first. Own architecture, shared contracts, security, schema/migrations, subscriptions, billing, invoices, payments, worker and hosting. Lea owns UI; Pranav owns configuration/reporting/supporting backend. Do not take their features without coordination. Update this file at each feature checkpoint with tests and limitations. Commit and push verified features; aim for seven meaningful checkpoints/hour. Do not run routine builds.

## Verified baseline

2026-10-31: only initial README existed. Requirements and team plan are complete. No application code or database was present.

## Ordered work

| Task | Status | Acceptance |
| --- | --- | --- |
| M01 Next.js/TypeScript foundation and health endpoint | Not started | Reproducible install, typecheck, HTTP health route, env example |
| M02 Shared contracts, roles and financial primitives | Not started | Validated inputs; decimal-safe calculations; permission tests |
| M03 PostgreSQL schema and migration baseline | Not started | Prisma validation, constraints, auth-compatible tables; real DB migration separately verified |
| M04 Authentication and customer isolation | Not started | Better Auth, password/reset rules, admin-only staff, role/ownership checks, audit |
| M05 Subscription lifecycle and service endpoints | Not started | Validated transitions, quotations, activation, pause/close boundaries and renewal history |
| M06 Invoice engine | Not started | Price/tax/discount snapshots, exact rounding, balances and invoice actions |
| M07 Durable billing worker | Not started | Concurrent/retried/catch-up billing cannot duplicate or skip periods |
| M08 Manual payments and Stripe | Not started | Partial payments, reservations, verified/deduplicated webhooks, reconciliation |
| M09 Hosting and integrated acceptance | Not started | Web/worker/DB/email configured, complete smoke flow, observability |

## Interfaces and boundaries

Own src/server/core, src/server/auth, src/server/subscriptions, src/server/billing, src/server/payments, shared contracts, worker scripts and Prisma migrations. Review Pranav's schema proposals before integration. Expose server-calculated amounts and actions to Lea; authorization must never depend on UI visibility. Pranav provides catalog/plan/template lookups, discount eligibility and reports. Mathew atomically consumes discounts during invoice generation.

## Next agent instructions

Inspect repository and latest progress before proceeding. Finish foundation and contracts first, then schema/auth and one quotation-to-payment flow. Keep pure financial/calendar/lifecycle functions separately testable. Use transactions and database uniqueness for financial idempotency, never process-local state. Environment-dependent checks must be reported as unverified if services are absent. Never claim a route is complete when it is only scaffolded.

## Progress log

- Planning checkpoint: ownership, dependencies and acceptance criteria written. All implementation tasks initially Not started.
