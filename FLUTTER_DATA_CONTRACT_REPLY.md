# Backend Data Contract — Reply to Flutter

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-04  
**Status:** Verified on Production against `BACKEND_REQUIREMENTS.md`, `BACKEND_DATA_CONTRACT.md`, `AZAN_FEATURE.md`, and `APP_ENHANCEMENTS.md`.

This document describes **only what is implemented and verified on Production**. Do not treat Swagger alone as the source of truth.

Reference requirements (Flutter-owned):

- [BACKEND_REQUIREMENTS.md](./BACKEND_REQUIREMENTS.md)
- [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md)
- [AZAN_FEATURE.md](./AZAN_FEATURE.md)
- [APP_ENHANCEMENTS.md](./APP_ENHANCEMENTS.md)

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
  "code": "UNAUTHORIZED | INVALID_TOKEN | TOKEN_EXPIRED | VALIDATION_ERROR | NOT_FOUND | RATE_LIMIT_EXCEEDED | …",
  "details": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Auth rules Flutter must follow

| HTTP / code | Flutter action |
|-------------|----------------|
| `401` + `INVALID_TOKEN` | Clear session (logout) |
| `401` + `TOKEN_EXPIRED` | Call `POST /auth/refresh` once, then retry |
| Other `401` | Try refresh once if refresh token exists |
| Network / 5xx on profile/me | **Do not** hard-logout |

Auth tokens live under `data.tokens`:

```json
{
  "user": { "id": "…", "email": "…", "fullName": "…" },
  "tokens": {
    "accessToken": "…",
    "refreshToken": "…",
    "expiresIn": 3600
  }
}
```

CORS: Production allows browser / tool preflight (`Access-Control-Allow-Origin: *` verified).

---

## 1) Production health (ops)

`GET /health` (public)

```json
{
  "status": "ok",
  "database": "connected",
  "environment": "production",
  "email": {
    "configured": true,
    "provider": "smtp",
    "readyForDelivery": true
  },
  "quranFoundation": {
    "oauthConfigured": true
  }
}
```

- `email.readyForDelivery: true` means SMTP + `MAIL_FROM` are configured (not mock).
- Still confirm **one real reset email** arrives in a real inbox after `POST /auth/forgot-password`.

---

## 2) Public endpoints (guests — no Bearer)

Must stay public (verified):

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | DB + mail readiness |
| POST | `/auth/sign-up` | |
| POST | `/auth/login` | |
| POST | `/auth/google` | |
| POST | `/auth/forgot-password` | Always generic 200 |
| POST | `/auth/reset-password` | `{ token, password }` or `{ token, newPassword }` |
| POST | `/auth/refresh` | |
| POST | `/auth/logout` | |
| GET | `/quran/surahs` | Real `nameAr` / `nameEn` (never bare ids) |
| GET | `/quran/juz` / `/quran/juz/:n/surahs` | |
| GET | `/quran/pages/:pageNumber` | Mushaf pages 1..604 |
| GET | `/quran/full-catalog` | Offline catalog |
| GET | `/quran/search?q=&limit=` | Arabic diacritic-insensitive (verified) |
| GET | `/quran/ayahs/random` | |
| GET | `/quran/reciters` | Catalog array + `resourceId` |
| GET | `/quran/tafsirs` | Catalog array + `resourceId` |
| GET | `/quran/translations` | Catalog array + `resourceId` |
| GET | `/quran/audio` | See §5 |
| GET | `/quran/tafsir` | See §5 |
| GET | `/quran/translation` | See §5 |
| GET | `/adhkar` | Home + EN fields |
| GET | `/adhkar/categories/:key` | |
| GET | `/adhkar/search?q=` | |
| GET | `/qibla/calculate?lat=&lng=` | |
| GET | `/prayers/schedule?lat=&lng=&method=&madhab=` | Public schedule for Azan cross-check |
| GET | `/content/verse-of-day` | |

---

## 3) Dashboard (auth)

`GET /dashboard`

Required `data` keys (all verified):

- `greeting`
- `prayers` → `nextPrayer` + `schedule` (**exactly 5**, Fajr→Isha)
- `verseOfTheDay`
- `hadithOfTheDay`
- `dailyJourney`
- `khatmah` (real `surahNameAr`)
- `dailyChallenge` (includes `titleEn` / `descriptionEn`)
- `utilities`

### Prayer schedule rules

- `name`: Title Case (`Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`)
- `nameAr`: Arabic label
- `time`: 24h `HH:mm`
- `completed`: JSON boolean
- Uses saved profile location when present

