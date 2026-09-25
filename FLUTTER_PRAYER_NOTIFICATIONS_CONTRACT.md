# FLUTTER_PRAYER_NOTIFICATIONS_CONTRACT.md

**Canonical Flutter contract for Prayer / Azan / Near-Prayer / Special events / Salawat (2026).**  
**Supersedes:** `FLUTTER_NEAR_PRAYER_NOTIFICATION_HANDOFF.md`, overlapping sections of `FLUTTER_BACKEND_INTEGRATION_GUIDE.md` / `BACKEND_CHANGELOG_FOR_FLUTTER.md` for notification behaviour.

Do **not** guess whether a sound is Azan, Near-Prayer, Salawat, or a generic chime. Always branch on:

- `eventType`
- `soundType`
- `soundId` / catalog ids

---

## 1. Overview

| Layer | Responsibility |
|-------|----------------|
| **Flutter (primary)** | Exact local scheduling of PRE_PRAYER + PRAYER_AZAN (+ optional DUHA / QIYAM / JUMUAH UI events) using user timezone + prayer times |
| **Backend (backup)** | FCM backup via `POST /cron/prayer-reminders` (~every 10 min window) — **not** second-perfect Azan |
| **Backend (prefs)** | Authoritative storage of `preReminderMinutes` / `reminderMinutes`, `azanSoundId`, `notificationSoundId`, per-prayer flags, Salawat prefs |

Architecture: **LOCAL primary, FCM backup**. Deduplicate with `dedupeKey`.

---

## 2. Event types

| `eventType` | When | `eventKey` examples |
|-------------|------|---------------------|
| `PRE_PRAYER` | `actualPrayerTime - reminderMinutes` | `FAJR` … `ISHA` (Friday Dhuhr PRE still `DHUHR` + Arabic الجمعة) |
| `PRAYER_AZAN` | Exact prayer time | `FAJR` … `ISHA` |
| `JUMUAH` | Friday Dhuhr **exact** time (FCM backup) | `JUMUAH` |
| `DUHA` | Flutter-local only (no backend cron timing) | `DUHA` |
| `QIYAM` | Flutter-local only | `QIYAM` |
| `SALAWAT` | Interval + window prefs | `SALAWAT` |

Internal FCM `kind` (legacy): `pre_reminder` | `prayer_time`. Prefer `eventType` for new code.  
Legacy alias in data: `legacyEventType` = `PRE_PRAYER_REMINDER` | `PRAYER_AZAN`.

---

## 3. Prayer timing

- Use **user timezone** (IANA, e.g. `Africa/Cairo`) + calculation method / madhab from prefs.
- Never use server timezone or fixed `UTC+2`.
- Store/display local `HH:mm`; convert to ISO/UTC only when needed for transport.

---

## 4. `reminderMinutes`

| Field | Role |
|-------|------|
| `preReminderMinutes` | Canonical in DB / Zod |
| `reminderMinutes` | Flutter alias (GET + PATCH) |
| `prePrayerReminderMinutes` | Extra alias |

- **Default:** `15`
- **Bounds:** `0`–`120` (API validation)
- **Authoritative** for PRE schedule: `scheduledAtLocal = prayerTime - reminderMinutes`

Examples (`Fajr = 05:00`):

| reminderMinutes | PRE local |
|-----------------|-----------|
| 15 | 04:45 |
| 10 | 04:50 |
| 5 | 04:55 |

---

## 5. PRE_PRAYER behaviour

- **Time:** prayer − `reminderMinutes`
- **Title AR:** `اقترب موعد صلاة {name}`
- **Names:** الفجر / الظهر / العصر / المغرب / العشاء / **الجمعة** (Friday Dhuhr)
- **Sound:** Near-Prayer auto via `notificationSoundId: "sc_near_auto"` → `sc_near_{prayer}.mp3`  
  OR explicit pick from `GET /azan/notification-sounds` (generic chimes under `assets/notification/`)
- **`soundType`:** `NEAR_PRAYER` or `GENERIC_NOTIFICATION`
- **Never** use full Azan MP3 here

---

## 6. PRAYER_AZAN behaviour

- **Time:** exact `actualPrayerTime`
- **Title AR:** `حان الآن موعد أذان {name}`
- **Sound:** user `azanSoundId` (canonical) / `voiceId` (legacy alias)
- **`soundType`:** `AZAN`
- **Never** replace with `sc_near_*`

Full Azan audio is for **app playback** (`azanSoundUrl`), not as a long OS notification sound.

---

## 7. JUMUAH

