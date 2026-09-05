# Backend ops status — reply to Flutter (2026-09-05)

**Audience:** Flutter / Noor app  
**Production:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Re:** [BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md), [FLUTTER_TO_BACKEND_STATUS_REPLY.md](./FLUTTER_TO_BACKEND_STATUS_REPLY.md)

---

## Ops checklist from Flutter §3

| Priority | Item | Status | Evidence |
|----------|------|--------|----------|
| P0 | Firebase credentials on Vercel | **Done** | `GET /health` → `fcm.configured: true` |
| P0 | External scheduler → `/cron/prayer-reminders` ~10 min | **Wired in repo** — confirm GitHub secret | Workflow: `.github/workflows/prayer-reminder-cron.yml` (`*/10 * * * *`). Requires repo secret `CRON_SECRET` matching Vercel `CRON_SECRET`. Endpoint returns `401` without secret (expected). |
| P1 | Confirm one real password-reset inbox delivery | **SMTP ready** — needs one human inbox QA | `GET /health` → `email.readyForDelivery: true`, `provider: smtp`. `POST /auth/forgot-password` returns generic 200. |

---

## Verify commands

```http
GET /api/v1/health
```

Expect:

```json
{
  "fcm": { "configured": true },
  "email": { "configured": true, "provider": "smtp", "readyForDelivery": true }
}
```

```bash
# Manual cron (replace secret)
curl -X POST 'https://noor-app-backend-one.vercel.app/api/v1/cron/prayer-reminders' \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## API contract

Flutter’s Production-verified contract remains accepted. No new Azan/FCM API design is required.

Additional Backend hardening shipped 2026-09-05 (compatible with the contract):

- `GET /adhkar` (+ daily-wird / category-by-key) personalizes when Bearer is present  
- Quran audio/tafsir/translation catalog match by numeric `resourceId`  
- Soft: never bare surah id strings; dashboard error fallback still returns 5 prayer rows  
- Cron prayer-reminder idempotency (no duplicate AZAN within the cron window)

Please finish device QA for FCM backup once a real FCM token is registered under Firebase project `noorapp-d5d7d` / app id `com.noor.app`.
