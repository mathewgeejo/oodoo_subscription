# Brightloop Subscription Management

A subscription and billing workspace built with Next.js, React, TypeScript, Better Auth, Prisma and PostgreSQL 17. Customers manage their own subscriptions and invoices; administrators and staff handle quotations, billing and payments. A separate worker runs recurring billing and payment reconciliation.

The application includes a responsive customer portal, server-priced quotations, recurring invoices, partial payments, configuration screens and financial reports. Read [the shared plan](docs/PROJECT_PLAN.md) and your handoff: [Mathew](docs/MATHEW.md), [Lea](docs/LEA.md), [Pranav](docs/PRANAV.md).

## Development

Requires Node.js **22.14 or newer within 22.x**, npm and PostgreSQL **17**.

```sh
npm ci
cp .env.example .env
```

On PowerShell use `Copy-Item .env.example .env`. Set `DATABASE_URL` to your PostgreSQL database, `BETTER_AUTH_URL` to the exact browser address (such as `http://localhost:3000`) and `BETTER_AUTH_SECRET` to a random secret of at least 32 characters. Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

```sh
npm run db:generate
npm run db:migrate
npm run dev
```

Set the auth URL to the port you actually use. Development accepts same-port localhost/127.0.0.1 aliases. Extra deployment origins require explicit `BETTER_AUTH_TRUSTED_ORIGINS` entries.

If Docker is available, `docker compose up -d` provides local PostgreSQL and a Mailpit inbox at http://localhost:8025. Initial migrations and billing concurrency tests have also been verified on a temporary PostgreSQL 17.11 instance without Docker.

For integration tests, create a dedicated database whose name ends in `_test`, migrate it, set both `DATABASE_URL` and `TEST_DATABASE_URL` to that database, and run `npm run test:integration`. The test runner refuses mismatched URLs or a database without the test suffix. Fixtures are synthetic and uniquely named; never point this command at production.

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optionally `ADMIN_NAME` temporarily, then run `npm run admin:bootstrap` to create the first administrator after migrating. This command refuses a second bootstrap. Remove the password afterward. Staff are created through the admin-only API, not public registration.

`GET /api/health` checks the process; `/api/ready` checks database connectivity. Use `npm test` and `npm run typecheck` for verification. Do not run routine builds. Never commit credentials. The responsive workspace connects to real subscription, invoice, account and payment APIs. The customer portal includes permitted lifecycle actions, Checkout status and printable invoices; use the browser print dialog to save an invoice as PDF.

The normalized catalog includes products, archived variants, plans, taxes and templates. Quotations snapshot server-resolved prices and terms; discounts apply to eligible lines before tax and consume usage atomically. Customer management, catalog forms, quotation creation, reports and operations use real APIs. Invoice email queues use the worker with retries and skip demo addresses; external SMTP delivery and hosted Stripe Checkout still require provider configuration and verification.

Run `npm run worker` as a separate process for recurring billing. It polls durable due dates every five seconds, retries failures with persisted backoff, and records a heartbeat. Admins inspect failures or request retries at `/api/v1/operations/billing`. Stop the development server before running `db:generate` on Windows because its loaded Prisma engine can lock the DLL.

For online payment, configure `STRIPE_SECRET_KEY` with a test key and `STRIPE_WEBHOOK_SECRET`, then register `/api/webhooks/stripe` for Checkout completion, asynchronous success/failure and expiry events. POST `/api/v1/invoices/:id/checkout` with a UUID `idempotencyKey`. Only an OPEN result supplies a redirect URL; the return page must fetch the invoice to establish payment status. The worker reconciles uncertain/missed results. Pending or exceptional checkouts block recorded payments and cancellation until reconciliation; never bypass a hold based only on elapsed time. Admin operations expose unexpected receipt records for review. Provider API calls are simulated in tests. Actual hosted Checkout still needs account verification.

## Populate the demo

Create a separate database named `brightloop_demo` and point `DATABASE_URL` at it. Add a strong `DEMO_SEED_PASSWORD` to your local environment file.

```sh
npm run db:migrate
npm run db:seed
```

The seed reads `.env.local` and `.env`; explicit shell variables take priority. Prisma's CLI reads `.env`, so provide `DATABASE_URL` in the shell when using only `.env.local`.

