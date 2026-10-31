# Mathew — core backend agent handoff

Read PROJECT_PLAN.md first. Own architecture, shared contracts, security, schema/migrations, subscriptions, billing, invoices, payments, worker and hosting. Lea owns UI; Pranav owns configuration/reporting/supporting backend. Do not take their features without coordination. Update this file at each feature checkpoint with tests and limitations. Commit and push verified features; aim for seven meaningful checkpoints/hour. Do not run routine builds.

## Verified baseline

2026-10-31: only initial README existed. Requirements and team plan are complete. No application code or database was present.

## Ordered work

| Task | Status | Acceptance |
| --- | --- | --- |
| M01 Next.js/TypeScript foundation and health endpoint | Done | Reproducible install, typecheck, HTTP health route, env example |
| M02 Shared contracts, roles and financial primitives | Done | Validated inputs; decimal-safe calculations; permission tests |
| M03 PostgreSQL schema and migration baseline | Done | Validated schema/client and all migrations applied successfully to isolated PostgreSQL 17.11 |
| M04 Authentication and customer isolation | In progress | Better Auth, password/reset rules, admin-only staff, role/ownership checks, audit |
| M05 Subscription lifecycle and service endpoints | In progress | Validated transitions, quotations, activation, pause/close boundaries and renewal history |
| M06 Invoice engine | In progress | Price/tax/discount snapshots, exact rounding, balances and invoice actions |
| M07 Durable billing worker | Not started | Concurrent/retried/catch-up billing cannot duplicate or skip periods |
| M08 Manual payments and Stripe | Not started | Partial payments, reservations, verified/deduplicated webhooks, reconciliation |
| M09 Hosting and integrated acceptance | Not started | Web/worker/DB/email configured, complete smoke flow, observability |

## Interfaces and boundaries

Own src/server/core, src/server/auth, src/server/subscriptions, src/server/billing, src/server/payments, shared contracts, worker scripts and Prisma migrations. Review Pranav's schema proposals before integration. Expose server-calculated amounts and actions to Lea; authorization must never depend on UI visibility. Pranav provides catalog/plan/template lookups, discount eligibility and reports. Mathew atomically consumes discounts during invoice generation.

## Next agent instructions

Inspect repository and latest progress before proceeding. Finish foundation and contracts first, then schema/auth and one quotation-to-payment flow. Keep pure financial/calendar/lifecycle functions separately testable. Use transactions and database uniqueness for financial idempotency, never process-local state. Environment-dependent checks must be reported as unverified if services are absent. Never claim a route is complete when it is only scaffolded.

## Progress log

- Planning checkpoint: ownership, dependencies and acceptance criteria written. All implementation tasks initially Not started.
- Foundation checkpoint: Next.js/React entrypoints, environment example, TypeScript configuration and liveness route added. Health-route test passes using tsx. Dependency installation/runtime checks are still in progress; no build run.
- Security contracts checkpoint: normalized emails, PDF password policy, pagination/money validation, role permissions and customer ownership guards implemented. Three security tests passed. Authentication/database integration remains separate.
- Invoice arithmetic checkpoint: decimal-safe totals, tax after proportional discount allocation, capped discounts and partial-payment balance calculations implemented. Two financial tests passed, including cent allocation and overpayment rejection. Invoice persistence and rule selection remain pending.
- Billing calendar checkpoint: anchor-based daily/weekly/monthly/yearly periods and bounded catch-up enumeration implemented. Two tests passed for leap years, month-end recovery, expiry and batch bounds. Calendar currently uses UTC anchors; business-timezone conversion belongs in worker integration.
- Lifecycle checkpoint: explicit state transitions, minimum quantity, activation dates and plan pause/early-close permissions implemented as pure rules. Two tests passed. Boundary scheduling, resume and renewal require service/worker integration.
- Draft contract checkpoint: validated draft quotation inputs, line quantities, date order, tax bounds and action names. Contract test passed. Plan-backed quotation creation remains dependent on Pranav's configuration services.
- API error checkpoint: malformed JSON, field validation, permission failures and database conflicts return stable safe responses. Error-contract test passed without exposing database details.
- Financial limits checkpoint: isolated 40-digit decimal precision and explicit database monetary bounds preserve cents on large totals and reject overflow. Financial/security regression tests passed.
- Runtime checkpoint: clean offline npm ci completed successfully using integrity-checked archives. All 16 current tests and TypeScript checks passed. Live development HTTP smoke: homepage/health 200, unauthenticated me/subscriptions 401, cross-origin staff POST 403. Project config prevents generated instruction overrides and scopes Turbopack to this repository. No build run.
- Database checkpoint: Prisma schema validates and client generation succeeds. Baseline SQL generated with Prisma migrate diff; separate PostgreSQL checks protect dates, normalized email and financial invariants. Docker development services defined. Migrations have NOT been applied to a database; no PostgreSQL service was reachable locally. M03 remains In progress until that execution check passes.
- Authentication checkpoint: Better Auth handlers, customer-only public signup configuration, password rules/reset SMTP wiring, server actor/origin guards, transactional admin bootstrap and admin-only staff provisioning added. Credential hashing/origin/input tests passed and unauthenticated/cross-origin HTTP checks passed. Real signup/login/reset email and staff creation against PostgreSQL remain unverified; customer portal action permissions and further audit coverage remain pending.
- Subscription adapter checkpoint: paginated customer-scoped list, admin-only manual draft creation and staff action endpoints added with audit writes and optimistic/serializable concurrency guards. Typecheck and draft/lifecycle tests passed; live unauthenticated list returns 401. Database-backed creation/actions remain unverified. Plan lookup, quotation validity, boundary execution, resume, renewal history and customer actions are still pending. Resume deliberately returns an explicit unavailable conflict rather than billing paused periods incorrectly.
- Business-timezone checkpoint: subscription timezone and base tax are snapshotted; calendar recurrence now preserves local wall-clock dates across month boundaries and DST using Temporal. Added India month-boundary and US daylight-saving regression cases. 17 tests passed; schema validation/client generation passed. Stop the dev server before regenerating Prisma on Windows to avoid its loaded engine DLL lock.
- Invoice persistence checkpoint: billing transaction locks subscriptions, snapshots lines/customer/tax totals, enforces one invoice per period, advances atomically, catches up missed periods, applies pending pauses and closes expired contracts. Serializable retries cover Prisma P2034 and raw PostgreSQL 40001/40P01. Four integration tests passed on isolated PostgreSQL 17.11, including eight concurrent calls producing exactly one invoice. All three migrations applied successfully. Typecheck passed. Discount-rule integration, worker scheduling and invoice action/payment endpoints remain pending.
- Invoice/payment API checkpoint: scoped invoice lists/details, balances/payment history, confirmation/cancellation, staff-triggered due billing and idempotent partial manual payments implemented. Seven real PostgreSQL integration tests passed, including concurrent overpayment prevention, key-reuse conflicts, customer isolation and cancellation rules. Fourth migration applied; generated client and typecheck passed. Stripe checkout reservations/webhooks and notification/PDF delivery remain pending.
