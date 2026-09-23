# Noor App — رحلتي (Journey / Gamification Dashboard) — Final Backend Integration Contract

> **Status:** 100% READY — Backend Journey (رحلتي) is fully implemented, TypeScript-compiled 0 errors, GetDiagnostics clean. Existing 2025/2026 integrations are preserved 100% backward compatible — no existing fields or endpoints were changed; only new additive endpoints and response extensions were added.
>
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`
> **Vercel mirror:** `https://noor-app-backend-one.vercel.app/api/v1`
>
> **Hard Rule for Flutter — DO NOT BREAK:** Every JSON response uses the mandatory `{success,message,data,meta,timestamp,requestId}` standard envelope. All previously existing endpoints (`/journey/today`, `/journey/progress`, `/journey/badges`, 4x PATCH actions for quran/adhkar/sadaqah/prayer) return **exactly the same contract as before** — the new `/dashboard` endpoint is OPTIONAL (recommended) one-shot for the Journey screen; if Flutter wants to continue using the old multi-call approach, it works forever.

---

## 0. Standard Envelope (MANDATORY — every endpoint)

```jsonc
{
  "success": true | false,
  "message": "human readable string (safe to display or ignore)",
  "data": { /*…*/ } | [/*…*/] | null,
  "meta":  null  | { /* pagination, counts etc */ },
  "timestamp": "2026-09-23T12:00:00.000Z",   // ISO-8601 UTC
  "requestId": "uuid" | null
}
```
For 4xx error envelopes: add `"code": "VALIDATION_ERROR"` enum and optional `details:[{field,message}]`.

**Auth header (🔐 every /journey endpoint except public catalogs — all are 🔐 here):**
```
Authorization: Bearer <access_token>
```
All `/journey/*` endpoints require a logged-in user; unauthenticated calls receive a standard 401 envelope `code=UNAUTHORIZED`.

---

## 1. UI Screens → Exact API Mapping (your رحلتي screenshot)

| # | UI Card (AR) | Data from Backend → exact field(s) |
|---|---|---|
| **1** | **المستوي الحالي** — `6 عبد شاكر` + progress bar + 5 medals (3 gold earned = first steps + streak3 + streak7, 2 silver locked = prayersAllToday + streak14) | `GET /journey/dashboard` → `data.levelCard.level=6`, `.rankTitleAr="عبد شاكر"`, `.levelProgressPercent`, `.pointsInLevel`, `.pointsToNextLevel`, + `.medals[0..4]` array with `type: "gold" | "silver"` + `earned` flag. Level ladder reference: §7. (عبد شاكر = level 6 in 10-level ladder.) |
| **2** | **سلسلة الحسنات** — `9 يوم متواصل` + 10 checkmark circles (9 filled ✓, 10th = today or next) | `data.streakCard.days=9`, `.displayDays[]` (fixed 10-day slot array), each entry has `completed` boolean + `inCurrentStreak` flag + `index` for order. 10-slot row = `displayDaysCount:10`. |
| **3** | **ملخص الاسبوع** — 4 colored progress bars `الصلاة %95 emerald, القرآن %90 indigo, الصدقة %75 indigo, الذكار %85 amber` | `data.weeklySummaryCard.categories[0..3]`: 4 ordered objects with `{key,keyAr,keyEn,percent:0..100,color:"emerald"|"indigo"|"amber",…}`. Percent rule definitions: §4.2. |
| **4** | **الكالندر الشهري** — `سبتمبر 2025` header, weekday row (اليوم→السبت), 6 week rows, checkmarks on 15,16,17,18,19 (Sun-Thu completed), 20 (Fri pending today) | `data.monthlyCalendarCard.month.nameAr="سبتمبر"`, `.weekdayHeaders[]`, `.cells[1..30 or 31]`. Each cell has `day (int) + dayAr (eastern-arabic ١…٣١) + weekdayIndex + status ("done"|"partial"|"missed"|"future") + overallPercent 0..100 + prayersCompleted/quranPages/adhkarCompleted/sadaqahAmount + isToday boolean.` WeekdayIndex of first cell tells Flutter where to offset cell 1 in the 7-column grid. |

