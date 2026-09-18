# Backend → Flutter — Google Play launch handoff (2026)

**Audience:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-19  
**Spec:** `BACKEND_REQUIREMENTS_FOR_GOOGLE_PLAY_LAUNCH.md`

Use this file to wire in-app account deletion and point **Play / closed-testing builds** at Production.

---

## Reply (template)

| # | Item | Backend answer |
|---|------|----------------|
| 1 | Chosen path | **`DELETE /auth/me`** (Option A). Bearer access token. **No body.** Google-only accounts do **not** send a password. |
| 2 | Production URL (Play builds) | **`https://noorapp-backend-production.up.railway.app/api/v1`** |
| 3 | Delete model | **Immediate hard-delete** (no grace period). User row + cascaded user data removed. Email/Google identity is blocked from login/Google until a **new** `POST /auth/sign-up` with that email. |
| 4 | Curl | See below. |
| 5 | Cron live | **Endpoint live.** Scheduler is Railway Cron **`*/10 * * * *`**. Missing `CRON_SECRET` → `401`. Ops must confirm the Railway job is enabled in the dashboard. Firebase project: **`noorapp-d5d7d`**. Payload `type`: `AZAN` / `TEST`. |

**Retired host (do not use for Play QA):** `https://noor-app-backend-one.vercel.app/api/v1`

---

## `DELETE /auth/me`

### Request

```http
DELETE /api/v1/auth/me
Authorization: Bearer <accessToken>
```

No JSON body.

### Success (HTTP 200)

```json
{
  "success": true,
  "message": "Account deleted",
  "data": {
    "deleted": true,
    "deletedAt": "2026-09-18T12:00:00.000Z"
  },
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Errors (unchanged auth codes)

| Condition | HTTP | `code` |
|-----------|------|--------|
| Missing token | 401 | `UNAUTHORIZED` |
| Invalid token | 401 | `INVALID_TOKEN` |
| Expired access token | 401 | `TOKEN_EXPIRED` |
| Already deleted | 401 | `UNAUTHORIZED` |

Client: on `TOKEN_EXPIRED`, refresh once and retry delete. On success, clear secure storage / local DB / caches and go to welcome/login.

### After delete

| Call | Expected |
|------|----------|
| `POST /auth/login` same email/password | **401** (`INVALID_CREDENTIALS` or `UNAUTHORIZED`) |
| `POST /auth/google` same Google identity | **401** (does **not** recreate the old account) |
| `POST /auth/refresh` old refresh token | **401** |
| `GET /auth/me` old access token | **401** |
| FCM rows for that user | Removed (cascade). Pushes cannot target them. |

Returning later: **`POST /auth/sign-up`** with the same email creates a **new empty** account. Old journey/Quran/FCM data is never restored.

Existing routes (`POST /auth/sign-up`, `/login`, `/google`, `/refresh`, `/logout`, `GET /auth/me`) are unchanged.

---

## Curl (Production)

```bash
BASE="https://noorapp-backend-production.up.railway.app/api/v1"

# Sign up (throwaway QA user)
curl -sS -X POST "$BASE/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Play Delete","email":"play-delete-qa@example.com","password":"PlayDelete123!"}'

# Delete — paste accessToken from the previous response
curl -sS -X DELETE "$BASE/auth/me" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json"

# Expect 401 after delete
curl -sS -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"play-delete-qa@example.com","password":"PlayDelete123!"}'

curl -sS -X POST "$BASE/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

Automated: `npm run test:account-delete`

---

## Flutter follow-up

1. Account screen: Delete account → confirm dialog → `DELETE /auth/me` → clear tokens/local DB → welcome/login.  
2. Play listing: describe in-app deletion (this route).  
3. Privacy policy / Data safety / SHA-1s: **not** Backend.

---

## P1 / P2 (ops, does not block Flutter delete UI)

| Item | Status |
|------|--------|
| Canonical Production URL | Railway URL above. Vercel retired. |
| Prayer-reminder cron | HTTP endpoint ready (`401` without secret). Cadence `*/10 * * * *` on Railway. Confirm dashboard job is **enabled**. Local Azan remains source of truth. |
| Password-reset SMTP | No new API. `GET /health` → `email.readyForDelivery`. One real inbox round-trip is human QA. |

---

## Verification log (Backend, 2026-09-19)

Filled after running probes in this repo. If Production still returns **404** on `DELETE /auth/me`, the branch is **not deployed yet** — Flutter should wait for Railway deploy before wiring closed testing against this route.

| Check | Result |
|-------|--------|
| Typecheck | See terminal run |
| Cron auth unit tests (`npm run test:production-fixes`) | See terminal run |
| `GET /health` Production | See terminal run |
| `DELETE /auth/me` unauthenticated → 401 | See terminal run |
| `POST /cron/prayer-reminders` no secret → 401 | See terminal run |
| Full signup→delete smoke | Run after deploy: `LIVE_SMOKE=1 npm run test:play-launch` |
