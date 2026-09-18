# Backend → Flutter — Play launch reply

**From:** Noor Backend  
**To:** Flutter (`com.noor.app`)  
**Updated:** 2026-09-19  
**Production base URL (Play builds only):** `https://noorapp-backend-production.up.railway.app/api/v1`  
**Retired:** `https://noor-app-backend-one.vercel.app/api/v1` (do not use for release QA)

---

## 1) Chosen path

**`DELETE /auth/me`** (Option A). Bearer access token. No body. No password confirm (Google-only accounts included).

## 2) Production URL

`https://noorapp-backend-production.up.railway.app/api/v1`

## 3) Delete model

**Immediate hard-delete.** No grace period. User-owned rows cascade away (sessions, FCM devices, journey, challenges, tasbih, khatmah, notifications, ayah history, azan prefs). Email + Google `sub` are stored in `deleted_identities` so **`POST /auth/login` and `POST /auth/google` return 401** for that identity (do not recreate the old account). `POST /auth/refresh` with old tokens returns 401. Explicit `POST /auth/sign-up` with the same email creates a **new empty** account and clears the block.

## 4) Curl (Production)

```bash
# 1) Sign up (throwaway)
curl -sS -X POST "https://noorapp-backend-production.up.railway.app/api/v1/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Play Delete","email":"play-delete-qa@example.com","password":"PlayDelete123!"}'

# 2) Delete (use accessToken from step 1)
curl -sS -X DELETE "https://noorapp-backend-production.up.railway.app/api/v1/auth/me" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json"

# Expected 200:
# { "success": true, "message": "Account deleted", "data": { "deleted": true, "deletedAt": "…" }, "meta": {}, "timestamp": "…", "requestId": "…" }

# 3) After delete — all 401
curl -sS -X POST "https://noorapp-backend-production.up.railway.app/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"play-delete-qa@example.com","password":"PlayDelete123!"}'

curl -sS -X POST "https://noorapp-backend-production.up.railway.app/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'

curl -sS "https://noorapp-backend-production.up.railway.app/api/v1/auth/me" \
  -H "Authorization: Bearer <accessToken>"
```

Automated: `npm run test:account-delete` (or `API_BASE=… npx tsx scripts/smoke-account-delete.ts`).

## 5) Cron live

**Endpoint:** live (`POST`/`GET` `/cron/prayer-reminders`, `401` without `CRON_SECRET`).  
**Scheduler:** Railway Cron only, cadence **`*/10 * * * *`**. GitHub Actions workflow is disabled (emergency dispatch only).  
**Ops check still required** on the Railway dashboard: confirm the cron job is enabled in Production and that a run no-ops or delivers for a token+prefs test user (`noorapp-d5d7d`). Payload types unchanged: `AZAN`, `TEST`.

Local Azan remains source of truth; FCM is backup when `fcmPrayerBackupEnabled: true`.

---

## Errors (`DELETE /auth/me`)

| Condition | HTTP | `code` |
|-----------|------|--------|
| Missing token | 401 | `UNAUTHORIZED` |
| Invalid token | 401 | `INVALID_TOKEN` |
| Expired access token | 401 | `TOKEN_EXPIRED` |
| Already deleted | 401 | `UNAUTHORIZED` |

P2 SMTP: no API change; `GET /health` already reports `email.readyForDelivery: true`.
