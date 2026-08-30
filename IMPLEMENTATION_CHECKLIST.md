# Backend Implementation Checklist ✅

**Date:** 2026-08-28  
**Status:** Complete Review

This checklist verifies all endpoints against [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md).

---

## ✅ Section 0: Envelope

- [x] Standard success envelope with `success`, `message`, `data`, `meta`, `timestamp`, `requestId`
- [x] Standard error envelope with `success: false`, `message`, `code`, `errors[]`
- [x] Error code `INVALID_TOKEN` on 401 for expired/malformed tokens
- [x] Other 401 errors for missing auth (allows refresh retry)
- [x] 5xx errors on `/auth/me` don't trigger hard logout
- [x] Nested tokens under `data.tokens` on auth endpoints

**Status:** ✅ **COMPLETE**

---

## ✅ Section 1: Auth (8 endpoints)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/auth/sign-up` | POST | ✅ | Returns user + tokens |
| `/auth/login` | POST | ✅ | Returns user + tokens |
| `/auth/google` | POST | ✅ | Google OAuth with idToken |
| `/auth/refresh` | POST | ✅ | Returns new access + refresh tokens |
| `/auth/logout` | POST | ✅ | Invalidates refresh token |
| `/auth/me` | GET | ✅ | Flat user profile |
| `/auth/forgot-password` | POST | ✅ | Sends reset email |
| `/auth/reset-password` | POST | ✅ | Validates token + updates password |

**Response Structure:**
- [x] `user` object with `id`, `fullName`, `email`, `provider`, `providerId`
- [x] `tokens` object with `accessToken`, `refreshToken`, `expiresIn`
- [x] Access token valid for **1 hour**
- [x] Refresh token valid for **90 days**

**Status:** ✅ **COMPLETE**

---

## ✅ Section 2: Dashboard

| Endpoint | Method | Status |
|----------|--------|--------|
| `/dashboard` | GET | ✅ |

**Sections:**
- [x] `greeting` — displayName, weekdayName, hijriDate, points
- [x] `prayers` — nextPrayer + schedule with 24h times
- [x] `verseOfTheDay` — textAr + referenceAr
- [x] `hadithOfTheDay` — textAr + sourceAr
- [x] `dailyJourney` — prayer, quran, adhkar, sadaqah progress
- [x] `khatmah` — surahId, **surahNameAr** (real name), currentPage, progressPercent
- [x] `dailyChallenge` — titleAr, rewardPoints, completed, claimed
- [x] `utilities` — empty object

**Critical:**
- [x] Prayer times in 24-hour format (`HH:mm`)
- [x] Khatmah `surahNameAr` is real Arabic name (never numeric id)

**Status:** ✅ **COMPLETE**

---

## ✅ Section 3: Quran Browse (Public)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/quran/surahs` | GET | Public | ✅ |
| `/quran/surahs/:id` | GET | Public | ✅ |
| `/quran/surahs/:id/ayahs` | GET | Public | ✅ |
| `/quran/juz` | GET | Public | ✅ |
| `/quran/juz/:n/surahs` | GET | Public | ✅ |
| `/quran/juz/:n/ayahs` | GET | Public | ✅ |
| `/quran/pages/:page` | GET | Public | ✅ |
| `/quran/full-catalog` | GET | Public | ✅ |
| `/quran/search` | GET | Public | ✅ |
| `/quran/ayahs/random` | GET | Public | ✅ |

**Surah Object:**
- [x] Always includes `nameAr` (real Arabic name, never numeric id)
- [x] Always includes `nameEn` (English name)
- [x] Includes `revelationType` (MAKKI | MADANI)
- [x] Includes `totalAyahs`, `totalPages`, `startPage`

**Page Payload:**
- [x] Includes `ayahs[]` array with full ayah data
- [x] Includes `surahs[]` with real Arabic names

**Bismillah Handling:**
- [x] Surahs 2-8, 10-114: Ayah 1 = body only (Bismillah stripped)
- [x] Surah 1: Bismillah in ayah 1
- [x] Surah 9: No Bismillah
- [x] BOM (`U+FEFF`) stripped from all `textAr`

**Full Catalog:**
- [x] Route exists and working
- [x] **HTTP Range support** for resume
- [x] Includes `meta` with catalogVersion, totalAyahs, bismillahStripped
- [x] All surah `nameAr` fields are real names

**Critical Verification:**
- [x] `/quran/surahs` — nameAr verified ✅
- [x] `/quran/juz/:n/surahs` — nameAr verified ✅
- [x] `/quran/pages/:page` → surahs[].nameAr verified ✅
- [x] `/quran/full-catalog` — nameAr verified ✅

**Status:** ✅ **COMPLETE**

---

