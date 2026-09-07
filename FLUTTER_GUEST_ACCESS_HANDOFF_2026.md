# Flutter Guest Access Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-07  
**Language:** English only  

**Backend status:** Guest access for core religious content (Quran, Adhkar, Prayer, public Azan catalogs) is **implemented and Production-verified**. Personal / cloud-sync features correctly require authentication.

**This repository:** Backend only. There is **no Flutter app source** here. This handoff tells Flutter how to wire Guest vs Login against the **live** API.

---

## 1. Goal

Noor Guest mode must **not** feel like a crippled app.

| Guest CAN (no login) | Guest must login for |
|----------------------|----------------------|
| Read Quran (surahs, ayahs, juz, pages) | Cloud bookmarks / favorites |
| Listen to Quran recitation | Cloud last-read / reading history |
| Use translations & tafsir | Khatmah / streak sync |
| Search Quran | Journey / dashboard / challenges progress |
| All public Adhkar catalogs | Cloud Adhkar favorites & progress |
| Public tasbih **catalog** (dhikr list) | Cloud tasbih **session** sync (`/tasbih/*`) |
| Prayer times (Cairo default or GPS query) | Prayer completion marks |
| Azan sound catalogs + guest defaults | Sync Azan prefs to profile (`PATCH`) |
| Qibla calculate from coords | Saved “my qibla” from profile location |

**Quran Foundation credentials stay on the Backend.** Flutter never receives QF client secrets.

---

## 2. Auth model (Backend)

| Middleware | Behavior |
|------------|----------|
| *(none)* | Fully public |
| `optionalAuthenticate` | No / invalid Bearer → continue as guest; valid Bearer → `req.user` set |
| `authenticate` | Missing / invalid Bearer → **401** `Authentication required` |

### Headers

```http
Accept: application/json
Authorization: Bearer <accessToken>   # only when logged in
Content-Type: application/json        # for JSON bodies
```

### Success envelope

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

### Error envelope (401 example)

```json
{
  "success": false,
  "message": "Authentication required",
  "code": "UNAUTHORIZED",
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Flutter 401 policy (required)

- **401 on personal routes** → show a **friendly login/signup** sheet (one-shot, not a loop).
- **Never** treat Quran / Adhkar / prayer / azan-catalog **200** responses as “must login”.
- **Do not** globally redirect every 401 to a blocking full-screen login that traps the user out of reading.
- Prefer: soft prompt → Continue as Guest | Login | Sign up.

---

## 3. Guest features now accessible (Production-verified)

All of the following return **HTTP 200 without** `Authorization` on Production (`2026-09-07`):

### 3.1 Quran (public)

| # | Feature | Method | Path | Auth |
|---|---------|--------|------|------|
| 1 | List surahs | GET | `/quran/surahs` | none |
| 2 | Surah detail | GET | `/quran/surahs/:surahId` | none |
| 3 | Surah ayahs | GET | `/quran/surahs/:surahId/ayahs` | none |
| 4 | Juz list | GET | `/quran/juz` | none |
| 5 | Juz surahs | GET | `/quran/juz/:juzNumber/surahs` | none |
| 6 | Juz ayahs | GET | `/quran/juz/:juzNumber/ayahs` | none |
| 7 | Page | GET | `/quran/pages/:pageNumber` | none |
| 8 | Search | GET | `/quran/search?q=...` | none |
| 9 | Random ayah | GET | `/quran/ayahs/random` | none |
| 10 | Reciters | GET | `/quran/reciters` | none |
| 11 | Translations list | GET | `/quran/translations` | none |
| 12 | Tafsirs list | GET | `/quran/tafsirs` | none |
| 13 | Ayah audio URL | GET | `/quran/audio` | none |
| 14 | Ayah translation | GET | `/quran/translation` | none |
| 15 | Ayah tafsir | GET | `/quran/tafsir` | none |
| 16 | Static meta / full catalog | GET | `/quran/static-meta`, `/quran/full-catalog` | none |

#### Audio query (verified)

```http
GET /api/v1/quran/audio?surahId=1&ayahNumber=1&reciterId=Mishary_Alafasy
```

Required: `surahId`, `ayahNumber`.  
Optional reciter: `reciter` | `reciterId` | `id` (catalog string id, e.g. `Mishary_Alafasy`).

Response `data` includes an audio URL for Flutter to play (Backend builds it; QF secrets stay server-side).

#### Translation / tafsir query (verified)

```http
GET /api/v1/quran/translation?surahId=1&ayahNumber=1
GET /api/v1/quran/translation?surahId=1&ayahNumber=1&translationId=Sahih_International