### Bonus 5 & 6 sections in the same one-shot response for free (to avoid re-query):
- `data.todayTiles` = {quran,prayers,adhkar,sadaqah} mini tiles (same shape as `/journey/today` individual tiles).
- `data.dailyChallenge` = today's التحدي اليومي tile (titleAr/titleEn, rewardPoints, completed/claimed boolean).
- `data.badges[]` = top-level badges array (same as separate `/journey/badges` endpoint) — 5-item medal list identical to the levelCard's medals.
- `data.streakDays` / `data.points` / `data.overallPercent` = top-level quick access numbers.

---

## 2. 🎯 MASTER ENDPOINT — `GET /journey/dashboard` (RECOMMENDED ONE-SHOT CALL)

One call → full رحلتي screen. Aggregates all 4 matching-card sections internally (reuses `/journey/today` service + new weekly + new monthly aggregators).

### Query params (all OPTIONAL):
```
?weekDays=N   default=7, minimum 1, maximum 365 — used to compute weekly summary % bars (e.g. last 7 days or last 14 days).
?month=1..12  default=current calendar month — which month to render heatmap for (September=9 in screenshot).
?year=YYYY    default=current calendar year — which year (2025 in screenshot).
```

### curl example:
```bash
curl 'https://noorapp-backend-production.up.railway.app/api/v1/journey/dashboard?month=9&year=2025' \
  -H 'Authorization: Bearer <access_token>'
```

### Exact `data` response (example matching your screenshot):

