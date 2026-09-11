# Flutter Sadaqah Tracking & Dashboard Hadith Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-11  
**Language:** English only  

**Backend status:** Personal Sadaqah tracking + daily Hadith for Home/Dashboard are **implemented**. Existing Flutter contracts are preserved; new fields are **additive / backward-compatible**.

**This repository:** Backend only. There is **no Flutter app source** here. This handoff documents the live API contract for the Sadaqah screen and Dashboard Hadith tile.

**Scope reminder:** Sadaqah is **personal tracking/recording only**. There is **no** payment gateway, money transfer, or donation collection API.

---

## 1. Goal

| Screen / area | Backend responsibility |
|---------------|------------------------|
| Home → “رحلتك اليوم” → الصدقة | Return today's `amount` from the same user `DailyProgress` row |
| Sadaqah screen → هدف الصدقة | Goal **1000** EGP, progress bar from `amount / goal` |
| Sadaqah categories | Static catalog: FOOD / CLOTHES / EDUCATION / MONEY |
| Dashboard → حديث اليوم | One authenticated Hadith for the calendar day, stable all day |
| Hadith public API | `GET /content/hadith-of-day` (unchanged shape) |

---

## 2. Auth model

| Endpoint | Auth |
|----------|------|
| `GET /journey/sadaqah` | **Bearer required** (401 otherwise) |
| `PATCH /journey/sadaqah` | **Bearer required** |
| `GET /journey/today` | **Bearer required** |
| `GET /dashboard` | **Bearer required** |
| `GET /content/hadith-of-day` | **Public** (guest OK) |

Ownership: every Sadaqah read/write uses `req.user.sub` only. Users cannot read or update another user's progress.

### Success envelope (unchanged)

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

---

## 3. Existing Sadaqah APIs (Flutter contract)

### 3.1 `PATCH /journey/sadaqah` — **existing primary write**

**Keep calling this exactly as before** for today's total:

```http
PATCH /api/v1/journey/sadaqah
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "amount": 350 }
```

| Field | Required | Behavior |
|-------|----------|----------|
| `amount` | **yes** | With default `mode=set`, **replaces** today's total (existing contract) |
| `category` | no | Optional: `FOOD` \| `CLOTHES` \| `EDUCATION` \| `MONEY` \| `GENERAL` |
| `mode` | no | `set` (default) or `add` |

**Existing Flutter body `{ "amount": N }` remains fully valid.**

#### Response `data` (backward-compatible)

| Field | Status | Notes |
|-------|--------|-------|
| `sadaqahAmount` | **Existing — keep using** | Number; same meaning as before |
| `amount` | Additive | Same value as `sadaqahAmount` |
| `goal` | Additive | `1000` |
| `percent` | Additive | `0–100` |
| `currency` | Additive | `"EGP"` |
| `currencyLabelAr` | Additive | `"جنيه"` |
| `currencyLabelEn` | Additive | `"EGP"` |
| `date` | Additive | `YYYY-MM-DD` |
| `category` | Additive | Present only if request sent `category` |
| `breakdown` | Additive | Present only when category buckets exist |

Example:

```json
{
  "success": true,
  "message": "Sadaqah updated successfully",
  "data": {
    "sadaqahAmount": 350,
    "amount": 350,
    "goal": 1000,
    "percent": 35,
    "currency": "EGP",
    "currencyLabelAr": "جنيه",
    "currencyLabelEn": "EGP",
    "date": "2026-09-11"
  }
}
```

**Increment example (optional, new):**

```json
{ "amount": 50, "category": "FOOD", "mode": "add" }
```

---

### 3.2 `GET /journey/sadaqah` — **new screen helper (additive)**

Optional dedicated payload for the Sadaqah screen. Flutter may keep deriving UI from `GET /journey/today` if preferred.

```http
GET /api/v1/journey/sadaqah
Authorization: Bearer <accessToken>
```

`data` includes:

- Existing-style progress: `sadaqahAmount`, `amount`, `goal` (1000), `percent`, `currency`, labels, `date`
- `goalTitleAr` / `goalTitleEn`, `goalCaptionAr` / `goalCaptionEn`
- `featured` — static banner copy (“اطعم محتاجا”) — **not a payment CTA**
- `categories[]` — FOOD / CLOTHES / EDUCATION / MONEY (`id`, `nameAr`, `nameEn`, `descriptionAr`, `descriptionEn`, `iconCode`)
- `breakdown` — optional map of category → amount
- `trackingOnly: true` + `trackingNoteEn`

---

### 3.3 `GET /journey/today` — Journey / “رحلتي”

Unchanged nesting. Sadaqah block:

```json
"sadaqah": {
  "amount": 350,
  "goal": 1000,
  "percent": 35,
  "currency": "EGP",
  "currencyLabelAr": "جنيه",
  "currencyLabelEn": "EGP"
}
```

Also still exposes top-level `sadaqahAmount` (existing).

**Note:** Daily goal was previously `50` in Backend examples; it is now **`1000`** to match the Flutter Sadaqah goal UI. Field **names/types/nesting are unchanged**; only the goal value and derived `percent` align with the screen.

---

## 4. Dashboard Sadaqah behavior

