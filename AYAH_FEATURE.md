# Noor App — Ayah Feature (Backend Contract for Flutter)

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`  
**Updated:** 2026-09-17 — Session-based behavior confirmed and documented  
**Language:** English only

> **📋 Implementation Note:** This feature has always been session-based (per app open/cold start), NOT per calendar day. The backend uses `UNIQUE(userId, sessionId)` where `sessionId` = the `X-Noor-App-Open-Id` header Flutter sends. Same header value = same Ayah + zero duplicate history rows. Different header value (next app restart) = new Ayah can be selected.

This document is the **actual implemented** Backend → Flutter contract for the new **Ayah** feature. It describes only what the backend currently exposes. Do **not** invent client behavior from older OpenAPI samples if they conflict with this file — **this file wins**.

Related contracts:
- Full app envelope & auth rules: `FLUTTER_DATA_CONTRACT_REPLY.md`
- Existing Quran reader entry-points: `QURAN_OFFLINE_INTEGRATION_GUIDE.md`
- Existing Verse of Day (**separate parallel feature — do NOT delete it**): `GET /content/verse-of-day` (unchanged).

---

## 0) Envelope & Auth

### Success

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {},
  "timestamp": "2026-09-17T12:00:00.000Z",
  "requestId": "uuid"
}
```

- `meta` is **always a JSON object** — never `null`. For non-paginated endpoints it is `{}`.
- All datetimes use ISO-8601 UTC.

