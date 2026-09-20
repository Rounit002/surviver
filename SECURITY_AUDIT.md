# Surviver.lol security audit

**Audit date:** 14 September 2026  
**Repository:** `D:\SurvierLOL`  
**Reviewed commit:** `7e994dd9a1ce23542b66e5e801f6e1964b5cede8`, plus the working-tree configuration/documentation present during review.  
**Status:** Audit and recommendations only. No application fixes, credential rotations, database changes, or deployment changes were made.

## Overall assessment

**Do not treat the current implementation as ready for a real-money competition.** There are useful foundational controls, but significant gaps remain in payment handling, guest authorization, abuse prevention, URL fetching, and operational security.

The most urgent finding is credential material in an untracked deployment document. Its validity and external exposure were not tested. Other major issues are a production-capable payment simulator, a forgeable checkout authorization cookie, unsafe administrator provisioning, and client-controlled scoring identities.

This is a repository security assessment with limited, non-invasive live verification, not a certification that every production system is secure. Findings distinguish observed behavior, code-confirmed weaknesses, and deployment-dependent risks. Severity reflects this application's impact and prerequisites; dependency-registry severity is reported separately.

## Scope and method

- Inventoried 78 application TypeScript/TSX files, route handlers, exported server actions, proxy, client/server boundaries, Prisma schema and migrations, seeds, package manifests/lockfile, deployment configuration, public assets, and relevant documentation/scripts.
- Traced authentication, authorization, signup, guest entry, checkout, webhook settlement, refunds, admin moderation, round transitions, impression/click collection, and public/private data rendering.
- Read the installed Next.js 16.3.4 data-security guide in `node_modules/next/dist/docs/01-app/02-guides/data-security.md`, rather than assuming older Next.js behavior.
- Used graphify for supplementary code-only structural extraction: 326 nodes and 1,080 edges across the source corpus. Its Windows worker pool failed and extraction completed through its sequential fallback. The generated map is in ignored `graphify-out/security-structure.json`; it is navigation assistance, not a vulnerability verdict. No semantic model calls were used for that extraction.
- Ran `npm audit --json`, inspected installed dependency paths with `npm ls`, and ran the existing test suite.
- Ran isolated local checks for URL normalization, IPv6 address classification, bcrypt truncation, and Standard Webhooks verification. These used synthetic inputs, not user records.
- Sent only two live HEAD requests: HTTP and HTTPS homepage requests to `surviver.lol`. No live signup, payments, scoring, cron execution, malicious URL fetches, credential use, or load testing was performed.
- Performed a targeted redacted credential-pattern scan of tracked and untracked textual files. Checked local reachable Git history for `.env` and `DEPLOY_NOW.md`; neither returned a history entry. This is not an exhaustive secret-history scan, remote-repository audit, or proof that values have never been shared elsewhere.

**Not verified:** hosting/account permissions, WAF/rate-limit rules, production environment values, database privileges/RLS/TLS configuration, backups and restoreability, payment dashboard settings, email/domain ownership, production logs, DNS security, certificate lifecycle, authenticated live sessions, or production deployment parity with this checkout. Design prototypes, video content, and external widgets were not treated as deployed application code; no import from them into the app was identified.

## Protections already implemented

| Area | Existing implementation | Evidence and limits |
| --- | --- | --- |
| Password storage | bcrypt with cost 12; signup minimum of 10 characters | `src/lib/auth/password.ts:3`, `src/lib/auth/actions.ts:21`. Byte-limit issue remains, F12. |
| Login error handling | Generic failure message and dummy bcrypt comparison for unknown users | `src/lib/auth/actions.ts:104`, `src/lib/auth/password.ts:18`. Signup still reveals registered addresses; no throttling. |
| Session credentials | Cryptographically random 32-byte token; only SHA-256 token hash stored in database | `src/lib/auth/session.ts:19`, `:36`. A session-table read alone does not directly provide replayable login tokens. |
| Authentication cookies | HttpOnly, SameSite=Lax, host-scoped, Secure in production; expiration set | `src/lib/auth/session.ts:52`. Production auth-cookie response itself was not tested. |
| Session validation | Server checks session existence/expiry and reads current user role; logout deletes current session | `src/lib/auth/session.ts:67`, `:99`. All-session revocation helper exists but has no exposed recovery flow. |
| Authorization | Admin page and every exported admin action call `requireAdmin`; dashboard filters by authenticated owner ID | `src/lib/auth/guards.ts:20`, `src/app/(site)/admin/actions.ts`, `src/app/(site)/dashboard/page.tsx:20`. Checkout guest authorization is weaker, F03. |
| Roles | New users default to FOUNDER; public signup does not accept a role field | `prisma/schema.prisma:117`, `src/lib/auth/actions.ts:76`. Seed promotion is unsafe, F04. |
| CSRF | Next.js Server Actions use POST and framework origin/host checks; auth cookies use SameSite=Lax | Installed Next.js data-security guide; no custom allowed-origin expansion found. These controls do not authenticate bots. |
| Impression API | Explicit same-origin check and basic entry/dwell validation | `src/app/api/impressions/route.ts:4`. Direct clients can supply Origin and cookies; no proof of real engagement. |
| Query injection | Prisma parameterized operations; the identified raw SQL is a tagged parameterized query | `src/lib/competition/engine.ts:9`. No unsafe raw-query concatenation or application shell execution found in scanned source. |
| Input/output | Zod validation and field length limits for many entry/auth fields; HTTP(S) checks for URLs; React text rendering | Auth/product actions. Main JSON-LD serializes fixed data and escapes `<` (`src/app/layout.tsx:66`). No confirmed stored-XSS path found. |
| Server boundaries | Sensitive helpers use `server-only`; public standings explicitly map safe fields | `src/lib/competition/standings.ts:72`, auth/payment/tracking helpers. `db.ts` and `env.ts` could also be explicitly marked server-only. |
| Guest campaign links | Random 24-byte capability, unique database value, noindex/nofollow and no-referrer metadata | `src/lib/products/actions.ts:169`, `src/app/(site)/entry/[token]/page.tsx:18`. Token lifecycle remains incomplete, F14. |
| Outbound links | Redirect limited to approved products and HTTP(S); public links use noopener/noreferrer | `src/app/go/[slug]/route.ts:48`, `src/components/product/ProductCard.tsx`. Destination content can change after approval. |
| Metadata fetching | Public-address checks, manual redirect following, redirect count bound, response-size cap, initial fetch timeout | `src/lib/products/site-metadata.ts`. DNS and timeout defects remain, F07–F08. |
| Webhook authenticity | Raw request body verified with Standard Webhooks signature and timestamp | `src/app/api/webhooks/dodo/route.ts:12`. Synthetic valid signature accepted and stale timestamp rejected locally. Integration still has F09–F10. |
| Settlement integrity | Transactional fulfillment, event-ID uniqueness, payment state checks, capacity/registration checks, approval after payment | `src/lib/payments/fulfill.ts:13`, `prisma/schema.prisma:448`. A success redirect does not update payment state. |
| Competition consistency | Season-row locking around scoring, settlement, start and finalization; active-round and finalized-stat checks | `src/lib/competition/engine.ts`, `src/lib/tracking/events.ts`. Rejection does not follow the same lock discipline, F13. |
| Basic scoring defenses | Dwell threshold, per-visitor deduplication, prior impression required for visit, self-rally exclusion, basic bot UA filter | `src/lib/tracking/events.ts:8`. Useful against accidents; insufficient against deliberate manipulation. |
| Cron authentication | Missing secret fails closed; constant-time bearer comparison after length check | `src/app/api/cron/rounds/route.ts:5`. It reads `process.env.CRON_SECRET` directly, so the unused fallback getter in `env.ts` does not bypass this route. |
| Auditability | Admin-action table; payment-event deduplication table; season activity events | Prisma schema and engine. Coverage/atomicity are incomplete, F13/F17. |
| Secret exclusions | `.env*`, private PEM files, generated output and local backups ignored; Render secret inputs mostly use `sync: false` | `.gitignore`, `render.yaml`. Untracked Markdown is not protected by these exclusions. |
| Live transport | HTTPS homepage returned 200; HTTP returned 301 to HTTPS; visitor cookies had Secure, HttpOnly, SameSite=Lax | Live HEAD observations at approximately 17:24 UTC. HTTPS response had `Cache-Control: private, no-cache, no-store...`; missing headers in F11. |
| Error disclosure | Global error screen presents generic text and digest, not raw stack | `src/app/global-error.tsx`. Server-side log contents and retention were not verified. |

