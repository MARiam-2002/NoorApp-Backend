# Noor Prayer Notifications — Flutter Contract (2026)

**Send this file only to the Flutter developer.**  
It is the **single canonical** backend↔Flutter contract for Azan, Near-Prayer, prayer-event clips, and Salawat.

**Supersedes (do not use for new work):**  
`FLUTTER_NEAR_PRAYER_NOTIFICATION_HANDOFF.md`, notification sections in `FLUTTER_BACKEND_INTEGRATION_GUIDE.md`, `BACKEND_CHANGELOG_FOR_FLUTTER.md`, older Salawat handoffs.

**Production API base**

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

**Production status (backend verified):**

| Check | Status |
|-------|--------|
| `GET /health` → `fcm.configured` | `true` |
| Azan / near-prayer / notification / salawat media | Live |
| Prefs + catalogs | Live |
| Cron without secret | `401` |

---

## Golden rule

Never guess the sound from prayer name alone.

Always branch on:

| Field | Meaning |
|-------|---------|
| `eventType` | What happened (`PRE_PRAYER`, `PRAYER_AZAN`, `JUMUAH`, `DUHA`, `QIYAM`, `SALAWAT`) |
| `soundType` | Which audio family (`NEAR_PRAYER`, `AZAN`, `GENERIC_NOTIFICATION`, `SALAWAT`) |
| `soundId` | Catalog id to resolve |
| `dedupeKey` | One user-visible notification per logical event |

---

## 1. Architecture

| Layer | Role |
|-------|------|
| **Flutter (primary)** | Exact local scheduling for PRE + AZAN (+ optional DUHA/QIYAM). Must be timing-accurate. |
| **Backend FCM (backup)** | `POST /cron/prayer-reminders` every ~10 minutes. Tolerant window — **not** second-perfect. |
| **Backend prefs** | Source of truth for `reminderMinutes`, `azanSoundId`, `notificationSoundId`, per-prayer toggles, Salawat prefs. |

**LOCAL is primary. FCM is backup.** Deduplicate with `dedupeKey`.

---

## 2. Event types

| `eventType` | When | `eventKey` |
|-------------|------|------------|
| `PRE_PRAYER` | `prayerTime - reminderMinutes` | `FAJR`…`ISHA` (Friday Dhuhr PRE still `DHUHR`, Arabic name الجمعة) |
| `PRAYER_AZAN` | Exact prayer time | `FAJR`…`ISHA` |
| `JUMUAH` | Friday Dhuhr exact (FCM backup) | `JUMUAH` |
| `DUHA` | Flutter-local only (no backend cron timing) | `DUHA` |
| `QIYAM` | Flutter-local only | `QIYAM` |
| `SALAWAT` | Interval inside active window | `SALAWAT` |

Legacy FCM fields (keep reading, prefer new ones):

- `kind`: `pre_reminder` | `prayer_time`
- `legacyEventType`: `PRE_PRAYER_REMINDER` | `PRAYER_AZAN`

---

## 3. Timing & timezone

- Use the **user IANA timezone** (e.g. `Africa/Cairo`) + calculation method + madhab from prefs.
- Never use device-server offset hacks like fixed `UTC+2`.
- Local schedule uses `HH:mm` in that timezone.

---

## 4. `reminderMinutes` (authoritative)

| Field | Role |
|-------|------|
| `reminderMinutes` | Flutter-facing alias (PATCH/GET) |
| `preReminderMinutes` | Canonical stored field |
| `prePrayerReminderMinutes` | Extra alias |

- **Default:** `15`
- **Allowed:** `0`–`120`
- **PRE local time:** `prayerTime - reminderMinutes`

Example — Fajr `05:00`:

| reminderMinutes | PRE |
|-----------------|-----|
| 15 | 04:45 |
| 10 | 04:50 |
| 5 | 04:55 |

Changing prefs must reschedule all PRE notifications.

---

## 5. PRE_PRAYER (approaching)

- **Title (AR):** `اقترب موعد صلاة {name}`
- **Names:** الفجر / الظهر / العصر / المغرب / العشاء / الجمعة (Friday Dhuhr)
- **soundType:** `NEAR_PRAYER` when using near clips, else `GENERIC_NOTIFICATION`
- **Recommended prefs:** `notificationSoundId: "sc_near_auto"`  
  Backend maps to `sc_near_fajr|dhuhr|asr|maghrib|isha|jumuah` (Friday Dhuhr → `sc_near_jumuah`)
