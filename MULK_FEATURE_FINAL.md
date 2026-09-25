# Surah Al-Mulk Bedtime Reminder — Flutter Contract

**Send this file to the Flutter developer** for the Surah Al-Mulk before-sleep reminder.  
Also mirrored in `FLUTTER_PRAYER_NOTIFICATIONS_CONTRACT.md` §9b.

**Production API base**

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

---

## Product

Daily reminder: **لا تنس قراءة سورة الملك** at the user’s local evening time (default **20:00** / 8 PM in each IANA timezone worldwide).

| Layer | Role |
|-------|------|
| **Flutter (primary)** | Exact local notification at `time` |
| **Backend FCM (backup)** | Same cron as Azan/Salawat (`/cron/prayer-reminders`), ±12 min window |
| **Prefs** | Source of truth via `/profile/mulk-preferences` |

Default: **opt-in** (`enabled: false`). User must enable in settings.

---

## Prefs API

| Method | Path | Auth |
|--------|------|------|
| GET | `/profile/mulk-preferences` | Bearer |
| PATCH | `/profile/mulk-preferences` | Bearer |
| PUT | `/profile/mulk-preferences` | Bearer (same as PATCH) |

### PATCH body

```json
{
  "enabled": true,
  "time": "20:00"
}
```

- `enabled` — boolean (optional on patch if `time` present)
- `time` — local `HH:mm` `00:00`–`23:59` (optional on patch if `enabled` present)
- At least one field required

### Response `data`

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

---

## FCM / local payload

All `data` values are **strings**.

| Field | Value |
|-------|-------|
| `eventType` / `eventKey` / `soundType` / `type` | `MULK` |
| `kind` | `mulk_reminder` |
| `androidChannelId` | `mulk` |
| `surahId` | `67` |
| `deepLink` | `/quran/surah/67` |
| `reminderTime` | e.g. `20:00` |
| `dedupeKey` | `{dayKey}\|{userId}\|MULK\|MULK\|{occurrenceKey}` |
| `occurrenceKey` | `{dayKey}\|MULK\|{time}` |
| `titleAr` / `bodyAr` / `titleEn` / `bodyEn` | as above |
| `source` | `FCM_BACKUP` (backend only) |

**Android:** create channel `mulk` (separate from `salawat` / `azan`). Soft/default system tone is fine.

**Tap action:** open Quran Surah Al-Mulk (`surahId` 67 / `deepLink`).

---

## Flutter checklist

- [ ] Settings toggle + time picker ↔ GET/PATCH `/profile/mulk-preferences`
- [ ] Local schedule at `time` in user IANA timezone
- [ ] Reschedule when prefs or timezone change
- [ ] Channel `mulk` on Android
- [ ] FCM handler for `eventType=MULK`
- [ ] Dedup local ↔ FCM with `dedupeKey`
- [ ] Tap → Surah 67

---

## Backend notes (for reference)

- User fields: `mulkReminderEnabled`, `mulkReminderTime`
- Durable de-dupe table: `mulk_send_logs`
- In-app notification type: `MULK`
- Same Railway cron job as prayer reminders — no extra scheduler
