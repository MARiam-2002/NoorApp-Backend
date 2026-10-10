# Noor App — Flutter → Backend Production Audit

**Document type:** Flutter-side authoritative backend requirements  
**Audit date:** 2026-10-03  
**Scope:** Entire Noor Flutter repository (`g:\projects\noor`) — READ-ONLY  
**Backend repository:** Not inspected in this audit  
**Base URL used by Flutter:** `https://noorapp-backend-production.up.railway.app/api/v1`  
(`lib/core/network/api_config.dart`)

> **Flutter-side audit complete. Backend-side implementation and production verification are still required.**

---

## 1. Executive Summary

The current Noor Flutter app is a production-oriented client that already wires **~110 unique `/api/v1` path templates** (≈121 method+path call sites) through a single `ApiClient` envelope (`success` / `data` / `message` / `code` / `meta` / `errors` / `requestId`).

**What Flutter needs from Backend for production:**

1. **Preserve existing camelCase JSON contracts** — Flutter parsers do not use snake_case for API fields.
2. **Auth lifecycle** including refresh, Google `idToken`, forgot/reset password deep links (`noorapp://auth/reset-password?token=`), and `DELETE /auth/me`.
3. **User-owned sync** for journey, prayer marks, adhkar progress/favorites, Quran bookmarks/last-read/khatmah, sajdah, ayah-of-session, nawafel, tasbih, mawqif, preferences, notifications inbox, FCM device tokens.
4. **Public catalogs** for Quran, adhkar, azan sounds/methods, salawat audio, tasbih catalog, content (hadith/figure), static packs (`/content/static-meta` + full-catalog downloads with Range/206).
5. **Server-only FCM** for Salawat, Mulk, Khatmah; **FCM backup** for Azan/pre-prayer/Duha/Qiyam after `localScheduledUntil`.
6. **No Teacher / Zoom / Payment / AI** features exist in Flutter — do not block production on those.

**Highest-risk production areas (must verify against live Backend):**

| Risk | Why |
|------|-----|
| Auth token nest `data.tokens.{accessToken,refreshToken}` | Login fails hard if shape differs |
| Envelope `success: false` + `code` | Session wipe on `INVALID_TOKEN`; refresh rejection codes |
| `GET /ayah` + header `X-Noor-App-Open-Id` | Session-scoped ayah behavior |
| Static packs version/hash + full-catalog bytes | Offline Quran/Adhkar gates |
| FCM payload fields + Salawat/Mulk/Khatmah server delivery | Silent missing reminders |
| `PATCH /profile/azan-preferences` including `localScheduledUntil` | Duplicate or missing Azan |

**Status of this audit:** Flutter contracts are evidence-based. Every endpoint is classified **B** (implemented in Flutter / not backend-verified) unless noted **C/D/F**. No **A** (verified against Backend repo/production) claims are made.

---

## 2. Audit Scope and Methodology

### In scope

- All `lib/features/**` remote datasources, repositories, models, cubits, FCM, offline packs, outbox, deep links, DI, network layer, Android/iOS notification-related wiring referenced from Dart.
- Feature folders present: `account`, `auth`, `ayah`, `azan`, `azkar`, `challenges`, `home`, `home_widgets`, `journey`, `khatmah`, `mawqif`, `nawafel`, `notifications`, `onboarding`, `personality`, `plus`, `profile`, `qibla`, `quran`, `reminders`, `sajdah`, `salawat`, `splash`, `tasbih`.

### Out of scope / not claimed

- Backend repository source, Railway env, DB schema as deployed, cron job source code.
- Redesign recommendations presented as requirements.
- Invented endpoints not found in Flutter call sites.

### Method

1. Repository-wide search for Dio/`ApiClient`/path strings/`Authorization`/`Bearer`/FCM/deep links/TODO/mock/secrets.
2. Trace `UI → Cubit → Repository → RemoteDataSource → ApiClient → Model`.
3. Inventory every `*_remote_datasource.dart` (24 files) and parse every response model field Flutter reads.
4. Cross-check features with UI presence vs backend call presence.

### Classification legend (used throughout)

| Code | Meaning |
|------|---------|
| **A** | Implemented and verified (Backend + Flutter) — **none claimed** |
| **B** | Flutter expects it; contract appears defined in Flutter; Backend not verified here |
| **C** | Partially implemented / Flutter tolerates multiple shapes |
| **D** | Flutter clearly needs capability; no Flutter call site / unclear Backend |
| **E** | Incompatible — only if Backend verified mismatch (**none claimed without Backend**) |
| **F** | Unknown / needs Backend confirmation |

### Priority

- **P0** — Required for correct/safe production behavior of shipped screens.
- **P1** — Complete production behavior; app may launch without it.
- **P2** — Polish / optimization.

---

## 3. Flutter Architecture Findings

### Network

| Item | Evidence |
|------|----------|
| Client | `lib/core/network/api_client.dart` |
| Base URL | `ApiConfig.baseUrl` → Railway `/api/v1` |
| Timeouts | connect 20s, receive 20s (catalog downloads override receive to 5 min) |
| Headers | `Content-Type: application/json`, `accept: application/json` |
| Auth | `Authorization: Bearer <access>` unless `extra.skipAuth == true` |
| Special | `GET /ayah` adds `X-Noor-App-Open-Id: <uuid per process>` (`noor_app_open_id.dart`) |
| 401 | Single-flight `POST /auth/refresh`; retry once; `INVALID_TOKEN` clears session |

### Envelope (compatibility requirement)

Flutter `_unwrap` requires JSON **object** body. If `success == false`, throws `ApiException` from envelope fields.

