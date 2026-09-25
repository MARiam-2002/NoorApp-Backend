# Noor App — نوافل / رواتب النوافل (Daily Rawatib) — Final Flutter Contract

> **Status:** LIVE after deploy.  
> **Send this file only to the Flutter developer.**  
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`  
> **v1 scope:** Daily checklist for the classic **12 sunnah rak‘ahs** (5 slots). **No notifications / no FCM.**

---

## 0. Standard Envelope

```jsonc
{
  "success": true | false,
  "message": "human readable string",
  "data": { /*…*/ } | null,
  "meta": {},
  "timestamp": "2026-09-26T00:00:00.000Z",
  "requestId": "uuid"
}
```

All endpoints below require:

```http
Authorization: Bearer <access_token>
```

---

## 1. Product

| Concern | Behavior |
|---------|----------|
| What | Confirmed daily **سنن الرواتب** — **12 rak‘ahs** in **5 checkboxes** |
| Day key | User **IANA timezone** (same as Azan / Mulk) |
| Complete | Tap toggles slot for **today** (idempotent toggle) |
| Notifications | **None in v1** |
| Not included | Duha, Witr, Tahajjud, Taraweeh (separate later if needed) |

### Fixed catalog (do not invent keys)

| `key` | Rak‘ahs | AR title |
|-------|---------|----------|
| `FAJR_BEFORE_2` | 2 | سنة الفجر |
| `DHUHR_BEFORE_4` | 4 | سنة الظهر القبلية |
| `DHUHR_AFTER_2` | 2 | سنة الظهر البعدية |
| `MAGHRIB_AFTER_2` | 2 | سنة المغرب |
| `ISHA_AFTER_2` | 2 | سنة العشاء |

`totalRakahs` always **12**. Progress UI: **`completedRakahs / 12`**.

---

## 2. Endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/nawafel/today` | Bearer |
| `PATCH` | `/nawafel/:key/mark` | Bearer |

### 2.1 `GET /nawafel/today`

Loads today’s checklist.

**Response `data`:**

```json
{
  "date": "2026-09-26",
  "timezone": "Africa/Cairo",
  "items": [
    {
      "key": "FAJR_BEFORE_2",
      "rakahs": 2,
      "sortOrder": 1,
      "linkedPrayer": "FAJR",
      "position": "BEFORE",
      "titleAr": "سنة الفجر",
      "titleEn": "Fajr sunnah",
      "captionAr": "ركعتان قبل الفجر",
      "captionEn": "2 rak‘ahs before Fajr",
      "completed": false
    }
  ],
  "completedSlots": 0,
  "totalSlots": 5,
  "completedRakahs": 0,
  "totalRakahs": 12,
  "progress": 0,
  "labelAr": "الرواتب",
  "labelEn": "Rawatib",
  "captionAr": "0 من 12 ركعة اليوم",
  "captionEn": "0 of 12 rak‘ahs today"
}
```

Render `items` in `sortOrder`. Use `titleAr` / `captionAr` for UI copy.

### 2.2 `PATCH /nawafel/{key}/mark`

Toggle one slot. No body required.

```http
PATCH /api/v1/profile/../nawafel/FAJR_BEFORE_2/mark
```

Correct:

```http
PATCH /api/v1/nawafel/FAJR_BEFORE_2/mark
Authorization: Bearer <token>
```

**Response `data`:**

```json
{
  "key": "FAJR_BEFORE_2",
  "completed": true,
  "today": { /* same shape as GET /nawafel/today */ }
}
```

- First tap → `completed: true`  
- Second tap → `completed: false`  
- Always refresh UI from `data.today` (or re-GET)

Invalid `key` → `400 VALIDATION_ERROR`.

---

## 3. Dashboard (additive)

`GET /dashboard` → `data.dailyJourney.nawafel` (older clients may ignore):

```json
{
  "completed": 4,
  "total": 12,
  "progress": 0.33,
  "completedSlots": 2,
  "totalSlots": 5,
  "labelAr": "الرواتب",
  "labelEn": "Rawatib",
  "captionAr": "4 من 12 ركعة اليوم",
  "captionEn": "4 of 12 rak‘ahs today"
}
```

`completed` / `total` = **rak‘ahs** (not slots).

---

## 4. Flutter UI mapping

| UI | Source |
|----|--------|
| Screen title **الرواتب** / **نوافل اليوم** | `labelAr` |
| Progress ring / fraction | `completedRakahs` / `totalRakahs` |
| Checkbox rows | `items[]` |
| Tap row | `PATCH /nawafel/{key}/mark` |
| Home tile (optional) | `dailyJourney.nawafel` |

Group by `linkedPrayer` if you want sections under Fajr / Dhuhr / Maghrib / Isha.

---

## 5. Checklist

- [ ] `GET /nawafel/today` after login  
- [ ] Toggle each of the 5 keys  
- [ ] Progress shows rak‘ahs out of **12**  
- [ ] Day rolls at local midnight (user timezone)  
- [ ] No notification channel / FCM for nawafel in v1  
- [ ] Optional: show `dailyJourney.nawafel` on home  

---

## 6. QA

- [ ] Mark `FAJR_BEFORE_2` → `completedRakahs` += 2  
- [ ] Mark `DHUHR_BEFORE_4` → += 4  
- [ ] Unmark same key → subtracts  
- [ ] All 5 done → `12/12`, `progress: 1`  
- [ ] Guest / no token → `401`  
- [ ] Bad key → `400`
