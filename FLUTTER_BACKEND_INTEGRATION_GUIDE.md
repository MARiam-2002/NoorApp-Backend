# FLUTTER_BACKEND_INTEGRATION_GUIDE.md

**Audience:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Updated:** 2026-09-25  
**Firebase:** `noorapp-d5d7d`  
**Verified production base:** `https://noorapp-backend-production.up.railway.app/api/v1`

This is the **final verified backend contract**. Local device scheduling is the source of truth for exact prayer-time Azan. FCM/cron is backup only.

---

## 1. Production Base URL

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

**Do not use** (retired): `https://noor-app-backend-one.vercel.app/api/v1`

Envelope (all success responses):

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

## 2. Authentication

| Call | Auth |
|------|------|
| Most profile / devices / delete | `Authorization: Bearer <accessToken>` |
| Public catalogs (`/azan/sounds`, `/azan/media/:file`, …) | None |
| Cron | Server-only `CRON_SECRET` — **never in the app** |

On `TOKEN_EXPIRED` → `POST /auth/refresh` once → retry.

---

## 3. Account deletion (Google Play P0)

```http
DELETE /api/v1/auth/me
Authorization: Bearer <accessToken>
```

No body. Success **200**:

```json
{
  "success": true,
  "message": "Account deleted",
  "data": {
    "deleted": true,
    "deletedAt": "2026-09-25T03:00:00.000Z"
  },
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

After delete: login / Google / refresh / `GET /auth/me` → **401**. FCM tokens removed. Hard-delete + `DeletedIdentity` block until new `POST /auth/sign-up`.

---

## 4. Azan sounds API

```http
GET /api/v1/azan/sounds
```

Returns full Adhan catalog (`mishary_alafasy`, …) with `audioUrl` / `previewUrl` pointing at `/azan/media/...`.

**Flutter:** download/cache selected MP3 **before** prayer time. Do **not** stream at exact Azan moment.

---

## 5. Azan preferences API

```http
GET  /api/v1/profile/azan-preferences
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <accessToken>   # PATCH requires auth
```

### Canonical stored fields (do not invent a second schema)

| UI | Backend field |
|----|---------------|
| تفعيل الأذان | `azanEnabled` |
| الصوت | `soundEnabled` |
| الاهتزاز | `vibrationEnabled` |
| تذكير قبل الصلاة | `preReminderEnabled` |
| دقائق التذكير | `preReminderMinutes` (default **15**, range **0..120**) |
| صوت الأذان | `azanSoundId` (legacy alias `voiceId`) |
| Pre-reminder tone / auto voice | `notificationSoundId` (use `sc_near_auto` for Arabic near clips) |
| FCM backup | `fcmPrayerBackupEnabled` |

### Accepted aliases on PATCH (additive)

| Alias | Maps to |
|-------|---------|
| `reminderMinutes` | `preReminderMinutes` |
| `prePrayerReminderMinutes` | `preReminderMinutes` |
| `prePrayerReminderEnabled` | `preReminderEnabled` |

GET also returns aliases: `reminderMinutes`, `prePrayerReminderMinutes`, `prePrayerReminderEnabled`.

### PATCH example

```json
{
  "azanEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "preReminderEnabled": true,
  "preReminderMinutes": 1,
  "azanSoundId": "mishary_alafasy",
  "notificationSoundId": "sc_near_auto",
  "fcmPrayerBackupEnabled": true,
  "prayers": { "fajr": true, "dhuhr": true, "asr": true, "maghrib": true, "isha": true }
}
```

---

## 6–9. Audio / media

```http
GET /api/v1/azan/media/{file}
```

- Public, allow-listed filenames only  
- `Content-Type: audio/mpeg`  
- **Range / 206** supported  
- Cache: `public, max-age=86400, immutable`

### Folders (do not mix)

| Folder | Use |
|--------|-----|
| `assets/azan/` | Full Adhan (2–5+ min) — **cache for exact Azan** |
| `assets/near-prayer/` | Short “approaching” voices (`sc_near_*`) — FCM/local **pre** |
| `assets/prayer-events/` | Short event voices (`sc_event_*`) — FRIDAY / DUHA / QIYAM + optional local event UI |
| `assets/notification/` | Generic chimes |

### Near-prayer (pre) files

`sc_near_fajr.mp3` … `sc_near_jumuah.mp3` (**spelling: jumuah**)

### Prayer-event files (new pack)

`sc_event_fajr|dhuhr|asr|maghrib|isha|jumuah|duha|qiyam.mp3`  
Listed in `GET /azan/notification-sounds` with `mood: prayer_event_voice` / `matchesEvent`.

---

## 10. Prayer reminder fields & copy

`preReminderMinutes` is authoritative (not hard-coded 15).

| Minutes | Pre titleAr example (Asr) |
|---------|---------------------------|
| 1 | بعد دقيقة يحين موعد صلاة العصر |
| 15 | بعد 15 دقيقة يحين موعد صلاة العصر |

Exact Azan titleAr:

```text
حان الآن موعد أذان العصر
```

(Same pattern for الفجر / الظهر / المغرب / العشاء; Friday pre uses الجمعة.)

---

## 11. Event types

| Flutter / FCM `eventType` | Backend `kind` | Meaning |
|---------------------------|----------------|---------|
| `PRE_PRAYER_REMINDER` | `pre_reminder` | N minutes before |
| `PRAYER_AZAN` | `prayer_time` | Exact prayer / Azan |
| `FRIDAY` | *(local only)* | Separate Friday event — **not** a 6th daily prayer |
| `DUHA` | *(local only)* | Separate Duha event |
| `QIYAM` | *(local only)* | Separate Qiyam event |

FCM backup currently sends `AZAN` with `kind` + additive `eventType` for the five daily prayers.  
**FRIDAY / DUHA / QIYAM are Flutter-local** (catalog + media provided; no duplicate cron path).

---

## 12. FCM token registration

```http
POST /api/v1/devices/fcm-token
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "token": "<fcmToken>", "platform": "android", "appVersion": "1.0.0", "locale": "ar" }
```

Also accepts `fcmToken` instead of `token`.  
`DELETE /devices/fcm-token` on logout.

---

## 13. Cron / backup behavior

- `POST /cron/prayer-reminders` — Railway `*/10 * * * *`, window ~12 min  
- Requires `fcmPrayerBackupEnabled`, `azanEnabled`, device tokens  
- Payload `type: AZAN`, `kind: pre_reminder|prayer_time`  
- **Not** primary exact Azan  
- Dedup via `azan_reminder_send_logs` + Flutter local `handledKey`

**Production note (verified 2026-09-25):** `GET /health` → `fcm.configured: false` until Firebase Admin is set on Railway. Local Azan still works offline after cache.

---

## 14. Error responses

| HTTP | Typical `code` |
|------|----------------|
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` |
| 400 | `VALIDATION_ERROR` |
| 404 | `NOT_FOUND` |
| 429 | `RATE_LIMIT_EXCEEDED` |

