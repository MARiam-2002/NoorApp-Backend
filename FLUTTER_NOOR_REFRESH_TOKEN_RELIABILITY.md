# Noor persistent login — definitive Flutter handoff

Updated: 2026-10-18. English integration guide. Supersedes the older version of FLUTTER_NOOR_REFRESH_TOKEN_RELIABILITY.md. Extend the existing auth implementation; do not add a second competing interceptor.

## Findings and limits

The current backend passed live refresh tests. No new backend code or contract change was necessary. This does not establish that the October 13 complaint originated in Flutter: no failing request sequence from that device/build was captured, and no Flutter repository was available for inspection.

Neon exhausted its compute allowance on October 16; later refresh calls failed with 500 DATABASE_ERROR. That confirms a later infrastructure incident, not the cause of every earlier logout. Production now uses Railway PostgreSQL. On October 18 the owner explicitly accepted fresh test data: old accounts and refresh-session rows were not migrated. Those old test sessions require one-time registration/login. Repeated hourly logout is not expected behaviour.

## Exact contract — unchanged

Base URL: https://noorapp-backend-production.up.railway.app/api/v1

Login: POST /auth/login, JSON email and password.

Refresh: POST /auth/refresh, Content-Type: application/json, JSON body:

    {"refreshToken":"<latest stored refresh token>"}

Refresh does not require an access token. Do not put the refresh token in Authorization or prevent refresh locally because access expired.

Logout: POST /auth/logout, JSON refreshToken. Protected requests use Authorization: Bearer <accessToken>. Profile endpoint is GET /profile/me, not GET /profile.

Successful login/refresh JSON contains:

    {
      "success": true,
      "data": {
        "user": {"id":"<user id>","email":"<email>"},
        "tokens": {
          "accessToken":"<new token>",
          "refreshToken":"<new token>",
          "expiresIn":3600
        }
      },
      "requestId":"<request id>"
    }

User fields above are abbreviated; preserve existing fields. Other metadata/message fields may exist. With Dio, read response.data['data']['tokens']. If an existing repository wrapper already unwraps data, do not unwrap it again. Do not accidentally read tokens from the top-level JSON object.

Production lifetimes observed: access 3,600 seconds; refresh JWT 7,776,000 seconds (90 days). expiresIn is SECONDS. Use actual response/JWT exp for scheduling; decoding exp is not signature verification. Access expiry is a renewal point, not a logout deadline.

## Backend rotation

Each successful refresh returns a NEW PAIR. Persist both tokens. The consumed refresh token is revoked; reuse returns 401 UNAUTHORIZED. Conditional consumption and replacement insertion are one transaction: a pre-commit replacement-storage failure rolls back consumption.

Only one concurrent consumer of a refresh token succeeds. One device's normal login/rotation does not invalidate the other device's independent session. Logout revokes the supplied refresh session.

There is no response-replay/grace mechanism. If refresh commits but its response is lost, retrying the old token can return 401. Do not claim uninterrupted login through every possible network/process failure, or let an HTTP retry plugin blindly replay refresh as though it were idempotent.

## One shared session coordinator

Keep the existing Dio/state-management/navigation architecture. All repositories for an account must share one refresh Future and one session owner.

Persist one secure-storage JSON record containing accessToken, refreshToken, expiresAt, userId, generation and version. Never store the password. Generation changes on login/logout/account switch; version advances with each successful token-pair replacement. Validate the complete record on startup.

Use a separate refresh transport without auth-refresh interception, or explicitly bypass it. Exclude login, refresh, logout, signup and password-reset routes from recursive interception. A QueuedInterceptor alone does not handle late 401 responses safely.

An in-memory Future only coordinates one Dart isolate. Background FCM handlers/isolates must not independently refresh against the same secure-storage token. Route session mutations through a single owner or implement real cross-isolate coordination.

## Recovery algorithm for protected requests

1. Attach the current access token and record the session generation/version in private request metadata.
2. On protected-request 401, do not immediately erase the session or navigate to login. Allow one recovery attempt.
3. If generation changed, cancel the old request. If version already advanced, retry once with the current access token WITHOUT consuming another refresh token.
4. Otherwise await the shared refresh Future, or create exactly one. Recheck version inside the coordinator before sending refresh.
5. Validate successful response, non-empty token fields, positive expiresIn and unchanged account identity.
6. Persist the complete new pair before resolving the shared Future/releasing waiting requests. Serialize storage writes, logout and account switch. A generation check before an awaited write is insufficient if logout can race during that write.
7. Recheck generation after network/storage operations. A delayed response must not resurrect a logged-out account or overwrite a new login.
8. Retry the original request ONCE, replacing its stale Authorization header. Mark it as already retried; never enter an infinite refresh loop.
9. Only replay replayable bodies. Rebuild FormData/streams and preserve existing request/operation keys; do not duplicate writes after ambiguous network outcomes.

Pseudocode:

    onProtected401(request):
      if request.authRetried: return failureWithoutLoop
      if request.generation != session.generation: cancelOldRequest
      if request.version == session.version:
          await coordinator.refreshSingleFlight(request.generation, request.version)
      if request.generation != session.generation: cancelOldRequest
      retryOnceWithCurrentAccessToken(request)

