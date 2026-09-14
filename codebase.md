# Surviver.lol Codebase Reference

This is the working reference for understanding the repository in one pass. It describes what the code currently does, where it lives, and the remaining provider and security work.

Verified: 2026-09-08.

## 1. Product and current maturity

Surviver.lol is a promotional tournament for SaaS products. The product promise is “32 products enter. One survives.” Founders pay a flat entry fee, submit a product listing, receive review, and (after approval) compete through timed rounds. Visitors browse a discovery board and outbound clicks are recorded as measured interest.

The repository is a functional vertical slice with:

- public landing, board, leaderboard, season archive, and survivor pages;
- founder entry, metadata prefill, guest campaign links, signup/login, and dashboard views;
- explicit development-only checkout simulation;
- admin review and season controls with an audit log;
- qualified-impression, click, Rally, ranking, and exposure-balancing logic;
- transactional round advancement and a protected scheduler endpoint;
- Prisma schema and migrations for the competition and payment event model.

The tournament engine is executable end to end with the simulated payment provider. A real Dodo Payments adapter, signed webhook route, and refund execution remain future integration work.

## 2. Technology and project configuration

| Area | Current implementation |
|---|---|
| Web framework | Next.js `16.3.4`, App Router, Turbopack build |
| UI | React `19.2.8`, TypeScript 5, JSX in `.tsx` |
| Styling | Tailwind CSS v4 via `@import "tailwindcss"` and `@theme` in `src/app/globals.css` |
| Database | PostgreSQL |
| ORM | Prisma `7.10.0` with `@prisma/adapter-pg` |
| Authentication | Custom database sessions, bcryptjs |
| Validation | Zod 4, declared directly in `package.json` |
| Runtime aliases | `@/*` maps to `src/*` in `tsconfig.json` |
| Request bootstrap | Next 16 `proxy` convention in `src/proxy.ts` |
| Generated output | `src/generated/prisma` from `prisma/schema.prisma` |

Top-level scripts in `package.json`:

```text
npm run dev          next dev
npm run build        next build
npm run start        next start
npm run lint         eslint src prisma prisma.config.ts
npm run typecheck    tsc --noEmit
npm run db:migrate   prisma migrate dev
npm run db:generate  prisma generate
npm run db:seed      tsx prisma/seed.ts
npm test             node --conditions=react-server --import tsx --test tests/*.test.ts
npm run db:studio    prisma studio
```

`next.config.ts` is currently the default empty configuration. `postcss.config.mjs` enables the Tailwind PostCSS plugin. `next-env.d.ts` and `tsconfig.tsbuildinfo` are generated/tooling files.

## 3. Repository map

### `src/app`

Next.js route tree and route-local actions.

- `layout.tsx`: root metadata, Poppins and Geist Mono fonts, global stylesheet, document shell.
- `globals.css`: color tokens, typography tokens, radii, responsive breakpoint, shadows, focus treatment, live pulse, reduced-motion rule.
- `proxy.ts`: visitor/session/Rally cookie assignment. It excludes static assets and image paths.
- `(site)/layout.tsx`: shared public `SiteHeader`, `<main>`, and `SiteFooter`.
- `(auth)/layout.tsx`: minimal auth shell with wordmark and board link.
- `global-error.tsx`, `(site)/error.tsx`, `not-found.tsx`: global, site-level, and not-found recovery UI.

### `src/app/(site)` pages

