# Backend Data Contract — Reply to Flutter

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-04  
**Language:** English only  

This document is the **verified** Backend → Flutter contract after Production testing. It also lists every Flutter-side deliverable from `BACKEND_REQUIREMENTS.md`, `BACKEND_DATA_CONTRACT.md`, `AZAN_FEATURE.md`, and `APP_ENHANCEMENTS.md`.

---

## Status snapshot

| Area | Status |
|------|--------|
| Core API contract (auth, dashboard, journey, Quran, Adhkar, challenges, tasbih, qibla, profile, notifications) | Production-verified |
| Quran catalogs + audio/tafsir/translation (distinct `resourceId`s) | Production-verified |
| Prayer schedule (public + auth) | Production-verified |
| Azan preferences sync | Production-verified |
| FCM device-token API | Production-verified (endpoints live) |
| FCM send capability | **Ops pending:** set Firebase credentials on Vercel (`health.fcm.configured` currently `false`) |
| Password-reset SMTP | Configured (`health.email.readyForDelivery: true`) — confirm one real inbox delivery |

---

## 0) Envelope

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

## 1) Health

`GET /health` (public)

```json
{
  "status": "ok",
  "database": "connected",
  "environment": "production",
  "email": { "configured": true, "provider": "smtp", "readyForDelivery": true },
  "quranFoundation": { "oauthConfigured": true },
  "fcm": { "configured": false }
}
```

When Firebase env vars are set on Vercel, `fcm.configured` becomes `true` and pushes can leave the server.

---

## 2) Authentication (public)

| Method | Path | Body |
|--------|------|------|
| POST | `/auth/sign-up` | `{ fullName, email, password, username? }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/google` | `{ idToken }` from **google_sign_in** (not FirebaseAuth as idToken source) |
| POST | `/auth/forgot-password` | `{ email }` → always generic 200 |
| POST | `/auth/reset-password` | `{ token, password }` or `{ token, newPassword }` |
| POST | `/auth/refresh` | `{ refreshToken }` |
| POST | `/auth/logout` | refresh revoke |

---

## 3) Dashboard (auth)

`GET /dashboard`

Required keys: `greeting`, `prayers`, `verseOfTheDay`, `hadithOfTheDay`, `dailyJourney`, `khatmah`, `dailyChallenge`, `utilities`.

Prayer rules:

- Exactly 5 schedule rows: Fajr → Isha  
- `name` Title Case; `time` 24h `HH:mm`; `completed` boolean  
- `dailyJourney.adhkar.completed` boolean  
- `dailyJourney.prayer.progress` fraction `0..1`  
- `dailyJourney.quran.target` = `5`  
- Real `khatmah.surahNameAr` (never bare ids)  
- Challenge includes `titleEn` / `descriptionEn`

---

## 4) Journey (auth)

| Method | Path | Body |
|--------|------|------|
| GET | `/journey/today` | — |
| GET | `/journey/progress?days=7` | |
| GET | `/journey/badges` | → `{ badges, streakDays }` |
| PATCH | `/journey/prayer` | `{ "prayer": "Asr", "completed": true }` (Title Case or enum) |
| PATCH | `/journey/adhkar` | `{ "categoryKey": "GENERAL_WIRD", "completed": true }` |
| PATCH | `/journey/sadaqah` | `{ "amount": 10 }` |
| POST | `/journey/quran-pages/increment` | `{ "pages": 1 }` → `quranPagesRead` |

`/journey/today` includes prayer `completed`/`total`/`progress`, EN labels, embedded `dailyChallenge`, and `badges[]`.

---

## 5) Quran

### Public browse

Surahs, juz, pages `1..604`, full-catalog, search, random ayah, catalogs.

Surah names are always real Arabic/English — never `"3"`.

Bismillah/BOM hygiene is server-side. Flutter must **not** re-strip.

### Catalogs (public) — use these `id`s

**Reciters**

| id | resourceId |
|----|------------|
| Mishary_Alafasy | 7 |
| Abdul_Basit | 2 |
| Mahmoud_Al_Husary | 6 |
| Abdurrahman_As_Sudais | 3 |
| Saud_Ash_Shuraym | 10 |
| Muhammad_Siddiq_Al_Minshawi | 9 |
| Minshawi_Mujawwad | 8 |

**Tafsirs:** Ibn_Kathir(14), Al_Tabari(15), Al_Qurtubi(90), Ibn_Kathir_Muyassar(16), Al_Baghawi(94), Al_Saadi(91), Ibn_Kathir_En(169)