- Friday detection uses **user timezone** weekday.
- PRE Friday Dhuhr: text uses الجمعة; `eventType=PRE_PRAYER`, near sound `sc_near_jumuah.mp3` (spelling **jumuah**, not jummah).
- Exact Friday Dhuhr FCM: `eventType=JUMUAH`, `eventKey=JUMUAH`.
- Do not invent a sixth daily prayer row.

---

## 8. DUHA

- Asset: `assets/prayer-events/sc_event_duha.mp3` → id `sc_event_duha`
- **Backend does not cron-fire DUHA** (no authoritative timing source).
- Flutter may schedule locally if product defines timing.
- Suggested title: `حان الآن موعد صلاة الضحى`
- `eventType=DUHA`, `soundType` via prayer-event clip / product choice

---

## 9. QIYAM

- Asset: `assets/prayer-events/sc_event_qiyam.mp3` → id `sc_event_qiyam`
- **Backend does not cron-fire QIYAM.**
- Suggested title: `حان الآن موعد صلاة قيام الليل`
- `eventType=QIYAM`

---

## 10. SALAWAT

- One shared voice: id `salli_ala_muhammad_voice`
- File: `assets/salawat/salli_ala_muhammad.mp3`
- Title AR: `صلِّ على محمد ﷺ`
- Prefs: `GET/PATCH /profile/salawat-preferences` (`enabled`, `intervalMinutes` 30|60|120|180, window, `audioClipId`)
- Catalog: `GET /salawat/audio`
- `eventType=SALAWAT`, `soundType=SALAWAT`, channel `salawat`

Legacy id `peaceful_reminder_tone` resolves to `salli_ala_muhammad_voice`.

---

## 11. Exact Arabic notification texts

| Event | titleAr |
|-------|---------|
| PRE Fajr | اقترب موعد صلاة الفجر |
| PRE Dhuhr | اقترب موعد صلاة الظهر |
| PRE Asr | اقترب موعد صلاة العصر |
| PRE Maghrib | اقترب موعد صلاة المغرب |
| PRE Isha | اقترب موعد صلاة العشاء |
| PRE Friday Dhuhr | اقترب موعد صلاة الجمعة |
| AZAN Fajr | حان الآن موعد أذان الفجر |
| AZAN (other) | حان الآن موعد أذان {الاسم} |
| Friday exact | حان الآن موعد أذان الجمعة |
| Salawat | صلِّ على محمد ﷺ |

Backend also sends `titleEn` / `bodyEn` / `bodyAr` in data.

---

## 12. Sound IDs

| Type | IDs |
|------|-----|
| Azan | `mishary_alafasy`, `mishary_alafasy_2`, … (see `GET /azan/sounds`) |
| Near-Prayer | `sc_near_auto`, `sc_near_fajr`, `sc_near_dhuhr`, `sc_near_asr`, `sc_near_maghrib`, `sc_near_isha`, `sc_near_jumuah` |
| Generic notification | `soft_chime`, `notify_beep`, `digital_blip`, `ui_alert`, `sparkle_tone`, `message_pop`, `gui_notify`, `game_notify`, `notify_punchy`, `dingaling`, `meditation_bell`, `singing_bowl`, `xylophone_chime`, `bell_chime`, `hand_bell`, `silent` |
| Prayer-events | `sc_event_fajr` … `sc_event_qiyam` |
| Salawat | `salli_ala_muhammad_voice` |

---

## 13. Exact asset filenames

| Folder | Files |
|--------|--------|
| `assets/near-prayer/` | `sc_near_fajr.mp3` … `sc_near_jumuah.mp3` (**jumuah**) |
| `assets/azan/` | muezzin full Adhans |
| `assets/notification/` | 15 generic MP3s (picker only) |
| `assets/prayer-events/` | `sc_event_*.mp3` including duha/qiyam/jumuah |
| `assets/salawat/` | `salli_ala_muhammad.mp3` |

Media URLs: `GET /api/v1/azan/media/{file}` or `/api/v1/salawat/media/{file}`.

---

## 14. API endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/azan/sounds` | Public |
| GET | `/api/v1/azan/notification-sounds` | Public (**notification folder only**) |
| GET | `/api/v1/azan/media/:file` | Public |
| GET/PATCH | `/api/v1/profile/azan-preferences` | Bearer |
| GET | `/api/v1/salawat/audio` | Public |
| GET | `/api/v1/salawat/media/:file` | Public |
| GET/PATCH | `/api/v1/profile/salawat-preferences` | Bearer |
| POST | `/api/v1/devices/register` (or existing FCM register) | Bearer |
| POST/GET | `/api/v1/cron/prayer-reminders` | `CRON_SECRET` |
| GET | `/api/v1/health` | Public |

