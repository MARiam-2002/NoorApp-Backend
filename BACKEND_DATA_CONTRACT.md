# Backend Data Contract — Verified Production

**Audience:** Flutter team  
**App:** Noor Flutter (`lib/`)  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-04  
**Source:** Backend Production-verified reply (2026-09-04)

This document is the **verified** Backend → Flutter contract. Backend required APIs from the four docs are **implemented and Production-verified**. Flutter owns remaining client work (especially Local Azan + FCM client).

Stable wire shapes for already-live routes also: [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md). Azan product: [AZAN_FEATURE.md](./AZAN_FEATURE.md). Product backlog: [APP_ENHANCEMENTS.md](./APP_ENHANCEMENTS.md).

---

## Status snapshot

| Area | Status |
|------|--------|
| Core API (auth, dashboard, journey, Quran, Adhkar, challenges, tasbih, qibla, profile, notifications) | Production-verified |
| Quran catalogs + audio/tafsir/translation (distinct `resourceId`s) | Production-verified |
| Prayer schedule (public + auth) | Production-verified |
| Azan preferences sync | Production-verified |
| FCM device-token API | Production-verified (endpoints live) |
| FCM send capability | **Ops pending:** Firebase credentials on Vercel (`health.fcm.configured` may be `false`) |
| Password-reset SMTP | Configured — confirm one real inbox delivery |

---

## Flutter deliverables status (gap matrix)

| # | Deliverable | Flutter status |
|---|-------------|----------------|
| 1 | Auth + guest vs Production | Done |
| 2 | Home dashboard + prayer countdown | Done (+ prayer-times screen) |
| 3 | Quran browse/offline/reader + audio/tafsir/translation | Done (content APIs wired) |
| 4 | Journey + badges + patches | Partial — patches wired; badges CTA still Coming soon |
| 5 | Adhkar + favorites + progress | Done |
| 6 | Challenges tab + claim | Done |
| 7 | Tasbih + Qibla | Done (`my-qibla` + `dhikrEn`) |
| 8 | Notifications bell | Done |
| 9 | Profile + reading prefs + location | Done (`quranAutoScroll` wire key) |
| 10 | Local Azan v1 (offline alarms) | Done |
| 11 | Azan prefs sync + FCM token registration | Done (send needs backend Firebase env) |
| 12 | EN/AR localization for shipped screens | Partial — key EN fields wired |
| 13 | Real-device QA + release builds | See [RELEASE_QA_CHECKLIST.md](./RELEASE_QA_CHECKLIST.md) |

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

`GET /health` (public) — includes `email`, `quranFoundation`, `fcm.configured`.

---

## 2) Authentication (public)

| Method | Path | Body |
|--------|------|------|
| POST | `/auth/sign-up` | `{ fullName, email, password, username? }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/google` | `{ idToken }` from **google_sign_in** |
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
| PATCH | `/journey/prayer` | `{ "prayer": "Asr", "completed": true }` |
| PATCH | `/journey/adhkar` | `{ "categoryKey": "GENERAL_WIRD", "completed": true }` |
| PATCH | `/journey/sadaqah` | `{ "amount": 10 }` |
| POST | `/journey/quran-pages/increment` | `{ "pages": 1 }` |

---

## 5) Quran

### Catalogs (public) — use these `id`s

**Reciters:** Mishary_Alafasy(7), Abdul_Basit(2), Mahmoud_Al_Husary(6), Abdurrahman_As_Sudais(3), Saud_Ash_Shuraym(10), Muhammad_Siddiq_Al_Minshawi(9), Minshawi_Mujawwad(8)

**Tafsirs:** Ibn_Kathir(14), Al_Tabari(15), Al_Qurtubi(90), Ibn_Kathir_Muyassar(16), Al_Baghawi(94), Al_Saadi(91), Ibn_Kathir_En(169)

**Translations:** Sahih_International(20), Yusuf_Ali(22), Pickthall(19), French_Hamidullah(31), Turkish_Diyanet(77), Malay_Basmeih(39), Indonesian_Depag(33)

### Content (public)