**Translations:** Sahih_International(20), Yusuf_Ali(22), Pickthall(19), French_Hamidullah(31), Turkish_Diyanet(77), Malay_Basmeih(39), Indonesian_Depag(33)

### Content (public)

| Method | Path | Query aliases |
|--------|------|---------------|
| GET | `/quran/audio` | `reciter` **or** `reciterId` **or** `id` + `surahId` + `ayahNumber` |
| GET | `/quran/tafsir` | `source` **or** `tafsirId` **or** `id` |
| GET | `/quran/translation` | `source` **or** `translationId` **or** `id` |

Audio returns distinct CDN URLs per catalog id (verified).

### Auth Quran

Bookmarks (+ note PATCH), last-read, khatmah (+ reset), reading-history, `POST /quran/import-local`.

Import body accepts `null` bags and `page`/`pageNumber`. Response:

```json
{ "bookmarksImported": 1, "lastReadUpdated": true, "imported": { "bookmarks": 1, "lastRead": true } }
```

---

## 6) Adhkar

| Method | Path | Auth |
|--------|------|------|
| GET | `/adhkar` | Public (+ personalized when Bearer) |
| GET | `/adhkar/progress?categoryKey=` | Auth |
| PUT | `/adhkar/progress` | Auth |
| GET/POST/DELETE | `/adhkar/favorites` | Auth |
| GET | `/adhkar/search?q=` | Public |

Home includes `greetingEn`, `titleEn`, `ctaEn` at root.

---

## 7) Challenges / Tasbih / Qibla / Notifications / Profile

| Area | Endpoints |
|------|-----------|
| Challenges | `GET /challenges`, `/today`, `/:id`, `POST /:id/claim`, `POST /today/claim` |
| Tasbih | `GET /tasbih/today` (`count`, `dhikrAr`, `dhikrEn`, `dailyGoal`, `progressPercent`), increment/reset/change-dhikr |
| Qibla | `GET /qibla/calculate` public; `GET /qibla/my-qibla` auth after `PUT /profile/location` |
| Notifications | list (array), unread-count `{count,unreadCount}`, read, read-all |
| Profile | me, update, change-password, location (`lat`/`lng` aliases), reading-preferences + `quranAutoScroll` |

---

## 8) Prayer / Azan (backend)

### Server times

| Method | Path | Auth |
|--------|------|------|
| GET | `/prayers/schedule?lat=&lng=&method=&madhab=` | Public |
| GET | `/prayers/today?lat=&lng=&method=&madhab=` | Public with coords; auth optional (merges completion) |
| GET | `/prayers/today` | Auth (uses saved location) |
| PATCH | `/prayers/:id/mark` | Auth |

Methods: `EGYPT` (default), `MWL`, `MAKKAH`, `KARACHI`, `ISNA`, `TEHRAN`. Madhab: `SHAFI` / `HANAFI`.

**Alarm source of truth:** Flutter local Adhan engine wins for alarms. Backend schedule is for UI sync / cross-check / FCM backup.

### Azan preferences sync (auth) — Production-verified

`GET /profile/azan-preferences`  
`PATCH /profile/azan-preferences`

Shape (matches `AZAN_FEATURE.md` §6 + backup flag):

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

PATCH accepts partial updates. Saving also aligns profile `prayerCalculationMethod` / location when provided.

---

## 9) FCM / devices (backend)

| Method | Path | Body |
|--------|------|------|
| POST | `/devices/fcm-token` | `{ "token": "…" }` or `{ "fcmToken": "…" }`, optional `platform`, `appVersion`, `locale` |
| DELETE | `/devices/fcm-token` | same token fields |
| GET | `/devices` | lists registered devices (no raw secrets beyond metadata) |
| POST | `/devices/test-push` | optional `{ title, body, titleAr, bodyAr }` |
| GET/POST | `/cron/prayer-reminders` | protected by `CRON_SECRET` or Vercel Cron header |

Behavior:

- Tokens are stored per user and upserted by token string.  
- Test/cron send uses Firebase Admin when configured.  
- Invalid tokens are pruned after send failures.  
- Cron endpoint runs Azan backup pushes for users with devices + `fcmPrayerBackupEnabled`.  

**Ops (Mariam / backend host):** set on Vercel:

- `FIREBASE_SERVICE_ACCOUNT_JSON` **or**  
  `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`  
- Optional `CRON_SECRET`  
- Call `/cron/prayer-reminders` from an external scheduler every ~10 minutes (Vercel Hobby cannot run sub-daily crons).

