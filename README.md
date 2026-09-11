# surviver

A promotional tournament for SaaS products. 32 enter, one survives.

Products pay a flat entry fee for a slot on a discovery board. Visitors browse,
and the products they actually choose to visit earn a measured Interest Rate.
Timed rounds eliminate the lowest ranked until one is left. Placement is paid;
rank is earned and cannot be bought.

## Stack

Next.js 16 (App Router) · React 19 · Prisma 7 with the `pg` driver adapter ·
PostgreSQL · Tailwind CSS 4.

## Local development

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL
npm run db:migrate
npm run dev
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src`, `prisma`, `prisma.config.ts` |
| `npm test` | Node test runner over `tests/` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Seed sample season data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:check` | Check development database credentials and Season table access |

If Prisma reports an authentication failure, run `npm run db:check`. Replace
`DATABASE_URL` with the current connection string for your database, then restart
`npm run dev`. Check `.env.local` and shell environment variables too: they can
override `.env`. The checker uses the same environment precedence as Next dev.

A hydration warning showing an extra `__processed_...` attribute on `<body>`
indicates HTML was modified outside this component. Retry with browser extensions
disabled. For a separate `200.js` / `M_ID` error, inspect the script's full URL in
DevTools; a `chrome-extension://` or `moz-extension://` URL identifies the extension
that needs disabling or updating.

## Deploying to Render

Create a **Web Service** pointed at this repo, or use the committed
`render.yaml` blueprint. Settings:

- **Build command:** `npm ci && npx prisma migrate deploy && npm run build`
- **Start command:** `npm run start`
- **Node version:** 22 (set via the `NODE_VERSION` environment variable)

`prisma generate` runs automatically through the `postinstall` hook, and
`migrate deploy` applies pending migrations before the new build goes live.

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Yes** | Postgres connection string. No default — the app fails fast without it. |
| `APP_URL` | **Yes in production** | Public origin, no trailing slash, e.g. `https://surviver.onrender.com`. Rally and share links are built from it. Defaults to `http://localhost:3000`. |
| `IP_HASH_SALT` | **Yes in production** | Salt for hashing visitor IPs; raw addresses are never stored. Changing it resets visitor de-duplication. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `CRON_SECRET` | **Yes in production** | Shared secret the scheduled round-transition job must present to `/api/cron/rounds`. |
| `PAYMENT_PROVIDER` | No | `dev` simulates checkout and charges nothing. Leave as `dev` until a real provider is wired up. |
| `SHADOW_DATABASE_URL` | No | Local `prisma migrate dev` only. Never set this in production. |

`NODE_ENV` is set to `production` by Render automatically.

### Supabase connection string

Supabase offers three connection strings under **Project Settings → Database →
Connection string**. For a long-running Node server on Render, use the
**Session pooler** — it is IPv4-compatible (Render does not provide IPv6
egress on all plans) and works for both runtime queries and `migrate deploy`:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

If you would rather assemble it from the discrete fields Supabase shows, the
shape is:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Prisma needs a single URL, so there is no way to supply host, user and password
as separate variables. If the password contains `@`, `:`, `/` or `?`,
percent-encode it (for example `@` becomes `%40`).

### Scheduled rounds

Rounds close on a timer. Add a Render **Cron Job** (or any scheduler) that
calls the transition endpoint with the shared secret:

```bash
curl -fsS -X POST https://<your-app>/api/cron/rounds \
  -H "Authorization: Bearer $CRON_SECRET"
```

Without it, rounds stay open until an administrator processes them from `/admin`.
