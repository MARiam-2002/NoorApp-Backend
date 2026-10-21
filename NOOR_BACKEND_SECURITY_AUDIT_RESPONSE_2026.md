# Noor — verified audit response and security implementation handoff

20 October 2026. Source: the supplied Mahmoud backend audit, checked against the local backend checkout. This file records completed local changes, operational prerequisites and unresolved findings. Nothing here means the changes have already been deployed or that every audit item is closed.

## Implemented locally

1. **H1: Google identity verification.** Added a direct `google-auth-library` dependency. Replaced tokeninfo HTTP calls with `OAuth2Client.verifyIdToken`, an explicit audience allowlist, SDK signature/issuer/expiry verification and verified-email/sub checks. Empty configuration fails closed with 503; invalid identities return 401. Supported audience settings are `GOOGLE_CLIENT_ID`, `GOOGLE_SERVER_CLIENT_ID` and comma-separated `GOOGLE_CLIENT_IDS`. The server alias previously ignored is now read. Key retrieval has a ten-second request timeout and retries disabled. No token contents/upstream credential URLs are logged. A LOCAL account must have `emailVerifiedAt` before automatic Google linking; an already linked different Google subject cannot be silently replaced. New Google accounts record their verified email time.
2. **H3: challenge reward claims.** Claim IDs must be the current day-of-year in the saved user timezone. Invalid, previous and future IDs fail before awarding points. Claim checking, persistence and the points increment now share an interactive transaction with a per-user row lock. The completion unique key includes `userId`, `year`, `dayOfYear` (a year-qualified calendar-day identity), so the same ordinal next year is independent. Dashboard/Journey completion lookups were updated. No existing API response field was removed. Existing points are not retrospectively edited.
3. **H4: destructive HTTP maintenance.** Removed `/cron/cleanup-users-without-fcm` from the HTTP router/Swagger declarations. Normal account deletion remains available to its authenticated owner. Existing maintenance CLI code is retained; this patch does not turn token absence into a valid inactivity policy. The supplied audit's wording overstated the old behavior: the endpoint was manual, dry-run by default, and required explicit deletion confirmation; disabling notifications did not automatically call it. Exposing that policy over HTTP was still unsafe.
4. **H2: development/test safety guard, partial operational completion.** The shared Prisma client checks database targets before queries and on explicit connection. Outside `NODE_ENV=production`, remote ordinary production databases are rejected; localhost/Docker development targets and dedicated databases named `*_test` are allowed. Opt-in Adhkar/continuity suites that construct independent clients also check the target. Existing HTTP smoke scripts and administrative raw clients are not a substitute for this guard; run them only against a deliberately selected test deployment. No `.env` secrets were printed, rotated or copied into the new files. No separate running DB was provisioned here.
5. **M1:** rate-limit keys use a cryptographically verified access-token user ID, rather than hashing any caller-controlled bearer text. Invalid/expired/random tokens share the IP bucket. Keying by signed user identity also prevents refreshing a token from resetting a valid user's bucket. This remains an in-memory limiter; distributed storage is a separate item.
6. **M3 and part of M2:** password changes now use the registration password policy (8–128 characters, letter and number), plus five failed attempts per 15 minutes per authenticated account. Password update uses a compare-and-set inside a transaction and revokes refresh sessions in that transaction. Existing access JWTs are not instantly revoked by this patch; tokenVersion is not implemented.
7. **M6 stage isolation:** Azan, Salawat, Mulk, Duha, Qiyam and Khatmah failures are isolated so another reminder stage can still run. Existing newer stages retain their guards. This is fault isolation, not a queue/per-device ownership redesign or a benchmark of scheduler capacity.
8. **M8 dependencies:** ran nonbreaking `npm audit fix --ignore-scripts`. Results changed from 21 (1 critical, 9 high, 11 moderate) to 12 (0 critical, 4 high, 8 moderate). Remaining paths include Nodemailer, Prisma/deepmerge-ts and Firebase transitive dependencies. No `--force` major upgrades were applied. The remaining 12 are not declared safe or resolved; see the companion npm audit JSON.
9. **L1, partial:** cron secret comparison is timing-safe. Query-string secrets remain accepted for compatibility with existing scheduling; migration to headers and removal of query support remain open.
10. **L2:** the unbounded tokeninfo request is gone; see Google SDK timeout above.
11. **L4:** mapped Prisma errors no longer return `err.meta` in production. Development diagnostics remain separate.
12. **L5:** media origins prefer configured `PUBLIC_APP_ORIGIN` and otherwise use the canonical production origin. Only localhost development requests can derive an origin from the actual Host. Arbitrary forwarded hosts no longer influence returned audio URLs.
13. **L6, partial:** fixed suffix byte ranges such as `bytes=-128`, rejected zero/invalid suffixes, and clamped valid oversized end positions. A dedicated media bandwidth/rate policy is not implemented in this patch.
14. **L8:** tasbih increments are bounded to 1–1000 per request, so a single unbounded amount cannot overflow the count. This does not claim that every cumulative counter overflow scenario is solved.
15. **Deployment/CI:** added `preDeployCommand: npm run prisma:deploy` to Railway configuration; removed the convenience `prisma:push` npm command. Added GitHub Actions with a dedicated PostgreSQL 18 test container, migration deployment, type checking, security/notification/challenge tests and build. The workflow has not been executed on GitHub in this session. Added `ops/development/compose.yml` for an isolated local PostgreSQL 18 database.