Base production: `https://noorapp-backend-production.up.railway.app`

---

## 15. Request examples

```http
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "reminderMinutes": 10,
  "azanSoundId": "mishary_alafasy",
  "notificationSoundId": "sc_near_auto",
  "preReminderEnabled": true,
  "fcmPrayerBackupEnabled": true,
  "prayers": { "fajr": true, "dhuhr": true, "asr": true, "maghrib": true, "isha": true }
}
```

```http
PATCH /api/v1/profile/salawat-preferences
{
  "enabled": true,
  "intervalMinutes": 180,
  "windowStart": "08:00",
  "windowEnd": "22:00",
  "audioClipId": "salli_ala_muhammad_voice"
}
```

---

## 16. Response examples

```json
{
  "azanSoundId": "mishary_alafasy",
  "voiceId": "mishary_alafasy",
  "reminderMinutes": 10,
  "preReminderMinutes": 10,
  "notificationSoundId": "sc_near_auto",
  "azanSound": { "id": "mishary_alafasy", "nameAr": "...", "audioUrl": "https://.../azan/media/mishary_alafasy.mp3" },
  "notificationSound": { "id": "sc_near_auto", "mediaFile": null },
  "fcmPrayerBackupEnabled": true
}
```

`GET /azan/notification-sounds` returns **only** `assets/notification` tones (+ `silent`). Near-prayer ids are **not** listed there; set `sc_near_auto` / `sc_near_*` directly on prefs.

---

## 17. User-selected Azan flow

1. `GET /azan/sounds` → show list + preview `audioUrl`
2. User picks id → `PATCH` `{ "azanSoundId": "<id>" }`
3. At `PRAYER_AZAN`: play cached/streamed `azanSoundUrl` in-app; show notification with `soundType=AZAN`

---

## 18. Android FCM payload

Top-level `notification` + `data` (all data values are **strings**).

```json
{
  "notification": { "title": "<titleAr>", "body": "<bodyAr>" },
  "android": { "notification": { "channelId": "near_prayer" | "azan" | "salawat", "sound": "<bundled basename>" } },
  "data": {
    "eventType": "PRE_PRAYER",
    "eventKey": "FAJR",
    "prayerKey": "FAJR",
    "soundType": "NEAR_PRAYER",
    "soundId": "sc_near_fajr",
    "dedupeKey": "2026-09-25|<userId>|PRE_PRAYER|FAJR",
    "scheduledAtLocal": "04:45",
    "timezone": "Africa/Cairo",
    "reminderMinutes": "15",
    "notificationSoundMediaFile": "sc_near_fajr.mp3",
    "azanSoundId": "...",
    "azanSoundUrl": "...",
    "source": "FCM_BACKUP"
  }
}
```

Do **not** expect a remote URL to play as the OS notification sound.

---

## 19. iOS / APNs payload

- `aps.alert` / top-level notification title+body
- `aps.sound` = **bundled** filename (e.g. `sc_near_fajr.caf` / `.mp3` as configured in Xcode)
- Custom fields **outside** `aps` (in FCM `data`)
- Long Azan → app playback, not `aps.sound`

---

## 20. Android channels

Create **separate** channels (sound is fixed per channel on Android 8+):

| channel_id | Use |
|------------|-----|
| `near_prayer` | PRE_PRAYER (near or short tone) |
| `azan` | PRAYER_AZAN / JUMUAH tray (short default; full Adhan via player) |
| `salawat` | SALAWAT |

Do not put conflicting sounds in one immutable channel.

Legacy FCM used `azan-reminder`; new backups send `near_prayer`. Support both during migration.

---

## 21. iOS bundled sound requirements

- Bundle short PRE / Salawat sounds in the app
- Filenames must match `nativeSound` / media basename contract
- Full Adhan files are for streaming/cache playback, not notification sound limits

---

## 22. Local notification architecture

Flutter owns exact times:

1. Fetch prayer schedule for user location/method/madhab/timezone
2. For each enabled prayer: schedule PRE at −`reminderMinutes`, AZAN at exact time
3. Attach `eventType`, `eventKey`, `soundType`, `soundId`, `dedupeKey`
4. Stable notification IDs per day/event

---

## 23. FCM backup architecture

