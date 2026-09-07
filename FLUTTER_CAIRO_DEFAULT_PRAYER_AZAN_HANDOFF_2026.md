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

### 14.1 Product goal

Polished Islamic / Qur’an-app UX:

1. **Azan** — clear Adhan options with Arabic + English names, descriptions, preview  
2. **Notifications** — calm spiritual tones (not computer beeps / game SFX)  

**Legal rule:** famous Haramain / Egyptian muezzin recordings are **not** shipped unless redistribution + commercial mobile-app rights are verified in writing.

### 14.2 Famous voices audit (blocked)

`GET /azan/sounds` and `GET /azan/audio-defaults` include `famousVoicesAudit`.

Blocked examples (status=`blocked`): Nasr El-Din ToubAr, Mohamed Refaat, Abdul Basit, Minshawi, Taha El-Fashny, Mohamed Emran, Ali Ahmed Mulla, Mishary Alafasy, Nasser Al-Qatami, Yasser Al-Dosari, Bandar Baleela.

Reasons: commercial music catalogs, Assabile/Al Furqan sourcing without clear grants, unreliable Archive “Public Domain” uploader tags, and Islamic Network guidance that mu’adhin copyright can remain even when files are widely mirrored.

### 14.3 Production-safe Azan catalog (self-hosted)

```http
GET /api/v1/azan/sounds
```

`defaultId = beautiful_adhan` · **count = 7** · all `isFamousVoice: false`

| id | English | Arabic | License | Attribution |
|----|---------|--------|---------|-------------|
| `beautiful_adhan` (default) | Beautiful Adhan | أذان جميل | CC0 | no |
| `hassan_ii_casablanca` | Hassan II Mosque Call | نداء مسجد الحسن الثاني | CC BY-SA 4.0 | yes |
| `aaqib_azeez` | Adhan — Aaqib Azeez | أذان — عاقب عزيز | CC BY-SA 4.0 | yes |
| `islamic_call_mahfoudou` | Islamic Call to Worship | نداء إسلامي للصلاة | CC BY-SA 4.0 | yes |
| `azan_andrewler` | Adhan (Andrewler) | أذان (أندرو لير) | CC BY-SA 4.0 | yes |
| `adhan_wiki` | Simple Sunni Adhan | أذان سنّي بسيط | CC BY-SA 3.0 | yes |
| `adhan_aishatu` | Adhan (Aishatu) | أذان (عائشة) | CC0 | no |

Each item includes: `descriptionEn`/`descriptionAr`, `muezzinEn`/`muezzinAr`, `audioUrl`, `previewUrl` (same URL), `source`, `license`, `streamingAllowed`, `selfHostingAllowed`, `commercialUseAllowed`, `isFamousVoice`, `category`.

Delivery: **self-hosted** `GET /api/v1/azan/media/{file}` (not stream-only third parties).

Legacy `makkah` → `beautiful_adhan`.

### 14.4 Notification catalog (calm / spiritual)

```http
GET /api/v1/azan/notification-sounds
```

`defaultId = soft_chime` · **count = 7** (includes `silent`)

| id | English | Arabic | License | Attribution |
|----|---------|--------|---------|-------------|
| `soft_chime` (default) | Very Soft Notification | تنبيه ناعم جدًا | CC0 | no |
| `meditation_bell` | Prayer Reminder | تذكير بالصلاة | CC0 | no |
| `singing_bowl` | Calm Reminder | تذكير هادئ | CC0 | no |
| `xylophone_chime` | Gentle Spiritual Chime | نغمة روحانية لطيفة | CC0 | no |
| `bell_chime` | Soft Bell | جرس ناعم | CC BY 4.0 | yes |
| `hand_bell` | Soft Hand Bell | جرس يدوي ناعم | CC BY 4.0 | yes |
| `silent` | Silent | صامت | n/a | n/a |

Removed from live catalog (legacy ids still alias): generic beeps / game UI tones (`notify_beep`, `game_notify`, `sparkle_tone`, …).

### 14.5 Preferences (unchanged paths)

```http
GET  /api/v1/profile/azan-preferences
PATCH /api/v1/profile/azan-preferences
GET  /api/v1/azan/audio-defaults
```

Flutter UX:

- Render `nameAr` + `nameEn` + `descriptionAr`/`descriptionEn`
- Preview via `previewUrl` / `audioUrl`
- Show `license.attributionText` when `license.attributionRequired`
- Do **not** claim Commons community recordings are famous Haramain voices

### 14.6 Defaults

| | id | Why |
|--|----|-----|
| Azan | `beautiful_adhan` | Highest-clarity CC0 option with full commercial + self-host rights (not a “famous” recording) |
| Notification | `soft_chime` | Shortest, least intrusive calm tone |

### 14.7 Production verification

Filled after deploy of the polished Islamic UX catalog.