GET /api/v1/quran/tafsir?surahId=1&ayahNumber=1
GET /api/v1/quran/tafsir?surahId=1&ayahNumber=1&tafsirId=Ibn_Kathir
```

#### Search query (verified)

```http
GET /api/v1/quran/search?q=بسم
```

Required query param name: **`q`** (not `query`).  
URL-encode non-ASCII. Optional: `page`, `limit`.

#### Hizb navigation

**NOT IMPLEMENTED** on Backend — no `/quran/hizb*` routes. Juz / page / surah navigation are available.

---

### 3.2 Adhkar (public content)

| Feature | Method | Path | Auth |
|---------|--------|------|------|
| Home (categories + daily wird) | GET | `/adhkar/` | optional |
| Categories list | GET | `/adhkar/categories` | none |
| Category by key | GET | `/adhkar/categories/:key` | optional |
| Daily wird | GET | `/adhkar/daily-wird` | optional |
| Search | GET | `/adhkar/search` | none |
| Full catalog (offline pack) | GET | `/adhkar/full-catalog` | none |
| Static meta | GET | `/adhkar/static-meta` | none |

#### Verified category keys (use these)

| Key | Meaning |
|-----|---------|
| `MORNING` | Morning Adhkar |
| `EVENING` | Evening Adhkar |
| `BEFORE_SLEEP` | Before sleep |
| `AFTER_PRAYER` | After prayer |
| `ENTERING_MOSQUE` | Entering mosque |
| `GENERAL_WIRD` | Daily wird |
| `TRAVEL` | Travel |
| `SICK` | Sick / ruqyah |
| `FOOD` | Food & drink |
| `ISTIKHARA` | Istikhara |
| `WUDU` | Wudu |
| `ISTIGHFAR` | Istighfar |
| `QAYN` | Counter tasbih wird |
| `MASJID_AFTER_SALAM` | After final salam |

Keys are case-insensitive on Production (`morning` and `MORNING` both work).

#### Wake-up Adhkar

**NOT IMPLEMENTED** as a dedicated category key (no `WAKE_UP` / `AFTER_WAKE`). Use existing public categories above.

#### Guest vs logged-in on optional routes

- **Guest:** full public texts; daily wird progress is **cosmetic** (not persisted server-side).
- **Logged-in (Bearer):** personalized progress / resume enrichment where implemented.

---

### 3.3 Dhikr counter

| Feature | Method | Path | Auth | Guest guidance |
|---------|--------|------|------|----------------|
| Public tasbih catalog | GET | `/tasbihs/` | optional | Use for picker UI |
| Today session / increment / reset | `/tasbih/*` | authenticate | **401** without login |

**Flutter:** keep Guest counter state **locally** (SharedPreferences / local DB).  
Do **not** call `/tasbih/today` or `/tasbih/increment` until logged in (or show soft login when user wants cloud sync).

---

### 3.4 Prayer (public)

| Feature | Method | Path | Auth |
|---------|--------|------|------|
| Today + next prayer | GET | `/prayers/today` | optional |
| Schedule | GET | `/prayers/schedule` | none |
| Mark prayer done | PATCH | `/prayers/:id/mark` | **required** |

#### Guest / no GPS (verified)

```http
GET /api/v1/prayers/today
```

Returns Cairo defaults, including:

- `isDefaultLocation: true`
- `locationSource: "default_cairo"`
- `city: "Cairo"`
- `nextPrayer` object (`name`, `key`, `time`, `displayAr`, `displayEn`, …)
- full `schedule`

#### Device GPS (guest or logged-in)

```http
GET /api/v1/prayers/today?latitude=30.05&longitude=31.24&timezone=Africa/Cairo
```

Aliases: `lat` / `lng`. Optional: `method`, `madhab`.

Priority: **query coords > profile (if Bearer) > Cairo**.

Details: see `FLUTTER_CAIRO_DEFAULT_PRAYER_AZAN_HANDOFF_2026.md`.

---

### 3.5 Azan (public catalogs + guest defaults)

| Feature | Method | Path | Auth |
|---------|--------|------|------|
| Azan voices | GET | `/azan/sounds` | none |
| Notification tones | GET | `/azan/notification-sounds` | none |
| Audio defaults | GET | `/azan/audio-defaults` | none |
| Media stream | GET | `/azan/media/:file` | none |
| Prefs (guest defaults) | GET | `/profile/azan-preferences` | optional |
| Prefs sync | PATCH | `/profile/azan-preferences` | **required** |

Guest `GET /profile/azan-preferences` returns defaults and indicates guest defaults (e.g. `isGuestDefaults: true` on the response path used for guests).

**Flutter:** store Guest Azan / notification selection **locally**; sync with `PATCH` only after login.

Do **not** hard-code media URLs — use `audioUrl` / `previewUrl` from the API.

---

### 3.6 Other public content

| Feature | Method | Path | Auth |
|---------|--------|------|------|
| Verse of day | GET | `/content/verse-of-day` | none |
| Hadith of day | GET | `/content/hadith-of-day` | none |
| Daily challenge **template** | GET | `/content/daily-challenge` | none |
| Qibla from coords | GET | `/qibla/calculate` | none |

Personalized challenge claim / journey / notifications remain auth-only.

---

## 4. Features that correctly require login

Expect **401** without Bearer (Production-verified):

| Area | Examples |
|------|----------|
| Quran sync | `GET/POST/PATCH/DELETE /quran/bookmarks`, `GET/PUT /quran/last-read`, `GET/POST /quran/reading-history`, `GET/PATCH/POST /quran/khatmah*`, `POST /quran/import-local` |
| Adhkar sync | `GET/PUT /adhkar/progress`, `GET/POST/DELETE /adhkar/favorites*`, `PUT /adhkar/resume-mark` |
| Tasbih session | All `/tasbih/*` |
| Profile | `GET /profile/me`, update, password, location, reading prefs, salawat prefs |
| Azan sync | `PATCH /profile/azan-preferences` |
| Prayer marks | `PATCH /prayers/:id/mark` |
| Journey / streak | `/journey/*` |
| Dashboard | `GET /dashboard/` |
| Challenges progress | `/challenges/*` |
| Notifications inbox | `/notifications/*` |
| FCM devices | `/devices/*` |
| Saved qibla | `GET /qibla/my-qibla` |
| Auth me | `GET /auth/me` |

---

## 5. Incorrect login gates removed

**Backend audit result:** **0** incorrectly protected public religious endpoints.

No Backend auth middleware was removed or changed for this Guest policy pass — public routes were already open; personal routes already required auth.

If Flutter still shows a login wall for Quran / Adhkar / prayer, that is a **Flutter navigation / interceptor** issue, not a Backend 401 on those public routes.

---

## 6. Backend changes (this Guest policy pass)

| Change | Status |
|--------|--------|
| New endpoints | **None** |
| Auth middleware changes | **None** (already correct) |
| Prayer calculation / Cairo defaults | **Unchanged** |
| Azan sounds / notifications | **Unchanged** |
| Quran audio sources / QF secrets | **Unchanged** (server-side only) |

---

## 7. Flutter changes (required on the app side)

This Backend repo cannot patch Flutter. Implement on the client:

1. **Guest home / tabs** open Quran, Adhkar, Prayer, Azan settings **without** forcing auth.
2. Call public endpoints **without** `Authorization`.
3. Keep local Guest state:
   - last read position  
   - local bookmarks / favorites  
   - local reading progress  
   - local dhikr counter  
   - local Azan / notification preference ids  
4. Soft-prompt login only for cloud sync actions.
5. After first login, merge Guest Quran bags via:

```http
POST /api/v1/quran/import-local
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "bookmarks": [
    { "surahId": 2, "ayahNumber": 255, "page": 42, "note": "optional" }
  ],
  "lastRead": { "surahId": 18, "page": 293, "ayahNumber": 1 }
}
```

`bookmarks` / `lastRead` may be omitted or `null` (treated as empty).

6. Never embed or log Quran Foundation client secrets.

---

## 8. Screen / feature mapping

| Flutter screen / action | Backend call | Guest OK? |
|-------------------------|--------------|-----------|
| Quran library | `GET /quran/surahs` | Yes |
| Surah reader | `GET /quran/surahs/:id/ayahs` | Yes |
| Play ayah | `GET /quran/audio?...` | Yes |
| Translation panel | `GET /quran/translation?...` | Yes |
| Tafsir panel | `GET /quran/tafsir?...` | Yes |
| Quran search | `GET /quran/search?q=` | Yes |
| Juz browser | `GET /quran/juz*` | Yes |
| Cloud bookmark | `/quran/bookmarks*` | Login |
| Cloud last-read | `/quran/last-read` | Login |
| Adhkar home | `GET /adhkar/` | Yes |
| Morning / Evening / Sleep… | `GET /adhkar/categories/:key` | Yes |
| Adhkar favorites sync | `/adhkar/favorites*` | Login |
| Dhikr picker list | `GET /tasbihs/` | Yes |
| Dhikr cloud session | `/tasbih/*` | Login (use local for Guest) |
| Prayer today / next | `GET /prayers/today` | Yes |
| Mark prayer | `PATCH /prayers/:id/mark` | Login |
| Azan voice list | `GET /azan/sounds` | Yes |
| Azan guest defaults | `GET /profile/azan-preferences` | Yes |
| Save Azan prefs to account | `PATCH /profile/azan-preferences` | Login |
| Profile / Journey / Streak | `/profile/me`, `/journey/*` | Login |

---

## 9. Local storage guidance (Flutter)

Suggested local-only keys (Flutter-owned; **not** Backend schema):

| Data | Suggested approach |
|------|--------------------|
| Last read | Local store; sync via `PUT /quran/last-read` + `POST /quran/import-local` after login |
| Bookmarks | Local store; sync via bookmarks APIs / import-local |
| Dhikr counts | Local store until `/tasbih/*` used after login |
| Azan sound id | Local store; `PATCH /profile/azan-preferences` after login |
| Prayer location | Query GPS on `/prayers/today`; Cairo if none |

Exact SharedPreferences key names: **UNKNOWN** in Backend (Flutter decides).

---

## 10. Guest → Login behavior

```text
Guest using public APIs (no Bearer)
  → full Quran / Adhkar / Prayer / Azan catalogs

Guest taps “Save to cloud” / Favorites sync / Streak / Profile
  → Flutter shows soft login/signup
  → after tokens issued:
       POST /quran/import-local  (optional merge)
       then use authenticated APIs
```

Do **not** interrupt an active ayah playback or Adhkar reading with a forced login unless the user explicitly chose a sync action.

---

## 11. Testing requirements

### 11.1 Guest acceptance (Backend Production — verified 2026-09-07)

| Step | Result |
|------|--------|
| Open app without login (public APIs) | OK |
| Open Quran surahs | **PASS** 200 |
| Open Surah 1 | **PASS** 200 |
| Open ayahs | **PASS** 200 |
| Play recitation (`/quran/audio`) | **PASS** 200 |
| Translation | **PASS** 200 |
| Tafsir | **PASS** 200 |
| Search (`q=بسم`) | **PASS** 200 (matches returned) |
| Adhkar home | **PASS** 200 |
| Morning (`/adhkar/categories/morning`) | **PASS** 200 |
| Evening | **PASS** 200 |
| Before sleep (`BEFORE_SLEEP`) | **PASS** 200 |
| Dhikr catalog (`/tasbihs/`) | **PASS** 200 |
| Prayer today + `nextPrayer` | **PASS** 200 (Cairo default) |
| Azan sounds / defaults / guest prefs GET | **PASS** 200 |
| No 401 on any of the above | **PASS** |

### 11.2 Auth still required (verified)

Without Bearer, these returned **401**: bookmarks, last-read, adhkar favorites, adhkar progress, `/tasbih/today`, `/profile/me`, `/journey/today`, `PATCH /profile/azan-preferences`.

### 11.3 Flutter QA checklist

- [ ] Cold start as Guest → land on Home **without** login wall  
- [ ] Complete Guest acceptance steps 1–16 in the product UI  
- [ ] Confirm no repeated login sheets while browsing Quran/Adhkar  
- [ ] Soft login only on sync actions  
- [ ] After login, import-local + cloud features work  
- [ ] Authenticated user still gets 401-gated personal APIs only when token missing/expired  

---

## 12. Known limitations

| Item | Status |
|------|--------|
| Hizb routes | **NOT IMPLEMENTED** |
| Dedicated wake-up Adhkar category | **NOT IMPLEMENTED** |
| Guest cloud dhikr session | Intentionally auth-only; use local counter |
| Guest challenge **progress/claim** | Auth-only; public template via `/content/daily-challenge` |
| Flutter navigation guards | **UNKNOWN** in this repo — must be audited in the Flutter project |
| Exact local storage key names | **UNKNOWN** (Flutter-owned) |

---

## 13. Related handoffs

- `FLUTTER_CAIRO_DEFAULT_PRAYER_AZAN_HANDOFF_2026.md` — Cairo prayer + Azan catalogs  
- `FLUTTER_ADHKAR_INTEGRATION_GUIDE.md` — Adhkar deep contract  
- `FLUTTER_BACKEND_READY_HANDOFF.md` — general Production contract  

---

## 14. Production deployment status

| Item | Status |
|------|--------|
| Production API | `https://noor-app-backend-one.vercel.app/api/v1` |
| Guest public religious APIs | **Live / verified** |
| Personal sync APIs | **Live / 401 without token** |
| Extra deploy for Guest policy | **Not required** (no Backend gate fixes needed) |

---

## FLUTTER HANDOFF STATUS: READY

Backend Guest policy for core religious content is implemented, documented, and Production-verified. Flutter must call public routes without auth and reserve login prompts for personal/sync features only.
