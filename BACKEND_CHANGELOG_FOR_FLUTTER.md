# BACKEND_CHANGELOG_FOR_FLUTTER.md

**Updated:** 2026-09-25  
**Rule:** Additive / backward compatible unless noted.

---

## Summary for Flutter

| Change | Breaking? | Action |
|--------|-----------|--------|
| Pref aliases `reminderMinutes`, `prePrayerReminder*` | No | Optional; canonical remains `preReminder*` |
| Arabic copy for pre/Azan titles | **Copy change** | Prefer `data.titleAr` from FCM / use same rules locally |
| Additive FCM `eventType` | No | Map `PRE_PRAYER_REMINDER` / `PRAYER_AZAN` |
| Prayer-event media pack `sc_event_*` | No | Optional for FRIDAY/DUHA/QIYAM local events |
| Media origin fallback → Railway | No | Absolute URLs prefer Railway when `PUBLIC_APP_ORIGIN` unset |
| Near-prayer timing classifier | No | Backup FCM respects user minutes (1/5/10/15…) |
| Durable Azan FCM idempotency table | No | Client still dedups vs local |

---

## Endpoints

### `DELETE /auth/me`

| | |
|--|--|
| Auth | Bearer |
| Request | none |
| Response | `{ deleted: true, deletedAt }` |
| Old | Already shipped for Play |
| New | Unchanged (verified smoke PASS on production) |
| Migration | none |
| Compat | Full |

### `GET|PATCH /profile/azan-preferences`

| | |
|--|--|
| Auth | GET optional guest defaults; PATCH Bearer |
| Request (PATCH) | existing fields + aliases `reminderMinutes`, `prePrayerReminderMinutes`, `prePrayerReminderEnabled` |
| Response | prefs + `azanSound` + `notificationSound` + aliases |
| Old | `preReminderMinutes` only |
| New | aliases mirrored on GET; validation still `0..120` int |
| Compat | Full |

### `GET /azan/sounds`

| | |
|--|--|
| Auth | Public |
| Change | none required |
| Compat | Full |

### `GET /azan/notification-sounds`

| | |
|--|--|
| Auth | Public |
| Old | tones + `sc_near_*` |
| New | also lists `sc_event_*` (FAJR…QIYAM) with `matchesEvent` |
| Compat | Full (additive list entries) |

### `GET /azan/media/:file`

| | |
|--|--|
| Auth | Public |
| New files | `sc_event_*.mp3` under allow-list |
| Range | 206 preserved |
| Compat | Full |

### `POST /devices/fcm-token`

| | |
|--|--|
| Change | none |
| Compat | Full |

### `POST /cron/prayer-reminders`

| | |
|--|--|
| Auth | `CRON_SECRET` (not Flutter) |
| New | `eventType`, `nearPrayerLocalTime`, `reminderMinutes` in AZAN data; occurrence claim |
| Compat | Old clients ignore new fields |

---

## FCM AZAN data (additive fields)

| Field | Example | Notes |
|-------|---------|-------|
| `eventType` | `PRE_PRAYER_REMINDER` | New; `kind` still present |
| `reminderMinutes` | `"15"` | Alias of `preReminderMinutes` |
| `nearPrayerLocalTime` | `"04:45"` | Computed local HH:mm |
| `occurrenceKey` | `2026-09-25\|FAJR\|pre_reminder\|pre15` | Dedup |

`kind` values unchanged: `pre_reminder` | `prayer_time`.

---

## Notification Arabic copy (product)

| Event | Example |
|-------|---------|
| Pre (1 min, Asr) | بعد دقيقة يحين موعد صلاة العصر |
| Pre (15 min, Asr) | بعد 15 دقيقة يحين موعد صلاة العصر |
| Exact Azan (Asr) | حان الآن موعد أذان العصر |

Flutter local notifications should use the **same** strings for consistency with FCM backup.

---

## Migration requirement (ops)

`20260925070000_azan_reminder_send_logs` — durable FCM idempotency.  
Must be deployed with the backend that claims occurrences. Flutter needs no client migration.