## Required before deploying this patch

1. Ensure Railway explicitly runs `NODE_ENV=production`. Do not change a local development process to production merely to bypass the DB guard.
2. Set/confirm at least one actual trusted Noor audience on Railway. `GOOGLE_SERVER_CLIENT_ID` must match Flutter's `serverClientId` (usually the Web/server OAuth client ID). Add additional deliberately supported audiences through `GOOGLE_CLIENT_IDS` only when needed. Do not use wildcard audiences or blindly accept every client ID from another project. Empty configuration intentionally disables Google login with 503.
3. Apply **`20261020120000_challenge_claim_year`** before serving the updated source. It adds/backfills `year`, replaces the previous unique index and retains old rows. Backfill uses the user's saved valid timezone with Cairo fallback. The old schema cannot serve the new Prisma queries. Review row counts/duplicate indexes on a restored test database first. New code and old application instances must not continue writing concurrently through the migration; use a controlled rollout.
4. Verify the current encrypted backup/restore procedure, then run the migration and integration tests on a separate test database. The real PostgreSQL challenge migration/concurrency suite was **not executed locally** because no isolated running database/Docker CLI was available. An opt-in suite is supplied and wired into CI; simulated concurrency passing is not evidence that the migration was exercised on PostgreSQL.
5. Deploy the source after those checks, then test actual Google login with the release Android/iOS client, ordinary email login, refresh, challenge claim twice, next local-day behavior, and normal user-owned account deletion. Invalid-token tests do not replace a real Google integration test.

## Development database commands

Use a separate terminal/environment; do not overwrite/share production URLs or secrets:

```powershell
docker compose -f ops/development/compose.yml up -d
$env:NODE_ENV = 'test'
$env:DATABASE_URL = 'postgresql://noor_test:local_test_only@localhost:5433/noor_test'
$env:DIRECT_URL = $env:DATABASE_URL
$env:REMINDER_SCHEDULER_ENABLED = 'false'
npm run prisma:deploy
$env:SECURITY_DB_TEST = 'true'
npm run test:challenge-claim-db
```

The checked-in compose/CI passwords are only disposable local/test credentials, not production secrets. The compose database volume is separate from production. Do not rotate Railway/Firebase/email/JWT secrets without updating their consumers and planning the resulting session/service impact. Rotation remains a controlled operational task if credentials were exposed or access needs revocation.

## Flutter implications — send this section to the developer

- Google request path/body stays `POST /auth/google` with an ID token. Use Noor's configured `serverClientId`; Firebase or another app's unrelated token is not interchangeable. On 503 show temporary unavailability; on 401 offer retry/login. An unverified pre-existing LOCAL account may return 409 for linking: direct the user to their existing email/password verification flow, not repeated automatic linking. Do not disable server verification to accommodate a client mismatch.
- Challenge IDs remain day-of-year strings, but claims now accept today's saved-user-timezone challenge only. Fetch today's challenge on resume/day rollover and after a stale-day rejection. Do not claim cached IDs for arbitrary days. A duplicate claim returns 409; refresh the challenge/points instead of repeating requests. Do not award local speculative points.
- Password changes require 8+ characters containing a letter and a number; show server validation messages. Handle 429 with backoff. Refresh sessions are revoked after a password change: deliberately return to sign-in/explain this action, rather than showing it as an unexplained intermittent logout. No response token shape changed. Access-token immediate invalidation is still a separate server item.
- Audio endpoint origins are canonical; never construct native resource names from a URL. The earlier `FLUTTER_NOTIFICATION_AUDIO_AUDIT_HANDOFF_2026.md` still applies. Its client implementation/physical-device audio checks were not completed by these backend security changes.
- No Flutter screen should call the removed cleanup endpoint. Ordinary `DELETE /auth/me` remains the account-deletion flow.
- Existing 401/409/429 error handling must not turn validation/network/provider errors into unconditional logout loops. Keep refresh single-flight as already documented.

