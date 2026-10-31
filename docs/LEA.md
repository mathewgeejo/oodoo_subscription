# Lea — frontend agent handoff

Read PROJECT_PLAN.md first. Own all UI and frontend integration, the second-largest project responsibility. Mathew owns core backend/security; Pranav owns supporting business APIs. Check latest shared contracts before coding. Update this file with completed work, evidence, blockers and next tasks. Commit/push working features; do not run routine builds.

## Current state

Baseline 2026-10-31: no frontend existed. Planning is complete; every task below is Not started. Mathew may create a minimal application landing page only to establish the runtime; replace it with the agreed product UI.

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

- Done: role and handoff agreed. No UI implementation completed at baseline.
- Shared backend now available from Mathew: authenticated roles/session, reset email flow, subscription lists/drafts/actions/renewals, invoices/balances/payment history, recorded payment actions, Stripe checkout/status, and admin billing/payment operations. Read PROJECT_PLAN.md's API handoff; all frontend tasks above remain Not started.
- Current verification: backend unit/integration tests use PostgreSQL 17 and a local SMTP receiver, plus live Next.js API smoke checks. Stripe provider calls are simulated until keys are configured. No hosted site or finished design exists.

## Concrete next frontend steps

- Start with app shell/auth, then real invoice lists/details and subscription views. Keep API route handlers in Mathew/Pranav ownership. The placeholder homepage may be replaced; no existing design system needs preserving.
- Implement `/reset-password` for reset-token form submission and `/portal/invoices/[id]` for Stripe return URLs. Request a reset using a same-origin redirectTo. After checkout, poll invoice/checkout status; display pending/exception states and redirect only when the attempt is OPEN with a URL. Use a fresh UUID per new payment attempt and retain it for retries.
- Subscription actions expose plan permissions. Resume skips paused periods; renewal may report BILLING_PENDING until original-term invoices catch up. Show server validation/conflict messages and refresh the record rather than pretending an action succeeded.
- Recorded payment creation is staff/admin only. Customer portal payment uses Checkout. Amounts are decimal strings; format them without losing cents through Number conversion on large values. Never trust URL success parameters or calculate authoritative tax/discount/balance in the browser.
- Customer search/detail editing, catalog-backed staff quotations, invoice PDF/download/send and discount configuration/report APIs still need backend coordination. Temporary contract fixtures can unblock layout, but do not mark those flows complete until their real endpoints exist.
- Admin operations expose pending checkouts and unexpected receipts. Build visibility first; do not add a pretend exception-resolution/refund action because that endpoint does not exist.
