# Noor Refresh Token Reliability — Flutter Handoff

Date: 2026-10-11. Backend change is local; deploy before verifying production.

## Compatibility

No endpoint, request field, response envelope, token field, or database schema changed. POST /api/v1/auth/refresh remains public (no access token required), with JSON {"refreshToken":"<stored refresh token>"}. Read response.data.tokens from the JSON response: accessToken, refreshToken, expiresIn (seconds). The user field remains unchanged. Existing configured token lifetimes remain unchanged. No Railway variable or migration is needed.

## Backend fix

Conditional revocation and replacement insertion now run in one database transaction. If signing, user validation or replacement storage fails, revocation rolls back. Conditional update requires the matching user, unrevoked token and unexpired database expiry. Concurrent transactions cannot both successfully consume the same token. One succeeds; later reuse receives the existing 401 error. This is not a replay-grace feature.

## Required Flutter session handling

Use one shared refresh future across all API clients/interceptors. Concurrent expired-access-token requests wait for that same future rather than calling refresh independently. Exclude login/refresh/logout endpoints from recursive refresh interception. On successful refresh, persist BOTH new tokens together in secure storage before releasing waiting requests. Replace their Authorization header and retry each original request at most once. expiresIn is seconds, not milliseconds.

Keep a session generation marker: a delayed refresh result must not resurrect a logged-out session or overwrite a newer login. Startup reads the persisted session; use refresh if access has expired. Do not force logout on a network timeout, offline state, 429 or 5xx; keep credentials and show a retry state. A protected request 401 alone is not grounds for immediate logout: attempt the coordinated refresh first. A confirmed invalid/expired refresh 401 can require login, after checking no other successful refresh has already replaced the token. Do not log credentials or token bodies.

If refresh committed but its response was lost, retrying the old token can receive 401. Atomic rotation does not eliminate this ambiguous network failure; no transparent replay mechanism is implemented. Do not promise uninterrupted sessions under every network condition.

## QA and deployment

Backend npm run test:refresh-rotation covers rollback on replacement failure, response field compatibility, normal rotation, old-token reuse, serialized concurrent claims, inactive user and database expiry with a mock transactional adapter. npm run typecheck checks TypeScript. Mock tests do not replace PostgreSQL concurrency or physical-device testing.

Upload backend changes and allow Railway deployment. Then verify login -> refresh -> protected request -> second refresh. Flutter must test ten simultaneous expired-token requests (one refresh call), application restart, storage failure, offline resume, refresh 5xx, logout during refresh and multiple devices. Do not change existing user location, notification settings or Quran progress as part of this fix.
