# Flutter Home Daily Goal + Khatmah Plan Alignment Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`  
**Updated:** 2026-10-10  
**Language:** English  
**Backend status:** Implemented and validated locally. Railway deployment and live integration verification are still required. Do not assume production already returns the new fields.

---

## 1. What changed

The Home Quran tile, Journey Quran task, Khatmah daily-goal card, and Khatmah reminder now use one daily-goal calculation. Previously Home used a fixed target of 5 pages and Journey used 4, even when a Khatmah plan existed.

Existing routes and response field names remain available. The dashboard adds a `dailyGoal` object. Journey adds `completed`, `remainingToday`, and `source` inside `quran`.

**Important:** The 4/5 shown in the design is an example, not a fixed product target. Render the target returned by the backend.

## 2. Screen map → Backend

| UI element | Endpoint | Response fields inside `data` |
|---|---|---|
| Home: Your journey today → Quran | `GET /dashboard` | `dailyJourney.quran.pagesRead`, `dailyJourney.quran.target` |
| Home: Daily goal ring and caption | `GET /dashboard` | `dailyGoal.pagesReadToday`, `pagesTarget`, `remainingToday`, `completed`, `percent` |
| Journey: Quran task | `GET /journey/today` | `quran.pages`, `goal`, `percent`, `completed`, `remainingToday`, `source` |
| Quran/Khatmah: daily goal | `GET /quran/khatmah/stats` | `dailyGoal.pagesReadToday`, `pagesTarget`, `remainingToday`, `completed` |
| Khatmah plan: today's portion | `GET /quran/khatmah/plan` | `active`, `todayWard.pagesReadToday`, `pagesTarget`, `remainingToday`, `completed` |
| Home: Continue Khatmah | `GET /dashboard` | Existing `khatmah.surahNameAr`, `currentPage`, `progressPercent` |

These are authenticated endpoints: send `Authorization: Bearer <accessToken>`. Fields above are paths within the `data` response wrapper, not top-level response fields.

## 3. Daily-goal rules

1. **No active plan:** 5 pages per day.
2. **Active plan:** redistribute the remaining portion over the remaining plan days, rounded up. The calculation adds back pages recorded today to reconstruct the start-of-day remaining portion, so reading today does not reduce today's target.
3. **Completed plan:** target 0, completed true, remaining 0; the dashboard/Journey percentage is 100.
4. **Overdue plan:** the remaining portion is due today; the divisor is at least one day.
5. **Cleared plan:** return to the default 5-page goal.
6. **Calendar:** deadline calculations use the user's stored timezone. The reading count comes from the existing per-user daily-progress ledger.

Do not calculate a separate fixed goal in Flutter. The goal may change on a new local day or after a plan change. `source` is `khatmah_plan` or `default` where provided.

## 4. Dashboard payload examples

The following are **partial `data` objects**, not complete responses.

### 4.1 No plan: 4 pages read, 5-page target

```json
{
  "dailyJourney": {
    "quran": { "pagesRead": 4, "target": 5 }
  },
  "dailyGoal": {
    "pagesTarget": 5,
    "pagesReadToday": 4,
    "completed": false,
    "remainingToday": 1,
    "percent": 80,
    "source": "default"
  }
}
```

Suggested UI copy: **Daily goal** → **4 / 5 pages** → **1 page left to complete your daily goal**.

### 4.2 Active 30-day plan: 10 pages read, 21-page target

```json
{
  "dailyJourney": {
    "quran": { "pagesRead": 10, "target": 21 }
  },
  "dailyGoal": {
    "pagesTarget": 21,
    "pagesReadToday": 10,
    "completed": false,
    "remainingToday": 11,
    "percent": 48,
    "source": "khatmah_plan"
  }
}
```

Suggested UI copy: **Read 21 pages today** → **11 pages left to complete your daily goal**. The 21-page value is an example for a new 604-page/30-day plan; always use the response.

### 4.3 Completed Khatmah

```json
{
  "dailyGoal": {
    "pagesTarget": 0,
    "pagesReadToday": 21,
    "completed": true,
    "remainingToday": 0,
    "percent": 100,
    "source": "khatmah_plan"
  }
}
```

Render **Well done! You completed your Khatmah** with a completed ring. Do not display “Read 0 pages” or divide by zero. A `0` target is a valid value; do not replace it with 5 using a truthiness check.

## 5. Flutter parsing and rendering

- Home should prefer `data.dailyGoal` for the goal card. Continue using `data.dailyJourney.quran` for the existing Quran tile.
- Khatmah stats keeps the original four daily-goal fields; `percent` and `source` are not newly guaranteed on that endpoint.
- Clamp visual ring progress to 0–1. Reading beyond the target is allowed; show the actual count and a fully completed ring.
- For a zero target, use the backend completion state and render the completed-plan message.
- Parse new fields as optional during rollout. Ignore additional JSON fields safely.
- If `dashboard.dailyGoal` is absent, use `GET /quran/khatmah/stats` for the goal card. Avoid presenting a locally invented target as the user's plan.
- Do not confuse daily completion with lifetime Khatmah percentage or the independent daily challenge.

Example ring helper for stats responses that do not include `percent`:

```dart
double dailyGoalProgress(int pagesRead, int target, bool completed) {
  if (target <= 0) return completed ? 1.0 : 0.0;
  return (pagesRead / target).clamp(0.0, 1.0).toDouble();
}
```

## 6. Refresh and synchronization

After a **successful** reading-progress write or starting/changing/clearing a Khatmah plan:

1. Invalidate cached dashboard, Journey, Khatmah stats, and plan responses.
2. Reload visible screens from their backend endpoint.
3. Ignore older in-flight responses that arrive after the refreshed response.
4. Refresh on returning from Quran to Home/Journey, pull-to-refresh, app resume, and a new local calendar day.

Plan management remains on `/quran/khatmah/plan`. Do not optimistically mark a failed write as completed. Retain the existing reading-write contract; this patch does not add a new reading endpoint or change how pages are recorded.

## 7. Errors and rollout

No migration or new environment variable is required for this patch. Deploy the backend before relying on the new dashboard object.

A missing plan means “default goal.” A database failure is not treated as a missing plan by the new goal service. However, the existing outer dashboard outage fallback can still return the legacy default payload without `dailyGoal`; that response is not proof of current user progress. Use the stats fallback or show retry/unavailable state if a fresh goal cannot be loaded.

Production data and Flutter rendering were not tested in this local backend session. Store acceptance and unrelated Home widgets are outside this change.

## 8. Acceptance checklist

- [ ] No plan + 4 pages → target 5, remaining 1, ring 80%.
- [ ] New 30-day plan → target from API, not fixed 4/5.
- [ ] Read part of today's portion → target does not shrink because of that reading.
- [ ] Reach/exceed the target → completed true, remaining 0, full ring.
- [ ] Complete the entire plan → target 0, completed message, no divide-by-zero.
- [ ] Clear the plan → default goal on all refreshed screens.
- [ ] Change the plan → Home, Journey, and Quran show consistent refreshed targets.
- [ ] Midnight/app resume → reload the user's daily reading data.
- [ ] Failed write/network error → no false completion or stale response overwrite.
- [ ] Missing new dashboard object during rollout → stats fallback works.

## 9. Backend validation

Passed: production build, TypeScript check, existing Khatmah math, new daily-goal regressions (default, active, reading, completed, overdue, cleared, timezone boundaries, and mocked service errors), production-fix checks, and phase-one checks.

Regression command: `npm run test:khatmah-plan`.

