# Noor App — ختمة جديدة (Flexible Khatmah Plan) — Final Flutter Contract

> **Status:** LIVE after deploy.  
> **Send this file only to the Flutter developer** for the new Khatmah plan + evening reminder.  
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`  
> Existing `GET /quran/khatmah`, `PATCH /quran/khatmah/progress`, dashboard `khatmah` stay unchanged.

---

## 0. Envelope + Auth

Standard `{ success, message, data, meta, timestamp, requestId }`.  
All endpoints below need `Authorization: Bearer <token>`.

---

## 1. Product

| UI | Behavior |
|----|----------|
| **ختمة جديدة** | Start a plan: finish **604 pages** (one mushaf) on a schedule you choose |
| Choice A | `durationDays` — e.g. **15** (نص شهر), **30**, **60**, **90** (or any 7–365) |
| Choice B | `juzPerMonth` — e.g. **10 / 15 / 30** أجزاء في الشهر |
| ورد اليوم | Backend computes daily pages; if behind, **soft catch-up** (redistribute remaining ÷ remaining days) |
| تذكير | Opt-in Settings: if today’s ward not read → evening reminder «لم تقرأ ورد اليوم من ختمتك» |

Progress pages for the plan = `totalPagesRead - planPagesAtStart` toward **604**.

Daily pages still come from `DailyProgress.quranPagesRead` (same as journey increment).

---

## 2. Plan APIs

| Method | Path |
|--------|------|
| `GET` | `/quran/khatmah/plan` |
| `POST` | `/quran/khatmah/plan` |
| `DELETE` | `/quran/khatmah/plan` |

### Start plan — exactly one field

```http
POST /api/v1/quran/khatmah/plan
Authorization: Bearer <token>
Content-Type: application/json

{ "durationDays": 15 }
```

or

```json
{ "juzPerMonth": 30 }
```

### `GET /quran/khatmah/plan` → `data` (active)

```json
{
  "active": true,
  "mode": "DURATION_DAYS",
  "durationDays": 15,
  "juzPerMonth": null,
  "startedAt": "2026-09-26T00:00:00.000Z",
  "targetEndAt": "2026-10-11T00:00:00.000Z",
  "pagesGoal": 604,
  "pagesReadInPlan": 40,
  "pagesRemaining": 564,
  "daysRemaining": 12,
  "dailyWardPages": 47,
  "progress": 0.07,
  "todayWard": {
    "pagesTarget": 47,
    "pagesReadToday": 5,
    "completed": false,
    "remainingToday": 42,
    "missed": true,
    "labelAr": "ورد اليوم",
    "labelEn": "Today's portion",
    "captionAr": "5 من 47 صفحة اليوم",
    "captionEn": "5 of 47 pages today"
  },
  "labelAr": "خطة الختمة",
  "labelEn": "Khatmah plan",
  "ctaAr": "متابعة القراءة",
  "ctaEn": "Continue reading",
  "presets": {
    "durationDays": [15, 30, 60, 90],
    "juzPerMonth": [10, 15, 30]
  }
}
```

Inactive:

```json
{
  "active": false,
  "ctaAr": "ختمة جديدة",
  "ctaEn": "New khatmah",
  "labelAr": "لا توجد خطة ختمة نشطة"
}
```

`DELETE` clears the plan (free-form reading remains).

### Stats (additive)

`GET /quran/khatmah/stats` now includes `plan` (same shape) and `dailyGoal.pagesTarget` follows the plan ward when active.

---

## 3. Reminder prefs (Settings)

| Method | Path |
|--------|------|
| `GET` / `PATCH` / `PUT` | `/profile/khatmah-reminder-preferences` |

```json
{ "enabled": true, "time": "21:00" }
```

Response:

```json
{
  "enabled": true,
  "time": "21:00",
  "eventType": "KHATMAH",
  "titleAr": "ختمة القرآن",
  "bodyAr": "لم تقرأ ورد اليوم من ختمتك",
  "titleEn": "Quran Khatmah",
  "bodyEn": "You haven't read today's khatmah portion yet",
  "androidChannelId": "khatmah",
  "usesCustomVoice": false,
  "deepLink": "/quran/khatmah"
}
```

Default: **OFF**, time **21:00**, soft/default tone (not Duha/Qiyam voice).

---

## 4. Local + FCM

| Layer | Role |
|-------|------|
| Flutter primary | At `time`, if plan active and `todayWard.missed` → notify |
| Backend FCM | Same cron as other reminders; only if enabled + plan + ward missed |
| Channel | `khatmah` |
| `eventType` | `KHATMAH` |
| Tap | `/quran/khatmah` |

Keep using existing:

- `PATCH /quran/khatmah/progress` — cursor + lifetime pages  
- `POST /journey/quran-pages/increment` — today’s page bucket / streak  

---

## 5. Flutter checklist

- [ ] Screen: **ختمة جديدة** → pick duration **or** juz/month → `POST /quran/khatmah/plan`  
- [ ] Show plan progress + **ورد اليوم** from `GET /quran/khatmah/plan`  
- [ ] Settings toggle for khatmah reminder  
- [ ] Local evening alarm + FCM `KHATMAH` + `dedupeKey`  
- [ ] Soft/default sound only  

---

## 6. QA

- [ ] `durationDays: 15` → daily ward ≈ `ceil(604/15)` then soft catch-up over time  
- [ ] `juzPerMonth: 30` → full mushaf pace ~ month  
- [ ] Read pages today → `missed: false` → no reminder  
- [ ] No read + reminder on → notification copy as above  
- [ ] `DELETE` plan → `active: false`  
