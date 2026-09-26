# Noor App — Worldwide Features Pack (2026) — Final Flutter Contract

> **Status:** LIVE on production · verified.  
> **Send THIS FILE ONLY** for: **Home (`GET /dashboard`)** + timezone (worldwide) + الرواتب + إعدادات الإشعارات + ختمة جديدة.  
> Do **not** send older split docs for these features (`NAWAFEL_*`, `NOTIFICATION_*`, `MULK_*`, `KHATMAH_*`).  
> **Still separate (unchanged):** `FLUTTER_PRAYER_NOTIFICATIONS_CONTRACT.md` (Azan sound catalogs / FCM prayer payload detail) · `STANCE_FEATURE_FINAL.md`  
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`

---

## 0. HARD RULE — Timezone (كل دول العالم)

Backend keys **every user’s calendar day** to their **IANA timezone** (not the server clock).

| Must do | Detail |
|---------|--------|
| Save timezone | On login / location change: `PATCH /profile` with `"timezone": "Asia/Riyadh"` (IANA only) |
| Examples | `Africa/Cairo`, `Asia/Dubai`, `Asia/Riyadh`, `Europe/London`, `America/New_York` |
| Never | Fixed `UTC+2` hacks or device-only day without syncing profile |
| Fallback | If missing/invalid → backend uses `Africa/Cairo` |

**Affected by this rule:** Home prayer times & daily tiles · nawafel today · khatmah ward / pages today · journey daily pages · prayer completions · Mulk/Duha/Qiyam/Khatmah reminder times.

Local notifications must use the **same** IANA zone as profile.

---

## 1. Standard Envelope + Auth

```jsonc
{
  "success": true | false,
  "message": "string",
  "data": { /*…*/ } | null,
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

```http
Authorization: Bearer <access_token>
```

Unauthenticated protected routes → `401`.

---

# Part H — الرئيسية (Home) — 100% dynamic from Dashboard

**One call powers the Home screen:**

```http
GET /api/v1/dashboard
Authorization: Bearer <token>
```

Optional query (if used): lat/lng — otherwise profile location / Cairo default (`prayers.locationSource`).

Refresh after: prayer mark · quran pages · adhkar · sadaqah · khatmah progress · challenge claim.

### H1. UI → API map (matches Home screenshot)

| UI (AR) | API path |
|---------|----------|
| أهلاً، {اسم} | `data.greeting.displayName` (fallback `fullName` / `username`) |
| السبت + التاريخ الهجري | `data.greeting.weekdayName` + `data.greeting.hijriDate` |
| نقاط (إن ظهرت) | `data.greeting.points` |
| متبقي على الصلاة + اسم الصلاة | `data.prayers.nextPrayer.nameAr` / `displayAr` |
| عدّاد 01:14:28 | Flutter computes from `data.prayers.nextPrayer.iso` (or `countdownSeconds` if present) |
| صف الفجر…العشاء + الأوقات | `data.prayers.schedule[]` → `nameAr`, `time`, `key` |
| نقط مكتمل / لسه | `data.prayers.schedule[].completed` |
| آية اليوم + المرجع | `data.verseOfTheDay.textAr` + `referenceAr` |
| مشاركة الآية | Flutter share of those two fields |
| رحلتك اليوم → الصلوات 3/5 | `data.dailyJourney.prayer.completed` / `total` (+ `progress`) |
| القرآن (صفحات اليوم) | `data.dailyJourney.quran.pagesRead` (+ `target`) |
| الصدقة | `data.dailyJourney.sadaqah.amount` (+ `goal` / `percent`) |
| الأذكار تم الإنجاز | `data.dailyJourney.adhkar.completed` (+ optional `progressItemsDone/Total`) |
| القبلة / المسبحة | `data.utilities.qibla.enabled` / `tasbih.enabled` → navigate |
| استكمل الختمة · سورة · صفحة | `data.khatmah.surahNameAr` + `currentPage` |
| شريط تقدم الختمة | `data.khatmah.progressPercent` |
| متابعة القراءة | Navigate Quran reader using `khatmah.surahId` + `currentPage` |
| حديث اليوم + المصدر | `data.hadithOfTheDay.textAr` + `sourceAr` |
| تحدي اليوم + النقاط | `data.dailyChallenge.titleAr` / `descriptionAr` / `rewardPoints` / `completed` / `claimed` |
| جرس الإشعارات / التبويب السفلي | Flutter chrome only |

### H2. `data` shape (authoritative keys)

```jsonc
{
  "greeting": {
    "displayName": "احمد",
    "weekdayName": "السبت",
    "hijriDate": "15 ذو القعدة …",
    "gregorianDate": "…",
    "points": 50,
    "fullName": "…",
    "username": "…"
  },
  "prayers": {
    "nextPrayer": {
      "key": "ASR",
      "nameAr": "العصر",
      "time": "15:12",
      "iso": "2026-09-26T12:12:00.000Z",
      "countdownSeconds": 5000
    },
    "schedule": [
      { "key": "FAJR", "nameAr": "الفجر", "time": "04:32", "completed": true },
      { "key": "DHUHR", "nameAr": "الظهر", "time": "12:45", "completed": true },
      { "key": "ASR", "nameAr": "العصر", "time": "15:12", "completed": false },
      { "key": "MAGHRIB", "nameAr": "المغرب", "time": "18:40", "completed": false },
      { "key": "ISHA", "nameAr": "العشاء", "time": "20:00", "completed": false }
    ],
    "completedCount": 2,
    "totalCount": 5,
    "timezone": "Africa/Cairo",
    "locationSource": "profile"
  },
  "verseOfTheDay": {
    "textAr": "…",
    "referenceAr": "[الرعد: 28]",
    "surahNumber": 13,
    "ayahNumber": 28
  },
  "hadithOfTheDay": {
    "textAr": "…",
    "sourceAr": "[متفق عليه]"
  },
  "dailyJourney": {
    "prayer": { "completed": 3, "total": 5, "progress": 0.6, "labelAr": "الصلوات" },
    "quran": { "pagesRead": 4, "target": 5, "labelAr": "القرآن" },
    "sadaqah": { "amount": 0, "goal": 1000, "percent": 0, "labelAr": "الصدقة" },
    "adhkar": {
      "completed": true,
      "labelAr": "الأذكار",
      "captionAr": "تم الانتهاء من وردك اليومي ✅",
      "progressItemsDone": 10,
      "progressItemsTotal": 10
    },
    "nawafel": {
      "completed": 0,
      "total": 12,
      "progress": 0,
      "labelAr": "الرواتب",
      "captionAr": "0 من 12 ركعة اليوم"
    }
  },
  "khatmah": {
    "surahId": 2,
    "surahNameAr": "البقرة",
    "surahNameEn": "Al-Baqarah",
    "currentPage": 35,
    "progressPercent": 6
  },
  "dailyChallenge": {
    "titleAr": "…",
    "descriptionAr": "اقرأ 5 صفحات من القرآن",
    "rewardPoints": 50,
    "targetValue": 5,
    "completed": false,
    "claimed": false
  },
  "utilities": {
    "qibla": { "enabled": true },
    "tasbih": { "enabled": true }
  }
}
```

### H3. Home rules

1. **Do not hard-code** prayer times, verse, hadith, or khatmah surah — always bind `data`.  
2. Countdown = client timer from `nextPrayer.iso` (re-GET dashboard or recompute after midnight / timezone change).  
3. Gold/grey prayer dots = `schedule[].completed` only.  
4. `dailyJourney.nawafel` is **additive** (optional 5th tile; not required for the 4-tile screenshot).  
5. After marking a prayer / reading pages / finishing adhkar → **re-fetch** `/dashboard`.

### H4. Home checklist

- [ ] `GET /dashboard` on Home open + pull-to-refresh  
- [ ] Bind every row in H1 table  
- [ ] Profile `timezone` + location synced before trusting prayer card  
- [ ] Share verse/hadith from API strings  
- [ ] Continue reading → Quran at `khatmah.surahId` / `currentPage`  

---

# Part A — الرواتب / النوافل (checklist · NO push)

**12 rak‘ahs · 5 slots · user-local day · no FCM.**

### Keys (fixed)

| `key` | Rak‘ahs | AR |
|-------|---------|-----|
| `FAJR_BEFORE_2` | 2 | سنة الفجر |
| `DHUHR_BEFORE_4` | 4 | سنة الظهر القبلية |
| `DHUHR_AFTER_2` | 2 | سنة الظهر البعدية |
| `MAGHRIB_AFTER_2` | 2 | سنة المغرب |
| `ISHA_AFTER_2` | 2 | سنة العشاء |

UI progress: **`completedRakahs / 12`**.

### APIs

| Method | Path |
|--------|------|
| `GET` | `/nawafel/today` |
| `PATCH` | `/nawafel/{key}/mark` |

`GET` returns `date`, `timezone`, `items[]`, `completedRakahs`, `totalRakahs: 12`, `progress`, labels.

`PATCH` toggles; response `{ key, completed, today }` — refresh from `today`.

Dashboard additive: `GET /dashboard` → `dailyJourney.nawafel` (`completed`/`total` = rak‘ahs).

---

# Part B — إعدادات الإشعارات (opt-in Settings)

All toggles **default OFF**. Soft catch: user enables when they want.

### Sound rule

| Reminder | Sound |
|----------|--------|
| **الضحى** | Custom `sc_event_duha` |
| **قيام الليل** | Custom `sc_event_qiyam` |
| الملك · الختمة · أذان · قرب الصلاة · صلِّ على محمد | **Normal** soft/default |
| الرواتب | **No notification** |

```text
GET /azan/media/sc_event_duha.mp3
GET /azan/media/sc_event_qiyam.mp3
```

### Prefs APIs

| Settings row | API | Default |
|--------------|-----|---------|
| الضحى | `/profile/duha-preferences` | OFF · `09:30` · voice |
| قيام الليل | `/profile/qiyam-preferences` | OFF · `02:30` · voice |
| سورة الملك | `/profile/mulk-preferences` | OFF · `20:00` · soft |
| تذكير ورد الختمة | `/profile/khatmah-reminder-preferences` | OFF · `21:00` · soft |
| صلِّ على محمد | `/profile/salawat-preferences` | Existing |
| الأذان / قرب الصلاة | `/profile/azan-preferences` | Existing |

**PATCH body (Duha / Qiyam / Mulk / Khatmah reminder):**

```json
{ "enabled": true, "time": "20:00" }
```

`time` = local `HH:mm` in user timezone. At least one of `enabled` / `time`.

### Response highlights

**Duha:** `eventType: DUHA`, `soundId: sc_event_duha`, `androidChannelId: duha`, `usesCustomVoice: true`, titles/bodies AR for صلاة الضحى.

**Qiyam:** `eventType: QIYAM`, `soundId: sc_event_qiyam`, `androidChannelId: qiyam`, `usesCustomVoice: true`.

**Mulk:** `enabled`, `time`, `surahId: 67`, `deepLink: /quran/surah/67`, body `لا تنس قراءة سورة الملك` — **no custom voice**.

**Khatmah reminder:** `eventType: KHATMAH`, body `لم تقرأ ورد اليوم من ختمتك`, `androidChannelId: khatmah`, `usesCustomVoice: false`, `deepLink: /quran/khatmah`.

### Local + FCM pattern (all reminders)

| Layer | Role |
|-------|------|
| Flutter **primary** | Exact local alarm at `time` in profile IANA TZ |
| Backend **backup** | `/cron/prayer-reminders` ±12 min |
| Dedup | One tray / day via `dedupeKey` |

| `eventType` | Channel | Custom voice? |
|-------------|---------|----------------|
| `DUHA` | `duha` | Yes `sc_event_duha` |
| `QIYAM` | `qiyam` | Yes `sc_event_qiyam` |
| `MULK` | `mulk` | No |
| `KHATMAH` | `khatmah` | No (only if plan active + today’s ward missed) |

---

# Part C — ختمة جديدة (flexible plan)

Existing still work: `GET/PATCH /quran/khatmah`, `POST /quran/khatmah/reset`, `POST /journey/quran-pages/increment`.

### Plan APIs

| Method | Path |
|--------|------|
| `GET` | `/quran/khatmah/plan` |
| `POST` | `/quran/khatmah/plan` |
| `DELETE` | `/quran/khatmah/plan` |

**Start — exactly one field:**

```json
{ "durationDays": 15 }
```

or

```json
{ "juzPerMonth": 30 }
```

- `durationDays`: integer **7..365** (presets: 15, 30, 60, 90)  
- `juzPerMonth`: integer **1..30** (presets: 10, 15, 30)  
- Goal: **604 pages** from plan start  
- **Soft catch-up:** remaining pages ÷ remaining days  

### Active plan `data` (shape)

```json
{
  "active": true,
  "mode": "DURATION_DAYS",
  "durationDays": 15,
  "juzPerMonth": null,
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
    "captionAr": "5 من 47 صفحة اليوم"
  },
  "ctaAr": "متابعة القراءة",
  "presets": { "durationDays": [15, 30, 60, 90], "juzPerMonth": [10, 15, 30] }
}
```

Inactive: `"active": false`, `"ctaAr": "ختمة جديدة"`.

`GET /quran/khatmah/stats` includes additive `plan` + `dailyGoal.pagesTarget` follows ward when plan active.

**Reading flow:** keep calling `PATCH /quran/khatmah/progress` + `POST /journey/quran-pages/increment` so today’s ward / streak stay correct on the **user-local** day.

---

## Master Flutter checklist

### Home
- [ ] `GET /dashboard` binds greeting, prayers, verse, journey, khatmah, hadith, challenge, utilities  
- [ ] Countdown from `nextPrayer.iso`; dots from `schedule[].completed`  
- [ ] Re-fetch after prayer / quran / adhkar / sadaqah updates  

### Timezone
- [ ] Persist IANA `timezone` on profile after login / location change  
- [ ] All local schedules use that same zone  

### Nawafel
- [ ] Checklist UI · `GET/PATCH /nawafel/*` · progress `/12`  
- [ ] Home tile `dailyJourney.nawafel` optional  
- [ ] No push  

### Notifications Settings
- [ ] Toggles + time pickers: Duha, Qiyam, Mulk, Khatmah reminder  
- [ ] Channels `duha` / `qiyam` with custom clips; others soft  
- [ ] Local primary + FCM backup + `dedupeKey`  

### Khatmah
- [ ] **ختمة جديدة** → duration **or** juz/month  
- [ ] Show plan + ورد اليوم  
- [ ] Reminder only when `todayWard.missed`  
- [ ] Soft tone for `KHATMAH`  

---

## QA matrix (must pass)

- [ ] Home shows live name, hijri, next prayer countdown, schedule dots from `/dashboard`  
- [ ] User in `America/New_York` vs `Asia/Riyadh`: “today” nawafel/ward differs correctly around midnight  
- [ ] Nawafel 5 marks → `12/12`  
- [ ] Duha/Qiyam custom voice; Mulk/Khatmah soft  
- [ ] Khatmah `durationDays: 15` and `juzPerMonth: 30` both start  
- [ ] Read pages today → ward `missed: false` → no khatmah push  
- [ ] Disable any reminder → no local + no FCM for that type  

---

## Do / Don’t

**Do**
- Trust backend prefs after PATCH  
- Branch FCM on `eventType`  
- Bundle `sc_event_duha` / `sc_event_qiyam`  

**Don’t**
- Invent nawafel keys  
- Use Duha/Qiyam voice for Mulk/Khatmah/Azan  
- Ignore profile timezone  
- Send both `durationDays` and `juzPerMonth` on plan create  
