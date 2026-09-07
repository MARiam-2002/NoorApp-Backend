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

## 14. Azan & notification audio (NEW)

### 14.1 Goal

Flutter must let the user pick:

1. **Azan sound** — full Adhan played at prayer time  
2. **Notification sound** — short tone for pre-reminders / prayer alerts  

Sources are free, multi-option catalogs (verified working in 2026). **Quran audio stays on `/quran/audio` (Quran Foundation) — never mix.**

### 14.2 Sources (verified)

| Kind | Provider | Base |
|------|----------|------|
| Azan (primary) | IslamCan free Adhan MP3s | `https://www.islamcan.com/audio/adhan/azan{1..8}.mp3` |
| Azan (extra) | Kiwifu/adhan-mp3 via jsDelivr | `https://cdn.jsdelivr.net/gh/Kiwifu/adhan-mp3@main/...` |
| Notification tones | Google Actions free sounds | `https://actions.google.com/sounds/v1/alarms/...` |

### 14.3 Public catalog APIs (no auth)

#### List Azan sounds

```http
GET /api/v1/azan/sounds
```

Response shape:

```json
{
  "success": true,
  "data": {
    "defaultId": "makkah",
    "count": 11,
    "sounds": [
      {
        "id": "makkah",
        "nameEn": "Masjid al-Haram (Makkah)",
        "nameAr": "المسجد الحرام (مكة)",
        "muezzinEn": "Sheikh Ali Ahmad Mulla",
        "muezzinAr": "علي أحمد ملا",
        "locationEn": "Makkah, Saudi Arabia",
        "locationAr": "مكة المكرمة",
        "audioUrl": "https://www.islamcan.com/audio/adhan/azan1.mp3",
        "format": "mp3",
        "provider": "islamcan",
        "isDefault": true
      }
    ]
  }
}
```

#### List notification sounds

```http
GET /api/v1/azan/notification-sounds
```

```json
{
  "success": true,
  "data": {
    "defaultId": "beep_short",
    "count": 8,
    "sounds": [
      {
        "id": "beep_short",
        "nameEn": "Short beep",
        "nameAr": "صفارة قصيرة",
        "descriptionEn": "Simple short alert",
        "descriptionAr": "تنبيه قصير بسيط",
        "audioUrl": "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
        "format": "ogg",
        "provider": "google_actions",
        "isDefault": true
      },
      {
        "id": "silent",
        "nameEn": "Silent",
        "nameAr": "صامت",
        "audioUrl": null,
        "format": "none",
        "provider": "none"
      }
    ]
  }
}
```

#### Guest defaults (resolved objects)

```http
GET /api/v1/azan/audio-defaults
```

Returns `azanSoundId`, `notificationSoundId`, `voiceId`, plus full `azanSound` / `notificationSound` objects.

### 14.4 Available option ids

**Azan (`azanSoundId` / `voiceId`):**  
`makkah` (default), `madinah`, `aqsa`, `egypt`, `turkey`, `soft`, `abdul_basit`, `mishary`, `cairo_fajr`, `makkah_fajr`, `yasser_dosari`

**Notification (`notificationSoundId`):**  
`beep_short` (default), `medium_bell`, `dinner_bell`, `digital_watch`, `alarm_clock`, `bugle`, `phone_ring`, `silent`

### 14.5 User preferences APIs

#### Get current preferences

```http
GET /api/v1/profile/azan-preferences
```

| Client | Auth | Behavior |
|--------|------|----------|
| Guest | none | **200** with defaults + `isGuestDefaults: true` (not persisted) |
| Logged-in | Bearer | **200** with saved prefs + resolved `azanSound` / `notificationSound` |

#### Save preferences (logged-in only)

```http
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "azanSoundId": "egypt",
  "notificationSoundId": "medium_bell",
  "soundEnabled": true,
  "vibrationEnabled": true,
  "preReminderEnabled": true,
  "preReminderMinutes": 15
}
```

Aliases accepted for Azan selection: `azanSoundId` **or** legacy `voiceId` (kept in sync).

Response includes resolved objects:

```json
{
  "success": true,
  "data": {
    "voiceId": "egypt",
    "azanSoundId": "egypt",
    "notificationSoundId": "medium_bell",
    "azanSound": { "id": "egypt", "audioUrl": "https://www.islamcan.com/audio/adhan/azan4.mp3", "...": "..." },
    "notificationSound": { "id": "medium_bell", "audioUrl": "https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg", "...": "..." },
    "azanEnabled": true,
    "soundEnabled": true
  }
}
```

Guest `PATCH` → **401** (save locally until login, then sync).

### 14.6 Flutter integration flow

```text
Settings open
  → GET /azan/sounds
  → GET /azan/notification-sounds
  → GET /profile/azan-preferences   (guest OK → defaults)

User picks Azan + notification sound
  → Preview: play audioUrl once (AudioPlayer)
  → Guest: persist ids + urls in local storage
  → Logged-in: PATCH /profile/azan-preferences { azanSoundId, notificationSoundId }

Prayer time arrives
  → If soundEnabled: play prefs.azanSound.audioUrl (full Azan)
  → Else if vibrationEnabled: vibrate only

Pre-reminder
  → If notificationSound.audioUrl != null: play it
  → If id == silent: no audio
```

### 14.7 Suggested Flutter models / services

| Piece | Role |
|-------|------|
| `AzanSoundOption` | id, names, muezzin, `audioUrl`, format, provider, isDefault |
| `NotificationSoundOption` | id, names, `audioUrl?`, format, provider |
| `AzanAudioPreferences` | azanSoundId, notificationSoundId, flags, embedded sound objects |
| `AzanAudioRepository` | fetch catalogs + get/patch prefs |
| `AzanPlayerService` | download/cache + play Azan / notification URLs |
| Settings Cubit/Bloc | selection UI state; optimistic local save for guests |

### 14.8 Defaults

| User | Azan | Notification |
|------|------|--------------|
| Guest / first install | `makkah` | `beep_short` |
| Logged-in, never set | same defaults (server-side) | same |
| Unknown / invalid id | falls back to default | falls back to default |

### 14.9 Production verification — audio (Backend)

Filled after live Production checks in this task (see final report).

**Backend status: READY** (location + audio after Production PASS)