Until Firebase env is set: `health.fcm.configured=false`, register/unregister still work, send returns `sent:0`.

---

## 10) Recommended API call order

### Guest

1. Local Adhan / optional `GET /prayers/today?lat&lng&method&madhab`  
2. Public Quran / Adhkar / Qibla calculate  
3. Auth when ready  

### After login

1. `PUT /profile/location`  
2. `GET/PATCH /profile/azan-preferences` (sync)  
3. `POST /devices/fcm-token` (after Firebase Messaging permission)  
4. `GET /dashboard`  
5. Journey / notifications / challenges / tasbih in parallel  
6. Once: `POST /quran/import-local`  
7. Reader: catalogs → audio/tafsir/translation with catalog `id`  

### Page progress order

1. Journey quran increment → 2) khatmah progress → 3) last-read  

---

## 11) Breaking / important fixes

1. Audio/tafsir/translation accept `reciterId` / `tafsirId` / `translationId` (not only `reciter`/`source`).  
2. Catalog ids are fixed Production lists with real `resourceId`s — do not hardcode stale lists.  
3. Prayer names Title Case on payloads; PATCH accepts `Asr` or `ASR`.  
4. `import-local` contract aliases + null-safe bags.  
5. New: `/profile/azan-preferences`, `/devices/fcm-token`, public `/prayers/today?lat&lng`.  

---

# Flutter Developer Action Items

Everything Flutter must implement/deliver based on the four documents (backend for these is ready unless noted).

## Authentication UI/flow

- [ ] Sign-up, login, Google (`google_sign_in` idToken), logout  
- [ ] Secure token storage + refresh on `TOKEN_EXPIRED`  
- [ ] Forgot/reset password UI (paste token if deep-link missing)  
- [ ] Guest mode without forcing account  

## Quran reader

- [ ] Surah / Juz / Mushaf page reader using public APIs  
- [ ] Bookmarks, last-read, khatmah dual counters (do not merge with journey pages)  
- [ ] Search UI  
- [ ] Offline full-catalog / page cache  
- [ ] Guest merge via `import-local` after signup  
- [ ] Reading preferences sync including `quranAutoScroll`  

## Audio player

- [ ] Load catalog from `/quran/reciters`  
- [ ] Call `/quran/audio` with catalog `id` as `reciterId`  
- [ ] Playback UI, next/prev ayah, background audio policies  

## Tafsir / Translation

- [ ] Dropdowns from `/quran/tafsirs` and `/quran/translations`  
- [ ] Fetch body endpoints with `tafsirId` / `translationId`  
- [ ] Show EN/AR labels appropriately  

## Dashboard

- [ ] Render all dashboard sections; never drop keys silently  
- [ ] Prayer card uses Title Case + 24h times + countdown (LTR)  
- [ ] Journey tiles use `target`, boolean adhkar, fraction progress  

## Journey

- [ ] Today tasks, progress history, badges CTA  
- [ ] PATCH prayer/adhkar/sadaqah + quran increment  
- [ ] Show embedded daily challenge  

## Adhkar

- [ ] Home, categories, search, favorites, progress/`markedItemId`  
- [ ] EN strings when locale is English  

## Challenges

- [ ] Today claim on Home  
- [ ] Challenges tab: list, detail, claim-by-id  

## Tasbih

- [ ] Local-first UX; sync `GET /tasbih/today` when online  
- [ ] Show `dhikrEn` for English locale  

## Qibla / location / compass

- [ ] Permission flow, compass UI  
- [ ] `PUT /profile/location` then `GET /qibla/my-qibla` or calculate with live GPS  

## Prayer UI

- [ ] Prayer times screen (completed / next / upcoming)  
- [ ] Settings entry points  

## Local Azan (Flutter-owned — required for Azan v1)

- [ ] Local Adhan engine (device calculation)  
- [ ] Exact alarms / local notifications  
- [ ] Azan sound assets + vibration-only mode  
- [ ] Per-prayer toggles, pre-reminder, method/madhab  
- [ ] Offline reschedule after reboot / midnight / location change  
- [ ] Android/iOS permissions UX (notifications, exact alarm, battery, location)  
- [ ] Guest Azan without login  
- [ ] Persist local settings (`azan_*` keys)  

## FCM integration (when push backup enabled)

- [ ] Firebase Messaging setup (FlutterFire)  
- [ ] Request notification permission  
- [ ] `POST /devices/fcm-token` on token refresh; DELETE on logout  
- [ ] Handle data payloads `type=AZAN` / `TEST`  
- [ ] Sync `/profile/azan-preferences` including `fcmPrayerBackupEnabled`  
- [ ] Do **not** rely on FCM as the only Azan path (local alarms remain primary)  