## Findings requiring action

### F01 — High: credential material in deployment documentation

**Evidence:** `DEPLOY_NOW.md:37` contains a credential-bearing Postgres connection URL; `:40` contains a cron secret, and `:39` includes IP hashing configuration material. Actual values are deliberately omitted here. The file was untracked at audit time, not ignored, and had no entry in the queried local Git history.

**Impact:** Anyone obtaining this document may be able to access the database or invoke authenticated cron processing if the values are active. A future broad `git add` could commit it. No claim is made that it is currently public or that the credentials were successfully used.

**Needed:** Replace values with placeholders; rotate active database and cron credentials; review their previous distribution and access logs; scan reachable Git history and deployment artifacts with a secret scanner. Protect local operational notes from accidental commits. Treat hashing salts separately from authentication credentials, but keep them private where relied on for pseudonymization.

**Verify:** No credential-bearing values remain in distributable files; previous active credentials cease to work; the app and authorized scheduler work with rotated values. Do not simply delete the document and assume old copies are safe.

### F02 — High: simulated payments can run in production

**Evidence:** `render.yaml` sets `PAYMENT_PROVIDER=dev`; `src/lib/env.ts:31` defaults to dev. `src/lib/payments/index.ts:97` only tests provider name, and `src/app/(site)/enter/checkout/[paymentId]/actions.ts:17` relies on that check. There is no production-environment prohibition. `DEPLOY_NOW.md` and README also direct deployment with dev payments.

**Impact:** When deployed with those settings, an entrant can mark their own payment successful without money moving. The entry still requires admin approval, but fabricated paid status consumes claimed capacity and can be approved into a competition. The production provider setting was not inspected.

**Needed:** Fail closed for the simulator in real production; isolate preview/demo environments and databases; require explicit, validated live provider settings. Update deployment instructions and template.

**Verify:** A production build/runtime cannot invoke simulated success, even with `PAYMENT_PROVIDER=dev` or a missing provider setting. Real settlement alone can create paid entries.

### F03 — High: checkout cookie is not independent proof of ownership

**Evidence:** `src/lib/products/actions.ts:179` stores the payment ID itself in `PENDING_PAYMENT_COOKIE`. Checkout page `:39` and action `:37` authorize when that cookie equals the requested payment ID. The page redirects successful payments to their private campaign token before its dev-provider check (`page.tsx:44–47`).

**Impact:** A person who learns a payment ID can set the same cookie and access the checkout email/details or obtain the associated private campaign URL. This does not require guessing the stronger campaign token. HttpOnly prevents page JavaScript from reading a cookie; it does not stop an HTTP client from forging one. IDs were not shown to be enumerable, so knowledge/leakage of a victim payment ID is a prerequisite.

**Needed:** Issue a separate high-entropy checkout capability, store only its hash, bind it to the payment with expiry, and validate it on both the page and action. Keep logged-in owner/admin checks. Gate the simulator before any simulator-specific disclosure.

**Verify:** Another payment's known ID plus a matching forged cookie does not authorize access or disclose its campaign token. Owner, admin and original capability flows still work.

### F04 — High, conditional: seed can promote an attacker-controlled account

**Evidence:** `prisma/seed.ts:30–43` defaults to a predictable administrator email and promotes an existing account at that email without changing its password or verifying identity. Public signup does not verify email ownership. Seed prints newly provisioned plaintext passwords at `:51`.

**Impact:** If someone registers the intended administrator address before the seed runs, a later seed gives that account ADMIN with its existing password. Requires operator execution of the seed and a pre-existing attacker-controlled account; no existing admin compromise was demonstrated. A guest-created passwordless account can also interfere with provisioning.

**Needed:** Refuse implicit promotion of existing public accounts; use a controlled administrator provisioning process with verified identity, explicit operator intent and session revocation where appropriate. Avoid printing credentials into retained logs. Require MFA for privileged access.

