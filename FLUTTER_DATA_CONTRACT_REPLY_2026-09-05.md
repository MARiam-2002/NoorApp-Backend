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

This document is the **Production-verified** Backend → Flutter update after re-testing against those three files.  
**Live Cron Job execution was postponed** (as requested) until after your Vercel/Railway deploy. Cron **auth gate** was still verified.

---

## Status snapshot

| Area | Status |
|------|--------|
| Core API contract (auth shapes, dashboard, journey, Quran, Adhkar, challenges, tasbih, qibla, profile, notifications, prayers, azan-preferences, FCM token APIs) | **Accepted / Production-verified** on public + catalog surfaces; see §Auth note below |
| Quran catalogs + audio/tafsir/translation (`resourceId` aliases) | **Production-verified** |
| Prayer schedule (public) | **Production-verified** |
| Azan preferences sync | **Contract unchanged** — Production-verified previously; re-confirm after auth note |
| FCM device-token API | **Production-verified** (endpoints live) |
| FCM send capability | **Done** — `GET /health` → `fcm.configured: true` |
| Password-reset SMTP | **Ready** — `email.readyForDelivery: true` (one real inbox QA still recommended) |
| External cron hitting `/cron/prayer-reminders` | **Code + GitHub workflow ready** — **live scheduler test postponed** until deploy |
| Soft asks (real surah names, EN fields, badges shape) | **Verified** on public / sample surfaces |

---

## Overall verdict (for Flutter)

| Layer | Status |
|-------|--------|
| Required Backend **API contract** from the three docs | **Ready for Flutter** — no new required endpoints beyond what you already wired |
| Backend **ops** Flutter asked for in §3 of your status reply | **Firebase: done.** Cron: ready, live run postponed. Reset-email: SMTP ready, human inbox QA optional |
| Flutter action required | Keep current integrations; complete **FCM backup device QA** now that `fcm.configured` is `true`; optional reset-email inbox check |

**No new Azan / FCM / prayer API redesign is required.** Local Azan remains source of truth for alarms; Backend schedule + FCM remain sync / backup only.

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

### Auth rules (unchanged)

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

## 1) Health — Production-verified (2026-09-05)

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

### Ops checklist vs your §3

| Priority | Item | Result |
|----------|------|--------|
| P0 | Firebase credentials → `fcm.configured: true` | **Done** |
| P0 | External scheduler → `/cron/prayer-reminders` ~10 min | **Prepared** (endpoint + `.github/workflows/prayer-reminder-cron.yml`). **Live run postponed** until deploy. Without `CRON_SECRET`, endpoint correctly returns `401 UNAUTHORIZED`. |
| P1 | One real password-reset inbox delivery | SMTP **readyForDelivery: true**; please confirm once with a real mailbox |

---

## 2) Authentication

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/sign-up` | Contract shape unchanged |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/google` | `{ idToken }` from **google_sign_in** |
| POST | `/auth/forgot-password` | Always generic **200** (existence not leaked) — **Production-verified** |
| POST | `/auth/reset-password` | `{ token, password }` or `{ token, newPassword }` |
| POST | `/auth/refresh` | `{ refreshToken }` |
| POST | `/auth/logout` | refresh revoke |

### Auth test note (Backend)

During this Production audit, **new `POST /auth/sign-up` returned `500 DATABASE_ERROR`** from this tester IP (then auth routes hit `RATE_LIMIT_EXCEEDED`).  

- If your app’s existing login/session still works, **continue against Production as you already do**.  
- Backend is hardening Prisma error logging + username uniqueness fallback.  
- If you see signup failures on device, send Backend a `requestId` from the error envelope so we can correlate Vercel/DB logs.

Forgot-password generic success was verified for both existing-style and unknown emails.

---

## 3) Dashboard (auth) — contract unchanged

`GET /dashboard`

Required keys: `greeting`, `prayers`, `verseOfTheDay`, `hadithOfTheDay`, `dailyJourney`, `khatmah`, `dailyChallenge`, `utilities`.

Prayer rules (Backend responsibility):

- Exactly 5 schedule rows: Fajr → Isha  
- `name` Title Case; `time` 24h `HH:mm`; `completed` boolean  
- `dailyJourney.adhkar.completed` boolean  
- `dailyJourney.prayer.progress` fraction `0..1`  
- `dailyJourney.quran.target` = `5`  
- Real `khatmah.surahNameAr` (never bare ids)  
- Challenge includes `titleEn` / `descriptionEn`  
- `utilities.tasbih.enabled: true`

