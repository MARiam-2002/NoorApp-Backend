# Backend Integration Complete — Flutter Readiness Report

**Audience:** Flutter development team  
**App:** Noor Flutter (`lib/`)  
**Base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Report Date:** 2026-08-28  
**Status:** ✅ All required backend requirements verified and complete  

This document confirms that every item listed in `BACKEND_DATA_CONTRACT.md` has been audited line by line against the live backend source code. All gaps identified during the audit have been fixed. The backend is now fully ready for Flutter integration.

Related docs: [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md), [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md), [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## Summary of audit result

| Contract section | Status | Notes |
|-----------------|--------|-------|
| §0 — Response envelope | ✅ Complete | All fields present on every response |
| §1 — Auth | ✅ Complete | Tokens nested correctly; `/auth/me` flat; logout hardened |
| §2 — Dashboard | ✅ Complete | All sub-sections present; prayer times in 24h + display strings |
| §3 — Quran public browse | ✅ Complete | Surah names resolved on every surface; Bismillah rules correct; Range support added to full-catalog |
| §4 — Quran authenticated progress | ✅ Complete | Bookmarks, last-read, khatmah all include required name fields |
| §5 — Reading preferences | ✅ Complete | GET + PATCH with font clamp 12–60 |
| §6 — Adhkar | ✅ Complete | Public home + category endpoints; progress GET/PUT wired |
| §7 — Journey | ✅ Complete | `/journey/today`, `/journey/progress`, `/journey/sadaqah` all live |
| §8 — Tasbih | ✅ Complete | All contract fields + Flutter aliases present |
| §9 — Qibla | ✅ Complete | All fields including `bearingRadians`, `distanceKm`, `userLocation` |
| §10 — Notifications | ✅ Complete | Full CRUD: list, unread-count, mark-read, read-all, delete |
| §11 — Profile | ✅ Complete | GET me, PATCH update, PATCH change-password, PUT location |
| §12 — Guest / skipAuth | ✅ Complete | All public routes confirmed unauthenticated |

---

## §0 — Response envelope

Every JSON response — success or error — follows the contract shape exactly.

**Success:**
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

**Error:**
```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | INVALID_TOKEN | NOT_FOUND | …",
  "errors": [{ "field": "email", "message": "…" }],
  "details": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

| Rule | Status |
|------|--------|
| `401` + `INVALID_TOKEN` code when token is bad | ✅ JWT errors map to `INVALID_TOKEN` / `TOKEN_EXPIRED` codes |
| `401` + `UNAUTHORIZED` on missing token | ✅ Auth middleware throws `UNAUTHORIZED` |
| 5xx on `/auth/me` does NOT look like a hard logout | ✅ Network/db errors never produce `INVALID_TOKEN` code |
| Tokens nested under `data.tokens.{ accessToken, refreshToken, expiresIn }` | ✅ All auth responses use this exact nesting |

---

## §1 — Auth

All eight endpoints are live. No changes were required to the auth routes.

| Method | Path | Status |
|--------|------|--------|
| POST | `/auth/sign-up` | ✅ |
| POST | `/auth/login` | ✅ |
| POST | `/auth/google` | ✅ |
| POST | `/auth/refresh` | ✅ |
| POST | `/auth/logout` | ✅ (hardened — see below) |
| GET | `/auth/me` | ✅ |
| POST | `/auth/forgot-password` | ✅ |
| POST | `/auth/reset-password` | ✅ |

**Login / sign-up / Google / refresh `data` shape:**
```json
{
  "user": {
    "id": "string",
    "fullName": "string",
    "email": "string",
    "provider": "LOCAL | GOOGLE",
    "providerId": "string|null",
    "displayName": "string",
    "username": "string",
    "googleId": "string|null"
  },
  "tokens": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": 3600
  }
}
```

**`GET /auth/me` `data` shape (flat):**
```json
{
  "id": "string",
  "fullName": "string",
  "email": "string",
  "provider": "LOCAL | GOOGLE",
  "providerId": "string|null",
  "displayName": "string",
  "username": "string",
  "googleId": "string|null"
}
```

**Fix applied — `POST /auth/logout` hardened:**  
Previously, sending an expired or malformed `refreshToken` to logout returned a `400` error instead of succeeding. This caused Flutter to incorrectly believe the logout failed. The service now swallows JWT verification errors on logout and always returns `200`. The token is safely treated as already revoked.

---

## §2 — Home dashboard

`GET /dashboard` returns all sections Flutter parses. No missing fields.

```json
{
  "greeting": {
    "displayName": "string",
    "weekdayName": "string",
    "hijriDate": "string",
    "points": 0
  },
  "prayers": {
    "nextPrayer": {
      "name": "Asr",
      "nameAr": "العصر",
      "time": "16:34",
      "displayAr": "٤:٣٤ م",
      "displayEn": "4:34 PM",
      "iso": "2026-08-28T14:34:00.000Z",
      "countdownSeconds": 1200
    },
    "schedule": [
      {
        "name": "Fajr",
        "nameAr": "الفجر",
        "time": "04:52",
        "displayAr": "٤:٥٢ ص",
        "displayEn": "4:52 AM",
        "iso": "2026-08-28T02:52:00.000Z",
        "completed": true
      }
    ]
  },
  "verseOfTheDay": { "textAr": "…", "referenceAr": "…" },
  "hadithOfTheDay": { "textAr": "…", "sourceAr": "…" },
  "dailyJourney": {
    "prayer": { "completed": 2, "total": 5, "progress": 0.4 },
    "quran": { "pagesRead": 3 },
    "adhkar": { "completed": false },
    "sadaqah": { "amount": 0 }
  },
  "khatmah": {
    "surahId": 2,
    "surahNameAr": "البقرة",
    "surahNameEn": "Al-Baqarah",
    "currentPage": 12,
    "progressPercent": 2
  },
  "dailyChallenge": {
    "titleAr": "…",
    "descriptionAr": "…",
    "rewardPoints": 10,
    "targetValue": 5,
    "completed": false,
    "claimed": false
  },
  "utilities": { "tasbih": { "enabled": true }, "qibla": { "enabled": true } }
}
```

| Requirement | Status |
|------------|--------|
| Prayer times in 24h `HH:mm` format | ✅ `time` field is always 24-hour |
| `displayAr` / `displayEn` for Flutter formatting | ✅ Both present on every prayer entry |
| `iso` timestamp for exact countdown | ✅ Present on every prayer entry |
| `khatmah.surahNameAr` is always a real Arabic name, never a bare number | ✅ Resolved via `resolveSurahNameAr()` with canonical 114-surah catalog |
| `dailyChallenge.claimed` field present | ✅ |
| `POST /challenges/today/claim` returns `pointsAwarded` and `claimed` | ✅ Both fields present in response |

---

## §3 — Quran public browse

All routes are public (`skipAuth: true`) — no Bearer token required for guests.

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/quran/surahs` | public | ✅ |
| GET | `/quran/surahs/:id/ayahs` | public | ✅ |
| GET | `/quran/juz` | public | ✅ |
| GET | `/quran/juz/:n/surahs` | public | ✅ |
| GET | `/quran/pages/:page` | public | ✅ |
| GET | `/quran/full-catalog` | public | ✅ (Range support added) |
| GET | `/quran/juz/:n/ayahs` | public | ✅ |

