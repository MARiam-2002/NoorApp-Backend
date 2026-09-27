# Backend → Flutter — Google Play launch handoff (2026)

**Audience:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-19 (updated 2026-09-27)  
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
| More than 5 delete attempts / hour for the same user | 429 | `RATE_LIMIT_EXCEEDED` |

Client: on `TOKEN_EXPIRED`, refresh once and retry delete. On `429`, show `message` and do not auto-retry. On success, clear secure storage / local DB / caches and go to welcome/login.

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

1. **Account tab → Delete account** → confirm dialog → `DELETE /auth/me` → clear tokens/local DB → welcome/login.  
   The public pages tell users this exact path (matches `account_page.dart`, per the Flutter privacy audit 2026-09-26). **If it moves, tell Backend** so the pages match.  
2. Play listing: describe in-app deletion (this route).  
3. Public legal pages (hosted by Backend, no login, for Play Console):
   - Privacy Policy: `https://noorapp-backend-production.up.railway.app/privacy`
   - Account deletion: `https://noorapp-backend-production.up.railway.app/delete-account`
   
   Flutter may open these from Settings (e.g. "Privacy Policy") with `url_launcher`. They are **not** under `/api/v1`.  
4. Data safety form / SHA-1s: **not** Backend.

### Auth rate limits (all auth routes, 2026-09-27)

Same endpoints, same `429` + `RATE_LIMIT_EXCEEDED` envelope as before. Limits are now per account, so users sharing a mobile-carrier IP no longer block each other.

| Route | Limit |
|-------|-------|
| `POST /auth/login` | 10 **failed** attempts / 15 min per email (successful logins never count) |
| `POST /auth/sign-up` | 30 / hour per IP |
| `POST /auth/forgot-password` | 5 / hour per email |
| `POST /auth/reset-password` | 10 / hour per reset code |
| `DELETE /auth/me` | 5 / hour per user |

Double-tapping login/sign-up no longer returns `409`.

---

## P1 / P2 (ops, does not block Flutter delete UI)

| Item | Status (verified 2026-09-19) |
|------|--------|
| Canonical Production URL | **Railway** (this file). Vercel retired. |
| Prayer-reminder cron | Endpoint **live**: unauthenticated `POST /cron/prayer-reminders` → **401** `UNAUTHORIZED`. Cadence **`*/10 * * * *`** on Railway Cron. Confirm the dashboard job is **enabled**. |
| FCM backup sends | Production `GET /api/v1/health` → **`fcm.configured: true`** (re-checked 2026-09-27). Local Azan remains source of truth. |
| Password-reset SMTP | **`email.readyForDelivery: true`** (`provider: smtp`). One real inbox round-trip is still human QA. No new API. |

---

## Verification log (Backend, 2026-09-19)

**P0 is live on Production.** Flutter can implement the in-app delete flow against the Railway URL.

| Check | Result |
|-------|--------|
| DB hard-delete + cascade (Neon) | **PASS** — user row, FCM devices, refresh tokens, notifications gone; identity blocked; login/refresh 401 |
| `GET /health` Production | **200** `status: ok`, `database: connected`, `email.readyForDelivery: true`, `fcm.configured: false` |
| `DELETE /auth/me` no token | **401** `UNAUTHORIZED` (route exists) |
| `POST /cron/prayer-reminders` no secret | **401** `UNAUTHORIZED` |
| Production smoke `npm run test:account-delete` | **PASS** — signup → FCM register → `DELETE /auth/me` **200** `{ deleted: true, deletedAt }` → `GET /auth/me` 401 → login 401 → refresh 401 → google 401 → second delete 401 |
| Cron unit auth (`npm run test:production-fixes`) | **PASS** |

Acceptance vs spec:

- [x] Authenticated delete endpoint live on Production  
- [x] Documented (`DELETE /auth/me`, no body, errors above)  
- [x] After delete: login 401; Google 401 (does not restore)  
- [x] After delete: refresh 401  
- [x] After delete: FCM rows gone (DB check + token registered before HTTP delete)  
- [x] Smoke + curl shared in this file
