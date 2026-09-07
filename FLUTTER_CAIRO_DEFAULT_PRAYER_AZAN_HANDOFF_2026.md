# Flutter Cairo Default Prayer Times & Azan Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-07  
**Language:** English only  

**Backend status:** Cairo default prayer times, Azan location resolution, and **Azan / notification sound catalogs** are **READY** for Flutter integration.

---

## 1. Goal

Before login and before the user has a real GPS / saved location, prayer times and Azan must use **Cairo, Egypt**.

After login **and** a real location is available, use that location instead.

```text
First open (guest / no location):
  Flutter → GET /prayers/today (no auth, no lat/lng)
  Backend → Cairo defaults
  Flutter → show times + schedule local Azan for Cairo

After login + location:
  Flutter → PUT /profile/location  (and/or PATCH /profile/azan-preferences with lastLat/lastLng)
  Flutter → GET /prayers/today  (Bearer, no lat/lng)  OR  /dashboard
  Backend → profile coordinates
```

---

## 2. Default Cairo constants (Backend)

| Field | Value |
|-------|-------|
| City | Cairo / القاهرة |
| Country | Egypt / مصر |
| Latitude | `30.0444` |
| Longitude | `31.2357` |
| Timezone | `Africa/Cairo` |
| Method | Egyptian General Authority of Survey (`EGYPT` / `EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY`) |
| Madhab | `SHAFI` |
| `locationSource` | `default_cairo` |
| `isDefaultLocation` | `true` |

---

## 3. Location resolution rules

| Situation | Coordinates used | `locationSource` |
|-----------|------------------|------------------|
| Guest, no query coords | Cairo | `default_cairo` |
| Any client sends `lat`/`lng` (or `latitude`/`longitude`) | Query coords | `query` |
| Authenticated, profile has lat/lng, no query | Profile | `profile` |
| Authenticated, profile has **no** lat/lng, no query | Cairo | `default_cairo` |

Priority when both exist: **query coords > profile > Cairo default**.

---

## 4. Exact API endpoints

### 4.1 Guest / first open (no login)

```http
GET /api/v1/prayers/today
```

- **Auth:** none  
- **Query:** none required  
- **Result:** full today schedule for Cairo  
- Look for: `isDefaultLocation: true`, `locationSource: "default_cairo"`, `city: "Cairo"`

Equivalent:

```http
GET /api/v1/prayers/schedule
```

(same Cairo default when coords omitted)

### 4.2 Device GPS available (guest or logged-in)

```http
GET /api/v1/prayers/today?latitude=30.05&longitude=31.24&timezone=Africa/Cairo
```

Aliases: `lat` / `lng` also accepted.  
Optional: `method`, `madhab`.

`locationSource` → `query`.

### 4.3 Logged-in, use saved location

```http
GET /api/v1/prayers/today
Authorization: Bearer <token>
```

(no lat/lng → profile, else Cairo)

Also on Home:

```http
GET /api/v1/dashboard
Authorization: Bearer <token>
```

`data.prayers` includes the same location fields.

### 4.4 Save real location (switch off Cairo)

```http
PUT /api/v1/profile/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "latitude": 31.2001,
  "longitude": 29.9187,
  "timezone": "Africa/Cairo",
  "city": "Alexandria"
}
```

And/or Azan sync:

```http
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "lastLat": 31.2001,
  "lastLng": 29.9187,
  "lastLocationLabel": "Alexandria"
}
```

After this, prayer/Azan endpoints use the real location (`isDefaultLocation: false`, `locationSource: "profile"`).

### 4.5 Read Azan preferences

```http
GET /api/v1/profile/azan-preferences
Authorization: Bearer <token>
```

If the user has no saved location, Backend **fills Cairo** into `lastLat` / `lastLng` / `lastLocationLabel` for the response and sets:

- `isDefaultLocation: true`
- `locationSource: "default_cairo"`

These two flags are **response-only** (not required on PATCH body).

---

## 5. Response shape (prayer schedule)

Shared by `/prayers/today`, `/prayers/schedule`, and `dashboard.prayers`:

