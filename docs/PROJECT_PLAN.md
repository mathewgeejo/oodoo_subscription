# Subscription Management System

## Agent instructions and current state

Read this file and your personal handoff before implementation. Implement only your assigned area; coordinate interface/schema changes through Mathew. Preserve other contributors' work. Do not run builds unless the user asks or there is evidence of a build error. Commit and push every verified working feature; aim for at least seven meaningful checkpoints per working hour. Never commit secrets, failing features, or fabricated progress.

Baseline inspected 2026-10-31: repository contained only README.md and the initial commit. The requirements PDF was reviewed. No application existed. Personal handoffs track subsequent progress with evidence. Statuses: Not started, In progress, Blocked, Done.

## Architecture

Next.js App Router, React, TypeScript, PostgreSQL, Prisma, Tailwind CSS and Better Auth; no Vite. One web application and a separate durable billing worker. Primary deployment preparation targets mathewgeejo.dev using Docker Compose, private PostgreSQL and Caddy HTTPS; Render remains an alternative. SMTP delivers email; Stripe test Checkout collects invoice balances. Single business, INR by default, Asia/Kolkata business timezone, UTC timestamps. Pin compatible dependencies and commit the lockfile.

Mathew owns architecture, security, migrations, contracts, subscriptions, invoices, recurring billing, payments and deployment. Lea owns all frontend and customer portal work. Pranav owns product/variant/plan/template configuration, tax/discount rule management, reporting queries, notifications and demo fixtures.

## Required behavior

- Accounts: Admin, Staff, Customer. Unique normalized email; password longer than eight characters with uppercase, lowercase and special character. Expiring one-use reset links. Only admin creates staff. Every server operation enforces role and customer ownership.
- Catalog: name, type, sale/cost prices, notes, variants; Odoo brand example adds 560. Plans have base charge, daily/weekly/monthly/yearly cadence, minimum quantity, availability and pause/renew/early-close/auto-close permissions. Product/add-on charges are additional to the explicit plan base charge.
- Quotations: reusable templates with plan, lines and validity days. Snapshot template values into editable quotations. Subscription stores unique number, customer, plan, start/expiry, payment terms and itemized product/quantity/price/tax lines.
- Lifecycle: Draft -> Quotation -> Confirmed -> Active -> Closed, with Paused. Validate transitions, dates and minimum quantity. Confirmed commercial terms are snapshotted. Pause and early closure apply at the next period boundary; quantity/add-on changes apply next period. No mid-period proration. Renewal preserves history; expired contracts cannot keep billing.
- Billing: bill in advance, calendar-aware month/year intervals with month-end clamping. Durable worker catches up missing periods in sequence. Unique subscription/period constraint and atomic invoice/discount-usage/next-date transaction prevent duplicate or skipped billing. Retry failed work. Store monetary values as decimals and use currency rounding.
- Invoices: Draft, Confirmed, Paid, Cancelled; derive partial and overdue flags from balance/dates. Scheduled invoices auto-confirm. Snapshot prices, taxes, discounts and payment terms. Send, print and download PDF. Block cancellation when payments exist.
- Discounts: admin-only fixed/percentage rules, product/subscription targets, minimum purchase/quantity, start/end, usage caps. Choose one rule with largest saving, stable ID tie-break. Cap saving at eligible subtotal. Count once per invoice; restore once on cancellation. Allocate discount before tax. Historical invoices never recalculate.
- Payments: manual method/amount/date/note/reference, partial balances; Stripe test Checkout for remaining balance. Reserve balance during Checkout. Verified signed webhooks, unique provider events/transactions, amount/currency/invoice checks, reconciliation and explicit exceptions. Browser redirect never establishes payment. Application owns billing schedule; do not also create Stripe subscriptions.
- Reports: active subscriptions, billed revenue, collected payments, outstanding and overdue invoices; date filters, charts and detail tables. Pranav implements query APIs, Lea implements display.

## Shared interfaces and delivery