```jsonc
{
  // ---- backward-compat top-level metadata (from /today) ----
  "date": "2025-09-20",
  "points": 1620,
  "streakDays": 9,
  "overallPercent": 87,
  "badges": [
    { "id":"first-steps","key":"FIRST_STEPS","titleAr":"الخطوات الأولى","titleEn":"First steps","earned":true,"earnedAt":"2025-08-01T…Z" },
    { "id":"streak-3",   "key":"STREAK_3",    "titleAr":"سلسلة 3 أيام",   "titleEn":"3-day streak",   "earned":true,"earnedAt":"2025-09-12T…Z" },
    { "id":"streak-7",   "key":"STREAK_7",    "titleAr":"سلسلة 7 أيام",   "titleEn":"7-day streak",   "earned":true,"earnedAt":"2025-09-18T…Z" },
    { "id":"prayers-all","key":"PRAYERS_ALL_TODAY","titleAr":"صلوات اليوم كاملة","titleEn":"All prayers today","earned":false,"earnedAt":null },
    { "id":"streak-14",  "key":"STREAK_14",   "titleAr":"سلسلة 14 يوماً",  "titleEn":"14-day streak",  "earned":false,"earnedAt":null }
  ],

  // ==== CARD 1: المستوي الحالي ====
  "levelCard": {
    "level": 6,
    "rankTitleAr": "عبد شاكر",
    "rankTitleEn": "Grateful servant",
    "levelProgressPercent": 17,
    "pointsInLevel": 120,
    "pointsToNextLevel": 580,
    "nextLevel": 7,
    "nextRankTitleAr": "عبد صابر",
    "nextRankTitleEn": "Patient servant",
    "isMaxLevel": false,
    // exactly the 5 visual medals of the mock (3 gold left, 2 silver right):
    "medals": [
      { "id":"first-steps","key":"FIRST_STEPS","titleAr":"الخطوات الأولى","titleEn":"First steps","type":"gold","earned":true    },
      { "id":"streak-3",   "key":"STREAK_3",   "titleAr":"سلسلة 3 أيام",  "titleEn":"3-day streak",  "type":"gold","earned":true    },
      { "id":"streak-7",   "key":"STREAK_7",   "titleAr":"سلسلة 7 أيام",  "titleEn":"7-day streak",  "type":"gold","earned":true    },
      { "id":"prayers-all","key":"PRAYERS_ALL_TODAY","titleAr":"صلوات اليوم كاملة","titleEn":"All prayers today","type":"silver","earned":false },
      { "id":"streak-14",  "key":"STREAK_14",  "titleAr":"سلسلة 14 يوماً", "titleEn":"14-day streak", "type":"silver","earned":false }
    ]
  },

  // ==== CARD 2: سلسلة الحسنات (10 slot checkmark row, 9 filled) ====
  "streakCard": {
    "days": 9,
    "labelAr": "سلسلة الحسنات",
    "labelEn": "Good deeds streak",
    "unitAr": "يوم متواصل",
    "unitEn": "Consecutive days",
    // fixed 10 boxes (displayDaysCount=10):
    "displayDaysCount": 10,
    "displayDays": [
      { "date":"2025-09-11", "completed":true, "inCurrentStreak":true,  "index":1 },
      { "date":"2025-09-12", "completed":true, "inCurrentStreak":true,  "index":2 },
      { "date":"2025-09-13", "completed":true, "inCurrentStreak":true,  "index":3 },
      { "date":"2025-09-14", "completed":true, "inCurrentStreak":true,  "index":4 },
      { "date":"2025-09-15", "completed":true, "inCurrentStreak":true,  "index":5 },
      { "date":"2025-09-16", "completed":true, "inCurrentStreak":true,  "index":6 },
      { "date":"2025-09-17", "completed":true, "inCurrentStreak":true,  "index":7 },
      { "date":"2025-09-18", "completed":true, "inCurrentStreak":true,  "index":8 },
      { "date":"2025-09-19", "completed":true, "inCurrentStreak":true,  "index":9 },
      { "date":"2025-09-20", "completed":false,"inCurrentStreak":false, "index":10 }
    ],
    // variable-length consecutive streak (for animations, usually equal to streakDays):
    "recentDays": [
      { "date":"2025-09-11","completed":true,"index":1 },
      { "date":"2025-09-12","completed":true,"index":2 },
      { "date":"2025-09-13","completed":true,"index":3 },
      { "date":"2025-09-14","completed":true,"index":4 },
      { "date":"2025-09-15","completed":true,"index":5 },
      { "date":"2025-09-16","completed":true,"index":6 },
      { "date":"2025-09-17","completed":true,"index":7 },
      { "date":"2025-09-18","completed":true,"index":8 },
      { "date":"2025-09-19","completed":true,"index":9 }
    ]
  },

  // ==== CARD 3: ملخص الاسبوع (4 % bars, same order as screenshot) ====
  "weeklySummaryCard": {
    "period": { "from":"2025-09-14", "to":"2025-09-20", "days":7 },
    "categories": [
      { "key":"PRAYER",  "keyAr":"الصلاة", "keyEn":"Prayers",
        "percent":95, "color":"emerald",
        "descriptionAr":"إتمام الصلوات الخمس خلال الأسبوع",
        "descriptionEn":"Completion of 5 daily prayers throughout the week" },
      { "key":"QURAN",   "keyAr":"القرآن", "keyEn":"Quran",
        "percent":90, "color":"indigo",
        "descriptionAr":"قراءة صفحات القرآن الكريم",
        "descriptionEn":"Daily Holy Quran pages read" },
      { "key":"SADAQAH", "keyAr":"الصدقة", "keyEn":"Sadaqah",
        "percent":75, "color":"indigo",
        "descriptionAr":"الصدقات المالية والمعنوية المسجلة",
        "descriptionEn":"Recorded monetary + non-monetary sadaqah" },
      { "key":"ADHKAR",  "keyAr":"الذكار", "keyEn":"Dhikr",
        "percent":85, "color":"amber",
        "descriptionAr":"أذكار الصباح والمساء اليومية",
        "descriptionEn":"Daily morning & evening remembrances" }
    ]
  },

  // ==== CARD 4: الكالندر الشهري (September 2025 heatmap) ====
  "monthlyCalendarCard": {
    "month": {
      "number": 9,
      "year": 2025,
      "nameAr": "سبتمبر",
      "nameEn": "September"
    },
    // 7-item weekday header — Sunday=index 0 (اليوم), Saturday=index 6 (السبت):
    "weekdayHeaders": [
      { "keyEn":"Sun","keyAr":"اليوم",  "en":"Sun","ar":"يوم" },
      { "keyEn":"Mon","keyAr":"الاثنين","en":"Mon","ar":"اث"  },
      { "keyEn":"Tue","keyAr":"الثلاثاء","en":"Tue","ar":"ثلا" },
      { "keyEn":"Wed","keyAr":"الأربعاء","en":"Wed","ar":"اربع"},
      { "keyEn":"Thu","keyAr":"الخميس","en":"Thu","ar":"خمي" },
      { "keyEn":"Fri","keyAr":"الجمعة","en":"Fri","ar":"جمع" },
      { "keyEn":"Sat","keyAr":"السبت", "en":"Sat","ar":"سبت" }
    ],
    // One cell per day of the month — 30 cells for September. Only 7 example cells shown below (correspond to screenshot week-row Sept 14→20). All 30 returned in reality:
    "cells": [
      // … 1..13 cells omitted for brevity. Example visible screenshot week row (14 Sun → 20 Sat):
      { "date":"2025-09-14","day":14,"dayAr":"١٤","weekdayIndex":0,"status":"done",   "overallPercent":92,"prayersCompleted":5,"quranPages":4,"adhkarCompleted":true, "sadaqahAmount":50, "isToday":false },
      { "date":"2025-09-15","day":15,"dayAr":"١٥","weekdayIndex":1,"status":"done",   "overallPercent":95,"prayersCompleted":5,"quranPages":3,"adhkarCompleted":true, "sadaqahAmount":30, "isToday":false },
      { "date":"2025-09-16","day":16,"dayAr":"١٦","weekdayIndex":2,"status":"done",   "overallPercent":88,"prayersCompleted":5,"quranPages":4,"adhkarCompleted":true, "sadaqahAmount":100,"isToday":false },
      { "date":"2025-09-17","day":17,"dayAr":"١٧","weekdayIndex":3,"status":"done",   "overallPercent":91,"prayersCompleted":5,"quranPages":5,"adhkarCompleted":true, "sadaqahAmount":0,  "isToday":false },
      { "date":"2025-09-18","day":18,"dayAr":"١٨","weekdayIndex":4,"status":"done",   "overallPercent":89,"prayersCompleted":5,"quranPages":4,"adhkarCompleted":true, "sadaqahAmount":20, "isToday":false },
      { "date":"2025-09-19","day":19,"dayAr":"١٩","weekdayIndex":5,"status":"done",   "overallPercent":93,"prayersCompleted":5,"quranPages":4,"adhkarCompleted":true, "sadaqahAmount":150,"isToday":false },
      { "date":"2025-09-20","day":20,"dayAr":"٢٠","weekdayIndex":6,"status":"partial","overallPercent":42,"prayersCompleted":2,"quranPages":1,"adhkarCompleted":false,"sadaqahAmount":0,  "isToday":true  }
      // … cells 21–30 (or 31) continue.
    ],
    "daysInMonth": 30,
    "todayDate": "2025-09-20"
  },

  // ---- bonus mini sections (already rendered on home cards; reuse for future animations/bottom rows): ----
  "todayTiles": {
    "quran":   { "pages":3, "goal":4, "percent":75 },
    "prayers": { "completed":2, "total":5, "percent":40,
                 "detailedPrayers":[ { "key":"FAJR", "order":1, "nameAr":"الفجر", "nameEn":"Fajr", "timeHintAr":"قبل شروق الشمس", "timeHintEn":"Before sunrise", "completed":true, "completedAt":"…" }, /*+ 4 more rows */ ] },
    "adhkar":  { "morningCompleted":false, "eveningCompleted":true, "overallCompleted":false, "percent":50 },
    "sadaqah": { "amount":0, "goal":1000, "percent":0, "currency":"EGP", "currencyLabelAr":"جنيه", "currencyLabelEn":"EGP" }
  },
  "dailyChallenge": {
    "titleAr":"إفطار صائم",
    "titleEn":"Feed a fasting person",
    "descriptionAr":"أفطر صائماً ولو بماء أو تمر",
    "descriptionEn":"Give a fasting person food or water or a date.",
    "rewardPoints": 120,
    "targetValue": 1,
    "completed": false,
    "claimed": false
  }
}
```

