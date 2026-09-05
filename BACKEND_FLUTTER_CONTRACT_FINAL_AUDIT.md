# Backend ↔ Flutter Contract — Final Audit

**Date:** 2026-09-04  
**Production:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Sources of truth:**

- `FLUTTER_TO_BACKEND_STATUS_REPLY.md`
- `BACKEND_REQUIREMENTS.md`
- `BACKEND_DATA_CONTRACT.md`

---

## Implemented

Already live and accepted by Flutter (no new API design requested):

| Area | Endpoints / behavior |
|------|----------------------|
| Auth | sign-up, login, Google idToken, refresh, logout, forgot/reset |
| Dashboard | full sections; 5 Title-Case prayers; `quran.target=5`; boolean adhkar; fraction progress |
| Journey | today / progress / badges / PATCH prayer·adhkar·sadaqah / quran increment |
| Quran | catalogs + `resourceId`; audio/tafsir/translation aliases (`reciterId`/`tafsirId`/`translationId`); import-local; bookmarks/last-read/khatmah |
| Adhkar | home/categories/progress/favorites/search + EN fields |
| Challenges / Tasbih / Qibla / Notifications / Profile | as contracted; `quranAutoScroll`; `my-qibla` |
| Prayer | `/prayers/schedule`, `/prayers/today` (public with lat/lng), mark |
| Azan prefs | `GET/PATCH /profile/azan-preferences` (incl. `fcmPrayerBackupEnabled`) |
| FCM devices | `POST/DELETE /devices/fcm-token`, `GET /devices`, `POST /devices/test-push` |
| Cron | `GET/POST /cron/prayer-reminders` (secret / Vercel cron header) |
| Health | `email`, `quranFoundation`, **`fcm.configured`** |

**This session also added:**

- GitHub Actions workflow `.github/workflows/prayer-reminder-cron.yml` (every 10 minutes + manual dispatch) to satisfy Flutter’s external-scheduler ops requirement.
- Cron auth aligned to `env.CRON_SECRET` (Bearer / `x-cron-secret` / query / Vercel header).

---

## Fixed

| Issue | Resolution |
|-------|------------|
| External scheduler missing for Hobby Vercel | Added GitHub Actions cron workflow calling `/cron/prayer-reminders` |
| Cron secret reading inconsistency | Uses shared `env.CRON_SECRET` |

No Flutter contract payload mismatches found that required API shape changes in this pass (Flutter already **Accepted** the Production contract).

---

## Verified (Production smoke — 2026-09-04)

Scripted live checks against Production: **32/32 PASS**

| Check | Result |
|-------|--------|
| `GET /health` DB connected | PASS |
| `health.fcm.configured === true` | PASS |
| `health.email.readyForDelivery === true` | PASS |
| `/prayers/today?lat&lng&method&madhab` (5 Title-Case) | PASS |
| `/prayers/schedule` | PASS |
| Reciters (7 + resourceId) + audio via `reciterId` | PASS |
| Tafsir / translation via `tafsirId` / `translationId` | PASS |
| Auth sign-up + dashboard contract keys | PASS |
| Journey today / badges / PATCH `Asr` | PASS |
| Azan preferences GET/PATCH | PASS |
| FCM register (`fcmConfigured: true`) / list / test-push / delete | PASS |
| Location + `/qibla/my-qibla` | PASS |
| `quranAutoScroll` | PASS |
| Challenges today / notifications array / tasbih `dhikrEn` | PASS |
| Cron unauthorized without secret | PASS |
| Forgot-password API 200 | PASS |
| Surah names never bare ids | PASS |

Typecheck: `tsc --noEmit` clean.

---

## Tests

| Suite | Result |
|-------|--------|
| Production contract smoke (auth + Azan + FCM + Quran + journey + prayers) | **32/32 passed** |
| `npx tsc -p tsconfig.json --noEmit` | Pass |

---

## Remaining blockers (ops only — not API gaps)

Flutter explicitly stated: **no new required API work**; remaining items are hosting/ops.

| Item | Status | Action for host |
|------|--------|-----------------|
| Firebase credentials on Vercel | **Done** — Production `health.fcm.configured: true` | Keep credentials rotated/secure |
| External scheduler ~10 min | **Workflow added** in repo | 1) Ensure Vercel `CRON_SECRET` is set 2) Add same value as GitHub repo secret `CRON_SECRET` 3) Push/merge workflow to `main` so Actions runs |
| Password-reset inbox QA | SMTP `readyForDelivery: true` | Manually confirm one real mailbox receives a reset email |

Soft/optional Flutter asks (not blockers): already satisfied in Production (real surah names, EN fields on journey/challenge/adhkar/tasbih, `/journey/badges` payload exists; Flutter CTA still “Coming soon” by product choice).

---

## Final verdict

- **Backend API contract:** 100% compatible with the three Flutter files (Production-verified).  
- **FCM/Azan backend:** Implemented; Firebase Admin configured on Production; device APIs verified.  
- **Local Azan:** Remains Flutter-owned (unchanged).  
- **Unavoidable host steps:** Wire `CRON_SECRET` into GitHub Actions after push; optional one-time reset-email inbox confirmation.