```json
{
  "success": true,
  "data": {
    "date": "2026-09-07",
    "timezone": "Africa/Cairo",
    "latitude": 30.0444,
    "longitude": 31.2357,
    "city": "Cairo",
    "cityAr": "القاهرة",
    "country": "Egypt",
    "countryAr": "مصر",
    "calculationMethod": "EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY",
    "madhab": "SHAFI",
    "locationSource": "default_cairo",
    "isDefaultLocation": true,
    "nextPrayer": {
      "name": "Asr",
      "key": "ASR",
      "nameAr": "العصر",
      "time": "16:25",
      "displayAr": "…",
      "displayEn": "…",
      "iso": "…",
      "countdownSeconds": 1234
    },
    "schedule": [
      {
        "name": "Fajr",
        "key": "FAJR",
        "nameAr": "الفجر",
        "time": "05:06",
        "displayAr": "…",
        "displayEn": "…",
        "iso": "…",
        "completed": false
      }
    ],
    "completedCount": 0,
    "totalCount": 5
  }
}
```

Always **5** prayers: Fajr, Dhuhr, Asr, Maghrib, Isha. Times are 24h `HH:mm`.

---

## 6. Flutter architecture (recommended)

```text
UI (Home / Prayer times / Azan settings)
  → PrayerRepository
      → if guest or no saved location: GET /prayers/today
      → if logged-in with location: GET /prayers/today (Bearer) or /dashboard
  → Local Azan scheduler (device notifications)
      → schedule from Backend times for the active location
```

| Layer | Responsibility |
|-------|----------------|
| **UI** | Show times; show city label from `city` / `cityAr`; optional “Using Cairo until location is set” when `isDefaultLocation` |
| **Repository** | Call the endpoints above; never invent prayer times when online |
| **Local Azan** | Schedule/cancel device notifications from the latest Backend schedule |
| **Location sync** | After GPS permission / login → `PUT /profile/location` then refresh prayers |

---

## 7. First-install / guest flow

```text
1. App opens (no token)
2. GET /prayers/today          → Cairo schedule
3. Schedule local Azan from that schedule
4. Show prayer card with city Cairo / القاهرة
5. When user grants GPS (optional, still guest):
     GET /prayers/today?lat=&lng= → update UI + reschedule Azan
6. After login:
     PUT /profile/location with real coords (if available)
     GET /dashboard or /prayers/today with Bearer
```

---

## 8. Transition to real location

```text
isDefaultLocation == true
  → still Cairo (or query override)

User saves location (profile or azan-preferences)
  → Backend stores lat/lng
  → Next GET without query coords → locationSource=profile, isDefaultLocation=false
  → Flutter must reschedule local Azan for the new times
```

Do **not** keep showing Cairo after a successful location save + refresh.

---

## 9. Azan notes

| Topic | Backend behavior |
|-------|------------------|
| Guest Azan | Backend cannot push FCM to guests. Flutter schedules **local** notifications from Cairo (or query) times. |
| Logged-in FCM backup | Cron uses prefs/profile location, else **Cairo** (no longer skips users with null coords). |
| Prefs without GPS | `GET /profile/azan-preferences` returns Cairo `lastLat`/`lastLng` + `isDefaultLocation: true`. |
| Azan audio catalog | `GET /azan/sounds` — multiple free Adhan MP3 options (not one hard-coded file). |
| Notification tones | `GET /azan/notification-sounds` — short tones for pre-reminders. |
| Quran audio | **Separate** — keep using `GET /quran/audio` (Quran Foundation). Do not mix. |

---

## 10. What Flutter should / should not do

**Do:**

- Call `GET /prayers/today` on first open without forcing GPS first  
- Trust `isDefaultLocation` / `locationSource` for UI messaging  
- After location save, refresh prayers and reschedule Azan  
- Prefer Backend schedule over hardcoded mock times when online  
- Load Azan / notification options from `/azan/sounds` and `/azan/notification-sounds`  
- Play `azanSound.audioUrl` at prayer time; play `notificationSound.audioUrl` for pre-reminders  

**Do not:**

- Require login before showing prayer times  
- Require GPS before showing prayer times  
- Assume missing coords = API error (Cairo is valid)  
- Persist Cairo as if it were the user’s real city after they saved another location  
- Use Quran reciter audio (`/quran/audio`) as Azan  
- Hard-code a single Azan file URL in Flutter when the catalog is available  

---

## 11. Flutter implementation checklist

