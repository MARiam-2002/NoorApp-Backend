# Backend requirements for Google Play launch

**Audience:** Backend / ops  
**From:** Flutter (`com.noor.app`)  
**Updated:** 2026-09-18  
**Related:** [RELEASE_QA_CHECKLIST.md](./RELEASE_QA_CHECKLIST.md) · [FLUTTER_BACKEND_READY_HANDOFF.md](./FLUTTER_BACKEND_READY_HANDOFF.md) · [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md)

**Backend → Flutter reply (2026):** [FLUTTER_PLAY_LAUNCH_HANDOFF_2026.md](./FLUTTER_PLAY_LAUNCH_HANDOFF_2026.md)

Google Play requires apps that create accounts to offer **account deletion**.

---

## Priority summary

| Priority | Item | Type | Blocks Play? | Backend status (2026-09-19) |
|----------|------|------|--------------|-----------------------------|
| **P0** | Account deletion API | New endpoint + data cleanup | **Yes** | Implemented: `DELETE /auth/me` (hard-delete + identity block). Live on Production only after Railway deploy. |
| **P1** | Live cron for `/cron/prayer-reminders` | Ops / scheduler | No | Endpoint live (`401` without secret). Railway Cron `*/10 * * * *` — confirm job enabled in dashboard. |
| **P1** | Confirm Production base URL | Ops / docs | No | Canonical: `https://noorapp-backend-production.up.railway.app/api/v1`. Vercel retired. |
| **P2** | Real mailbox check for password-reset SMTP | Ops QA | No | No API change. `email.readyForDelivery` on `/health`. |

Privacy policy URL, Data safety form, store listing, and OAuth SHA-1s are **not** Backend API work.

---

## P0 — Chosen contract

| Option | Method | Path | Auth |
|--------|--------|------|------|
| **A (shipped)** | `DELETE` | `/auth/me` | Bearer access token |

- Body: none  
- Google-only: no password  
- Success: HTTP **200** + envelope `{ deleted: true, deletedAt }`  
- Cleanup: hard-delete user; cascade sessions, FCM devices, profile/prefs, journey, challenges, tasbih, Quran/khatmah, notifications, provider links  
- After delete: login / Google / refresh → **401**  
- Explicit `POST /auth/sign-up` with the same email creates a **new empty** account  

Smoke: `npm run test:account-delete`  
DB checks (needs `DATABASE_URL`): `npm run test:account-delete-db`  
Production probes: `npm run test:play-launch`

---

## P1 — Cron

- `POST`/`GET` `/cron/prayer-reminders`  
- Auth: `Authorization: Bearer <CRON_SECRET>`  
- Cadence: `*/10 * * * *` (Railway only; GitHub Actions disabled)  
- Firebase: **`noorapp-d5d7d`**  
- Payload types: `AZAN`, `TEST`  
- Local Azan remains source of truth  

---

## P1 — Production URL

Play builds must use:

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

Retired:

```text
https://noor-app-backend-one.vercel.app/api/v1
```
