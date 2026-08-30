# Backend Implementation Status — Response to Flutter Team

**Audience:** Flutter team  
**App:** Noor Flutter (`lib/`)  
**Base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-08-28  
**Status:** ✅ **Production Ready**

This document responds to [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md) with the **current implementation status** of all endpoints and data contracts requested by the Flutter team.

---

## ✅ Implementation Summary

| Section | Status | Notes |
|---------|--------|-------|
| **0) Envelope** | ✅ Complete | All responses follow standard envelope |
| **1) Auth** | ✅ Complete | All 8 endpoints live + Google OAuth |
| **2) Dashboard** | ✅ Complete | All sections implemented |
| **3) Quran Browse** | ✅ Complete | Public routes + offline catalog |
| **4) Quran Progress** | ✅ Complete | Bookmarks + last-read + khatmah + **guest merge** |
| **5) Reading Preferences** | ✅ Complete | GET + PATCH implemented |
| **6) Adhkar** | ✅ Complete + **NEW** | Added favorites feature |
| **7) Journey** | ✅ Complete | All 4 endpoints live |
| **8) Tasbih** | ✅ Complete | All 4 endpoints live |
| **9) Qibla** | ✅ Complete | Calculate + my-qibla endpoints |
| **10) Notifications** | ✅ Complete | All 5 endpoints live |
| **11) Profile** | ✅ Complete | All endpoints implemented |
| **12) Critical Fixes** | ✅ Complete | All surah names verified |

---

## 0) Envelope — ✅ Implemented

All API responses follow the standard envelope:

**Success:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {},
  "timestamp": "2026-08-28T10:00:00.000Z",
  "requestId": "uuid"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "code": "UNAUTHORIZED | INVALID_TOKEN | NOT_FOUND | VALIDATION_ERROR",
  "errors": [{ "field": "email", "message": "Invalid email format" }],
  "timestamp": "2026-08-28T10:00:00.000Z",
  "requestId": "uuid"
}
```

### Error Code Behavior — ✅ Matches Flutter Contract

| Code | HTTP | Flutter Behavior | Backend Sends |
|------|------|------------------|---------------|
| `INVALID_TOKEN` | 401 | Clear session (no refresh) | ✅ On expired/malformed tokens |
| Other 401 | 401 | Try `/auth/refresh`, then retry | ✅ On missing auth |
| Network/5xx on `/auth/me` | 500/503 | Keep tokens (don't logout) | ✅ Transient errors don't 401 |

---

## 1) Auth — ✅ All 8 Endpoints Live

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/auth/sign-up` | ✅ | Returns `user` + `tokens` |
| POST | `/auth/login` | ✅ | Returns `user` + `tokens` |
| POST | `/auth/google` | ✅ | Google OAuth with `idToken` |
| POST | `/auth/refresh` | ✅ | Returns new `accessToken` + `refreshToken` |
| POST | `/auth/logout` | ✅ | Invalidates refresh token |
| GET | `/auth/me` | ✅ | Returns flat user profile |
| POST | `/auth/forgot-password` | ✅ | Sends reset email |
| POST | `/auth/reset-password` | ✅ | Validates token + updates password |

### Response Structure — ✅ Matches Contract

**Login / Sign-up / Google / Refresh:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "John Doe",
      "email": "user@example.com",
      "provider": "LOCAL",
      "providerId": null
    },
    "tokens": {
      "accessToken": "jwt...",
      "refreshToken": "jwt...",
      "expiresIn": 3600
    }
  }
}
```

**GET /auth/me:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "user@example.com",
    "provider": "LOCAL",
    "providerId": null
  }
}
```

### ✅ Guest Support

- All public routes work without Bearer token (`skipAuth: true`)
- No 401 on transient network errors
- **Access token:** Valid for **1 hour** (`JWT_EXPIRES_IN=1h`)
- **Refresh token:** Valid for **90 days** (`JWT_REFRESH_EXPIRES_IN=90d`)

---

## 2) Dashboard — ✅ Complete

**GET /dashboard** (Bearer required)

All sections implemented:

```json
{
  "success": true,
  "data": {
    "greeting": {
      "displayName": "John Doe",
      "weekdayName": "Friday",
      "hijriDate": "15 Safar 1448",
      "points": 120
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
    "verseOfTheDay": {
      "textAr": "...",
      "referenceAr": "سورة البقرة - آية 255"
    },
    "hadithOfTheDay": {
      "textAr": "...",
      "sourceAr": "رواه البخاري"
    },
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
      "titleAr": "اقرأ 5 صفحات من القرآن",
      "descriptionAr": "...",
      "rewardPoints": 10,
      "targetValue": 5,
      "completed": false,
      "claimed": false
    },
    "utilities": {}
  }
}
```

### ✅ Prayer Times Format

- Times sent as **24-hour format** `HH:mm` (e.g., `"16:34"`)
- `countdownSeconds` included for next prayer
- All prayer names include `nameAr` for Arabic display

### ✅ Khatmah Card

- `surahNameAr` always returns real Arabic name (e.g., `"البقرة"`)
- Never returns numeric id as name

---

## 3) Quran Browse — ✅ Complete + Public

All routes are **public** (`skipAuth: true`) for guest access:

| Method | Path | Status | Auth |
|--------|------|--------|------|
| GET | `/quran/surahs` | ✅ | Public |
| GET | `/quran/surahs/:id` | ✅ | Public |
| GET | `/quran/surahs/:id/ayahs` | ✅ | Public (pagination) |
| GET | `/quran/juz` | ✅ | Public |
| GET | `/quran/juz/:n/surahs` | ✅ | Public |
| GET | `/quran/juz/:n/ayahs` | ✅ | Public |
| GET | `/quran/pages/:page` | ✅ | Public |
| GET | `/quran/full-catalog` | ✅ | Public + HTTP Range |
| GET | `/quran/search` | ✅ | Public |
| GET | `/quran/ayahs/random` | ✅ | Public |

### ✅ Surah Object — Always Includes Real Names

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

### ✅ CRITICAL FIX — Surah Names Verified

**Problem resolved:** Backend no longer returns bare numeric ids (e.g., `"3"`, `"6"`, `"7"`) as `nameAr`.

**Verified on all surfaces:**
- ✅ `/quran/surahs` → `nameAr`, `nameEn` are real names
- ✅ `/quran/juz/:n/surahs` → `nameAr`, `nameEn` are real names
- ✅ `/quran/pages/:page` → `surahs[].nameAr` are real names
- ✅ `/quran/full-catalog` → `surahs[].nameAr` are real names
- ✅ Bookmarks → `surahNameAr` always real name
- ✅ Last-read → `surah.nameAr` always real name
- ✅ Khatmah → `surahNameAr` always real name
- ✅ Dashboard `khatmah` → `surahNameAr` always real name

**All surah names are now human-readable Arabic, never numeric ids.**

### ✅ Page Payload

```json
{
  "success": true,
  "data": {
    "page": 50,
    "totalPages": 604,
    "ayahs": [
      {
        "surahId": 3,
        "ayahNumber": 1,
        "textAr": "الم",
        "page": 50,
        "juz": 3
      }
    ],
    "surahs": [
      {
        "id": 3,
        "nameAr": "آل عمران",
        "nameEn": "Ali 'Imran",
        "revelationType": "MADANI"
      }
    ]
  }
}
```

### ✅ Bismillah Handling

- Surahs 2-8, 10-114: Ayah #1 = verse body only (Bismillah stripped)
- Surah 1 (Al-Fatihah): Bismillah included in ayah 1
- Surah 9 (At-Tawbah): No Bismillah
- All `textAr` cleaned of BOM (`U+FEFF`)

### ✅ Full Catalog

- Route: `GET /quran/full-catalog`
- **HTTP Range support** for resume (e.g., `Range: bytes=0-1048576`)
- Response includes all 114 surahs with ayahs
- `catalogVersion`, `totalAyahs`, `bismillahStripped` in meta

---

## 4) Quran Progress — ✅ Complete + Guest Merge

