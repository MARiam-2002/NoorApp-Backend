# Noor App — آيات السجود (Quran Sajdah Verses Tracker) — Final Backend Integration Contract

> **Status:** 100% READY — Backend implementation for Flutter "آيات السجود" screen (2 Tabs: "سجل السجود" / "قائمة الآيات"). Prisma model added, TypeScript compiled 0 errors, GetDiagnostics clean, all new routes are **additive only** (no existing Quran/Azan/Journey routes or response contracts modified — 100% backward compatible).
>
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`
> **Vercel mirror:** `https://noor-app-backend-one.vercel.app/api/v1`
>
> **Hard Rule — DO NOT BREAK:** Every endpoint returns the mandatory `{success, message, data, meta, timestamp, requestId}` standard envelope. No existing Quran endpoints (`/quran/surahs/*`, `/quran/surahs/*/ayahs`, `/quran/bookmarks/*`, `/quran/last-read`, `/quran/khatmah`, `/quran/reciters`, `/quran/translations`, `/quran/tafsirs`, `/quran/pages/*`, `/quran/search`) were changed at all — only 3 new `/quran/sajdah-verses/*` additive routes were appended on top of existing catalog routes.

---

## 0. Standard Envelope (MANDATORY for every endpoint)

```jsonc
{
  "success": true | false,
  "message": "human readable string",
  "data":    { /*…*/ } | [/*…*/] | null,
  "meta":    null  | { /* counts, pagination, etc */ },
  "timestamp": "2026-09-23T12:10:00.000Z",   // ISO-8601 UTC
  "requestId": "uuid" | null
}
```

4xx error envelopes add `"code": ErrorCodeEnum` (e.g. `"UNAUTHORIZED"`, `"VALIDATION_ERROR"`, `"NOT_FOUND"`) and optional `details: [{field,message}]`.

🔐 All **write + user-progress** endpoints require Bearer auth. Public catalog endpoint (`/quran/sajdah-verses`) does not.

---

## 1. UI Screens → Exact API Mapping (matches your 2 screenshots 1:1)

### Screen Top header (common to both tabs):
| UI element | Data source |
|---|---|
| **Header right side counter:** `10 سجدات` (screenshot 2 — "سجل السجود" tab) | `summary.muataqidahTotal` (=10), text: "إجمالي السجدات المؤداة" label in app. |
| **Header right side counter:** `15 سجدة` (screenshot 1 — "قائمة الآيات" tab) | `summary.fullTotal` (=15), text: "إجمالي السجدات في القرآن". |
| **Number completed (for progress bar/animation under counter):** e.g. user in screenshot has completed **4 of 10** (A'raf 206 ✅, Ra'd 15 ✅, Nahl 49 ⚪, Isra 109 ✅, Maryam 58 ⚪, Hajj 18 ⚪, Hajj 77 ✅ …) | `summary.muataqidahCompleted / summary.fullCompleted` + `*Percent` for the two respectively. |

### Tab 1 = "سجل السجود" (سجل السجود — 10 rows — muataqidah scope)
The "simple circle-checkbox" UI (left side of each row — no badge chip):
| Row # | UI (Screenshot 2 order) | Backend field(s) |
|---|---|---|
| 1 | سورة الأعراف آية 206 — ✅ | `rows[0].verseKey=7:206`, `.completed=true` → ✅ golden filled checkmark |
| 2 | سورة الرعد آية 15 — ✅ | `rows[1].verseKey=13:15`, `.completed=true` |
| 3 | سورة النحل آية 49 — ⚪ | `rows[2].verseKey=16:49`, `.completed=false` → hollow white circle |
| 4 | سورة الإسراء آية 109 — ✅ | `rows[3].verseKey=17:109`, `.completed=true` |
| 5 | سورة مريم آية 58 — ⚪ | `rows[4].verseKey=19:58`, `.completed=false` |
| 6 | سورة الحج آية 18 — ⚪ | `rows[5].verseKey=22:18`, `.completed=false` |
| 7 | سورة الحج آية 77 — ✅ | `rows[6].verseKey=22:77`, `.completed=true` |
| 8 | سورة الفرقان آية 60 | rows[7] |
| 9 | سورة النمل آية 26 | rows[8] |
| 10 | سورة السجدة آية 15 | rows[9] |
| *(Arabic verse text preview under reference header)* | `.textAr` of each row. |

