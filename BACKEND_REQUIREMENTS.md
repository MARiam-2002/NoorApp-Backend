# Backend requirements — remaining ops only (Flutter perspective)

**Updated:** 2026-09-05  
**Send to Backend with:** [FLUTTER_TO_BACKEND_STATUS_REPLY.md](./FLUTTER_TO_BACKEND_STATUS_REPLY.md)  
Contract reference: [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md)  
Ops status reply: [BACKEND_OPS_STATUS.md](./BACKEND_OPS_STATUS.md)

Flutter base URL: `https://noor-app-backend-one.vercel.app/api/v1`

**Backend required APIs are Production-verified and Flutter has wired them** (including Local Azan client, azan prefs sync, and FCM token register/unregister). This file lists only remaining **ops / host** work.

---

## 1) Remaining backend ops

| Item | Notes | Done when | Status (2026-09-05) |
|------|-------|-----------|---------------------|
| Set Firebase credentials on Vercel | `FIREBASE_SERVICE_ACCOUNT_JSON` **or** `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | `GET /health` → `fcm.configured: true` | **Done** |
| External scheduler → `/cron/prayer-reminders` | ~every 10 minutes (Hobby Vercel cannot do sub-daily crons). Optional `CRON_SECRET` | Backup Azan pushes leave the server | **Workflow present** (`.github/workflows/prayer-reminder-cron.yml`) — set GitHub `CRON_SECRET` = Vercel `CRON_SECRET` if not already |
| Confirm password-reset inbox delivery | SMTP already `readyForDelivery` | One real mailbox receives reset email | **SMTP ready** — one human inbox QA still needed |

---

## 2) Production-verified (do not re-open as API blockers)

Auth, dashboard, journey (today/progress/patches/badges), Quran catalogs + audio/tafsir/translation, Adhkar, challenges, tasbih, qibla (calculate + my-qibla), notifications, profile (location + reading-preferences + `quranAutoScroll`), prayers schedule/today, `/profile/azan-preferences`, `/devices/fcm-token`.

**Alarm ownership:** Flutter local Adhan engine is source of truth. Backend schedule + FCM are sync / backup only.

---

## 3) Soft / optional (not blockers)

- Surah names never bare ids — hardened in Backend  
- EN counterparts on Arabic-first strings — present on journey/challenge/adhkar/tasbih  
- Badges payload polish when Flutter unlocks badges UI — `{ badges, streakDays }` already returned  