---

## 3. STANDALONE AUX ENDPOINTS (optional lazy-load or swipe)

For Flutter lazy reloads / monthly swipes — same data as the dashboard sub-cards, exposed standalone so you don't have to re-fetch the whole dashboard just to reload one widget:

### 3.1 `GET /journey/weekly-summary` — Weekly 4-percent bars standalone
```
Query: ?days=N (default=7, 1..365)
```
Returns exactly `data.weeklySummaryCard` shape: `{ period: {from,to,days}, categories:[…4 bars…] }`.

### 3.2 `GET /journey/monthly-heatmap` — Month heatmap standalone (swipe prev/next month via arrows)
```
Query: ?month=1..12 (default current month)
       ?year=YYYY   (default current year)
```
Returns exactly `data.monthlyCalendarCard` shape: `{ month, weekdayHeaders, cells, daysInMonth, todayDate }`.

Flutter swipe UX pattern:
- on left swipe → month-1; on right swipe → month+1 (wrap year at 1/12 boundaries)
- pass month,year query on every change; re-render grid
- First cell's `weekdayIndex` tells Flutter how many empty columns before day 1 of that month.
- Cell `status` → color rule in Flutter:
  - `future` → pale gray (non-clickable)
  - `missed` (0%) → empty white bordered box
  - `partial` (1–79%) → 25% opacity of theme primary
  - `done` (≥ 80%) → solid theme primary + checkmark overlay