**Success (callers receive whole envelope):**

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": { "total": 0, "page": 1, "perPage": 20, "hasNextPage": false },
  "code": "...",
  "errors": [{ "field": "...", "message": "...", "code": "..." }],
  "details": {},
  "requestId": "..."
}
```

**Notes from Flutter evidence:**

- `meta.perPage` falls back to `meta.limit` (`api_meta.dart`).
- Field errors: `errors[].field` + `errors[].message` required for mapping; optional `code`.
- Bytes endpoints (`getBytes`) are **not** envelope-parsed; raw catalog bytes (status 200 or 206 with Range).

### Layering

Clean-ish feature modules: remote datasource → repository → cubit → UI. Offline: SQLite packs + SharedPreferences caches + `OfflineOutbox` replay (`outbox_sync_service.dart`).

### Guest mode

Local-only guest session (`id: guest`). Guests use `skipAuth` public routes; authenticated routes return 401 which must **not** wipe guest session (`api_client.dart` checks for any stored token before refresh/logout).

---

## 4. Complete Backend Dependency Inventory

### 4.1 Feature map

| Feature | Backend? | Classification | Notes |
|---------|----------|----------------|-------|
| Auth (email/Google/refresh/reset/delete) | Yes | B | P0 |
| Profile / location / password | Yes | B | P0 |
| Home dashboard | Yes (+ local guest shell) | C | Guest uses local mock + merges public prayers/hadith/figure |
| Quran catalog/pages/search | Yes (+ offline pack + mock fallback) | C | Mock last resort — P0 to avoid mock in prod UX |
| Quran bookmarks / last-read / khatmah | Yes | B | Auth |
| Tafsir / translation / audio URL | Yes | B/C | Flexible text/url keys |
| Reading preferences | Yes | B | |
| Adhkar catalog/progress/favorites | Yes (+ offline pack) | B | |
| Prayer times / mark | Yes (+ local Adhan fallback) | C | |
| Azan prefs / sounds / media | Yes | B | |
| FCM device register | Yes | B | |
| Journey / badges / sadaqah / prayer patch | Yes | B | |
| Challenges claim | Yes | B | |
| Sajdah | Yes | B | |
| Ayah (session) + history | Yes | B | Distinct from dashboard `verseOfTheDay` |
| Nawafel | Yes | B | |
| Tasbih | Yes (+ outbox) | B | |
| Mawqif (`/stances`) | Yes | B | Not AI |
| Qibla | Yes (+ local calc) | C | |
| Figure of day / hadith of day | Yes | B | |
| Notifications inbox | Yes | B | Separate from FCM |
| Salawat prefs + audio + FCM | Yes | B | Scheduling server-only |
| Duha/Qiyam/Mulk/Khatmah reminder prefs | Yes | B | Mulk/Khatmah FCM server-only |
| Static content meta + packs | Yes | B | P0 offline |
| Home widgets | No own API | LOCAL | Sync from dashboard/ayah |
| Onboarding | LOCAL | LOCAL | |
| Noor Plus | UI shell only | LOCAL / NOT IMPLEMENTED | Coming soon snackbar |
| Teacher / Zoom / Payment / AI | Absent | NOT IMPLEMENTED | |

### 4.2 Master endpoint table (abbreviated fields; full contracts in later sections)

Status column = Flutter expectation status pending Backend verification → **B** unless noted.

| ID | Method | Endpoint | Auth | Feature | Priority | Status |
|----|--------|----------|------|---------|----------|--------|
| E001 | POST | `/auth/login` | none | Auth | P0 | B |
| E002 | POST | `/auth/sign-up` | none | Auth | P0 | B |
| E003 | POST | `/auth/google` | none | Auth | P0 | B |
| E004 | GET | `/auth/me` | Bearer | Auth | P0 | B |
| E005 | DELETE | `/auth/me` | Bearer | Auth | P0 | B |
| E006 | POST | `/auth/logout` | none (+ body refresh) | Auth | P0 | B |
| E007 | POST | `/auth/forgot-password` | none | Auth | P0 | B |
| E008 | POST | `/auth/reset-password` | none | Auth | P0 | B |
| E009 | POST | `/auth/refresh` | none | Auth | P0 | B |
| E010 | GET | `/profile/me` | Bearer | Profile | P0 | B |
| E011 | PATCH | `/profile/update` | Bearer | Profile | P0 | B |
| E012 | PATCH | `/profile/change-password` | Bearer | Profile | P1 | B |
| E013 | PUT | `/profile/location` | Bearer | Profile | P0 | B |
| E014 | GET/PATCH | `/profile/azan-preferences` | Bearer | Azan | P0 | B |
| E015 | GET/PATCH | `/profile/reading-preferences` | Bearer | Quran | P1 | B |
| E016 | GET/PATCH/PUT | `/profile/salawat-preferences` | Bearer | Salawat | P0 | B |
| E017 | GET/PATCH | `/profile/duha-preferences` | Bearer | Reminders | P0 | B |
| E018 | GET/PATCH | `/profile/qiyam-preferences` | Bearer | Reminders | P0 | B |
| E019 | GET/PATCH | `/profile/mulk-preferences` | Bearer | Reminders | P0 | B |
| E020 | GET/PATCH | `/profile/khatmah-reminder-preferences` | Bearer | Reminders | P0 | B |
| E021 | POST/DELETE | `/devices/fcm-token` | Bearer | FCM | P0 | B |
| E022 | GET | `/notifications` | Bearer | Inbox | P1 | B |
| E023 | GET | `/notifications/unread-count` | Bearer | Inbox | P1 | B |
| E024 | GET | `/notifications/:id` | Bearer | Inbox | P2 | B |
| E025 | PATCH | `/notifications/:id/read` | Bearer | Inbox | P1 | B |
| E026 | POST | `/notifications/read-all` | Bearer | Inbox | P1 | B |
| E027 | GET | `/dashboard` | Bearer | Home | P0 | B |
| E028 | POST | `/challenges/today/claim` | Bearer | Challenges | P1 | B |
| E029 | GET | `/challenges` | Bearer | Challenges | P1 | B |
| E030 | GET | `/challenges/today` | Bearer | Challenges | P1 | B |
| E031 | GET | `/challenges/:id` | Bearer | Challenges | P2 | B |
| E032 | POST | `/challenges/:id/claim` | Bearer | Challenges | P1 | B |
| E033 | GET | `/content/hadith-of-day` | none | Home | P1 | B |
| E034 | GET | `/content/figure-of-day` | none | Personality | P1 | B |
| E035 | GET | `/content/figures/:id` | none | Personality | P2 | B |
| E036 | GET | `/content/static-meta` | none | Offline | P0 | B |
| E037–E046 | * | `/journey/*` | Bearer | Journey | P0 | B |
| E047–E072 | * | `/quran/*` | mixed | Quran | P0/P1 | B/C |
| E073–E075 | * | `/quran/sajdah-verses*` | mixed | Sajdah | P0 | B |
| E076–E084 | * | `/adhkar*` | mixed | Adhkar | P0 | B |
| E085–E086 | GET | `/prayers/today`, `/prayers/schedule` | param | Prayer | P0 | B |
| E087 | PATCH | `/prayers/:key/mark` | Bearer | Prayer | P0 | B |
| E088–E093 | GET | `/azan/*` | mostly public | Azan catalogs | P0 | B |
| E094 | GET | `/azan/media/:file` | n/a (URL) | Media | P0 | B |
| E095–E096 | GET | `/ayah`, `/ayah/history` | Bearer | Ayah | P0 | B |
| E097–E098 | * | `/nawafel/*` | Bearer | Nawafel | P0 | B |
| E099–E106 | * | `/tasbih*`, `/tasbihs*` | mixed | Tasbih | P0 | B |
| E107–E109 | * | `/stances/*` | Bearer | Mawqif | P1 | B |
| E110–E111 | GET | `/qibla/*` | mixed | Qibla | P1 | B |
| E112 | GET | `/salawat/audio` | public param | Salawat | P0 | B |

Full request/response detail follows by domain.

---

## 5. Authentication Contract

**Evidence:** `auth_remote_datasource.dart`, `auth_repository_impl.dart`, `api_client.dart`, `auth_tokens_parser.dart`, `user_model.dart`, `token_storage.dart`.

### 5.1 Signup — `POST /auth/sign-up` (skipAuth)

**Request:**
```json
{ "fullName": "string", "email": "string", "password": "string" }
```

**Expected `data`:**
```json
{
  "tokens": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": 604800
  },
  "user": {
    "id": "string",
    "fullName": "string",
    "email": "string",
    "provider": null,
    "providerId": null
  }
}
```

- `expiresIn`: optional **number (seconds)**. String durations like `"7d"` are ignored.
- Name fallbacks on user: `fullName` \| `displayName` \| `username`.
- Tokens saved to secure storage; `expiresIn` **not** persisted.

### 5.2 Login — `POST /auth/login` (skipAuth)

**Request:** `{ "email", "password" }`  
**Response:** same AuthResult as signup.

### 5.3 Google — `POST /auth/google` (skipAuth)

1. Flutter obtains Google `idToken` via `google_sign_in`.
2. **Request:** `{ "idToken": "<jwt>" }`
3. **Response:** same AuthResult; expect `user.provider` like `GOOGLE` (string compared in logout path).

**Errors Flutter maps:** `INVALID_GOOGLE_TOKEN`, `GOOGLE_AUTH_FAILED`, validation field errors, 429.

### 5.4 Refresh — `POST /auth/refresh`

**Request:** `{ "refreshToken": "..." }`  
**Expected:** `success: true` and `data.tokens` (same nest). Optional `data.user` triggers session user update.

**Failure behavior:**

- HTTP 400/401/403 on refresh → treat as auth rejection → clear tokens → login.
- Network/5xx → **keep tokens** (cold start survival).
- Business `code: INVALID_TOKEN` on any 401 → clear immediately without refresh attempt.

### 5.5 Logout — `POST /auth/logout` (skipAuth)

**Request:** `{ "refreshToken": "..." }`  
Errors ignored; local cleanup always proceeds (cancel schedulers, FCM unregister, purge caches, clear session).

### 5.6 Me / Delete

- `GET /auth/me` → `data` is **user map directly** (not nested under `user`).
- `DELETE /auth/me` → then local purge + Google disconnect if provider Google.

### 5.7 Forgot / Reset

- `POST /auth/forgot-password` `{ "email" }` — success if envelope ok; Flutter expects email delivery (Backend).
- `POST /auth/reset-password` `{ "token", "newPassword" }`.
- Deep link Flutter opens: `noorapp://auth/reset-password?token=...` (`deep_link_handler.dart`).

**Backend requirement:** Reset emails / links must use a URL Flutter can open (custom scheme or redirect into it). HTTPS App Links are **not** configured in Flutter/Android for password reset.

### 5.8 Error codes Flutter localizes (auth-related)

`UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`, `WEAK_PASSWORD`, `INVALID_EMAIL`, `USER_NOT_FOUND`, `INVALID_GOOGLE_TOKEN`, `GOOGLE_AUTH_FAILED`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `EMAIL_SEND_FAILED`, `INVALID_RESET_TOKEN`, `RESET_TOKEN_EXPIRED`, `TOO_MANY_REQUESTS`, `RATE_LIMIT_EXCEEDED`, `VALIDATION_ERROR`, field errors on `email`/`password`/`fullName`.

---

## 6. User / Profile Contract

**Evidence:** `profile_remote_datasource.dart`, `profile_model.dart`, `profile_timezone_sync.dart`.

| Method | Path | Body / notes |
|--------|------|--------------|
| GET | `/profile/me` | `data`: `id`, `fullName`, `email`, `provider?`, `providerId?`, `location?{latitude,longitude}`, `createdAt?` ISO |
| PATCH | `/profile/update` | `{ "fullName" }` or `{ "timezone": "IANA" }` |
| PATCH | `/profile/change-password` | `{ "currentPassword", "newPassword" }` |
| PUT | `/profile/location` | `{ "latitude", "longitude", "timezone?", "city?" }` — also outbox-replayed |

**Ownership:** authenticated user only.  
**Codes:** `INVALID_CURRENT_PASSWORD`, `PASSWORD_SAME_AS_CURRENT`, `GOOGLE_USER_NO_PASSWORD`, `INVALID_COORDINATES`, `MISSING_COORDINATES`.

---

## 7. Quran Contract

**Evidence:** `quran_remote_datasource.dart`, `quran_models.dart`, `quran_repository_impl.dart`, offline DB/parser.

### Public (skipAuth)

| Method | Path | Flutter reads |
|--------|------|---------------|
| GET | `/quran/surahs` | list: `id`, `nameEn`, `nameAr`, `revelationType`, `totalAyahs`, `totalPages`, `startPage?` |
| GET | `/quran/juz` | `juzNumber`, `nameAr`, `nameEn`, `totalAyahs`, `startPage`, `endPage`, `firstSurah.id` |
| GET | `/quran/juz/:n/surahs` | data list **or** `data.surahs[]` — `id`, names, `startPage`, `totalAyahs`, `fromAyah`, `toAyah`, `ayahsInJuz` |
| GET | `/quran/pages/:page` | `page`, `totalPages`, `ayahs[]`, `surahs[]` (page clamped 1–604) |
| GET | `/quran/surahs/:id/ayahs?page=1&perPage=1` | first item `page` |
| GET | `/quran/juz/:n/ayahs` | `data.ayahs[]` or list |
| GET | `/quran/search?q&limit` | list **or** `ayahs` **or** `results`; fields `surahId`, `ayahNumber`, `textAr`, `page?`, `juz?`, `id?` |
| GET | `/quran/full-catalog` | **raw bytes**; Range resume; 206 supported |

### Authenticated

| Method | Path | Body / response |
|--------|------|-----------------|
| GET/POST | `/quran/bookmarks` | POST: `surahId`, `ayahNumber?`, `page?`, `note?` → bookmark row |
| PATCH/DELETE | `/quran/bookmarks/:id` | PATCH `{ note }` |
| GET/PUT | `/quran/last-read` | PUT: `surahId`, `page`, `ayahNumber?` |
| GET | `/quran/khatmah/stats` | stats + `dailyGoal` nest |
| GET/POST/DELETE | `/quran/khatmah/plan` | POST exactly one of `durationDays` \| `juzPerMonth` |
| PATCH | `/quran/khatmah/progress` | `{ surahId, currentPage, pagesRead }` |
| POST | `/quran/import-local` | `{ bookmarks: [], lastRead? }` → `bookmarksImported`, `lastReadUpdated` |

**Bookmark fields:** `id`, `surahId`, `ayahNumber?`, `page`, `textAr?`, `note?`, `surahNameAr` \| `surah.nameAr`.

**Last read:** `surahId`, `page`, `ayahNumber?`, `juz?`, `surah.nameAr` \| `surahNameAr`.

**Offline:** Prefer SQLite pack when ready; else API; else mock (`quran_mock_data.dart`) — **Backend must keep full-catalog + live pages healthy to avoid mock in production.**

---

## 8. Tafsir / Translation / Audio Contract

| Method | Path | Query | Response Flutter accepts |
|--------|------|-------|---------------------------|
| GET | `/quran/reciters` | — | list or `data.items[]`: `code`\|`id`, `nameAr`, `name`\|`nameEn` |
| GET | `/quran/tafsirs` | — | same |
| GET | `/quran/translations` | — | same |
| GET | `/quran/audio` | `reciterId`, `reciter` (same value), `surahId`, `ayahNumber` | `data.url` \| `audioUrl` \| `cdnUrl` **or** string `data` |
| GET | `/quran/tafsir` | `tafsirId`, `source` (same), `surahId`, `ayahNumber` | text from `text` \| `textAr` \| `tafsir` \| `body` |
| GET | `/quran/translation` | `translationId`, `source`, `surahId`, `ayahNumber` | `text` \| `textEn` \| `translation` \| `body` |

**Defaults / fallbacks if catalog empty:**

- Reciters: `Mishary_Alafasy`, `Abdul_Basit`, `Saad_Al_Ghamdi`, `Maher_Al_Muaiqly`, `Sudais_And_Shuraim`
- Tafsirs: `Ibn_Kathir`, `Al_Tabari`, `Al_Qurtubi`, `Al_Saadi`
- Translations: `Sahih_International`, `Yusuf_Ali`, `Pickthall`, `Dr_Ghali`

**Reading preferences** (`/profile/reading-preferences`):  
`quranFontSize`, `quranReciter`, `quranTafsir`, `quranTranslation`, `quranAutoScroll` \| `quranAutoScrollEnabled`.

**Note:** Flutter does **not** require `sourceNameAr` for tafsir text endpoint today — only text keys above. Catalog display names use `nameAr`/`nameEn`.

**Codes:** `INVALID_RECITER`, `INVALID_TAFSIR`, `INVALID_TRANSLATION`, `INVALID_FONT_SIZE`, `QURAN_PAGE_UNAVAILABLE`, etc.

---

## 9. Prayer / Azan Contract

### Responsibility boundary (from Flutter code)

| Concern | Owner |
|---------|-------|
| Local notification schedule (Azan, pre-reminder, Duha, Qiyam) | Flutter (`azan_scheduler`, `daily_reminder_scheduler`) |
| Offline Adhan calculation fallback | Flutter (`prayer_times_calculator`, umm_al_qura) |
| Authoritative schedule when online | Backend `GET /prayers/today`, `/prayers/schedule` |
| Prefs sync | Backend `/profile/azan-preferences` |
| FCM backup after `localScheduledUntil` | Backend + FCM |
| Salawat / Mulk / Khatmah delivery | Backend FCM only |

### Prayer APIs

**GET `/prayers/today`** / **GET `/prayers/schedule`**

Query (optional): `latitude`, `longitude`, `timezone`, `method`, `madhab`, (+ `date` on schedule).

**`data` fields read** (`prayer_schedule_model.dart`):  
`date`, `timezone`, `latitude`, `longitude` (fallback Cairo 30.0444/31.2357 if missing), `city`, `cityAr`, `country`, `countryAr`, `calculationMethod`, `calculationMethodSource?`, `madhab`, `locationSource`, `isDefaultLocation`, `nextPrayer?`, `schedule[]`, `sunrise?`, `completedCount`, `totalCount`.

**Slot:** `name`, `key?`, `nameAr`, `nameEn`, `time`, `iso?`, `displayAr`, `displayEn`, `completed`, `countdownSeconds?`, `trackable`.

**PATCH `/prayers/:normalizedKey/mark`** (not SUNRISE) → `data`: `prayer`, `key`, `completed`.

### Azan catalogs (typically skipAuth)

- `GET /azan/sounds`, `/azan/notification-sounds` → `defaultId`, `items[]`\|`sounds[]` with `id`, names, `audioUrl`, `previewUrl`, `available`, license…
- `GET /azan/audio-defaults` → `azanSoundId`\|`defaultAzanSoundId`, `notificationSoundId`\|`defaultNotificationSoundId`
- `GET /azan/calculation-methods`, `/azan/madhabs`
- Media URL: `{baseUrl}/azan/media/{file}` (Flutter may append `.mp3`)

### Azan preferences PATCH body (`toPatchJson`)

`azanEnabled`, `soundEnabled`, `vibrationEnabled`, `azanSoundId`, `notificationSoundId`, `voiceId` (legacy=azanSoundId), `calculationMethod`, `madhab`, `preReminderMinutes`, `reminderMinutes`, `preReminderEnabled`, `prayers` **full object** keys `fajr|dhuhr|asr|maghrib|isha`, `lastLat`, `lastLng`, `lastLocationLabel`, `fcmPrayerBackupEnabled`.

**Separate PATCH** from scheduler includes `localScheduledUntil` (ISO UTC) — **Backend must accept and use for FCM backup window** (`azan_scheduler.dart`).

**Response-only (do not require on PATCH):** `effectiveCalculationMethod`, `calculationMethodSource`, `lastTimezone`, `isGuestDefaults`, `isDefaultLocation`, `locationSource`.

---

## 10. Adhkar Contract

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/adhkar` | public | home: `greeting`, `dailyWird`, `categories[]` |
| GET | `/adhkar/categories/:KEY` | public | KEY uppercased |
| GET/PUT | `/adhkar/progress` | Bearer | PUT `{ categoryKey, itemId, tapCount }` |
| GET/POST | `/adhkar/favorites` | Bearer | POST `{ itemId }` |
| DELETE | `/adhkar/favorites/:id` | Bearer | |
| GET | `/adhkar/search?q` | public | |
| GET | `/adhkar/full-catalog` | public bytes | offline pack |

**409/404 on favorite add** treated as terminal by outbox (already exists / gone).

**Journey link:** `PATCH /journey/adhkar` `{ categoryKey, completed }` (default category `GENERAL_WIRD`).

---

## 11. Journey / Progress Contract

| Method | Path | Body/Query | Response highlights |
|--------|------|------------|---------------------|
| POST | `/journey/quran-pages/increment` | `{ pages }` | `quranPagesRead` \| `quranPages` |
| GET | `/journey/today` | — | tasks, streak, points, quran/adhkar/sadaqah/prayers, level fields |
| GET | `/journey/dashboard` | `weekDays?`, `month?`, `year?` | levelCard, streakCard, weeklySummaryCard, monthlyCalendarCard, todayTiles, badges, dailyChallenge |
| GET | `/journey/weekly-summary` | `days` | period + categories percents |
| GET | `/journey/monthly-heatmap` | `month`, `year` | cells with status/percents |
| PATCH | `/journey/adhkar` | `{ categoryKey, completed }` | optional today-shaped data |
| PATCH | `/journey/sadaqah` | `amount?`, `goal?`, `category?` (≥1 of amount/goal) | flat progress (`amount`/`sadaqahAmount`/`goal`/`percent`) — **not** full today |
| GET | `/journey/progress` | `days` 1–90 | daily records + summary |
| GET | `/journey/badges` | — | `badges[]`, streak days |
| PATCH | `/journey/prayer` | `{ prayer, completed? }` | void |

**Sadaqah:** tracking only — **no payment provider** in Flutter.

**Dashboard todayTiles nests:** `quran{pages,goal,percent}`, `prayers{completed,total,percent}`, `adhkar{overallCompleted,morningCompleted,eveningCompleted,percent}`, `sadaqah{amount,goal,percent}`.

---

## 12. Sajdah Contract

| Method | Path | Auth |
|--------|------|------|
| GET | `/quran/sajdah-verses?scope=full` | public catalog |
| GET | `/quran/sajdah-verses/my-progress?scope=full` | Bearer |
| PATCH | `/quran/sajdah-verses/:surahId/:ayahNumber?scope=full` | Bearer; body `{}` or `{ completed }` |

**Summary fields:** `muataqidahCompleted/Total/Percent`, `fullCompleted/Total/Percent`, `lastCompletedAt?`.

**Verse:** `verseKey` (or derive `surahId:ayahNumber`), `surahId`, `ayahNumber`, `referenceAr/En`, `textAr/En`, `badgeLabelAr/En`, `completed`, `isIn10Muataqidah`, `sortOrder`, `completedAt?`, `noteAr/En?`.

**Toggle result:** `toggledVerse` (+ `pointsAwarded`), `summary`, `rows[]`.

---

## 13. Ayah Contract

**Do not confuse with** dashboard `verseOfTheDay` / home hadith.

| Method | Path | Special |
|--------|------|---------|
| GET | `/ayah` | Header `X-Noor-App-Open-Id` (process UUID). Session-stable ayah per app open. |
| GET | `/ayah/history?page&limit` | `data` **array**; `meta` pagination; limit clamped 1–100 |

**`AppUserAyah` fields:**  
`id`, `surahId`, `ayahNumber`, `textAr`, `page?`, `juz?`, `surahNameAr`, `surahNameEn`, `surah{id,nameAr,nameEn,revelationType?}`, `historyId`, `sessionId`, `displayDate`, `isNew?` (only if key present), `createdAt?`.

**Backend behavior required by Flutter design:** Same `X-Noor-App-Open-Id` should return the same ayah within a process lifetime; new process → new open id → may get new ayah (`isNew` optional). Exact server algorithm = Backend verification (Status **F** for algorithm details; endpoint contract **B**).

---

## 14. Teacher / Student / Lesson Contract

**LOCAL / NO BACKEND DEPENDENCY FOUND — FEATURE NOT IMPLEMENTED IN FLUTTER.**

No teacher modules, booking, tasmee', homework, attendance, or ratings call sites.

---

## 15. Zoom Contract

**NOT IMPLEMENTED.**  
(`ZoomIn` in tasbih UI is an animation package only.)

---

## 16. Payment Contract

**NOT IMPLEMENTED.**  
Sadaqah is personal amount tracking only (`journey_sadaqah_page.dart` documents “no in-app payments”).

---

## 17. AI Contract

**NOT IMPLEMENTED.**  
Mawqif `/stances` is curated content Q&A, not an LLM API.

---

## 18. Notification / FCM Contract

### 18.1 Device registration

**POST `/devices/fcm-token`** (Bearer):
```json
{ "token": "...", "fcmToken": "...", "platform": "android|ios|other", "appVersion?": "...", "locale?": "..." }
```

**DELETE `/devices/fcm-token`**: `{ "token", "fcmToken" }` on logout/account delete.

Flutter does **not** call `POST /devices/test-push` (docs-only QA).

### 18.2 In-app inbox (not FCM)

`/notifications`, `/unread-count` (`data.count` \| `data.unreadCount`), `/:id`, `/:id/read`, `/read-all`.

**NotificationModel:** `id`, `titleAr`, `bodyAr`, `titleEn?`, `bodyEn?`, `type?`, `read`, `createdAt?`.

### 18.3 FCM data types Flutter handles

`TEST`, `AZAN`, `SALAWAT`, `DUHA`, `QIYAM`, `MULK`, `KHATMAH` via `type` or fallback `eventType` / `legacyEventType`.

### 18.4 Azan / prayer FCM fields read

| Field | Usage |
|-------|--------|
| `type` / `eventType` / `legacyEventType` | Kind |
| `source` | `FCM_BACKUP` triggers local reschedule |
| `prayerKey` / `eventKey` / `prayer` | Prayer identity |
| `kind` | pre-reminder vs prayer-time |
| `date`, `time` / `hhmm` / `occurrenceTime` | Timing |
| `occurrenceKey`, `dedupeKey` | Dedupe / cancel local |
| `preReminderMinutes` | Offset |
| `notificationSoundMediaFile`, `azanSoundMediaFile`, `mediaFile`, `soundId`, `soundType`, `azanSoundUrl`, `azanSoundId`, `nativeSound` | Audio |
| `androidChannelId` | Channel override |
| `title` / `titleAr` / `titleEn` / `title_ar` / `title_en` | Title |
| `body` / `bodyAr` / `bodyEn` / `body_ar` / `body_en` | Body |

### 18.5 Daily reminder FCM

Also reads `deepLink` for navigation. Defaults:

- Mulk → `noorapp://quran/surah/67`
- Khatmah → `noorapp://quran/khatmah`
- Duha/Qiyam → `noorapp://prayers/duha|qiyam`

### 18.6 Ownership matrix (Flutter expectations)

| Reminder | Primary | Backend FCM |
|----------|---------|-------------|
| Azan + pre-prayer | Local | Backup after `localScheduledUntil` |
| Duha / Qiyam | Local | Backup same rule |
| Salawat | — | **Server only** |
| Mulk | — | **Server only** |
| Khatmah | — | **Server only** |

---

## 19. Offline / Cache / Synchronization Contract

### Static packs (P0)

1. `GET /content/static-meta` (public) →  
   `data.quran{catalogVersion, contentHash, totalSurahs?, totalAyahs?, totalPages?, totalJuz?, bismillahStripped?, downloadPath?}`  
   `data.adhkar{catalogVersion, contentHash, totalCategories?, totalItems?, downloadPath?}`
2. If hash/version differs → download:
   - `GET /quran/full-catalog` (bytes, Range/`206` resume, 5 min timeout)
   - `GET /adhkar/full-catalog` (bytes)

### Local caches (no Backend version API beyond above)

- Prayer today/schedule SharedPreferences
- Home dashboard day cache
- Ayah current + history first page (user-scoped; purged on logout)
- Quran page caches

### Offline outbox mutations replayed when online

`journeyIncrement`, `khatmahProgress`, `lastReadPut`, bookmark CRUD, `readingPrefsPatch`, adhkar favorite add/remove, `journeyAdhkar` / `journeySadaqah` / `journeyPrayer`, `profileLocationPut`, `quranImportLocal`, `tasbihIncrement`.

**Backend requirement:** Endpoints must be **idempotent-friendly** where possible (especially favorites 409 = OK, location PUT, last-read PUT).

---

## 20. Deep Links / External URLs

**Scheme:** `noorapp://` only (`app_links`). No verified HTTPS App Links found.

| URI | Action |
|-----|--------|
| `noorapp://auth/reset-password?token=` | Reset password |
| `noorapp://adhkar/{CATEGORY}?item=` | Azkar category |
| `noorapp://home` / `home/ayah|prayer|hadith|journey` | Home |
| `noorapp://quran/resume?page&surahId&ayah` | Reader |
| `noorapp://quran/surah/{id}` | Surah |
| `noorapp://quran/khatmah` | Khatmah |
| `noorapp://prayers/duha\|qiyam` | Prayer times |
| `noorapp://ayah/history` | Ayah history |
| `noorapp://sajdah-verses` | Sajdah |

**Backend-generated URLs that must match Flutter:** password-reset link / FCM `deepLink` values above. Media may be absolute HTTPS or filenames under `/azan/media/`.

---

## 21. Error Contract

### Envelope error

```json
{
  "success": false,
  "message": "human readable",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "...", "code": "..." }],
  "details": {},
  "requestId": "..."
}
```

### Status handling in Flutter

| Status | Behavior |
|--------|----------|
| 401 | Refresh or session expire (`INVALID_TOKEN` immediate) |
| 403 | Forbidden; refresh auth rejection |
| 404 | Not found / terminal outbox for some jobs |
| 409 | Conflict (favorites/bookmarks localized) |
| 429 | Rate limit copy |
| 503 / 5xx | Server unavailable / server error |
| 422 | **No dedicated branch** — treated as generic 4xx / validation if `code` set |
| Timeout / connection | `CONNECTION_TIMEOUT` / `CONNECTION_ERROR` |

### Full code map

See `api_error_localizer.dart` `_codeKeys` (auth, quran, adhkar, journey, challenges, location, tasbih, notifications, profile password, reading prefs, etc.). **Backend should keep these `code` strings stable.**

---

## 22. Security Requirements

### Found in Flutter (types only — values not reproduced)

| Type | Location | Risk |
|------|----------|------|
| Firebase API keys / app ids | `lib/firebase_options.dart`, `google-services.json`, `GoogleService-Info.plist` | Expected client keys; restrict Firebase console |
| Google OAuth Web client ID | `google_auth_config.dart`, Android strings | Required for idToken; not a server secret |
| Hardcoded API base URL | `api_config.dart` | Environment coupling — P1 ops |
| Access/refresh tokens | Secure storage at runtime | Must use HTTPS; rotate refresh on use if Backend policy |

### Not found

- Stripe/Zoom/OpenAI secrets
- Firebase **server** keys in Dart
- Service-account JSON in app sources

### Authorization expectations (user-owned)

All `/profile/*` (except guest-safe reads where applicable), journey mutations, bookmarks, progress, notifications, devices, ayah, nawafel, tasbih writes, sajdah progress, stances answers, challenges claim — **Bearer user only**. Public catalogs must remain usable without auth for guests.

---

## 23. Database Requirements

**REQUIRED BY FLUTTER** (inferred entities — Backend may choose schema):

| Entity | Why Flutter needs it |
|--------|----------------------|
| User + auth tokens/refresh | Login/refresh/logout/delete |
| Password reset token | Forgot/reset |
| Profile location + timezone | Prayers + sync |
| Azan / salawat / duha / qiyam / mulk / khatmah-reminder preferences | Prefs APIs |
| FCM device tokens | Push |
| Notification inbox rows | Inbox APIs |
| Daily journey progress (quran pages, prayers, adhkar, sadaqah, points, streak, badges, level) | Journey APIs |
| Challenges + claims | Challenge APIs |
| Quran bookmarks, last-read, khatmah plan/progress | Quran user APIs |
| Sajdah completion per user/verse | Sajdah progress |
| Adhkar progress + favorites | Adhkar APIs |
| App-user ayah session/history | `/ayah` |
| Nawafel daily marks | Nawafel |
| Tasbih today + custom dhikrs + history | Tasbih |
| Mawqif situations + answers | Stances |
| Content: hadith-of-day, figures, static catalog versions/hashes | Content/static |
| Quran/adhkar static pack blobs | Full-catalog |
| Prayer completion marks | `/prayers/:key/mark` |

**BACKEND IMPLEMENTATION CHOICE:** indexes, partitioning, caching technology, Quran Foundation proxy details — not dictated by Flutter beyond response shapes and latency expectations.

**Deletion:** `DELETE /auth/me` must remove or anonymize user-owned rows Flutter will no longer access; Flutter purges local caches after success.

---

## 24. Cron / Background Job Requirements

Inferred from Flutter FCM + server-only reminders (Backend verification required):

| Job | Cadence / trigger | Flutter dependency |
|-----|-------------------|--------------------|
| FCM Azan/pre-prayer backup | Around prayer times when beyond `localScheduledUntil` | Payload contract §18 |
| Salawat push | Per salawat preferences (interval/quiet hours — server) | Type `SALAWAT` |
| Mulk reminder | Scheduled per prefs | Type `MULK` + deep link |
| Khatmah reminder | Scheduled; ideally skip if ward done | Type `KHATMAH` |
| Password reset email | On forgot-password | Email + deep link |
| Static catalog publish | When packs change | Update `static-meta` version/hash |
| Ayah rotation / session binding | Per open id / day policy | `/ayah` |

**Idempotency:** Flutter dedupes via `dedupeKey` / `occurrenceKey` / handled stores — Backend should collapse retries with same keys.

---

## 25. Third-Party Integration Requirements

| Service | Flutter direct? | Backend role |
|---------|-----------------|--------------|
| Firebase Messaging | Yes | Send FCM using registered tokens; shared Firebase project |
| Firebase Analytics/Crashlytics | Yes | Optional Backend correlation via `requestId` |
| Google Sign-In | Yes (idToken) | Verify `idToken` on `/auth/google` |
| Adhan / local calc | Yes | Prefer server schedule when online |
| Quran audio CDN | Via Backend URL | `/quran/audio` returns playable URL |
| Email | No | Forgot-password emails |
| Zoom / Payments / LLM | No | N/A |

**Never put private Firebase Admin / SMTP / OAuth client secrets in Flutter.**

---

## 26. Performance Requirements

| Expectation | Evidence |
|-------------|----------|
| 20s default timeouts | `ApiConfig` |
| 5 min receive for full catalogs | static/quran download |
| HTTP Range + 206 for Quran pack resume | `getBytes` |
| Pagination meta for notifications + ayah history | `ApiMeta` |
| Prefer small JSON for pages vs ~MB catalog download | separate endpoints |
| Guest uses public routes without forcing auth | `skipAuth` |
| Outbox ordered replay | stop on first failure |

Do **not** require Redis specifically — only stable low-latency for `/dashboard`, `/prayers/today`, `/ayah`, FCM registration.

---

## 27. Mock / Fake / Placeholder Audit

| Item | Path | Production risk |
|------|------|-----------------|
| `QuranMockData` catalog/pages | `quran_mock_data.dart` | Used if offline pack + API fail — **degraded UX** |
| Guest home local dashboard | `home_local_datasource.dart` | Hardcoded ayah/hijri/zeros until network merge |
| Cairo lat/lng defaults | `prayer_schedule_model.dart` | If Backend omits coords |
| Google Web client placeholder prefix | `google_auth_config.dart` | Breaks Google login if misconfigured |
| Noor Plus / coming soon | `noor_plus_page.dart` | Not Backend |
| Stale l10n “Coming soon” strings | l10n | Cosmetic |

**No production screen should rely on mock Quran if Backend + packs are healthy.**

---

## 28. Missing Backend Requirements

Items Flutter depends on that **cannot be confirmed from Flutter alone** as present in production Backend (Status **F** until Backend verified). Treat as checklist for Backend engineer:

### MB-001 — Password reset deep link format  
**Feature:** Auth  
**Evidence:** `deep_link_handler.dart` `resetTokenFromUri`  
**Required:** Email link opens `noorapp://auth/reset-password?token=...` (or HTTPS redirect into it)  
**Priority:** P0 | **Blocker:** YES if reset is shipped

### MB-002 — FCM Salawat / Mulk / Khatmah delivery  
**Evidence:** `salawat_scheduler.dart` server-only; `daily_reminder_scheduler.dart` Mulk/Khatmah server-only; `fcm_service.dart` types  
**Required:** Cron/worker sends typed FCM with §18 fields + prefs respect  
**Priority:** P0 | **Blocker:** YES for those features

### MB-003 — Azan FCM backup using `localScheduledUntil`  
**Evidence:** `azan_scheduler.dart` PATCH; docs + prefs model  
**Required:** Skip backup ≤ `localScheduledUntil`; send after  
**Priority:** P0 | **Blocker:** YES for duplicate/missing Azan

### MB-004 — `X-Noor-App-Open-Id` semantics on `GET /ayah`  
**Evidence:** `api_client.dart`, `noor_app_open_id.dart`  
**Required:** Stable ayah per open id within session policy  
**Priority:** P0 | **Blocker:** YES for ayah-of-session UX

### MB-005 — Static pack bytes + meta integrity  
**Evidence:** `static_content_remote_datasource.dart`  
**Required:** Valid catalogs; version/hash bump on content change; Range support  
**Priority:** P0 | **Blocker:** YES for offline Quran/Adhkar gates

*(All other endpoints in §4 are Flutter-called — Missing only if Backend lacks them; classify after Backend repo check.)*

---

## 29. Partial Backend Requirements

| ID | Item | Flutter evidence | Gap |
|----|------|------------------|-----|
| PB-001 | Quran search `data` shape | accepts list \| `ayahs` \| `results` | Pin one shape additively |
| PB-002 | Juz surahs `data` shape | list \| `{surahs:[]}` | Same |
| PB-003 | Audio/tafsir text keys | multiple key fallbacks | Prefer documented primary keys; keep fallbacks |
| PB-004 | Catalog options | list \| `{items:[]}` + client hardcoded fallbacks | Serve real catalogs |
| PB-005 | Home guest path | local mock + merge | Ensure public hadith/prayers/figure work without auth |
| PB-006 | Sadaqah PATCH response | flat progress not full today | Keep documented |

---

## 30. Potential Contract Mismatches

| Risk | Flutter expectation | Safe Backend approach |
|------|---------------------|------------------------|
| Snake_case fields | camelCase everywhere in parsers | Keep camelCase; do not rename |
| Auth tokens at root | nested `data.tokens` | Keep nest |
| `GET /auth/me` vs login user nest | me = user map in `data`; login = `data.user` | Keep both shapes |
| `expiresIn` as string | number seconds only | Send numeric seconds |
| Removing `success` envelope | `_unwrap` requires Map + success | Keep envelope (bytes endpoints excepted) |
| Changing ayah history `data` from array to object | expects List | Additive wrapper only with Flutter change |
| Renaming FCM `type` | also reads `eventType` | Keep both |
| Dropping `localScheduledUntil` | Flutter patches it | Keep field |

---

## 31. Breaking Change Risks

Any of the following is **`BREAKING CHANGE — REQUIRES FLUTTER COORDINATION`:**

1. Rename/move `data.tokens.accessToken` / `refreshToken`
2. Change `/auth/*` paths or methods
3. Remove envelope `success` / change false handling
4. Rename Quran identifiers (`surahId`, `ayahNumber`, page 1–604)
5. Change sajdah path param order
6. Change FCM type enum strings
7. Change password reset token query name from `token`
8. Require auth on currently public catalog routes (breaks guests)
9. Stop accepting dual query keys (`reciterId`+`reciter`, `tafsirId`+`source`) without Flutter update

**Default policy:** additive fields only.

---

## 32. P0 Production Blockers

1. Auth login/signup/Google/refresh/logout/delete contracts match §5 (**Backend verify**).
2. Envelope + error `code` stability (**Backend verify**).
3. `GET /dashboard` + `GET /prayers/today` for signed-in home (**Backend verify**).
4. Quran public pages + full-catalog + static-meta (**Backend verify**).
5. Adhkar catalog + full-catalog (**Backend verify**).
6. Journey today/dashboard + mutation endpoints (**Backend verify**).
7. Ayah `GET /ayah` + open-id header behavior (**Backend verify**).
8. FCM token register + Salawat/Mulk/Khatmah server pushes + Azan backup window (**Backend verify**).
9. Azan preferences including `localScheduledUntil` (**Backend verify**).
10. Password reset email → `noorapp://` token link (**Backend verify**).
11. Account deletion `DELETE /auth/me` cascades user data (**Backend verify**).
12. HTTPS production API reachable from app stores builds; CORS not applicable (mobile) but TLS valid.

---

## 33. P1 Production Requirements

- Notifications inbox CRUD-read flows
- Challenges list/claim
- Profile change-password + location quality
- Reading preferences sync
- Qibla APIs
- Figure/hadith of day content freshness
- Sajdah progress persistence
- Nawafel / tasbih / mawqif completeness
- Bookmark/khatmah edge cases + import-local on guest merge
- Audio/tafsir/translation catalogs populated (not just Flutter fallbacks)

---

## 34. P2 Improvements

- Pin single response shapes where Flutter accepts unions
- Pagination consistency (`perPage` vs `limit`)
- Richer notification `type` deep links for inbox items (if Backend adds; Flutter inbox model currently limited fields)
- Reduce guest mock surface by caching more public endpoints
- Environment-based API base URL (Flutter-side ops)

---

## 35. Backend Implementation Checklist

- [ ] Verify all endpoints in §4 exist on production `/api/v1`
- [ ] Verify auth AuthResult token nest + refresh
- [ ] Verify Google idToken verification
- [ ] Verify forgot/reset email deep link
- [ ] Verify `DELETE /auth/me`
- [ ] Verify envelope + localized `code` strings
- [ ] Verify `/dashboard` payload vs `home_dashboard_model.dart`
- [ ] Verify prayers schedule + mark
- [ ] Verify azan catalogs + media files + preferences + `localScheduledUntil`
- [ ] Verify FCM workers: AZAN backup, SALAWAT, DUHA/QIYAM backup, MULK, KHATMAH
- [ ] Verify devices token register/unregister
- [ ] Verify journey + challenges
- [ ] Verify Quran user + public + packs
- [ ] Verify adhkar + packs
- [ ] Verify ayah + history pagination
- [ ] Verify sajdah / nawafel / tasbih / stances / qibla / content
- [ ] Load-test full-catalog download + Range
- [ ] Confirm no breaking renames
- [ ] Confirm guest public routes remain open
- [ ] Confirm PII deletion on account delete
- [ ] Confirm rate limits return 429 + `TOO_MANY_REQUESTS` / `RATE_LIMIT_EXCEEDED`

---

## 36. Flutter Remaining Work

(Backend-independent or Flutter-owned)

1. Confirm Google Web client ID / SHA-1 production config (not Backend).
2. Avoid shipping with API pointing only to one hardcoded Railway URL if multi-env needed (`api_config.dart`).
3. Ensure offline packs download UX before Quran/Adhkar gates (already implemented — QA).
4. Noor Plus / monetization still “coming soon” — not Backend-blocked.
5. Android intent-filter hosts for `ayah` / `sajdah-verses` / `prayers` may be incomplete vs Dart handlers — deep link QA.
6. Remove or gate Quran mock fallback for production builds if product requires fail-closed (product decision).
7. HTTPS App Links for password reset (optional Flutter+Android/iOS work) if email cannot use custom scheme.
8. Teacher/Zoom/Payment/AI — not started.

---

## 37. Final Production Readiness Assessment

| Dimension | Assessment |
|-----------|------------|
| Flutter API surface discovery | **Complete** (this document) |
| Flutter contract detail | **High** for called endpoints |
| Backend implementation match | **Not verified** (Backend repo/production not audited here) |
| Teacher/Zoom/Payment/AI | **N/A — not in Flutter** |
| Production integration claim | **Cannot claim production-ready integration without Backend verification** |

### Backend Completion Summary

```text
Total backend dependencies (unique path templates ~110; call sites ~121):
A — Implemented and verified:     0
B — Implemented but not verified: ~110 (Flutter-defined contracts)
C — Partially implemented:        ~6 (multi-shape / fallback / guest merge areas)
D — Missing:                      0 confirmed missing in Flutter; Backend presence unconfirmed
E — Incompatible:                 0 (cannot assert without Backend)
F — Unknown:                      FCM cron semantics, ayah open-id algorithm, email link format, DB cascades
```

### Production Blockers

1. Backend verification of auth + envelope + refresh (P0).
2. Backend verification of dashboard + prayers + azan prefs/`localScheduledUntil` (P0).
3. Backend verification of static packs + Quran/Adhkar catalogs (P0).
4. Backend verification of journey mutations (P0).
5. Backend verification of ayah session header behavior (P0).
6. Backend verification of FCM token + Salawat/Mulk/Khatmah + Azan backup (P0).
7. Backend verification of password-reset deep link delivery (P0).
8. Backend verification of account deletion side effects (P0).

### Exact Backend Work Order

**P0 (dependency order):**  
1) Auth + envelope + refresh → 2) Profile/timezone/location → 3) Devices FCM → 4) static-meta + full catalogs → 5) prayers + azan prefs/media → 6) FCM workers (backup + server-only reminders) → 7) dashboard → 8) journey → 9) ayah → 10) adhkar user progress → 11) quran user (bookmarks/khatmah) → 12) delete account cascades → 13) password reset email.

**P1:** notifications inbox, challenges, sajdah, nawafel, tasbih, mawqif, qibla, content figure/hadith, reading prefs, audio/tafsir catalogs.

**P2:** response shape pinning, deeper inbox types, multi-env hardening.

### Flutter Remaining Work

See §36.

### Backend Verification Required

Everything marked **B/C/F** above — specifically live responses for each endpoint in §4 against Flutter parsers, FCM end-to-end on real devices, pack download on slow networks, and auth Google production OAuth.

---

## Appendix A — Gap analysis master table (selected)

| ID | Feature | Flutter Evidence | Backend Requirement | Status | Priority | Production Blocking |
|----|---------|------------------|---------------------|--------|----------|---------------------|
| G01 | Auth tokens | `auth_tokens_parser.dart` | `data.tokens.accessToken/refreshToken` | B | P0 | YES |
| G02 | Google auth | `auth_remote_datasource.loginWithGoogle` | Verify `idToken` | B | P0 | YES |
| G03 | Refresh | `api_client._refreshToken` | `POST /auth/refresh` | B | P0 | YES |
| G04 | Delete account | `deleteMe` | `DELETE /auth/me` + cascade | B | P0 | YES |
| G05 | Reset link | `deep_link_handler` | Email → `noorapp://…?token=` | F | P0 | YES |
| G06 | Dashboard | `home_remote_datasource` | `GET /dashboard` shape | B | P0 | YES |
| G07 | Prayers | `prayers_remote_datasource` | today/schedule/mark | B | P0 | YES |
| G08 | Azan prefs + until | `azan_settings`, `azan_scheduler` | PATCH accepts `localScheduledUntil` | B | P0 | YES |
| G09 | FCM Salawat/Mulk/Khatmah | `fcm_service`, schedulers | Server push | F | P0 | YES |
| G10 | Static packs | `static_content_*` | meta + bytes + Range | B | P0 | YES |
| G11 | Journey | `journey_remote_datasource` | all `/journey/*` | B | P0 | YES |
| G12 | Ayah | `ayah_remote_datasource` + open id header | Session ayah | B/F | P0 | YES |
| G13 | Quran mock fallback | `quran_repository_impl` | Healthy API/packs | C | P0 | YES (UX) |
| G14 | Challenges | `challenges_*`, home claim | claim endpoints | B | P1 | NO |
| G15 | Inbox | `notifications_*` | list/read | B | P1 | NO |
| G16 | Teacher/Zoom/Pay/AI | none | none | — | — | NO |

---

## Appendix B — Exact API call field template (representative)

### Example: Login

| Field | Value |
|-------|-------|
| Flutter file | `lib/features/auth/data/datasources/auth_remote_datasource.dart` |
| Class | `AuthRemoteDataSourceImpl` |
| Function | `login` |
| Feature | Authentication |
| HTTP method | POST |
| Endpoint | `/auth/login` |
| Auth | None (`skipAuth: true`) |
| Headers | JSON accept/content-type |
| Body | `{ email, password }` |
| Response envelope | `{ success, data:{ tokens, user }, ... }` |
| Data fields | tokens.accessToken, tokens.refreshToken, tokens.expiresIn?, user.id, user.fullName\|displayName\|username, user.email, user.provider?, user.providerId? |
| Errors | validation field errors, INVALID_CREDENTIALS, 429 |
| Retry | none (client) |
| Cache | tokens in secure storage |
| Offline | fails closed |
| Priority | P0 |
| Status | B |

*(All other endpoints follow the same pattern; details in §§5–13 and inventory §4.)*

---

**End of audit.**  
Hand this file to the Noor Backend engineer as the Flutter-side contract source of truth. Re-run Backend verification against this document before claiming production readiness.