| URL | File | Behavior |
|---|---|---|
| `/` | `page.tsx` | Renders the compact entry hero, live discovery board, season progress, recent real activity, and product explanation. |
| `/board` | `board/page.tsx` | Reads current season + active round + standings, balances exposure by visitor, filters by `?category=`, and renders `ProductCard`s. Dynamic. |
| `/leaderboard` | `leaderboard/page.tsx` | Renders live rows ordered by rank, movement arrows, status chips, and a cut-line band. Dynamic. |
| `/seasons` | `seasons/page.tsx` | Lists seasons, winner if present, claimed capacity, dates, status, and detail links. Dynamic. |
| `/seasons/[number]` | `seasons/[number]/page.tsx` | Validates numeric season number, generates metadata, renders current/final standings, totals, and rounds. Dynamic. |
| `/survivors` | `survivors/page.tsx` | Lists `SURVIVOR` entries and final-round stats, or an empty state. Dynamic. |
| `/enter` | `enter/page.tsx` | Finds the earliest open season, computes remaining capacity, renders `EntryForm`, and shows a closed/full state otherwise. Dynamic. |
| `/entry/[token]` | `entry/[token]/page.tsx` | Secret capability-link campaign page. No indexing/referrer metadata. Shows pending, live, or eliminated campaign state. Dynamic. |
| `/dashboard` | `dashboard/page.tsx` | `requireUser`, then loads all entries owned by the user with payments and round stats. Dynamic. |
| `/admin` | `admin/page.tsx` | `requireAdmin`, then loads pending reviews, recent seasons, payment aggregates, and audit actions. Dynamic. |

### Route handlers

- `src/app/go/[slug]/route.ts`: reads an approved product, records an eligible `ClickEvent`, increments current non-finalized stats, and 302 redirects to the stored product URL.
- `src/app/api/impressions/route.ts`: validates same-origin qualified-view events and records eligible impressions.
- `src/app/api/cron/rounds/route.ts`: authenticates with `CRON_SECRET` and transactionally advances a due round.
- `src/app/rally/[code]/route.ts`: validates a Rally code and redirects to `/board?rally=<code>` so `proxy.ts` can persist attribution.
- `src/app/(site)/enter/checkout/[paymentId]/page.tsx`: development-only hosted-checkout stand-in. It permits access to the browser holding the pending-payment cookie, the payment owner, or an admin.
- `src/app/(site)/enter/checkout/[paymentId]/actions.ts`: development-only success/failure action that routes through `applyPaymentResult`.

There is no real payment webhook route yet. The `PaymentProvider.parseWebhook` interface and durable `PaymentEvent` records provide the integration seam for Dodo Payments.

## 4. Components

### Layout and brand

- `components/brand/Wordmark.tsx`: responsive text-only `surviver.lol` mark.
- `components/layout/SiteHeader.tsx`: server component; current-season ticker and category rail.
- `components/layout/CategoryBar.tsx`: client component; global category links and `/enter` CTA.
- `components/layout/SiteFooter.tsx`: disclosure and links to rules/legal pages.

### Competition and product display

- `components/competition/RoundBar.tsx`: round name/live badge, competing count, elimination count, countdown.
- `components/product/ProductCard.tsx`: compact discovery row with logo/monogram, category, interest rate, views, visits, status, impression instrumentation, and tracked product link.
- `components/product/ImpressionTracker.tsx`: records a view after at least 50% visibility for one second.
- `components/entry/QuickEntry.tsx`: hands the landing-page URL and category selection into the complete entry form.
- `components/entry/CampaignView.tsx`: shared founder-facing presentation for secret-link and authenticated views: `CampaignHeader`, `LiveCampaign`, `EliminatedReport`, `PendingState`.

### Form and UI primitives

- `components/entry/EntryForm.tsx`: client form with URL lookup, prefilled/editable product copy, category selection, live preview, rules checkbox, and server-action submit.
- `components/auth/CredentialsForm.tsx`: client form for signup/signin actions using `useActionState`.
- `components/ui/Button.tsx`: button, internal link, and outbound anchor variants.
- `components/ui/Field.tsx`: label, input, textarea, select, error, and notice primitives.
- `components/ui/Panel.tsx`: surface/panel primitives.
- `components/ui/Chip.tsx`: generic chip, competitive status chip, live badge, sponsored disclosure.
- `components/ui/Stat.tsx`: numeric stat and stat-row primitives.
- `components/ui/Countdown.tsx`: client-only timer corrected against server-render timestamp.

## 5. Domain libraries

### `src/lib/db.ts`

Creates a Prisma client with `PrismaPg` and `DATABASE_URL`. In development, the client is cached on `globalThis` to avoid opening a new pool during hot reloads. Production logs only errors; development logs errors and warnings.

