# Brightloop Subscription Management

Next.js/React/TypeScript with PostgreSQL and a separate billing worker. No Vite.

Read [the shared plan](docs/PROJECT_PLAN.md) and your handoff: [Mathew](docs/MATHEW.md), [Lea](docs/LEA.md), [Pranav](docs/PRANAV.md).

## Development

Requires Node.js 22 and PostgreSQL. Run `npm ci`, copy `.env.example` to `.env`, configure values, then `npm run db:generate` and `npm run db:migrate`. Start with `npm run dev`.

If Docker is available, `docker compose up -d` provides local PostgreSQL and a Mailpit inbox at http://localhost:8025. Initial migrations and billing concurrency tests have also been verified on a temporary PostgreSQL 17.11 instance without Docker.

For integration tests, create a dedicated database whose name ends in `_test`, migrate it, set both `DATABASE_URL` and `TEST_DATABASE_URL` to that database, and run `npm run test:integration`. The test runner refuses mismatched URLs or a database without the test suffix. Fixtures are synthetic and uniquely named; never point this command at production.

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optionally `ADMIN_NAME` temporarily, then run `npm run admin:bootstrap` to create the first administrator after migrating. This command refuses a second bootstrap. Remove the password afterward. Staff are created through the admin-only API, not public registration.

`GET /api/health` is process liveness, not database readiness. Use `npm test` and `npm run typecheck` for verification. Do not run routine builds. Never commit credentials. The initial page is a runtime placeholder for Lea's UI; Mathew's handoff tracks backend implementation and limitations.

Run `npm run worker` as a separate process for recurring billing. It polls durable due dates every five seconds, retries failures with persisted backoff, and records a heartbeat. Admins inspect failures or request retries at `/api/v1/operations/billing`. Stop the development server before running `db:generate` on Windows because its loaded Prisma engine can lock the DLL.

For online payment, configure `STRIPE_SECRET_KEY` with a test key and `STRIPE_WEBHOOK_SECRET`, then register `/api/webhooks/stripe` for Checkout completion, asynchronous success/failure and expiry events. POST `/api/v1/invoices/:id/checkout` with a UUID `idempotencyKey`. Only an OPEN result supplies a redirect URL; the return page must fetch the invoice to establish payment status. The worker reconciles uncertain/missed results. Pending or exceptional checkouts block recorded payments and cancellation until reconciliation; never bypass a hold based only on elapsed time. Admin operations expose unexpected receipt records for review. Provider API calls are simulated in tests; actual hosted Checkout still needs account verification.