### Tab 2 = "قائمة الآيات" (قائمة الآيات — 15 rows — full scope)
Same 7 visible rows order as Tab 1 + 8 extra rows below (sortOrder 11..15). Every row has a **LEFT side chip/badge** (Screenshot 1) instead of just a circle:
| UI chip label (Arabic) | Backend field |
|---|---|
| `تم السجود` (dark badge + ✓ checkmark — A'raf 206, Ra'd 15, Isra 109, Hajj 77 in screenshot) | `rows[i].badgeLabelAr = "تم السجود"` when `completed=true` |
| `لم يتم السجود` (dark badge + ⚪ hollow circle — Nahl 49, Maryam 58, Hajj 18 in screenshot) | `rows[i].badgeLabelAr = "لم يتم السجود"` when `completed=false` |

Use `.badgeLabelAr` as chip text (always server-provided to guarantee wording) and use `.completed` to select which chip icon (✓ vs ⚪) to render inside the badge.

### Row tap → User action
When user taps the circle/badge chip → call PATCH endpoint below; response immediately contains the updated full summary + rows so you skip a second GET call.

---

## 2. 📋 Complete Endpoint Catalog (3 new additive endpoints)

### 2.1 `GET /quran/sajdah-verses` — 🟢 Public catalog (NO AUTH REQUIRED)
Use this BEFORE user logs in to show static list (no completion state).
```
Query params (all optional):
  ?scope=muataqidah   → returns 10 rows only (Tab 1: سجل السجود)
  ?scope=full         → default, returns all 15 rows (Tab 2: قائمة الآيات)
```

**cURL:**
```bash
curl 'https://noorapp-backend-production.up.railway.app/api/v1/quran/sajdah-verses?scope=muataqidah'
```

**Response `data` example (public — no completed flag, not user-specific):**
```jsonc
{
  "count": 10,
  "scope": "muataqidah",
  "totalExpected": 10,
  "rows": [
    {
      "surahId": 7,
      "ayahNumber": 206,
      "referenceAr": "سورة الأعراف - آية 206",
      "referenceEn": "Surah Al-A'raf — Verse 206",
      "textAr": "إِنَّ الَّذِينَ عِندَ رَبِّكَ لَا يَسْتَكْبِرُونَ عَنْ عِبَادَتِهِ وَيُسَبِّحُونَهُ وَلَهُ يَسْجُدُونَ ۩",
      "textEn": "Indeed, those with your Lord are not arrogant against His worship, and they glorify Him and to Him they prostrate.",
      "badgeLabelAr": "لم يتم السجود",
      "badgeLabelEn": "Sujood not yet performed",
      "isIn10Muataqidah": true,
      "sortOrder": 1,
      "verseKey": "7:206"
    }
    // … 9 more rows (sortOrder 2..10) for سجل السجود, or 15 for قائمة الآيات.
  ]
}
```

---

### 2.2 `GET /quran/sajdah-verses/my-progress` — 🔐 AUTH REQUIRED (user's progress + summary)
**This is the RECOMMENDED single call to build both tabs.** Call once after login or on Tab open; pass `?scope=muataqidah` for سجل السجود or `?scope=full` (default) for قائمة الآيات.

```
Query params: ?scope=full|muataqidah
```

**cURL:**
```bash
curl -H 'Authorization: Bearer <access_token>' \
  'https://noorapp-backend-production.up.railway.app/api/v1/quran/sajdah-verses/my-progress?scope=full'
```

