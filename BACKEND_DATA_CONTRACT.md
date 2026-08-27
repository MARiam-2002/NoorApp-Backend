# Backend data contract — what to send (and what Flutter patches today)

**Audience:** Backend team  
**App:** Noor Flutter (`lib/`)  
**Base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-08-27  

This file lists **every payload shape Flutter expects**, plus **client-side workarounds** we already shipped. Even when Flutter “works” with local data, the backend should still send the correct fields so guests, sync, and multi-device stay consistent.

Related docs: [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md), [BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md), [QURAN_OFFLINE_INTEGRATION_GUIDE.md](./QURAN_OFFLINE_INTEGRATION_GUIDE.md), [FLUTTER_ADHKAR_INTEGRATION_GUIDE.md](./FLUTTER_ADHKAR_INTEGRATION_GUIDE.md).

---

## 0) Envelope (all JSON APIs)

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "string"
}
```

Errors:

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | INVALID_TOKEN | NOT_FOUND | …",
  "errors": [{ "field": "email", "message": "…" }],
  "details": {}
}
```

| Rule | Why |
|------|-----|
| `401` + `INVALID_TOKEN` | Flutter **clears session** (no refresh) |
| Other `401` | Flutter tries `/auth/refresh` once, then retries |
| Network / 5xx on `/auth/me` | Must **not** look like hard logout — Flutter keeps tokens |
| Nested tokens | `data.tokens.{accessToken, refreshToken, expiresIn?}` on login / sign-up / Google / refresh |

---

## 1) Auth

### Endpoints

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/auth/sign-up` | public | `{ fullName, email, password }` |
| POST | `/auth/login` | public | `{ email, password }` |
| POST | `/auth/google` | public | `{ idToken }` |
| POST | `/auth/refresh` | public | `{ refreshToken }` |
| POST | `/auth/logout` | public | `{ refreshToken }` |
| GET | `/auth/me` | Bearer | — |
| POST | `/auth/forgot-password` | public | `{ email }` |
| POST | `/auth/reset-password` | public | `{ token, newPassword }` |

### `data` on login / sign-up / Google / refresh

```json
{
  "user": {
    "id": "string",
    "fullName": "string",
    "email": "string",
    "provider": "LOCAL | GOOGLE",
    "providerId": "string|null"
  },
  "tokens": {
    "accessToken": "string",
    "refreshToken": "string",
    "expiresIn": 3600
  }
}
```

### `GET /auth/me` → `data` (flat profile)

```json
{
  "id": "string",
  "fullName": "string",
  "email": "string",
  "provider": "LOCAL | GOOGLE",
  "providerId": "string|null"
}
```

Accept aliases Flutter already reads: `displayName`, `username`, `googleId`.

### Flutter local / session notes (backend still owns tokens)

| Client today | Backend should |
|--------------|----------------|
| Guest flag in SharedPreferences | Keep guest public routes (`skipAuth`) working without Bearer |
| Soft `/auth/me` on cold start | Return **401 only** when token is truly invalid; do not 401 on transient errors |
| Secure storage for tokens | Keep refresh token long-lived enough for daily reopen |

---

## 2) Home dashboard

### `GET /dashboard` (Bearer)

Flutter parses these sections (all under `data`):

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
      "countdownSeconds": 1200
    },
    "schedule": [
      {
        "name": "Fajr",
        "nameAr": "الفجر",
        "time": "04:52",
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
  "utilities": {}
}
```

### Prayer times — **please send machine-readable times**

| Flutter patches today | Backend should send |
|-----------------------|---------------------|
| Converts `16:34` → `4:34 PM` / `٤:٣٤ م` | Prefer **24h** `HH:mm` **or** ISO, plus optional `displayAr` / `displayEn` |
| Infers AM/PM from prayer index if bare clock | Explicit meridiem or 24h avoids wrong Fajr/Dhuhr labeling |

### Khatmah card on home

| Flutter patches today | Backend must send |
|-----------------------|-------------------|
| If `surahNameAr` empty/numeric → local name map | Always real Arabic name, e.g. `آل عمران` never `"3"` |

### `POST /challenges/today/claim` (Bearer)

```json
{ "pointsAwarded": 10, "claimed": true }
```

---

## 3) Quran — public browse / pages / offline

**Public (`skipAuth: true`) for guests.**

