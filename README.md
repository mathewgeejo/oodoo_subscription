# Brightloop Subscription Management

Next.js/React/TypeScript with PostgreSQL and a separate billing worker. No Vite.

Read [the shared plan](docs/PROJECT_PLAN.md) and your handoff: [Mathew](docs/MATHEW.md), [Lea](docs/LEA.md), [Pranav](docs/PRANAV.md).

## Development

Requires Node.js 22 and PostgreSQL. Run `npm ci`, copy `.env.example` to `.env`, configure values, then `npm run db:generate` and `npm run db:migrate`. Start with `npm run dev`.

`GET /api/health` is process liveness, not database readiness. Use `npm test` and `npm run typecheck` for verification. Do not run routine builds. Never commit credentials. The initial page is a runtime placeholder for Lea's UI; Mathew's handoff tracks backend implementation and limitations.
