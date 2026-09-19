# الصلاة على النبي ﷺ — Flutter handoff (complete)

**To:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-19  
**Status:** Settings API is live. Local notifications are the primary UX. Do **not** implement this from any Dart files in the backend repo.

This file is the **only** Backend → Flutter contract for the screen:

- Title: **الصلاة على النبي**
- Switch: **تفعيل التذكير** — تذكير محلي للصلاة على النبي ﷺ
- Interval chips: **٣٠ دقيقة** / **ساعة** / **ساعتان** / **٣ ساعات**
- Window: **من** `08:00` **إلى** `22:00` (overnight allowed, e.g. `22:00` → `08:00`)

Keep those Arabic UI strings. Source code identifiers stay English.

---

## 0. Do this first

1. **Delete / ignore any Dart copied from the backend repo.**  
   There must be **no** Flutter sources under NoorApp-Backend (`flutter_handoff/`, `*.dart`, etc.). Implement models + API calls **inside the Flutter app**, using the existing Dio `ApiService` (Bearer interceptor + refresh). Do not create a second HTTP client.
2. **Do not hard-code famous reciter Salawat from YouTube / TikTok / Spotify.** Those recordings are not licensed for Noor.
3. Bind the **existing** settings UI to the endpoints below. Do not rebuild the screen.

---

## A. Production base URL

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

Do not use `https://noor-app-backend-one.vercel.app`.

---

## B. Settings API (source of truth)

Auth: `Authorization: Bearer <accessToken>`  
User id comes from the token only (no IDOR).

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/profile/salawat-preferences` | Load switch, interval, window |
| `PATCH` | `/profile/salawat-preferences` | Save (partial). `{ "enabled": true }` still valid |
| `PUT` | `/profile/salawat-preferences` | Same handler as PATCH |

Envelope (do not change):

```text
success, message, data, meta, timestamp, requestId
```

### Request body (`PATCH` / `PUT`)

At least one field. Extra keys ignored.

| Field | Type | Values |
|-------|------|--------|
| `enabled` | boolean | JSON boolean only |
| `intervalMinutes` | int | **only** `30`, `60`, `120`, `180` |
| `startTime` | string | `HH:mm` `00:00`–`23:59` |
| `endTime` | string | `HH:mm` `00:00`–`23:59` |

Optional aliases (same meaning): `windowStart` = `startTime`, `windowEnd` = `endTime`. Prefer **`startTime` / `endTime`** in requests.

**Overnight is allowed.** Do **not** reject `startTime >= endTime`. Example: `22:00` → `08:00`.

Map UI chips:

| Chip | `intervalMinutes` |
|------|-------------------|
| ٣٠ دقيقة | `30` |
| ساعة | `60` |
| ساعتان | `120` |
| ٣ ساعات | `180` (default) |

### Copy-paste requests

```http
GET /profile/salawat-preferences
Authorization: Bearer <accessToken>
```

```http
PATCH /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "enabled": true }
```

```http
PUT /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "enabled": true,
  "intervalMinutes": 180,
  "startTime": "08:00",
  "endTime": "22:00"
}
```

```http
PATCH /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "enabled": false }
```

### Real success `data` (GET / PATCH / PUT)

```json
{
  "success": true,
  "message": "Salawat reminder preferences retrieved successfully",
  "data": {
    "enabled": false,
    "intervalMinutes": 180,
    "startTime": "08:00",
    "endTime": "22:00",
    "windowStart": "08:00",
    "windowEnd": "22:00",
    "intervalHours": 3,
    "maxPerDay": 4,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  },
  "meta": {},
  "timestamp": "2026-09-19T00:00:00.000Z",
  "requestId": "uuid"
}
```

PATCH/PUT message: `Salawat reminder preferences updated successfully`.

**Must keep (do not rename/remove):**  
`enabled`, `intervalMinutes`, `startTime`, `endTime`, `intervalHours`, `maxPerDay`, `quietHoursStart`, `quietHoursEnd`.  
`windowStart` / `windowEnd` are additive aliases of start/end.

| Field | Persist | Bind |
|-------|---------|------|
| `enabled` | yes | تفعيل التذكير |
| `intervalMinutes` | yes | الفترة chips |
| `startTime` | yes | من |
| `endTime` | yes | إلى |
| `intervalHours` | no | legacy (`180` → `3`, `30` → `0.5`) |
| `maxPerDay` | no | display only |
| `quietHoursStart` | no | legacy = `endTime` |
| `quietHoursEnd` | no | legacy = `startTime` |

Defaults for a user who never saved: **`enabled: false`**, interval **180**, window **08:00–22:00**.

---

## C. Errors

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | TOKEN_EXPIRED | INVALID_TOKEN | VALIDATION_ERROR",
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

| Case | HTTP | `code` |
|------|------|--------|
| Missing / bad token | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` |
| Expired access token | 401 | `TOKEN_EXPIRED` |
| Empty body, interval not in 30/60/120/180, bad `HH:mm`, `enabled` not boolean | 400 | `VALIDATION_ERROR` |