### Surah names — never bare IDs

**Problem found and fixed:** Multiple endpoints were returning surah objects directly from the database without passing them through the name-resolution layer. In production databases, `nameAr` can arrive as `"3"`, `"6"`, `"7"` (bare surah IDs) due to seeding issues. The following surfaces were audited and all now use `withResolvedSurahNames()` or `resolveSurahNameAr()` before sending data to Flutter:

| Surface | Fix applied |
|---------|------------|
| `GET /quran/surahs` | ✅ Already correct — uses `resolveSurahNameAr/En` |
| `GET /quran/juz` — `firstSurah` object | ✅ Fixed — now uses `withResolvedSurahNames()` |
| `GET /quran/juz/:n/surahs` — each surah in list | ✅ Fixed — now uses `withResolvedSurahNames()` |
| `GET /quran/pages/:page` — `surahs[]` array | ✅ Fixed — now uses `withResolvedSurahNames()` |
| `GET /quran/full-catalog` — each surah in `surahs[]` | ✅ Fixed — now uses `resolveSurahNameAr/En` |
| `GET /quran/juz/:n/ayahs` — `surahs[]` array | ✅ Fixed — now uses `withResolvedSurahNames()` |
| `GET /quran/search` — `surah` object on each result | ✅ Fixed — now uses `withResolvedSurahNames()` |
| Bookmarks `surah.nameAr` / `surahNameAr` | ✅ Already correct |
| Last-read `surah.nameAr` / `surahNameAr` | ✅ Already correct |
| Khatmah stats `surahNameAr` | ✅ Already correct — uses `resolveSurahNameAr/En` |
| Dashboard `khatmah.surahNameAr` | ✅ Already correct |

