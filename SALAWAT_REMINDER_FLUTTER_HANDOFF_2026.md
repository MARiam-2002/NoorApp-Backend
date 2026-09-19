# الصلاة على النبي ﷺ — Flutter handoff (Production)

**To:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-19  
**Production verified:** YES — Railway live smoke passed (prefs, catalog count 6, `audioClipId` persist, hosted MP3 `200 audio/mpeg`)

This file is the **only** Backend → Flutter contract.  
**Do not copy Dart from the backend repo.** There are no Flutter sources in NoorApp-Backend. Implement inside the Flutter app with the existing Dio `ApiService`.

---

## A. Production base URL

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

Do not use the retired Vercel host.

Envelope (never change):

```text
success, message, data, meta, timestamp, requestId
```

---

## B. Screen (already matches backend)

| UI | Backend |
|----|---------|
| تفعيل التذكير | `enabled` |
| ٣٠ دقيقة / ساعة / ساعتان / ٣ ساعات | `intervalMinutes` `30` / `60` / `120` / `180` |
| من 08:00 | `startTime` |
| إلى 22:00 | `endTime` |
| النافذة تمتد لليل (٢٢:٠٠ ← ٠٨:٠٠) | overnight allowed |
| تذكير محلي للصلاة على النبي ﷺ | **local notifications = primary** |
| اختيار الصوت | `GET /salawat/audio` + `PATCH { "audioClipId": "<id>" }` |

Keep Arabic UI strings. Identifiers in code stay English.

---

## C. Settings API

Auth: `Authorization: Bearer <accessToken>`  
User id from token only.

| Method | Path |
|--------|------|
| `GET` | `/profile/salawat-preferences` |
| `PATCH` | `/profile/salawat-preferences` |
| `PUT` | `/profile/salawat-preferences` (same as PATCH) |

### Request (`PATCH` / `PUT`)

At least one field.

| Field | Type | Notes |
|-------|------|--------|
| `enabled` | boolean | JSON boolean |
| `intervalMinutes` | int | **only** `30`, `60`, `120`, `180` |
| `startTime` | string | `HH:mm` |
| `endTime` | string | `HH:mm` |
| `audioClipId` | string | Must be an `id` from `GET /salawat/audio` |

Aliases: `windowStart` = `startTime`, `windowEnd` = `endTime`. Prefer `startTime` / `endTime`.

Overnight is allowed (`startTime` > `endTime`).

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
  "endTime": "22:00",
  "audioClipId": "mishary_allahumma_salli"
}
```

```http
PATCH /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "audioClipId": "maher_ya_nabi_salam" }
```

```http
PATCH /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "enabled": false }
```

### Success `data` (real shape)

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
    "quietHoursEnd": "08:00",
    "audioClipId": "peaceful_reminder_tone"
  },
  "meta": {},
  "timestamp": "2026-09-19T00:00:00.000Z",
  "requestId": "uuid"
}
```

PATCH/PUT message: `Salawat reminder preferences updated successfully`.

**Must keep:** `enabled`, `intervalMinutes`, `startTime`, `endTime`, `intervalHours`, `maxPerDay`, `quietHoursStart`, `quietHoursEnd`.  
**Additive:** `windowStart`, `windowEnd`, `audioClipId`.

Defaults: `enabled: false`, `intervalMinutes: 180`, window `08:00`–`22:00`, `audioClipId: "peaceful_reminder_tone"`.

### Errors