Versioned JSON routes under /api/v1; Better Auth at /api/auth; Stripe at /api/webhooks/stripe. Shared Zod/TypeScript contracts. Decimal strings for money, ISO dates, paginated lists, consistent errors. Never expose product cost or internal audit details to customers. Database entities cover users/customers, catalog, plans/templates, subscriptions/lines/history, invoices/lines, tax/discount rules/usage, payments/checkout/webhook events, jobs and audit records.

Delivery order: contracts/security/schema -> quotation to manual payment vertical flow -> reliable billing -> Stripe -> supporting features and full UI -> hosted acceptance. Mathew integrates all migrations. Lea can use contract fixtures temporarily; final screens use real endpoints. Pranav builds server services against agreed contracts.

## Acceptance and operations

Test authorization/customer isolation, password/reset policies, lifecycle permissions, calendar/leap-year boundaries, concurrent billing/retries, financial rounding/discount usage races, partial payments, duplicate/invalid/delayed webhooks, checkout/manual-payment races, PDFs/email, and report reconciliation. Use node:test/tsx for backend tests (no Vite); browser tests may use Playwright. Target p95 under 2 seconds with 10,000 subscriptions/100,000 invoices and 20 concurrent users on documented hosted resources, excluding external provider delivery time.

Deploy same commit for web/worker; migrate once before workers start. Observe worker heartbeat, billing failures, pending reconciliation and email failures; admin retry controls. SMTP, Stripe test keys and hosting account are prerequisites. Synthetic data only in demo. Automatic card charging, refunds/credit notes, multi-company and jurisdiction-specific accounting compliance are outside v1.

## Progress

- Done: PDF review, repository baseline inspection and ownership agreement.
- Implemented by Mathew: Next.js runtime/contracts, PostgreSQL schema and seven applied migrations, signup/login/reset with local SMTP verification, roles/ownership, admin/staff provisioning, manual subscription snapshots, lifecycle/customer resume/renewal, persisted recurring invoices, invoice actions, partial recorded payments, durable worker/retries/heartbeat, and Stripe test-mode adapter/reservations/signed webhook reconciliation.
- Verification: 18 unit tests, PostgreSQL integration tests, TypeScript checks and live Next.js HTTP checks. Gateway provider calls are simulated; signatures/database transactions are real. See Mathew's latest log for final counts. No build or deployment has been run.
- Integrated catalog/plan/template references, server-priced quotations and expiry, product-specific discount allocation/atomic usage/restoration, real-data workspace/portal, customer/configuration/reporting screens and invoice email outbox. Printable invoices support the browser's Save as PDF. See personal logs for evidence.
- Supporting services now include normalized catalog/configuration, reconciled financial reports, leased email jobs and additive synthetic demo seed. Separate brightloop_demo contains 14 seeded accounts, 18 subscriptions and 90 invoices; browser checks create additional synthetic workflow records. Eight migrations are applied locally.
- Remaining acceptance: scheduled next-period quantity/add-on editing, automatic overdue reminders and PDF email attachments, actual external SMTP/Stripe checks, Docker image/release verification, hosting/DNS and performance acceptance. Local provider delivery tests are isolated; no hosted deployment is claimed.
- Render Blueprint is prepared and validated against the official schema. Hosting needs account/provider configuration; automatic deploys are disabled. No hosted resources have been created.
- Implementation evidence and remaining work: see personal handoffs. A passing unit test alone does not establish deployed or database-integrated completion.

## Initial API handoff

