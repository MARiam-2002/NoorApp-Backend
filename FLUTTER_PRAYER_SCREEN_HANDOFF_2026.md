# Flutter Prayer Screen & Home Prayer Widget Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-11  
**Language:** English only  

**Backend status:** Prayer times, next-prayer countdown, Cairo defaults, **global lat/lng + timezone inference**, and personal completion for the **five obligatory prayers** are **implemented**. Sunrise is an **additive display-only** field. Existing Flutter contracts for `schedule[]` (length 5) are preserved.

**Location rule:** Cairo is only the default when no coords exist (`isDefaultLocation: true`). Query GPS or saved profile lat/lng override Cairo; Backend infers IANA timezone from coordinates when `timezone` is omitted or still the stale Prisma default `Africa/Cairo`. Optional query labels: `city`, `cityAr`, `country`, `countryAr`.

**Related:** [`FLUTTER_CAIRO_DEFAULT_PRAYER_AZAN_HANDOFF_2026.md`](FLUTTER_CAIRO_DEFAULT_PRAYER_AZAN_HANDOFF_2026.md) (Cairo default / Azan) · [`FLUTTER_SADAQAH_HADITH_HANDOFF_2026.md`](FLUTTER_SADAQAH_HADITH_HANDOFF_2026.md) (Home Sadaqah + Hadith)

---

## 1. Screens covered

| Screen | Backend sources |
|--------|-----------------|
| Home prayer card + 5 dots | `GET /dashboard` → `data.prayers` **or** `GET /prayers/today` |
| Prayer screen (“الصلاة”) | `GET /prayers/today` (guest OK) + mark endpoints when logged in |
| Journey prayer tiles | `GET /journey/today` + `PATCH /journey/prayer` |

---

## 2. Endpoints (unchanged paths)

| Method | Path | Auth | Use |
|--------|------|------|-----|
| `GET` | `/prayers/today` | Optional Bearer | Primary schedule + `nextPrayer` + `sunrise` |
| `GET` | `/prayers/schedule` | None | Same calc; no completion |
| `PATCH` | `/prayers/:id/mark` | Required | Toggle FAJR…ISHA |
| `GET` | `/dashboard` | Required | Home aggregate including `prayers` |
| `PATCH` | `/journey/prayer` | Required | `{ "prayer": "ASR", "completed": true }` |
| `GET` | `/journey/today` | Required | Progress counts + `detailedPrayers` (no clock times) |

### Mark path param

Allowed: `FAJR` | `DHUHR` | `ASR` | `MAGHRIB` | `ISHA` (also Title Case / lowercase via parser).

**Live response `data`:**

```json
{ "prayer": "Asr", "key": "ASR", "completed": true }
```

---

## 3. Response contract (preserve)

### 3.1 Core (existing — do not break)

- `schedule[]` — **exactly 5** items: Fajr, Dhuhr, Asr, Maghrib, Isha  
- Each: `name`, `key`, `nameAr`, `time`, `displayAr`, `displayEn`, `iso`, `completed`  
- `nextPrayer`: `name`, `key`, `nameAr`, `time`, `display*`, `iso`, `countdownSeconds`  
- `completedCount` / `totalCount` (**totalCount = 5**)  
- Location: `city`, `cityAr`, `country`, `countryAr`, `latitude`, `longitude`, `locationSource`, `isDefaultLocation`

### 3.2 Additive (backward-compatible)

```json
"sunrise": {
  "name": "Sunrise",
  "key": "SUNRISE",
  "nameAr": "الشروق",
  "time": "06:28",
  "displayAr": "٦:٢٨ ص",
  "displayEn": "6:28 AM",
  "iso": "…",
  "trackable": false
}
```

| Flutter rule | |
|--------------|--|
| Show الشروق row | Use `data.sunrise` (or local compute if offline) |
| Checkbox for sunrise | **Do not sync to Backend** — not a salah; `trackable: false` |
| Call `PATCH .../SUNRISE/mark` | **Never** — Backend returns 400 |

Also on `GET /dashboard` → `data.prayers.sunrise` (same shape).

### 3.3 After Isha

`nextPrayer` rolls to **tomorrow’s Fajr** with a positive `countdownSeconds` (same fields as before).

---

## 4. Exact Flutter wiring

### Prayer screen

1. `GET /prayers/today` (no auth for guests → Cairo).  
2. Header / next card: `nextPrayer` + `countdownSeconds` (tick locally).  
3. Location label: `cityAr` / `city` (e.g. القاهرة، مصر).  
4. List: insert **Sunrise** from `sunrise` between Fajr and Dhuhr in the UI only.  
5. Checkboxes: only for the five `schedule[]` keys; on tap → `PATCH /prayers/{KEY}/mark` when logged in.  
6. Guest checkbox → soft login (401).

### Home

1. Prefer `GET /dashboard` when logged in.  
2. Prayer dots / times: `prayers.schedule` + `prayers.nextPrayer`.  
3. Journey tile `3/5`: `dailyJourney.prayer.completed` / `.total`.  
4. Sadaqah / Hadith: see Sadaqah–Hadith handoff (unchanged).

---

## 5. Auth & ownership

| Action | Guest | Logged-in |
|--------|-------|-----------|
| View times (Cairo / GPS query) | Yes | Yes |
| Mark prayer complete | 401 | Own user only |
| Dashboard | Soft login | Full payload |

---

## 6. Backend changes in this pass

| Change | Compatibility |
|--------|----------------|
| Add `sunrise` on schedule responses + dashboard | Additive |
| After-Isha → tomorrow Fajr countdown | Same fields; better behavior |
| OpenAPI mark example aligned to `{ prayer, key, completed }` | Docs only |
| Infer timezone from lat/lng (`geo-tz`); local calendar day for Adhan | Additive behavior; same response fields |
| Optional `city` / `cityAr` / `country` / `countryAr` on `/prayers/today` | Additive query params |
| Profile `PUT /profile/location` infers timezone when omitted | Same path; better stored TZ |

**Not changed:** payment APIs, Azan media catalog, `schedule[]` length, completion enum.

---

## 7. Production checklist (Backend)

- [x] `GET /prayers/today` guest → Cairo + 5 schedule + `sunrise` + `nextPrayer`  
- [x] `PATCH /prayers/ASR/mark` without token → 401  
- [x] Invalid `SUNRISE` mark → 400  
- [x] `totalCount` remains 5  
- [x] Existing field names preserved  

---

## 8. Completeness vs screens

| Requirement | Status |
|-------------|--------|
| Next prayer + countdown | Implemented & verified |
| Cairo default location | Implemented & verified |
| 5 prayers + completion | Implemented & verified |
| Sunrise time for UI row | Implemented now (display-only) |
| Sunrise completion / Azan | Not required |
| Home prayer widget | Same schedule API / dashboard |
| Notifications / Azan sounds | Separate Cairo–Azan handoff |

**FLUTTER HANDOFF STATUS: READY**