- User may instead pick a tone from `GET /azan/notification-sounds`
- **Never** play full Azan audio for PRE

---

## 6. PRAYER_AZAN (exact time)

- **Title (AR):** `حان الآن موعد أذان {name}`
- **soundType:** `AZAN`
- **soundId / azanSoundId:** user selection from `GET /azan/sounds`
- Canonical field: `azanSoundId` (`voiceId` is legacy alias only)
- Show notification, then **play full Adhan in-app** via `azanSoundUrl` / cached file
- **Never** use `sc_near_*` as Azan
- Full Adhan is **not** an OS notification sound (too long)

---

## 7. JUMUAH

- Detect Friday in **user timezone**
- PRE Friday Dhuhr: Arabic uses الجمعة + near file `sc_near_jumuah.mp3` (**spelling: jumuah**, not jummah)
- Exact Friday: FCM may send `eventType=JUMUAH`
- Do not invent a sixth daily prayer row in the five-prayer list

---

## 8. DUHA / QIYAM

Backend ships short clips only (no cron schedule):

| Event | File | Id |
|-------|------|-----|
| DUHA | `assets/prayer-events/sc_event_duha.mp3` | `sc_event_duha` |
| QIYAM | `assets/prayer-events/sc_event_qiyam.mp3` | `sc_event_qiyam` |

Suggested titles:

- DUHA: `حان الآن موعد صلاة الضحى`
- QIYAM: `حان الآن موعد صلاة قيام الليل`

Flutter owns timing if the product enables these events.

---

## 9. SALAWAT (“صلِّ على محمد”)

Matches the Salawat settings screen:

| UI | API |
|----|-----|
| Enable reminder | `enabled` |
| 30m / 1h / 2h / 3h | `intervalMinutes`: `30` \| `60` \| `120` \| `180` (default **180**) |
| Window From/To | `windowStart` / `windowEnd` (also `startTime` / `endTime`) default **08:00–22:00** (overnight allowed) |
| Sound “صلِّ على محمد” / Noor | `audioClipId: "salli_ala_muhammad_voice"` |

| Sound contract | Value |
|----------------|-------|
| Catalog id | `salli_ala_muhammad_voice` |
| Media file | `salli_ala_muhammad.mp3` |
| `nativeSound` (channel / bundled basename) | `salli_ala_muhammad` |
| Stream | `GET /salawat/media/salli_ala_muhammad.mp3` |
| `eventType` / `soundType` | `SALAWAT` |
| Android channel | `salawat` |
| Title (AR) | `صلِّ على محمد ﷺ` |

Legacy id `peaceful_reminder_tone` remaps to `salli_ala_muhammad_voice`.

---

## 10. Exact Arabic titles (copy these)

| Event | titleAr |
|-------|---------|
| PRE Fajr | اقترب موعد صلاة الفجر |
| PRE Dhuhr | اقترب موعد صلاة الظهر |
| PRE Asr | اقترب موعد صلاة العصر |
| PRE Maghrib | اقترب موعد صلاة المغرب |
| PRE Isha | اقترب موعد صلاة العشاء |
| PRE Friday Dhuhr | اقترب موعد صلاة الجمعة |
| AZAN | حان الآن موعد أذان {name} |
| Friday exact | حان الآن موعد أذان الجمعة |
| Salawat | صلِّ على محمد ﷺ |

Also use `titleEn` / `bodyAr` / `bodyEn` from FCM `data` when present.

---

## 11. Sound catalogs

| Type | How to load | Notes |
|------|-------------|-------|
| Full Azan | `GET /azan/sounds` | Long muezzin MP3s |
| Generic reminder tones | `GET /azan/notification-sounds` | **Only** `assets/notification` (+ `silent`) |
| Near-Prayer Arabic | set `notificationSoundId=sc_near_auto` or `sc_near_*` | Not listed in notification-sounds API |
| Prayer-event shorts | `sc_event_*` via `/azan/media` | Flutter-local events |
| Salawat | `GET /salawat/audio` | One voice only |

Media:

```text
GET /azan/media/{file}
GET /salawat/media/{file}
```

Near-prayer filenames (exact):

```text
sc_near_fajr.mp3
sc_near_dhuhr.mp3
sc_near_asr.mp3
sc_near_maghrib.mp3
sc_near_isha.mp3
sc_near_jumuah.mp3
```

---

