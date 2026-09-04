# Backend remaining data contract

**Audience:** Backend team  
**App:** Noor Flutter (`lib/`)  
**Base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-03  

Flutter has already wired the client for auth, dashboard, Quran browse/offline, bookmarks, khatmah, reading preferences, adhkar (home/categories/progress/favorites/search), journey (today/progress/patches), tasbih, qibla calculate, notifications, and profile. **This file lists only what is still missing or wrong on the backend** so Flutter can stop patching locally and ship the remaining UI.

Stable envelope / auth / already-live routes: see [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md). Product backlog: [APP_ENHANCEMENTS.md](./APP_ENHANCEMENTS.md).

---

## 0) Envelope (reminder)

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

| Rule | Why |
|------|-----|
| `401` + `INVALID_TOKEN` | Flutter clears session (no refresh) |
| Other `401` | Flutter tries `/auth/refresh` once |
| Network / 5xx on `/auth/me` | Must **not** look like hard logout |

---

## 1) Must-fix on existing payloads

### 1.1 Surah names — never bare ids

**Bug:** `nameAr` / `surahNameAr` sometimes arrives as `"3"`, `"6"`, `"7"` (or Arabic-Indic `٣`).

Return real names on every surface Flutter still reads from the API:

| Surface | Fields |
|---------|--------|
| `/quran/surahs`, `/quran/juz/:n/surahs`, page `surahs[]`, full-catalog | `nameAr`, `nameEn` |
| Bookmarks / last-read / khatmah stats / dashboard `khatmah` | `surahNameAr` (+ nested `surah.nameAr` if used) |

Always `"آل عمران"`, never `"3"`.

### 1.2 `GET /dashboard` — stable 200 + complete sections

