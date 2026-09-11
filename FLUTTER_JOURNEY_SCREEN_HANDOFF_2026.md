# Flutter Journey Screen (“رحلتي”) Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-12  
**Language:** English only  

**Backend status:** The Journey screen (level + rank + medals + good-deeds streak) is **fully supported** on Production via additive fields on existing endpoints. Daily activity tiles continue to use the same `DailyProgress` / Azkar / Prayer ledgers as Dashboard. **No duplicate progress system.**

**Related:** [`FLUTTER_AZKAR_DASHBOARD_HANDOFF_2026.md`](FLUTTER_AZKAR_DASHBOARD_HANDOFF_2026.md) · [`FLUTTER_PRAYER_SCREEN_HANDOFF_2026.md`](FLUTTER_PRAYER_SCREEN_HANDOFF_2026.md) · [`FLUTTER_SADAQAH_HADITH_HANDOFF_2026.md`](FLUTTER_SADAQAH_HADITH_HANDOFF_2026.md)

---

## 1. Screen map → Backend

| UI element (Arabic) | Backend source | Fields |
|---------------------|----------------|--------|
| المستوى الحالي (level number) | `GET /journey/today` | `level` |
| Rank title (e.g. عبد شاكر) | same | `rankTitleAr` / `rankTitleEn` |
| Level progress bar | same | `levelProgressPercent` (0–100) |
| Optional XP labels | same | `points`, `pointsInLevel`, `pointsToNextLevel`, `nextLevel`, `nextRankTitleAr/En`, `isMaxLevel` |
| 5 medal icons | same | `badges[]` (exactly **5**; use `earned`) |
| سلسلة الحسنات count | same | `streak.days` **or** existing `streakDays` |
| يوم متواصل labels | same | `streak.labelAr/En`, `streak.unitAr/En` |
| Streak checkmark row | same | `streak.recentDays[]` (`date`, `completed`, `index`) |

**Primary endpoint:** `GET /journey/today` (Bearer required).

**Optional:** `GET /journey/badges` also returns `badges`, `streakDays`, plus the same additive `streak` / `level` / `rankTitle*` / `levelProgressPercent` / `points*`.

---

## 2. Endpoints (unchanged paths)

| Method | Path | Auth | Use on this screen |
|--------|------|------|--------------------|
| `GET` | `/journey/today` | Bearer | **Primary** — level card + streak + tasks + badges |
| `GET` | `/journey/badges` | Bearer | Badges / streak subset (additive level fields included) |
| `GET` | `/journey/progress?days=` | Bearer | History (optional; not required for hero cards) |
| `PATCH` | `/journey/quran-pages` | Bearer | Daily Quran task |
| `PATCH` | `/journey/adhkar` | Bearer | Adhkar override (writes Dhikr ledger) |
| `PATCH` | `/journey/prayer` | Bearer | Prayer toggles |
| `GET`/`PATCH` | `/journey/sadaqah` | Bearer | Sadaqah |

Dashboard Home tiles remain on `GET /dashboard` → `dailyJourney` (same `DailyProgress` truth).

---

## 3. Additive response contract (`GET /journey/today`)

### 3.1 Existing (do not break)

`date`, `tasks[]`, `streakDays`, `badges[]`, `points`, `overallPercent`, `dailyChallenge`, `quran`, `adhkar`, `sadaqah`, `prayers`, flat aliases (`quranPagesRead`, `adhkarCompleted`, …).

### 3.2 Additive — level card

```json
{
  "level": 6,
  "rankTitleAr": "عبد شاكر",
  "rankTitleEn": "Grateful servant",
  "levelProgressPercent": 17,
  "points": 1600,
  "pointsInLevel": 100,
  "pointsToNextLevel": 600,
  "nextLevel": 7,
  "nextRankTitleAr": "عبد صابر",
  "nextRankTitleEn": "Patient servant",
  "isMaxLevel": false
}
```

**Level source of truth:** `User.points` → fixed ladder in Backend (`journey-levels`). `User.level` is kept in sync when Journey loads or a challenge reward is claimed.

### 3.3 Additive — streak card

```json
{
  "streakDays": 9,
  "streak": {
    "days": 9,
    "labelAr": "سلسلة الحسنات",
    "labelEn": "Good deeds streak",
    "unitAr": "يوم متواصل",
    "unitEn": "Consecutive days",
    "recentDays": [
      { "date": "2026-09-04", "completed": true, "index": 1 },
      { "date": "2026-09-12", "completed": true, "index": 9 }
    ]
  }
}
```

**Streak rule (unchanged):** consecutive calendar days with any of: Quran pages > 0, morning/evening Adhkar, or sadaqah > 0. `recentDays` length = `streakDays` (capped at 30).

### 3.4 Badges (5 medals)

| Order | `key` | Earn when |
|-------|-------|-----------|
| 1 | `FIRST_STEPS` | Always (account created) |
| 2 | `STREAK_3` | `streakDays >= 3` |
| 3 | `STREAK_7` | `streakDays >= 7` |
| 4 | `PRAYERS_ALL_TODAY` | 5/5 prayers today |
| 5 | `STREAK_14` | `streakDays >= 14` |

Each: `{ id, key, titleAr, titleEn, earned, earnedAt }`. Paint gold when `earned === true`.

---

## 4. Exact Flutter wiring

1. `GET /journey/today` with Bearer.  
2. Level card: `level`, `rankTitleAr`, bar from `levelProgressPercent`.  
3. Medals: `badges` in order; `earned` → filled vs locked.  
4. Streak card: `streak.days` (or `streakDays`), labels from `streak.*`, checkmarks from `streak.recentDays`.  
5. Do **not** invent a second streak/level store offline that disagrees after sync.  
6. Daily task cards (if still shown elsewhere): keep using existing `tasks[]` / nested quran/prayer/adhkar/sadaqah.

---

## 5. Auth & ownership

All Journey routes require Bearer. Data is scoped to `req.user.sub` only.

---

## 6. What existed vs what changed

| Already existed | This pass |
|-----------------|-----------|
| `/journey/today`, tasks, points, overallPercent, streakDays, 4 badges | Unchanged paths |
| `User.points` / `User.level` | Level now **derived from points** + exposed on Journey |
| Computed badges | Expanded to **5**; order matches medals UI |
| Streak count | Additive `streak` object + `recentDays` checkmarks |
| Rank titles | **New** ladder constants (عبد شاكر at level 6) |
| DailyProgress / Azkar / Prayer ledgers | Unchanged — still shared with Dashboard |

**Not changed:** payment, Azan, Quran APIs, Dashboard nesting, existing Journey field names.

---

## 7. Remaining notes (not blockers)

| Note | Detail |
|------|--------|
| Quran daily goal | Journey task goal remains **4** pages; Dashboard tile target remains **5**. Both read the same `quranPagesRead` count. Aligning the goal number is a product decision — left unchanged to preserve contracts. |
| Badge icons | Backend sends keys/titles only; Flutter owns medal artwork. |
| Overview/weekly stats helpers | Exist in service but are unused by this screen; not required. |

---

## 8. Production checklist

- [x] `GET /journey/today` returns `level`, `rankTitleAr`, `levelProgressPercent`  
- [x] `badges.length === 5` with `earned` booleans  
- [x] `streak.days` matches `streakDays`; `recentDays` length matches streak (≤30)  
- [x] Unauthenticated Journey → 401  
- [x] Existing fields preserved  

**FLUTTER HANDOFF STATUS: READY**