## Test evidence and limits

The new `test:security-hardening` uses real locally signed RSA JWTs and the actual Google SDK verification. Only Google's public-key fetch is replaced with a test key. It rejects wrong/missing audience, wrong issuer/signature, expired tokens and unverified/missing email; verifies fail-closed settings/alias support, unverified LOCAL-link rejection, invalid-token rate keys, password policy/session revocation, current-day/annual claims and removed destructive route. Challenge concurrency is simulated in this test.

`test:challenge-claim-db` additionally supplies an opt-in real PostgreSQL test with a dedicated schema in a safe database: actual migration/backfill, preserved historical claims, independent concurrent transactions and one points increment. It is not a test against the production database. It was skipped locally, not passed. CI is configured to run it on its disposable Postgres service.

Local checks completed: typecheck, Prisma generate/validate, build, security-hardening tests, refresh-rotation regression, near-prayer/FCM transport/public voice catalog checks (including hostile forwarded host and suffix Range cases), Adhkar reminder non-DB checks and challenge bank checks. Earlier challenge-bank assertions still expected monetary charity rewards; they were corrected to match the existing policy that charity amounts are not scored. The production scoring policy itself was not changed to make tests pass.

An early mocked challenge test accidentally reached an unmocked level-update call for the nonexistent fixture ID `u`; PostgreSQL rejected it with no row found and no record was updated. That mock was fixed and the non-production DB guard added before rerunning. Subsequent tests do not intentionally connect to production or send users notifications. This is another reason to require the separate DB guard rather than relying on test cleanup conventions.

## Audit findings still open or only partly addressed

1. **M2:** immediate access-token invalidation/tokenVersion. Password changes now revoke refresh sessions; currently issued access JWTs can survive until their existing expiry.
2. **M4:** refresh-family compromise/reuse policy. Do not blindly revoke every device on a simultaneous duplicate refresh request: that can recreate the legitimate Flutter race/logout problem. Existing atomic rotation/replay rejection tests pass; family semantics need a separately tested design.
3. **M5:** retention policy for logs/notifications/reset/refresh rows, including race-safe dedupe retention. No production history was purged.
4. **M7:** local-date consistency was improved for challenge selection/annual lookups, but this is not a completed audit of every ayah/tasbih/date helper and every display path. Removing old date helpers wholesale would require reviewing their distinct global/per-user uses.
5. **M8:** 12 advisory findings remain. Major Nodemailer/Prisma/Firebase upgrades need compatibility tests; no forced upgrade was hidden in this patch.
6. **M6 scaling:** indexed dispatch queue, measured capacity and distributed rate-limit storage remain future implementation work; an in-memory limiter is not cluster-wide protection.
7. **H2 operational:** provision/run the isolated dev DB, execute real migration/concurrency tests, separate developer credentials/roles and manage secret rotation as appropriate. Administrative raw clients, Prisma CLI and HTTP smoke scripts still require deliberate safe targets; the shared ORM guard cannot govern tools that bypass it.
8. **L1:** remove query-secret compatibility after updating the deployed cron callers to authorization headers.
9. **L3:** Swagger visibility is still a deliberate deployment setting, not silently disabled here. Public API documentation alone is not authorization; sensitive routes must retain authentication.
10. **L6:** dedicated media abuse/bandwidth controls and CDN strategy remain; Range parsing is fixed.
11. **L7:** global body-size limits were not lowered without checking client upload/offline-sync requirements. Per-route limits need a compatibility review.
12. **L9:** separate email-verification HMAC key and a complete username-policy reconciliation remain. Changing code keys blindly would invalidate in-flight verification codes.
13. **L10:** obsolete Vercel deployment/CORS configuration was not deleted without confirming all active deployment consumers.
14. **L11:** bookmark compatibility probes remain pending a schema-drift review and regression tests.
15. Repository/module formatting, file organization, controller consistency and broad refactoring remain maintenance tasks. No content-authenticity review, whole-app Flutter audit or 100% launch certification is implied.

Reference for the Google verification behavior: [Google's official backend ID-token verification guide](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