---

## 15–17. Required Flutter behavior / cache / reschedule

1. Fetch `/prayers/today` (or local Adhan) → schedule **local** PRE + AZAN.  
2. Fetch prefs → apply toggles / minutes / sound.  
3. Download `azanSound.audioUrl` → cache by `azanSoundId`.  
4. On settings / location / method / day / reboot / exact-alarm permission change → cancel + reschedule.  
5. Stable notification IDs per `date|key|eventType`.  
6. If local already fired → ignore FCM backup for same key.  
7. Offline at prayer time: play **cached** full Azan (not stream).

---

## 18. Android exact alarms

Targeting Android 13+: `SCHEDULE_EXACT_ALARM` is **not** auto-granted on many fresh installs.  
Detect permission, guide user to settings when product requires exact Azan, degrade gracefully if denied.  
See: https://developer.android.com/develop/background-work/services/alarms

Channels:

| Event | Channel ID |
|-------|------------|
| Pre-reminder | `azan-reminder` |
| Exact Azan | `azan` |

Near-prayer raw: `sc_near_*` (no `.mp3` in sound API).  
Channel sound is client-owned (Android 8+).

---

## 19. iOS Azan audio

Custom `UNNotificationSound` files must be **bundled** and **&lt; 30 seconds**.  
**Do not** set a full-length Adhan as notification sound.  

At exact prayer time: show notification + play cached Azan via a supported audio API (e.g. background audio / foreground service pattern you already use).  
Apple: https://developer.apple.com/documentation/usernotifications/unnotificationsound

Short `sc_near_*` / `sc_event_*` clips may be used as notification sounds if under 30s and bundled.

---

## 20. Duplicate prevention

```text
handledKey = date|KEY|PRE_PRAYER_REMINDER   or   date|KEY|PRAYER_AZAN
```

| Source | Rule |
|--------|------|
| Local | Mark handled when shown/played |
| FCM | Suppress if handledKey exists |
| Backend | Durable claim `date|KEY|pre_reminder|pre{N}` |

---

## Quick architecture

```text
LOCAL (primary)     schedule PRE + PRAYER_AZAN from times + prefs + cached Azan
FCM (backup)        only if fcmPrayerBackupEnabled + token + cron window
CATALOG             /azan/sounds + /azan/notification-sounds + /azan/media/:file
```
