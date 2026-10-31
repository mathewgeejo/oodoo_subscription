# Brightloop Subscription Management

Next.js/React/TypeScript with PostgreSQL and a separate billing worker. No Vite.

Read [the shared plan](docs/PROJECT_PLAN.md) and your handoff: [Mathew](docs/MATHEW.md), [Lea](docs/LEA.md), [Pranav](docs/PRANAV.md).

## Development

Requires Node.js 22 and PostgreSQL. Run `npm ci`, copy `.env.example` to `.env`, configure values, then `npm run db:generate` and `npm run db:migrate`. Start with `npm run dev`.

If Docker is available, `docker compose up -d` provides local PostgreSQL and a Mailpit inbox at http://localhost:8025. Initial migrations and billing concurrency tests have also been verified on a temporary PostgreSQL 17.11 instance without Docker.

For integration tests, create a dedicated database whose name ends in `_test`, migrate it, set both `DATABASE_URL` and `TEST_DATABASE_URL` to that database, and run `npm run test:integration`. The test runner refuses mismatched URLs or a database without the test suffix. Fixtures are synthetic and uniquely named; never point this command at production.

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and optionally `ADMIN_NAME` temporarily, then run `npm run admin:bootstrap` to create the first administrator after migrating. This command refuses a second bootstrap. Remove the password afterward. Staff are created through the admin-only API, not public registration.

`GET /api/health` is process liveness, not database readiness. Use `npm test` and `npm run typecheck` for verification. Do not run routine builds. Never commit credentials. The initial page is a runtime placeholder for Lea's UI; Mathew's handoff tracks backend implementation and limitations.