### Error

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | INVALID_TOKEN | VALIDATION_ERROR | NOT_FOUND | INTERNAL_SERVER_ERROR | …",
  "details": {},
  "timestamp": "2026-09-17T12:00:00.000Z",
  "requestId": "uuid"
}
```

### Auth (Ayah feature)

| Endpoint | Auth |
|----------|------|
| `GET /ayah` | **Bearer required** + `X-Noor-App-Open-Id` header required (§1). |
| `GET /ayah/history` | **Bearer required** only (no session header needed; history is user-scoped). |

Always send:

```http
Authorization: Bearer <accessToken>
```

| Condition | Flutter action |
|-----------|----------------|
| `401` + `INVALID_TOKEN` | Clear session |
| `401` + `TOKEN_EXPIRED` | `POST /auth/refresh` once, then retry |
| Network / 5xx | **Do not hard-logout.** Render last cached Ayah (§7). |
| `400` + `VALIDATION_ERROR` + `details` mentions `X-Noor-App-Open-Id` | **Header bug in Flutter.** Generate/send the required UUID (§1). |

---

## 1. Feature Overview

The **Ayah feature** displays a Quran Ayah on the **Home screen** that the user can later revisit in **Ayah History**, and whose payload is also safe to reuse for a future **Lock Screen** or **Home Screen Widget**.

Key properties (corrected per 2026-09-17):
- Each **real Flutter app open / cold start / process launch** the user gets **one Ayah** that stays stable the **entire session** (even if Home rebuilds 100 times, retries fire, widgets refresh, the user navigates away and back — the Ayah never changes within that open, and exactly **0 duplicate history rows** are created for the session beyond the first call).
- Next **real app open / cold start** (user kills app / process dies + reopens) → Flutter sends a NEW session identifier → backend **can** select a new Ayah for this user + previous open's Ayah **remains permanently** in the user's history, in newest-first order.
- Best-effort anti-repeat: backend re-rolls up to 3 times if the newly selected Ayah for a session would equal the user's **immediately preceding** open session Ayah (prevents "two consecutive opens show exactly the same Ayah" UX). Same Ayah CAN still legitimately appear again weeks/months later — this is allowed and does not indicate a bug.
- Every returned Ayah references the **existing Quran source of truth** (`surahId`, `ayahNumber`, `juz`, `page`, canonical `ayahs.id`, `textAr`, resolved Surah names). Flutter navigates from the payload directly into the existing Quran reader at the exact page → juz → surah → ayah.
- This feature is **completely separate** from the existing `GET /content/verse-of-day`. That Verse of Day endpoint remains **100% unchanged**. Do not remove or replace it.

---

## 2. API Endpoints

### 2.1 `GET /ayah` — Ayah of the CURRENT Flutter app open / session (Home / Lock / Widget)

Returns **one stable Ayah** for the current (Flutter-identified) app open / session.

Flutter generates a **new RFC-4122 v4 UUID exactly once per real cold app open / process start**, stores it in memory for the process lifetime, and sends the same identical string on **every** `GET /api/v1/ayah` call during that open (Home rebuilds, retries, navigation re-enters Home, periodic widget refresh, lock-screen display refresh — ALL reuse the same header).

#### Request

```http
GET /api/v1/ayah
Authorization: Bearer <accessToken>
X-Noor-App-Open-Id: <flutter-generated-uuid-v4>
```

**No query parameters.**

##### Request contract — field-by-field

| Location | Name | Required? | Type | Meaning & Flutter side |
|----------|------|-----------|------|------------------------|
| Header | `Authorization` | ✅ Required | `Bearer <JWT>` | Existing access token (not changed). |
| Header | `X-Noor-App-Open-Id` | ✅ Required | **String RFC-4122 UUID v4** | Flutter: `final openId = uuid.v4()` once per cold start / process launch. Store as **process-lifetime singleton** (memory only — no need to persist). Flutter implementation rules: <br>✅ Generate once in `main()` after `WidgetsFlutterBinding.ensureInitialized()`. <br>✅ Reuse the same string for every Home build / retry / deeplink / widget build inside that Dart process. <br>❌ Never regenerate on route navigation, Hot Reload, Home rebuilds, setState, or network retries. <br>❌ Never persist to disk and re-use on the *next* cold start (that would prevent new Ayah selection per open). <br>HTTP header names are case-insensitive per RFC 7230. Both `X-Noor-App-Open-Id` and `x-noor-app-open-id` are accepted; use Pascal-Kebab casing for clarity in Dart code. Header name validated by zod as UUID → missing / empty / non-uuid returns `400 VALIDATION_ERROR`. |

#### Response example

```json
{
  "success": true,
  "message": "Ayah retrieved successfully",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "surahId": 2,
    "ayahNumber": 255,
    "textAr": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ",
    "page": 42,
    "juz": 3,
    "surahNameAr": "البقرة",
    "surahNameEn": "Al-Baqarah",
    "surah": {
      "id": 2,
      "nameAr": "البقرة",
      "nameEn": "Al-Baqarah",
      "revelationType": "MADANI"
    },
    "historyId": "9988abcd-1234-5678-0000-abcdef123456",
    "sessionId": "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
    "displayDate": "2026-09-17",
    "isNew": true
  },
  "meta": {},
  "timestamp": "2026-09-17T12:00:00.000Z",
  "requestId": "feed-face-cafe-0000-1234567890ab"
}
```

##### Error behavior

| Status | `code` | When | Flutter action |
|--------|--------|------|----------------|
| `400` | `VALIDATION_ERROR` | Missing or invalid `X-Noor-App-Open-Id` header (not a valid RFC-4122 uuid). `details` array from zod names the exact field & issue. | Fix client UUID generation. Do NOT retry with the same invalid value — it will never succeed. |
| `401` | `UNAUTHORIZED` | No Bearer token. | Show login / refresh flow. |
| `401` | `INVALID_TOKEN` | Token invalid / user not active. | Clear session |
| `404` | `NOT_FOUND` | The referenced `ayahs.(surahId,ayahNumber)` row is missing in the Quran DB (should not happen on seeded DB — this indicates a seed issue). | Show generic error UI; do **not** cache 404 as an ayah. |
| `500` | `INTERNAL_SERVER_ERROR` | DB failure / transient backend issue. | Use last cached Ayah (§7). Queue retry with exponential backoff. Do **not** hard logout. |

---

### 2.2 `GET /ayah/history` — Paginated Ayah history across ALL previous opens/sessions

Returns all Ayahs previously displayed to the user (current session + older sessions), **ordered newest-first** = most recent `createdAt` at the top. Use for the "Ayah History" screen where the user can browse past Ayahs and tap any row to jump back into the Quran reader.

#### Request

```http
GET /api/v1/ayah/history?page=1&limit=20
Authorization: Bearer <accessToken>
```

**`X-Noor-App-Open-Id` header is NOT used on history** (history is per-user, not per-session; do not send it).

Query parameters (all optional):

| Param | Type | Default | Range | Meaning |
|-------|------|---------|-------|---------|
| `page` | int | `1` | ≥ 1 | Page number |
| `limit` | int | `20` | 1..100 | Items per page, server-side hard-capped at 100 via zod. |

#### Response example

```json
{
  "success": true,
  "message": "Ayah history retrieved successfully",
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "surahId": 2,
      "ayahNumber": 255,
      "textAr": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ…",
      "page": 42,
      "juz": 3,
      "surahNameAr": "البقرة",
      "surahNameEn": "Al-Baqarah",
      "surah": { "id": 2, "nameAr": "البقرة", "nameEn": "Al-Baqarah", "revelationType": "MADANI" },
      "historyId": "9988abcd-1234-5678-0000-abcdef123456",
      "sessionId": "110ec58a-a0f2-4ac4-8393-c866d813b8d1",
      "displayDate": "2026-09-17",
      "createdAt": "2026-09-17T12:00:03.123Z"
    },
    {
      "id": "0987fedc-…",
      "surahId": 36,
      "ayahNumber": 12,
      "textAr": "…",
      "page": 442,
      "juz": 22,
      "surahNameAr": "يس",
      "surahNameEn": "Ya-Sin",
      "surah": { "id": 36, "nameAr": "يس", "nameEn": "Ya-Sin", "revelationType": "MAKKI" },
      "historyId": "1122aaaa-bbbb-cccc-dddd-eeeeffff0000",
      "sessionId": "deadbeef-dead-beef-dead-beef00000001",
      "displayDate": "2026-09-16",
      "createdAt": "2026-09-16T06:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 124,
    "totalPages": 7,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-17T12:00:00.000Z",
  "requestId": "…"
}
```

##### Pagination behavior

- Empty history → `data: []` with `meta.total = 0`. This is normal for brand-new users; do NOT treat as error.
- Requesting `page` > `totalPages` → `data: []` with valid meta. Stop infinite scroll as soon as `meta.hasNextPage === false`.
- Page numbers start at 1.

##### Error behavior

| Status | `code` | When | Flutter action |
|--------|--------|------|----------------|
| `400` | `VALIDATION_ERROR` | `limit` > 100 or non-integer `page` / `limit` (zod returns structured error items in `details`). | Clamp `limit` to `min(100, wanted)` in client request builder. |
| `401` | `UNAUTHORIZED` / `INVALID_TOKEN` | Bearer missing / bad. | Standard auth rules (§0). |
| `500` | `INTERNAL_SERVER_ERROR` | DB failure. | Retry with backoff. Keep last-loaded page of history cached. Do not hard logout. |

---

## 3. Response Contract — field reference

This is the **stable payload shape**. Both `GET /ayah` → `data` and each `GET /ayah/history` → `data[i]` row share the same field set. Flutter can depend on every field below.

| Field | Type | Present in… | Nullable? | Meaning & Flutter usage |
|-------|------|-------------|-----------|-------------------------|
| `id` | uuid string | Both | ❌ No | Canonical `ayahs.id` — primary key of the Ayah in the existing Quran DB (useful if you ever want local DB joins to other Quran tables). Do NOT use for Quran navigation; use `surahId + ayahNumber + page` instead. |
| `surahId` | int (1..114) | Both | ❌ No | Surah number — **primary Quran navigation key #1**, paired with `ayahNumber`. |
| `ayahNumber` | int (≥1) | Both | ❌ No | Ayah number inside surah — **primary Quran navigation key #2**, paired with `surahId`. |
| `textAr` | string | Both | ❌ No | Sanitized Uthmani Arabic text. BOM + leading Bismillah are already stripped on Surah openings except for Al-Fatihah 1:1 and At-Tawbah 9:1 — mirrors existing Quran catalog. Use as display text on Home / History / Widget / Lock cards. |
| `page` | int \| null | Both | ✅ Yes (nullable — some Quran seeds may have sparse values; normally 1..604) | Physical Mushaf page number. **Strongly preferred primary reader anchor** because the existing Noor Quran reader UX is page-based. Open page `page` first; optionally seek/highlight `ayahNumber` inside the surah afterwards. |
| `juz` | int \| null | Both | ✅ Yes | Juz' number (1..30). Use for Juz tab / filter chips. |
| `surahNameAr` | string | Both | ❌ No | Canonical Arabic surah name (resolved via the exact same helper used by every other Quran endpoint). Use for Home card Arabic labels. |
| `surahNameEn` | string | Both | ❌ No | Canonical English surah name. Use for English-mode UI and logs / crash reporting. |
| `surah` | object | Both | ❌ No | Nested Surah shape = exactly mirrors the existing `GET /quran/surahs/{surahId}` payload: `{ id int, nameAr string, nameEn string, revelationType?: 'MAKKI' \| 'MADANI' }`. Use for a secondary "Open Surah Overview" action if you have it. `surah.id` always equals top-level `surahId` (redundant but kept for consistency with other endpoints). |
| `historyId` | uuid string | Both | ❌ No | Row id inside `user_ayah_history`. Uniquely identifies this specific "display event". Same Ayah in a different session will have a **different** `historyId`. Use as: <br>• cache invalidation key (§6), <br>• ListView `ValueKey` in Flutter, <br>• tracing / analytics. <br>**Never** use as a Quran navigation key. |
| `sessionId` | uuid string | Both | ❌ No | **Echoes back** the exact `X-Noor-App-Open-Id` header Flutter sent (for `GET /ayah`) OR the original session id that displayed this row (for history rows). Flutter can: <br>• Assert `data.sessionId === openIdSingleton` as a sanity check on Home, <br>• Group history rows visually by "Session #N" if a future UX wants that. |
| `displayDate` | string (YYYY-MM-DD) | Both | ❌ No | Readable calendar-day label when this history row was first created (UTC-bucketed, not a unique key). Use for "Today / Yesterday" style secondary labels; do NOT use as dedup (that is `sessionId` job). |
| `isNew` | boolean | `GET /ayah` only | Only present there (absent in history rows) | Whether **this specific HTTP call** caused the first insert of the session's history row. Use optionally to play a subtle entrance animation on the *first* Home open of a new session. You can safely ignore this field entirely. |
| `createdAt` | ISO-8601 datetime | **History rows only** | ❌ No (when present) | Precise UTC timestamp of when the history row was inserted. Use for "3 hours ago" / "Yesterday" style chips in the History UI. |

### Stability guarantees

- Backend will **not** rename or remove the above fields in non-major contract revisions.
- Future fields may be added (additive-only). Use defensive destructuring / `copyWith` in Dart; do not fail on unknown JSON keys.
- `sessionId` was added during the session-behavior correction (this contract revision). It is additive — it does not remove any previous field.

---

## 4. Ayah Selection Behavior (Session / App-Open level)

### Summary (Flutter must understand the lifecycle)

```text
FLUTTER APP LIFE CYCLE                    BACKEND (one user)
=====================================     ====================
Cold start → main() runs
  → openId = uuid.v4() (stored in mem)
  → render cached Ayah (§6) immediately
  → fire GET /ayah + "X-Noor-App-Open-Id: $openId"
                                              ├─ Lookup UNIQUE(userId, sessionId=$openId)
                                              ├─ Row NOT found → brand new open
                                              │   ├─ Read most-recent previous history row (anti-repeat target)
                                              │   ├─ pick random Ayah ≠ previous one (best-effort 3 rolls)
                                              │   ├─ INSERT 1 new history row
                                              │   └─ return payload { isNew: true, sessionId: $openId }
                                              └─ Row FOUND → repeated call same session
                                                  └─ return same Ayah + same historyId
                                                  └─ 0 new rows (no pollution)

