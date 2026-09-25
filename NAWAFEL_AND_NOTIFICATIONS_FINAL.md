# Noor App — الرواتب (Nawafel) + إعدادات الإشعارات — Final Flutter Contract

> **Status:** LIVE on production.  
> **Send THIS FILE ONLY to the Flutter developer** for Nawafel + Notification Settings.  
> Do **not** send separate Nawafel / Notification / Mulk docs for this work.  
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`

---

## 0. Standard Envelope (every endpoint)

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

```http
Authorization: Bearer <access_token>
```

---

# Part A — الرواتب / النوافل (checklist, NO push)

Daily confirmed **سنن الرواتب**: **12 rak‘ahs** in **5 checkboxes**.  
**No notifications / no FCM for nawafel.**

## A1. Catalog (fixed keys — do not invent)

| `key` | Rak‘ahs | AR title |
|-------|---------|----------|
| `FAJR_BEFORE_2` | 2 | سنة الفجر |
| `DHUHR_BEFORE_4` | 4 | سنة الظهر القبلية |
| `DHUHR_AFTER_2` | 2 | سنة الظهر البعدية |
| `MAGHRIB_AFTER_2` | 2 | سنة المغرب |
| `ISHA_AFTER_2` | 2 | سنة العشاء |

Progress UI: **`completedRakahs / 12`**. Day = user **IANA timezone**.

## A2. APIs

| Method | Path |
|--------|------|
| `GET` | `/nawafel/today` |
| `PATCH` | `/nawafel/{key}/mark` |

### `GET /nawafel/today` → `data`

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

### `PATCH /nawafel/FAJR_BEFORE_2/mark`

No body. Toggle today’s slot.

```json
{
  "key": "FAJR_BEFORE_2",
  "completed": true,
  "today": { /* same as GET /nawafel/today */ }
}
```

Refresh UI from `data.today`. Invalid key → `400`.

## A3. Dashboard tile (additive)

`GET /dashboard` → `data.dailyJourney.nawafel`:

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

`completed` / `total` = **rak‘ahs**.

## A4. Nawafel checklist

- [ ] `GET /nawafel/today` after login  
- [ ] Toggle 5 keys; progress out of **12**  
- [ ] No notification channel for nawafel  
- [ ] Optional home tile `dailyJourney.nawafel`

---

# Part B — إعدادات الإشعارات (Settings → opt-in)

All toggles **default OFF**. User enables in Settings.

## B1. Sound rule

| Reminder | Sound |
|----------|--------|
| **الضحى (DUHA)** | Custom voice `sc_event_duha` (`الضحى.mp3`) |
| **قيام الليل (QIYAM)** | Custom voice `sc_event_qiyam` (`قيام الليل.mp3`) |
| الملك / أذان / قرب الصلاة / صلِّ على محمد / باقي | **Normal** soft/default (not Duha/Qiyam clips) |
| الرواتب | **No notification** |

Media:

```text
GET /azan/media/sc_event_duha.mp3
GET /azan/media/sc_event_qiyam.mp3
```

## B2. Settings rows → APIs

| Settings row | API | Default |
|--------------|-----|---------|
| تذكير الضحى | `GET/PATCH/PUT /profile/duha-preferences` | OFF · `09:30` · `sc_event_duha` |
| تذكير قيام الليل | `GET/PATCH/PUT /profile/qiyam-preferences` | OFF · `02:30` · `sc_event_qiyam` |
| تذكير سورة الملك | `GET/PATCH/PUT /profile/mulk-preferences` | OFF · `20:00` · no custom voice |
| صلِّ على محمد | `/profile/salawat-preferences` | Existing Salawat screen |
| الأذان / قرب الصلاة | `/profile/azan-preferences` | Existing Azan screen |

### PATCH body (Duha / Qiyam / Mulk)

```json
{ "enabled": true, "time": "09:30" }
```

At least one of `enabled` / `time` required. `time` = local `HH:mm`.

### Duha `data` (GET/PATCH)

```json
{
  "enabled": true,
  "time": "09:30",
  "eventType": "DUHA",
  "soundId": "sc_event_duha",
  "mediaFile": "sc_event_duha.mp3",
  "nativeSound": "sc_event_duha",
  "androidChannelId": "duha",
  "audioUrl": "https://…/azan/media/sc_event_duha.mp3",
  "titleAr": "صلاة الضحى",
  "bodyAr": "حان الآن موعد صلاة الضحى",
  "titleEn": "Duha prayer",
  "bodyEn": "It is time for Duha prayer",
  "usesCustomVoice": true
}
```

### Qiyam `data`

```json
{
  "enabled": true,
  "time": "02:30",
  "eventType": "QIYAM",
  "soundId": "sc_event_qiyam",
  "mediaFile": "sc_event_qiyam.mp3",
  "nativeSound": "sc_event_qiyam",
  "androidChannelId": "qiyam",
  "audioUrl": "https://…/azan/media/sc_event_qiyam.mp3",
  "titleAr": "قيام الليل",
  "bodyAr": "حان الآن موعد صلاة قيام الليل",
  "titleEn": "Night prayer (Qiyam)",
  "bodyEn": "It is time for Qiyam prayer",
  "usesCustomVoice": true
}
```

### Mulk `data`

```json
{
  "enabled": true,
  "time": "20:00",
  "surahId": 67,
  "deepLink": "/quran/surah/67",
  "titleAr": "سورة الملك",
  "bodyAr": "لا تنس قراءة سورة الملك",
  "titleEn": "Surah Al-Mulk",
  "bodyEn": "Don't forget to read Surah Al-Mulk"
}
```

`soundId` for Duha/Qiyam is **fixed** by backend (v1).

## B3. Local + FCM (Duha / Qiyam / Mulk)

| Layer | Role |
|-------|------|
| **Flutter primary** | Exact local alarm at `time` (user IANA TZ) |
| **Backend FCM** | Backup via `/cron/prayer-reminders`, ±12 min |
| Dedup | One tray per day via `dedupeKey` |

### FCM (all `data` strings)

| | DUHA | QIYAM | MULK |
|--|------|-------|------|
| `eventType` | `DUHA` | `QIYAM` | `MULK` |
| `soundId` / `nativeSound` | `sc_event_duha` | `sc_event_qiyam` | — (default tone) |
| `androidChannelId` | `duha` | `qiyam` | `mulk` |
| Tap | optional `/prayers/duha` | optional `/prayers/qiyam` | `/quran/surah/67` |

## B4. Android channels

| `channel_id` | Sound |
|--------------|--------|
| `duha` | Bundled `sc_event_duha` |
| `qiyam` | Bundled `sc_event_qiyam` |
| `mulk` | Soft / default |
| `salawat` / `azan` / `near_prayer` | Existing contracts |

## B5. Notifications checklist

- [ ] Settings: Duha + Qiyam + Mulk toggles + time pickers  
- [ ] Channels `duha` / `qiyam` with custom clips only  
- [ ] Local schedule when enabled; cancel when off  
- [ ] FCM: `DUHA` / `QIYAM` / `MULK` + `dedupeKey`  
- [ ] Other notifications stay normal tones  

---

## Combined QA

**Nawafel**
- [ ] Mark `FAJR_BEFORE_2` → +2 rak‘ahs; all five → `12/12`  
- [ ] No push for nawafel  

**Notifications**
- [ ] Duha at local time with الضحى voice  
- [ ] Qiyam at local time with قيام الليل voice  
- [ ] Mulk soft tone; opens Surah 67  
- [ ] Disable → no local + no FCM  
