# Noor App — Surah Al-Mulk Bedtime Reminder — Final Flutter Contract

> **Status:** LIVE on production.  
> **Send this file only to the Flutter developer.** Do not need any other Mulk doc.  
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

Auth for prefs:

```http
Authorization: Bearer <access_token>
```

Unauthenticated → `401`.

---

## 1. Product

Daily bedtime reminder to read **سورة الملك** (Surah 67).

| Concern | Behavior |
|---------|----------|
| Copy (AR title) | `سورة الملك` |
| Copy (AR body) | `لا تنس قراءة سورة الملك` |
| Copy (EN title) | `Surah Al-Mulk` |
| Copy (EN body) | `Don't forget to read Surah Al-Mulk` |
| Default time | **`20:00`** (8 PM) in the **user’s IANA timezone** (Cairo 20:00 ≠ New York 20:00) |
| Default enabled | **`false`** (opt-in — user must enable in settings) |
| Tap opens | Quran Surah **67** → `deepLink`: `/quran/surah/67` |
| Flutter role | **Primary** — exact local alarm at `time` |
| Backend FCM | **Backup** — same cron as Azan/Salawat, ±12 minutes local window |
| Dedup | One user-visible notification per day via `dedupeKey` |

---

## 2. Prefs API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/profile/mulk-preferences` | Bearer |
| `PATCH` | `/profile/mulk-preferences` | Bearer |
| `PUT` | `/profile/mulk-preferences` | Bearer (same as PATCH) |

### PATCH / PUT body

```json
{
  "enabled": true,
  "time": "20:00"
}
```

| Field | Rules |
|-------|--------|
| `enabled` | boolean; optional if `time` is sent |
| `time` | local `HH:mm` (`00:00`–`23:59`); optional if `enabled` is sent |
| — | At least one of `enabled` / `time` is required |

Invalid `time` (e.g. `25:00`, `8:00`) → `400` / validation error.

### Example requests

```http
GET /api/v1/profile/mulk-preferences
Authorization: Bearer <token>
```

```http
PATCH /api/v1/profile/mulk-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true,
  "time": "20:00"
}
```

### Response `data` (GET / PATCH / PUT)

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

Use `titleAr` / `bodyAr` (and EN) from this response for tray text — do not hard-code alternate wording.

---

## 3. Local scheduling (Flutter — primary)

1. After login / prefs load: `GET /profile/mulk-preferences`
2. If `enabled === true`, schedule **one daily** local notification at `time` in the user’s profile IANA timezone (same timezone used for prayer times)
3. Reschedule when:
   - user patches `enabled` / `time`
   - user timezone changes
4. Notification title / body = `titleAr` / `bodyAr` from prefs
5. On tap → open Quran Surah `surahId` (`67`) using `deepLink`

If `enabled === false`, cancel any pending Mulk local alarm.

---

## 4. FCM payload (backup)

All `data` values are **strings**.

```json
{
  "data": {
    "type": "MULK",
    "kind": "mulk_reminder",
    "eventType": "MULK",
    "eventKey": "MULK",
    "soundType": "MULK",
    "androidChannelId": "mulk",
    "source": "FCM_BACKUP",
    "timezone": "Africa/Cairo",
    "dayKey": "2026-09-26",
    "reminderTime": "20:00",
    "occurrenceKey": "2026-09-26|MULK|20:00",
    "dedupeKey": "2026-09-26|<userId>|MULK|MULK|2026-09-26|MULK|20:00",
    "surahId": "67",
    "deepLink": "/quran/surah/67",
    "titleAr": "سورة الملك",
    "bodyAr": "لا تنس قراءة سورة الملك",
    "titleEn": "Surah Al-Mulk",
    "bodyEn": "Don't forget to read Surah Al-Mulk"
  }
}
```

| Field | Value |
|-------|-------|
| `eventType` / `eventKey` / `soundType` / `type` | `MULK` |
| `kind` | `mulk_reminder` |
| `androidChannelId` | `mulk` |
| `surahId` | `67` |
| `deepLink` | `/quran/surah/67` |
| `source` | `FCM_BACKUP` (backend only) |

**Dedup rule:** if a local notification and FCM share the same `dedupeKey` for that day → show **one** tray notification only.

---

## 5. Android / iOS

| Platform | Requirement |
|----------|-------------|
| Android 8+ | Create channel id **`mulk`** (separate from `azan`, `near_prayer`, `salawat`). Soft / default system tone is fine. |
| iOS | Default notification sound OK; route by `eventType=MULK` in FCM `data` |
| Tap | Navigate to Surah Al-Mulk (`surahId` 67) |

---

## 6. Settings UI mapping

| UI | API |
|----|-----|
| Toggle “تذكير سورة الملك” / bedtime Mulk | `enabled` |
| Time picker (default 8:00 PM) | `time` (`HH:mm`) |
| Load on open | `GET /profile/mulk-preferences` |
| Save on change | `PATCH /profile/mulk-preferences` |

---

## 7. Flutter checklist

- [ ] Settings toggle + time picker ↔ `GET` / `PATCH` `/profile/mulk-preferences`
- [ ] Local daily alarm at `time` in user IANA timezone
- [ ] Cancel alarm when `enabled` is false
- [ ] Reschedule on prefs or timezone change
- [ ] Android channel `mulk`
- [ ] FCM handler: `eventType === "MULK"`
- [ ] Dedup local ↔ FCM via `dedupeKey`
- [ ] Tap → open Surah 67 (`/quran/surah/67`)
- [ ] Copy from API (`titleAr` / `bodyAr`) — default body: **لا تنس قراءة سورة الملك**

---

## 8. QA

- [ ] Enable + `20:00` → local fires at 8 PM local
- [ ] Change timezone → still fires at 8 PM **local** for that zone
- [ ] Disable → no local, no FCM for that user
- [ ] Change time to `21:30` → fires at 21:30 local
- [ ] Local + FCM same day same `dedupeKey` → one notification
- [ ] Tap opens Surah Al-Mulk (67)