### `dailyJourney` shape

```json
{
  "prayer": { "completed": 0, "total": 5, "progress": 0, "labelAr": "…", "labelEn": "…", "captionAr": "…", "captionEn": "…" },
  "quran": { "pagesRead": 0, "target": 5, "labelAr": "…", "labelEn": "…", "captionAr": "…", "captionEn": "…" },
  "adhkar": { "completed": false, "labelAr": "…", "labelEn": "…", "captionAr": "…", "captionEn": "…" },
  "sadaqah": { "amount": 0, "labelAr": "…", "labelEn": "…", "captionAr": "…", "captionEn": "…" }
}
```

Hard rules:

- `progress` is a **fraction** `0..1` (not percent)
- `adhkar.completed` is a real boolean
- `quran.target` is `5`

---

## 4) Journey (auth)

| Method | Path | Body |
|--------|------|------|
| GET | `/journey/today` | — |
| GET | `/journey/progress?days=7` | `days` 1..90 |
| GET | `/journey/badges` | — |
| PATCH | `/journey/prayer` | `{ "prayer": "Asr", "completed": true }` |
| PATCH | `/journey/adhkar` | `{ "categoryKey": "GENERAL_WIRD", "completed": true }` |
| PATCH | `/journey/sadaqah` | `{ "amount": 10 }` |
| POST | `/journey/quran-pages/increment` | `{ "pages": 1 }` → `data.quranPagesRead` |

### Prayer name on PATCH

Accepts Title Case **or** enum:

- `Asr` / `ASR` / `asr` ✅

### `/journey/today` includes

- Prayer task: `completed`, `total`, `progress` (fraction), `titleEn`, `captionEn`
- `dailyChallenge` (same EN/AR fields as dashboard)
- `badges[]` with `{ id, key, titleAr, titleEn, earned, earnedAt }`

### `/journey/badges`

```json
{
  "badges": [ /* same objects */ ],
  "streakDays": 0
}
```

### `/journey/progress`

```json
{
  "periodDays": 7,
  "daily": [ { "date": "…", "quranPages": 0, "adhkarCompleted": false, "sadaqah": 0, "prayersCompleted": 0, "overallPercent": 0 } ],
  "records": [ /* alias of daily */ ],
  "summary": { "totalQuranPages": 0, "adhkarDaysCompleted": 0, "totalSadaqah": 0, "prayersCompletedCount": 0, "daysStreak": 0 }
}
```

---

## 5) Quran reader catalogs + content

### 5.1 Catalogs (public)

`GET /quran/reciters` · `GET /quran/tafsirs` · `GET /quran/translations`

Each item includes:

```json
{
  "id": "Mishary_Alafasy",
  "code": "Mishary_Alafasy",
  "name": "…",
  "nameAr": "…",
  "nameEn": "…",
  "resourceId": 7
}
```

**Use `id` (or `code`) from these catalogs.** Do not invent IDs.

#### Reciters (Production)

| id | resourceId |
|----|------------|
| `Mishary_Alafasy` | 7 |
| `Abdul_Basit` | 2 |
| `Mahmoud_Al_Husary` | 6 |
| `Abdurrahman_As_Sudais` | 3 |
| `Saud_Ash_Shuraym` | 10 |
| `Muhammad_Siddiq_Al_Minshawi` | 9 |
| `Minshawi_Mujawwad` | 8 |

#### Tafsirs (Production)

| id | resourceId |
|----|------------|
| `Ibn_Kathir` | 14 |
| `Al_Tabari` | 15 |
| `Al_Qurtubi` | 90 |
| `Ibn_Kathir_Muyassar` | 16 |
| `Al_Baghawi` | 94 |
| `Al_Saadi` | 91 |
| `Ibn_Kathir_En` | 169 |

#### Translations (Production)

| id | resourceId |
|----|------------|
| `Sahih_International` | 20 |
| `Yusuf_Ali` | 22 |
| `Pickthall` | 19 |
| `French_Hamidullah` | 31 |
| `Turkish_Diyanet` | 77 |
| `Malay_Basmeih` | 39 |
| `Indonesian_Depag` | 33 |

`resourceId` is the Quran Foundation Content API id. Flutter normally only needs catalog `id`.

### 5.2 Audio / tafsir / translation (public)

| Method | Path | Query aliases (any one works) |
|--------|------|-------------------------------|
| GET | `/quran/audio` | `reciter` **or** `reciterId` **or** `id` |
| GET | `/quran/tafsir` | `source` **or** `tafsirId` **or** `id` |
| GET | `/quran/translation` | `source` **or** `translationId` **or** `id` |