| Method | Path | Status | Auth |
|--------|------|--------|------|
| GET | `/quran/bookmarks` | ✅ | Bearer |
| POST | `/quran/bookmarks` | ✅ | Bearer |
| PATCH | `/quran/bookmarks/:id` | ✅ | Bearer (update note) |
| DELETE | `/quran/bookmarks/:id` | ✅ | Bearer |
| GET | `/quran/last-read` | ✅ | Bearer |
| PUT | `/quran/last-read` | ✅ | Bearer |
| GET | `/quran/reading-history` | ✅ | Bearer |
| POST | `/quran/reading-history` | ✅ | Bearer |
| GET | `/quran/khatmah` | ✅ | Bearer |
| GET | `/quran/khatmah/stats` | ✅ | Bearer |
| PATCH | `/quran/khatmah/progress` | ✅ | Bearer |
| POST | `/quran/khatmah/reset` | ✅ | Bearer |
| **POST** | **`/quran/import-local`** | ✅ **NEW** | Bearer |

### ✅ Bookmark Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "surahId": 2,
    "ayahNumber": 255,
    "page": 42,
    "textAr": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ...",
    "note": "Important verse",
    "surahNameAr": "البقرة",
    "surah": {
      "id": 2,
      "nameAr": "البقرة",
      "nameEn": "Al-Baqarah"
    },
    "createdAt": "2026-08-28T10:00:00.000Z"
  }
}
```

### ✅ Last-Read Response

```json
{
  "success": true,
  "data": {
    "surahId": 2,
    "page": 42,
    "ayahNumber": 255,
    "juz": 3,
    "surahNameAr": "البقرة",
    "surah": {
      "id": 2,
      "nameAr": "البقرة",
      "nameEn": "Al-Baqarah"
    },
    "updatedAt": "2026-08-28T10:00:00.000Z"
  }
}
```

### ✅ Khatmah Stats Response

```json
{
  "success": true,
  "data": {
    "surahId": 2,
    "surahNameAr": "البقرة",
    "currentPage": 12,
    "pagesRead": 12,
    "progressPercent": 2,
    "completedAt": null,
    "startedAt": "2026-08-01T00:00:00.000Z"
  }
}
```

### 🆕 Guest → User Merge (NEW)

**POST /quran/import-local** (Bearer required)

Merges guest's local data (bookmarks + last-read) into authenticated account.

**Request:**
```json
{
  "bookmarks": [
    {
      "surahId": 2,
      "ayahNumber": 255,
      "page": 42,
      "note": "Guest bookmark"
    }
  ],
  "lastRead": {
    "surahId": 3,
    "page": 50,
    "ayahNumber": 1
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Local data imported successfully",
  "data": {
    "bookmarksImported": 1,
    "lastReadUpdated": true
  }
}
```

**Idempotent:** Duplicate bookmarks (same surah + ayah) won't create duplicates.

---

## 5) Reading Preferences — ✅ Complete

| Method | Path | Status |
|--------|------|--------|
| GET | `/profile/reading-preferences` | ✅ |
| PATCH | `/profile/reading-preferences` | ✅ |

**Response:**
```json
{
  "success": true,
  "data": {
    "quranFontSize": 28,
    "quranReciter": "Mishary_Alafasy",
    "quranTafsir": "Ibn_Kathir",
    "quranTranslation": "Sahih_International"
  }
}
```

**Font size clamped:** 12-60 (validated server-side)

### 🔜 Coming Soon

- `GET /quran/audio` — Reciter audio URLs
- `GET /quran/tafsir` — Tafsir text by ayah
- Translation content inline in page payload

---

## 6) Adhkar — ✅ Complete + 🆕 Favorites Feature

| Method | Path | Status | Auth |
|--------|------|--------|------|
| GET | `/adhkar` | ✅ | Public |
| GET | `/adhkar/categories` | ✅ | Public |
| GET | `/adhkar/categories/:key` | ✅ | Public |
| GET | `/adhkar/daily-wird` | ✅ | Public |
| GET | `/adhkar/progress` | ✅ | Bearer |
| PUT | `/adhkar/progress` | ✅ | Bearer |
| **GET** | **`/adhkar/favorites`** | ✅ **NEW** | Bearer |
| **POST** | **`/adhkar/favorites`** | ✅ **NEW** | Bearer |
| **DELETE** | **`/adhkar/favorites/:id`** | ✅ **NEW** | Bearer |

### ✅ Adhkar Home Response

```json
{
  "success": true,
  "data": {
    "greeting": "واذكر ربك إذا نسيت",
    "dailyWird": {
      "titleAr": "وردك اليوم",
      "subtitleAr": "واذكر ربك إذا نسيت",
      "progressItemsDone": 4,
      "progressItemsTotal": 8,
      "progressPercent": 50,
      "ctaAr": "اكمل وردك اليوم",
      "categoryKey": "GENERAL_WIRD",
      "items": []
    },
    "categories": [
      {
        "id": "uuid",
        "key": "MORNING",
        "nameAr": "اذكار الصباح",
        "nameEn": "Morning Dhikr",
        "descriptionAr": "الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم",
        "iconCode": "🌤️",
        "sortOrder": 1,
        "totalItems": 12
      }
    ]
  }
}
```

### ✅ Category Detail (e.g., GET /adhkar/categories/MORNING)

Returns **all dhikr items** in the category:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "key": "MORNING",
    "nameAr": "اذكار الصباح",
    "nameEn": "Morning Dhikr",
    "descriptionAr": "...",
    "iconCode": "🌤️",
    "sortOrder": 1,
    "totalItems": 12,
    "items": [
      {
        "id": "item-uuid",
        "orderInCategory": 1,
        "textAr": "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ...",
        "textArPlain": null,
        "repeatCount": 1,
        "referenceAr": "آية الكرسي - سورة البقرة 255",
        "benefitAr": "من قالها حين يصبح أجير من الجن حتى يمسي"
      }
    ]
  }
}
```

### ✅ Adhkar Progress (authenticated)

**GET /adhkar/progress?categoryKey=MORNING**

```json
{
  "success": true,
  "data": {
    "categoryKey": "MORNING",
    "markedItemId": "item-uuid",
    "items": [
      {
        "itemId": "item-uuid",
        "tapCount": 2,
        "completed": false
      }
    ],
    "progressItemsDone": 3,
    "progressItemsTotal": 12,
    "progressPercent": 25
  }
}
```

**PUT /adhkar/progress**

Request:
```json
{
  "categoryKey": "MORNING",
  "itemId": "item-uuid",
  "tapCount": 3
}
```

Response:
```json
{
  "success": true,
  "message": "Adhkar progress saved",
  "data": {
    "categoryKey": "MORNING",
    "itemId": "item-uuid",
    "tapCount": 3,
    "completed": true
  }
}
```

### 🆕 Adhkar Favorites (NEW FEATURE)

**GET /adhkar/favorites** — List user's favorite adhkar

```json
{
  "success": true,
  "data": [
    {
      "id": "favorite-uuid",
      "itemId": "item-uuid",
      "dhikr": {
        "id": "item-uuid",
        "textAr": "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
        "repeatCount": 100,
        "referenceAr": "رواه البخاري ومسلم",
        "benefitAr": "كنز من كنوز الجنة",
        "category": {
          "key": "MORNING",
          "nameAr": "اذكار الصباح"
        }
      },
      "createdAt": "2026-08-28T10:00:00.000Z"
    }
  ]
}
```

**POST /adhkar/favorites** — Add dhikr to favorites

Request:
```json
{
  "itemId": "item-uuid"
}
```

Response (201 Created):
```json
{
  "success": true,
  "message": "Dhikr added to favorites",
  "data": {
    "id": "favorite-uuid",
    "itemId": "item-uuid",
    "dhikr": {
      "id": "item-uuid",
      "textAr": "...",
      "repeatCount": 1,
      "referenceAr": "...",
      "category": {
        "key": "MORNING",
        "nameAr": "اذكار الصباح"
      }
    },
    "createdAt": "2026-08-28T10:00:00.000Z"
  }
}
```

**DELETE /adhkar/favorites/:favoriteId** — Remove from favorites

Response (200 OK):
```json
{
  "success": true,
  "message": "Favorite removed successfully",
  "data": {
    "message": "Favorite removed successfully"
  }
}
```

**Notes:**
- Unique constraint on `userId` + `itemId` (no duplicates)
- 409 Conflict if already favorited
- 404 if dhikr item not found

### ✅ Adhkar Categories Available

1. **MORNING** — اذكار الصباح (12 items)
2. **EVENING** — اذكار المساء (11 items)
3. **BEFORE_SLEEP** — اذكار النوم (9 items)
4. **ENTERING_MOSQUE** — اذكار المسجد (10 items)
5. **AFTER_PRAYER** — اذكار الصلاة (10 items)
6. **GENERAL_WIRD** — وردك اليوم (10 items)
7. **TRAVEL** — اذكار السفر (travel adhkar)

**All adhkar verified from authentic sources:**
- Hisnul Muslim (حصن المسلم)
- Sahih Al-Bukhari & Muslim
- Authentic hadiths from Tirmidhi, Abu Dawood

---

## 7) Journey — ✅ Complete

| Method | Path | Status |
|--------|------|--------|
| GET | `/journey/today` | ✅ |
| GET | `/journey/progress` | ✅ |
| POST | `/journey/quran-pages/increment` | ✅ |
| PATCH | `/journey/adhkar` | ✅ |
| PATCH | `/journey/sadaqah` | ✅ |

**GET /journey/today:**
```json
{
  "success": true,
  "data": {
    "date": "2026-08-28",
    "tasks": [
      { "key": "quran", "titleAr": "القرآن", "done": false, "progress": 0.3 },
      { "key": "prayer", "titleAr": "الصلاة", "done": false },
      { "key": "adhkar", "titleAr": "الأذكار", "done": true },
      { "key": "sadaqah", "titleAr": "الصدقة", "done": false, "amount": 0 }
    ],
    "streakDays": 4,
    "badges": [],
    "points": 120
  }
}
```

**POST /journey/quran-pages/increment:**
```json
{
  "pages": 3
}
```

**PATCH /journey/sadaqah:**
```json
{
  "amount": 10
}
```

---

## 8) Tasbih — ✅ Complete

| Method | Path | Status |
|--------|------|--------|
| GET | `/tasbih/today` | ✅ |
| POST | `/tasbih/increment` | ✅ |
| POST | `/tasbih/reset` | ✅ |
| PATCH | `/tasbih/change-dhikr` | ✅ |

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 33,
    "dhikr": "ALHAMDULILLAH",
    "dhikrAr": "الحمد لله",
    "dailyGoal": 99,
    "progressPercent": 33
  }
}
```

**Aliases accepted:** `todayCount`, `currentDhikr`, `currentDhikrAr`, `currentDhikrCount`

---

## 9) Qibla — ✅ Complete

| Method | Path | Status | Auth |
|--------|------|--------|------|
| GET | `/qibla/calculate?lat=30&lng=31` | ✅ | Public |
| GET | `/qibla/my-qibla` | ✅ | Bearer |

**Response:**
```json
{
  "success": true,
  "data": {
    "bearingDegrees": 136.5,
    "bearingRadians": 2.38,
    "directionAr": "جنوب شرق",
    "distanceKm": 1200.4,
    "userLocation": {
      "latitude": 30.0,
      "longitude": 31.0
    }
  }
}
```

---

## 10) Notifications — ✅ Complete

| Method | Path | Status |
|--------|------|--------|
| GET | `/notifications` | ✅ |
| GET | `/notifications/unread-count` | ✅ |
| GET | `/notifications/:id` | ✅ |
| PATCH | `/notifications/:id/read` | ✅ |
| POST | `/notifications/read-all` | ✅ |

**List response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "titleAr": "تذكير بصلاة العصر",
      "titleEn": "Asr Prayer Reminder",
      "bodyAr": "حان الآن وقت صلاة العصر",
      "bodyEn": "It's time for Asr prayer",
      "type": "AZAN",
      "read": false,
      "createdAt": "2026-08-28T16:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "perPage": 20
  }
}
```