### `src/lib/env.ts`

Lazy environment accessors:

- `databaseUrl`: required `DATABASE_URL`.
- `appUrl`: `APP_URL`, default `http://localhost:3000`, trailing slash removed.
- `ipHashSalt`: `IP_HASH_SALT`, development fallback `surviver-dev-salt`.
- `paymentProvider`: `PAYMENT_PROVIDER`, default `dev`.
- `cronSecret`: `CRON_SECRET`, development fallback `surviver-dev-cron`.
- `isProduction`: checks `NODE_ENV`.

### `src/lib/competition/constants.ts`

Centralizes:

- the ten accepted product categories, labels, and pastel tint/ink colors;
- public competitive-status labels, tones, chips, and descriptions;
- entry-status labels;
- the default six-round bracket: 32 → 24 → 16 → 8 → 4 → 2 → 1;
- cookie names for visitor, session, auth, Rally, and pending payment.

### `src/lib/competition/season.ts`

Server-only query helpers and status sets:

- `CLAIMED_ENTRY_STATUSES`: paid/occupied states used for capacity.
- `LIVE_ENTRY_STATUSES`: `ACTIVE` and `FINALIST`.
- `getCurrentSeason()`: running season first, then registration-open/closed, then newest season.
- `getOpenSeason()`: earliest-numbered registration-open season.
- `getSeasonSummary()`: claimed count, remaining capacity, full flag, accepting flag.
- `getActiveRound()` and `getSeasonRounds()`.

### `src/lib/competition/standings.ts`

Reads `ProductRoundStats` with nested entry/product/founder data into the UI-facing `StandingRow` shape. It computes whether a row is still collecting data from the season sample threshold and calculates the current survivor count from round elimination count.

`balanceForVisitor` orders underexposed entries first with a bounded Rally boost and deterministic visitor tie-breaking. `rankMovement` turns previous-vs-current rank into an up/down delta; ranking computation lives in `competition/scoring.ts`.

### `src/lib/tracking/visitor.ts`

Reads proxy-assigned cookies and request user-agent through Next headers/cookies. If cookies are absent, it returns `anonymous`; `isScorable` rejects anonymous contexts from scoring writes.

### `src/lib/tracking/events.ts`

Serializes scoring writes on the season, rejects obvious bot/headless agents, deduplicates qualified impressions and visits, requires a prior impression before a visit scores, classifies Rally traffic, awards bounded Rally points, and refreshes ranks atomically.

### `src/lib/competition/scoring.ts` and `engine.ts`

`scoring.ts` computes deterministic eligibility, interest rate, ranks, and danger-zone statuses. `engine.ts` starts a season, extends low-sample rounds, finalizes immutable statistics, eliminates entries, opens the next round, and crowns the survivor under a database season lock.

### `src/lib/auth/*`

- `password.ts`: bcrypt hash/compare at 12 rounds plus dummy compare.
- `session.ts`: random token creation, SHA-256 database ID, 30-day sliding sessions, cookie management, salted IP hashing, role helper.
- `guards.ts`: `requireUser` and `requireAdmin` server redirects.
- `actions.ts`: Zod-validated signup/signin/signout server actions with safe internal redirect handling.

### `src/lib/products/*`

- `site-metadata.ts`: URL normalization and hostile remote fetch protection; extracts title, description, OG image, and DuckDuckGo favicon URL.
- `actions.ts`: URL lookup action and entry creation action. It validates the form, selects an open season, checks capacity and duplicate destination URL, lazily upserts a user, creates product/entry/payment records, sets the pending-payment capability cookie, creates provider checkout, stores the provider payment ID, and redirects.

### `src/lib/payments/*`

- `types.ts`: provider-neutral checkout and webhook result types.
- `index.ts`: provider registry holding `dodo` and `dev`. Dev checkout points at `/enter/checkout/[paymentId]`; its webhook parser accepts JSON success/failure/refund payloads without real signature verification, so `getPaymentProvider()` throws rather than returning it whenever `NODE_ENV=production`.
- `access.ts`: constant-time check of the hashed, expiring checkout capability that authorizes the checkout page and action. Knowing a payment id is never sufficient.
- `fulfill.ts`: provider-scoped, idempotent payment fulfillment with durable event history, valid state transitions, settlement-time capacity checks, and refund validation.

