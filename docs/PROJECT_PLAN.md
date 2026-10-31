# Subscription Management System

## Agent instructions and current state

Read this file and your personal handoff before implementation. Implement only your assigned area; coordinate interface/schema changes through Mathew. Preserve other contributors' work. Do not run builds unless the user asks or there is evidence of a build error. Commit and push every verified working feature; aim for at least seven meaningful checkpoints per working hour. Never commit secrets, failing features, or fabricated progress.

Baseline inspected 2026-10-31: repository contained only README.md and the initial commit. The requirements PDF was reviewed. No application existed. Personal handoffs track subsequent progress with evidence. Statuses: Not started, In progress, Blocked, Done.

## Architecture

Next.js App Router, React, TypeScript, PostgreSQL, Prisma, Tailwind CSS and Better Auth; no Vite. One web application and a separate durable billing worker. Render hosts web, worker and PostgreSQL. SMTP delivers email; Stripe test Checkout collects invoice balances. Single business, INR by default, Asia/Kolkata business timezone, UTC timestamps. Pin compatible dependencies and commit the lockfile.

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
- Implementation evidence and remaining work: see personal handoffs. A passing unit test alone does not establish deployed or database-integrated completion.