Always return these keys under `data` (missing keys silently hide Home cards):

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
      "time": "15:42",
      "countdownSeconds": 1830
    },
    "schedule": [
      { "name": "Fajr", "nameAr": "الفجر", "time": "04:11", "completed": true },
      { "name": "Dhuhr", "nameAr": "الظهر", "time": "12:58", "completed": true },
      { "name": "Asr", "nameAr": "العصر", "time": "15:42", "completed": false },
      { "name": "Maghrib", "nameAr": "المغرب", "time": "18:55", "completed": false },
      { "name": "Isha", "nameAr": "العشاء", "time": "20:20", "completed": false }
    ]
  },
  "verseOfTheDay": { "textAr": "…", "referenceAr": "…" },
  "hadithOfTheDay": { "textAr": "…", "sourceAr": "…" },
  "dailyJourney": {
    "prayer": { "completed": 2, "total": 5, "progress": 0.4 },
    "quran": { "pagesRead": 3, "target": 5 },
    "adhkar": { "completed": false },
    "sadaqah": { "amount": 0 }
  },
  "khatmah": {
    "surahId": 2,
    "surahNameAr": "البقرة",
    "currentPage": 12,
    "progressPercent": 4
  },
  "dailyChallenge": {
    "titleAr": "…",
    "titleEn": "…",
    "descriptionAr": "…",
    "descriptionEn": "…",
    "rewardPoints": 50,
    "targetValue": 5,
    "completed": false,
    "claimed": false
  },
  "utilities": {}
}
```

Hard rules:

1. `schedule` = **exactly 5** entries, Fajr → Isha order.
2. `time` = **24h `HH:mm`** or ISO (not ambiguous 12h clocks).
3. `name` + `nameAr` on every prayer; English `name` must match between `nextPrayer` and `schedule`.
4. `dailyJourney.adhkar.completed` must be a real JSON **boolean** (`true`/`false` only).
5. `dailyJourney.prayer.progress` is a **fraction** `0..1` (e.g. `0.4`), not percent.
6. Plain JSON objects only — nested maps that fail `Map<String, dynamic>` casts are dropped silently by the client.

### 1.3 Bookmarks / last-read / khatmah

Always include:

- Real `surahNameAr`
- `ayahNumber` when known (last-read resume is ayah-accurate)
- Idempotent writes for offline outbox replay

### 1.4 Password-reset delivery (ops)

Forgot/reset UI is live. Staging + production must actually deliver the reset token (or document a staging sink). Deep-link scheme optional — app also accepts manual token paste.

---

## 2) Endpoints Flutter already calls — backend must ship / complete

Client code is wired. Missing or incomplete 200s block real sync.

### 2.1 Journey

| Method | Path | Body / query |
|--------|------|--------------|
| GET | `/journey/today` | — |
| GET | `/journey/progress?days=7` | `days` 1..90 |
| PATCH | `/journey/adhkar` | `{ "categoryKey": "GENERAL_WIRD", "completed": true }` |
| PATCH | `/journey/sadaqah` | `{ "amount": 10 }` |
| PATCH | `/journey/prayer` | `{ "prayer": "Asr", "completed": true }` |
| POST | `/journey/quran-pages/increment` | `{ "pages": 1 }` → `data.quranPagesRead` |

#### `GET /journey/today` — required shape

Prayer **must** include counts. Without `completed`/`total` (or `progress`), the Journey prayer card shows `—`.

```json
{
  "date": "2026-09-03",
  "streakDays": 4,
  "points": 120,
  "overallPercent": 40,
  "quranPagesRead": 3,
  "adhkarCompleted": false,
  "sadaqahAmount": 0,
  "tasks": [
    {
      "key": "prayer",
      "titleAr": "الصلوات",
      "titleEn": "Prayers",
      "captionAr": "صلوات مكتملة",
      "captionEn": "prayers completed",
      "completed": 2,
      "total": 5,
      "progress": 0.4,
      "done": false
    },
    {
      "key": "quran",
      "titleAr": "قراءة القرآن",
      "titleEn": "Quran",
      "progress": 0.6,
      "done": false
    },
    {
      "key": "adhkar",
      "titleAr": "الأذكار",
      "titleEn": "Adhkar",
      "done": true,
      "progress": 1.0
    },
    {
      "key": "sadaqah",
      "titleAr": "الصدقة",
      "titleEn": "Sadaqah",
      "amount": 0,
      "done": false,
      "progress": 0
    }
  ],
  "dailyChallenge": {
    "titleAr": "…",
    "titleEn": "…",
    "descriptionAr": "…",
    "descriptionEn": "…",
    "targetValue": 5,
    "rewardPoints": 50,
    "completed": false,
    "claimed": false
  },
  "badges": []
}
```

Notes:

- `progress` = fraction `0..1`, not percent.
- Prefer embedding `dailyChallenge` here so Journey does not depend on `/dashboard` succeeding.
- PATCH adhkar / sadaqah may return the same today payload or empty `data` (Flutter refetches).

#### `GET /journey/progress`

```json
{
  "periodDays": 7,
  "daily": [
    {
      "date": "2026-09-03",
      "quranPages": 3,
      "adhkarCompleted": true,
      "sadaqah": 0,
      "prayersCompleted": 4,
      "overallPercent": 75
    }
  ],
  "summary": {
    "totalQuranPages": 20,
    "adhkarDaysCompleted": 5,
    "totalSadaqah": 100,
    "prayersCompletedCount": 28,
    "daysStreak": 4
  }
}
```

Aliases accepted: `records` for `daily`; `quranPagesRead` / `sadaqahAmount` on day rows.

### 2.2 Notifications

| Method | Path |
|--------|------|
| GET | `/notifications?page=1&perPage=20` |
| GET | `/notifications/unread-count` |
| GET | `/notifications/:id` |
| PATCH | `/notifications/:id/read` |
| POST | `/notifications/read-all` |

List item:

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

`data` on list = **array**. Unread: `data.count` or `data.unreadCount`. Pagination meta optional (`meta.page`, `meta.limit`, `meta.total`).

### 2.3 Profile / account

| Method | Path | Body |
|--------|------|------|
| GET | `/profile/me` | — |
| PATCH | `/profile/update` | `{ "fullName": "…" }` |
| PATCH | `/profile/change-password` | `{ "currentPassword", "newPassword" }` |
| PUT | `/profile/location` | `{ "latitude", "longitude" }` |

```json
{
  "id": "string",
  "fullName": "string",
  "email": "string",
  "provider": "LOCAL | GOOGLE",
  "providerId": "string|null",
  "createdAt": "ISO-8601",
  "location": { "latitude": 30.0, "longitude": 31.0 }
}
```

`location` may be null until the user saves GPS once. Dashboard prayer times should use saved location when present.

### 2.4 Adhkar progress / favorites / search

Flutter already calls these for signed-in users:

| Method | Path | Notes |
|--------|------|-------|
| GET | `/adhkar/progress?categoryKey=MORNING` | Include `markedItemId` + per-item `tapCount` |
| PUT | `/adhkar/progress` | `{ categoryKey, itemId, tapCount }` |
| GET | `/adhkar/favorites` | Nested `dhikr` + `dhikr.category` |
| POST | `/adhkar/favorites` | `{ itemId }` |
| DELETE | `/adhkar/favorites/:id` | Favorite **row** id |
| GET | `/adhkar/search?q=` | Public; hits with `id`, `categoryKey`, `textAr`, `repeatCount?`, `referenceAr?` |

Progress response:

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

Also: after progress writes, `GET /adhkar` `dailyWird.progress*` should reflect **per-user** counts (not cosmetic anonymous zeros). Prefer EN+AR strings: `greetingEn`, `titleEn`, `ctaEn`, item `textEn` / `benefitEn` / `referenceEn` where available.

### 2.5 Guest → account Quran merge

| Method | Path | Body |
|--------|------|------|
| POST | `/quran/import-local` | `{ "bookmarks": [...], "lastRead": {…}? }` |

Response:

```json
{
  "bookmarksImported": 3,
  "lastReadUpdated": true
}
```

### 2.6 Catalog option lists (reader dropdowns)

Flutter calls these and falls back to hardcoded lists if missing:

| Method | Path |
|--------|------|
| GET | `/quran/reciters` |
| GET | `/quran/tafsirs` |
| GET | `/quran/translations` |

Each item: `{ "code": "Mishary_Alafasy", "nameAr": "…", "name": "…" }` (or `id` instead of `code`). `data` = array **or** `{ "items": [...] }`.

### 2.7 Quran search

Already called: `GET /quran/search?q=&limit=30` (public).

`data` = ayah array, or `{ "ayahs": [...] }` / `{ "results": [...] }`. Each hit needs `surahId`, `ayahNumber`, `textAr`, and real surah names when present.

---

## 3) Not wired in UI yet — needed for next Flutter pass

Ship these so Flutter can drop “Coming soon” without another backend round-trip.

### 3.1 Quran audio / tafsir / translation content

| Method | Path | Response |
|--------|------|----------|
| GET | `/quran/audio?surahId=&ayahNumber=&reciter=` | `{ "audioUrl": "https://…" }` |
| GET | `/quran/tafsir?surahId=&ayahNumber=&source=Ibn_Kathir` | `{ "textAr": "…", "source": "…" }` |
| GET | `/quran/translation?surahId=&ayahNumber=&source=Sahih_International` | `{ "text": "…", "source": "…" }` |

Play / tafsir buttons on the reader are blocked until these exist.

### 3.2 Challenges (beyond Home claim)

| Method | Path |
|--------|------|
| GET | `/challenges` |
| GET | `/challenges/today` |
| GET | `/challenges/:id` |
| POST | `/challenges/:id/claim` |

(`POST /challenges/today/claim` already used on Home.)

### 3.3 Badges / journey achievements

Journey badges CTA is Coming soon. Suggested:

```json
{
  "badges": [
    {
      "id": "…",
      "key": "STREAK_7",
      "titleAr": "…",
      "titleEn": "…",
      "earned": true,
      "earnedAt": "ISO-8601"
    }
  ]
}
```

Can live on `/journey/today`, `/journey/progress`, or `GET /journey/badges`.

### 3.4 Optional Quran extras

| Method | Path | Why |
|--------|------|-----|
| GET/POST | `/quran/reading-history` | History sheet |
| POST | `/quran/khatmah/reset` | Start new khatmah |
| PATCH | `/quran/bookmarks/:id` | Edit bookmark note |
| GET | `/qibla/my-qibla` | Compass from saved profile location (no query lat/lng) |
| GET | `/quran/ayahs/random` | Random ayah widgets |

### 3.5 Reading preferences extras

Already live: `GET/PATCH /profile/reading-preferences` (`quranFontSize` 12..60, reciter/tafsir/translation slugs).

Please also persist when Flutter starts sending:

```json
{
  "quranAutoScroll": false
}
```

### 3.6 Tasbih authority (product decision)

Flutter is local-first. If multi-device should trust the server: document merge rules and always return authoritative `GET /tasbih/today` (`count`, `dhikr`, `dhikrAr`, `dhikrEn?`, `dailyGoal`, `progressPercent`).

### 3.7 Azan / FCM

See [AZAN_FEATURE.md](./AZAN_FEATURE.md). Prayer schedule quality (§1.2) unblocks local Azan; push tokens / FCM are a later pass.

---

## 4) Localization gaps (EN + AR)

Wherever Flutter hardcodes Arabic today, add English variants:

| Feature | Existing | Needed |
|---------|----------|--------|
| Journey tasks | `titleAr` | `titleEn`, `captionAr`, `captionEn` |
| Dashboard journey tiles | none | `labelAr`/`labelEn`, `captionAr`/`captionEn` |
| Daily challenge | `titleAr`, `descriptionAr` | `titleEn`, `descriptionEn` |
| Adhkar home | `greeting`, `titleAr`, `ctaAr` | `greetingEn`, `titleEn`, `ctaEn` |
| Adhkar items | `textAr`, `benefitAr`, `referenceAr` | `textEn`, `benefitEn`, `referenceEn` |
| Tasbih | `dhikrAr` | `dhikrEn` (+ optional server dhikr list) |
| Notifications | — | Always send `titleEn` / `bodyEn` |

---

## 5) Keep public (`skipAuth`) for guests

These must stay public (Flutter already depends on this):

- Quran: surahs / juz / pages / full-catalog / juz ayahs / search / reciters / tafsirs / translations
- Adhkar: home + categories + search
- Qibla: `/qibla/calculate`
- Auth: login / sign-up / Google / forgot / reset / refresh / logout

---

## 6) Backend sprint checklist

### P0 — fix / harden

- [ ] Never return bare surah ids as names
- [ ] `GET /dashboard` stable 200 with all sections + 5-prayer 24h schedule
- [ ] Prayer / journey `progress` as fraction `0..1`; adhkar `completed` as boolean
- [ ] Bookmarks + last-read include real `surahNameAr` + `ayahNumber`
- [ ] Forgot/reset emails deliver tokens

### P1 — Flutter already calling

- [ ] `GET /journey/today` with prayer `completed`/`total` (+ optional `dailyChallenge`)
- [ ] `GET /journey/progress`
- [ ] `PATCH /journey/adhkar` / `sadaqah` / `prayer`
- [ ] Notifications list + unread-count + mark read / read-all
- [ ] Profile me / update / change-password / location
- [ ] Adhkar progress persist `markedItemId` + real `dailyWird` counts
- [ ] Adhkar favorites + search
- [ ] `POST /quran/import-local`
- [ ] `/quran/reciters` / `tafsirs` / `translations` catalogs
- [ ] `GET /quran/search` reliable results

### P2 — unlock Coming soon UI

- [ ] Quran audio URL + tafsir/translation body by ayah
- [ ] Challenges list/detail/claim-by-id
- [ ] Badges payload
- [ ] Reading history / khatmah reset / bookmark note patch
- [ ] `GET /qibla/my-qibla`
- [ ] Optional EN fields (§4)

---

## 7) Already done on Flutter — do not re-scope

These are **client-complete**. Keep contracts stable; do not treat them as “new work” unless fixing bugs in §1:

Auth · `GET /dashboard` · `POST /challenges/today/claim` · Quran browse/pages/full-catalog/bookmarks/last-read/khatmah dual-counter · reading-preferences · adhkar home/categories · tasbih sync · `GET /qibla/calculate` · Bismillah/BOM text hygiene · nested `data.tokens` · dual-page counter order (`journey` increment → `khatmah` progress → `last-read`).

---

*Flutter keeps local fallbacks for offline UX. Production truth for signed-in users should live on the backend so EN/AR, guest→user merge, and multi-device stay correct.*