Required shared query: `surahId`, `ayahNumber`.

#### Audio response

```json
{
  "audioUrl": "https://…",
  "reciter": "Abdul_Basit",
  "surahId": 1,
  "ayahNumber": 1,
  "provider": "quran_foundation"
}
```

Verified: each catalog `id` returns a **distinct** `audioUrl` (no silent Alafasy reuse).

Fallback provider when QF audio is unavailable / mismatched: `everyayah`.

#### Tafsir response

```json
{
  "textAr": "…",
  "text": "…",
  "textHtml": "…",
  "source": "Ibn_Kathir",
  "surahId": 1,
  "ayahNumber": 1,
  "provider": "quran_foundation"
}
```

#### Translation response

```json
{
  "text": "…",
  "textHtml": "…",
  "source": "Sahih_International",
  "surahId": 1,
  "ayahNumber": 1,
  "provider": "quran_foundation"
}
```

### 5.3 Guest → account merge (auth)

`POST /quran/import-local`

```json
{
  "bookmarks": [ { "surahId": 1, "ayahNumber": 1, "note": "…" } ],
  "lastRead": { "surahId": 1, "page": 1, "ayahNumber": 1 }
}
```

Accepted:

- `lastRead: null` / omitted
- `page` **or** `pageNumber`

Response:

```json
{
  "bookmarksImported": 1,
  "lastReadUpdated": true,
  "imported": { "bookmarks": 1, "lastRead": true },
  "message": "…"
}
```

### 5.4 Other Quran (auth unless noted)

| Method | Path | Notes |
|--------|------|-------|
| GET/POST/DELETE | `/quran/bookmarks` | Real `surahNameAr` |
| PATCH | `/quran/bookmarks/:id` | `{ "note": "…" }` |
| GET/PUT | `/quran/last-read` | Real `surahNameAr` + `ayahNumber` |
| GET/PATCH | `/quran/khatmah/*` | Real names; dual counters unchanged |
| POST | `/quran/khatmah/reset` | Starts new khatmah |
| GET/POST | `/quran/reading-history` | |

**Surah names:** never bare numeric ids on list / bookmark / last-read / khatmah / dashboard.

**Bismillah / BOM:** Backend strips decorative Bismillah on ayah 1 except Surah 1 and 9; strips BOM from `textAr`. Flutter must **not** re-strip.

---

## 6) Profile / preferences (auth)

| Method | Path | Body |
|--------|------|------|
| GET | `/profile/me` | — |
| PATCH | `/profile/update` | `{ "fullName": "…" }` |
| PATCH | `/profile/change-password` | `{ "currentPassword", "newPassword" }` |
| PUT | `/profile/location` | `{ "latitude", "longitude" }` **or** `{ "lat", "lng" }` |
| GET/PATCH | `/profile/reading-preferences` | font 12..60, reciter/tafsir/translation slugs, **`quranAutoScroll`** |

`GET /profile/me` includes `provider`, `location` (nullable), `createdAt` (and related fields).

`quranAutoScroll` and `quranAutoScrollEnabled` are both accepted and both returned.

---

## 7) Notifications (auth)

| Method | Path |
|--------|------|
| GET | `/notifications?page=1&perPage=20` |
| GET | `/notifications/unread-count` |
| GET | `/notifications/:id` |
| PATCH | `/notifications/:id/read` |
| POST | `/notifications/read-all` |

- List `data` is a **JSON array**
- Unread: `{ "count": 0, "unreadCount": 0 }`
- Items include `titleAr` / `titleEn` / `bodyAr` / `bodyEn` when present

---

## 8) Adhkar (mixed)

| Method | Path | Auth |
|--------|------|------|
| GET | `/adhkar` | Public (progress fields personalized when Bearer present) |
| GET | `/adhkar/progress?categoryKey=MORNING` | Auth |
| PUT | `/adhkar/progress` | Auth `{ categoryKey, itemId, tapCount }` |
| GET/POST/DELETE | `/adhkar/favorites` | Auth |
| GET | `/adhkar/search?q=` | Public |

Home root includes EN fields:

- `greeting` / `greetingEn`
- `titleAr` / `titleEn`
- `ctaAr` / `ctaEn`
- nested `dailyWird` (same titles/CTAs + items with `textEn` / `benefitEn` / `referenceEn` when available)

Progress:

```json
{
  "categoryKey": "MORNING",
  "markedItemId": "…",
  "items": [ { "itemId": "…", "tapCount": 2, "completed": false } ],
  "progressItemsDone": 3,
  "progressItemsTotal": 20,
  "progressPercent": 15
}
```

---

## 9) Challenges / tasbih / qibla (auth unless noted)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/challenges` | Auth |
| GET | `/challenges/today` | Auth — includes `id`, EN/AR fields |
| GET | `/challenges/:id` | Auth |
| POST | `/challenges/:id/claim` | Auth |
| POST | `/challenges/today/claim` | Auth (Home) |
| GET | `/tasbih/today` | Auth — `count`, `dhikr`, `dhikrAr`, `dhikrEn`, `dailyGoal`, `progressPercent` |
| POST | `/tasbih/increment` · `/reset` · `PATCH /change-dhikr` | Auth |
| GET | `/qibla/calculate` | **Public** |
| GET | `/qibla/my-qibla` | Auth — requires saved location first (`PUT /profile/location`) |

---

## 10) Prayer / Azan integration

### What backend provides (verified)

1. Dashboard `prayers.schedule` — Title Case + 24h times for signed-in users  
2. `GET /prayers/schedule?lat=&lng=&method=&madhab=` — public server schedule  
   - Methods: `EGYPT` (default), `MWL`, `MAKKAH`, `KARACHI`, `ISNA`, `TEHRAN`  
   - Madhab: `SHAFI` (default), `HANAFI`  
3. Authenticated `GET /prayers/today` — includes completion state for the user

### What Flutter owns for Azan v1 (`AZAN_FEATURE.md`)

- Local Adhan engine / local alarms / offline scheduling  
- Per-prayer toggles, sound assets, permissions  
- **Client Adhan wins for alarms**; dashboard/schedule are for UI sync / cross-check  

### Not implemented (optional / later per Azan §9)

- `GET/PATCH /profile/azan-preferences` → **404**
- `POST /devices/fcm-token` → **404**
- FCM prayer-time push backup

`APP_ENHANCEMENTS.md` is a Flutter/product backlog — **nothing there blocks this backend release**.

---

## 11) Recommended call order

### Guest / cold start

1. Optional: `GET /prayers/schedule` or local Adhan for times  
2. Quran browse/search/catalogs (public)  
3. Adhkar home/search (public)  
4. Auth when user signs up / logs in  

### After login

1. `PUT /profile/location` (once GPS known)  
2. `GET /dashboard`  
3. Parallel as needed: `/journey/today`, `/notifications/unread-count`, `/challenges/today`, `/tasbih/today`, reading preferences  
4. Guest merge once: `POST /quran/import-local`  
5. Reader: catalogs → then `/quran/audio|tafsir|translation` with catalog `id`  

### Page progress order (keep stable)

1. `POST /journey/quran-pages/increment`  
2. Khatmah progress write  
3. Last-read write  

---

## 12) Breaking / important fixes Flutter should know

1. **Audio query aliases:** send `reciterId` **or** `reciter` (both work). Same for `tafsirId`/`source` and `translationId`/`source`.  
2. **Catalog IDs only:** use Production catalog lists above — each maps to a real distinct audio/tafsir/translation body.  
3. **Prayer names:** Title Case on dashboard/schedule; PATCH accepts `Asr` or `ASR`.  
4. **`dailyJourney.quran.target`:** always `5`.  
5. **`import-local`:** returns `bookmarksImported` + `lastReadUpdated`; accepts `null` bags and `pageNumber`.  
6. **Adhkar home:** top-level `titleEn` / `ctaEn` present.  
7. **Badges:** on `/journey/today` and `GET /journey/badges`.  

---

## 13) Remaining external / Flutter-side items

| Item | Owner | Notes |
|------|-------|-------|
| Confirm one password-reset email arrives in a real inbox | Ops / Flutter QA | API + SMTP configured (`health.email.readyForDelivery=true`) |
| Azan prefs sync + FCM | Optional later | Not required for Azan v1 |
| APP_ENHANCEMENTS UX | Flutter | Non-blocking backlog |

---

## 14) Production verification summary (2026-09-04)

- Contract audit script: **63/63 passed** on Production  
- Distinct audio URLs for all 7 reciters  
- All 7 tafsirs / 7 translations return real content  
- Arabic search returns non-zero hits  
- Dashboard / journey / badges / import-local / prefs / challenges / qibla verified with auth  

**Integrate against this document + the live base URL above.**
