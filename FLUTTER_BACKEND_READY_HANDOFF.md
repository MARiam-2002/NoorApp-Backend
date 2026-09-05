# Backend Data Contract — Reply to Flutter

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-05  
**Language:** English only  

**Reply to:**  
- [`BACKEND_REQUIREMENTS.md`](./BACKEND_REQUIREMENTS.md)  
- [`BACKEND_DATA_CONTRACT.md`](./BACKEND_DATA_CONTRACT.md)  
- [`FLUTTER_TO_BACKEND_STATUS_REPLY.md`](./FLUTTER_TO_BACKEND_STATUS_REPLY.md)  

This document is the **verified** Backend → Flutter handoff after Production testing and Backend fixes.  
**Live Cron Job execution was postponed** (as you requested) until after deploy. Cron **auth protection** was still verified.

---

## Status snapshot

| Area | Status |
|------|--------|
| Core API (auth, dashboard, journey, Quran, Adhkar, challenges, tasbih, qibla, profile, notifications) | **Production-verified** |
| Quran catalogs + audio/tafsir/translation (`resourceId` aliases) | **Production-verified** |
| Prayer schedule (public + auth) | **Production-verified** |
| Azan preferences sync | **Production-verified** |
| FCM device-token API | **Production-verified** |
| FCM send capability | **Done** — `health.fcm.configured: true` |
| Password-reset SMTP | **Ready** — `email.readyForDelivery: true` |
| External cron → `/cron/prayer-reminders` | **Endpoint ready** — live scheduler test **postponed** until deploy |
| Soft asks (surah names, EN fields, badges shape) | **Verified** |

**Backend side = complete and ready for Flutter** against the three reference docs.

---

## Overall verdict

| Layer | Status |
|-------|--------|
| Required Backend API contract | **Accepted / ready** — no new required endpoints beyond what Flutter already wired |
| Backend ops from your §3 | Firebase **done**; cron **prepared** (live run after deploy); SMTP **ready** |
| Flutter work | Client already implemented; finish **device FCM QA** + optional reset-email inbox check |

**No new Azan / FCM / prayer API redesign is required.**  
Local Azan remains the alarm source of truth. Backend schedule + FCM are sync / backup only.

---

## What Backend fixed / updated (this pass)

1. **Production signup `DATABASE_ERROR`** — root cause was a pending DB migration (`salawat_reminders` adding `users.salawatReminderEnabled`). Migration applied to Production Neon. **`POST /auth/sign-up` now returns 201** with tokens.  
2. **Prisma error logging** — server logs now include Prisma codes for `DATABASE_ERROR` (ops debugging).  
3. **Username uniqueness fallback** — if case-insensitive username lookup fails, exact match is used (signup resilience).  
4. **Ops confirmation** — `fcm.configured: true`, SMTP `readyForDelivery: true`.  
5. **Contract re-audit** — full Production suite re-run (113+ checks); only non-blocking rate-limit noise on a duplicate forgot-password probe.

---

## 0) Envelope (unchanged)

### Success

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Error

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | INVALID_TOKEN | TOKEN_EXPIRED | VALIDATION_ERROR | NOT_FOUND | RATE_LIMIT_EXCEEDED | DATABASE_ERROR | …",
  "details": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Auth rules

| Condition | Flutter action |
|-----------|----------------|
| `401` + `INVALID_TOKEN` | Clear session |
| `401` + `TOKEN_EXPIRED` | `POST /auth/refresh` once, retry |
| Network / 5xx on profile | Do **not** hard-logout |

Login/signup/Google/refresh return:

```json
{
  "user": { "id": "…", "email": "…", "fullName": "…" },
  "tokens": { "accessToken": "…", "refreshToken": "…", "expiresIn": 3600 }
}
```

---

## 1) Health — Production-verified

`GET /health` (public)

```json
{
  "status": "ok",
  "database": "connected",
  "environment": "production",
  "email": { "configured": true, "provider": "smtp", "readyForDelivery": true },
  "quranFoundation": { "oauthConfigured": true },
  "fcm": { "configured": true }
}
```

### Ops vs your §3

| Priority | Item | Result |
|----------|------|--------|
| P0 | Firebase → `fcm.configured: true` | **Done** |
| P0 | External scheduler → `/cron/prayer-reminders` ~10 min | **Prepared** — live test **postponed**. Without secret → `401 UNAUTHORIZED` (verified). Workflow: `.github/workflows/prayer-reminder-cron.yml` |
| P1 | Real password-reset inbox | SMTP ready — optional one-mailbox QA |

