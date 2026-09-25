# Noor App — Notification Settings (Settings screen) — Final Flutter Contract

> **Status:** LIVE after deploy.  
> **Send this file only to the Flutter developer** for the Settings → Notifications section.  
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`

---

## 0. Sound rule (product)

| Reminder | Sound |
|----------|--------|
| **الضحى (DUHA)** | Custom Arabic voice — default `sc_event_duha` (`الضحى.mp3`) |
| **قيام الليل (QIYAM)** | Custom Arabic voice — default `sc_event_qiyam` (`قيام الليل.mp3`) |
| أذان / قرب الصلاة / الملك / الصلوات / باقي الإشعارات | **Normal** — default / soft system tone (existing Azan + Salawat + Mulk contracts) |

**Only Duha + Qiyam use a dedicated spoken notification clip.**  
Bundle `sc_event_duha` / `sc_event_qiyam` as Android/iOS channel sounds (or play short clip from `audioUrl` / media stream).

Media (already on production):

```text
GET /azan/media/sc_event_duha.mp3
GET /azan/media/sc_event_qiyam.mp3
```

---

## 1. Settings UI map

| Settings row | Prefs API | Default |
|--------------|-----------|---------|
| تذكير الضحى | `/profile/duha-preferences` | OFF · time `09:30` · sound `sc_event_duha` |
| تذكير قيام الليل | `/profile/qiyam-preferences` | OFF · time `02:30` · sound `sc_event_qiyam` |
| تذكير سورة الملك | `/profile/mulk-preferences` | OFF · time `20:00` · **no custom voice** |
| صلِّ على محمد | `/profile/salawat-preferences` | Existing Salawat contract |
| الأذان / قرب الصلاة | `/profile/azan-preferences` | Existing Azan contract |
| الرواتب (نوافل) | Checklist only — **no notification** | `NAWAFEL_FEATURE_FINAL.md` |

All reminder toggles are **opt-in** (user enables in Settings).

Auth:

```http
Authorization: Bearer <access_token>
```

---

## 2. Duha prefs

| Method | Path |
|--------|------|
| GET / PATCH / PUT | `/profile/duha-preferences` |

### PATCH body

```json
{ "enabled": true, "time": "09:30" }
```

### Response `data`

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

`soundId` is **fixed** by backend (do not PATCH a different sound for v1).

---

## 3. Qiyam prefs

| Method | Path |
|--------|------|
| GET / PATCH / PUT | `/profile/qiyam-preferences` |

### PATCH body

```json
{ "enabled": true, "time": "02:30" }
```

### Response `data`

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

---

## 4. Local + FCM (same pattern as Mulk)

| Layer | Role |
|-------|------|
| **Flutter primary** | Exact local alarm at `time` in user IANA timezone |
| **Backend FCM backup** | Same `/cron/prayer-reminders` job, ±12 min window |
| Dedup | `dedupeKey` — one tray notification per day |

### FCM `data` (all strings)

**DUHA**

| Field | Value |
|-------|-------|
| `eventType` / `soundType` / `eventKey` | `DUHA` |
| `soundId` | `sc_event_duha` |
| `nativeSound` | `sc_event_duha` |
| `androidChannelId` | `duha` |
| `mediaFile` | `sc_event_duha.mp3` |
| `titleAr` / `bodyAr` | as above |

**QIYAM**

| Field | Value |
|-------|-------|
| `eventType` / `soundType` / `eventKey` | `QIYAM` |
| `soundId` | `sc_event_qiyam` |
| `nativeSound` | `sc_event_qiyam` |
| `androidChannelId` | `qiyam` |
| `mediaFile` | `sc_event_qiyam.mp3` |

---

## 5. Android channels

| `channel_id` | Sound |
|--------------|--------|
| `duha` | Bundled `sc_event_duha` |
| `qiyam` | Bundled `sc_event_qiyam` |
| `mulk` | Soft / default (no custom voice) |
| `salawat` | Existing Salawat voice |
| `azan` / `near_prayer` | Existing Azan contract |

---

## 6. Flutter checklist

- [ ] Settings toggles for Duha + Qiyam + Mulk (opt-in)  
- [ ] Time pickers bound to PATCH `time`  
- [ ] Channels `duha` / `qiyam` with the two custom clips  
- [ ] Local schedule when enabled; cancel when disabled  
- [ ] FCM handlers for `eventType=DUHA` and `QIYAM`  
- [ ] Dedup via `dedupeKey`  
- [ ] Other notifications keep normal/default tones  

---

## 7. QA

- [ ] Enable Duha → fires at local `09:30` with الضحى voice  
- [ ] Enable Qiyam → fires at local `02:30` with قيام الليل voice  
- [ ] Mulk / near-prayer / generic → **not** those voices  
- [ ] Disable → no local + no FCM for that reminder  
- [ ] Preview plays `audioUrl` / `/azan/media/sc_event_*.mp3`
