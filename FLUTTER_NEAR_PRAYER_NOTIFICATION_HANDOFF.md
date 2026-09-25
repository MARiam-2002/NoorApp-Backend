# FLUTTER_NEAR_PRAYER_NOTIFICATION_HANDOFF.md

**Audience:** Flutter (`com.noor.app`)  
**From:** Noor Backend — **production audit 2026-09-25**  
**Status:** Backend **code** verified + fixed. See § READY / blockers for Railway deploy & FCM.

> Source of truth: this repository after the Near-Prayer production audit.  
> Near-Prayer = existing Azan path with `kind=pre_reminder` — **not** a second notification system.

---

## Production URLs & Firebase

| Item | Value |
|------|-------|
| **API base (MUST use)** | `https://noorapp-backend-production.up.railway.app/api/v1` |
| Retired Vercel | `https://noor-app-backend-one.vercel.app/api/v1` — **do not use** |
| Firebase project | `noorapp-d5d7d` |

---

## CRITICAL: `reminderMinutes` / `preReminderMinutes` is authoritative

Flutter UI:

| UI (AR) | Pref field |
|---------|------------|
| تذكير قبل الصلاة | `preReminderEnabled` |
| دقائق التذكير | `preReminderMinutes` (**alias on PATCH/GET:** `reminderMinutes`) |
| الصوت | `soundEnabled` |
| الاهتزاز | `vibrationEnabled` |

**Default = 15** everywhere (`DEFAULT_PRE_REMINDER_MINUTES`).

### Timing examples (verified)

| Prayer | Prayer time | `preReminderMinutes` | Near-Prayer local time | Text | Sound |
|--------|-------------|----------------------|------------------------|------|-------|
| Fajr | 05:00 | **15** | **04:45** | اقترب موعد صلاة الفجر | `sc_near_fajr.mp3` |
| Fajr | 05:00 | **10** | **04:50** | اقترب موعد صلاة الفجر | `sc_near_fajr.mp3` |
| Fajr | 05:00 | **5** | **04:55** | اقترب موعد صلاة الفجر | `sc_near_fajr.mp3` |

Cron tolerance (~12 min window, every ~10 min) only absorbs scheduler jitter. It does **not** replace the user’s minutes.

FCM also sends:

- `preReminderMinutes` / `reminderMinutes` (string)
- `nearPrayerLocalTime` (e.g. `"04:45"`)

---

## CRITICAL: Near-Prayer sound ≠ Azan sound

| Event | Time | Sound source | Pref field |
|-------|------|--------------|------------|
| Near-Prayer | prayer − N min | `sc_near_*` (or user tone) | `notificationSoundId` |
| Full Azan | prayer time | e.g. Mishary Alafasy | `azanSoundId` / `voiceId` |

Selecting Mishary under **صوت الأذان** must **never** change Near-Prayer clips.  
Near-Prayer resolution must **never** overwrite `azanSoundId`.

Recommended Near-Prayer setting:

```json
{ "notificationSoundId": "sc_near_auto", "preReminderEnabled": true, "preReminderMinutes": 15 }
```

---

## A) Backend responsibilities

- Read prefs (`preReminderEnabled`, `preReminderMinutes`, sounds, prayer toggles)
- Compute schedule in **user evaluation timezone**
- Detect due Near-Prayer when minutes-until ≈ `preReminderMinutes`
- Resolve `sc_near_*` (Friday Dhuhr → `sc_near_jumuah`)
- Send FCM + claim durable idempotency row
- Log in-app `AZAN` notification
- Never crash cron on one user / missing file / bad token

## B) Flutter responsibilities

- Permissions, FCM token registration
- Channels: `azan-reminder` (pre) + `azan` (prayer time)
- Bundle six near-prayer MP3s (Android `res/raw` + iOS)
- Prefer `data.titleAr` / `notificationSoundMediaFile`
- Client dedup vs local alarms (`occurrenceKey` / `idempotencyKey`)
- Play Near-Prayer only for `kind=pre_reminder`; full Azan only for `prayer_time`

## C) Shared contract

| Field | Value |
|-------|-------|
| `type` | `AZAN` (there is **no** `NEAR_PRAYER` type) |
| Near-Prayer `kind` | `pre_reminder` |
| Prayer-time `kind` | `prayer_time` |
| Canonical prayer key | `key`: `FAJR\|DHUHR\|ASR\|MAGHRIB\|ISHA` |
| Title Case (legacy) | `prayer`: `Fajr`, … |
| Timing API field | `preReminderMinutes` (alias `reminderMinutes`) |
| Default minutes | **15** |
| Valid range | integer **0..120** (0 = no separate pre; prayer-time only) |

### Sound files (repo + production media verified)

**Canonical Jumuah file:** `sc_near_jumuah.mp3` (not `jummah`).

| Case | Sound ID | Filename |
|------|----------|----------|
| FAJR | `sc_near_fajr` | `sc_near_fajr.mp3` |
| DHUHR | `sc_near_dhuhr` | `sc_near_dhuhr.mp3` |
| Friday DHUHR | `sc_near_jumuah` | `sc_near_jumuah.mp3` |
| ASR | `sc_near_asr` | `sc_near_asr.mp3` |
| MAGHRIB | `sc_near_maghrib` | `sc_near_maghrib.mp3` |
| ISHA | `sc_near_isha` | `sc_near_isha.mp3` |
| Auto | `sc_near_auto` | *(sentinel)* |

### Arabic titles