- `GET /api/health`: public process liveness; does not prove database readiness.
- `GET /api/ready`: public database connectivity readiness. Worker progress is a separate admin operation.
- `/api/auth/*`: Better Auth handlers for signup, login, sessions and password reset. Public signup always creates CUSTOMER.
- `GET /api/v1/me`: authenticated actor ID/role.
- `GET/POST /api/v1/customers`: staff/admin customer search and account provisioning; no password hashes returned. Configuration catalog lists/writes are under `/api/v1/catalog/{products|plans|templates|taxes|discounts}`; PUT `/:id` replaces an entry. Only admins mutate configuration.
- `GET /api/v1/reports?from=ISO&to=ISO`: staff/admin financial totals and monthly comparisons, upper date exclusive, maximum 366 days. Decimal strings preserve monetary precision.
- `POST /api/v1/invoices/:id/send`: staff/admin queues invoice delivery or retries a failed delivery; synthetic recipients are skipped. Delivery runs in the worker, requires SMTP and is visible through admin operations.
- `POST /api/v1/staff`: ADMIN only; name/email/password; safe user response without credentials.
- `GET /api/v1/subscriptions?page=1&pageSize=25`: staff/admin see business records, customers see only their own; response contains data and pagination.
- `POST /api/v1/subscriptions`: staff/admin catalog-backed drafts use planId, optional templateId and product/variant/quantity lines; the server resolves all prices/taxes. Manual snapshot input remains ADMIN only. Customers cannot create quotations or submit prices.
- `POST /api/v1/subscriptions/:id/actions`: staff/admin actions from `actionSchema`; customers can pause/resume/close their own subscriptions if plan permissions allow. Pause/active early closure run at the next boundary. Resume skips inactive periods and starts at the next remaining boundary.
- `POST /api/v1/subscriptions/:id/renew`: owner or staff/admin; ISO `expiresAt` extends the contract. Original-term billing must catch up before expired renewal; closed gaps are not charged. Renewals retain audit history.
- `POST /api/v1/subscriptions/:id/bill`: staff/admin generates one due period; the worker handles routine scheduling/catch-up.
- `GET /api/v1/invoices` and `GET /api/v1/invoices/:id`: customer-owned or internal views, status filters/pagination and server-calculated balances. `POST /:id/actions` supports CONFIRM/CANCEL for staff/admin; payments or online reservations block cancellation.
- `GET /api/v1/invoices/:id/payments`: scoped paginated payment history. `POST` is staff/admin recorded payment with UUID `idempotencyKey`, decimal-string `amount`, method BANK_TRANSFER/CASH/CARD/OTHER, optional ISO `paidAt`, note and externalReference.
- `POST /api/v1/invoices/:id/checkout`: scoped invoice balance checkout, UUID `idempotencyKey` only; amount is server-calculated. Redirect only on OPEN. `GET` returns the latest owned attempt plus reconciliation state. The success/cancel path is `/portal/invoices/:id`; a success query never establishes payment.
- `POST /api/webhooks/stripe`: raw signed Stripe events; no cookie/Origin requirement. Test mode only. Pending reservations persist across uncertain responses and clear on verified terminal outcomes. Unexpected receipts remain separately recorded and visible for manual review.
- `GET /api/v1/operations/billing`: admin heartbeat, billing failures, pending checkouts and receipt exceptions. `POST` with subscriptionId resets a billing retry. No exception-resolution/refund endpoint exists yet.
- Cookie-authenticated mutations require an explicitly trusted Origin. Production trusts the canonical BETTER_AUTH_URL and configured exact additional origins; development adds same-port loopback aliases. Errors use `{error: {code, message, fields?}}`; validation is 422, forbidden 403, missing/inaccessible resources 404 and conflicts 409.

## Cross-team integration next

Catalog, quotation, discount and outbox models are now integrated. Staff creation resolves current catalog prices on the server; manual prices remain admin-only. Stable product/variant references preserve snapshots, discounts allocate before tax to eligible lines, and usage/cancellation restoration execute within serializable financial transactions. Preserve those boundaries in future changes.

Invoice generation enqueues durable email jobs in the invoice transaction. The worker claims leases and sends outside financial transactions, with bounded retries and synthetic-recipient skipping. SMTP delivery is at least once: a process crash after provider acceptance can duplicate delivery; a stable Message-ID aids deduplication. Lea owns document presentation/forms. Public release still needs actual provider verification, deployment and the scale benchmark.