The canonical name catalog is embedded in the server binary (`src/data/surahs.ts`) and is independent of the database. Even if the database row has a corrupt or missing `nameAr`, the resolver always returns the correct Arabic name for all 114 surahs.

### Bismillah / text hygiene

| Rule | Status |
|------|--------|
| Surahs 2–8, 10–114: ayah #1 Bismillah stripped from `textAr` | ✅ |
| Surah 1 (Al-Fatihah): Bismillah kept in ayah 1 | ✅ |
| Surah 9 (At-Tawbah): no Bismillah added or stripped | ✅ |
| BOM (`U+FEFF`) stripped from all `textAr` | ✅ |

### Full catalog — HTTP Range resume

**Fix applied:** `GET /quran/full-catalog` previously used a plain JSON response with no `Accept-Ranges` header. Flutter's offline installer could not resume interrupted downloads. The handler now uses `sendJsonWithRange()` which:
- Sets `Accept-Ranges: bytes` on every response
- Parses the incoming `Range: bytes=X-Y` header
- Returns `206 Partial Content` with correct `Content-Range` when a range is requested
- Returns the full payload with `200 OK` when no range header is present

This applies to both `/quran/full-catalog` and is consistent with the behavior expected for large offline payloads.

### Surah object shape (confirmed on all surfaces)

```json
{
  "id": 3,
  "nameAr": "آل عمران",
  "nameEn": "Ali 'Imran",
  "revelationType": "MADANI",
  "totalAyahs": 200,
  "totalPages": 20,
  "startPage": 50
}
```

### Page payload shape (confirmed)

```json
{
  "page": 50,
  "totalPages": 604,
  "ayahs": [
    { "surahId": 3, "ayahNumber": 1, "textAr": "…", "page": 50, "juz": 3 }
  ],
  "surahs": [
    { "id": 3, "nameAr": "آل عمران", "nameEn": "Ali 'Imran", "revelationType": "MADANI" }
  ]
}
```

---

## §4 — Quran authenticated progress

All endpoints exist and return the required fields.

| Method | Path | Status |
|--------|------|--------|
| GET | `/quran/bookmarks` | ✅ |
| POST | `/quran/bookmarks` | ✅ |
| DELETE | `/quran/bookmarks/:id` | ✅ |
| GET | `/quran/last-read` | ✅ |
| PUT | `/quran/last-read` | ✅ |
| GET | `/quran/khatmah/stats` | ✅ |
| PATCH | `/quran/khatmah/progress` | ✅ |
| POST | `/journey/quran-pages/increment` | ✅ |

**Bookmark response (confirmed fields):**
```json
{
  "id": "uuid",
  "surahId": 2,
  "ayahNumber": 255,
  "page": 42,
  "textAr": "…",
  "note": null,
  "surahNameAr": "البقرة",
  "surah": { "id": 2, "nameAr": "البقرة", "nameEn": "Al-Baqarah" },
  "createdAt": "ISO-8601"
}
```