**Verify:** Seeding against a pre-created public account never silently elevates it. Repeat provisioning preserves only a verified existing administrator.

### F05 — High: missing application throttling and incomplete resource limits

**Evidence:** No application rate limiter, account lockout/backoff or bot challenge was found on auth, guest creation, metadata lookup, impressions, or outbound tracking. `api/impressions/route.ts:6` and `api/webhooks/dodo/route.ts:8` buffer complete bodies before an application byte limit. Scoring locks a season and recalculates all current ranks for each accepted event (`tracking/events.ts:12`, `:50`; `engine.ts:11`).

**Impact:** Password guessing, signup/entry spam, outbound-request abuse and database/CPU exhaustion. A score-ingestion flood can contend with settlement and cron work on the same season lock. Framework or proxy limits may exist, but were not verified and do not constitute per-user abuse prevention.

**Needed:** Distributed route/account/network quotas with trusted proxy handling; stricter budgets for bcrypt, URL fetches and creation; body/header/string limits and request deadlines; bounded queue/concurrency for scoring; retention/cleanup for abandoned rows. Measure load in staging before changing locking guarantees.

**Verify:** Excessive activity receives bounded rejection without unbounded database work; oversized chunked bodies fail early; normal traffic and legitimate webhook retries continue to work. Verify edge rules on both public and origin hostnames.

### F06 — High: synthetic visitors can manipulate paid competition scores

**Evidence:** `src/proxy.ts:32–40` accepts existing visitor/session cookie values; `tracking/visitor.ts:36` only rejects the literal `anonymous`. `tracking/events.ts` trusts these IDs, user-agent, rally cookie and reported dwell time. Event IP-hash/suspicious fields exist in the schema but are not populated by this ingestion path. Public cards expose entry IDs intentionally.

**Impact:** A direct client can rotate IDs, claim dwell time, fabricate impression/click sequences, or add impressions to competitors to lower their interest rate. Origin checks do not stop custom HTTP clients. Deleting rally attribution can evade the self-rally rule. Even signing cookies alone cannot stop repeated acquisition of fresh identities.

**Needed:** Layered anti-abuse controls: validated server-issued identities, issuance quotas, replay-resistant interaction evidence, network/device/time-based anomaly detection, rate limits, suspicious-event quarantine, review and score-recomputation procedures. Define what a verified visit actually proves. Add protection against unwanted GET-based click scoring; browser navigation alone is not evidence of human intent.

**Verify:** Synthetic bulk identities, impossible dwell/click sequences, self-referral rewriting and denominator attacks are detected or excluded before finalization. Do not test this against real standings.

### F07 — High, network-dependent: metadata SSRF protections are incomplete

**Evidence:** `site-metadata.ts:94` resolves/validates a hostname, but `:168` independently fetches it without binding the connection to the validated address. The IPv6 deny logic only matches dotted mapped IPv4 and a narrow link-local prefix (`:73–79`). Isolated tests returned `false` (not blocked) for `::ffff:7f00:1` and `fe90::1`.

**Impact:** DNS rebinding can change the address between validation and connection. A domain resolving to an unblocked private IPv6 representation may reach private services where the runtime/network permits it. Direct literal URLs may be rejected earlier; DNS answers are the relevant additional input. No real private-network request was attempted.

