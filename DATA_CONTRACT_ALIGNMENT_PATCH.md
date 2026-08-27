# Noor App — Flutter Integration Guide — 2026-08-28 (Data Contract Alignment Patch)

## 🔹 API Integration Changes Summary — 2026-08-28

- **Updated (BREAKING)**: `expiresIn` type change on all auth token responses. `data.tokens.expiresIn` is now a **number** (seconds integer, e.g. `604800` for 7 days) instead of a raw duration string (`"7d"`). Flutter models that parse `expiresIn` as `String` must switch to `int`. Affected endpoints: `POST /auth/sign-up`, `POST /auth/login`, `POST /auth/google`, `POST /auth/refresh`.
- **Updated**: Tasbih response shape enriched on all 4 endpoints (`GET /tasbih/today`, `POST /tasbih/increment`, `POST /tasbih/reset`, `PATCH /tasbih/change-dhikr`). Three new fields are now present in every response: `dhikrAr` (Arabic display name, e.g. `"سبحان الله"`), `dailyGoal` (integer, default `99`), `progressPercent` (integer `0..100`, clamped). These were previously absent and Flutter had to derive them locally.
- **Updated**: Bookmark responses now include a top-level `surahNameAr` string field alongside the existing nested `surah.nameAr`. Applies to both `GET /quran/bookmarks` (list) and `POST /quran/bookmarks` (create). Flutter can read either `bookmark.surahNameAr` or `bookmark.surah.nameAr` — both are guaranteed to be real Arabic names, never bare numeric ids.
- **Updated**: `GET /journey/today` response shape expanded. The flat `{ quranPagesRead, adhkarCompleted, sadaqahAmount }` payload is now wrapped inside a richer structure with `date`, `tasks[]`, `streakDays`, `badges`, `points`, and `overallPercent`. The original flat fields are retained at root level for backward compatibility. See full shape below.
- **New**: `GET /adhkar/progress` (Bearer) — returns per-item tap counts and completion state for a given dhikr category today. Query parameter: `?categoryKey=MORNING`. Used to resume the adhkar screen exactly where the user left off.
- **New**: `PUT /adhkar/progress` (Bearer) — persists a single dhikr item tap count and returns the full updated category progress. Body: `{ categoryKey, itemId, tapCount }`. Replaces the previous SharedPreferences-only `adhkar_resume_{CATEGORY}` local state.
- No endpoints were removed, renamed, or re-ordered in this change set.

### Change Totals (2026-08-28 batch)

- New endpoint documentation entries: **2** (`GET /adhkar/progress`, `PUT /adhkar/progress`)
- Updated documentation entries: **4** (Auth `expiresIn`, Tasbih enrichment, Bookmark `surahNameAr`, Journey today shape)
- Removed documentation entries: 0

---

## 1) Auth — `expiresIn` is now a seconds integer

### Before (≤ 2026-08-27)

```json
{
  "data": {
    "user": { "id": "…", "fullName": "…", "email": "…", "provider": "LOCAL", "providerId": null },
    "tokens": {
      "accessToken": "eyJ…",
      "refreshToken": "eyJ…",
      "expiresIn": "7d"
    }
  }
}
```

### After (2026-08-28)

```json
{
  "data": {
    "user": { "id": "…", "fullName": "…", "email": "…", "provider": "LOCAL", "providerId": null },
    "tokens": {
      "accessToken": "eyJ…",
      "refreshToken": "eyJ…",
      "expiresIn": 604800
    }
  }
}
```

### Flutter migration

```dart
// Before:
// final expiresIn = tokens['expiresIn'] as String; // "7d"

// After:
final expiresIn = tokens['expiresIn'] as int; // 604800 (seconds)
final expiresAt = DateTime.now().add(Duration(seconds: expiresIn));
```

Affected endpoints: `POST /auth/sign-up`, `POST /auth/login`, `POST /auth/google`, `POST /auth/refresh`.

---

## 2) Tasbih — three new fields on every response

### Endpoints affected

| Method | Path | Auth |
|--------|------|------|
| GET | `/tasbih/today` | Bearer |
| POST | `/tasbih/increment` | Bearer |
| POST | `/tasbih/reset` | Bearer |
| PATCH | `/tasbih/change-dhikr` | Bearer |

### New `data` shape (all 4 endpoints return the same shape)

```json
{
  "success": true,
  "message": "Today tasbih retrieved successfully",
  "data": {
    "id": "uuid",
    "date": "2026-08-28T00:00:00.000Z",
    "dhikr": "SUBHAN_ALLAH",
    "dhikrAr": "سبحان الله",
    "count": 33,
    "totalAllTime": 1200,
    "dailyGoal": 99,
    "progressPercent": 33
  },
  "meta": null,
  "timestamp": "2026-08-28T01:30:00.000Z",
  "requestId": "uuid"
}
```

### New fields