## Profile / settings

- [ ] Profile me/update/password/location  
- [ ] Azan settings screen bound to local store + server sync when logged in  
- [ ] Reading preferences  

## Localization

- [ ] AR/EN for journey, dashboard, challenge, adhkar, tasbih, notifications, Azan strings  

## UX states

- [ ] Loading shimmer (no CircularProgressIndicator per Azan doc)  
- [ ] Error / empty / offline states  
- [ ] Silent dashboard refresh / debounce  

## Offline / cache

- [ ] Cache dashboard + Quran lists; invalidate prayer schedule after local midnight  
- [ ] Outbox replay for offline writes  

## Production configuration

- [ ] Base URL `https://noor-app-backend-one.vercel.app/api/v1`  
- [ ] Firebase options for FCM  
- [ ] Deep-link scheme for password reset (optional)  

## Testing / release

- [ ] Real-device tests: Azan after kill/reboot, offline Azan, audio per reciter, guest→user merge  
- [ ] Release build (Android/iOS store compliance for permissions)  

## APP_ENHANCEMENTS (product backlog — not release blockers)

- [ ] Challenges tab polish, badges UI, share ayah card, streak calendar, accessibility, monetization, etc. as prioritized  

---

# Backend vs Flutter Ownership

| Feature | Backend | Flutter |
|---------|---------|---------|
| Auth APIs / JWT | Owns | UI + token storage |
| Dashboard / journey / notifications APIs | Owns | UI |
| Quran content + catalogs + audio URLs | Owns | Reader + player |
| Adhkar / challenges / tasbih / qibla APIs | Owns | UI |
| Prayer schedule calculation API | Owns | Display + optional sync |
| Azan preferences sync API | Owns | Settings UI + local cache |
| FCM token storage + send | Owns (needs Firebase env) | Token registration + handlers |
| Local Azan alarms/sound/permissions | — | Owns |
| Offline Azan when network down | — | Owns |
| OEM battery / exact alarm | — | Owns |
| Password email SMTP | Owns (configured) | Forgot/reset UI |
| App enhancements UX | — | Owns |

---

# Flutter Deliverables

Before the **app** is considered complete:

1. Full auth + guest flows working against Production  
2. Home dashboard + prayer countdown correct with backend schedule  
3. Quran browse/offline/reader + audio/tafsir/translation using catalog ids  
4. Journey + badges + patches  
5. Adhkar + favorites + progress  
6. Challenges tab + claim  
7. Tasbih + Qibla  
8. Notifications bell  
9. Profile + reading prefs + location  
10. **Local Azan v1** fully working offline (alarms, sound, permissions)  
11. Azan prefs sync + FCM token registration for logged-in users  
12. EN/AR localization for shipped screens  
13. Real-device QA + release builds  

---

# Remaining Items

## Remaining Backend Work

| Item | Notes |
|------|-------|
| Set Firebase credentials on Vercel | Required for actual push delivery (`health.fcm.configured` → true) |
| External scheduler hitting `/cron/prayer-reminders` | Hobby Vercel cannot run */10 crons; use GitHub Action / cron-job.org / upgrade |
| Confirm password-reset inbox delivery | SMTP ready; one real mailbox QA |

## Remaining Flutter Work

See **Flutter Developer Action Items** and **Flutter Deliverables** above (all UI/local Azan/FCM client work).

## Optional / Future

- Multi Azan voices / full-screen prayer alert / widgets / wear / Live Activities (`AZAN_FEATURE` v1.1 / v2)  
- Mosque Iqama offsets  
- APP_ENHANCEMENTS performance/monetization items  
- Vercel Pro for native high-frequency crons  

---

## Final status

- **Backend requirements:** required API items from the four docs **implemented and Production-verified** (Azan prefs + FCM token APIs included).  
- **Production:** **VERIFIED** for new Azan/FCM endpoints + prior contract surfaces.  
- **Azan backend:** **READY** (schedule + prefs sync + reminder cron endpoint).  
- **FCM backend:** **READY (code)** / **NOT FULLY LIVE for send** until Firebase env is set (`configured: false` today).  
- **Flutter contract:** **COMPLETE** (this file).  
- **Remaining backend work:** Firebase env + external cron + reset-email inbox QA.  
- **Remaining Flutter work:** full client implementation list above (especially local Azan + FCM client).  