**Needed:** Use a robust address parser/range policy; pin connections to validated public addresses while preserving correct Host/TLS verification; validate protocol, credentials, port and destination at every redirect; enforce network egress restrictions and block metadata/private destinations outside the application too. [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

**Verify:** Mocked rebinding, mapped IPv6, full link-local ranges, private redirects and mixed public/private DNS answers never result in a private connection. Include positive tests for legitimate public sites.

### F08 — Medium: metadata fetch timeout ends before body consumption

**Evidence:** `site-metadata.ts:180` clears the six-second timer once fetch returns headers, while body streaming occurs later at `:194`. DNS resolution precedes timer creation. Redirect/error response bodies are not explicitly canceled on all exit paths. The read cap may also retain one oversized chunk before slicing.

**Impact:** A hostile site can send headers promptly and trickle or stall the body, retaining resources past the advertised deadline. Lack of throttling amplifies this risk.

**Needed:** One total deadline covering resolution, connection, redirects and body consumption; cancel/release every response; use bounded chunk copying and concurrency.

**Verify:** A controlled stalled-body fixture aborts within the total limit; oversized chunks are bounded; redirect chains do not multiply resource budgets.

### F09 — High for payment integrity: Dodo correlation and event parsing mismatch

**Evidence:** `payments/index.ts:16` stores checkout `session_id` as `providerPaymentId`. The webhook parser at `:22` reads `data.payment_id`, and fulfillment matches that against the stored identifier (`fulfill.ts:11`). Parser `:23` additionally requires `payload.id`, while the verified `webhook-id` header is not passed through. Dodo documents the event ID in the header and a body with business/type/timestamp/data fields. [Dodo webhook format](https://docs.dodopayments.com/developer-resources/webhooks), [payment payload](https://docs.dodopayments.com/developer-resources/webhooks/intents/payment).

**Impact:** Standard legitimate events can be ignored, or fail to find the payment, while the route returns success. Actual provider deliveries were not replayed; a custom provider-side transformation could affect the payload, but none is documented here.

**Needed:** Keep checkout and payment identifiers distinct; correlate the local payment using verified provider data and checkout metadata, validating the complete relationship; use the authenticated header event ID; validate event schemas and provider/environment. Add genuine provider sandbox fixtures for success, failure, refunds and retries.

**Verify:** A documented signed event without a body `id` settles the correct payment exactly once. Unrelated provider IDs/metadata do not attach to another entry. Early delivery before checkout-save completes is handled durably.

### F10 — High for payment integrity: settlement reconciliation is incomplete

**Evidence:** Dodo checkout sends a fixed product ID but ignores requested amount/currency (`payments/index.ts:12`). Successful `WebhookResult` has no amount/currency to validate (`payments/types.ts`). Fulfillment can return registration closed, season full, unknown payment or entry unavailable; route `:14–15` discards that result and responds 200. Application/database exceptions are reported as invalid webhook/401. Refunds are cumulative additions, and full refunds withdraw only awaiting-approval/upcoming entries (`fulfill.ts:39`). Rejection records a refund obligation but initiates no refund.

**Impact:** Provider pricing can diverge from local accounting; real payments can remain pending without an operational resolution; late/capacity-exceeded payments and disputes can be lost from workflow. This is not a demonstrated unsigned-webhook forgery: signature verification exists. Refund/dispute treatment for active or completed competitions is undefined in code.

**Needed:** Validate expected product, merchant, amount and currency under a documented tax/discount policy; durable verified-event inbox and reconciliation; separate signature failures from processing errors; explicitly resolve late payments, refunds, chargebacks and partial refunds; ensure acknowledgments mean durable acceptance or completed handling. Avoid acknowledging and merely launching untracked background work.

**Verify:** Wrong financial attributes cannot fulfill; duplicate/out-of-order/early events and DB outages recover; full/late/rejected entries have tracked refund outcomes; provider and local balances reconcile.

### F11 — Medium: browser security headers are missing

**Evidence:** `next.config.ts` defines only a redirect. The live HTTPS homepage response lacked Content-Security-Policy, frame restrictions, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy and Permissions-Policy. It exposed `x-powered-by: Next.js`. HTTP-to-HTTPS redirection worked.

**Impact:** No demonstrated XSS follows from missing headers alone, but clickjacking and browser containment protections are absent on the sampled page, and HSTS upgrade enforcement is missing there. Other routes were not sampled.

**Needed:** Add and verify a compatible CSP, frame-ancestors policy, nosniff, explicit referrer policy and minimal browser permissions; configure HSTS after checking HTTPS/subdomain readiness. Protect admin/auth/private routes too. Consider removing framework fingerprinting as low-priority hardening. Follow the installed Next.js CSP guide for script/nonces and test hydration.

**Verify:** Headers present on success, redirect and error responses at the public edge and origin where appropriate; admin cannot be framed; intended scripts/images/fonts still work. Keep private campaign responses no-store and no-referrer.

### F12 — Medium: authentication redirect and password edge cases

**Evidence:** `auth/actions.ts:38–41` rejects `//` but allows slash-backslash destinations. An isolated execution of this function accepted `/\example.invalid`; Node's URL parser resolved it to `https://example.invalid`. Signup permits up to 200 characters while bcrypt truncates at 72 bytes; local bcrypt testing accepted differing suffixes after an identical 72-byte prefix. Sign-in lacks an explicit password maximum. Signup explicitly reveals account existence (`:73`).

**Impact:** Post-authentication external redirection supports phishing; browser behavior was not exercised through a real login. Long passwords silently lose entropy and behave differently from what users entered. Account enumeration is possible through signup regardless of generic login errors.

**Needed:** Parse return paths against the trusted origin and enforce same-origin after normalization, rejecting backslashes/control characters and scheme-relative URLs. Enforce bcrypt's UTF-8 byte boundary or migrate with a planned compatible password-hashing strategy. Add consistent input bounds and an intentional email-discovery policy.

**Verify:** Encoded/control-character/backslash variants cannot escape the site; valid internal queries still work; Unicode/long passwords behave as advertised; ordinary login remains compatible.

### F13 — Medium: moderation races and audit writes outside transactions

**Evidence:** `admin/actions.ts:62–79` reads eligibility before a transaction and rejects without `lockSeason` or an in-transaction state recheck. Approve does lock/recheck; rejection can race with approval/start. Approve/reject audit inserts occur after commit (`:57`, `:82`); advance logs after the engine commits (`:95`). Season start correctly writes its audit row in the transaction.

**Impact:** Concurrent authorized actions can reject an entry after another action approved/started it, producing inconsistent competition state. A logging failure can leave a committed manual intervention without its audit row. Requires concurrent admin operations or partial failure, not unauthenticated access.

**Needed:** Consistent season lock ordering and transaction-local eligibility checks for rejection; commit the audit record with the associated mutation; record appropriate season target types and outcomes.

**Verify:** Concurrent approve/reject/start tests preserve one valid transition, and forced audit-insert failure cannot leave an unaudited successful mutation.

### F14 — Medium: guest ownership and capability lifecycle are incomplete

**Evidence:** Entry creation upserts users solely by submitted, unverified email (`products/actions.ts:167`). Public signup refuses an existing guest email. Duplicate URL checking includes unpaid entries (`:165`); no abandonment expiry/reclaim workflow was found. Campaign tokens are stored directly with no expiry/revocation fields (`schema.prisma:227`) and appear in provider return URLs (`products/actions.ts:193`).

**Impact:** Attackers can create entries under another email, preoccupy a guest identity, or block another product URL without paying. This does not give access to an existing account's password/session. Leaked campaign links remain usable indefinitely for the campaign information they expose; no arbitrary account administration was found behind those links.

**Needed:** Verify email before binding ownership/recovery; design safe guest-to-account claiming; expire abandoned submissions and let verified owners recover claims; hash capabilities, add rotation/revocation and a recovery process. Redact capability URLs from logs and provider telemetry; consider exchanging the URL token for a restricted session.

**Verify:** A third party cannot permanently reserve an email/URL; verified ownership resolves conflicting submissions; revoked capability tokens fail; no sensitive tokens enter public pages or shared logs.

### F15 — Medium: session and privileged-account lifecycle gaps

**Evidence:** Sessions use a 30-day lifetime and sliding database expiry (`session.ts:10`, `:89`) without an absolute server-enforced maximum. The browser cookie is not refreshed with the sliding database update. No password-reset/change, MFA, session-management UI, verified-email, or all-session-revocation action was found; the revocation helper alone exists.

**Impact:** A copied active token may be kept alive beyond the intended browser lifetime, and there is no complete user-facing recovery path for compromise. Admin access relies on the same password/session controls as founder access.

**Needed:** Absolute and idle session limits, shorter privileged sessions, MFA and step-up checks for sensitive administration, revocation on credential/security changes, secure recovery and user-visible session management. Reconcile cookie and server expiry deliberately.

**Verify:** Absolute-expired tokens fail even when recently active; password/security changes revoke old sessions; privileged operations require the intended authentication strength.

### F16 — Medium remediation priority: known dependency advisories

`npm audit --json` returned **four high-severity affected package entries**, representing transitive effects from **three underlying advisories**, not four independent exploitable website bugs:

| Installed package/path | Advisory | Applicability |
| --- | --- | --- |
| `prisma@7.10.0 -> @prisma/config -> deepmerge-ts@7.1.5` | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), recursive-graph stack exhaustion | Config/tooling path; remote untrusted object-graph input to the vulnerable function was not identified. |
| `prisma@7.10.0 -> mysql2@3.15.3` | [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), authentication downgrade/credential leakage | App uses PostgreSQL through `pg`; no MySQL connection path identified. |
| Same mysql2 dependency | [GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), compressed-protocol decompression DoS | Same reachability limitation. |

**Needed:** Review a supported Prisma/dependency update or tested resolution with upstream fixes; minimize production tooling exposure and automate advisory checks. The audit command suggested Prisma 6.19.3 as a breaking version change; do **not** blindly run `npm audit fix --force` against this Prisma 7 project. No Next/React advisory was reported by this scan; that is not proof of universal vulnerability absence.

**Verify:** Re-run advisory and dependency-path checks after a compatible update, and validate generated client, migrations and runtime behavior.

### F17 — Medium: operational evidence and regression coverage are insufficient

**Evidence:** Only three scoring unit tests exist; all passed. No automated security regression suite/CI configuration was found in tracked files. Security logging is largely console output, selected admin actions and applied payment events. Event-retention and expired-session cleanup jobs were not found. Session expiry cleanup only removes a row if that token is subsequently presented.

**Impact:** Regressions, repeated attacks, delivery failures and data growth can go unnoticed. An existing database backup exclusion is not evidence that backups are encrypted, scheduled or restorable.

**Needed:** Add focused security integration tests listed below; deploy-time checks for unsafe configuration; redacted centralized logs, alerts, incident-response and secret-rotation procedures; independent backups with tested restores and least-privilege access; defined data retention/deletion. Separate migration privileges from normal web-runtime permissions where feasible.

**Verify:** Staging security regressions run on change; alerts fire for tested events; a restore exercise succeeds; runtime database role cannot perform unnecessary administration; abandoned/session/event retention operates as intended.

## Additional hardening and verification items

These are lower-priority improvements or unverified deployment controls, not confirmed high-severity vulnerabilities:

- **External images/privacy:** Product logos load arbitrary HTTP(S) URLs directly in visitor browsers (`ProductCard.tsx`, product actions). This permits third-party tracking and possibly requests toward browser-local addresses; it is not the server-side image-proxy SSRF path. Use a vetted image policy or safely implemented image ingestion, restrictive image CSP, and explicit referrer policy. Avoid creating a new unsafe fetch proxy.
- **Privacy workflow:** Privacy text directs users to contact through their campaign link, but the inspected campaign page provides no contact/request mechanism. Define a usable access/correction/deletion channel, retention periods and processor inventory. No legal-compliance determination was made.
- **Public catalog consistency:** Survivor listing filters only `SURVIVOR`; archive/season listings do not consistently exclude draft/cancelled seasons. Decide which states are public and apply a shared predicate, including sitemap generation. Public standings already filter approved products and appropriate entry states.
- **Input bounds:** Bound URLs, emails, cookie identifiers and route parameters; use a database-compatible range for season numbers. Current integer validation accepts values beyond a Prisma/Postgres Int range, potentially causing errors, not SQL injection.
- **Production configuration:** Require a valid HTTPS APP_URL, explicit payment environment/provider and non-default IP hashing salt in production. The cron route already rejects missing secrets, but placeholder secrets still need configuration validation. IP hashing trusts the first forwarded address; verify ingress overwrites spoofable forwarding headers before using it for security decisions.
- **Database/cloud:** Confirm private/network-restricted database access, actual TLS certificate verification, runtime grants, Supabase exposed schemas/API access and RLS where applicable. Absence of RLS SQL in this repo alone does not prove publicly accessible tables or require RLS for every server-only access pattern.
- **Deployment:** Check Cloudflare/Render administrator MFA, least-privilege service tokens, branch protections, deployment approvals, origin bypass, TLS/DNS lifecycle, monitoring and rollback. Cloudflare's presence in response headers does not establish effective WAF or bot protection.
- **Documentation drift:** `architecture.md:132` and `codebase.md:193` describe only a dev provider even though a Dodo provider and webhook route now exist. Documentation calling simulation “development-only” overstates the actual environment guard. Update security and deployment claims after implementation changes.

## Route and action coverage

| Surface | Review result |
| --- | --- |
| Public homepage, board, leaderboard, seasons, survivors, informational pages, sitemap/robots | Public data mapping and rendering inspected; no direct password/session-token serialization found; catalog-state hardening above. |
| `/login`, `/signup` and auth actions | Server-side credentials and session checks present; F04/F05/F12/F14/F15. |
| `/dashboard` | Authenticated owner filter present; recovery/session limitations remain. |
| `/admin` and approve/reject/start/advance actions | Every entry point requires ADMIN; F04/F13/F15/F17. |
| `/enter`, metadata lookup and create-entry action | Input validation, season locking and payment initiation present; F05/F07/F08/F14. |
| `/enter/checkout/[paymentId]` and simulation action | F02/F03; simulator success still passes through central fulfillment. |
| `/entry/[token]` | Capability-based campaign view with indexing/referrer metadata; F03/F14. `?paid=1` displays a success banner without checking payment state, but does not settle a payment; derive the banner from persisted state. |
| `POST /api/impressions` | Origin/basic input checks; F05/F06. |
| `GET /go/[slug]` | Approved HTTP(S) destination checks; cookie-based scoring can be fabricated or unintentionally triggered, F06. |
| `GET /rally/[code]` and proxy | Public referral flow; attribution/identity are client-controlled, F06. |
| `POST /api/webhooks/dodo` | Signature/timestamp protection; F05/F09/F10. |
| `POST /api/cron/rounds` | Fail-closed bearer authentication and locked round processing; keep credential private, F01. |

## Verification results and limits

| Check run | Result | What this does not establish |
| --- | --- | --- |
| `npm test` | 3 passed, 0 failed | Tests only ranking/tie-break/elimination functions, not authorization, payment integration or abuse resistance. |
| `npm audit --json` | Exit 1; 4 high package entries, 0 critical | Registry severity does not prove web-route reachability. |
| `npm ls` selected dependencies | Confirmed Next 16.3.4, React 19.2.8, Prisma/client 7.10.0, deepmerge-ts 7.1.5, mysql2 3.15.3 | Production may run a different build. |
| Isolated actual `safeNext` function + Node URL resolution | Slash-backslash input accepted; resolves off-origin | No authenticated browser exploit performed. |
| Isolated actual IPv6 classifier | Missed hexadecimal mapped loopback and `fe90::1`; blocked IPv4 loopback | No internal network contacted; actual reachability depends on DNS/network/runtime. |
| Installed bcrypt library with synthetic strings | Different suffixes after 72 ASCII bytes compare successfully | Does not reveal or test any real password. |
| Installed Standard Webhooks with synthetic key/event | Valid signature accepted; stale timestamp rejected | Does not validate Dodo business-event parsing or database fulfillment. |
| Live homepage HEAD checks | HTTPS 200; HTTP 301 to HTTPS; Secure visitor cookies; missing headers listed in F11 | No authenticated-route/header coverage, TLS cipher audit or penetration test. |
| Targeted credential scan/history check | Credential material in untracked deployment notes; README URL matches were placeholders | No exhaustive secret scanner or remote-history review; credential validity untested. |

No build, migration, seed or production write was run for this audit. No security regression tests or application code were added. Isolated probes are evidence of the specific behaviors above, not a replacement for the integration suite below.

## Recommended implementation order

1. **Contain credential exposure:** sanitize deployment notes, rotate active credentials and review exposure (F01). Ensure seeding cannot elevate a public account (F04).
2. **Close payment/access launch blockers:** prohibit production simulation, replace checkout authorization, implement Dodo mapping/financial reconciliation and refund handling (F02/F03/F09/F10).
3. **Protect public attack surfaces:** distributed throttling, resource limits, complete SSRF protection and fetch deadlines (F05/F07/F08).
4. **Make competition scoring defensible:** anti-abuse detection, trusted interaction design, moderation concurrency and atomic audit trails (F06/F13).
5. **Complete identity/browser hardening:** redirect/password fixes, guest ownership/recovery, capability/session lifecycle, MFA and response headers (F11/F12/F14/F15).
6. **Establish ongoing verification:** compatible dependency fixes, focused CI tests, observability, restore exercises and environment/access review (F16/F17).

### Security regression acceptance suite for the implementation phase

- Anonymous and founder callers cannot execute admin actions, including direct Server Action requests.
- Known payment IDs and forged cookies cannot access another checkout or campaign token.
- Production simulation always fails closed; documented signed Dodo events settle only the matching payment once.
- Payment amount/currency/product mismatches, early/late delivery, duplicates, refunds and processing outages have deterministic recovery.
- Private DNS, IPv6 variants, rebinding and redirected destinations are rejected; stalled/oversized bodies terminate within fixed budgets.
- Login/creation/scoring abuse is throttled; fabricated visitors/attribution do not determine final standings.
- Concurrent moderation/start/finalize/refund operations preserve valid state and an atomic audit record.
- Redirect normalization, bcrypt byte limits, capability revocation, session expiry, and recovery work across boundary cases.
- Required security headers and cache/referrer behavior hold through the production proxy on public and private routes.
- Secret scanning, dependency checks and unsafe-config checks run before deployment; restore and alerting exercises have recorded outcomes.

**Next step:** See the remediation record below for what has since been implemented and what remains.

---

# Remediation record

**Implementation date:** 15 September 2026
**Verified with:** `npx tsc --noEmit`, `npx eslint src prisma prisma.config.ts`, `npm test` (18 tests), `npm run build`, `npm audit`, `npx prisma migrate status`, and live header/route probes against a local dev server.

This section records what was implemented against each finding and what a reviewer should still treat as open. It reports code state only. Credential rotation, hosting configuration, backups and provider-side settings are operational actions that cannot be verified from this repository.

## Status by finding

| ID | Status | What was implemented | Evidence |
| --- | --- | --- | --- |
| F01 | Code addressed; **rotation still owed** | `DEPLOY_NOW.md` now carries placeholders only. A redacted scan of all Markdown found no credential-bearing values remaining. | `DEPLOY_NOW.md:37-44`. **Still required:** rotate the previously documented database and cron credentials and review their distribution. That is operational, not code. |
| F02 | Closed | `getPaymentProvider()` throws when `NODE_ENV=production` and the provider is `dev`; `isDevPayments()` is false in production; the checkout page and simulate action both gate on it. `render.yaml` now sets `dodo` / `live_mode`. A startup preflight refuses to boot on unsafe configuration. | `src/lib/payments/index.ts:97`, `scripts/security-preflight.mjs`, `render.yaml`. Tests 15-16. |
| F03 | Closed | Checkout is authorized by a separate 32-byte capability stored only as a SHA-256 hash with a two-hour expiry, compared in constant time. Knowing a payment id is no longer sufficient. The capability is cleared on settlement. | `src/lib/payments/access.ts`, `src/lib/products/actions.ts:187`, `src/lib/payments/fulfill.ts:31`, migration `20260914190000_security_hardening`. Test 12. |
| F04 | Closed | The seed requires an explicit `SEED_ADMIN_EMAIL` and a 12-72 byte `SEED_ADMIN_PASSWORD`, refuses to promote an existing non-admin account, and no longer prints passwords. | `prisma/seed.ts:29-53`. |
| F05 | Closed in code | Distributed Postgres fixed-window limits now cover sign-in (10/15 min), signup (3/hour), entry creation (5/hour), and outbound site-metadata lookup (6/10 min). Bucket keys are HMAC digests, updates are atomic across instances, and expired buckets are cleaned without starting a pre-field timer. | `src/lib/security/rate-limit.ts`, migration `20260920130000_restore_rate_limits`, `tests/rate-limit.integration.test.ts`. Limits remain IP-based and depend on ingress overwriting forwarding headers. |
| F06 | Substantially mitigated | Visitor and session cookies are HMAC-signed by the proxy and verified in constant time, so identifiers can no longer be fabricated. Scoring additionally requires a server-issued, entry-bound, ten-minute interaction proof, so clicks and impressions cannot be replayed across products or identities. Events from an address presenting ten or more distinct visitor identities within an hour are refused and counted as suspicious. | `src/proxy.ts:29`, `src/lib/security/tokens.ts:42`, `src/lib/tracking/events.ts:23`, `src/app/api/impressions/route.ts:13`, `src/app/go/[slug]/route.ts:63`. Test 13. **Residual:** a determined attacker can still acquire fresh identities across many addresses. Issuance quotas and pre-finalization review remain advisable before real money rides on standings. |
| F07 | Closed | Address classification now uses `ipaddr.js`, covering every IPv6 form the audit found missed. Connections are pinned to the validated address through an `undici` Pool with a fixed `lookup`, so DNS rebinding cannot redirect the connection while Host and TLS verification stay correct. Every redirect hop is re-validated. | `src/lib/products/site-metadata.ts:63`, `:165`. Tests 9-11 cover the audit's failing cases, including `::ffff:7f00:1` and `fe90::1`. |
| F08 | Closed | One deadline spans DNS, connection, redirects and body consumption. Body reads copy into a pre-allocated bounded buffer, so a single oversized chunk can no longer be retained. Every exit path cancels the response and closes the pool, now including the throwing path. | `src/lib/products/site-metadata.ts:106-130`, `:211-217`. |
| F09 | Closed | Checkout and payment identifiers are stored in separate columns (`providerCheckoutId` vs `providerPaymentId`). The event id comes from the authenticated `webhook-id` header, not the body. Business id is validated against configuration, and the local payment is correlated through checkout metadata. | `src/lib/payments/index.ts:18-30`, `src/app/api/webhooks/dodo/route.ts:16`. |
| F10 | Substantially addressed | Amount, currency and provider identity are validated before any state change. A durable `webhook_events` inbox records every authenticated message; unresolved outcomes are marked `NEEDS_REVIEW` and processing failures `FAILED`, so signature failures (401) are distinct from processing failures (500). Rejection records `refundRequestedAt` inside the transaction and calls the provider refund API. | `src/lib/payments/fulfill.ts:21-47`, `src/app/api/webhooks/dodo/route.ts:21-34`, `src/app/(site)/admin/actions.ts:64-74`. **Residual:** no automated provider-versus-local balance reconciliation, and no sandbox fixture suite replaying real Dodo deliveries. |
| F11 | Closed and verified live | CSP with a per-request nonce and `strict-dynamic`, frame-ancestors none, `X-Frame-Options: DENY`, nosniff, `Referrer-Policy: no-referrer`, `Permissions-Policy`, and HSTS in production. `poweredByHeader` is disabled. | `src/proxy.ts:38-62`, `next.config.ts:4`. Confirmed on a live response; the page hydrates with no CSP violations in the console. |
| F12 | Closed | The redirect guard is extracted, tested, and now re-checks the **normalized** path. This closed a case that survived the earlier fix: `/..//evil` passed the input test but resolved to the path `//evil`, which a browser reads as a scheme-relative URL. Passwords are bounded at bcrypt's 72-byte boundary on both hash and verify. Signup no longer confirms which addresses are registered. | `src/lib/auth/redirects.ts`, `src/lib/auth/password.ts:6`, `src/lib/auth/actions.ts:80`. Tests 4-8. |
| F13 | Closed | Rejection now takes the season lock and re-checks eligibility inside the transaction, matching approval. Every audit row is written inside the transaction performing the mutation, so a committed intervention cannot lack its audit record. `advanceSeason` records its outcome for admin-initiated calls. | `src/app/(site)/admin/actions.ts:55-66`, `src/lib/competition/engine.ts:35-70`. |
| F14 | Revised by product decision | Entry remains guest-based. Email ownership verification has been removed; campaign access relies on the per-entry random capability, stored hashed with expiry and revocation columns. Unpaid entries stop blocking a URL once the two-hour checkout capability lapses, and are swept to `WITHDRAWN` a day later (this regressed between 15 and 19 September and was restored in the second pass below). The capability no longer travels in the provider return URL: it is held in an HttpOnly cookie and re-formed on our own origin at `/enter/complete`. | `src/lib/products/actions.ts`, `src/app/(site)/enter/complete/route.ts`, `src/lib/security/retention.ts`. **Residual:** an email address alone does not prove ownership; no self-service capability rotation for founders. |
| F15 | Revised by product decision | Sessions carry both an absolute limit (7 days founder, 12 hours admin) and an idle limit (24 hours / 2 hours) that slides forward but never past the absolute one. Email verification is not part of signup or sign-in. Administrators must still pass TOTP. | `src/lib/auth/session.ts`, `src/lib/auth/mfa.ts`. |
| F16 | Closed | Resolved with `overrides` rather than `npm audit fix --force`, so Prisma 7.10.0 is retained instead of being downgraded to 6.19.3 as the audit command suggested. `deepmerge-ts` 7.1.5 to 8.0.2, `mysql2` 3.15.3 to 3.24.4. | `package.json` overrides. `npm audit`: **0 vulnerabilities**. `prisma validate`, typecheck, tests and build all pass on the updated tree. |
| F17 | Partially addressed | An 18-test security regression suite now covers redirects, bcrypt boundaries, SSRF classification, checkout capability, interaction proofs, signed cookies, the production simulator guard and input bounds. A retention sweep on the authenticated cron schedule clears expired rate-limit buckets and sessions, ages out processed webhook events, and withdraws abandoned checkouts. A preflight script blocks startup on unsafe production configuration. | `tests/security.test.ts`, `src/lib/security/retention.ts`, `scripts/security-preflight.mjs`. **Residual:** no CI workflow, no centralized alerting, no tested backup restore. Operational work. |

## Additional hardening applied

- `db.ts` and `env.ts` are now explicitly `server-only`, as the audit suggested.
- IP resolution and hashing were consolidated into `src/lib/security/request.ts`. Previously `clientIp()` trusted the first `x-forwarded-for` hop while `requestIp()` preferred `cf-connecting-ip`; the two disagreed. The single implementation prefers the header the edge provider sets itself, and documents that all of it is only as trustworthy as the ingress.
- The proxy compares cookie signatures in constant time (the Edge runtime has no `timingSafeEqual`).
- Draft and cancelled seasons are excluded from the seasons listing, the season detail pages and the sitemap through one shared predicate.
- Season numbers are validated against the Postgres `Int` range, so an out-of-range path segment is a 404 rather than a 500.
- The `?paid=1` campaign banner is derived from settled payment state instead of a query parameter anyone can add.
- Documentation drift corrected: `architecture.md` and `codebase.md` no longer describe `dev` as the only payment provider.

## Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean. Was failing with two errors in `fulfill.ts` before this pass, so the build could not have succeeded. |
| `npx eslint src prisma prisma.config.ts` | Clean. |
| `npm test` | 18 passed, 0 failed (was 3). |
| `npm run build` | Succeeds; `/enter/complete` registered. |
| `npm audit` | 0 vulnerabilities (was 4 high). |
| `npx prisma migrate status` | Up to date. The `20260914190000_security_hardening` migration had **never been applied** to the local database and was applied during this pass. `render.yaml` runs `prisma migrate deploy` on every deploy. |
| Live header probe | CSP with nonce, frame-ancestors, nosniff, referrer-policy and permissions-policy all present; no `x-powered-by`; signed HttpOnly visitor cookies. |
| Live route probe | Unknown campaign tokens, unknown checkouts and out-of-range season numbers all render the not-found page with no data disclosure. |

## What remains open

These are not code defects and cannot be closed from this repository.

1. **Rotate the credentials** previously written into `DEPLOY_NOW.md` and review who had access (F01).
2. **Provider reconciliation:** a recurring provider-versus-local balance report, and a Dodo sandbox fixture suite covering success, failure, refund, duplicate and out-of-order delivery (F10).
3. **Scoring abuse:** identity-issuance quotas and a pre-finalization review of suspicious events, before real money depends on standings (F06).
4. **Operations:** a CI workflow running the checks above on every change, centralized redacted logging with alerts, a tested backup restore, and least-privilege database roles separating migration from runtime (F17).
5. **Deployment review:** administrator MFA on Render and Cloudflare, branch protections, origin-bypass checks, and confirmation that the ingress overwrites spoofable forwarding headers before `requestIp()` is trusted for security decisions.

---

# Second audit pass — 20 September 2026

A re-audit of the tree after the first remediation pass, plus a full local
run: `npx tsc --noEmit`, `npx eslint src prisma prisma.config.ts`, `npm test`
(33 tests, including the database-backed integration suites), `npm run build`,
`npx prisma migrate deploy`, an end-to-end entry driven through a browser
against a local database, and probes of every public route.

## What the re-audit found

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| S01 | High for the brand | Every page's metadata carried the design reference the layout was built from: title template, default title, Open Graph and Twitter cards all said `outbid.lol`, and the JSON-LD told search engines the site lives at `https://outbid.lol`. This was live. | Fixed. `src/app/layout.tsx`. |
| S02 | High for founders | A checkout started and never finished held its product URL for good. The capability that opens a checkout lives two hours; after that the founder could reach neither their checkout nor a new entry for the same address. The retention sweep only released checkouts with payment status `CANCELLED`, which no code path ever writes, so nothing cleared them. | Fixed. `blockingEntryFilter` in `src/lib/competition/season.ts`, sweep in `src/lib/security/retention.ts`, regression test in `tests/entry-availability.integration.test.ts`. |
| S03 | Medium for payments | The scheduler tick returned before sweeping the webhook inbox whenever no season was full or running — that is, throughout registration, which is exactly when a payment the provider has stopped redelivering strands a charged founder with nothing on the board. | Fixed. `src/lib/competition/scheduler.ts` sweeps the inbox before the capacity gate. |
| S04 | Low, dev only | `connect-src 'self'` does not cover the `ws:` scheme, so the dev server's hot-reload socket was refused by the CSP. | Fixed. `src/proxy.ts`, development only. |
| S05 | Medium | Rate limiting was removed wholesale in 4fe9493. | **Closed in code.** Postgres-backed fixed-window limits protect sign-in, signup, entry creation and metadata lookup; expired buckets are cleaned without starting work before the 35-entry threshold. |
| S06 | Low | Unknown season numbers could stream a `200` before `notFound()` set the 404. | **Closed in code.** The broad `(site)` loading boundary was removed so it cannot flush headers for routes that later resolve to not-found; the board retains a route-scoped loading state. |
| S07 | Low | Legacy `/entry/[token]` rows stored their capability in plaintext until that URL was visited. | **Closed on deployment.** The pre-build migration script hashes all remaining non-hash capabilities before the new app version goes live; route lookup now accepts hashes only. It is idempotent and preserves existing capability URLs. |
| S08 | Operational | A local `next dev` was running against the remote production database. A test entry there could write real rows into the live season. | **Resolved for this checkout.** `.env` points to the local database, and browser QA used a separate isolated database. Keep this split for future local runs. |
| S09 | Operational | `.local-backups/set-env.cjs` holds a live Supabase password in plaintext. The directory is gitignored and has never been tracked, so nothing leaked through the repository, but F01's rotation is still owed. | **Open.** Operational. |

## Verified in this pass

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean. |
| `npx eslint src prisma prisma.config.ts` | Clean. |
| `npm test` | 34 passed, 0 failed, 0 skipped, with `TEST_DATABASE_URL` pointed at `surviver_test`; includes atomic rate-limit window/reset coverage. |
| `npm run build` | Succeeds. |
| `npx prisma migrate status` | All migrations through `20260920130000_restore_rate_limits` applied to the isolated test and browser-QA databases. |
| End-to-end entry | Chrome on local port 3001 created a synthetic founder, entered an example.com test product, simulated the $29 payment, and showed the entry as `UPCOMING` on the dashboard and public home board. Competition stayed in registration at 2/35. |
| Legacy capability upgrade | A synthetic legacy plaintext capability was hashed by `db:hash-legacy-capabilities`, then still opened its campaign page in Chrome. The script reported one row migrated and recognizes its own hash on rerun. |
| Missing season | Chrome rendered the not-found page and a direct local HTTP probe confirmed status 404 for `/seasons/99999999`. |
| Public routes | All render; `/does-not-exist` answers 404. |
| Live headers | CSP with nonce, HSTS, `frame-ancestors none`, nosniff, `Referrer-Policy: no-referrer`, Permissions-Policy, no `x-powered-by`, signed HttpOnly visitor cookies. |