| Field | Type | Description |
|-------|------|-------------|
| `dhikrAr` | `string` | Arabic display name for the current dhikr enum. Maps: `SUBHAN_ALLAH` → `سبحان الله`, `ALHAMDULILLAH` → `الحمد لله`, `LA_ILAHA_ILLA_ALLAH` → `لا إله إلا الله`, `ALLAHU_AKBAR` → `الله أكبر`, `ASTAGHFIRULLAH` → `أستغفر الله`, `LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH` → `لا حول ولا قوة إلا بالله`. |
| `dailyGoal` | `int` | Daily tasbih target. Currently fixed at `99`. |
| `progressPercent` | `int` | `min(100, round(count / dailyGoal * 100))`. Clamped to `0..100`. |

### Flutter migration

```dart
// Before (Flutter computed locally):
// final dhikrAr = _localDhikrMap[data.dhikr] ?? data.dhikr;
// final percent = (data.count / 99 * 100).round().clamp(0, 100);

// After (server provides):
final dhikrAr = data['dhikrAr'] as String;       // "سبحان الله"
final dailyGoal = data['dailyGoal'] as int;       // 99
final percent = data['progressPercent'] as int;   // 33
```

Existing fields (`id`, `date`, `dhikr`, `count`, `totalAllTime`) are unchanged. Aliases `todayCount`, `currentDhikr`, `currentDhikrAr`, `currentDhikrCount` remain accepted per the data contract.

---

## 3) Bookmarks — `surahNameAr` top-level alias

### Endpoints affected

| Method | Path | Auth |
|--------|------|------|
| GET | `/quran/bookmarks` | Bearer |
| POST | `/quran/bookmarks` | Bearer |

### New `data[]` item shape

```json
{
  "id": "uuid",
  "userId": "uuid",
  "surahId": 2,
  "ayahNumber": 255,
  "page": 42,
  "note": null,
  "textAr": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ …",
  "surahNameAr": "البقرة",
  "surah": {
    "id": 2,
    "nameEn": "Al-Baqarah",
    "nameAr": "البقرة"
  },
  "createdAt": "2026-08-28T01:30:00.000Z"
}
```

### New field

| Field | Type | Description |
|-------|------|-------------|
| `surahNameAr` | `string` | Top-level convenience alias for `surah.nameAr`. Always a real Arabic name, never a bare numeric id. |

### Flutter migration

```dart
// Before:
// final surahName = bookmark['surah']?['nameAr'] ?? resolveSurahNameAr(bookmark['surahId']);

// After (either works):
final surahName = bookmark['surahNameAr'] as String;  // "البقرة" — preferred
// or
final surahName = bookmark['surah']['nameAr'] as String;  // still works
```

No local catalog fallback (`resolveSurahNameAr`) is needed anymore — the backend guarantees real names on every surface.

---

## 4) Journey Today — enriched `tasks[]` response

### `GET /journey/today` (Bearer)

### New `data` shape

```json
{
  "success": true,
  "message": "Daily journey retrieved successfully",
  "data": {
    "date": "2026-08-28",
    "tasks": [
      { "key": "quran", "titleAr": "قراءة القرآن", "done": false, "progress": 0.75 },
      { "key": "prayer", "titleAr": "الصلوات", "done": false, "progress": 0.6 },
      { "key": "adhkar", "titleAr": "الأذكار", "done": true },
      { "key": "sadaqah", "titleAr": "الصدقة", "done": false, "amount": 0 }
    ],
    "streakDays": 0,
    "badges": [],
    "points": 120,
    "overallPercent": 59,
    "quranPagesRead": 3,
    "adhkarCompleted": true,
    "sadaqahAmount": 0
  },
  "meta": null,
  "timestamp": "2026-08-28T01:30:00.000Z",
  "requestId": "uuid"
}
```

### `tasks[]` item fields

| Field | Type | Present on | Description |
|-------|------|------------|-------------|
| `key` | `string` | all | One of: `"quran"`, `"prayer"`, `"adhkar"`, `"sadaqah"` |
| `titleAr` | `string` | all | Arabic display label for the task row |
| `done` | `bool` | all | `true` when the task is fully completed today |
| `progress` | `double` | `quran`, `prayer` | `0.0..1.0` fractional progress toward today's goal |
| `amount` | `double` | `sadaqah` | Sadaqah amount in local currency |

### Backward compatibility

The three original flat fields remain at root level for any Flutter code that reads them directly:

| Field | Type | Description |
|-------|------|-------------|
| `quranPagesRead` | `int` | Raw page count (same as before) |
| `adhkarCompleted` | `bool` | Overall adhkar flag (same as before) |
| `sadaqahAmount` | `double` | Sadaqah total (same as before) |

### Flutter migration

```dart
// New tasks-based UI:
final tasks = (data['tasks'] as List).cast<Map<String, dynamic>>();
for (final task in tasks) {
  final key = task['key'] as String;
  final done = task['done'] as bool;
  final progress = (task['progress'] as num?)?.toDouble();
  // render task row...
}
final overallPercent = data['overallPercent'] as int;
```

---

## 5) Adhkar Progress — NEW sync endpoints

### Endpoints