| Case | `titleAr` |
|------|-----------|
| FAJR | اقترب موعد صلاة الفجر |
| DHUHR | اقترب موعد صلاة الظهر |
| ASR | اقترب موعد صلاة العصر |
| MAGHRIB | اقترب موعد صلاة المغرب |
| ISHA | اقترب موعد صلاة العشاء |
| Friday DHUHR pre | اقترب موعد صلاة الجمعة |

---

## D) Android

| Item | Value |
|------|-------|
| Permission | `POST_NOTIFICATIONS` |
| Channel (Near-Prayer) | **`azan-reminder`** |
| Channel (Azan) | **`azan`** |
| Raw names | `sc_near_fajr` … `sc_near_jumuah` (files `*.mp3` in `res/raw`) |
| FCM sound | basename **without** `.mp3` |
| Channel sound | **Client-owned** — backend cannot change an existing channel’s sound |

## E) iOS

Bundle the six `.mp3` files. APNs `sound` from backend is basename without extension (`sc_near_fajr`). Map to bundled file in app config.

## F) Testing

Run:

```bash
npm run test:near-prayer
```

## G) Blockers (honest)

| ID | Status | Detail |
|----|--------|--------|
| **P1 FCM** | **BLOCKER on production** | `GET /health` → `fcm.configured: false` (verified 2026-09-25). Cron runs but **cannot deliver FCM** until Railway Firebase Admin for `noorapp-d5d7d` is set. |
| P2 Deploy | Required | Audit fixes + migration `20260925070000_azan_reminder_send_logs` must be deployed. |
| L1 Timing | By design | Cron ±12 min tolerance; Flutter local alarms remain primary for exact second timing. |

**Verified live:** cron without secret → `401`; `sc_near_fajr.mp3` / `sc_near_jumuah.mp3` media → `200`.

---

## Preferences API

```http
GET|PATCH /api/v1/profile/azan-preferences
```

PATCH example:

```json
{
  "preReminderEnabled": true,
  "preReminderMinutes": 10,
  "reminderMinutes": 10,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "notificationSoundId": "sc_near_auto",
  "azanSoundId": "mishary_alafasy",
  "azanEnabled": true,
  "fcmPrayerBackupEnabled": true
}
```

- Either `preReminderMinutes` or `reminderMinutes` accepted on PATCH.  
- Response includes both `preReminderMinutes` and `reminderMinutes` (same value).  
- Invalid: negative, >120, non-integer → `VALIDATION_ERROR`.

---

## Cron / idempotency

| Item | Value |
|------|-------|
| Endpoint | `POST /cron/prayer-reminders` |
| Auth | Bearer / `X-Cron-Secret` / `?secret=` = `CRON_SECRET` |
| Cadence | Railway `*/10 * * * *` |
| Window | 12 minutes |
| Idempotency | `azan_reminder_send_logs` unique `(userId, occurrenceKey)` claimed **before** FCM |
| Pre key shape | `{date}|{PRAYER}|pre_reminder|pre{N}` |
| Prayer key shape | `{date}|{PRAYER}|prayer_time` |

Changing 15→10 creates a **new** occurrence key (`pre15` vs `pre10`) so the new config is not suppressed.

**Never put `CRON_SECRET` in Flutter.**

---

## FCM example (Fajr, 15 min)

```json
{
  "notification": { "title": "Fajr soon", "body": "Reminder: Fajr in about 15 minutes (05:00)" },
  "data": {
    "type": "AZAN",
    "kind": "pre_reminder",
    "key": "FAJR",
    "prayer": "Fajr",
    "time": "05:00",
    "nearPrayerLocalTime": "04:45",
    "preReminderMinutes": "15",
    "reminderMinutes": "15",
    "notificationSoundId": "sc_near_fajr",
    "notificationSoundMediaFile": "sc_near_fajr.mp3",
    "titleAr": "اقترب موعد صلاة الفجر",
    "idempotencyKey": "2026-09-25|FAJR|pre_reminder|pre15",
    "deepLink": "/prayer-times"
  },
  "android": { "notification": { "channelId": "azan-reminder", "sound": "sc_near_fajr" } },
  "apns": { "payload": { "aps": { "sound": "sc_near_fajr", "contentAvailable": true } } }
}
```

At 05:00 (`kind=prayer_time`): use `azanSound*` only — channel `azan`.

---

## Flutter checklist

- [ ] Sync `preReminderMinutes` / `reminderMinutes` from settings UI (default 15)
- [ ] Bundle six `sc_near_*.mp3` (`jumuah` spelling)
- [ ] Channels `azan-reminder` + `azan`
- [ ] Handle `kind=pre_reminder` vs `prayer_time` separately
- [ ] Dedup with `idempotencyKey`
- [ ] Test 15 / 10 / 5 minute settings
- [ ] Test Friday Jumuah title + sound
- [ ] Confirm Mishary Azan unchanged at prayer time

---

## READY FOR FLUTTER DEVELOPMENT

1. Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`  
2. Timing field: **`preReminderMinutes` / `reminderMinutes`** (default **15**)  
3. Type: `AZAN` + `kind=pre_reminder`  
4. Sounds: `sc_near_fajr` … `sc_near_jumuah`  
5. Near-Prayer ≠ Azan  
6. Channels: `azan-reminder` / `azan`  
7. **Ops blocker:** production `fcm.configured` must be `true` before FCM backup works end-to-end  

Backend unit contract: `npm run test:near-prayer` → OK.