## 12. API endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/azan/sounds` | Public |
| GET | `/azan/notification-sounds` | Public |
| GET | `/azan/media/:file` | Public |
| GET/PATCH | `/profile/azan-preferences` | Bearer |
| GET | `/salawat/audio` | Public |
| GET | `/salawat/media/:file` | Public |
| GET/PATCH | `/profile/salawat-preferences` | Bearer |
| POST | existing FCM device register route | Bearer |
| GET | `/health` | Public |

---

## 13. Request examples

### Azan prefs

```http
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "reminderMinutes": 15,
  "azanSoundId": "mishary_alafasy",
  "notificationSoundId": "sc_near_auto",
  "preReminderEnabled": true,
  "fcmPrayerBackupEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "prayers": {
    "fajr": true,
    "dhuhr": true,
    "asr": true,
    "maghrib": true,
    "isha": true
  }
}
```

### Salawat prefs (matches settings UI)

```http
PATCH /api/v1/profile/salawat-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "intervalMinutes": 180,
  "windowStart": "08:00",
  "windowEnd": "22:00",
  "audioClipId": "salli_ala_muhammad_voice"
}
```

---

## 14. Response examples

### Azan prefs (shape)

```json
{
  "azanSoundId": "mishary_alafasy",
  "voiceId": "mishary_alafasy",
  "reminderMinutes": 15,
  "preReminderMinutes": 15,
  "notificationSoundId": "sc_near_auto",
  "fcmPrayerBackupEnabled": true,
  "azanSound": {
    "id": "mishary_alafasy",
    "nameAr": "...",
    "audioUrl": "https://.../azan/media/mishary_alafasy.mp3"
  }
}
```

### Salawat prefs (shape)

```json
{
  "enabled": true,
  "intervalMinutes": 180,
  "windowStart": "08:00",
  "windowEnd": "22:00",
  "audioClipId": "salli_ala_muhammad_voice",
  "audioClipTitleAr": "صلِّ على محمد",
  "audioClipCreatorAr": "نور",
  "mediaFile": "salli_ala_muhammad.mp3",
  "nativeSound": "salli_ala_muhammad",
  "audioUrl": "https://.../salawat/media/salli_ala_muhammad.mp3"
}
```

Client submits **ids only**, never arbitrary `audioUrl` values for the backend to trust.

---

## 15. FCM payload contract

All `data` values are **strings**.

### PRE example

```json
{
  "notification": { "title": "اقترب موعد صلاة الفجر", "body": "..." },
  "android": { "notification": { "channelId": "near_prayer", "sound": "sc_near_fajr" } },
  "data": {
    "eventType": "PRE_PRAYER",
    "eventKey": "FAJR",
    "prayerKey": "FAJR",
    "soundType": "NEAR_PRAYER",
    "soundId": "sc_near_fajr",
    "notificationSoundMediaFile": "sc_near_fajr.mp3",
    "reminderMinutes": "15",
    "scheduledAtLocal": "04:45",
    "timezone": "Africa/Cairo",
    "dedupeKey": "2026-09-25|<userId>|PRE_PRAYER|FAJR",
    "source": "FCM_BACKUP",
    "androidChannelId": "near_prayer"
  }
}
```

### AZAN example

```json
{
  "data": {
    "eventType": "PRAYER_AZAN",
    "eventKey": "FAJR",
    "soundType": "AZAN",
    "soundId": "mishary_alafasy",
    "azanSoundId": "mishary_alafasy",
    "azanSoundUrl": "https://.../azan/media/mishary_alafasy.mp3",
    "dedupeKey": "2026-09-25|<userId>|PRAYER_AZAN|FAJR",
    "androidChannelId": "azan"
  }
}
```

### SALAWAT example

```json
{
  "data": {
    "eventType": "SALAWAT",
    "eventKey": "SALAWAT",
    "soundType": "SALAWAT",
    "soundId": "salli_ala_muhammad_voice",
    "mediaFile": "salli_ala_muhammad.mp3",
    "nativeSound": "salli_ala_muhammad",
    "dedupeKey": "2026-09-25|<userId>|SALAWAT|SALAWAT|<occurrenceKey>",
    "androidChannelId": "salawat"
  }
}
```

**Important:** A remote URL will **not** play as the OS notification sound. Bundle short sounds; stream/cache long Azan for in-app playback.

---

## 16. Android channels (required)

Create **separate** channels (Android 8+ locks sound per channel):

| `channel_id` | Use |
|--------------|-----|
| `near_prayer` | PRE_PRAYER |
| `azan` | PRAYER_AZAN / JUMUAH tray (short default; full Adhan via player) |
| `salawat` | SALAWAT → bundled `salli_ala_muhammad` |

