# Flutter Prayer + Azan Production Handoff — 2026

**Audience:** Flutter developers  
**From:** Noor Backend  
**Updated:** 2026-09-14  
**Source of truth:** Current Express + Prisma backend implementation (not older Vercel-only docs)

**API prefix:** `/api/v1`  
**Production base URL:** [`https://noorapp-backend-production.up.railway.app/api/v1`](https://noorapp-backend-production.up.railway.app/api/v1)  
**Root / docs landing:** [`https://noorapp-backend-production.up.railway.app/`](https://noorapp-backend-production.up.railway.app/)

**Contract rule:** Existing Flutter integrations must keep working. This handoff documents **what exists today**. No breaking API changes are required to ship Prayer/Azan.

---

## 0) Quick architecture (read this first)

```text
┌─────────────────────────────────────────────────────────────┐
│ PRIMARY (exact Azan timing)                                 │
│ Flutter ← GET schedule ← Backend                            │
│ Flutter schedules LOCAL notifications + plays Azan audio    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ BACKUP (server push, approximate window)                    │
│ Railway Cron → POST /cron/prayer-reminders                  │
│ → Backend FCM (AZAN / SALAWAT) → device                     │
└─────────────────────────────────────────────────────────────┘
```

| Responsibility | Owner |
|----------------|--------|
| Exact prayer-time Azan on device | **Flutter local notifications** |
| Authoritative prayer times + timezone | **Backend** |
| Azan MP3 URLs (catalog) | **Backend** (`/azan/*`) |
| FCM backup near prayer time | **Backend cron + FCM** (optional per user) |
| Local Adhan engine / permissions / OS alarms | **Flutter** |

**Do not** treat FCM/cron as the only Azan mechanism. Cron runs about every **10 minutes** with a **~12 minute** due-window — it cannot guarantee second-accurate Azan.

---

## 1) Authentication & envelope

### Success (all documented endpoints)

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {},
  "timestamp": "2026-09-14T10:00:00.000Z",
  "requestId": "uuid"
}
```

### Error

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | INVALID_TOKEN | TOKEN_EXPIRED | VALIDATION_ERROR | NOT_FOUND | …",
  "errors": [{ "field": "…", "message": "…", "code": "…" }],
  "details": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

| HTTP | Typical `code` | Flutter action |
|------|----------------|----------------|
| `401` | `INVALID_TOKEN` | Clear session |
| `401` | `TOKEN_EXPIRED` | `POST /auth/refresh` once, retry |
| `401` | `UNAUTHORIZED` | Cron or missing auth |
| `400` | `VALIDATION_ERROR` | Fix input; show field errors |
| `429` | `RATE_LIMIT_EXCEEDED` | Back off / retry later |
| `5xx` | various | Keep cached schedule; do **not** hard-logout on profile/network alone |

Bearer: `Authorization: Bearer <accessToken>` when required.

---

## 2) Cairo default behavior (preserve)

| Field | Value |
|-------|--------|
| City | Cairo / القاهرة |
| Country | Egypt / مصر |
| Latitude | `30.0444` |
| Longitude | `31.2357` |
| Timezone | `Africa/Cairo` |
| Method | `EGYPT` → label `EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY` |
| Madhab | `SHAFI` |
| `locationSource` | `default_cairo` |
| `isDefaultLocation` | `true` |

### Resolution priority

| Situation | Coords used | `locationSource` |
|-----------|-------------|------------------|
| Guest, no lat/lng | Cairo | `default_cairo` |
| Query `lat`/`lng` or `latitude`/`longitude` | Query | `query` |
| Auth + saved profile coords, no query | Profile | `profile` |
| Auth + no profile coords, no query | Cairo | `default_cairo` |

**Priority:** query coords **>** profile **>** Cairo.

Flutter should:

1. First launch / guest → `GET /prayers/today` with **no** coords → expect Cairo.
2. When GPS is available → pass coords (and timezone if known).
3. After login → `PUT /profile/location` so server-side dashboard/cron use the same place.
4. Detect change when `latitude`/`longitude`/`timezone`/`locationSource` differ from cache → refetch + reschedule locals.

---

## 3) Prayer schedule rules

### Five obligatory prayers only in `schedule[]`

```text
Fajr → Dhuhr → Asr → Maghrib → Isha
```

| Rule | Detail |
|------|--------|
| Length | Always **5** entries |
| `name` | Title Case: `Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` |
| `key` | Upper enum: `FAJR`, `DHUHR`, `ASR`, `MAGHRIB`, `ISHA` |
| `time` | **24h** `HH:mm` in response `timezone` |
| `displayEn` | 12h English (`4:52 AM`) |
| `displayAr` | Arabic digits + ص/م |
| `completed` | boolean (auth + today; public schedule usually `false`) |
| `sunrise` | **Separate** object — **not** in `schedule[]` |
| `sunrise.trackable` | Always `false` — never mark / never Azan as a sixth prayer |
| `nextPrayer` | Next upcoming today, else **next-day Fajr** + `countdownSeconds` |
| `date` | Local calendar `YYYY-MM-DD` in prayer timezone |
| `timezone` | IANA string used to format all times |

**Do not** invent a second prayer calculator that disagrees with Backend for UI sync. Local Adhan for alarms may compute offline, but when online prefer Backend schedule for the same method/madhab/location.

---

## 4) Prayer API contract

### 4.1 `GET /prayers/today`

```http
GET /api/v1/prayers/today
GET /api/v1/prayers/today?latitude=24.7136&longitude=46.6753&timezone=Asia/Riyadh&method=EGYPT&madhab=SHAFI
```

| | |
|--|--|
| **Auth** | Optional Bearer |
| **Query** | `latitude`/`longitude` or `lat`/`lng`; optional `timezone`, `method`, `madhab`, `city`, `cityAr`, `country`, `countryAr` |

**Flutter usage**

- Primary endpoint for Home / Prayer screen / local scheduling.
- If Bearer present and no coords → profile or Cairo.
- Merge `completed` when authenticated.

**Edge cases**

| Case | Backend | Flutter |
|------|---------|---------|
| No location | Cairo | Show Cairo; ask location when appropriate |
| Invalid coords | Validation / fallback per controller | Keep last good cache |
| Offline | — | Use cached schedule for today; keep locals |
| After Isha | `nextPrayer` → tomorrow Fajr | Countdown across midnight |

### 4.2 `GET /prayers/schedule`

```http
GET /api/v1/prayers/schedule?latitude=51.5074&longitude=-0.1278&timezone=Europe/London&date=2026-09-15
```

| | |
|--|--|
| **Auth** | Public |
| **Query** | Same coords + optional `date` (`YYYY-MM-DD`), `method`, `madhab`, `timezone` |

**Flutter usage**

- Prefetch **tomorrow** for overnight reschedule (`date=` next local day).
- Completions not applied (all incomplete).

### 4.3 `PATCH /prayers/:id/mark`

```http
PATCH /api/v1/prayers/ASR/mark
Authorization: Bearer <token>
```

`:id` accepts enum or aliases (`ASR`, `Asr`, `ZUHR`→Dhuhr, etc.). **Not** `SUNRISE`.

**Response `data` example**

```json
{
  "prayer": "Asr",
  "key": "ASR",
  "completed": true
}
```

### 4.4 Full `data` shape (today / schedule)

```json
{
  "date": "2026-09-14",
  "timezone": "Africa/Cairo",
  "nextPrayer": {
    "name": "Asr",
    "key": "ASR",
    "nameAr": "العصر",
    "time": "15:42",
    "displayAr": "٣:٤٢ م",
    "displayEn": "3:42 PM",
    "iso": "2026-09-14T12:42:00.000Z",
    "timestamp": "2026-09-14T12:42:00.000Z",
    "countdownSeconds": 1234
  },
  "schedule": [
    {
      "name": "Fajr",
      "key": "FAJR",
      "nameAr": "الفجر",
      "time": "04:52",
      "displayEn": "4:52 AM",
      "displayAr": "٤:٥٢ ص",
      "iso": "…",
      "timestamp": "…",
      "completed": false
    }
  ],
  "sunrise": {
    "name": "Sunrise",
    "key": "SUNRISE",
    "nameAr": "الشروق",
    "time": "06:15",
    "displayEn": "6:15 AM",
    "displayAr": "٦:١٥ ص",
    "iso": "…",
    "trackable": false
  },
  "completedCount": 0,
  "totalCount": 5,
  "latitude": 30.0444,
  "longitude": 31.2357,
  "city": "Cairo",
  "cityAr": "القاهرة",
  "country": "Egypt",
  "countryAr": "مصر",
  "calculationMethod": "EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY",
  "madhab": "SHAFI",
  "locationSource": "default_cairo",
  "isDefaultLocation": true
}
```

**Field-by-field (Flutter)**

| Field | Use |
|-------|-----|
| `date` | Cache key day; local notification id day component |
| `timezone` | Interpret `time`; schedule OS alarms in this zone |
| `schedule[].key` | Stable id for mark + local notification identity |
| `schedule[].name` | Match FCM `prayer` string (Title Case) |
| `schedule[].time` | Schedule local Azan for that clock time |
| `schedule[].iso` / `timestamp` | Prefer for absolute scheduling when available |
| `nextPrayer` | Countdown UI |
| `sunrise` | Display row only |
| `locationSource` / `isDefaultLocation` | UX: “Using Cairo until location is set” |
| `calculationMethod` / `madhab` | Settings sync |

### 4.5 Related location prefs

```http
PUT /api/v1/profile/location
Authorization: Bearer <token>
Content-Type: application/json

{ "latitude": 40.7128, "longitude": -74.0060 }
```

Aliases: `lat`/`lng`. Optional `timezone`, `city`, `country`. If timezone omitted, Backend infers from coordinates.

Also drives `GET /qibla/my-qibla` after save.

```http
GET|PATCH /api/v1/profile/azan-preferences
```

See §6. Persist method/madhab/enabled prayers/`fcmPrayerBackupEnabled`/`lastLat`/`lastLng`.

---

## 5) Local notifications (primary Azan)

### First launch

```text
Launch
 → GET /prayers/today (Cairo if no location)
 → Request notification permission
 → Request location when product-appropriate
 → If location granted: refetch with lat/lng (or PUT profile location)
 → Cancel old prayer notifications
 → Schedule local notifications for remaining prayers today (+ prefetch tomorrow)
 → Optionally download/cache selected Azan audio from catalog
```

### Location available / changed

```text
New coords or timezone
 → Refetch schedule
 → Cancel outdated notification IDs
 → Schedule new set from schedule[] (5 prayers only)
 → Update azan-preferences lastLat/lastLng when logged in
```

### New day / after Isha

- At local midnight (or after last Isha fires): fetch `date=tomorrow` via `/prayers/schedule` **or** next `/prayers/today` after rollover.
- Reschedule tomorrow’s five prayers.
- Keep `nextPrayer` countdown using Backend `countdownSeconds` / `iso` when online.

### App killed

- Rely on **OS local notifications / exact alarms** already scheduled.
- FCM backup may still arrive if token registered and prefs allow — treat as secondary.

### Offline

- Keep last successful schedule for that local `date` + `timezone`.
- Keep scheduled locals from that cache.
- On reconnect: refetch; if times changed → cancel + reschedule.

### Suggested local notification id

```text
azan_{YYYY-MM-DD}_{KEY}
example: azan_2026-09-14_ASR
```

Use Backend `date` + `schedule[].key`. Do **not** include Sunrise.

Pre-reminder (optional, Flutter-owned):

```text
azan_pre_{YYYY-MM-DD}_{KEY}
```

Align minutes with `azan-preferences.preReminderMinutes` when enabled.

---

## 6) Azan audio contract

Flutter **must** load audio URLs from Backend. Do **not** hard-code AlAdhan/Assabile CDN URLs.

### Endpoints

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/azan/sounds` | Public |
| `GET` | `/azan/notification-sounds` | Public |
| `GET` | `/azan/audio-defaults` | Public |
| `GET` | `/azan/media/:file` | Public (supports HTTP Range → `206`) |

Stable selector: sound **`id`** (e.g. `mishary_alafasy`). Default Azan id: `mishary_alafasy`. Default notification tone: `soft_chime`.

### Catalog item fields (Azan)

| Field | Notes |
|-------|--------|
| `id` | **Stable** preference key |
| `audioUrl` / `previewUrl` | Absolute Backend URLs |
| `mediaFile` | Filename for `/azan/media/:file` |
| `available` | Skip / disable if `false` |
| `nameEn` / `nameAr`, `muezzin*`, license flags | UI |

URLs look like:

```text
https://noorapp-backend-production.up.railway.app/api/v1/azan/media/<mediaFile>
```

Origin comes from request Host / `PUBLIC_APP_ORIGIN` (production must set this on Railway).

### Preferences

```http
GET /api/v1/profile/azan-preferences
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <token>   # PATCH requires auth; GET optional
```

Example `data` (authenticated):

```json
{
  "azanEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "voiceId": "mishary_alafasy",
  "azanSoundId": "mishary_alafasy",
  "notificationSoundId": "soft_chime",
  "calculationMethod": "EGYPT",
  "madhab": "SHAFI",
  "preReminderMinutes": 15,
  "preReminderEnabled": true,
  "prayers": {
    "fajr": true,
    "dhuhr": true,
    "asr": true,
    "maghrib": true,
    "isha": true
  },
  "lastLat": 30.0444,
  "lastLng": 31.2357,
  "lastLocationLabel": "Cairo",
  "fcmPrayerBackupEnabled": true,
  "isDefaultLocation": true,
  "locationSource": "default_cairo",
  "azanSound": { "id": "mishary_alafasy", "audioUrl": "…", "previewUrl": "…" },
  "notificationSound": { "id": "soft_chime", "audioUrl": "…", "previewUrl": "…" }
}
```

Guest GET returns a smaller defaults object (`isGuestDefaults: true`) — may omit FCM/location fields.

**PATCH** is partial; `voiceId` or `azanSoundId` both accepted for Azan voice.

### Audio unavailable

- Prefer another `available: true` catalog entry; keep last working `id`.
- Do not silently swap reciters without user choice.
- Offline: play cached file keyed by `id` if previously downloaded.

---

## 7) FCM backup (secondary)

### Register token

```http
POST /api/v1/devices/fcm-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "<fcm-device-token>",
  "platform": "android",
  "appVersion": "1.0.0",
  "locale": "ar"
}
```

`fcmToken` alias accepted.  
Unregister: `DELETE /api/v1/devices/fcm-token` with same token field.

Response includes `fcmConfigured` (Backend Firebase ready or not). Also check `GET /health` → `data.fcm.configured`.

### When backup fires

User must have:

- Active device token
- `azanEnabled` and `fcmPrayerBackupEnabled !== false`
- Prayer enabled in prefs `prayers.{fajr|dhuhr|…}`

Cron evaluates user **local** prayer `HH:mm` in schedule timezone within a **~12 minute** window (plus optional pre-reminder window).

### AZAN FCM `data` (string map)

```json
{
  "type": "AZAN",
  "prayer": "Asr",
  "time": "15:42",
  "kind": "prayer_time"
}
```

`kind`: `prayer_time` | `pre_reminder`.  
`prayer` matches schedule **`name`** (Title Case), not necessarily `key`.

Android channel used by Backend: **`azan`**.

### SALAWAT (same cron job)

```json
{
  "type": "SALAWAT",
  "kind": "salawat_reminder"
}
```

Independent of Azan location; gated by `salawatReminderEnabled` on user.

### Flutter FCM handling

1. If `type == AZAN` → treat as **backup**.
2. Prefer suppressing UI/sound if local Azan for that prayer already handled today (see §8).
3. Never schedule a second full Azan from FCM if local already owns exact time.
4. If notification permission denied → FCM may still be limited by OS; local cannot fire.

---

## 8) Duplicate prevention (mandatory)

Goal: **Local + FCM ≠ two Azans**.

### Strategy (no Backend change required)

Use a client-side “already handled” set for the local day:

```text
handledKey = "${date}|${prayerKey}|${kind}"
example: 2026-09-14|ASR|prayer_time
```

| Event | Action |
|-------|--------|
| Local notification fires / user opens from local | Mark `handledKey` for today’s `date` + `key` + `prayer_time` (or `pre_reminder`) |
| FCM AZAN arrives | Map `prayer` Title Case → `key`; resolve `date` from device local calendar in schedule timezone (or cached schedule `date`); if `handledKey` exists → **suppress sound/UI** (optional silent data log) |
| FCM arrives first (local soon) | Show backup **or** soft banner; when local fires seconds later → suppress local if already shown, **or** prefer local and suppress FCM if local is within N seconds — pick one product rule and stick to it |

**Recommended product rule:** Local is primary. On FCM AZAN: if local for that prayer is still scheduled within ± window **or** already fired → ignore FCM audio.

Server also idempotently skips repeat AZAN in-app notifications for same `prayer`+`kind` within ~12 minutes — that protects spam from cron, not Flutter duplicate UX.

### Optional future Backend enhancement (not implemented)

Additive FCM fields only (would not remove existing keys):

```json
{ "date": "2026-09-14", "key": "ASR" }
```

**Not required** for production if Flutter uses the strategy above. See §10-B.

---

## 9) Railway Cron (Backend ops — Flutter independence)

```text
Railway Cron (*/10 * * * *)
      ↓
POST /api/v1/cron/prayer-reminders
  Authorization: Bearer ${CRON_SECRET}
      ↓
runPrayerReminderCron(12)
  → Azan FCM backup + Salawat
      ↓
User devices
```

| Topic | Fact |
|-------|------|
| API service | Long-running `npm start` (Express) |
| Cron service | **Only** the curl/command — **not** `npm start` |
| Frequency | `*/10 * * * *` |
| Auth | Bearer / `X-Cron-Secret` / `?secret=` — **no** `x-vercel-cron` bypass |
| Empty secret | Always `401` |
| Timezone | Per-user schedule timezone (Intl), not Railway UTC clock for HH:mm compare |
| Idempotency | Recent AZAN notification payload `prayer`+`kind` |
| Delayed cron | Window ~12 min; may miss exact minute — **local Azan still covers** |
| Failed cron | Logged; next tick retries; Flutter locals unaffected |
| Schedulers | **One only** — Railway Cron. GitHub Actions prayer workflow is **disabled** |

**Flutter must work if cron never runs.**

---

## 10) Backend compatibility audit

### A. No backend change required

- Prayer today/schedule/mark contracts
- Cairo defaults
- Azan catalog + media streaming
- Azan preferences + FCM token APIs
- Success/error envelope
- Cron HTTP contract + Railway scheduling
- Flutter local-primary + FCM-backup architecture

### B. Recommended but optional

| Item | Why | Compatible? | Contract impact |
|------|-----|-------------|-----------------|
| Additive FCM `date` + `key` | Easier client dedupe | Yes if additive | Push `data` only; HTTP JSON APIs unchanged |
| Raise cron user `take: 500` | Scale | Internal | None for Flutter HTTP |
| Set `PUBLIC_APP_ORIGIN` on Railway | Correct absolute `audioUrl` | Ops | Response URLs host change only |

### C. Required for production (ops / config — not API redesign)

| Item | Notes |
|------|--------|
| Railway env | `DATABASE_URL`, JWTs, `NODE_ENV`, `CRON_SECRET`, Firebase, `PUBLIC_APP_ORIGIN`, `CORS_ORIGIN` |
| Railway Cron | `*/10` + Bearer curl to prayer-reminders |
| Firebase | `health.fcm.configured === true` for backup pushes |
| Flutter base URL | Point at Railway |

**No code change in this handoff delivery** — see final section.

---

## 11) Offline & caching

| Asset | Safe to cache? | Refresh when |
|-------|----------------|--------------|
| Today’s schedule JSON | Yes (keyed by `date`+lat/lng/tz/method/madhab) | Location/tz/method change; new local day; pull-to-refresh |
| Tomorrow schedule | Yes | Same |
| Azan catalog metadata | Yes (TTL hours–days) | App upgrade; user opens sound picker |
| Azan MP3 by `id` | Yes | `id` change; failed play → redownload |
| FCM token | Store securely | Refresh on token rotation |

**Stale detection:** cached `date` ≠ device local YMD in `timezone` → refetch.

**Location denied:** keep Cairo (or last known) and show banner.

**Timezone unavailable:** send coords only; Backend infers; still persist returned `timezone` in cache.

---

## 12) Security

| Topic | Rule |
|-------|------|
| Secrets | Never put `CRON_SECRET`, DB URL, Firebase private key, JWT secrets in Flutter |
| Cron | Server-only; Flutter never calls `/cron/*` |
| Tokens | HTTPS; secure storage; refresh flow |
| FCM token | Auth-only register; treat as PII |
| Location | Send only with user consent; HTTPS |
| Audio URLs | Public media is OK; still use Backend URLs |
| Rate limits | Respect `429`; backoff |

---

## 13) Notification UX checklist (Flutter)

### First launch

- [ ] Load Cairo schedule without crashing
- [ ] Request notification permission
- [ ] Request location when appropriate
- [ ] Refetch + reschedule after location
- [ ] Schedule only 5 prayers (not sunrise)

### Ongoing

- [ ] Reschedule on location / timezone / method / madhab / enabled-prayers change
- [ ] New-day refresh
- [ ] App-killed locals still fire
- [ ] Offline cache works
- [ ] FCM backup registered only when logged in + permission
- [ ] Duplicate prevention implemented
- [ ] Prefs sync (`azan-preferences`)

---

## 14) Testing matrix

| Scenario | Expected Backend | Expected Flutter | Expected notification |
|----------|------------------|------------------|------------------------|
| Cairo (no coords) | `locationSource=default_cairo`, 5 prayers | Show Cairo | Locals for Cairo times |
| Riyadh coords | `Asia/Riyadh` (or inferred), `locationSource=query` | Riyadh times | Locals match `time`/`iso` |
| London | Europe/London schedule | Same | Same |
| New York | America/New_York | Same | Same |
| No location | Cairo | Banner + Cairo | Cairo locals |
| Guest | Public today works | No mark completion | Locals OK; no FCM register |
| Authenticated | Profile/completions | Mark works | Locals + optional FCM |
| Offline | — | Cache | Locals from cache |
| Location denied | Cairo if no cache | UX explain | Cairo locals |
| Notification denied | APIs OK | No locals / limited | FCM may still be weak |
| App killed | — | OS delivers locals | Exact local Azan |
| App restart | — | Reschedule remaining | No duplicates |
| Date rollover | New `date` | Prefetch tomorrow | New IDs |
| Isha → next Fajr | `nextPrayer` tomorrow Fajr | Countdown OK | Schedule next day Fajr |
| Timezone change | New `timezone` in response | Cancel+reschedule | Correct local clocks |
| Location change | New coords | Refetch | Updated locals |
| FCM unavailable | `fcmConfigured:false` / sent:0 | Locals primary | Locals only |
| Cron delayed | Window miss possible | Unaffected | Locals still fire |
| API unavailable | Errors | Cache + locals | Locals continue |
| FCM + local same prayer | Backup may send | Suppress duplicate | **One** Azan UX |

---

## 15) Production readiness checklist

### Backend

- [ ] `GET /api/v1/health` → `status=ok`, DB connected
- [ ] `GET /prayers/today` Cairo default verified
- [ ] Location-based schedule verified (2+ cities)
- [ ] Timezone on response matches local `HH:mm`
- [ ] `sunrise.trackable === false`; schedule length 5
- [ ] `GET /azan/sounds` + play `audioUrl`
- [ ] `PUBLIC_APP_ORIGIN` set (correct media host)
- [ ] Firebase configured (`health.fcm.configured`)
- [ ] Device token register/test-push
- [ ] Railway Cron `*/10` with Bearer `CRON_SECRET`
- [ ] Cron unauthorized without secret (`401`)
- [ ] Only one scheduler (no GitHub schedule)
- [ ] Error envelope unchanged

### Flutter

- [ ] Notification permission flow
- [ ] Location permission flow
- [ ] Schedule load + Cairo fallback
- [ ] Timezone-aware local scheduling
- [ ] Azan audio from catalog `id` + URL
- [ ] Reschedule on changes
- [ ] New-day refresh
- [ ] Offline cache
- [ ] FCM backup + dedupe
- [ ] Error / token refresh handling
- [ ] Base URL → Railway production

---

## 16) Copy-paste request examples

```http
### Guest Cairo
GET /api/v1/prayers/today

### GPS
GET /api/v1/prayers/today?lat=24.7136&lng=46.6753&timezone=Asia/Riyadh&method=EGYPT&madhab=SHAFI

### Tomorrow prefetch
GET /api/v1/prayers/schedule?latitude=24.7136&longitude=46.6753&timezone=Asia/Riyadh&date=2026-09-15

### Save location
PUT /api/v1/profile/location
Authorization: Bearer <token>
{ "latitude": 24.7136, "longitude": 46.6753 }

### Sounds
GET /api/v1/azan/sounds

### Prefs
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <token>
{ "azanSoundId": "mishary_alafasy", "fcmPrayerBackupEnabled": true }

### FCM
POST /api/v1/devices/fcm-token
Authorization: Bearer <token>
{ "token": "<fcm>", "platform": "ios" }
```

---

## 17) What Flutter must never do

- Hard-code third-party Azan CDN URLs
- Treat Sunrise as a sixth obligatory / Azan prayer
- Depend on cron for exact timing
- Call `/cron/prayer-reminders` from the app
- Embed `CRON_SECRET` or Firebase Admin credentials
- Assume FCM `prayer` is enum `KEY` without mapping Title Case → key
- Change expectation of envelope fields (`success`, `data`, camelCase)

---

## Backend Changes Made

None

Rationale: Existing APIs already support Cairo defaults, location schedules, Azan catalogs, prefs, FCM registration, and cron backup. Duplicate prevention is achievable on Flutter with `date` + `schedule[].key` plus FCM `type`/`prayer`/`kind`. Optional additive FCM `date`/`key` remains a **future non-breaking** enhancement (section 10-B), not required to ship.

**Production-ready Backend contract + Flutter handoff with zero breaking API changes.**