- [ ] Guest Home calls `GET /prayers/today` with **no** Bearer and **no** coords  
- [ ] Parse `isDefaultLocation`, `locationSource`, `city` / `cityAr`  
- [ ] Schedule local Azan from returned `schedule[]`  
- [ ] Optional GPS → pass `latitude`/`longitude` query  
- [ ] After login → `PUT /profile/location` when coords known  
- [ ] Logged-in Home uses `/dashboard` or `/prayers/today` with Bearer  
- [ ] On location change → cancel old Azan jobs → fetch → reschedule  
- [ ] UI can show “Cairo (default)” only while `isDefaultLocation == true`  
- [ ] Fetch `GET /azan/sounds` + `GET /azan/notification-sounds` for settings UI  
- [ ] Guest: apply `GET /azan/audio-defaults` (or guest prefs) locally  
- [ ] Logged-in: `GET/PATCH /profile/azan-preferences` with `azanSoundId` / `notificationSoundId`  
- [ ] Cache selected `audioUrl` for offline playback after first download  
- [ ] Keep Quran audio pipeline unchanged  

---

## 12. Error-handling table

| Case | Flutter action |
|------|----------------|
| Network error, no cache | Show offline / retry; optional last cached schedule |
| 200 + `isDefaultLocation: true` | Show Cairo times; prompt for location when appropriate |
| 200 + `locationSource: query` | Use device GPS times |
| 200 + `locationSource: profile` | Use saved user location |
| Location permission denied | Keep Cairo default; do not block app |
| `PUT /profile/location` fails | Keep previous schedule; retry later |
| Sound catalog fetch fails | Keep last cached catalog or Backend defaults (`makkah` / `beep_short`) |
| Selected `audioUrl` fails to play | Fall back to default Azan / notification sound; keep schedule |
| `notificationSoundId=silent` | Skip audio; vibration only if enabled |
| Guest tries `PATCH` prefs | Expect **401** — store selection locally until login |

---

## 13. Production verification — Cairo location (Backend)

**VERIFIED ON PRODUCTION** (2026-09-07) against  
`https://noor-app-backend-one.vercel.app/api/v1`

| Check | Result |
|-------|--------|
| `GET /prayers/today` no auth | **PASS** — Cairo, `locationSource=default_cairo`, `isDefaultLocation=true` |
| `GET /prayers/schedule` no coords | **PASS** — same Cairo times |
| Explicit Cairo query | **PASS** — same times, `locationSource=query` |
| Alexandria query | **PASS** — different times |
| Auth, no saved location | **PASS** — Cairo on `/prayers/today` + `/dashboard` |
| `GET /profile/azan-preferences` no GPS | **PASS** — Cairo `lastLat`/`lastLng` filled |
| `PUT /profile/location` with city | **PASS** — profile + prayers + dashboard show Alexandria |
| After location refresh | **PASS** — `locationSource=profile`, `isDefaultLocation=false`, Alexandria times |

Sample guest Cairo times on verification day:  
Fajr 05:06 · Dhuhr 12:54 · Asr 16:25 · Maghrib 19:11 · Isha 20:29

---

## 14. Azan & notification audio (license-safe)

### 14.1 Goal

Flutter must let the user pick:

1. **Azan sound** — full Adhan played at prayer time  
2. **Notification sound** — short tone for pre-reminders / prayer alerts  

Only recordings with **verified redistribution licenses** are exposed. **Quran audio stays on `/quran/audio` (Quran Foundation) — never mix.**

### 14.2 License audit (do not skip)

| Candidate | Decision | Reason |
|-----------|----------|--------|
| Al Furqan Athan API (`alfurqan.online`) | **Rejected for audio content** | Free API / MIT covers code; athan files are sourced from **Assabile.com** without a verified per-recording redistribution grant for commercial apps |
| IslamCan `azan{N}.mp3` | **Rejected** | No clear redistribution / commercial license found |
| Kiwifu/adhan-mp3 (jsDelivr) | **Rejected** | No LICENSE file; marketing “free for apps” is not an explicit CC grant |
| Google Actions sounds | **Rejected** | Terms: use only inside Actions on Google; not for other apps |
| Sabah Fakhry Commons MP3 | **Rejected** | Tagged Public domain, but provenance for a famous recording is uncertain |
| Wikimedia Commons CC0 / CC BY-SA Adhan | **Accepted** | Explicit Creative Commons terms verified on file pages; **self-hosted** by Backend |
| Freesound CC0 / CC BY tones | **Accepted** | Explicit Creative Commons terms verified on sound pages; **self-hosted** by Backend |

