# Lea — frontend agent handoff

Read PROJECT_PLAN.md first. Own all UI and frontend integration, the second-largest project responsibility. Mathew owns core backend/security; Pranav owns supporting business APIs. Check latest shared contracts before coding. Update this file with completed work, evidence, blockers and next tasks. Commit/push working features; do not run routine builds.

## Current state

Current implementation includes responsive auth/workspace/customer portal, subscription/invoice lists and details, account/staff forms, catalog management, customer management, quotation creation, reports and operations. These use real APIs and the populated demo database. Historical baseline notes below describe the initial work order. Remaining acceptance includes hosted providers, automatic reminders and the scale benchmark.

## Ordered work

1. Design system and responsive app shell: Tailwind, accessible reusable controls, navigation, tables, pagination, filters, dialogs, toasts and status badges.
2. Authentication screens: registration/login/reset/account, client validation matching server contracts, expired-link and rate-limit feedback.
3. Staff/admin screens: customers, products/variants, plans, templates, subscriptions and lifecycle actions.
4. Financial screens: invoice detail/list, printable PDF presentation, manual payments, discounts/taxes, payment history and balances.
5. Customer portal: own subscriptions/invoices, permitted pause/renew/close actions, PDF download, online Checkout and pending/failed/success states.
6. Reporting: charts/cards/date filters and drill-down tables using Pranav's report endpoints.
7. Integration/accessibility: real data, loading/empty/error/forbidden states, keyboard navigation, responsive layouts and browser workflow tests.

## Interfaces and acceptance

Own app pages/layouts/components/styles; coordinate shared root configuration with Mathew. Mathew owns /api/v1 core actions and /api/auth. Pranav owns catalog/configuration/report queries. Never implement a second billing calculator in the client or treat a redirect as verified payment. Browser role checks improve presentation only; server checks remain authoritative. No customer cost-price/internal audit exposure.

Final acceptance: complete admin/staff/customer workflows on desktop/mobile; no permanent fixtures or dead buttons; accessible labels/focus; API errors shown usefully; visible decimal amounts match server values. node:test/tsx is the backend test runner; use Playwright for browser testing without Vite.

## Progress log

- Final populated browser checks passed: real template quotation -> quote -> confirm -> activate -> invoice generation -> partial manual payment -> queued invoice email; tax-rule creation; mobile reports without horizontal overflow; customer-owned invoice isolation and denied cross-customer/report access. TypeScript, 24 unit tests and 26 PostgreSQL integration tests pass. No production build run.

- Added customer search/provisioning, product/variant/plan/template/tax/discount configuration forms, server-priced quotation composer, dated revenue/collection reports and admin operations. Populated browser navigation passed for every new page and real demo login. Browser mutation/customer-isolation checks are recorded in the final verification log.

- Implemented responsive workspace navigation, live dashboard, subscription/invoice lists and detail pages, account/password/staff forms, lifecycle actions, manual payments, Checkout states and printable invoice view. Browser checks passed for signup/login, real empty dashboard and mobile navigation; populated workflows are the next check. TypeScript and 24 unit tests pass. No build run.
- Latest priority: finish usable workflows quickly, connect normalized catalog and reporting, populate synthetic records and prepare mathewgeejo.dev deployment.

- Done: role and handoff agreed. No UI implementation completed at baseline.
- Historical frontend-first checkpoint: auth/design/workspace shell passed initial empty-data browser checks. The catalog draft stash was subsequently restored and integrated; do not reapply it. New commits/pushes must authenticate as pranavpk-05 and use its linked noreply identity; preserve previous history.
- Origin fix: localhost/127.0.0.1/IPv6 loopback aliases now share an exact same-port development policy in authentication and business mutations. Production origins remain explicit. Browser signup/login succeeded on both localhost and 127.0.0.1; six targeted security tests and typecheck passed. Latest priority is quick functional completion, database integration, dummy data and deployment on mathewgeejo.dev.
- Shared backend includes auth, subscriptions, invoices, payments, catalog configuration, customers, reports and queued delivery. The frontend connects these APIs; use the verification entries above for current status. Stripe provider calls remain simulated until real keys are configured. The local design/workflows are implemented; no hosted site is claimed.

## Interfaces to preserve and remaining frontend work

- Preserve the responsive app shell, auth screens, real lists/detail views, customer/configuration/quotation forms, report dates and operations visibility. Shared visual components are in src/components; do not replace them with placeholder dashboards.
- `/reset-password` and `/portal/invoices/[id]` are implemented. Preserve reset-token and Checkout pending/exception behavior. Request reset using a same-origin redirectTo; redirect to Checkout only when OPEN supplies a URL. Use a fresh UUID per new payment attempt and retain it for retries.
- Subscription actions expose plan permissions. Resume skips paused periods; renewal may report BILLING_PENDING until original-term invoices catch up. Show server validation/conflict messages and refresh the record rather than pretending an action succeeded.
- Recorded payment creation is staff/admin only. Customer portal payment uses Checkout. Amounts are decimal strings; format them without losing cents through Number conversion on large values. Never trust URL success parameters or calculate authoritative tax/discount/balance in the browser.
- Customer search/provisioning, catalog-backed quotations, tax/discount forms, printable invoices, queued Send invoice and reports are connected. Customer profile editing by staff, attached PDFs and automatic overdue reminders are remaining extensions; coordinate their APIs before adding controls.
- Admin operations expose pending checkouts and unexpected receipts. Build visibility first; do not add a pretend exception-resolution/refund action because that endpoint does not exist.