| Records       | Included                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| Accounts      | 1 administrator, 1 staff member, 12 customers                                                                     |
| Catalog       | 3 products, Odoo variant with a 560 surcharge, 3 plans, 18% tax, quotation template and inactive example discount |
| Subscriptions | 18 across active, paused, closed, draft, quotation and confirmed states                                           |
| Invoices      | 90 with paid, partial, unpaid, overdue, draft and cancelled examples                                              |
| Payments      | Synthetic cash and bank-transfer records; no funds move                                                           |

Sign in with your configured `DEMO_SEED_PASSWORD`:

| Role          | Email                          |
| ------------- | ------------------------------ |
| Administrator | `admin@brightloop.example`     |
| Staff         | `billing@brightloop.example`   |
| Customer      | `northstar@brightloop.example` |

The seed is additive and repeatable: stable IDs prevent duplicates, existing records are retained and existing passwords are not reset. It requires a database name ending in `_demo`; any other database requires explicit `ALLOW_DEMO_SEED=true`. Keep synthetic data separate from real customers. Passwords and local environment files are excluded from Git.

To see sample records while signed in with your own customer account, set `DEMO_CUSTOMER_EMAIL` to that existing account's email in your local environment file and run `npm run db:seed` again. This adds 7 subscriptions and 24 invoices to that customer's portal, including paid, partially paid, overdue and cancelled examples. It keeps the customer's role, password and existing records unchanged. Invoice email snapshots use reserved demo addresses. Other customer accounts continue to see only their own records.

This workspace already has a populated local demo configured for `http://localhost:3100`. Its generated password is in the ignored `.env.local` file as `DEMO_SEED_PASSWORD`.

## Deploy on mathewgeejo.dev

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for DNS, secrets, backups and updates. The production Compose configuration includes PostgreSQL, web, worker and Caddy HTTPS. Point the domain to your server, copy `.env.production.example` to `.env.production`, and replace the secret placeholders.

```sh
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

To populate that server with the demo:

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -e ALLOW_DEMO_SEED=true web npm run db:seed
```

Web applies migrations before startup; worker waits for database readiness. Named database/certificate volumes persist across updates. Docker is unavailable in this Windows environment, so the production image has not been built or deployed here. No routine local production build has been run. The database design is documented in [docs/DATABASE.md](docs/DATABASE.md).

For a real installation, skip demo seeding and bootstrap the first administrator using temporary `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` values. Remove the password afterward. Public registration creates customers; administrators create staff in My account.

`render.yaml` defines a Node 22 web service, separate worker and private PostgreSQL 17 database in Singapore. It has not been deployed. Create the Blueprint in your Render account and provide the prompted public HTTPS application URL, SMTP credentials, Stripe test key and webhook secret. These plans allocate paid resources only when you provision them; no hosted resources have been created during implementation.

Automatic deploys are disabled so frequent feature pushes do not trigger builds. When ready to publish, manually deploy the web service, let its pre-deploy migration finish, and deploy the worker from the same commit. Bootstrap the administrator in the web service shell with temporary environment values. Check `/api/health`, `/api/ready`, signup/login/reset, admin billing operations and an actual Stripe test Checkout before calling the hosted demo verified. Ensure the hosting proxy supplies trustworthy client IP headers for authentication rate limits.

The hosting build is a release step. A failed migration must stop that release. Roll back web and worker together only to a schema-compatible version that enforces payment reservations. Provider verification, invoice delivery and the 10,000-subscription performance benchmark remain acceptance work tracked in the team handoffs.

## Email and payments

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` and optional `SMTP_USER` / `SMTP_PASSWORD` for reset emails. Mailpit captures local email without sending it externally. Production payment configuration is described above: use Stripe test keys, verified webhook signatures and server-calculated balances. The application owns recurring billing and does not create Stripe subscriptions.

## Project documentation

- [Shared project plan](docs/PROJECT_PLAN.md)
- [Mathew: core platform and financial execution](docs/MATHEW.md)
- [Lea: frontend and customer portal](docs/LEA.md)
- [Pranav: catalog, reports, notifications and demo data](docs/PRANAV.md)
- [Database design](docs/DATABASE.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