| Method | Path | Notes |
|--------|------|-------|
| GET | `/quran/surahs` | Full surah list |
| GET | `/quran/juz` | 30 juz |
| GET | `/quran/juz/:n/surahs` | Surahs in juz |
| GET | `/quran/pages/:page` | Mushaf page 1..604 |
| GET | `/quran/surahs/:id/ayahs?page=1&perPage=1` | Used to resolve start page |
| GET | `/quran/full-catalog` | Offline install (bytes + Range resume) |
| GET | `/quran/juz/:n/ayahs` | Metered / partial offline |

### Surah object (list + page.surahs + juz surahs)

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

### CRITICAL — surah names (Flutter currently patches)

**Problem we hit in production data:** `nameAr` / `surahNameAr` sometimes arrives as bare id `"3"`, `"6"`, `"7"` (or Arabic-Indic `٣`).

Flutter now maps those via a local catalog (`resolveSurahNameAr`). **Backend should fix at source** on every surface:

| Surface | Fields that must be real names |
|---------|--------------------------------|
| `/quran/surahs` | `nameAr`, `nameEn` |
| `/quran/juz/:n/surahs` | `nameAr`, `nameEn` |
| `/quran/pages/:page` → `surahs[]` | `nameAr`, `nameEn` |
| `/quran/full-catalog` → each surah | `nameAr`, `nameEn` |
| Bookmarks | `surahNameAr` or `surah.nameAr` |
| Last-read | `surah.nameAr` / `surahNameAr` |
| Khatmah stats + dashboard `khatmah` | `surahNameAr` |

Never return `"3"` as a name. Always `"آل عمران"`.

### Page payload

```json
{
  "page": 50,
  "totalPages": 604,
  "ayahs": [
    {
      "surahId": 3,
      "ayahNumber": 1,
      "textAr": "…",
      "page": 50,
      "juz": 3
    }
  ],
  "surahs": [
    { "id": 3, "nameAr": "آل عمران", "nameEn": "Ali 'Imran", "revelationType": "MADANI" }
  ]
}
```

### Bismillah / text hygiene (keep)

- Surahs `2..8`, `10..114`: ayah `#1` `textAr` = verse body only (Bismillah stripped server-side).
- Surah `1`: keep Bismillah in ayah 1.
- Surah `9`: no Bismillah.
- Strip BOM (`U+FEFF`) from all `textAr`.

### Full catalog (`GET /quran/full-catalog`)

```json
{
  "meta": {
    "catalogVersion": 1,
    "totalAyahs": 6236,
    "bismillahStripped": true
  },
  "surahs": [
    {
      "id": 1,
      "nameAr": "الفاتحة",
      "nameEn": "Al-Fatihah",
      "revelationType": "MAKKI",
      "totalAyahs": 7,
      "ayahs": [
        { "ayahNumber": 1, "textAr": "…", "page": 1, "juz": 1 }
      ]
    }
  ]
}
```

Support **HTTP Range** for resume. Affirm this route (and `/quran/juz/:n/ayahs`) in the main API index.

---

## 4) Quran — authenticated progress

| Method | Path | Body |
|--------|------|------|
| GET | `/quran/bookmarks` | — |
| POST | `/quran/bookmarks` | `{ surahId, ayahNumber?, page?, note? }` |
| DELETE | `/quran/bookmarks/:id` | — |
| GET | `/quran/last-read` | — |
| PUT | `/quran/last-read` | `{ surahId, page, ayahNumber? }` |
| GET | `/quran/khatmah/stats` | — |
| PATCH | `/quran/khatmah/progress` | `{ surahId, currentPage, pagesRead }` |
| POST | `/journey/quran-pages/increment` | `{ pages }` |

### Bookmark / last-read response fields

```json
{
  "id": "uuid",
  "surahId": 2,
  "ayahNumber": 255,
  "page": 42,
  "textAr": "…",
  "note": null,
  "surahNameAr": "البقرة",
  "surah": { "id": 2, "nameAr": "البقرة" }
}
```

```json
{
  "surahId": 2,
  "page": 42,
  "ayahNumber": 255,
  "juz": 3,
  "surahNameAr": "البقرة",
  "surah": { "nameAr": "البقرة" }
}
```

### Flutter local today (backend should replace / sync)

| Client today | Backend should add / ensure |
|--------------|-----------------------------|
| Guest bookmarks + last-read in SharedPreferences | Same shapes for guests after login merge (optional `POST /quran/import-local`) |
| Mark ayah (long-press) → favorite **and** `PUT /quran/last-read` | Persist `ayahNumber` on last-read so resume is ayah-accurate |
| Offline outbox replays bookmark / last-read / khatmah | Idempotent writes |