**Last-read response (confirmed fields):**
```json
{
  "surahId": 2,
  "page": 42,
  "ayahNumber": 255,
  "juz": 3,
  "surahNameAr": "البقرة",
  "surah": { "id": 2, "nameAr": "البقرة", "nameEn": "Al-Baqarah" }
}
```

| Requirement | Status |
|------------|--------|
| `surahNameAr` always a real Arabic name on bookmarks | ✅ |
| `surahNameAr` always a real Arabic name on last-read | ✅ |
| `ayahNumber` persisted on last-read for ayah-accurate resume | ✅ |
| `juz` included on last-read | ✅ |
| Khatmah stats `surahNameAr` always resolved | ✅ |
| Idempotent writes (bookmark create, last-read PUT) | ✅ |

**Flutter dual-counter call order supported:**
1. `POST /journey/quran-pages/increment` — ✅
2. `PATCH /quran/khatmah/progress` — ✅
3. `PUT /quran/last-read` — ✅

---

## §5 — Reading preferences

| Method | Path | Status |
|--------|------|--------|
| GET | `/profile/reading-preferences` | ✅ |
| PATCH | `/profile/reading-preferences` | ✅ |

**Response shape:**
```json
{
  "quranFontSize": 28,
  "quranReciter": "Mishary_Alafasy",
  "quranTafsir": "Ibn_Kathir",
  "quranTranslation": "Sahih_International"
}
```

| Requirement | Status |
|------------|--------|
| Font size clamped to 12–60 (returns `400` outside range) | ✅ Enforced in service layer |
| Partial update (only send fields you want to change) | ✅ All four fields are optional in PATCH |

---

## §6 — Adhkar

All routes are public — no token required.

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/adhkar` | public | ✅ |
| GET | `/adhkar/categories/:KEY` | public | ✅ |
| GET | `/adhkar/progress?categoryKey=` | Bearer | ✅ |
| PUT | `/adhkar/progress` | Bearer | ✅ |

**Home response includes:**
- `greeting` — Arabic string
- `dailyWird` — with `progressItemsDone`, `progressItemsTotal`, `progressPercent`, `ctaAr`, `categoryKey`, `items[]`
- `categories[]` — each with `id`, `key`, `nameAr`, `nameEn`, `descriptionAr`, `iconCode`, `sortOrder`, `totalItems`

**Category item shape:**
```json
{
  "id": "stable-uuid-or-slug",
  "orderInCategory": 1,
  "textAr": "…",
  "textArPlain": "…",
  "repeatCount": 3,
  "referenceAr": "…",
  "benefitAr": "…"
}
```

**Adhkar progress (GET/PUT) — supports resume mark:**
```json
{
  "categoryKey": "MORNING",
  "markedItemId": "item-uuid",
  "items": [
    { "itemId": "item-uuid", "tapCount": 2, "completed": false }
  ],
  "progressItemsDone": 3,
  "progressItemsTotal": 20,
  "progressPercent": 15
}
```

---

## §7 — Journey

All journey endpoints are live. `PATCH /journey/sadaqah` is wired.

| Method | Path | Status |
|--------|------|--------|
| POST | `/journey/quran-pages/increment` | ✅ |
| GET | `/journey/today` | ✅ |
| GET | `/journey/progress` | ✅ |
| PATCH | `/journey/adhkar` | ✅ |
| PATCH | `/journey/sadaqah` | ✅ |

**`GET /journey/today` response shape:**
```json
{
  "date": "2026-08-28",
  "tasks": [
    { "key": "quran", "titleAr": "قراءة القرآن", "done": false, "progress": 0.3 },
    { "key": "prayer", "titleAr": "الصلوات", "done": false, "progress": 0.4 },
    { "key": "adhkar", "titleAr": "الأذكار", "done": true },
    { "key": "sadaqah", "titleAr": "الصدقة", "done": false, "amount": 0 }
  ],
  "streakDays": 4,
  "badges": [],
  "points": 120
}
```

**`GET /journey/progress` query param:** `?days=7` (default 7, max 365)

---

## §8 — Tasbih

All endpoints live. All contract fields + Flutter aliases present.

| Method | Path | Status |
|--------|------|--------|
| GET | `/tasbih/today` | ✅ |
| POST | `/tasbih/increment` | ✅ |
| POST | `/tasbih/reset` | ✅ |
| PATCH | `/tasbih/change-dhikr` | ✅ |

**Response shape (all fields confirmed):**
```json
{
  "count": 33,
  "dhikr": "ALHAMDULILLAH",
  "dhikrAr": "الحمد لله",
  "dailyGoal": 99,
  "progressPercent": 33,
  "todayCount": 33,
  "currentDhikr": "ALHAMDULILLAH",
  "currentDhikrAr": "الحمد لله",
  "currentDhikrCount": 33
}
```

The four Flutter aliases (`todayCount`, `currentDhikr`, `currentDhikrAr`, `currentDhikrCount`) are present on every tasbih response so Flutter can read either the primary or alias field name without breaking.

---

## §9 — Qibla

Public route — no token required.

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/qibla/calculate?lat=&lng=` | public | ✅ |