Optional proactive refresh (for example 60 seconds early) must use this same coordinator. Keep the 401 fallback for resume/sleep and clock differences; do not implement a second timer-owned refresh path.

## Error handling

- Protected 401 TOKEN_EXPIRED: coordinate refresh and retry once.
- Protected 401 INVALID_TOKEN/UNAUTHORIZED: one recovery attempt if a refresh session exists; account removal/inactivation can ultimately require login.
- Refresh 401 TOKEN_EXPIRED/INVALID_TOKEN/UNAUTHORIZED: require login only if this failure belongs to the STILL-CURRENT generation and refresh-token version. If another refresh won, use its current session instead of clearing it.
- 403: permission failure; do not refresh repeatedly or clear the session automatically.
- Refresh 400/404/422: investigate route/body/parsing; surface an integration error instead of silently logging out.
- Offline, DNS/socket/TLS errors, timeouts, 408, 429 and 5xx including DATABASE_ERROR: retain credentials and show retry/offline/server-unavailable state. Do not call logout or clear storage. Respect Retry-After when supplied.
- Secure-storage read/unwrapping failure: distinguish local storage failure from server session rejection; do not repeatedly wipe/recreate storage silently.
- Storage write fails AFTER successful refresh: old refresh token is already consumed. Keep the new pair pending securely in memory and retry persistence; do not resubmit the old token. If the process dies before persistence succeeds, reauthentication may be necessary.

A global 'any 401 => clearSession' or 'any DioException => logout' handler is incorrect for this contract.

## Startup and logout

Await secure-storage initialization before deciding whether to show login. A temporary null loading state is not evidence of logout. If access expired but a refresh token exists, recover when online; offline startup must not erase the session.

Inspect Android backup/restore/key-unwrapping behaviour for the installed secure-storage plugin version. Reinstallation/OS restoration differs from normal restart. Do not move tokens into plain SharedPreferences to hide storage errors.

Serialize explicit logout/account switch with persistence, increment generation and cancel old waiters. Late refresh responses must not write an old session back. Local explicit logout can complete if the network logout call fails. Never send the new account's token in an old session's delayed logout call.

## Safe diagnostics for any remaining unexpected logout

Collect: app build/flavour, OS version, time/timezone, method/path without sensitive queries, status, backend code/requestId, elapsed time, connectivity/lifecycle state, refresh-in-flight flag, request/session generation/version and explicit logout reason.

Reasons can distinguish USER_LOGOUT, REFRESH_REJECTED_CURRENT_SESSION, ACCOUNT_SWITCH, STORAGE_READ_FAILED, STORAGE_WRITE_FAILED, SERVER_UNAVAILABLE and NETWORK_UNAVAILABLE.

Never log raw JWTs, token hashes, Authorization, passwords, email addresses, request bodies for auth or secure-storage contents. Redact crash-report breadcrumbs. The backend blame field is a diagnostic hint, not proof that Flutter caused the failure.

## Verified evidence on 2026-10-18

Live checks used only the dedicated test account; the Google reviewer account was not modified:

- Two logins generated distinct refresh tokens.
- A genuinely signed expired ACCESS token for that test identity produced dashboard 401 TOKEN_EXPIRED.
- Refresh without access-token authentication succeeded; retry of the original dashboard request returned 200.
- Old refresh reuse returned 401.
- Four simultaneous refreshes returned one 200 and three 401. The winning pair remained usable for the next refresh and dashboard request.
- Session B refreshed successfully after session A rotated and logged out.
- Explicit session logout made subsequent refresh with that token return 401.
- Observed expiry values matched 1 hour / 90 days.

Local npm run test:refresh-rotation passed replacement-failure rollback, inactive/expired database session rejection, rotation, serialized claims and unchanged response fields. Rollback regression uses a mock transaction adapter; live concurrency used PostgreSQL. Expiry testing used a signed expired test access token, not an actual one-hour wait. No global JWT lifetimes or secrets were changed. Client-device lifecycle and storage correctness remain to be tested in Flutter.

## Flutter acceptance checklist

1. Ten protected requests hit expired access: ONE refresh call, then replayable requests succeed.
2. Late 401 after a newer pair was saved: reuse current access, no extra rotation/logout.
3. App close/reopen, resume after expiry and device sleep recover without a password prompt.
4. Offline/refresh 500/429 retain credentials and recover after connectivity/server returns.
5. Inject secure-storage read/write exceptions: explicit recovery state, no split token pair.
6. Logout/account switch during refresh or storage write cannot restore the old account.
7. Independent device sessions do not overwrite each other.
8. Confirmed invalid current refresh produces one login prompt and no recursive loop.
9. Correct nested data.tokens parsing and expiresIn seconds.
10. Test the installed Google Play build/flavour against production, not only debug.
11. Retry middleware does not blindly replay refresh after ambiguous timeouts.
12. Background isolates/FCM handlers cannot rotate independently of the foreground coordinator.

No new backend endpoint, Railway variable, migration or longer access-token lifetime is required. Keep unrelated Quran, notification, location and payment contracts unchanged.