**Response `data` (matches your screenshot — user has 4 of first 7 Mu'taqidah done):**
```jsonc
{
  "summary": {
    "muataqidahCompleted": 4,
    "muataqidahTotal": 10,
    "muataqidahPercent": 40,
    "fullCompleted": 4,
    "fullTotal": 15,
    "fullPercent": 27,
    "lastCompletedAt": "2026-09-20T08:12:14.000Z"
  },
  "rows": [
    // -- sortOrder 1 --
    { "verseKey":"7:206",  "surahId":7,  "ayahNumber":206,
      "referenceAr":"سورة الأعراف - آية 206", "referenceEn":"Surah Al-A'raf — Verse 206",
      "textAr":"إِنَّ الَّذِينَ عِندَ رَبِّكَ لَا يَسْتَكْبِرُونَ عَنْ عِبَادَتِهِ وَيُسَبِّحُونَهُ وَلَهُ يَسْجُدُونَ ۩",
      "textEn":"Indeed, those with your Lord are not arrogant against His worship…",
      "badgeLabelAr":"تم السجود", "badgeLabelEn":"Sujood performed",
      "completed":true, "completedAt":"2026-09-15T17:01:21.000Z",
      "isIn10Muataqidah":true, "sortOrder":1 },
    // -- sortOrder 2 --
    { "verseKey":"13:15",  "surahId":13, "ayahNumber":15,
      "referenceAr":"سورة الرعد - آية 15",
      "textAr":"وَلِلَّهِ يَسْجُدُ مَنْ فِي السَّمَاوَاتِ وَالْأَرْضِ طَوْعًا وَكَرْهًا…",
      "badgeLabelAr":"تم السجود","completed":true,"isIn10Muataqidah":true,"sortOrder":2 },
    // -- sortOrder 3 --
    { "verseKey":"16:49",  "surahId":16, "ayahNumber":49,
      "referenceAr":"سورة النحل - آية 49",
      "textAr":"وَلِلَّهِ يَسْجُدُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ مِن دَابَّةٍ…",
      "badgeLabelAr":"لم يتم السجود","completed":false,"completedAt":null,"isIn10Muataqidah":true,"sortOrder":3 },
    // -- sortOrder 4 --
    { "verseKey":"17:109", "surahId":17, "ayahNumber":109,
      "referenceAr":"سورة الإسراء - آية 109",
      "textAr":"وَيَخِرُّونَ لِلْأَذْقَانِ يَبْكُونَ وَيَزِيدُهُمْ خُشُوعًا ۩",
      "badgeLabelAr":"تم السجود","completed":true,"isIn10Muataqidah":true,"sortOrder":4 },
    // -- sortOrder 5 --
    { "verseKey":"19:58",  "surahId":19, "ayahNumber":58,
      "referenceAr":"سورة مريم - آية 58",
      "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":true,"sortOrder":5 },
    // -- sortOrder 6 --
    { "verseKey":"22:18",  "surahId":22, "ayahNumber":18,
      "referenceAr":"سورة الحج - آية 18",
      "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":true,"sortOrder":6 },
    // -- sortOrder 7 (last visible in both screenshots) --
    { "verseKey":"22:77",  "surahId":22, "ayahNumber":77,
      "referenceAr":"سورة الحج - آية 77",
      "badgeLabelAr":"تم السجود","completed":true,"isIn10Muataqidah":true,"sortOrder":7 },
    // -- sortOrder 8..10 (remainder of Tab 1) --
    { "verseKey":"25:60",  "surahId":25, "ayahNumber":60,  "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":true,"sortOrder":8 },
    { "verseKey":"27:26",  "surahId":27, "ayahNumber":26,  "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":true,"sortOrder":9 },
    { "verseKey":"32:15",  "surahId":32, "ayahNumber":15,  "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":true,"sortOrder":10 },
    // -- sortOrder 11..15 (Tab 2 ONLY — extra 5 verses for قائمة الآيات) --
    { "verseKey":"41:38",  "surahId":41, "ayahNumber":38,
      "referenceAr":"سورة فصلت - آية 38",
      "noteAr":"سجودة عند الإمامية، وذكرها في بعض الروايات",
      "noteEn":"Sujood confirmed in Ja'fari (Imami) fiqh",
      "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":false,"sortOrder":11 },
    { "verseKey":"53:62",  "surahId":53, "ayahNumber":62,  "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":false,"sortOrder":12 },
    { "verseKey":"96:19",  "surahId":96, "ayahNumber":19,  "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":false,"sortOrder":13 },
    { "verseKey":"84:21",  "surahId":84, "ayahNumber":21,  "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":false,"sortOrder":14 },
    { "verseKey":"4:102",  "surahId":4,  "ayahNumber":102, "badgeLabelAr":"لم يتم السجود","completed":false,"isIn10Muataqidah":false,"sortOrder":15 }
  ]
}
```

---

### 2.3 `PATCH /quran/sajdah-verses/:surahId/:ayahNumber` — 🔐 AUTH REQUIRED (toggle / set completion)
Call this when user taps the circle or badge. Response returns **fresh summary + full rows list** matching the scope you passed, so no second `/my-progress` call needed on tap.

```
PATH params:  :surahId (int 1..114), :ayahNumber (int ≥ 1)
QUERY param (optional):  ?scope=full|muataqidah  (default full)
                         - controls which list of rows is returned in the refreshed payload
BODY  (optional, one of):
    { } or omit          → TOGGLE current state (true→false / false→true)
    { "completed": true  } → FORCE SET "performed sujood" (first time awards 20 pts)
    { "completed": false } → FORCE SET "not performed" (never awards points)
    { "completed": true, "scope": "muataqidah" } → scope can also be in body if you prefer
```

**cURL examples:**
```bash
# -- Toggle Sujood status for A'raf 206 (returns refreshed rows)
curl -X PATCH \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{}' \
  'https://noorapp-backend-production.up.railway.app/api/v1/quran/sajdah-verses/7/206?scope=muataqidah'

# -- Force SET "did perform" (good for reading mode auto-suggest)
curl -X PATCH \
  -H 'Authorization: Bearer <access_token>' \
  -d '{ "completed": true }' \
  'https://noorapp-backend-production.up.railway.app/api/v1/quran/sajdah-verses/7/206'
```

**Response `data` (for first completion of verse 7:206 → awards 20 points):**
```jsonc
{
  "toggledVerse": {
    "verseKey": "7:206",
    "surahId": 7,
    "ayahNumber": 206,
    "completed": true,
    "completedAt": "2026-09-23T09:14:30.120Z",
    "pointsAwarded": 20
  },
  "summary": {
    "muataqidahCompleted": 5,
    "muataqidahTotal": 10,
    "muataqidahPercent": 50,
    "fullCompleted": 5,
    "fullTotal": 15,
    "fullPercent": 33,
    "lastCompletedAt": "2026-09-23T09:14:30.120Z"
  },
  "rows": [
    // — Same array shape as section 2.2 (my-progress endpoint) — already refreshed for Flutter to re-render instantly!
    //   Verse 7:206 now has badgeLabelAr="تم السجود", completed=true — no extra call needed 💡
  ]
}
```

**Points rule (§4.3):** `pointsAwarded` equals `20` on FIRST completion ever of a verse (transition false→true). If user toggles off → back on (false→true AGAIN on same verse), `pointsAwarded = 0` (idempotent rewards). The backend automatically increments `User.points` by 20 on the first true and preserves your `completedAt` timestamp across toggles.

---

## 3. Field Reference Table

| Field path | Type | Range / Values | Which UI uses it |
|---|---|---|---|
| `summary.muataqidahCompleted` | int | 0..10 | سجل السجود Tab header counter |
| `summary.muataqidahTotal` | int | fixed=10 | سجل السجود Tab denominator / progress denominator |
| `summary.muataqidahPercent` | int | 0..100 | سجل السجود Tab progress bar fill % (round integer) |
| `summary.fullCompleted` | int | 0..15 | قائمة الآيات Tab header counter |
| `summary.fullTotal` | int | fixed=15 | قائمة الآيات denominator |
| `summary.fullPercent` | int | 0..100 | قائمة الآيات progress bar % |
| `summary.lastCompletedAt` | string? | ISO-8601 datetime or null | "آخر سجدة" subtitle (optional UX); null if none |
| `rows[].verseKey` | string | `"{surahId}:{ayahNumber}"` | Flutter Row `key` / `id` for efficient `ListView.builder` |
| `rows[].surahId` | int | 1..114 | Navigation: open Surah reader on tap → jump to this surah |
| `rows[].ayahNumber` | int | ≥1 | Scroll target / highlight in reader |
| `rows[].referenceAr` | string | e.g. "سورة الأعراف - آية 206" | Right-side header text of each row (Arabic) |
| `rows[].referenceEn` | string | English reference | Optional RTL-English locale setting |
| `rows[].textAr` | string | Full ayah text AR with tashkeel | 2nd line preview under header (small text) |
| `rows[].textEn` | string | Short English meaning preview | English locale 2nd line |
| `rows[].badgeLabelAr` | string | "تم السجود" \| "لم يتم السجود" | قائمة الآيات Tab — LEFT chip text (badge label), server-provided. |
| `rows[].badgeLabelEn` | string | English chip text | English locale |
| `rows[].completed` | boolean | true/false | Renders circle ✓ or ⚪ in سجل السجود; chip icon ✓/⚪ in قائمة الآيات. |
| `rows[].completedAt` | string? | ISO-8601 / null | When user first marked this sujood; can show as tooltip / subtitle text |
| `rows[].isIn10Muataqidah` | boolean | true/false | If false → this row appears ONLY in قائمة الآيات Tab (11..15 sortOrder), hide in سجل السجود Tab |
| `rows[].sortOrder` | int | 1..15 | NEVER sort rows client-side — always render using backend sortOrder exactly as returned, matches screenshot order A'raf → Nisa |
| `rows[].noteAr` / `noteEn` | string? | optional | Tiny hint below the ayah preview (only shown for sortOrder 11-15 to explain madhhab inclusion) |
| `toggledVerse.pointsAwarded` | int | 0 or 20 | Confetti/show-points animation on first completion |

---

## 4. Catalog, Rules, Points

### 4.1 Canonical Verse Order (DO NOT REORDER client-side)
Backend returns rows sorted by `sortOrder` 1..15 exactly matching your screenshot visible list:
1.  الأعراف 206 — 7:206
2.  الرعد 15 — 13:15
3.  النحل 49 — 16:49
4.  الإسراء 109 — 17:109
5.  مريم 58 — 19:58
6.  الحج 18 — 22:18
7.  الحج 77 — 22:77
8.  الفرقان 60 — 25:60
9.  النمل 26 — 27:26
10. السجدة 15 — 32:15
11. فصلت 38 — 41:38 *(إمامية)*
12. النجم 62 — 53:62 *(رواية عمر رضي الله عنه)*
13. العلق 19 — 96:19 *(حنفية)*
14. الانشقاق 21 — 84:21 *(شافعية)*
15. النساء 102 — 4:102 *(سياق الصلاة)*

### 4.2 Mu'taqidah (10) vs Full (15)
- 10 Mu'taqidah verses = `isIn10Muataqidah = true` (sortOrder 1..10) → shown on سجل السجود tab.
- 15 Full list = 10 Mu'taqidah + 5 additional fiqh-narrated → shown on قائمة الآيات tab.

### 4.3 Points reward (gamification)
- FIRST-TIME sujood mark (`completed` transitions false → true) → User.points **+20** + `pointsAwarded=20` in response.
- Same verse re-true (after toggling off then on) → NO double points (`pointsAwarded=0`).
- Toggle to false → points never revoked.

---

## 5. Guest vs Logged-in Flow
| Screen state | Behavior |
|---|---|
| Guest (not logged in) opens the آيات السجود screen | Call **2.1** `/quran/sajdah-verses?scope=full` (public). Hide completion state (no checkmarks; all circles hollow / all chips say "لم يتم السجود"). Show a login/register CTA if they tap any chip: "سجل الدخول لتسجيل سجودك وربط نقاطك". |
| User logs in / opens screen while authenticated | Call **2.2** `/quran/sajdah-verses/my-progress?scope=full` ONCE. Open default Tab = سجل السجود (filter `rows` by `isIn10Muataqidah==true` locally, or pass `?scope=muataqidah` and call again). Tabs swap via scope or local filter. |
| Tab change (سجل السجود ↔ قائمة الآيات) | Use local filter on rows you already hold (no API call) for zero-latency swipe UX; or if you prefer fresh server state on every tab switch, re-call **2.2** with matching scope. |

---

## 6. Backward Compatibility & Breaking Notes
- **ZERO existing Quran endpoints touched.** `/quran/surahs`, `/quran/bookmarks`, `/quran/khatmah`, `/quran/surahs/:id/ayahs`, `/quran/search`, `/quran/reciters`, `/quran/translations`, `/quran/tafsirs`, `/quran/pages/*`, `/quran/ayahs/*/audio` — 100% identical response shape as shipped before, never modified.
- No existing response envelopes, field names or field types anywhere were removed.
- New composite unique key in DB: `(userId, surahId, ayahNumber)` — upsert pattern ensures one row per user per verse maximum (no duplicate rows in table regardless of taps).

---

## 7. Screen Build Call Order (Flutter)
```
Screen opens (آيات السجود):
  IF user logged in → ONE GET:
     GET /quran/sajdah-verses/my-progress?scope=full
     → Save the rows[] array. Render:
         سجل السجود Tab = rows.where(isIn10Muataqidah)
         قائمة الآيات Tab = all 15 rows
         Header counter = switch(tab, muataqidahPercent / fullPercent)
  ELSE (guest) → ONE GET:
     GET /quran/sajdah-verses?scope=full
     → Render hollow/placeholder state.

On user taps circle/badge to toggle a verse:
  PATCH /quran/sajdah-verses/{surahId}/{ayahNumber}?scope=<current tab scope>
    [body: {} for toggle, or {completed:true/false} if forcing]
  → On 200, replace state.rows = response.data.rows; state.summary = response.data.summary (INSTANT re-render, no 2nd call).
  → If response.data.toggledVerse.pointsAwarded > 0, show "+20 points" toasts animation and trigger journey badge re-fetch /dashboard once quietly if needed.
```

---

## 8. URL Index (all 3 new endpoints)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/quran/sajdah-verses` | None (Public) | Static catalog (10 or 15 rows) for guest / SEO / reader-embedded hints. |
| GET | `/quran/sajdah-verses/my-progress` | 🔐 Bearer | Recommended main call for logged-in screen: header summary + 15 verse rows with user completion flags. |
| PATCH | `/quran/sajdah-verses/:surahId/:ayahNumber` | 🔐 Bearer | Toggle / Set sujood completion state of one verse; returns refreshed summary+rows. |

---

## 9. 10-Item Flutter Integration Checklist

| # | Check | Status |
|---|---|---|
| 1 | Opening آيات السجود screen (logged-in) → calls GET /quran/sajdah-verses/my-progress one-shot; no waterfall. | ☐ |
| 2 | سجل السجود Tab renders 10 rows (sortOrder 1..10) — circle checkmark filled when `completed==true`; hollow otherwise. | ☐ |
| 3 | قائمة الآيات Tab renders 15 rows (sortOrder 1..15) — left side chip shows server `.badgeLabelAr` string exactly; inside icon = ✓ if completed, else ⚪. | ☐ |
| 4 | Each row 2nd line shows `.textAr` small preview under `.referenceAr`. | ☐ |
| 5 | Header counter on سجل السجود shows: `"\(summary.muataqidahCompleted) سجدات"` against `muataqidahTotal=10` (in your Arabic wording). Progress bar fill = `muataqidahPercent / 100`. | ☐ |
| 6 | Header counter on قائمة الآيات shows: `"\(summary.fullCompleted) سجدة"` against `fullTotal=15`. Progress bar fill = `fullPercent / 100`. | ☐ |
| 7 | Tap circle/badge → calls PATCH with empty body `{}` → toggle; on success replaces local rows with `response.data.rows` instantly (no 2nd GET call). | ☐ |
| 8 | If `toggledVerse.pointsAwarded == 20` → shows "+20" reward overlay / increments journey points on next journey tab open. | ☐ |
| 9 | Guest (no token): tap a verse chip → shows CTA login sheet "قم بتسجيل الدخول لتسجيل سجودك" instead of PATCH call (PATCH returns 401 anyway, client-side CTA is nicer UX). | ☐ |
| 10 | Every endpoint checks `success===true` before reading `data`. Handles 401 envelope `code=UNAUTHORIZED` by opening login flow gracefully. | ☐ |

---

## 10. Change Log (Final v1.0 — 2026-09-23)
- **New Prisma model `QuranSajdahCompletion`** with composite unique key `(userId, surahId, ayahNumber)`; upsert pattern idempotent across sessions/devices; inverse relation added to User model (no breaking schema — only one new table).
- **New constant file `src/shared/constants/sajdah-verses.ts`** → canonical 15-verse list with AR/EN references, AR/EN ayah text, `isIn10Muataqidah` flag, `sortOrder 1..15` matching screenshot order exactly, fiqh note hints for 5 extras.
- **New 3 services in `src/services/quran.service.ts`**: `listSajdahVersesCatalog` (public), `getUserSajdahProgress` (auth returns summary + rows), `toggleSajdahVerseCompletion` (auth toggle/set + 20-pts first-time reward + refreshed payload).
- **New 3 additive controllers** appended in `src/controllers/quran.controller.ts` (old handlers untouched).
- **New 3 additive routes** mounted at top of `src/routes/quran.ts` after `quranRouter = Router()` but BEFORE existing surahs/bookmarks routes — so existing path resolution unchanged. All OpenAPI `@openapi` docs added for auto-Swagger.
- **TypeScript:** `tsc --noEmit` exit 0 ✅. **GetDiagnostics:** 0 errors/warnings ✅. **Prisma:** `prisma generate` succeeds ✅ (`prisma migrate dev --name add_quran_sajdah_completions` should be run on deployments against Postgres to create the new table — a non-destructive CREATE TABLE only).