- Cron tolerates ±~10–12 minutes around target
- Respects `fcmPrayerBackupEnabled`, `azanEnabled`, per-prayer flags, sound/vibration
- Idempotent via `AzanReminderSendLog` / `SalawatSendLog`
- **Production blocker today:** `/health` → `fcm.configured: false` until Firebase credentials are set on Railway

---

## 24. Deduplication contract

```text
dedupeKey = YYYY-MM-DD|userId|eventType|eventKey
```

Examples:

- `2026-09-25|USER|PRE_PRAYER|FAJR`
- `2026-09-25|USER|PRAYER_AZAN|FAJR`
- `2026-09-25|USER|JUMUAH|JUMUAH`
- `2026-09-25|USER|SALAWAT|SALAWAT` (+ occurrence slot for interval)

If local already shown → ignore FCM with same `dedupeKey`.  
If FCM first → mark key consumed so local skip.

Server occurrence key (durable): `{date}|{PRAYER}|pre_reminder|pre{N}` / `{date}|{PRAYER}|prayer_time`.

---

## 25. Timezone contract

- Prefer profile/schedule IANA timezone
- All minute-until / Friday checks use that zone
- DST-safe via IANA, not fixed offsets

---

## 26–28. Foreground / background / terminated

| State | Expectation |
|-------|-------------|
| Foreground | Prefer in-app UI; may suppress tray duplicate; still mark `dedupeKey` |
| Background | OS shows notification; Flutter handler routes by `eventType` |
| Terminated | OS tray + cold-start from payload data |

---

## 29. Notification permission

- Request notification permission before scheduling
- Missing permission ≠ delete account
- Missing FCM token ≠ delete account

---

## 30. Exact-alarm / local scheduling

- Use exact alarms / precise scheduling APIs where required (Android)
- Battery optimizations can cancel local alarms → FCM backup is the safety net when enabled

---

## 31. Offline behaviour

- Local schedules continue offline if already set
- Prefs/catalog sync when online
- Cache Azan / near clips from `/azan/media`

---

## 32. Sound fallback

- Missing near file → fallback chain (e.g. jumuah→dhuhr→soft_chime)
- Unknown `azanSoundId` → default muezzin
- Unknown Salawat id → `salli_ala_muhammad_voice`
- Never invent phantom filenames

---

## 33. Error handling

| Case | Backend |
|------|---------|
| Unknown azanSoundId | Coerced to default or 400 on strict validate |
| Invalid reminderMinutes | 400 |
| Cron without secret | 401 |
| Invalid FCM token | Cleaned; no user delete |
| Arbitrary client `audioUrl` | **Rejected** — client sends ids only |

---

## 34. QA test matrix

- [ ] Fajr 05:00 + 15 → PRE 04:45 text اقترب… الفجر + near sound
- [ ] Change to 10 → PRE 04:50
- [ ] Change to 5 → PRE 04:55
- [ ] Exact AZAN 05:00 + user Azan id
- [ ] PRE sound ≠ Azan sound
- [ ] Friday PRE + JUMUAH exact
- [ ] Salawat one shared MP3
- [ ] Local + FCM same dedupeKey → one tray
- [ ] Timezone Africa/Cairo DST edge
- [ ] Channel near_prayer vs azan vs salawat

---

## 35. Production checklist

- [ ] Firebase credentials on Railway → `fcm.configured: true`
- [ ] Deploy assets (near-prayer, azan, notification, prayer-events, salawat)
- [ ] Apply Prisma migrations (`azan_reminder_send_logs`, salawat default clip)
- [ ] Cron with `CRON_SECRET`
- [ ] Flutter channels + bundled short sounds
- [ ] Dedup implementation

---

## 36. Backend guarantees

- `reminderMinutes` authoritative (default 15, not hard-coded at fire time)
- PRE vs AZAN classification + idempotency logs
- Near vs Azan sound separation on FCM backup
- Canonical `eventType` + `soundType` in data
- Notification-sounds API = `assets/notification` only
- Salawat single catalog voice
- Cron auth required
- No account deletion from transient FCM failure

---

## 37. Flutter responsibilities

- Exact local scheduling
- Android channels + iOS bundles
- Dedup with `dedupeKey`
- Play full Azan via audio API (not OS notification sound)
- Offer Azan picker from `/azan/sounds`
- Offer generic reminder tones from `/azan/notification-sounds`
- Set `notificationSoundId: sc_near_auto` for Arabic near-prayer voices
- Schedule DUHA/QIYAM locally if product requires
- Handle FCM when `fcm.configured` becomes true
- Never send arbitrary audio URLs to the backend

---

*End of canonical contract.*