**Unread count:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 3
  }
}
```

---

## 11) Profile — ✅ Complete

| Method | Path | Status |
|--------|------|--------|
| GET | `/profile/me` | ✅ |
| PATCH | `/profile/update` | ✅ |
| PATCH | `/profile/change-password` | ✅ |
| PUT | `/profile/location` | ✅ |

**GET /profile/me:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "user@example.com",
    "provider": "LOCAL",
    "providerId": null,
    "location": {
      "latitude": 30.0,
      "longitude": 31.0
    },
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**PATCH /profile/update:**
```json
{
  "fullName": "New Name"
}
```

**PATCH /profile/change-password:**
```json
{
  "currentPassword": "old123",
  "newPassword": "new456"
}
```

**PUT /profile/location:**
```json
{
  "latitude": 30.0444,
  "longitude": 31.2357
}
```

---

## 12) Critical Fixes Checklist — ✅ All Complete

### Must Fix / Harden — ✅ Done

- [x] Never return bare surah ids as `nameAr` / `surahNameAr`
  - **Fixed:** All surah names verified on all endpoints
- [x] `GET /dashboard` stable 200 with all sections
  - **Fixed:** All sections return proper data
- [x] Prayer times as 24h + optional display strings
  - **Fixed:** All times in `HH:mm` format
- [x] Bookmarks + last-read include `surahNameAr` + `ayahNumber`
  - **Fixed:** All progress endpoints return full data
- [x] Khatmah stats include real `surahNameAr`
  - **Fixed:** Never numeric id
- [x] Full-catalog + juz ayahs routes confirmed
  - **Fixed:** Both routes live with HTTP Range support
- [x] Refresh / me: only 401 when truly invalid
  - **Fixed:** Transient errors don't trigger logout

### Should Add — ✅ Done

- [x] Adhkar progress + resume mark sync
  - **Fixed:** `markedItemId`, tap counts, real daily wird %
- [x] **Adhkar favorites** (save/list/remove)
  - ✅ **NEW:** 3 endpoints added
- [x] Notifications list + unread count
  - **Fixed:** All 5 endpoints live
- [x] Journey today + progress + sadaqah PATCH
  - **Fixed:** All journey endpoints working
- [x] Profile update / change-password
  - **Fixed:** All profile endpoints live
- [x] Guest → account data merge
  - **Fixed:** `POST /quran/import-local` for bookmarks + last-read

### Keep Public (skipAuth) — ✅ Done

- [x] Quran surahs / juz / pages / full-catalog
- [x] Adhkar home + categories
- [x] Qibla calculate
- [x] Auth routes (login / sign-up / Google / forgot / reset / refresh)

---

## 13) Auth Header & Guest Rules — ✅ Implemented

| Caller | Behavior | Status |
|--------|----------|--------|
| Signed-in | `Authorization: Bearer <accessToken>` | ✅ |
| Guest | No Bearer; public routes only | ✅ |
| After login | Server state + optional guest merge | ✅ |

---

## 14) Field Glossary — ✅ All Fields Present

| Field | Type | Always Present | Notes |
|-------|------|----------------|-------|
| `surahId` | int 1..114 | ✅ | Numeric id |
| `nameAr` / `surahNameAr` | string | ✅ | **Real Arabic name** |
| `nameEn` | string | ✅ | English name |
| `ayahNumber` | int | ✅ | On bookmarks / last-read |
| `page` | int 1..604 | ✅ | Mushaf page |
| `juz` | int 1..30 | ✅ | Included on ayahs |
| `textAr` | string | ✅ | BOM-free, Bismillah rules applied |
| `revelationType` | `MAKKI` \| `MADANI` | ✅ | On all surahs |
| `repeatCount` | int | ✅ | Adhkar items |
| `markedItemId` | string | ✅ | Adhkar resume |
| `accessToken` | string | ✅ | Nested under `tokens` |
| `refreshToken` | string | ✅ | Nested under `tokens` |

---

## 🆕 New Features Added (Not in Original Contract)

### 1. Adhkar Favorites

Three new endpoints for saving favorite adhkar:

- `GET /adhkar/favorites` — List favorites
- `POST /adhkar/favorites` — Add to favorites
- `DELETE /adhkar/favorites/:id` — Remove from favorites

**Database schema:**
- Table: `adhkar_favorites`
- Unique constraint: `userId` + `itemId` (no duplicates)
- Relations: User ↔ AdhkarFavorite ↔ DhikrItem

### 2. Guest Data Merge

- `POST /quran/import-local` — Merge guest bookmarks + last-read after login
- Idempotent (won't create duplicate bookmarks)

### 3. Bookmark Notes

- `PATCH /quran/bookmarks/:id` — Update bookmark note
- Support for personal notes on favorite ayahs

---

## 📊 Testing & Verification

### Production URL
```
https://noor-app-backend-one.vercel.app/api/v1
```

### API Documentation
```
https://noor-app-backend-one.vercel.app/api/v1/docs
```

**Swagger UI includes all endpoints with:**
- Request/response examples
- Authentication requirements
- Full OpenAPI 3.0 schema

### Tested in Production

All endpoints tested with:
- ✅ Public routes (guest access)
- ✅ Authenticated routes (Bearer token)
- ✅ Error handling (401, 404, 409, 500)
- ✅ Data validation
- ✅ Surah name verification across all surfaces

---

## 🎯 Flutter Integration Notes

### What Flutter Can Use Immediately

1. **All Quran endpoints** — Browse, pages, bookmarks, last-read, khatmah
2. **All Adhkar endpoints** — Categories, progress, **favorites** (NEW)
3. **Complete Auth flow** — Sign-up, login, Google OAuth, refresh, logout
4. **Dashboard** — All sections populated
5. **Journey tracking** — Today, progress, quran/adhkar/sadaqah updates
6. **Tasbih** — Counter with daily goal tracking
7. **Qibla** — Direction calculation
8. **Notifications** — Full CRUD operations
9. **Profile** — Get, update, change password, location

### Guest → User Migration

When guest converts to account:
1. User signs up / logs in
2. Flutter calls `POST /quran/import-local` with:
   - Guest bookmarks array
   - Guest last-read object
3. Backend merges data into authenticated account
4. Flutter clears local guest data

### Adhkar Favorites Flow

1. User views category (e.g., `/adhkar/categories/MORNING`)
2. Taps "favorite" icon on any dhikr
3. Flutter calls `POST /adhkar/favorites` with `itemId`
4. Backend returns full favorite object with dhikr details
5. To view all favorites: `GET /adhkar/favorites`
6. To remove: `DELETE /adhkar/favorites/:favoriteId`

### Error Handling

- **401 + INVALID_TOKEN** → Clear session, redirect to login
- **Other 401** → Try refresh token once, then retry original request
- **Network errors on /auth/me** → Keep tokens, retry later
- **404 on bookmarks/favorites** → Show "Not found" message
- **409 on favorites** → Show "Already favorited" message

---

## 📝 Summary for Flutter Team

**Status:** ✅ **All requested features implemented and live in production**

**New additions:**
- 🆕 Adhkar Favorites (3 new endpoints)
- 🆕 Guest data merge endpoint
- 🆕 Bookmark notes support

**Critical fixes applied:**
- ✅ All surah names verified (never numeric ids)
- ✅ Prayer times in 24h format
- ✅ Progress endpoints include all fields
- ✅ HTTP Range support on catalog
- ✅ Error codes match Flutter expectations

**Ready for integration:** All endpoints tested and documented in Swagger UI.

**Next steps for Flutter:**
1. Update API client to use production URL
2. Implement adhkar favorites UI (save/list/remove)
3. Add guest data merge on login/signup
4. Test error handling flows (401, refresh token)
5. Verify surah names display correctly across all screens

---

**Questions or issues?** Contact backend team or check Swagger docs at:  
`https://noor-app-backend-one.vercel.app/api/v1/docs`

---

*End of Backend Implementation Status — Updated 2026-08-28*