`GET /dashboard` → `data.dailyJourney.sadaqah`:

| Field | Status |
|-------|--------|
| `amount` | **Existing — required for Home tile** |
| `labelAr` / `labelEn` | Existing |
| `captionAr` / `captionEn` | Existing |
| `goal` | **Additive** (`1000`) |
| `percent` | **Additive** |
| `currency` / `currencyLabelAr` / `currencyLabelEn` | **Additive** |

Home tile “مساهمة اليوم” should bind to **`dailyJourney.sadaqah.amount`** (same source as Journey / PATCH).

Guest: Dashboard requires auth — show soft login for Home personal tiles if needed (see Guest handoff).

---

## 5. Hadith API and response structure

### 5.1 Public (unchanged path + core fields)

```http
GET /api/v1/content/hadith-of-day
GET /api/v1/content/hadith-of-day?day=254
```

```json
{
  "success": true,
  "data": {
    "id": "uuid-or-fallback-id",
    "dayOfYear": 254,
    "textAr": "…",
    "sourceAr": "رواه مسلم"
  }
}
```

### 5.2 Dashboard (unchanged core)

```json
"hadithOfTheDay": {
  "textAr": "…",
  "sourceAr": "رواه البخاري ومسلم"
}
```

Do **not** invent Hadith text on the client. Always display `textAr` + `sourceAr` as returned.

---

## 6. Trusted Hadith source and reference format

| Item | Detail |
|------|--------|
| Source bank | Curated authentic narrations from classical collections (Bukhari, Muslim, Tirmidhi, Abu Dawud) |
| Storage | `HadithOfTheDay` rows seeded per `dayOfYear` (1–366) |
| Runtime fallback | Same curated bank, rotated by `dayOfYear` if a DB row is missing |
| Reference field | `sourceAr` — e.g. `رواه البخاري ومسلم`, `رواه مسلم`, `رواه الترمذي` |
| Not used | AI-generated Hadith, unverified paraphrases, invented references |

Preserve **`sourceAr` exactly** in the UI (e.g. `[ متفق عليه ]` style labels should map from Backend `sourceAr`, not hardcode conflicting text).

---

## 7. Daily Hadith behavior

| Rule | Behavior |
|------|----------|
| One Hadith per calendar day | Selected by `dayOfYear` |
| Stable within the day | Same `dayOfYear` → same row / same curated index |
| Changes next day | Next `dayOfYear` → next entry in rotation |
| Dashboard vs public API | Same underlying service |

---

## 8. Exact Flutter integration instructions

### Sadaqah screen

1. After login, load progress via **`GET /journey/today`** and/or **`GET /journey/sadaqah`**.
2. Progress bar: `amount / goal` (goal = **1000**).
3. Categories: use `GET /journey/sadaqah` → `categories`, or keep local static UI matching Backend ids (`FOOD`, `CLOTHES`, `EDUCATION`, `MONEY`).
4. On save: **`PATCH /journey/sadaqah`** with `{ "amount": <total> }` (existing). Optionally send `category` + `mode: "add"`.
5. Refresh Home after save (`GET /dashboard` or local update of `dailyJourney.sadaqah.amount`).
6. **Never** open a payment SDK for these endpoints — tracking only.

### Home / Dashboard

1. Bind Sadaqah tile to `dailyJourney.sadaqah.amount`.
2. Bind Hadith card to `hadithOfTheDay.textAr` + `hadithOfTheDay.sourceAr`.
3. Share button: share the returned text + source; do not rewrite the Hadith.

### Errors

| Code | Meaning |
|------|---------|
| 401 | Soft login for Sadaqah / Dashboard personal data |
| 400 | Invalid amount / invalid category |

---

## 9. Backend changes made (summary)

| Change | Compatibility |
|--------|----------------|
| Daily Sadaqah goal `50` → **`1000`** | Same fields; percent semantics match UI |
| `PATCH /journey/sadaqah` keeps `sadaqahAmount`; adds amount/goal/percent/… | Additive |
| Optional `category` + `mode` on PATCH | Additive; default remains `set` |
| `GET /journey/sadaqah` | New optional endpoint |
| `DailyProgress.sadaqahBreakdown` JSON | Internal; exposed only as additive `breakdown` |
| Dashboard `dailyJourney.sadaqah` additive goal/percent/currency | Additive |
| Hadith DB-miss fallback rotates by day | Same `textAr` / `sourceAr` shape |

**Not added:** payments, gateways, checkout, NGO donation rails.

---

## 10. Production verification checklist (Backend)

- [x] `GET /content/hadith-of-day` → 200, `textAr` + `sourceAr`, day-stable  
- [x] `PATCH /journey/sadaqah` without Bearer → 401  
- [x] `GET /journey/sadaqah` without Bearer → 401  
- [x] Authenticated set/read of amount; Dashboard `amount` matches  
- [x] Existing success envelope / field names for Flutter preserved  
- [x] No payment endpoints introduced  

---

## 11. FLUTTER HANDOFF STATUS

**READY** — Flutter can keep current `PATCH { amount }` + Dashboard `amount` / `hadithOfTheDay` bindings. Adopt additive fields and `GET /journey/sadaqah` when convenient for the Sadaqah screen.