| Method | Path | Query aliases |
|--------|------|---------------|
| GET | `/quran/audio` | `reciter` **or** `reciterId` **or** `id` + `surahId` + `ayahNumber` |
| GET | `/quran/tafsir` | `source` **or** `tafsirId` **or** `id` |
| GET | `/quran/translation` | `source` **or** `translationId` **or** `id` |

Auth Quran: bookmarks (+ note PATCH), last-read, khatmah (+ reset), reading-history, `POST /quran/import-local`.

Reading preferences include `quranAutoScroll` (Flutter may also accept legacy `quranAutoScrollEnabled`).

Bismillah/BOM hygiene is server-side — Flutter must **not** re-strip.

---

## 6) Adhkar

| Method | Path | Auth |
|--------|------|------|
| GET | `/adhkar` | Public (+ personalized when Bearer) |
| GET | `/adhkar/progress?categoryKey=` | Auth |
| PUT | `/adhkar/progress` | Auth |
| GET/POST/DELETE | `/adhkar/favorites` | Auth |
| GET | `/adhkar/search?q=` | Public |

---

## 7) Challenges / Tasbih / Qibla / Notifications / Profile

| Area | Endpoints |
|------|-----------|
| Challenges | `GET /challenges`, `/today`, `/:id`, `POST /:id/claim`, `POST /today/claim` |
| Tasbih | `GET /tasbih/today`, increment/reset/change-dhikr |
| Qibla | `GET /qibla/calculate` public; `GET /qibla/my-qibla` auth after `PUT /profile/location` |
| Notifications | list, unread-count, read, read-all |
| Profile | me, update, change-password, location, reading-preferences + `quranAutoScroll` |

---

## 8) Prayer / Azan (backend)

| Method | Path | Auth |
|--------|------|------|
| GET | `/prayers/schedule?lat=&lng=&method=&madhab=` | Public |
| GET | `/prayers/today?lat=&lng=&method=&madhab=` | Public with coords; auth optional |
| GET | `/prayers/today` | Auth (saved location) |
| PATCH | `/prayers/:id/mark` | Auth |
| GET/PATCH | `/profile/azan-preferences` | Auth |

Methods: `EGYPT` (default), `MWL`, `MAKKAH`, `KARACHI`, `ISNA`, `TEHRAN`. Madhab: `SHAFI` / `HANAFI`.

**Alarm source of truth:** Flutter local Adhan engine. Backend schedule is UI sync / cross-check / FCM backup.

Azan preferences shape:

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
| GET/POST | `/cron/prayer-reminders` | protected (ops) |

Until Firebase env is set: register/unregister still work; send returns `sent:0`.

---

## 10) Ownership

| Feature | Backend | Flutter |
|---------|---------|---------|
| Auth / JWT / dashboard / journey / notifications | Owns | UI + token storage |
| Quran content + catalogs + audio URLs | Owns | Reader + player |
| Prayer schedule API | Owns | Display + optional sync |
| Azan preferences sync API | Owns | Settings UI + local cache |
| FCM token storage + send | Owns (needs Firebase env) | Token registration + handlers |
| Local Azan alarms/sound/permissions | — | **Owns** |
| Offline Azan | — | **Owns** |

---

## Remaining backend ops (not Flutter)

| Item | Notes |
|------|-------|
| Set Firebase credentials on Vercel | `health.fcm.configured` → true |
| External scheduler → `/cron/prayer-reminders` | ~every 10 minutes |
| Confirm password-reset inbox delivery | SMTP ready; one mailbox QA |

---

## Recommended API call order

### Guest

1. Local Adhan / optional `GET /prayers/today?lat&lng&method&madhab`  
2. Public Quran / Adhkar / Qibla calculate  
3. Auth when ready  

### After login

1. `PUT /profile/location`  
2. `GET/PATCH /profile/azan-preferences`  
3. `POST /devices/fcm-token` (after Messaging permission)  
4. `GET /dashboard`  
5. Journey / notifications / challenges / tasbih in parallel  
6. Once: `POST /quran/import-local`  
7. Reader: catalogs → audio/tafsir/translation with catalog `id`  

### Page progress order

1. Journey quran increment → 2) khatmah progress → 3) last-read  