### Dual counter (keep order)

On page advance Flutter calls:

1. `POST /journey/quran-pages/increment`
2. `PATCH /quran/khatmah/progress`
3. `PUT /quran/last-read`

---

## 5) Reading preferences

| Method | Path |
|--------|------|
| GET | `/profile/reading-preferences` |
| PATCH | `/profile/reading-preferences` |

```json
{
  "quranFontSize": 28,
  "quranReciter": "Mishary_Alafasy",
  "quranTafsir": "Ibn_Kathir",
  "quranTranslation": "Sahih_International"
}
```

Clamp font **12..60**. Flutter also caches locally when offline.

### Not yet from API (UI prefs only — Coming soon on play)

| Need | Suggested endpoint |
|------|--------------------|
| Reciter audio | `GET /quran/audio?surahId=&ayahNumber=&reciter=` → `{ audioUrl }` |
| Tafsir body | `GET /quran/tafsir?surahId=&ayahNumber=&source=Ibn_Kathir` → `{ textAr, source }` |
| Translation body | same pattern or include in page payload |

---

## 6) Adhkar / Azkar

| Method | Path | Auth |
|--------|------|------|
| GET | `/adhkar` | public |
| GET | `/adhkar/categories/:KEY` | public (`MORNING`, `EVENING`, …) |

### Home

```json
{
  "greeting": "واذكر ربك إذا نسيت",
  "dailyWird": {
    "titleAr": "وردك اليوم",
    "subtitleAr": null,
    "progressItemsDone": 2,
    "progressItemsTotal": 8,
    "progressPercent": 25,
    "ctaAr": "أكمل وردك اليوم",
    "categoryKey": "GENERAL_WIRD",
    "items": []
  },
  "categories": [
    {
      "id": "…",
      "key": "MORNING",
      "nameAr": "أذكار الصباح",
      "nameEn": "Morning Adhkar",
      "descriptionAr": null,
      "iconCode": "☀",
      "sortOrder": 1,
      "totalItems": 20,
      "items": []
    }
  ]
}
```

### Category detail item

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

### Flutter local today — **backend should add**

| Client today | Suggested API |
|--------------|---------------|
| Resume mark: SharedPreferences `adhkar_resume_{CATEGORY}` = item `id` | `GET/PUT /adhkar/progress` or `PATCH /journey/adhkar` |
| Repeat tap counters: **in-memory only** (lost on leave) | Persist `{ categoryKey, itemId, tapCount }` per user |
| Home `dailyWird.progress*` often cosmetic / defaults | Real counts from user progress |
| Defaults for missing greeting / titles | Always send localized strings EN+AR |

Suggested progress payload:

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

## 7) Journey (partially wired)

| Method | Path | Status |
|--------|------|--------|
| POST | `/journey/quran-pages/increment` | Wired |
| GET | `/journey/today` | **Not wired — needed** |
| GET | `/journey/progress` | **Not wired — needed** |
| PATCH | `/journey/adhkar` | Documented; Flutter Journey uses dashboard + local |
| PATCH | `/journey/sadaqah` | Documented; UI shows **Coming soon** on contribute |

### Flutter Journey tab today

Built from `GET /dashboard` `dailyJourney` + local challenge/tasbih.  
Sadaqah row / badges CTA → Coming soon snackbar until APIs live.

Please send:

```json
{
  "date": "2026-08-27",
  "tasks": [
    { "key": "quran", "titleAr": "…", "done": false, "progress": 0.3 },
    { "key": "prayer", "titleAr": "…", "done": false },
    { "key": "adhkar", "titleAr": "…", "done": true },
    { "key": "sadaqah", "titleAr": "…", "done": false, "amount": 0 }
  ],
  "streakDays": 4,
  "badges": [],
  "points": 120
}
```

Sadaqah contribute:

```http
PATCH /journey/sadaqah
{ "amount": 10 }
```

---

## 8) Tasbih

| Method | Path | Body |
|--------|------|------|
| GET | `/tasbih/today` | — |
| POST | `/tasbih/increment` | `{ amount }` |
| POST | `/tasbih/reset` | — |
| PATCH | `/tasbih/change-dhikr` | `{ dhikr }` |

```json
{
  "count": 33,
  "dhikr": "ALHAMDULILLAH",
  "dhikrAr": "الحمد لله",
  "dailyGoal": 99,
  "progressPercent": 33
}
```