### `src/lib/format.ts` and `src/lib/cn.ts`

`format.ts` owns number, interest-rate, money, countdown, date, relative-time, and hostname presentation. `cn.ts` is a deliberately small truthy class-name joiner; it does not merge Tailwind classes.

## 6. Data model reference

The Prisma schema contains these enums:

```text
Role: FOUNDER | ADMIN
ProductCategory: AI | DEV_TOOLS | PRODUCTIVITY | MARKETING | DESIGN |
                 FOUNDER_TOOLS | AUTOMATION | NO_CODE | ANALYTICS | CREATOR
ApprovalStatus: DRAFT | PENDING | APPROVED | REJECTED | CHANGES_REQUESTED
SeasonStatus: DRAFT | REGISTRATION_OPEN | REGISTRATION_CLOSED | RUNNING |
              COMPLETED | CANCELLED
EntryStatus: AWAITING_PAYMENT | AWAITING_APPROVAL | REJECTED | UPCOMING |
             ACTIVE | ELIMINATED | FINALIST | SURVIVOR | DISQUALIFIED | WITHDRAWN
RoundStatus: PENDING | ACTIVE | FINALIZING | COMPLETED
CompetitiveStatus: COLLECTING_DATA | SAFE | RISING | DANGER |
                   ELIMINATION_ZONE | ELIMINATED | FINALIST | SURVIVOR
SourceType: DISCOVERY | RALLY | RALLY_SELF
PaymentStatus: PENDING | SUCCEEDED | FAILED | REFUNDED |
               PARTIALLY_REFUNDED | CANCELLED
```

Relationship summary:

```text
User 1─* Product 1─* SeasonEntry *─1 Season
User 1─* Session
User 1─* Payment *─1 Season
Season 1─* Round
Round 1─* ProductRoundStats *─1 SeasonEntry
SeasonEntry 1─* ImpressionEvent *─1 Round
SeasonEntry 1─* ClickEvent *─1 Round
SeasonEntry 1─* RallyVisitor
User 1─* AdminAction
SeasonEntry/Round 1─* ActivityEvent (optional foreign keys)
```

Indexes and uniqueness constraints protect common lookup paths: user email, product slug, season number, one entry per product per season, one stats row per entry per round, Rally code, one Rally visitor per referring entry/visitor, one payment per entry, provider/payment ID, and event query dimensions.

## 7. End-to-end behavior details

### Entry creation

1. `EntryForm` optionally calls `lookupSiteAction` on blur or Fetch.
2. The lookup fetches only public HTTP(S) hosts and returns bounded metadata.
3. `createEntryAction` requires the rules checkbox and validates name, tagline, description, category, URL, and lowercase email.
4. It selects the lowest-numbered open season and counts only `CLAIMED_ENTRY_STATUSES` toward capacity.
5. It rejects a duplicate destination URL within the season.
6. It creates/upserts a user, product, season entry, and pending payment.
7. It stores the payment ID in `sv_pay`, creates a provider checkout, and redirects.

Current integrity note: these product/entry/payment creates are not wrapped in one transaction. If a later create or provider call fails, partial records can remain. The unique constraints still protect duplicates, but cleanup/retry behavior is not centralized.

### Payment fulfillment

`applyPaymentResult` looks up the internal payment by provider payment ID and no-ops duplicate event IDs. Success updates payment status and, when linked, atomically moves the entry/product into review. Failure updates payment to `FAILED`. Refunds accumulate a capped refunded amount and select `REFUNDED` vs `PARTIALLY_REFUNDED`.

Admin rejection currently records `refundOwed: true` in `AdminAction`; it does not itself call a provider or update the payment status. That is an explicit follow-up seam for production refund processing.

### Board and leaderboard

Both pages use `getStandings`, but they present the rows differently:

- Board: visitor-seeded shuffle, product cards, optional category filter, tracked outbound links.
- Leaderboard: rank order, interest/views/visits columns, movement indicators, status chips, and an explicit elimination cut line.

Rows with fewer than `season.minSampleImpressions` qualified impressions display “Collecting Data” and no interest rate. The current code reads `qualifiedImpressions` from stats; it does not produce those impression totals.

### Admin review

`requireAdmin` runs on the server. `approveEntryAction` and `rejectEntryAction` re-check the entry state, use a transaction for product/entry state changes, write an `AdminAction`, and revalidate relevant paths. Approval revalidates `/admin` and `/board`; rejection revalidates `/admin` only.

## 8. Seed data and local operation

### Baseline seed: `prisma/seed.ts`

Creates/promotes one admin and upserts Season 0 as registration-open with a 32-slot, `$29` default. It prints a generated admin password only when creating a new admin. It is designed to be safer against an existing real-entry database.

### Demo seed: `prisma/seed-demo.ts`

Requires `SEED_DEMO=1`. It deletes demo users ending in `@surviver.test` and seasons 0/1, then creates:

- running Season 0;
- open Season 1;
- active Round 1;
- 32 invented products with precomputed impressions, visits, Rally points, ranks, statuses, and payment records.

Demo founder credentials are printed by the seed script. Do not run this against a database containing real paid entries.

### Environment

`.env.example` documents:

```text
DATABASE_URL
APP_URL
IP_HASH_SALT
CRON_SECRET
PAYMENT_PROVIDER=dev
```

`prisma.config.ts` additionally reads `SHADOW_DATABASE_URL` for Prisma migrations. It is not currently documented in `.env.example`, so migration setup may need that variable supplied explicitly in environments where Prisma cannot create a shadow database.

## 9. Security model

- Server-only imports protect database, cookies, headers, crypto, and remote-fetch code from the client bundle.
- Auth tokens are random and only their hash is persisted.
- IP hashes are salted; raw IP addresses are not stored.
- Cookies are httpOnly, SameSite Lax, path `/`; secure is enabled in production.
- URL lookup rejects private/reserved IP ranges, credentials, unsupported protocols, unsafe redirects, oversized responses, and long-running requests.
- Outbound redirects allow only stored HTTP(S) destinations and fall back to `/board` for invalid/unapproved products.
- `safeNext` prevents external or protocol-relative redirects after login/signup.
- Admin permissions are checked on the server for every mutation.
- Paid placements are disclosed in the UI and outbound links use `nofollow sponsored`.

## 10. Known gaps and likely next implementation tasks

These are observations from the current code, not assumptions about product intent:

1. Add a direct `zod` dependency. Server actions import it, but `package.json` does not declare it directly; current installation resolves it transitively through ESLint packages.
2. Add impression instrumentation and a server ingestion path for `ImpressionEvent` with dwell and deduplication rules.
3. Implement a scoring service that derives stats from events, computes Interest Rate, handles sample thresholds, and writes ranks/statuses.
4. Implement round lifecycle jobs: start/finalize rounds, freeze stats, eliminate entries, create next-round stats, and crown survivors. Secure the job with `CRON_SECRET`.
5. Implement Rally visitor qualification, point awards, and capped exposure adjustments.
6. Add signed real-provider webhook handling and provider-backed refunds. Keep `applyPaymentResult` as the idempotent internal boundary.
7. Make entry creation transactional or add compensating cleanup for partial failures.
8. Add the routes linked from the footer: `/rules`, `/how-it-works`, `/legal/terms`, `/legal/privacy`, `/legal/refunds`, and `/legal/disclosure`.
9. Add tests; the repository currently has no test script or test files in the application source.
10. Consider moving repeated direct Prisma reads into domain query modules as the competition engine grows; the current code intentionally keeps queries close to pages/actions.

## 11. Verification snapshot

The repository was checked with:

- `npm run typecheck` — passed.
- `npm run build` — passed; Next.js reported 15 dynamic routes plus the static not-found route.
- `npm run lint` — started during the audit, but its final result was not captured in the same command batch; rerun it independently when lint status is required.