Home rebuilds (setState, route re-entry, deeplink return)
  → always re-send SAME header: still $openId → still identical Ayah, still 0 new rows

Widget refresh (Home-screen widget periodic refresh on Android/iOS)
  → re-use SAME header from ongoing Flutter isolate $openId
  → backend still returns same Ayah, 0 new rows

User kills app process / system reclaim → openId memory lost
  ↓ Next real open
New main() run → NEW uuid.v4() → NEW $openId'
  → GET /ayah + X-Noor-App-Open-Id: $openId'
                                              ├─ UNIQUE(userId, $openId') miss
                                              ├─ Brand new session → can select new Ayah
                                              ├─ INSERT 1 new history row
                                              └─ Old session's Ayah still in history
```

### Duplicate prevention guarantees

| Cause | How prevented |
|-------|---------------|
| Home rebuilds, setState, `didChangeDependencies`, widget rebuilds | Flutter sends **same** `X-Noor-App-Open-Id` → PostgreSQL `UNIQUE(userId, sessionId)` + `upsert(update={})` behavior → new call is an effective read-only return of the existing row. **Exactly zero new rows per session after the first request.** |
| Network retries (Dio RetryInterceptor, Flipper, 5xx retry) | Same header → same outcome. Even if Flutter retries the same failed POST-turned-GET 5 times, backend processes each as same dedup key → single row only. |
| Flutter bug: regenerates a new UUID per Home build | Not auto-prevented by backend beyond the obvious symptom of N new history rows / 10 minutes of usage. Documented here so QA catches it early. Test §4 scenario of 20 calls with same header (already proven in scripts/test-ayah-feature.ts) gives you a single Map key. |
| User opens app 10 times the same physical calendar day | Correctly produces **10 distinct new rows** if each open was a real process death + restart (intended per product requirement). This is not a bug — the user saw 10 distinct Ayahs, and each is findable in History. |
| Two different users somehow send same UUID session (1/10³⁶ chance) | Per-user isolation via composite key `UNIQUE(userId, sessionId)` → same UUID sent by a different userId hits a DIFFERENT row → zero cross-user contamination. Already asserted in tests. |

### Anti-repeat (best effort, not a hard contract)

When `UNIQUE(userId, sessionId)` miss → real new session. Backend:
1. Loads `SELECT surahId, ayahNumber FROM user_ayah_history WHERE userId = ? ORDER BY createdAt DESC LIMIT 1` = previous-displayed Ayah key.
2. Calls `pickRandomAyah(excludeKey)` which does `Math.floor(Math.random()*6236)` → 1-row prisma skip+fetch. If the roll matches `excludeKey`, re-roll up to 3 more times. If all 3 rolls still collide (1 in 6236³), accept the match and return anyway.
3. Documented consequence: consecutive opens **usually** show different Ayahs, but can occasionally show the same one (≈0.016% chance per pair). This is NOT a bug report condition.

---

## 5. Quran Navigation

Returned Ayah is fully linked to existing Quran source of truth. Flutter navigates the **exact same way** as Bookmarks, LastRead, Khatmah position resume — no new navigation system introduced:

```
User taps [فتح الآية في القرآن] on Home / a History row:
  1.  page = ayahPayload.page                  ← #1 preferred entry point
  2.  surahId = ayahPayload.surahId            ← reader context
  3.  ayahNumber = ayahPayload.ayahNumber      ← intra-page highlight target
  4.  juz = ayahPayload.juz                    ← Juz tab context (optional)
  5.  surah = ayahPayload.surah                ← Surah metadata (optional)

  → Call the EXISTING Quran reader open helper you already use for
    Bookmarks / LastRead: openQuranReader(page: page, surahId: surahId, ayahNumber: ayahNumber)
  → Reader opens page `page` first (Noor UX is page-based).
  → Optionally scroll/highlight ayah `ayahNumber` within the Surah list inside that page.
```

### Field → Navigation mapping table

| Navigation goal | Fields to use | Notes |
|-----------------|---------------|-------|
| Page reader (`GET /quran/pages/{pageNumber}` HTTP or offline static page catalog) | `page` | Strongest UX: users expect page-level Ayah positioning in Noor's existing mushaf-style reader. |
| Surah ayah list (`GET /quran/surahs/{surahId}/ayahs`) | `surahId`, `ayahNumber` | Use as fallback if `page` is ever `null` (should not happen on seeded DB). |
| Juz screen chip / segmented tab | `juz` | Secondary filter (cosmetic). |
| Surah metadata screen (overview) | `surah.id`, `surah.nameAr`, `surah.nameEn`, `surah.revelationType` | Secondary CTA. |
| Ayah audio (existing audio endpoint) | `surahId` + `ayahNumber` | Matches existing `GET /quran/audio?surahId=&ayahNumber=&reciter=` shape exactly. |
| Tafsir / translation (existing) | `surahId` + `ayahNumber` | Matches existing `GET /quran/tafsir?surahId=&ayahNumber=` and friends exactly. |

**Do not** use `id` (the ayah table UUID) or `historyId` (user-history row id) for navigation. Always use canonical `(surahId, ayahNumber)` + `page`.

---

## 6. Home Screen Integration

### Recommended cache-first Flutter flow

Do **NOT** force the user to wait for a network response if a valid cached Ayah exists.

```
Event: App just opened / user navigates to Home tab
  ├─ Step 1 (0ms): render LAST CACHED Ayah from Hive / SharedPreferences / Isar
  │     ├─ if cache is empty → Home Ayah card shows skeleton shimmer only, no error text
  │     └─ if cache exists → render textAr / surahNameAr / ayahNumber immediately
  │
  ├─ Step 2 (async in background, unawaited): fire GET /api/v1/ayah
  │     send Bearer + same X-Noor-App-Open-Id = openId singleton
  │
  │     On 200 → compare response.historyId to cached.historyId
  │     ├─ same historyId → do nothing; cache is current; no UI swap / no flicker
  │     ├─ different historyId →
  │         ├─ animated cross-fade swap Home Ayah card to new payload
  │         └─ WRITE full payload to local cache
  │              (key: e.g. 'noor:ayah:latest')
  │     On 401 TOKEN_EXPIRED → refresh token ONCE → retry
  │     On 401 INVALID_TOKEN → clear session → login flow (keep old cache for display)
  │     On 400 VALIDATION_ERROR → Fix your `X-Noor-App-Open-Id` generation!
  │     On 5xx / offline / network error → SILENTLY IGNORE → keep cache → retry later with backoff
  │
  └─ User taps Ayah card → call existing openQuranReader helper (§5 keys)
```

### Home card layout suggestion (Arabic first, RTL — mirrors existing Noor Home cards)

```
┌─────────────────────────────────────────┐
│  آية                                  ✩ │ ← title chip / optional favorite (future)
│                                         │
│  اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ       │ ← large Uthmani textAr
│  الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ  │   auto-sized, multi-line safe,
│  سِنَةٌ وَلَا نَوْمٌ ۚ                 │   max font from user's quranFontSize pref
│                                         │
│  البقرة — ۲۵۵     صفحة ۴۲               │ ← secondary: surahNameAr — ayahNumber / page
│                                         │
│  [ افتح الآية في القرآن ]             ← │ CTA → calls §5 openQuranReader(page,surahId,ayah)
└─────────────────────────────────────────┘
```

Card coexistence rule: the existing **Verse of Day** card driven by `GET /content/verse-of-day` is a **separate parallel card**. The new Ayah feature card is ADDITIONAL. If product says both cards should be visible on Home → render them vertically stacked (top: Verse of Day OR bottom: Ayah, per Figma). NEVER remove or mutate the Verse-of-Day card.

---

## 7. Offline / Cache Behavior

Backend does **not** need to be reachable for Home Ayah display.

### Cache storage

- Store the full `GET /ayah` `data` payload (every field §3) locally under a single well-known key, e.g. `'noor:ayah:latest'`. Use the same Hive / SharedPreferences / Isar box you already use for LastRead / Profile cache.
- Use `historyId` as the cheap dirty-check key. `historyId` change = new Ayah = overwrite cache + swap UI.

### Cache table — scenarios

| Scenario | Flutter behavior |
|----------|------------------|
| Online, first call of a new session | Request + write to cache on success |
| Online, subsequent calls same session | Request → backend returns same `historyId`; keep cache unchanged, no UI flicker |
| Offline, cache populated | **Never show error card or spinner on Home.** Render the cached payload. Add a tiny 1-line badge "Last displayed: <cache.displayDate>" only if product wants it. |
| Offline, cache EMPTY (first launch ever, user cleared storage) | Show skeleton shimmer on Ayah card until network returns. As a **UI-only fallback** (no mixing into this feature's history cache), you can show the existing cached `GET /content/verse-of-day` card in its place. Do NOT call `GET /ayah` offline — request will just fail. |
| Token expired (`401 TOKEN_EXPIRED`) | Attempt `POST /auth/refresh` exactly ONCE. If refresh succeeds → retry `GET /ayah` + update cache. If refresh fails → continue showing old cached Ayah on Home (user can still read it); clear session only when user taps an auth-gated feature. |
| System date rolled forward 1 day, app still in foreground | Do NOT regenerate openId singleton just because of midnight. Keep same session id until real process death + restart (real new open = real new backend selection opportunity). |

### Cache invalidation triggers

- Strong signal (server-provided): `response.historyId !== cache.historyId` → overwrite cache.
- Weak client-only heuristic: when app resumes from background and you detect the process was not killed (same `openId` still in memory), fire a single silent `GET /ayah` in the background to verify the backend still returns the same `historyId` for this session. Usually same; swap if different (rare edge: DB restore / migration).

---

## 8. History Screen

### Loading & rendering

```
Open "Ayah History" screen from Home menu / profile
  → GET /api/v1/ayah/history?page=1&limit=20 (no X-Noor-App-Open-Id header)
  → Render ListView of cards newest-first (current-session Ayah at top if it exists → yesterday below → …)
  → Infinite scroll controller: while meta.hasNextPage → GET page++ when user reaches 2 items before end of current list
```

Each history card:
- Main: `textAr` with maxLines 2/3 + ellipsis → tap card expands inline OR pushes a detail route with full text + Open CTA
- Secondary line 1: `surahNameAr — آية $ayahNumber` / صفحة $page / جزء $juz
- Secondary line 2: relative time from `createdAt` (e.g. "منذ 3 ساعات", "Today", "Yesterday", "3 days ago") — use `DateTime.now().toLocal().difference(DateTime.parse(createdAt))`
- CTA anywhere on card → `openQuranReader(page: page, surahId: surahId, ayahNumber: ayahNumber)` (§5 rules, same exact helper as Home)

### Empty state

When `meta.total === 0` (brand new user never called `GET /ayah` yet):
- Show illustration + Arabic copy: "آياتك التي رأيتها ستظهر هنا" (English fallback: "Ayahs you have displayed will appear here").
- Do NOT proactively call `GET /ayah` from History screen to seed — seeding only happens when Home/Lock/Widget actually needs to display an Ayah (prevents phantom history rows).

---

## 9. Lock Screen / Widget Readiness

The stable `GET /ayah` payload (§3) is directly reusable for future Lock Screen UI and Home-screen Widgets — the backend contract does NOT need any new endpoints or new fields for them later.

### Lock Screen UI (future)
- Flutter periodically fetches `/ayah` when device is unlocked or when background task fires,
- stores it in a shared preferences area readable by the native lock-screen extension,
- same `X-Noor-App-Open-Id` = the open id singleton of the main Flutter isolate (not a new one — a lock screen refresh is NOT a "new app open"),
- Compact layout on lock: 1-2 lines `textAr` + footer `surahNameAr — $ayahNumber`.

### Home Screen Widget (future Android / iOS)
- Same exact payload. Typical widget: 1 line arabic + footer,
- tap gesture → deeplink `noorapp://ayah/open?surahId={surahId}&ayahNumber={ayahNumber}&page={page}` → launches main Flutter → opens Quran reader via §5,
- IMPORTANT for correct history behavior: the periodic background widget fetch **MUST send the main app's current `openId` singleton id, or share a persisted current-session-id that is cleared + regenerated only when the main Flutter process cold starts**. Do **not** generate a new UUID every time the widget provider wakes (that would create many fake history rows and prevent users from seeing new Ayahs).

Backend makes no native platform calls. Only the payload + request contract above are defined.

---

## 10. API Compatibility — explicit guarantees

This feature change is **additive-only**. It does NOT change or break anything already shipped.

| Item | Status | Evidence |
|------|--------|----------|
| Existing `/content/verse-of-day` endpoint | ✅ **Unchanged** | Defined in `routes/content.ts`, not referenced by any Ayah file. |
| All existing Quran endpoints `GET /quran/*` | ✅ **Unchanged** | Files in routes/quran.ts, services/quran.service.ts — not edited. |
| Quran contracts (surah id ranges, ayah numbers, juz, pages numbering, Uthmani text) | ✅ **Unchanged** | Ayah feature only JOINs → reads existing data. No writes to `ayahs`, `surahs`, `juz`, `pages` tables. |
| Existing success/error envelopes | ✅ **Unchanged** | `{success,message,data,meta,timestamp,requestId}` standard, same error codes table. `meta` still always an object. |
| Existing global auth behavior | ✅ **Unchanged** | Ayah endpoints reuse existing `authenticate` middleware only. No new token types, no new flows. Only NEW required item = `X-Noor-App-Open-Id` header specific to `GET /ayah`. |
| Journey / Azan / Tasbih / Adhkar / Notifications / Dashboard / Prayer / Salawat / Profile | ✅ **All untouched** | No code paths shared with Ayah; existing unit tests still pass (§12). |
| Quran static offline catalog (`GET /quran/full-catalog`, `GET /quran/static-meta`, files in `prisma/data/`) | ✅ **Unchanged** | Version/hash unchanged. |
| Tafsir / Translation / Audio endpoints | ✅ **Unchanged** | Ayah navigates to them using existing IDs only; no edits. |
| Field renames | ✅ **None** | All fields present before this session-behavior correction remain. Only NEW field added = `sessionId` in the Ayah response payload (additive). |

---

## 11. Flutter Implementation Notes

### Practical implementation checklist

1. **Dart model** — create a single `AppUserAyah` model that fits both `GET /ayah` response and each history row:
   ```dart
   @immutable
   class AppUserAyah {
     final String id;            // Quran ayahs.id
     final int surahId;          // 1..114
     final int ayahNumber;       // ≥1
     final String textAr;        // sanitized Uthmani
     final int? page;            // 1..604, null means open by surah/ayah fallback
     final int? juz;             // 1..30
     final String surahNameAr;
     final String surahNameEn;
     final AppSurah surah;       // {id, nameAr, nameEn, revelationType?}
     final String historyId;     // user history row id
     final String sessionId;     // echoes X-Noor-App-Open-Id
     final String displayDate;   // YYYY-MM-DD label
     final bool? isNew;          // only present in GET /ayah, null in history
     final DateTime? createdAt;  // only present in history rows
   }
   ```
2. **Open id singleton** — create once per cold start:
   ```dart
   // lib/main.dart or lib/core/open_id.dart
   import 'package:uuid/uuid.dart';
   final String kNoorAppOpenId = const Uuid().v4(); // ONE eval per process life
   ```
   Never re-assign, never persist, never regenerate in Hot Restart / Hot Reload. Use for every `GET /api/v1/ayah` call in this process.
3. **Dio interceptor** — add a small app interceptor:
   ```dart
   class AyahHeadersInterceptor extends Interceptor {
     @override void onRequest(options, handler) {
       if (options.path.startsWith('/ayah') && options.method == 'GET' && !options.path.startsWith('/ayah/history')) {
         options.headers['X-Noor-App-Open-Id'] = kNoorAppOpenId;
       }
       super.onRequest(options, handler);
     }
   }
   ```
   This automatically sends the header to `/ayah` only and never to `/ayah/history` or other endpoints.
4. **Repository layer** — wrap endpoints:
   ```dart
   Future<AppUserAyah> getCurrentAyah();          // sends Bearer + X-Noor-App-Open-Id
   Future<Paged<AppUserAyah>> getAyahHistory({int page = 1, int limit = 20}); // Bearer only
   ```
   Use the existing Dio instance with Bearer interceptor + the AyahHeadersInterceptor above.
5. **Error handling interceptor** — reuse existing `NoorErrorInterceptor` that maps `401 INVALID_TOKEN` / `TOKEN_EXPIRED` correctly. Add a **one-time** handler for `400 VALIDATION_ERROR` when `details[i].path[0] === 'x-noor-app-open-id'`: log it to Crashlytics as a NON-FATAL bug; do **not** retry the request until the client code is fixed (the same invalid header will always 400).
6. **Home card placement** — insert BELOW or ABOVE the existing Verse of Day card as per Figma. Do NOT remove Verse of Day card from widget tree.
7. **History screen routing** — add to existing GoRouter / app router with deeplink: `noorapp://ayah/history`.
8. **Quran navigation** — call your existing helper used by Bookmarks / LastRead:
   ```dart
   // existing import
   import 'package:noor/features/quran/domain/open_quran_reader.dart';
   await openQuranReader(page: ayah.page, surahId: ayah.surahId, ayahNumber: ayah.ayahNumber);
   ```
   Do **not** write a second custom navigation route.
9. **Manual QA scenarios to verify on a real device before shipping**:
   - (a) Tap Home 20 times / trigger setState via another widget 20 times → request logs show 20 calls, but `GET /ayah/history?limit=10` shows new total rows did NOT increase by 20 (stayed the same).
   - (b) Real-close app (swipe-up from recents / force-stop), reopen, new `historyId` → new Ayah possible; previous open Ayah is now the 2nd row in History with older `createdAt`.
   - (c) Turn airplane ON, close+open app → Home still shows the last cached Ayah card.
   - (d) Go to History page 1 → tap any row → Quran reader opens on correct page and correct ayah.
   - (e) Scroll history → `hasNextPage` correctly returns `false` on the last page of history.

### What you do NOT need to build in this phase

- ❌ Native Android / iOS Home Widgets yet (payload is ready in §9 — wiring native widget code = future phase).
- ❌ Native Lock Screen implementation.
- ❌ Replacing or removing `GET /content/verse-of-day` card from Home.
- ❌ Server push notifications for "new Ayah available". Polling + app-open flow are sufficient, per §4 new-session behavior.

---

End of contract.