**Response shape (all fields confirmed):**
```json
{
  "bearingDegrees": 136.5,
  "bearingRadians": 2.38,
  "directionAr": "جنوب شرق",
  "distanceKm": 1200.4,
  "userLocation": { "latitude": 30.0, "longitude": 31.0 }
}
```

Note: the query accepts both `lat`/`lng` and `latitude`/`longitude` spelling — both work.

---

## §10 — Notifications

All five endpoints are live and require Bearer authentication.

| Method | Path | Status |
|--------|------|--------|
| GET | `/notifications` | ✅ |
| GET | `/notifications/unread-count` | ✅ |
| PATCH | `/notifications/:id/read` | ✅ |
| POST | `/notifications/read-all` | ✅ |
| DELETE | `/notifications/:id` | ✅ |

**Notification object shape:**
```json
{
  "id": "uuid",
  "titleAr": "…",
  "titleEn": "…",
  "bodyAr": "…",
  "bodyEn": "…",
  "type": "SYSTEM | AZAN | CHALLENGE",
  "read": false,
  "isRead": false,
  "readAt": null,
  "createdAt": "ISO-8601"
}
```

Note: both `read` and `isRead` are present — Flutter can use either field name.

`GET /notifications` meta includes `unreadCount` alongside standard pagination fields:
```json
{
  "page": 1, "perPage": 20, "total": 45,
  "totalPages": 3, "hasNext": true, "hasPrev": false,
  "unreadCount": 7
}
```

---

## §11 — Profile

All four endpoints are live and require Bearer authentication.

| Method | Path | Status |
|--------|------|--------|
| GET | `/profile/me` | ✅ |
| PATCH | `/profile/update` | ✅ |
| PATCH | `/profile/change-password` | ✅ |
| PUT | `/profile/location` | ✅ |

`PATCH /profile/update` accepts partial updates — send only the fields you want to change (`fullName`, `username`, `email`, `timezone`).

`PATCH /profile/change-password` requires `{ currentPassword, newPassword }` and returns `400` with `INVALID_CREDENTIALS` if the current password is wrong. Returns a clear error for Google-only accounts that have no password.

`PUT /profile/location` accepts `{ latitude, longitude, timezone? }` and updates the coordinates used by prayer time calculations and the Qibla endpoint.

---

## §12 — Guest / skipAuth routes

The following routes require **no Bearer token** and work for guests:

| Route group | Endpoints |
|------------|-----------|
| Auth (public) | `/auth/sign-up`, `/auth/login`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`, `/auth/logout` |
| Quran | `/quran/surahs`, `/quran/surahs/:id/ayahs`, `/quran/juz`, `/quran/juz/:n/surahs`, `/quran/pages/:page`, `/quran/full-catalog`, `/quran/juz/:n/ayahs`, `/quran/search`, `/quran/ayahs/random` |
| Adhkar | `/adhkar`, `/adhkar/categories`, `/adhkar/categories/:key`, `/adhkar/daily-wird` |
| Qibla | `/qibla/calculate` |

All other endpoints require `Authorization: Bearer <accessToken>`.

---

## Changes made to backend code

The following source files were modified during this audit to close the gaps:

### `src/controllers/quran.controller.ts`
- `getFullQuranCatalogHandler` now calls `sendJsonWithRange()` instead of `sendSuccess()`, enabling HTTP `Range` header support for resume-capable offline downloads.

### `src/services/quran.service.ts`
- `getFullQuranCatalog()` — surah entries in the catalog now use `resolveSurahNameAr()` and `resolveSurahNameEn()` so bare-ID names can never reach Flutter even if the database row is corrupt.
- `listJuz()` — `firstSurah` object now passes through `withResolvedSurahNames()`.
- `listJuzSurahs()` — each surah row now passes through `withResolvedSurahNames()` before being spread into the response.
- `listAyahsByPage()` — `surahs[]` array now maps through `withResolvedSurahNames()`.
- `listAyahsByJuz()` — `surahs[]` array now maps through `withResolvedSurahNames()`.
- `searchQuran()` — `surah` object on each result now passes through `withResolvedSurahNames()`.

### `src/services/challenge.service.ts`
- `claimChallenge()` response now includes `pointsAwarded` field (alias for `rewardPoints`) as required by the contract `POST /challenges/today/claim` section.

### `src/services/auth.service.ts`
- `logout()` no longer throws a `400` error when the refresh token is expired or malformed. It now silently succeeds, matching the contract expectation that logout is always fire-and-forget from the Flutter side.

---

## What was already correct before this audit

These sections were fully compliant before the audit and required no changes:

- **Response envelope** — `success`, `message`, `data`, `meta`, `timestamp`, `requestId` present on all responses.
- **Auth token shape** — tokens correctly nested under `data.tokens.{ accessToken, refreshToken, expiresIn }`.
- **`/auth/me` fields** — flat user object with `provider`, `displayName`, `username`, `googleId`.
- **Dashboard stability** — entire dashboard is wrapped in a try/catch fallback so a DB error on one section never crashes the whole response.
- **Prayer times 24h** — `time` field is always `HH:mm`; `displayAr` and `displayEn` are always present.
- **Bismillah stripping** — Surah 1 preserved, Surah 9 excluded, all others stripped on ayah 1.
- **BOM stripping** — Applied to all `textAr` fields on every surface.
- **Bookmarks surahNameAr** — always resolved via `withResolvedSurahNames()`.
- **Last-read ayahNumber + juz** — both persisted and returned.
- **Khatmah surahNameAr** — resolved via `formatKhatmah()` which uses `resolveSurahNameAr/En`.
- **Reading preferences font clamp** — `quranFontSize` rejected outside 12–60 at service layer.
- **Journey today + progress** — both endpoints wired and returning the contract shape.
- **Tasbih aliases** — `todayCount`, `currentDhikr`, `currentDhikrAr`, `currentDhikrCount` all present.
- **Qibla fields** — `bearingDegrees`, `bearingRadians`, `directionAr`, `distanceKm`, `userLocation` all present.
- **Notifications CRUD** — all five endpoints live.
- **Profile endpoints** — all four endpoints live.
- **Adhkar progress** — GET/PUT endpoints live with `markedItemId` and `tapCount` support.

---

## Items intentionally skipped (marked "Coming soon")

Per the original instruction, the following items from the contract were skipped because they are explicitly marked **Coming soon** in `BACKEND_DATA_CONTRACT.md`:

| Item | Reason skipped |
|------|---------------|
| Reciter audio `GET /quran/audio` | Coming soon in contract §5 |
| Tafsir body `GET /quran/tafsir` | Coming soon in contract §5 |
| Translation body endpoint | Coming soon in contract §5 |
| Sadaqah contribute UI | Coming soon — contract §7 notes "UI shows Coming soon snackbar" |

---

## TypeScript build

After all changes, the TypeScript compiler reports zero errors:

```
npx tsc --noEmit   →   Exit code 0 (clean)
```

---

*The backend is production-ready for Flutter integration. All required contract fields are present, all surah names are resolved from a hardened catalog, and all public routes work without authentication for guest users.*
