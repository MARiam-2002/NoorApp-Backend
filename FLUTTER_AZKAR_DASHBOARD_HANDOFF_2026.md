# Flutter Azkar Screen + Dashboard Journey Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-11  
**Language:** English only  

**Backend status:** Azkar hub catalog + progress APIs were already present. This pass **unifies** Azkar screen progress with Dashboard `dailyJourney.adhkar` via one ledger (`DailyDhikrCompletion` → derived `DailyProgress`). Existing Flutter field names are preserved; new Dashboard fields are **additive**.

**Related:** [`FLUTTER_ADHKAR_INTEGRATION_GUIDE.md`](FLUTTER_ADHKAR_INTEGRATION_GUIDE.md)

---

## 1. Goal

| Screen | Backend |
|--------|---------|
| Azkar tab (categories + وردك اليوم) | `GET /adhkar`, category detail, `PUT /adhkar/progress` |
| Home Dashboard Azkar tile | `GET /dashboard` → `dailyJourney.adhkar` |
| Journey “رحلتي” Adhkar | `GET /journey/today` + optional `PATCH /journey/adhkar` |

**Same source of truth:** item taps stored in `DailyDhikrCompletion` for **today**. Morning / evening / daily-wird completion **derive** `DailyProgress` flags used by Dashboard.

---

## 2. Endpoints Flutter should use

### Azkar screen (existing)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/adhkar` | Optional Bearer | Home: greeting + `dailyWird` + `categories` |
| `GET` | `/adhkar/categories/:key` | Optional Bearer | Category detail + items |
| `GET` | `/adhkar/progress?categoryKey=` | **Bearer** | Per-item tap progress |
| `PUT` | `/adhkar/progress` | **Bearer** | `{ categoryKey, itemId, tapCount }` |
| `GET` | `/adhkar/search?q=` | Public | Search (optional; local filter also OK) |
| `GET` | `/adhkar/favorites` | Bearer | Favorites |
| `GET` | `/adhkar/full-catalog` | Public | Offline pack |

### Dashboard / Journey (existing paths)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/dashboard` | Bearer |
| `GET` | `/journey/today` | Bearer |
| `PATCH` | `/journey/adhkar` | Bearer (optional manual override) |

**After `PUT /adhkar/progress`, refresh Dashboard** (or rely on next `GET /dashboard`) — Backend already synced `DailyProgress`.

---

## 3. Response structures (preserved)

### `GET /adhkar` → `data.dailyWird` (hub card)

```json
{
  "titleAr": "وردك اليوم",
  "progressItemsDone": 4,
  "progressItemsTotal": 8,
  "progressPercent": 50,
  "ctaAr": "اكمل وردك اليوم",
  "categoryKey": "GENERAL_WIRD",
  "items": [{ "id", "textAr", "repeatCount", "referenceAr", "benefitAr", "orderInCategory" }]
}
```

Use **`progressItemsDone` / `progressItemsTotal` / `progressPercent` as-is** (do not recompute). Goal is **8** items from `GENERAL_WIRD`.

### `PUT /adhkar/progress` body

```json
{ "categoryKey": "MORNING", "itemId": "<uuid>", "tapCount": 3 }
```

Returns progress object with `items[]`, `progressItemsDone`, `progressItemsTotal`, `progressPercent`, `markedItemId`.

### Dashboard `dailyJourney.adhkar` (existing + additive)

```json
{
  "completed": true,
  "labelAr": "الأذكار",
  "labelEn": "Adhkar",
  "captionAr": "تم الانتهاء من وردك اليومي ✅",
  "captionEn": "Daily wird completed ✅",
  "progressItemsDone": 8,
  "progressItemsTotal": 8,
  "progressPercent": 100
}
```

| Field | Status |
|-------|--------|
| `completed` | **Existing** — Flutter tile / “تم الانجاز” |
| labels / captions | Existing |
| `progressItemsDone/Total/Percent` | **Additive** — same numbers as hub card |

---

## 4. How shared progress works

```text
PUT /adhkar/progress
  → upsert DailyDhikrCompletion (userId + today + item)
  → syncJourneyAdhkarFromDhikr()
       MORNING all done     → morningAdhkarCompleted
       EVENING all done     → eveningAdhkarCompleted
       GENERAL_WIRD first 8 → wirdDone
       adhkarCompleted = wirdDone OR (morning && evening)
       if wirdDone → also set morning+evening (Journey percent 100%)
  → DailyProgress row for today updated

GET /dashboard / GET /journey/today
  → re-sync from DailyDhikrCompletion then read DailyProgress
```

**No second progress system.** No duplicate daily records beyond the existing unique `(userId, date)` on `DailyProgress` and `(userId, date, category, item)` on completions.

### Daily reset

Completions and `DailyProgress` are keyed by **calendar date (UTC date-only)**. Yesterday does not appear in today’s counts.

### Guests

- Catalog / `GET /adhkar` without Bearer remains public.
- Guest hub progress may still be cosmetic until login.
- Progress writes require auth (**401** without Bearer).

---

## 5. What was already there vs what changed

| Already existed | This pass |
|-----------------|-----------|
| Categories, items, Arabic text, repeatCount | Unchanged |
| `GET /adhkar`, progress PUT/GET, favorites, search, catalog | Unchanged paths/fields |
| Dashboard `dailyJourney.adhkar.completed` | Still present |
| Separate stores (completions vs DailyProgress) | **Bridged** — sync on write + read |
| GENERAL_WIRD progress total could be 10 | **Capped to 8** to match hub |
| `PATCH /journey/adhkar` + GENERAL_WIRD → morning only | **Fixed** → marks morning+evening |

---

## 6. Flutter wiring checklist

1. Send **Bearer** on Azkar progress and on Dashboard.  
2. Paint hub from `GET /adhkar` (`dailyWird` + `categories`).  
3. On each completed repetition: `PUT /adhkar/progress`.  
4. Home tile: bind `dailyJourney.adhkar.completed` (optional: show fraction from additive fields).  
5. Do **not** invent a local-only Dashboard completed flag that disagrees with Backend after sync.  
6. Preserve all prior Quran / Prayer / Sadaqah / Hadith contracts.

---

## 7. FLUTTER HANDOFF STATUS

**READY** — use existing Azkar endpoints; Dashboard Adhkar Journey now follows the same daily completion ledger.