### 14.3 Accepted sources (delivery)

| Kind | Original source | Delivery | License class |
|------|-----------------|----------|---------------|
| Azan | Wikimedia Commons | `GET /api/v1/azan/media/:file` (self-hosted) | CC0 1.0 / CC BY-SA 3.0 / CC BY-SA 4.0 |
| Notification | Freesound | `GET /api/v1/azan/media/:file` (self-hosted) | CC0 1.0 / CC BY 4.0 |
| Silent | n/a | `audioUrl: null` | no audio |

See also repo `assets/ATTRIBUTION.md`.

Flutter **must** show `attributionText` in Settings / About when `attributionRequired: true`.

### 14.4 Public catalog APIs (no auth) — unchanged catalog paths

#### List Azan sounds

```http
GET /api/v1/azan/sounds
```

Defaults: `defaultId = beautiful_adhan` · count = **7**

#### List notification sounds

```http
GET /api/v1/azan/notification-sounds
```

Defaults: `defaultId = soft_chime` · count = **13** (includes `silent`)

#### Guest defaults

```http
GET /api/v1/azan/audio-defaults
```

#### Stream media

```http
GET /api/v1/azan/media/{file}
```

Supports HTTP `Range` (206).

### 14.5 Available option ids (current Production)

**Azan (`azanSoundId` / `voiceId`) — 7 options:**

| id | Format | License | Attribution |
|----|--------|---------|-------------|
| `beautiful_adhan` (default) | ogg | CC0 1.0 | no |
| `adhan_aishatu` | ogg | CC0 1.0 | no |
| `azan_andrewler` | ogg | CC BY-SA 4.0 | yes |
| `islamic_call_mahfoudou` | oga | CC BY-SA 4.0 | yes |
| `adhan_wiki` | oga | CC BY-SA 3.0 | yes |
| `aaqib_azeez` | mp3 | CC BY-SA 4.0 | yes |
| `hassan_ii_casablanca` | mp3 | CC BY-SA 4.0 | yes |

Legacy `makkah` → `beautiful_adhan`. Other legacy ids alias to a license-safe option (not claiming recording equivalence).

**Notification (`notificationSoundId`) — 13 options:**

| id | License | Attribution |
|----|---------|-------------|
| `soft_chime` (default) | CC0 | no |
| `ui_alert` | CC0 | no |
| `notify_beep` | CC0 | no |
| `notify_punchy` | CC0 | no |
| `xylophone_chime` | CC0 | no |
| `gui_notify` | CC0 | no |
| `digital_blip` | CC0 | no |
| `game_notify` | CC0 | no |
| `sparkle_tone` | CC0 | no |
| `message_pop` | CC0 | no |
| `bell_chime` | CC BY 4.0 | yes |
| `dingaling` | CC BY 4.0 | yes |
| `silent` | n/a (`audioUrl: null`) | n/a |

### 14.6 User preferences APIs (unchanged paths)

```http
GET  /api/v1/profile/azan-preferences
PATCH /api/v1/profile/azan-preferences
```

| Client | Auth | Behavior |
|--------|------|----------|
| Guest GET | none | Defaults + `isGuestDefaults: true` |
| Guest PATCH | none | **401** — store locally until login |
| Logged-in GET/PATCH | Bearer | Persist `azanSoundId` / `voiceId` + `notificationSoundId` |

### 14.7–14.9 Flutter notes / defaults

- Player must support **ogg/oga** and **mp3**.
- Cache media after first play for offline Azan.
- Keep Quran reciter pipeline unchanged.
- Guest / first install: Azan `beautiful_adhan`, notification `soft_chime`.

### 14.10 Production verification — audio (Backend)

Verified live on `https://noor-app-backend-one.vercel.app/api/v1` after expand deploy (`debdcdd`):

| Check | Result |
|-------|--------|
| Azan count **7**, default `beautiful_adhan`, all self-hosted + reachable | PASS |
| Notification count **13**, default `soft_chime`, all self-hosted + reachable | PASS |
| Attribution required: `bell_chime`, `dingaling` | PASS |
| Al Furqan rejected in `sourcePolicy` | PASS |
| Guest prefs / guest PATCH 401 / auth PATCH new ids / legacy `makkah` | PASS |
| Cairo prayers + Quran reciters intact | PASS |

**Summary: 18/18 PASS** — READY (7 Azan + 13 notification options).