---

## 2) Authentication — Production-verified

| Method | Path | Body |
|--------|------|------|
| POST | `/auth/sign-up` | `{ fullName, email, password, username? }` → **201** + tokens |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/google` | `{ idToken }` from **google_sign_in** |
| POST | `/auth/forgot-password` | `{ email }` → always generic 200 |
| POST | `/auth/reset-password` | `{ token, password }` or `{ token, newPassword }` |
| POST | `/auth/refresh` | `{ refreshToken }` |
| POST | `/auth/logout` | refresh revoke |

---

## 3) Dashboard (auth) — Production-verified

`GET /dashboard`

Required keys present: `greeting`, `prayers`, `verseOfTheDay`, `hadithOfTheDay`, `dailyJourney`, `khatmah`, `dailyChallenge`, `utilities`.

Verified rules:

- Exactly **5** prayer rows  
- `dailyJourney.adhkar.completed` boolean  
- `dailyJourney.prayer.progress` in `0..1`  
- `dailyJourney.quran.target` = `5`  
- Real `khatmah.surahNameAr` (not bare id)  
- Challenge `titleEn` / `descriptionEn`  
- `utilities.tasbih.enabled: true`

---

## 4) Journey (auth) — Production-verified

| Method | Path | Body |
|--------|------|------|
| GET | `/journey/today` | — |
| GET | `/journey/progress?days=7` | |
| GET | `/journey/badges` | → `{ badges, streakDays }` |
| PATCH | `/journey/prayer` | `{ "prayer": "Asr", "completed": true }` |
| PATCH | `/journey/adhkar` | `{ "categoryKey": "GENERAL_WIRD", "completed": true }` |
| PATCH | `/journey/sadaqah` | `{ "amount": 10 }` |
| POST | `/journey/quran-pages/increment` | `{ "pages": 1 }` |

Badges CTA may stay “Coming soon” in the app — payload is ready.

---

## 5) Quran — Production-verified

### Catalogs (public)

**Reciters:** Mishary_Alafasy(7), Abdul_Basit(2), Mahmoud_Al_Husary(6), Abdurrahman_As_Sudais(3), Saud_Ash_Shuraym(10), Muhammad_Siddiq_Al_Minshawi(9), Minshawi_Mujawwad(8)

**Tafsirs / Translations:** as in `BACKEND_DATA_CONTRACT.md` (sample set verified)

### Content aliases

| Method | Path | Query aliases |
|--------|------|---------------|
| GET | `/quran/audio` | `reciter` / `reciterId` / `id` + `surahId` + `ayahNumber` |
| GET | `/quran/tafsir` | `source` / `tafsirId` / `id` |
| GET | `/quran/translation` | `source` / `translationId` / `id` |

Verified: `reciterId=2` and `reciterId=Abdul_Basit` both resolve to Abdul Basit; tafsir `14` and translation `20` return text.

Surah `nameAr` sample: no bare numeric ids.

Bismillah/BOM hygiene is server-side — Flutter must **not** re-strip.

Reading prefs wire key: **`quranAutoScroll`** (legacy `quranAutoScrollEnabled` still returned).

---

## 6) Adhkar — Production-verified

| Method | Path | Auth |
|--------|------|------|
| GET | `/adhkar` | Public (+ personalized when Bearer) |
| GET | `/adhkar/progress?categoryKey=` | Auth |
| PUT | `/adhkar/progress` | Auth |
| GET/POST/DELETE | `/adhkar/favorites` | Auth |
| GET | `/adhkar/search?q=` | Public |

Public home includes `dailyWird`, `categories`, `greetingEn`, `titleEn`, `ctaEn`.

---

## 7) Challenges / Tasbih / Qibla / Notifications / Profile

| Area | Status |
|------|--------|
| Challenges list/today/claim | Production-verified |
| Tasbih today + increment (`dhikrEn`) | Production-verified |
| Qibla calculate + `my-qibla` after location | Production-verified |
| Notifications list / unread / read-all | Production-verified |
| Profile me + reading-preferences + azan-preferences | Production-verified |

---

## 8) Prayer / Azan — Production-verified

| Method | Path | Auth |
|--------|------|------|
| GET | `/prayers/schedule?lat=&lng=&method=&madhab=` | Public |
| GET | `/prayers/today?lat=&lng=&method=&madhab=` | Public coords; auth optional |
| GET | `/prayers/today` | Auth |
| PATCH | `/prayers/:id/mark` | Auth |
| GET/PATCH | `/profile/azan-preferences` | Auth |

Methods: `EGYPT` (default), `MWL`, `MAKKAH`, `KARACHI`, `ISNA`, `TEHRAN`. Madhab: `SHAFI` / `HANAFI`.

Azan preferences shape (verified keys including `fcmPrayerBackupEnabled`):

```json
{
  "azanEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "voiceId": "makkah",
  "calculationMethod": "EGYPT",
  "madhab": "SHAFI",
  "preReminderMinutes": 15,
  "preReminderEnabled": true,
  "prayers": { "fajr": true, "dhuhr": true, "asr": true, "maghrib": true, "isha": true },
  "lastLat": 30.0444,
  "lastLng": 31.2357,
  "lastLocationLabel": "Cairo",
  "fcmPrayerBackupEnabled": true
}
```

**Alarm source of truth:** Flutter local Adhan engine.

---

## 9) FCM / devices — Production-verified

| Method | Path | Body |
|--------|------|------|
| POST | `/devices/fcm-token` | `{ "token" }` or `{ "fcmToken" }`, optional `platform`, `appVersion`, `locale` |
| DELETE | `/devices/fcm-token` | same |
| GET | `/devices` | device list |
| POST | `/devices/test-push` | optional title/body |
| GET/POST | `/cron/prayer-reminders` | protected by `CRON_SECRET` |

Register / unregister / list verified on Production.

Firebase project for tokens: **`noorapp-d5d7d`**, app id **`com.noor.app`**.  
Handle data types: `AZAN`, `TEST`.

---

## Soft / optional (your §5)

| Ask | Backend |
|-----|---------|
| Never bare surah names | Verified |
| EN counterparts | Present (adhkar / challenge / tasbih) |
| Journey badges | `{ badges, streakDays }` ready |

---

## What is ready for Flutter

- Full Production contract from the three docs  
- Auth signup/login/refresh/logout/forgot-password  
- Dashboard, journey, Quran catalogs/content, Adhkar, challenges, tasbih, qibla, notifications, profile, prayers, azan prefs, FCM token APIs  
- `fcm.configured: true` so push **send** can leave the server  

**No Backend API blockers** remain for the three reference documents.

---

## What the Flutter developer needs to do

1. Continue using the existing Production base URL and wired contract (no redesign).  
2. **FCM device QA** (now unblocked):  
   - Request notification permission  
   - `POST /devices/fcm-token` with a real FCM token from `noorapp-d5d7d` / `com.noor.app`  
   - Optional `POST /devices/test-push`  
   - Confirm handlers for `type=AZAN` and `type=TEST`  
   - Keep **Local Azan primary**; FCM is backup only  
3. Optional: one real password-reset email to a mailbox you control.  
4. After Backend deploy of cron secret alignment: expect backup Azan pushes when `fcmPrayerBackupEnabled: true` and a device token exists.

---

## Remaining items (not Backend API gaps)

| Item | Owner | Notes |
|------|-------|-------|
| Live cron every ~10 minutes | Backend ops + Flutter QA | **Postponed** until Vercel/Railway deploy; endpoint + GitHub workflow already exist |
| Real-device FCM delivery | Flutter | Requires real FCM token on device |
| Password-reset inbox QA | Shared | SMTP ready |
| Real-device Azan after kill/reboot / offline | Flutter | Local engine ownership |

---

## Ownership (unchanged)

| Feature | Backend | Flutter |
|---------|---------|---------|
| Auth / JWT / dashboard / journey / notifications | Owns | UI + token storage |
| Quran content + catalogs + audio | Owns | Reader + player |
| Prayer schedule API | Owns | Display / optional sync |
| Azan preferences sync | Owns | Settings UI + local cache |
| FCM token storage + send | Owns (`fcm.configured: true`) | Token registration + handlers |
| Local Azan alarms / sound / permissions / offline | — | **Owns** |

---

## Production URLs

```text
https://noor-app-backend-one.vercel.app/api/v1/health
https://noor-app-backend-one.vercel.app/api/v1
```

---

*Backend handoff complete for Flutter against the three reference docs (2026-09-05). Live Cron Job test intentionally deferred until deploy.*