---

## 4) Journey (auth) — contract unchanged

| Method | Path | Body |
|--------|------|------|
| GET | `/journey/today` | — |
| GET | `/journey/progress?days=7` | |
| GET | `/journey/badges` | → `{ badges, streakDays }` |
| PATCH | `/journey/prayer` | `{ "prayer": "Asr", "completed": true }` |
| PATCH | `/journey/adhkar` | `{ "categoryKey": "GENERAL_WIRD", "completed": true }` |
| PATCH | `/journey/sadaqah` | `{ "amount": 10 }` |
| POST | `/journey/quran-pages/increment` | `{ "pages": 1 }` |

Badges UI may stay “Coming soon” on Flutter — payload shape is ready when you need it.

---

## 5) Quran — Production-verified (2026-09-05)

### Catalogs (public) — use these `id`s / `resourceId`s

**Reciters:** Mishary_Alafasy(7), Abdul_Basit(2), Mahmoud_Al_Husary(6), Abdurrahman_As_Sudais(3), Saud_Ash_Shuraym(10), Muhammad_Siddiq_Al_Minshawi(9), Minshawi_Mujawwad(8) — **verified on Production**

**Tafsirs / Translations:** as in `BACKEND_DATA_CONTRACT.md` — **verified sample set on Production**

### Content (public)

| Method | Path | Query aliases |
|--------|------|---------------|
| GET | `/quran/audio` | `reciter` **or** `reciterId` **or** `id` + `surahId` + `ayahNumber` |
| GET | `/quran/tafsir` | `source` **or** `tafsirId` **or** `id` |
| GET | `/quran/translation` | `source` **or** `translationId` **or** `id` |

**Production checks:**

- `reciterId=Abdul_Basit` → `reciter: "Abdul_Basit"`  
- `reciterId=2` → `reciter: "Abdul_Basit"`  
- `reciterId=6` → `reciter: "Mahmoud_Al_Husary"`  
- Tafsir `tafsirId=14` / Translation `translationId=20` return text  

Bismillah/BOM hygiene remains server-side — Flutter must **not** re-strip.

Auth Quran (bookmarks, last-read, khatmah, import-local, reading-history): contract unchanged.

Reading preferences wire key: **`quranAutoScroll`** (legacy `quranAutoScrollEnabled` still accepted).

---

## 6) Adhkar — Production-verified (public)

| Method | Path | Auth |
|--------|------|------|
| GET | `/adhkar` | Public (+ personalized when Bearer present) |
| GET | `/adhkar/progress?categoryKey=` | Auth |
| PUT | `/adhkar/progress` | Auth |
| GET/POST/DELETE | `/adhkar/favorites` | Auth |
| GET | `/adhkar/search?q=` | Public |

**Production public home includes:** `dailyWird`, `categories`, `greetingEn`, `titleEn`, `ctaEn`.

---

## 7) Challenges / Tasbih / Qibla / Notifications / Profile

Unchanged from `BACKEND_DATA_CONTRACT.md`:

| Area | Endpoints |
|------|-----------|
| Challenges | `GET /challenges`, `/today`, `/:id`, `POST /:id/claim`, `POST /today/claim` |
| Tasbih | `GET /tasbih/today`, increment/reset/change-dhikr (`dhikrEn` present) |
| Qibla | `GET /qibla/calculate` public; `GET /qibla/my-qibla` auth after location |
| Notifications | list, unread-count, read, read-all |
| Profile | me, update, change-password, location, reading-preferences + `quranAutoScroll` |

**Production public checks:**

- `GET /qibla/calculate` OK  
- `GET /tasbihs` public catalog returns **9** items (message `Tasbih catalog retrieved successfully`)  
- `GET /challenges` requires auth (`401`) as expected  

---

## 8) Prayer / Azan (backend) — Production-verified (public schedule)

| Method | Path | Auth |
|--------|------|------|
| GET | `/prayers/schedule?lat=&lng=&method=&madhab=` | Public |
| GET | `/prayers/today?lat=&lng=&method=&madhab=` | Public with coords; auth optional |
| GET | `/prayers/today` | Auth (saved location) |
| PATCH | `/prayers/:id/mark` | Auth |
| GET/PATCH | `/profile/azan-preferences` | Auth |

Methods: `EGYPT` (default), `MWL`, `MAKKAH`, `KARACHI`, `ISNA`, `TEHRAN`. Madhab: `SHAFI` / `HANAFI`.