| Method | Path | Auth | Query / Body |
|--------|------|------|--------------|
| GET | `/adhkar/progress` | Bearer | `?categoryKey=MORNING` |
| PUT | `/adhkar/progress` | Bearer | `{ categoryKey, itemId, tapCount }` |

### `GET /adhkar/progress?categoryKey=MORNING`

Returns the user's today progress for a specific dhikr category. Used to resume the adhkar detail screen exactly where the user stopped.

#### Response `data`

```json
{
  "success": true,
  "message": "Adhkar progress for MORNING retrieved",
  "data": {
    "categoryKey": "MORNING",
    "markedItemId": "item-uuid-3",
    "items": [
      { "itemId": "item-uuid-1", "tapCount": 1, "completed": true },
      { "itemId": "item-uuid-2", "tapCount": 3, "completed": true },
      { "itemId": "item-uuid-3", "tapCount": 1, "completed": false },
      { "itemId": "item-uuid-4", "tapCount": 0, "completed": false }
    ],
    "progressItemsDone": 2,
    "progressItemsTotal": 4,
    "progressPercent": 50
  },
  "meta": null,
  "timestamp": "2026-08-28T01:30:00.000Z",
  "requestId": "uuid"
}
```

#### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `categoryKey` | `string` | Uppercase category key (e.g. `MORNING`, `EVENING`, `BEFORE_SLEEP`, `GENERAL_WIRD`) |
| `markedItemId` | `string` | ID of the first non-completed item — use this to scroll-to-resume. Falls back to the last item if all are completed. |
| `items` | `array` | Per-item progress. `tapCount` is how many times the user tapped. `completed` is `true` when `tapCount >= item.repeatCount`. |
| `progressItemsDone` | `int` | Count of fully completed items |
| `progressItemsTotal` | `int` | Total items in the category |
| `progressPercent` | `int` | `round(progressItemsDone / progressItemsTotal * 100)` |

### `PUT /adhkar/progress`

Saves a single item's tap count and returns the full updated category progress (same shape as GET).

#### Request body

```json
{
  "categoryKey": "MORNING",
  "itemId": "item-uuid-3",
  "tapCount": 3
}
```

#### Request fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `categoryKey` | `string` | yes | Uppercase category key |
| `itemId` | `string` | yes | The dhikr item UUID (from `GET /adhkar/categories/:key` items) |
| `tapCount` | `int` | yes | Current tap count for this item (≥ 0) |

#### Response

Same shape as `GET /adhkar/progress` — returns the full category progress after the update.

### Flutter migration

```dart
// Before (local only — lost on app kill):
// final prefs = await SharedPreferences.getInstance();
// prefs.setString('adhkar_resume_MORNING', itemId);

// After (synced to server):
// On category open — restore state:
final resp = await api.get('/adhkar/progress?categoryKey=MORNING');
final markedItemId = resp.data['markedItemId'] as String;
final items = (resp.data['items'] as List).cast<Map<String, dynamic>>();
// scroll to markedItemId, restore tap counts from items[].tapCount

// On each tap — persist:
await api.put('/adhkar/progress', data: {
  'categoryKey': 'MORNING',
  'itemId': currentItem.id,
  'tapCount': currentTapCount,
});
```

The home screen `dailyWird.progressItemsDone` / `progressPercent` values can now be derived from real user progress instead of cosmetic defaults.

---

## 6) Updated Integration Totals

| Area                                    | Count (2026-08-28)                                        |
| --------------------------------------- | --------------------------------------------------------- |
| Screens / UI states documented          | 20                                                        |
| Endpoints covered                       | **69** (+2 from adhkar progress)                          |
| Authenticated endpoints (Bearer)        | 47 (+2)                                                   |
| Public (no Bearer) endpoints            | 22                                                        |
| HTTP statuses covered (success + error) | 200 / 201 / 204 / 400 / 401 / 403 / 404 / 409 / 500 / 503 |

---

## 7) Route Endpoint Index (new entries only)

| # | Method | Path | Auth | Module |
|---|--------|------|------|--------|
| 68 | GET | `/adhkar/progress?categoryKey=` | Bearer | Adhkar Progress |
| 69 | PUT | `/adhkar/progress` | Bearer | Adhkar Progress |

---

## 8) Quick migration checklist for Flutter

- [ ] Update `AuthTokens` model: `expiresIn` from `String` to `int` (seconds).
- [ ] Update `TasbihState` model: add `dhikrAr: String`, `dailyGoal: int`, `progressPercent: int`. Remove local computation of these values.
- [ ] Update `QuranBookmark` model: add `surahNameAr: String?` (top-level). Remove `resolveSurahNameAr()` fallback.
- [ ] Update Journey today parser: read `data.tasks[]` for the new task-based UI. Flat fields still available as fallback.
- [ ] Wire `GET /adhkar/progress` on category detail screen open to restore resume position + tap counts.
- [ ] Wire `PUT /adhkar/progress` on each dhikr item tap to persist tap count to server.
- [ ] Remove `SharedPreferences` keys `adhkar_resume_{CATEGORY}` — server is now the source of truth for signed-in users.
