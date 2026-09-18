# Surviver — Render Deployment Guide

The Supabase database is fully provisioned. `npx prisma migrate deploy` runs as
part of the build command below, so pending migrations are applied on deploy.
Follow the steps below to finish deployment on Render.

## 1. Render Web Service — exact settings

Go to <https://dashboard.render.com/>, click **New + → Web Service**, and pick
the GitHub repo `Rounit002/surviver`.

| Field | Value |
| --- | --- |
| Name | `surviver` |
| Region | `Oregon (US West)` — same as the Supabase project |
| Branch | `main` |
| Runtime | `Node` |
| Build command | `npm ci && npx prisma migrate deploy && npm run build` |
| Start command | `npm run start` |
| Health check path | `/` |
| Instance type | `Starter` |
| Auto-deploy | `Yes` |

The `render.yaml` in the repo already declares `DATABASE_URL` as a sync env
var (so you can paste a placeholder and overwrite in the UI), and the two
secrets with `generateValue: true` — but Render blueprints are one-shot, so
the cleanest path is to set every env var manually on the service.

## 2. Environment variables (paste these into Render)

Add each of the following in **Environment**. Mark every value **Secret**
except `NODE_VERSION` and `PAYMENT_PROVIDER`.

| Key | Value | Secret |
| --- | --- | --- |
| `NODE_VERSION` | `22` | no |
| `PAYMENT_PROVIDER` | `dodo` | no |
| `DATABASE_URL` | obtain a newly rotated connection string from Supabase | yes |
| `APP_URL` | `https://surviver.lol` | no |
| `IP_HASH_SALT` | generate a new 32-byte random value | yes |
| `CRON_SECRET` | generate a new 32-byte random value | yes |
| `SECURITY_SECRET` | generate a separate 32-byte random value | yes |
| `DODO_PAYMENTS_*` | configure live API, webhook, product, business, and environment values | yes |
| `RESEND_API_KEY`, `EMAIL_FROM` | configure verified email delivery | yes |

> Rotate the database and cron credentials that were previously written in this
> document before deploying. Do not paste credentials into repository files.

### 2a. Dodo Payments setup

Do this in the Dodo dashboard before the first real entry.

1. **Product** — create a *one-time* product priced **exactly $29.00 USD**, to
   match the season's `entryPriceCents` (2900) and `currency` (`usd`). Copy its
   `pdt_...` id into `DODO_PAYMENTS_PRODUCT_ID`.
2. **API key** — Developer → API Keys. Use a *live* key and set
   `DODO_PAYMENTS_ENVIRONMENT=live_mode` (the preflight refuses to start
   otherwise in production).
3. **Webhook** — point a new endpoint at
   `https://surviver.lol/api/webhooks/dodo` and subscribe to
   `payment.succeeded`, `payment.failed`, `payment.cancelled` and
   `refund.succeeded`. Copy the signing secret (`whsec_...`) verbatim into
   `DODO_PAYMENTS_WEBHOOK_KEY`.
4. **Business id** — copy it into `DODO_PAYMENTS_BUSINESS_ID`; webhooks from any
   other business are ignored.

> The product price must track the season price. Payment is only fulfilled when
> the webhook's `total_amount` and `currency` equal the local payment exactly;
> a mismatch parks the event in `NEEDS_REVIEW` **after the founder has been
> charged**. Change both together, or not at all.

## 3. First deploy

1. Click **Create Web Service**. Render will:
   - `npm ci` (installs deps + runs `prisma generate`)
   - `npx prisma migrate deploy` (will be a no-op since migrations are already applied)
   - `npm run build` (Next.js production build)
   - Boot the Node service with `npm run start`
2. Watch the build log. If anything fails, paste the error back and I'll fix
   it in the code.
3. When the service is `Live`, copy the onrender URL from the dashboard
   (e.g. `https://surviver.onrender.com`).
4. Edit the service, paste the URL into `APP_URL`, save, then trigger one
   more manual deploy. After this second deploy, Rally and share links will
   point to the real hostname.

## 4. Scheduled rounds (optional)

Rounds advance on a timer. Add a Render **Cron Job** (free):

- Name: `surviver-rounds`
- Schedule: `*/5 * * * *`
- Command: configure the cron job with its secret environment variable and send
  `Authorization: Bearer <rotated CRON_SECRET>` without storing the value here.

## 5. After the service is Live — share the URL with me

Once `https://surviver.onrender.com` (or whatever Render assigned) returns
the landing page, paste that URL in this chat. I will then:

1. Smoke test the landing page, board, signup, login, dashboard, and all
   public routes (`/how-it-works`, `/rules`, `/seasons`, `/survivors`,
   `/leaderboard`).
2. Reload any client-side route directly to confirm the SPA fallback works.
3. Check the browser console and network tab for errors.
4. Run the `/api/cron/rounds` endpoint once with the cron secret to make
   sure round transitions work end-to-end.
5. Report the full results.

## Files already in place

- `D:\SurvierLOL\.env` — your local `.env` is pointing at the live Supabase
  database so you can run `npm run dev` against real data.
- `tsconfig.json` — excludes `src/generated` so `next build` doesn't hang
  parsing Prisma's 4.5 MB base64 WASM blob (committed as `99214c7`).
- `DEPLOY_NOW.md` — this file.
- `scripts/set-env.cjs` — used to write the new `.env`; safely tucked into
  `.local-backups/` so it won't be committed.