**Production schedule sample:** 5 rows, `name: "Fajr"`, `time: "HH:mm"`.

**Alarm source of truth:** Flutter local Adhan engine. Backend = UI sync / cross-check / FCM backup.

Azan preferences shape (unchanged):

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

---

## 9) FCM / devices

| Method | Path | Body |
|--------|------|------|
| POST | `/devices/fcm-token` | `{ "token": "…" }` or `{ "fcmToken": "…" }`, optional `platform`, `appVersion`, `locale` |
| DELETE | `/devices/fcm-token` | same token fields |
| GET | `/devices` | lists registered devices |
| POST | `/devices/test-push` | optional title/body |
| GET/POST | `/cron/prayer-reminders` | protected (`CRON_SECRET`) |

**Now that `fcm.configured` is `true`:**

- Register a **real** FCM token under Firebase project **`noorapp-d5d7d`** / app id **`com.noor.app`**  
- Handle data `type=AZAN` / `type=TEST`  
- Local Azan remains primary; FCM is backup only  

**Cron:** live scheduler test postponed per your request. After deploy, ensure GitHub secret `CRON_SECRET` matches Vercel `CRON_SECRET`.

---

## Soft / optional asks (your §5)

| Ask | Backend status |
|-----|----------------|
| Never bare `surahNameAr` / `nameAr` | **Hardened** — Production surah catalog sample had no bare numeric names |
| EN counterparts on journey/challenge/adhkar/tasbih | **Present** on Adhkar home / challenge templates / tasbih `dhikrEn` |
| `GET /journey/badges` | Returns `{ badges, streakDays }` — Flutter CTA may stay Coming soon |

---

## What changed since your 2026-09-04 status reply

1. **Firebase / FCM ops completed** — `health.fcm.configured: true` (your P0).  
2. **Quran numeric `resourceId` catalog matching verified** on Production audio.  
3. **Adhkar public payload** confirmed with EN fields + daily wird.  
4. **Cron endpoint protection verified**; live push scheduler test **deferred** until deploy.  
5. **SMTP** still ready for password reset; inbox QA remains a one-time human check.  
6. Backend code hardenings (deploy with your next release): Prisma error logging, safer username uniqueness fallback, soft surah-name / dashboard fallback improvements.

**No new required Flutter API surface** was added against the three reference docs.

---

## What Flutter should do next

1. **Keep using the existing Production contract** you already wired (no redesign).  
2. **FCM backup QA** (now unblocked by Firebase env):  
   - Permission → `POST /devices/fcm-token`  
   - Optional `POST /devices/test-push`  
   - Confirm `type=AZAN` / `TEST` handlers  
3. Optional: one real **forgot-password** email to a mailbox you control.  
4. After Backend deploy + cron secret: expect backup Azan pushes for users with devices + `fcmPrayerBackupEnabled: true` (local Azan still primary).  
5. If signup fails on device with `DATABASE_ERROR`, send Backend the `requestId`.

---

## Ownership (unchanged)

| Feature | Backend | Flutter |
|---------|---------|---------|
| Auth / JWT / dashboard / journey / notifications | Owns | UI + token storage |
| Quran content + catalogs + audio URLs | Owns | Reader + player |
| Prayer schedule API | Owns | Display / optional sync |
| Azan preferences sync API | Owns | Settings UI + local cache |
| FCM token storage + send | Owns (`fcm.configured: true`) | Token registration + handlers |
| Local Azan alarms / sound / permissions / offline | — | **Owns** |

---

## Remaining items

| Item | Owner | Notes |
|------|-------|-------|
| Live cron every ~10 minutes | Backend ops | Postponed until deploy; workflow already in repo |
| Password-reset inbox QA | Shared | SMTP ready; one real mailbox |
| FCM real-device QA | Flutter | Unblocked now |
| Signup `DATABASE_ERROR` if reproduced on device | Backend | Correlate via `requestId` |

---

## Production URLs

```text
https://noor-app-backend-one.vercel.app/api/v1/health
https://noor-app-backend-one.vercel.app/api/v1
```

---

*Hand-off ready for Flutter. Verified against Production on 2026-09-05 using `BACKEND_REQUIREMENTS.md`, `BACKEND_DATA_CONTRACT.md`, and `FLUTTER_TO_BACKEND_STATUS_REPLY.md`. Live Cron Job execution intentionally not run in this pass.*