| Case | HTTP | `code` |
|------|------|--------|
| Missing / bad token | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` |
| Expired access | 401 | `TOKEN_EXPIRED` |
| Empty body, bad interval, bad time, unknown `audioClipId` | 400 | `VALIDATION_ERROR` |

`401` + `TOKEN_EXPIRED` → refresh once. Other `401` → login. `400` → show `message`.

---

## D. Audio picker (live Production catalog)

```http
GET /salawat/audio
```

No auth. Same envelope.

**Do not hard-code clip URLs.** Always load this list.

Verified live (2026-09-19) `data.count = 6`.

| id | UI title (AR) | `playback` | How Flutter uses it |
|----|---------------|------------|---------------------|
| `mishary_allahumma_salli` | اللهم صل على سيدنا محمد — مشاري | `external` | Open `listenUrl` / `spotifyUrl` |
| `maher_ya_nabi_salam` | يا نبي سلام عليك — ماهر زين | `external` | Open `listenUrl` (YouTube) or `spotifyUrl` |
| `maher_salla_alayka_rahman` | صلى عليك الرحمن — ماهر زين | `external` | Open `listenUrl` (YouTube) or `spotifyUrl` |
| `salli_ala_muhammad` | صلِّ على محمد | `file` | MP3 not hosted yet (`audioUrl` null) — preview via `listenUrl` |
| `peaceful_reminder_tone` | نغمة تذكير هادئة **(default)** | `file` | Play `audioUrl` in-app / local notification |
| `calm_chime` | رنين هادئ | `file` | Play `audioUrl` |

### Real Production clip examples

Hosted notification MP3 (play with the existing audio player):

```text
https://noorapp-backend-production.up.railway.app/api/v1/salawat/media/meditation_bell.mp3
https://noorapp-backend-production.up.railway.app/api/v1/salawat/media/soft_chime.mp3
```

Famous listen links (stored in backend; **not** app MP3s — copyright):

```text
https://open.spotify.com/track/2NjazH1wRygYOkRdWgzm7O
https://www.youtube.com/watch?v=Vqfy4ScRXFQ
https://www.youtube.com/watch?v=-Nly_L_f4Ng
https://open.spotify.com/track/0KcEMREqmRmjJQoDSNUWnT
https://open.spotify.com/track/2JVRBAOAXAcNM21EyziBLj
```

Clip fields:

| Field | Meaning |
|-------|---------|
| `id` | Save this as `audioClipId` |
| `title` / `titleAr` | Picker labels |
| `creator` / `creatorAr` | Reciter / source |
| `audioUrl` / `url` / `previewUrl` | In-app MP3 when not null |
| `listenUrl` | Open externally (YouTube/Spotify/Freesound) |
| `youtubeUrl` / `spotifyUrl` | Optional extras |
| `playback` | `file` = MP3, `external` = open link |
| `selectable` | Show in picker if true |
| `available` | Listed and usable (link and/or file) |
| `isDefault` | Default selection |
| `license` | `CC0-1.0` or `all_rights_reserved` |

### Picker rules

1. `GET /salawat/audio` → show every `selectable` clip.
2. User taps a clip → `PATCH { "audioClipId": "<id>" }`.
3. Highlight the clip whose `id` equals prefs `audioClipId`.
4. **Preview:** if `audioUrl != null`, play it. Else open `listenUrl` (url_launcher / YouTube / Spotify).
5. **Local reminder sound:** only use `audioUrl` when `playback == "file"` and `audioUrl != null`. If the user picked a famous `external` clip, use default hosted tone `peaceful_reminder_tone` (or `calm_chime`) for the notification itself. Do **not** download YouTube/Spotify into the app.
6. Empty / malformed `clips` → empty picker, keep default tone, do not crash.

```json
{
  "success": true,
  "message": "Salawat audio catalog retrieved successfully",
  "data": {
    "defaultId": "peaceful_reminder_tone",
    "count": 6,
    "selectableCount": 6,
    "availableCount": 6,
    "fileCount": 2,
    "clips": [],
    "sourcePolicy": {}
  }
}
```

`GET /salawat/media/:file` streams hosted MP3 (`Content-Type: audio/mpeg`, Range supported).

---

## E. Local reminder vs FCM

| Layer | Role |
|-------|------|
| Local notifications | **Primary.** Schedule in **profile timezone** (`users.timezone`, fallback `Africa/Cairo`) only if `enabled === true`. |
| Backend FCM | Backup on `/cron/prayer-reminders`. Production `GET /health` may show `fcm.configured: false`. |

FCM / inbox (do not rename):

```text
type = SALAWAT
kind = salawat_reminder
```

Additive when a hosted file exists: `audioClipId`, `audioUrl`.

If local + FCM both fire, ignore FCM for a slot that already rang (same as Azan).

---

## F. Flutter wiring

Reuse existing Dio + `fromJson` on `response.data['data']`.

Suggested methods on the **existing** client:

- `getPrayerUponProphetSettings()` → `GET /profile/salawat-preferences`
- `updatePrayerUponProphetSettings(...)` → `PATCH /profile/salawat-preferences`
- `getPrayerUponProphetAudio()` → `GET /salawat/audio`

Flow:

1. Open screen → GET prefs + GET audio (parallel).
2. Bind switch, chips, times, selected `audioClipId`.
3. Debounce saves. One in-flight PATCH.
4. On 200, apply returned `data`.
5. Disable → `PATCH { "enabled": false }` and cancel local schedules.

---

## G. Backward compatibility

Unchanged: envelope, `{ "enabled": true|false }`, field names above, Azan / Quran / Sadaqah / Journey.

`audioClipId` and the audio catalog are **additive**.

---

## H. Checklist

- [ ] No Dart taken from the backend repo
- [ ] GET prefs on open; default off
- [ ] 30 / 60 / 120 / 180 + 08:00–22:00 + overnight
- [ ] Sound picker from `GET /salawat/audio`
- [ ] Save `audioClipId`; famous clips open `listenUrl`
- [ ] Notification uses hosted MP3 only
- [ ] 401 refresh vs login; 400 shows `message`

---

## I. Production verification (backend, 2026-09-19)

```text
PASS  GET/PUT/PATCH /profile/salawat-preferences unauthenticated → 401
PASS  GET /salawat/audio count=6 (famous links + tones)
PASS  GET default enabled=false
PASS  PUT enable + interval 60
PASS  PATCH disable
PASS  PATCH audioClipId=mishary_allahumma_salli persists
PASS  GET /salawat/media/meditation_bell.mp3 → 200 audio/mpeg
```