Aliases Flutter accepts: `todayCount`, `currentDhikr`, `currentDhikrAr`, `currentDhikrCount`.

**Flutter is local-first** for UI; remote is sync. Backend should still return authoritative today-state for signed-in users.

---

## 9) Qibla

| Method | Path | Auth | Query |
|--------|------|------|-------|
| GET | `/qibla/calculate` | public | `lat`, `lng` |

```json
{
  "bearingDegrees": 136.5,
  "bearingRadians": 2.38,
  "directionAr": "جنوب شرق",
  "distanceKm": 1200.4,
  "userLocation": { "latitude": 30.0, "longitude": 31.0 }
}
```

Compass UI works offline locally; API improves distance / label.

---

## 10) Notifications — UI exists, API not wired

Home bell shows localized **Coming soon**. Backend should implement:

| Method | Path |
|--------|------|
| GET | `/notifications` |
| GET | `/notifications/unread-count` |
| PATCH | `/notifications/:id/read` |
| POST | `/notifications/read-all` |
| DELETE | `/notifications/:id` |

```json
{
  "id": "…",
  "titleAr": "…",
  "titleEn": "…",
  "bodyAr": "…",
  "bodyEn": "…",
  "type": "SYSTEM | AZAN | CHALLENGE",
  "read": false,
  "createdAt": "ISO-8601"
}
```

(FCM / Azan scheduling: see [AZAN_FEATURE.md](./AZAN_FEATURE.md).)

---

## 11) Profile / account — UI Coming soon

Account screen today: locale, theme, logout / leave guest.  
Need for full account:

| Method | Path | Body |
|--------|------|------|
| GET | `/profile/me` | — |
| PATCH | `/profile/update` | `{ fullName, … }` |
| PATCH | `/profile/change-password` | `{ currentPassword, newPassword }` |
| PUT | `/profile/location` | `{ lat, lng }` |

---

## 12) Checklist — “send this even if Flutter already works”

Use this as a backend sprint checklist.

### Must fix / harden

- [ ] Never return bare surah ids as `nameAr` / `surahNameAr` (especially 3, 6, 7)
- [ ] `GET /dashboard` stable 200 with all sections Flutter parses
- [ ] Prayer times as 24h (or ISO) + optional display strings
- [ ] Bookmarks + last-read always include `surahNameAr` + `ayahNumber` when set
- [ ] Khatmah stats always include real `surahNameAr`
- [ ] Full-catalog + juz ayahs routes confirmed and Range-resume safe
- [ ] Refresh / me: only 401 when credentials are truly invalid

### Should add (Flutter already has UI or local stub)

- [ ] Adhkar progress + resume mark sync (`markedItemId`, tap counts, real daily wird %)
- [ ] Notifications list + unread count
- [ ] Quran audio URL by reciter
- [ ] Tafsir / translation content by ayah
- [ ] Journey today + progress + sadaqah PATCH
- [ ] Profile update / change-password
- [ ] Optional guest → account data merge (bookmarks, last-read, adhkar marks)

### Keep public (`skipAuth`) for guests

- [ ] Quran surahs / juz / pages / full-catalog / juz ayahs
- [ ] Adhkar home + categories
- [ ] Qibla calculate
- [ ] Auth login / sign-up / Google / forgot / reset / refresh

---

## 13) Auth header & guest rules

| Caller | Behavior |
|--------|----------|
| Signed-in | `Authorization: Bearer <accessToken>` on protected routes |
| Guest | No Bearer; public routes only; local caches for bookmarks / last-read / adhkar resume |
| After login | Prefer server state; ideally merge guest local progress once |

---

## 14) Quick field glossary (never omit these)

| Field | Type | Notes |
|-------|------|-------|
| `surahId` | int 1..114 | Always numeric id |
| `nameAr` / `surahNameAr` | string | **Human Arabic name**, never `"3"` |
| `nameEn` | string | Human English name |
| `ayahNumber` | int | Required for ayah-level resume |
| `page` | int 1..604 | Mushaf page |
| `juz` | int 1..30 | Optional but preferred on ayahs / last-read |
| `textAr` | string | BOM-free; Bismillah rules above |
| `revelationType` | `MAKKI` \| `MADANI` | |
| `repeatCount` | int | Adhkar item |
| `markedItemId` | string | Adhkar resume (to add) |
| `accessToken` / `refreshToken` | string | Nested under `tokens` |

---

*Flutter will keep local fallbacks for offline UX, but production truth should live on the backend so EN/AR, guest→user sync, and multi-device all stay correct.*
