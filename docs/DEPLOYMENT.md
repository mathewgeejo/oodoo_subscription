# Deploy on mathewgeejo.dev

The repository includes one Docker image for web and worker, PostgreSQL 17, and Caddy for HTTPS. Docker Engine with the Compose plugin must be installed on the Linux server. The local Windows environment has no Docker runtime, so the image has not been built here. TypeScript, migrations and application workflows are verified separately; no local production build was run.

1. Point the domain's DNS A record to your server's public IPv4 address. Add AAAA only if IPv6 is configured. Open TCP 80/443 (and optionally UDP 443). Remove conflicting web servers from these ports.
2. Clone this repository and copy `.env.production.example` to `.env.production`. Generate two different secrets with `openssl rand -hex 32` for `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`. Use hex for the database password so the connection URL needs no escaping. Set a strong, unique `DEMO_SEED_PASSWORD` if using demo accounts. Keep this file on the server and out of Git.
3. Start the application:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml up -d --build
   docker compose --env-file .env.production -f compose.production.yaml logs --tail=100 web worker caddy
   ```

   Web applies migrations before starting. Worker waits for the web database readiness check. Only Caddy publishes network ports; PostgreSQL and Next.js are private within Compose. Caddy obtains and renews certificates once DNS and ports are reachable. See [Caddy's HTTPS requirements](https://caddyserver.com/docs/automatic-https).

4. Choose one initialization path:

   For a demonstration installation, populate synthetic data explicitly:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml exec -e ALLOW_DEMO_SEED=true web npm run db:seed
   ```

   Sign in at `https://mathewgeejo.dev/login` with `admin@brightloop.example`, `billing@brightloop.example`, or `northstar@brightloop.example` and your `DEMO_SEED_PASSWORD`. The seed adds stable demo records without truncating or changing existing records. Running it again preserves existing passwords and financial records. Demo email addresses use the reserved `.example` domain. Change demo account passwords through My account before sharing access. Do not seed a real customer installation.

   For a real installation, leave demo data out. Set `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` temporarily in the server environment file, then run:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml run --rm web npm run admin:bootstrap
   ```

   Remove those bootstrap variables afterward. Public registration creates customer accounts; administrators create staff in My account.

5. Configure SMTP for password reset and invoice delivery. Configure Stripe test keys and add the signed webhook endpoint `https://mathewgeejo.dev/api/webhooks/stripe`. The application accepts test-mode payments. No real SMTP host or Stripe account has been configured/verified in this workspace.

For another hostname, change `APP_DOMAIN` and `BETTER_AUTH_URL` together. Extra browser origins require explicit `BETTER_AUTH_TRUSTED_ORIGINS`; no wildcard is needed. Keep one canonical hostname to avoid split sessions.

## Updates and backups

Pull the latest main branch, then repeat `up -d --build`. Web and worker use the same built image. For schema-changing updates, stop the worker first (`docker compose --env-file .env.production -f compose.production.yaml stop worker`), then run the update command. Review migrations and back up the database before upgrades. Do not remove named volumes when updating.

```sh
docker compose --env-file .env.production -f compose.production.yaml exec -T db pg_dump -U brightloop -d brightloop -Fc > brightloop.dump
```

Store backups off the server and verify restore on a separate database. `/api/health` checks the process; `/api/ready` checks PostgreSQL. The admin Operations screen/API exposes worker heartbeat and billing failures. Render remains an alternative using `render.yaml`; set its canonical auth URL to your domain and deploy matching web/worker commits.

## Local populated demo

Use Node 22 and PostgreSQL 17. Set `DATABASE_URL` to a database ending in `_demo`, `BETTER_AUTH_URL` to the exact browser URL, a random `BETTER_AUTH_SECRET`, and `DEMO_SEED_PASSWORD` in `.env.local`. Then run `npm ci`, `npm run db:generate`, `npm run db:migrate` (provide DATABASE_URL to the shell or use `.env`), `npm run db:seed`, and `npm run dev -- --port 3100`. The seed reads `.env.local` and `.env`; explicit process variables take priority. The current workspace already has a separate populated `brightloop_demo` database and ignored local configuration. Tests continue to use `brightloop_test`.