- Additionally: cell.`isToday === true` → render ring/today indicator around cell, even when empty.

---

## 4. EXISTING LEGACY ENDPOINTS — preserved 100% intact (unchanged contracts)

These are already live and bound to Flutter today. They remain 100% unchanged. For the new Journey screen, the Flutter developer **can** continue calling the old multi-call pattern if desired; the dashboard endpoint (#2) is only a new addition that simplifies things.

### 4.1 `GET /journey/today` — Home Hub daily progress tiles (Backward compatible)
`data` shape (from openapi in route file):
```jsonc
{
  "date":"2026-07-27",
  "quran":        { "pages":3, "goal":4, "percent":75 },
  "adhkar":       { "morningCompleted":true, "eveningCompleted":false, "overallCompleted":false, "percent":50 },
  "sadaqah":      { "amount":350,"goal":1000,"percent":35, "currency":"EGP","currencyLabelAr":"جنيه","currencyLabelEn":"EGP" },
  "prayers":      { "completed":3,"total":5,"percent":60 },
  "overallPercent":58.75,
  // — also now (additive, never removed): streak, level, badges[], dailyChallenge, tasks[] etc
}
```

### 4.2 `GET /journey/progress?days=7` — Daily breakdown for a trailing N days
```jsonc
{
  "periodDays": 7,
  "summary": {
    "totalQuranPages": 21, "totalSadaqahAmount": 350,
    "adhkarDaysCompleted": 5, "prayersCompletedCount": 28, "daysStreak": 7
  },
  "daily": [ /* 7 objects, each: date, quranPages, sadaqah, adhkarCompleted, prayersCompleted, overallPercent */ ]
}
```

### 4.3 `GET /journey/badges` — 5 medals standalone + level/streak metadata
```jsonc
{
  "badges":[/* 5 items */], "streakDays":9, "streak":{/* streakCard shape */},
  "level":6, "rankTitleAr":"عبد شاكر", "rankTitleEn":"Grateful servant",
  "levelProgressPercent":17, "points":1620, "pointsToNextLevel":580
}
```

### 4.4 4 WRITE ACTIONS (PATCH/POST) — track daily deeds

#### (a) `PATCH /journey/quran-pages` — Set Quran pages read today
Body: `{ "pages": 4 }` (0…604). **Existing Flutter contract.**
Response `data`: `{date, quranPages:4, goal:4, percent:100, overallPercent:65}`.

#### (b) `POST /journey/quran-pages/increment` — Add N MORE pages to today
Body: `{ "pages": 2 }` (default 1, 1…604).
Response `data`: `{date, quranPages:6, addedPages:2, goal:4, percent:150, overallPercent:68}`.

#### (c) `PATCH /journey/adhkar` — Mark morning/evening/all adhkar
Body (any subset):
```jsonc
{ "completed": true }                              // marks both morning+evening as completed.
// OR more granular:
{ "morningCompleted": true, "eveningCompleted": false, "categoryKey": "MORNING_WIRD" }
```
Response `data`: `{morningCompleted, eveningCompleted, overallCompleted, adhkarCompleted, percent:0..100}`.

#### (d) `PATCH /journey/sadaqah` — Get/Patch today sadaqah (tracking-only, NO PAYMENTS)
Body (at least one required):
```jsonc
{
  "amount": 100,                                 // existing Flutter contract
  "goal": 2000,                                  // personal daily goal EGP (doesn't reset amount)
  "category": "FOOD",                            // optional FOOD|CLOTHES|EDUCATION|MONEY|GENERAL
  "mode": "set" | "add"                          // set (default, replace amount) OR add (increment)
}
```
Response `data`: `{ sadaqahAmount:350, amount:350, date:"…", goal:2000, percent:35, currency:"EGP", currencyLabelAr:"جنيه", currencyLabelEn:"EGP" [+category, breakdown if provided] }`.

#### (e) `PATCH /journey/prayer` — Mark/unmark 1 specific prayer of today (5 daily keys)
Body: `{ "prayer":"FAJR" | "DHUHR" | "ASR" | "MAGHRIB" | "ISHA", "completed": true }`. (Case-insensitive on input, canonical uppercase always returned on output).

Response (same shape as /prayers/:id/mark endpoint for Azan screen — keeps both flows identical for Flutter):
```jsonc
{
  "date":"2026-07-27",
  "prayer":  { "key":"FAJR", "nameAr":"الفجر", "nameEn":"Fajr", "timeHintAr":"قبل شروق الشمس", "timeHintEn":"Before sunrise", "completed":true },
  "prayers": { "completed":3, "total":5, "percent":60,
               "detailedPrayers":[ {key,order,nameAr,nameEn,completed,completedAt}, /* 4 more */ ] }
}
```

---

## 5. Level Ladder (مستويات الرحلة — 10 تدرجات)

Source of truth for levels: `User.points` field. Backend derives level/rank deterministically. Ranks are cached constants (10 levels, new-user start at level 1). For Flutter display — the same 10 titles are hardcoded below.

| Level | minPoints needed | rankTitleAr | rankTitleEn |
|---|---|---|---|
| 1   | 0        | مؤمن جديد | New believer |
| 2   | 100      | مجتهد | Diligent |
| 3   | 300      | مواظب | Consistent |
| 4   | 600      | مداوم | Persistent |
| 5   | 1,000    | عابد | Worshipper |
| **6** | **1,500** | **عبد شاكر** | **Grateful servant ← matches your screenshot level 6** |
| 7   | 2,200    | عبد صابر | Patient servant |
| 8   | 3,000    | عبد محسن | Excellent servant |
| 9   | 4,000    | خاشع | Humble |
| 10  | 5,500    | مقرب | Close to Allah (max level) |

Backend computes: `levelProgressPercent` = % into current level toward next (e.g. 1620 pts → level 6 (min 1500) → 120 / 700 * 100 = ~17% → matches "level progress bar almost 1/5 filled" in the screenshot). `pointsToNextLevel` = next.minPoints - currentPoints (for badge UI "٥٨٠ نقطة حتى المستوي القادم").

The Journey screen Card 1 level progress bar's "filled width" = `levelCard.levelProgressPercent / 100`.

---

## 6. Streak / Good-Deeds Consecutive Days Rule

A day counts "completed" (toward streak increment or toward weekly/monthly heatmap done/partial status) if **any** of the following happened that day (so user doesn't need to do every single thing to keep streak):

- `quranPagesRead > 0` **OR**
- `morningAdhkarCompleted` **OR** `eveningAdhkarCompleted` (or `adhkarCompleted=true`) **OR**
- `sadaqahAmount > 0` **OR**
- any `prayerCompletion` row exists for the day (even 1 prayer).

This ensures users don't drop their streak if they miss 1 category but still did *something* good (merciful behavior for streak). The streak breaks only if the *entire day* has ZERO deeds — no pages, no adhkar, no sadaqah, no prayers.

---

## 7. Weekly Summary Percent Rules (ملخص الاسبوع — 4 %)

| Category | % Calculation (over N=7-day window) |
|---|---|
| **PRAYER (%)** | `Math.round( actual_prayers_completed / (N * 5) * 100 )` Max possible prayers = 7×5 = 35. |
| **QURAN (%)**  | `Math.round( total_quran_pages_in_window / (N * 4) * 100 )` Target = 4 pages/day (Noor's daily target). Clamp 0..100 if user exceeds. |
| **SADAQAH (%)** | `Max( days_with_any_sadaqah / N, total_amount / (N * sadaqahGoal) ) * 100`. Whichever gives a higher number — gives credit *either* for daily participation (donating even small daily amounts) or bulk one-time donations. |
| **ADHKAR (%)** | `Math.round( morning_completed_count + evening_completed_count / (N * 2) * 100 )`. Each day = 2 "halves" (morning + evening) independently. Total halves = N × 2. |

All percentages are `Math.round` integers 0..100 (no decimals — same UI as your screenshot 95/90/75/85 integers).

---

## 8. Monthly Calendar Heatmap cell coloring rules

Each cell `status` enum + recommend Flutter colors:

| cell.status | When | Visual (Flutter recommendation) |
|---|---|---|
| `"future"` | cell.date > todayDate | Lightest gray (e.g. surface 50 opacity) — no gesture |
| `"missed"` | overallPercent == 0, date ≤ today | White container, no check, 1px light stroke |
| `"partial"` | 0 < overallPercent < 80, date ≤ today | Filled container theme color at 30% opacity, no checkmark, maybe small tiny dot |
| `"done"` | overallPercent ≥ 80, date ≤ today | Filled container theme color (solid 100%) + white checkmark overlay (✓) |
| any + `isToday: true` | cell.date == todayDate | Draw a 2-px colored ring border indicator around the cell (draws attention regardless of status) |

Also, for Flutter accessibility: add `semanticsLabel` combining `cell.dayAr` + status (e.g. "٢٠ سبتمبر ٢٠٢٥ — اليوم — جزئي ٤٢٪").

---

## 9. Bottom Navigation Tab → Screen routing reference

From the screenshot bottom bar (Flutter):
```
الرئيسية (Home) → /prayers/today + /content/home (or /journey/today for 4 tiles)
القرآن (Quran)  → Quran routes (separate module).
التذكار (Dhikr) → Adhkar/Dhikr routes (separate module).
رحلتي  (Journey)→ ⭐ GET /journey/dashboard (or legacy: /today + /progress + /badges + /weekly-summary + /monthly-heatmap separate).
حسابي  (Profile)→ /profile/me + /profile/location + /profile/azan-preferences (see ADHAN_FEATURE_FINAL.md).
```

---

## 10. URL INDEX — every Journey endpoint

| Method | Path | Auth | Purpose |
|---|---|---|---|
| **GET** | `/journey/dashboard` | 🔐 | **🎯 ONE-SHOT for رحلتي screen** — aggregated 4 cards + metadata + today tiles + daily challenge. RECOMMENDED. |
| GET | `/journey/weekly-summary` | 🔐 | Weekly 4-bar % standalone (lazy reload). |
| GET | `/journey/monthly-heatmap` | 🔐 | Month heatmap standalone (month swiping with ?month=&year=). |
| GET | `/journey/today` | 🔐 | **Legacy** Home Hub today tiles (preserved). |
| GET | `/journey/progress?days=N` | 🔐 | **Legacy** per-day breakdown rows (preserved). |
| GET | `/journey/badges` | 🔐 | **Legacy** 5 medals + level/streak quick (preserved). |
| GET | `/journey/sadaqah` | 🔐 | **Legacy** today sadaqah detail screen payload (preserved). |
| PATCH | `/journey/quran-pages` | 🔐 | SET Quran pages today. |
| POST | `/journey/quran-pages/increment` | 🔐 | ADD N pages to today's total. |
| PATCH | `/journey/adhkar` | 🔐 | Mark morning/evening/both adhkar completed. |
| PATCH | `/journey/sadaqah` | 🔐 | UPDATE today sadaqah amount / personal goal / category (tracking only). |
| PATCH | `/journey/prayer` | 🔐 | Mark/unmark a single prayer of today. |

---

## 11. 10-POINT CHECKLIST — Flutter Dev signs off after completion ✅

| # | Item | Status |
|---|---|---|
| 1 | رحلتي Screen initial load calls `GET /journey/dashboard` (1 call, no waterfall). | ☐ |
| 2 | Level card 6 displays "6 عبد شاكر" from `levelCard`; progress bar drawn using `levelProgressPercent / 100`; 5 medals colored gold/silver per `.medals[i].type`. | ☐ |
| 3 | Streak card displays "9 يوم متواصل" from `streakCard.days`; 10 circles row painted from `displayDays[0..9]` with checkmark when `.completed==true`; hollow circle otherwise. | ☐ |
| 4 | Weekly summary 4 bars order matches: الصلاة (emerald 95%) / القرآن (indigo 90%) / الصدقة (indigo 75%) / الذكار (amber 85%) — values: `.categories[i].percent`; colors: `.categories[i].color` mapped to Noor theme tokens. | ☐ |
| 5 | Month heatmap renders September 2025 with `weekdayHeaders[0..6]` labels Sunday=0 (اليوم) → Saturday=6 (السبت); cells offset by first cell weekdayIndex; today cell highlighted with `isToday` ring; status colors as §8. | ☐ |
| 6 | User taps prev/next arrows on calendar → calls `/journey/monthly-heatmap?month=X&year=Y`. | ☐ |
| 7 | On any daily deed update (mark prayer done, add Quran page, mark sadaqah amount, mark adhkar) → Flutter **optimistically updates local UI** THEN calls the matching PATCH/POST endpoint, THEN if response success → refresh dashboard `/journey/dashboard` silently once (no loading indicator) so points, streak, week %, calendar all recompute server-side. | ☐ |
| 8 | Badge achievement animations (new medal earned: streak7, prayersAllToday, streak14) show confetti/motion on the Flutter side whenever `badges[i].earned` transitions from `false → true` after a write+refresh. | ☐ |
| 9 | Streak logic validates — if user misses 1 full day (0 deeds) → streak resets; partial day (1+ deeds) → streak continues (rule §6). | ☐ |
| 10 | Every journey endpoint respects the Standard Envelope (§0) — first check `success=true` before reading `data`; gracefully handle 401 by redirecting to login. | ☐ |

---

## 12. Changelog (2026-09-23 — Final v1.0)

- **Added 3 new additive non-breaking GET endpoints:**
  1. `GET /journey/dashboard` — master one-shot aggregate for شاشة رحلتي matching the 4 UI cards exactly (level, streak 10-check, weekly 4-bars %, September-style heatmap grid) + today tiles + daily challenge + top-level badges/streak/points metadata.
  2. `GET /journey/weekly-summary?days=N` — standalone 4 weekly percentage bars (lazy reload).
  3. `GET /journey/monthly-heatmap?month=&year=` — standalone swipeable prev/next month calendar cells with Eastern Arabic digits (١..٣١), weekday index, 4-tier status enum, per-day overallPercent + isToday flag.
- **TypeScript compiled 0 errors, GetDiagnostics clean.**
- **Preserved 100% existing response contracts for every pre-existing legacy Journey endpoint** (/today, /progress, /badges, /sadaqah GET/PATCH, /quran-pages PATCH/POST increment, /adhkar PATCH, /prayer PATCH). **No Flutter regressions risk.**
- **Weekly % calculation definitions formally specified and normalized for the first time** (Prayer/Quran/Sadaqah/Dhikr formulas in §7).
- **Streak day "counted" rule formally defined mercifully** — user keeps streak if they did ANY good deed (doesn't have to max every category every day).

Backward compatibility promise: even if Flutter doesn't use `/journey/dashboard` and continues using the legacy 7 individual endpoints, everything works forever; dashboard is an additive shortcut only.