Also accept legacy FCM channel id `azan-reminder` during migration.

---

## 17. iOS requirements

- Bundle short PRE / Salawat sounds; `aps.sound` = bundled filename matching `nativeSound`
- Custom fields live in FCM `data`, **outside** `aps`
- Full Adhan → app audio session / player, not `aps.sound`

---

## 18. Local scheduling (Flutter must do)

1. Load prefs + prayer times for user location / method / madhab / timezone  
2. For each enabled prayer:
   - schedule `PRE_PRAYER` at `time - reminderMinutes`
   - schedule `PRAYER_AZAN` at exact time  
3. Attach `eventType`, `eventKey`, `soundType`, `soundId`, `dedupeKey`  
4. Use stable notification IDs per day/event  
5. On prefs change → cancel + reschedule  
6. Register FCM token with backend for backup delivery  

---

## 19. Deduplication

```text
dedupeKey = YYYY-MM-DD|userId|eventType|eventKey
```

Salawat adds occurrence slot:

```text
YYYY-MM-DD|userId|SALAWAT|SALAWAT|<occurrenceKey>
```

Rules:

- If local already shown → ignore FCM with same `dedupeKey`
- If FCM arrived first → skip local when it fires
- Concurrent → only one tray notification

---

## 20. App states

| State | Behaviour |
|-------|-----------|
| Foreground | Prefer in-app UI; still consume `dedupeKey` |
| Background | OS notification; route by `eventType` |
| Terminated | Cold start from payload `data` |

Request notification permission before scheduling. Missing permission / missing FCM token must **not** delete the account.

---

## 21. Offline

- Keep already-scheduled local notifications  
- Sync prefs/catalog when online  
- Cache Azan + near clips from media URLs  

---

## 22. Backend guarantees (done)

- `reminderMinutes` authoritative (default 15)
- PRE vs AZAN copy + timing separation
- Near-Prayer vs Azan vs Salawat sound separation
- Canonical `eventType` + `soundType` + `dedupeKey` on FCM
- Notification-sounds API = notification folder only
- Salawat single default voice `salli_ala_muhammad`
- FCM Admin configured in production (`fcm.configured: true`)
- Cron protected by secret
- Media files served for azan / near-prayer / prayer-events / notification / salawat

---

## 23. Flutter checklist (your work)

Implement all of these for a perfect 2026 release:

- [ ] Exact local PRE + AZAN scheduling using user timezone  
- [ ] Reschedule when `reminderMinutes` / prayer toggles / method / madhab change  
- [ ] Android channels: `near_prayer`, `azan`, `salawat`  
- [ ] Bundle short sounds (`sc_near_*`, `salli_ala_muhammad`, optional generic tones)  
- [ ] Azan picker from `/azan/sounds`; play full Adhan in-app at exact time  
- [ ] Reminder tone picker from `/azan/notification-sounds` **or** `sc_near_auto` for Arabic near voice  
- [ ] Salawat settings UI ↔ `/profile/salawat-preferences` + play/preview default voice  
- [ ] FCM handlers branch on `eventType` / `soundType`  
- [ ] Dedup local ↔ FCM via `dedupeKey`  
- [ ] Optional local DUHA / QIYAM if product requires  
- [ ] Never POST arbitrary audio URLs as the sound source of truth  

---

## 24. Flutter QA matrix

- [ ] Fajr 05:00 + 15 → PRE 04:45, title `اقترب موعد صلاة الفجر`, near sound  
- [ ] Change to 10 → PRE 04:50; to 5 → PRE 04:55  
- [ ] Exact AZAN at 05:00 with selected `azanSoundId` (full audio playback)  
- [ ] PRE sound ≠ Azan sound  
- [ ] Friday PRE uses الجمعة + `sc_near_jumuah`  
- [ ] Salawat fires only inside window; sound = `salli_ala_muhammad`  
- [ ] Local + FCM same `dedupeKey` → one notification  
- [ ] Channels correct on Android 8+  
- [ ] Offline: already scheduled locals still fire  

---

## 25. Do / Don’t

**Do**

- Trust backend prefs after PATCH  
- Branch on `eventType` + `soundType`  
- Use catalog ids  

**Don’t**

- Hard-code PRE offset to 15 forever  
- Use near-prayer clip as Azan  
- Use Azan MP3 as OS notification sound  
- Mix all events into one Android channel  
- Invent filenames (`jummah`, missing files, etc.)  

---

*End of contract — one file is enough.*