## ✅ Section 4: Quran Progress (Authenticated)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/quran/bookmarks` | GET | Bearer | ✅ |
| `/quran/bookmarks` | POST | Bearer | ✅ |
| `/quran/bookmarks/:id` | PATCH | Bearer | ✅ |
| `/quran/bookmarks/:id` | DELETE | Bearer | ✅ |
| `/quran/last-read` | GET | Bearer | ✅ |
| `/quran/last-read` | PUT | Bearer | ✅ |
| `/quran/reading-history` | GET | Bearer | ✅ |
| `/quran/reading-history` | POST | Bearer | ✅ |
| `/quran/khatmah` | GET | Bearer | ✅ |
| `/quran/khatmah/stats` | GET | Bearer | ✅ |
| `/quran/khatmah/progress` | PATCH | Bearer | ✅ |
| `/quran/khatmah/reset` | POST | Bearer | ✅ |
| **`/quran/import-local`** | **POST** | **Bearer** | ✅ **NEW** |

**Bookmark Response:**
- [x] Includes `id`, `surahId`, `ayahNumber`, `page`, `textAr`, `note`
- [x] Includes `surahNameAr` (real name)
- [x] Includes nested `surah` object with full details
- [x] Includes `createdAt`

**Last-Read Response:**
- [x] Includes `surahId`, `page`, `ayahNumber`, `juz`
- [x] Includes `surahNameAr` (real name)
- [x] Includes nested `surah` object
- [x] Includes `updatedAt`

**Khatmah Stats:**
- [x] Includes `surahId`, **`surahNameAr`** (real name)
- [x] Includes `currentPage`, `pagesRead`, `progressPercent`
- [x] Includes `startedAt`, `completedAt`

**Guest Merge (NEW):**
- [x] `POST /quran/import-local` endpoint exists
- [x] Accepts `bookmarks[]` array + `lastRead` object
- [x] Idempotent (no duplicate bookmarks)
- [x] Returns `bookmarksImported` + `lastReadUpdated` counts

**Status:** ✅ **COMPLETE**

---

## ✅ Section 5: Reading Preferences

| Endpoint | Method | Status |
|----------|--------|--------|
| `/profile/reading-preferences` | GET | ✅ |
| `/profile/reading-preferences` | PATCH | ✅ |

**Fields:**
- [x] `quranFontSize` (12-60, clamped)
- [x] `quranReciter`
- [x] `quranTafsir`
- [x] `quranTranslation`

**Missing (Contract says "Coming Soon"):**
- [ ] `GET /quran/audio` — Reciter audio URLs
- [ ] `GET /quran/tafsir` — Tafsir text by ayah
- [ ] Translation content inline in pages

**Status:** ✅ **COMPLETE** (core preferences done; audio/tafsir/translation marked as future enhancement)

---

## ✅ Section 6: Adhkar

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/adhkar` | GET | Public | ✅ |
| `/adhkar/categories` | GET | Public | ✅ |
| `/adhkar/categories/:key` | GET | Public | ✅ |
| `/adhkar/daily-wird` | GET | Public | ✅ |
| `/adhkar/progress` | GET | Bearer | ✅ |
| `/adhkar/progress` | PUT | Bearer | ✅ |
| **`/adhkar/favorites`** | **GET** | **Bearer** | ✅ **NEW** |
| **`/adhkar/favorites`** | **POST** | **Bearer** | ✅ **NEW** |
| **`/adhkar/favorites/:id`** | **DELETE** | **Bearer** | ✅ **NEW** |

**Adhkar Home:**
- [x] Includes `greeting` string
- [x] Includes `dailyWird` with progress (itemsDone, itemsTotal, percent)
- [x] Includes `categories[]` array (7 categories)

**Category Detail:**
- [x] Returns all dhikr `items[]` in category
- [x] Each item includes: id, orderInCategory, textAr, repeatCount, referenceAr, benefitAr

**Progress (Authenticated):**
- [x] GET returns `categoryKey`, `markedItemId`, `items[]` with tapCount
- [x] PUT accepts `categoryKey`, `itemId`, `tapCount`
- [x] Returns progress summary (itemsDone, itemsTotal, percent)

**Favorites (NEW FEATURE):**
- [x] GET lists all user favorites with full dhikr details
- [x] POST adds dhikr to favorites (returns 201)
- [x] DELETE removes from favorites
- [x] Database table `adhkar_favorites` with unique constraint (userId + itemId)
- [x] Returns 409 Conflict if already favorited
- [x] Returns 404 if dhikr not found

**Categories Available:**
- [x] MORNING (12 items)
- [x] EVENING (11 items)
- [x] BEFORE_SLEEP (9 items)
- [x] ENTERING_MOSQUE (10 items)
- [x] AFTER_PRAYER (10 items)
- [x] GENERAL_WIRD (10 items)
- [x] TRAVEL (travel adhkar)

**Adhkar Authenticity:**
- [x] All from Hisnul Muslim (حصن المسلم)
- [x] References from Bukhari, Muslim, Tirmidhi, Abu Dawood
- [x] All marked with source (referenceAr)

**Status:** ✅ **COMPLETE** (+ bonus favorites feature)

---

## ✅ Section 7: Journey

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/journey/today` | GET | ✅ | Today's progress |
| `/journey/progress` | GET | ✅ | Multi-day history |
| `/journey/quran-pages` | PATCH | ✅ | Set pages value |
| `/journey/quran-pages/increment` | POST | ✅ | Add pages |
| `/journey/adhkar` | PATCH | ✅ | Mark adhkar completed |
| `/journey/sadaqah` | PATCH | ✅ | Set sadaqah amount |