- `401` + `TOKEN_EXPIRED` → refresh once, retry.  
- Other `401` → login.  
- `400` → show `message`, keep the sheet open.  
- Network failure → existing snackbar, do not dump stack traces.

---

## D. Screen behavior (match the screenshot)

This screenshot is **already supported** by the backend. Map 1:1:

| UI | Backend |
|----|---------|
| تفعيل التذكير | `enabled` |
| ٣٠ دقيقة | `intervalMinutes: 30` |
| ساعة | `60` |
| ساعتان | `120` |
| ٣ ساعات ✓ | `180` (default) |
| من 08:00 | `startTime` |
| إلى 22:00 | `endTime` |
| يمكن أن تمتد النافذة لليل (٢٢:٠٠ ← ٠٨:٠٠) | overnight allowed (`startTime` > `endTime`) |
| تذكير محلي للصلاة على النبي ﷺ | local notifications are primary |

1. Open screen → `GET /profile/salawat-preferences`.
2. Switch ← `data.enabled`. Subtitle stays **تذكير محلي للصلاة على النبي ﷺ**.
3. Highlight the chip for `data.intervalMinutes`.
4. **من** ← `data.startTime`, **إلى** ← `data.endTime`.
5. On toggle / chip / time change → debounce, then `PATCH` only the changed fields (or send the full object). One in-flight request.
6. On **200**, bind UI from **response `data`**, then re-GET if Home also shows this setting.
7. Disable → `PATCH { "enabled": false }`. Cancel local schedules immediately. Interval/window stay stored.

Timezone for scheduling = **profile** `users.timezone` (IANA, fallback `Africa/Cairo`), same as Azan — not raw device TZ unless you already synced it.

---

## E. Who fires the reminder

| Layer | Role |
|-------|------|
| **Local notifications** | **Primary.** Schedule in user timezone only if `enabled === true`. |
| **Backend FCM** | Backup on existing `POST /cron/prayer-reminders` (~10 min). Only if `enabled === true` and a device token exists. |

Production `GET /health` may show `fcm.configured: false`. Prefs still persist. Do not depend on FCM for this screen.

If both local + FCM fire: ignore FCM when a local slot already rang (same as Azan). Backend also de-dupes with `salawat_send_logs` `(userId, occurrenceKey)`.

FCM / inbox (do not rename):

```text
data.type = SALAWAT
data.kind = salawat_reminder
inbox type = SALAWAT
```

Additive when audio is available: `audioClipId`, `audioUrl` (strings).

---

## F. Audio — verified status (important)

Flutter **must** load clips from the API. Do **not** ship famous YouTube Salawat files.

### What is actually playable today

| id | What it is | `available` | Play? |
|----|------------|-------------|-------|
| `peaceful_reminder_tone` | CC0 meditation bell (already hosted) | **true** | yes |
| `calm_chime` | CC0 soft chime (already hosted) | **true** | yes |
| `salli_ala_muhammad` | Short CC0 vocal “صلِّ على محمد” (Freesound) | **false** | no — MP3 not hosted |
| `laa_tansi_salli_ala_muhammad` | Short CC0 vocal (Freesound) | **false** | no — MP3 not hosted |

**Famous reciter Salawat is not hosted as MP3** (copyright / no license to mirror Mishary, Maher, etc.). Do **not** download YouTube/Spotify/TikTok into the app bundle.

For a “listen to a famous recitation” action, open these **official listen pages** (browser / YouTube / Spotify). They are **not** `audioUrl` streams for `just_audio`:

| Reciter | Title | Listen link |
|---------|--------|-------------|
| مشاري راشد العفاسي | اللهم صل على سيدنا محمد | https://open.spotify.com/track/2NjazH1wRygYOkRdWgzm7O |

The **reminder notification itself** must stay a **short** sound: use `GET /salawat/audio` clips with `available: true` (CC0 tones), or the OS default. A 2-minute nasheed is the wrong asset for a repeating local reminder.

### Catalog API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/salawat/audio` | none (same idea as `/azan/sounds`) |
| `GET` | `/salawat/media/:file` | none |

```http
GET /salawat/audio
```

```json
{
  "success": true,
  "message": "Salawat audio catalog retrieved successfully",
  "data": {
    "defaultId": "peaceful_reminder_tone",
    "count": 4,
    "availableCount": 2,
    "clips": [
      {
        "id": "peaceful_reminder_tone",
        "title": "Peaceful reminder tone",
        "titleAr": "نغمة تذكير هادئة",
        "url": "https://HOST/api/v1/salawat/media/meditation_bell.mp3",
        "audioUrl": "https://HOST/api/v1/salawat/media/meditation_bell.mp3",
        "previewUrl": "https://HOST/api/v1/salawat/media/meditation_bell.mp3",
        "source": "https://freesound.org/people/kevp888/sounds/140128/",
        "license": "CC0-1.0",
        "creator": "kevp888",
        "attribution": "…",
        "durationSeconds": 4,
        "available": true,
        "isDefault": true
      }
    ],
    "sourcePolicy": {}
  },
  "meta": {},
  "timestamp": "2026-09-19T00:00:00.000Z",
  "requestId": "uuid"
}
```

Rules:

- Play only `available === true` **and** `url` / `audioUrl` non-null.
- Empty playable list → notification **without** custom sound. Do not crash.
- Malformed `clips` → treat as empty list.
- Cache `audioUrl` after first download (same pattern as Azan).
- This screen does **not** need an audio picker unless product adds one later. For local notifications, use `defaultId` if it is available, else first playable clip.

Licenses (CC0): Freesound `788917`, `788912`, `140128`, `750607`. See backend `assets/ATTRIBUTION.md`.

---

## G. Flutter implementation notes (in the Flutter repo)

Reuse existing Dio + `fromJson` style (Adhkar / Azan). Suggested method names on the **existing** ApiService:

- `getPrayerUponProphetSettings()` → `GET /profile/salawat-preferences` → parse `response.data['data']`
- `updatePrayerUponProphetSettings(...)` → `PATCH /profile/salawat-preferences`
- `getPrayerUponProphetAudio()` → `GET /salawat/audio`

Parse `startTime`/`endTime`. You may also read `windowStart`/`windowEnd` if present. Always **write** `startTime`/`endTime`.

Suggested save payloads:

```json
{ "enabled": true }
{ "intervalMinutes": 30 }
{ "startTime": "08:00", "endTime": "22:00" }
```

Loading / saving flags: follow existing settings screens (Azan prefs). Disable the switch while a PATCH is in flight.

---

## H. Backward compatibility (must not break)

- Envelope unchanged.
- `{ "enabled": true|false }` still works.
- Field names above stay.
- Azan, prayer times, Quran, Sadaqah, Journey: untouched.
- Cron path unchanged: `/cron/prayer-reminders` (Flutter does not call this).

---

## I. Checklist for Flutter

- [ ] No Dart taken from the backend repo
- [ ] GET prefs on open; default off
- [ ] Switch / 30 / 60 / 120 / 180 / 08:00–22:00 wired
- [ ] Overnight window allowed
- [ ] PATCH then update UI from `data`
- [ ] 401 refresh vs login
- [ ] 400 shows `message`
- [ ] Local schedule is primary; FCM is backup only
- [ ] Audio from `GET /salawat/audio` only; skip `available: false`
- [ ] Arabic UI strings unchanged

---

## J. Backend (for awareness only)

Prefs live on the **user** row (`salawatReminderEnabled`, `salawatIntervalMinutes`, `salawatWindowStart`, `salawatWindowEnd`). Default off. Cron uses `User.timezone`, skips disabled users, de-dupes with `salawat_send_logs`.

Flutter does not need to call cron or write those columns.