**Today Response:**
- [x] Includes `date`
- [x] Includes `quran` (pages, goal, percent)
- [x] Includes `adhkar` (morningCompleted, eveningCompleted, overallCompleted, percent)
- [x] Includes `sadaqah` (amount, goal, percent, currency)
- [x] Includes `prayers` (completed, total, percent)
- [x] Includes `overallPercent`

**Progress Response:**
- [x] Includes `periodDays`
- [x] Includes `summary` (totalQuranPages, totalSadaqahAmount, adhkarDaysCompleted, etc.)
- [x] Includes `daily[]` array with per-day breakdown

**Status:** ✅ **COMPLETE**

---

## ✅ Section 8: Tasbih

| Endpoint | Method | Status |
|----------|--------|--------|
| `/tasbih/today` | GET | ✅ |
| `/tasbih/increment` | POST | ✅ |
| `/tasbih/reset` | POST | ✅ |
| `/tasbih/change-dhikr` | PATCH | ✅ |

**Response Fields:**
- [x] `count` / `todayCount`
- [x] `dhikr` / `currentDhikr`
- [x] `dhikrAr` / `currentDhikrAr`
- [x] `dailyGoal`
- [x] `progressPercent`

**Status:** ✅ **COMPLETE**

---

## ✅ Section 9: Qibla

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/qibla/calculate` | GET | Public | ✅ |
| `/qibla/my-qibla` | GET | Bearer | ✅ |

**Response Fields:**
- [x] `bearingDegrees`
- [x] `bearingRadians`
- [x] `directionAr`
- [x] `distanceKm`
- [x] `userLocation` (lat, lng)

**Status:** ✅ **COMPLETE**

---

## ✅ Section 10: Notifications

| Endpoint | Method | Status |
|----------|--------|--------|
| `/notifications` | GET | ✅ |
| `/notifications/unread-count` | GET | ✅ |
| `/notifications/:id` | GET | ✅ |
| `/notifications/:id/read` | PATCH | ✅ |
| `/notifications/read-all` | POST | ✅ |

**Response Fields:**
- [x] List includes: id, titleAr, titleEn, bodyAr, bodyEn, type, read, createdAt
- [x] Unread count returns `{ unreadCount: number }`
- [x] Pagination with `meta` (total, page, perPage)

**Status:** ✅ **COMPLETE**

---

## ✅ Section 11: Profile

| Endpoint | Method | Status |
|----------|--------|--------|
| `/profile/me` | GET | ✅ |
| `/profile/update` | PATCH | ✅ |
| `/profile/change-password` | PATCH | ✅ |
| `/profile/location` | PUT | ✅ |

**Profile Fields:**
- [x] id, fullName, email, provider, providerId
- [x] location (latitude, longitude)
- [x] createdAt

**Status:** ✅ **COMPLETE**

---

## ✅ Section 12: Critical Fixes Checklist

### Must Fix / Harden

- [x] **Never return bare surah ids as nameAr** — Verified on all surfaces
  - [x] `/quran/surahs` ✅
  - [x] `/quran/juz/:n/surahs` ✅
  - [x] `/quran/pages/:page` → surahs[] ✅
  - [x] `/quran/full-catalog` ✅
  - [x] Bookmarks → surahNameAr ✅
  - [x] Last-read → surah.nameAr ✅
  - [x] Khatmah → surahNameAr ✅
  - [x] Dashboard khatmah → surahNameAr ✅

- [x] **Dashboard stable 200** — All sections return proper data

- [x] **Prayer times as 24h** — All times in `HH:mm` format

- [x] **Bookmarks + last-read include full fields** — surahNameAr + ayahNumber ✅

- [x] **Khatmah stats include real surahNameAr** — Never numeric id ✅

- [x] **Full-catalog + juz ayahs routes confirmed** — Both live with HTTP Range ✅

- [x] **Refresh / me: only 401 when truly invalid** — Transient errors don't trigger logout ✅

### Should Add

- [x] **Adhkar progress + resume mark sync** — markedItemId, tap counts, real daily wird %

- [x] **Adhkar favorites** — ✅ **ADDED** (3 endpoints: GET/POST/DELETE)

- [x] **Notifications list + unread count** — All 5 endpoints live

- [x] **Journey today + progress + sadaqah PATCH** — All working

- [x] **Profile update / change-password** — All endpoints live

- [x] **Guest → account data merge** — `POST /quran/import-local` ✅

### Keep Public (skipAuth)

- [x] Quran browse endpoints (surahs, juz, pages, full-catalog)
- [x] Adhkar home + categories
- [x] Qibla calculate
- [x] Auth public routes (login, sign-up, Google, forgot, reset, refresh)

**Status:** ✅ **ALL COMPLETE**

---

## ✅ Section 13: Auth Header & Guest Rules

- [x] Signed-in users send `Authorization: Bearer <accessToken>`
- [x] Guest users: No Bearer, public routes only
- [x] After login: Server state used, guest merge available

**Status:** ✅ **COMPLETE**

---

## ✅ Section 14: Field Glossary

All required fields verified present:

- [x] `surahId` (int 1..114) — Always numeric
- [x] `nameAr` / `surahNameAr` (string) — **Always real Arabic name**
- [x] `nameEn` (string) — Always English name
- [x] `ayahNumber` (int) — Present on bookmarks/last-read
- [x] `page` (int 1..604) — Mushaf page
- [x] `juz` (int 1..30) — On ayahs/last-read
- [x] `textAr` (string) — BOM-free, Bismillah rules applied
- [x] `revelationType` — MAKKI | MADANI
- [x] `repeatCount` (int) — Adhkar items
- [x] `markedItemId` (string) — Adhkar resume
- [x] `accessToken` / `refreshToken` — Nested under `tokens`

**Status:** ✅ **COMPLETE**

---

## 🆕 New Features Added (Beyond Contract)

### 1. Adhkar Favorites ✅

**3 new endpoints:**
- `GET /adhkar/favorites` — List favorites with full dhikr details
- `POST /adhkar/favorites` — Add to favorites (201 Created)
- `DELETE /adhkar/favorites/:id` — Remove from favorites

**Database:**
- Table: `adhkar_favorites`
- Unique constraint: `userId` + `itemId`
- Relations: User ↔ AdhkarFavorite ↔ DhikrItem

**Tested in production:** ✅

### 2. Guest Data Merge ✅

**New endpoint:**
- `POST /quran/import-local` — Merge guest bookmarks + last-read after login

**Features:**
- Idempotent (won't duplicate bookmarks)
- Returns import counts

**Tested in production:** ✅

### 3. Bookmark Notes ✅

**Enhanced endpoint:**
- `PATCH /quran/bookmarks/:id` — Update bookmark note field

**Tested in production:** ✅

---

## 📊 Summary

### Total Endpoints Implemented: **48+**

| Category | Count | Status |
|----------|-------|--------|
| Auth | 8 | ✅ Complete |
| Dashboard | 1 | ✅ Complete |
| Quran Browse | 10 | ✅ Complete |
| Quran Progress | 13 | ✅ Complete (+ 1 new) |
| Reading Preferences | 2 | ✅ Complete |
| Adhkar | 9 | ✅ Complete (+ 3 new) |
| Journey | 6 | ✅ Complete |
| Tasbih | 4 | ✅ Complete |
| Qibla | 2 | ✅ Complete |
| Notifications | 5 | ✅ Complete |
| Profile | 4 | ✅ Complete |
| Challenges | 5 | ✅ Complete |
| Content | 3 | ✅ Complete |
| Prayers | 3 | ✅ Complete |

### Missing Features (Marked as "Coming Soon" in Contract):

- [ ] `GET /quran/audio` — Reciter audio URLs
- [ ] `GET /quran/tafsir` — Tafsir text by ayah  
- [ ] Translation content inline

**Note:** These are marked as **future enhancements** in contract, not blocking.

---

## ✅ Final Verdict

**Status:** ✅ **100% COMPLETE**

All endpoints from [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md) are implemented, tested, and live in production.

**Bonus features added:**
- Adhkar Favorites (3 endpoints)
- Guest data merge
- Bookmark notes

**Critical fixes verified:**
- All surah names are real Arabic text (never numeric ids)
- Prayer times in 24h format
- Token expiry: 1h access, 90d refresh
- HTTP Range support on catalog
- Error codes match Flutter expectations

**Production URL:**
```
https://noor-app-backend-one.vercel.app/api/v1
```

**API Documentation:**
```
https://noor-app-backend-one.vercel.app/api/v1/docs
```

---

**Ready for Flutter integration!** 🚀

---

*Last Updated: 2026-08-28*
