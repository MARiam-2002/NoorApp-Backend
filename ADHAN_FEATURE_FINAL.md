# Noor App — Azan / Prayer Times & Settings — Final Backend Integration Contract

> **Status:** 100% READY — Backend implementation is complete, tested, and production-deployed (Railway).
>
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`
> **Mirror / Vercel Base URL (for audio streaming primarily):** `https://noor-app-backend-one.vercel.app/api/v1`
>
> **Hard Rule for Flutter — DO NOT BREAK:** Every JSON response uses the **Standard Envelope** documented in §0. Never invent your own shapes. All query params and PATCH bodies follow the exact field names in this doc. Save/use the **canonical short IDs** (EGYPT, SHAFI, mishary_alafasy, xylophone_chime) — aliases are accepted on input but canonical is always returned on output.

---

## 0. Standard Response Envelope (MANDATORY — every endpoint)

Every `2xx` and `4xx` JSON response body has this exact top-level shape. Do not hard-code assumptions about `data.x` without checking `success === true` first.

```jsonc
{
  "success": true,                       // boolean
  "message": "Human readable string",    // string (EN — safe to show user or ignore)
  "data": { /* ... */ },                 // object | array | boolean | null — actual payload
  "meta": null,                          // object | null — pagination, counts, etc. (null when unused)
  "timestamp": "2026-09-23T12:00:00.000Z", // ISO-8601 UTC
  "requestId": "uuid-here-or-null"       // string | null — request correlation id
}
```

Error envelopes (4xx/5xx) set `success: false` and additionally include `code` + optional `details`:

```jsonc
{
  "success": false,
  "code": "VALIDATION_ERROR",            // ErrorCodes enum (see BACKEND_ERROR_CODES.md)
  "message": "نوع الصلاة غير صالح. القيم المتاحة: FAJR, DHUHR, ASR, MAGHRIB, ISHA",
  "details": [{ "field": "id", "message": "Invalid enum value" }] | null,
  "timestamp": "2026-09-23T12:00:00.000Z",
  "requestId": "uuid"
}
```

**Authentication header (for endpoints tagged 🔐):**
```
Authorization: Bearer <access_token>
```

---

## 1. UI Screens → Exact API Mapping (from your screenshots)

This section maps every widget in the 4 Azan Settings screens to an exact backend field / endpoint.

### Screen A — Calculation + Madhab + Per-Prayer Toggles + FCM

| UI widget (AR) | Data source / persistence | Field / Endpoint |
| --- | --- | --- |
| **الحساب — طريقة الحساب — الهيئة المصرية** (dropdown) | **Populate:** `GET /azan/calculation-methods`<br>**Read saved:** `data.calculationMethod` from `GET /profile/azan-preferences`<br>**Save:** PATCH body field `calculationMethod` | Canonical short ID: `EGYPT` (default), `MWL`, `MAKKAH`, `KARACHI`, `ISNA`, `TEHRAN` |
| **الحساب — مذهب العصر — شافعي** (dropdown) | **Populate:** `GET /azan/madhabs`<br>**Read saved:** `data.madhab`<br>**Save:** PATCH body field `madhab` | Canonical uppercase ID: `SHAFI` (default, earlier Asr) or `HANAFI` (later Asr) |
| **لكل صلاة — ٥ toggles** (الفجر / الظهر / العصر / المغرب / العشاء) | **Read saved:** `data.prayers.fajr`, `.dhuhr`, `.asr`, `.maghrib`, `.isha`<br>**Save:** PATCH body `prayers: { fajr: bool, dhuhr: bool, asr: bool, maghrib: bool, isha: bool }` | Object inside azan-preferences. All 5 keys must always be present when you write. |
| **نسخ احتياطي — نسخ FCM احتياطي للصلاة** (toggle) | **Read:** `data.fcmPrayerBackupEnabled`<br>**Save:** PATCH body `fcmPrayerBackupEnabled: true/false` | Default `true`. FCM tokens stored via `POST /devices/fcm-token`. |

### Screen B — نغمة التذكير (Reminder Tone Picker — 6 options shown)

| UI label (AR) | Canonical `notificationSoundId` | Notes |
| --- | --- | --- |
| تنبيه ناعم جدًا — أقصر تنبيه وأقله إزعاجًا — الخيار الافتراضي | `soft_chime` | ✅ isDefault=true in catalog |
| تذكير بالصلاة — جرس تأملي ناعم — تذكير روحاني هادئ | `meditation_bell` |  |
| تذكير هادئ — ضربة ناعمة لوعاء غنائي — نغمة تذكير/ذكر هادئة | `singing_bowl` |  |
| **نغمة روحانية لطيفة — نغمة إكسيليفون ناعمة للتذكير المسبق** (SELECTED in your screenshot) | `xylophone_chime` | Matches your 4th selection exactly. |
| جرس ناعم (CC BY — يلزم ذكر المصدر) | `bell_chime` |  |
| جرس يدوي ناعم واحدة (CC BY — يلزم ذكر المصدر) | `hand_bell` |  |
| *(hidden option — silent / vibration only)* | `silent` | `audioUrl` will be `null`; Flutter should only vibrate. |

**Populate the picker:** `GET /azan/notification-sounds` (returns catalog sorted by mood with defaultId at top).
**Read saved:** `data.notificationSoundId` and the enriched `data.notificationSound` object (with audioUrl).
**Save:** PATCH body `notificationSoundId: "xylophone_chime"`.

### Screen C — العام (General) + صوت الأذان (Adhan Voice Picker — Mishary variants)

| UI widget (AR) | Field / Endpoint | Canonical values |
| --- | --- | --- |
| **عام — تفعيل الأذان** (main switch) | `azanEnabled` PATCH | `true` (default) / `false` |
| **عام — الصوت** (Sound toggle) | `soundEnabled` PATCH | `true` (default) / `false`. If false + vibration true → vibrate only. |
| **عام — الاهتزاز** (Vibration toggle) | `vibrationEnabled` PATCH | `true` (default) / `false` |
| **عام — تذكير قبل الصلاة** (Pre-reminder toggle) | `preReminderEnabled` PATCH | `true` (default) / `false` |
| **عام — دقائق التذكير — ١٥** (minutes picker) | `preReminderMinutes` PATCH | integer `0..120`; default `15`. If `0` and enabled → fire at prayer start exactly. |
| **صوت الأذان — مشاري العفاسي — صوت إسلامي معاصر محبوب — أذان قناة دبي ون** (variant 1) | `azanSoundId` or legacy alias `voiceId` | `mishary_alafasy` — `isDefault=true` in catalog (Alafasy variant 1 / default). |
| **صوت الأذان — مشاري العفاسي (نسخة ٢)** (variant 2) |  | `mishary_alafasy_2` — Alafasy variant 2. |
| *(catalog only, screen shows more later)* — Ali Ahmed Mulla (Makkah), Yasser Al-Dosari, Nasser Al-Qatami, Abdul Basit, Minshawi, Rifaat |  | `ali_mulla`, `yasser_al_dosari`, `nasser_al_qatami`, `abdul_basit`, `mohamed_minshawi`, `mohamed_rifaat` — all in `/azan/sounds` with self-hosted audio URLs. |

**Populate voice picker:** `GET /azan/sounds` (returns 9 famous voices sorted).
**Read saved:** `data.azanSoundId` and enriched `data.azanSound` (with audioUrl/previewUrl).
**Save:** PATCH body `azanSoundId: "mishary_alafasy_2"` (or legacy `voiceId` — both accepted, canonical returned).

---

## 2. Endpoint Catalog (Authoritative)

### 2.1 Dropdown Catalogs (PUBLIC — no auth, guests work)

#### `GET /azan/calculation-methods` — Builds "طريقة الحساب" dropdown

**Response `data` shape:**
```jsonc
{
  "count": 6,
  "defaultId": "EGYPT",
  "methods": [
    {
      "id": "EGYPT",                               // ← CANONICAL KEY — always save id, never save nameEn/nameAr
      "aliases": ["EGYPT","EGYPTIAN","EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY"],
      "nameEn": "Egyptian General Authority",
      "nameAr": "الهيئة المصرية للمساحة",
      "descriptionEn": "Egyptian General Authority of Survey — standard for Egypt / MENA region.",
      "descriptionAr": "الهيئة المصرية العامة للمساحة — المعيار لمصر وشمال أفريقيا والشرق الأوسط.",
      "regionHintEn": "Egypt, MENA",
      "regionHintAr": "مصر، الوط العربي، شمال أفريقيا، الشرق الأوسط",
      "isDefault": true,
      "sortOrder": 1
    },
    { "id": "MWL",       /* Muslim World League */     "sortOrder": 2 },
    { "id": "MAKKAH",    /* Umm Al-Qura, Makkah */     "sortOrder": 3 },
    { "id": "KARACHI",   /* U of Isl Sci Karachi */    "sortOrder": 4 },
    { "id": "ISNA",      /* Islamic Soc N America */   "sortOrder": 5 },
    { "id": "TEHRAN"     /* Geophysics Inst Tehran */  "sortOrder": 6 }
  ],
  "note": "Use the short id field…"
}
```

#### `GET /azan/madhabs` — Builds "مذهب العصر" dropdown

```jsonc
{
  "count": 2,
  "defaultId": "SHAFI",
  "madhabs": [
    {
      "id": "SHAFI",                              // ← CANONICAL KEY — save id
      "aliases": ["SHAFI","SHAFII","شافعي"],
      "nameEn": "Shafi (Shafi'i — earlier Asr)",
      "nameAr": "الشافعي (وقت مبكر للعصر — الظل مثل الطول)",
      "descriptionEn": "Shafi’i, Maliki & Hanbali — Asr when object shadow equals height…",
      "descriptionAr": "مذاهب الشافعي والمالكي والحنبلي — وقت العصر عندما يساوي ظل الشيء طوله…",
      "isDefault": true,
      "sortOrder": 1
    },
    {
      "id": "HANAFI",
      "aliases": ["HANAFI","حنفي"],
      "nameEn": "Hanafi (later Asr = longer shadow)",
      "nameAr": "الحنفي (وقت متأخر للعصر — الظل ضعف الطول)",
      /* … */
      "sortOrder": 2
    }
  ],
  "note": "Use the uppercase id field…"
}
```

---

### 2.2 Audio Catalogs (PUBLIC — no auth)

#### `GET /azan/sounds` — Full Azan (voice) catalog, 9 famous muezzins

```jsonc
// data = { defaultId, count, sounds[], famousVoicesAudit[], sourcePolicy }
{
  "defaultId": "mishary_alafasy",
  "count": 9,
  "sounds": [
    {
      "id": "mishary_alafasy",                      // ← CANONICAL — save this id
      "nameEn": "Mishary Alafasy",
      "nameAr": "مشاري العفاسي",
      "descriptionEn": "Popular contemporary voice — Dubai One TV Adhan.",
      "descriptionAr": "صوت إسلامي معاصر محبوب — أذان قناة دبي ون.",
      "muezzin": "Mishary Rashid Alafasy",
      "muezzinEn": "Mishary Rashid Alafasy",
      "muezzinAr": "مشاري راشد العفاسي",
      "locationEn": "Contemporary Gulf voice",
      "locationAr": "صوت خليجي معاصر",
      "isFamousVoice": true,
      "available": true,
      "category": "famous_contemporary" | "famous_classic",
      "audioUrl":   "https://noorapp-backend-production.up.railway.app/api/v1/azan/media/mishary_alafasy.mp3",   // ← play this
      "previewUrl": "https://noorapp-backend-production.up.railway.app/api/v1/azan/media/mishary_alafasy.mp3",   // ← same as audioUrl (full files)
      "mediaFile": "mishary_alafasy.mp3",
      "format": "mp3",
      "provider": "aladhan_selfhosted" | "assabile_selfhosted",
      "source": "AlAdhan — … mirrored",
      "isDefault": true,
      "durationSeconds": 246 | null,
      "license": { spdxOrName, attributionRequired, attributionText, commercialUseAllowed, sourcePageUrl },
      "streamingAllowed": true,
      "selfHostingAllowed": true,
      "commercialUseAllowed": true
    },
    /* Same shape for the 8 other famous-voice IDs:
       mishary_alafasy_2, mishary_alafasy_3,
       ali_mulla (Makkah/Haram),
       yasser_al_dosari, nasser_al_qatami,
       abdul_basit (Egypt/Fajr classic),
       mohamed_minshawi (Egyptian classic),
       mohamed_rifaat (Cairo historic)
    */
  ],
  "famousVoicesAudit": [ /* 15 priority voices + status available/unavailable + reason */ ],
  "sourcePolicy": { azanProvider, delivery, policy, sources }
}
```

#### `GET /azan/notification-sounds` — Pre-reminder short-tone catalog (6 tones + silent)

```jsonc
// data = { defaultId:"soft_chime", count:7, sounds[], sourcePolicy }
// 7 sounds (6 real mp3 + "silent" option) — IDs exactly match UI table in §1/Screen B
{
  "defaultId": "soft_chime",
  "count": 7,
  "sounds": [
    {
      "id": "soft_chime",       // تنبيه ناعم جدًا
      "nameEn": "Very Soft Notification", "nameAr": "تنبيه ناعم جدًا",
      "descriptionEn": "Shortest, least intrusive reminder — recommended default.",
      "descriptionAr": "أقصر تنبيه وأقله إزعاجًا — الخيار الافتراضي الموصى به.",
      "audioUrl":   "{base}/api/v1/azan/media/soft_chime.mp3",
      "previewUrl": "{base}/api/v1/azan/media/soft_chime.mp3",
      "mediaFile": "soft_chime.mp3",
      "format": "mp3",
      "provider": "freesound_selfhosted",
      "mood": "calm" | "gentle" | "soft_bell" | "silent",
      "isDefault": true,
      "durationSeconds": null,
      "license": { /* … */ },
      "streamingAllowed": true, "selfHostingAllowed": true, "commercialUseAllowed": true
    },
    // meditation_bell, singing_bowl, xylophone_chime (SELECTED in your screenshot)
    // bell_chime, hand_bell, silent (mediaFile=null, audioUrl=null, mood=silent, durationSeconds=0)
  ]
}
```

#### `GET /azan/audio-defaults` — Guest-friendly one-shot defaults (no auth)

```jsonc
// data = { azanSoundId, notificationSoundId, voiceId (=azanSoundId),
//          azanSound {…}, notificationSound {…},
//          sourcePolicy, famousVoicesAudit, note }
```
Use this to populate the initial guest screen before the user signs in or calls `/profile/azan-preferences`.

---

### 2.3 Audio Streaming (PUBLIC — supports HTTP Range / 206 Partial)

#### `GET /azan/media/:file` — Stream / seek self-hosted audio

- **Files:** every `mediaFile` from `/azan/sounds` and `/azan/notification-sounds`
- **Protocols:** supports `Range: bytes=0-` request header → returns `206 Partial Content` with `Content-Range` (for Flutter seek / progress bars).
- **Caching:** `Cache-Control: public, max-age=86400, immutable` — safe to cache in Flutter Hive/dio cache.
- **404 envelope when unknown file.**

Example play URL for the selected (xylophone_chime) pre-reminder:
`https://noorapp-backend-production.up.railway.app/api/v1/azan/media/xylophone_chime.mp3`

---

### 2.4 Synced Per-User Azan Preferences (🔐 auth required for PATCH; GET works for guests with defaults)

#### `GET /profile/azan-preferences` — Load current saved + enriched settings

> - **Authenticated (🔐):** returns user DB row + resolved sound objects (with URLs).
> - **Guest (no token):** returns safe hard-coded defaults marked `isGuestDefaults: true`; **do not** PATCH these to the server — save locally for guests.

**Authenticated `data` shape (exact):**

```jsonc
{
  // --- General toggles (Screen C "عام") ---
  "azanEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,

  // --- Azan / Adhan voice selection (Screen C "صوت الأذان") ---
  "voiceId":            "mishary_alafasy",          // legacy alias; ALWAYS equals azanSoundId
  "azanSoundId":        "mishary_alafasy",          // ← CANONICAL. SAVE THIS WHEN USER PICKS NEW VOICE.
  "azanSound": { /* full AzanSoundOption object from /azan/sounds with audioUrl/previewUrl resolved */ },

  // --- Reminder-tone selection (Screen B "نغمة التذكير") ---
  "notificationSoundId": "xylophone_chime",         // ← CANONICAL. SAVE THIS.
  "notificationSound": { /* full NotificationSoundOption with audioUrl */ },

  // --- Calculation method + Asr madhab (Screen A "الحساب") ---
  "calculationMethod":  "EGYPT",                    // ← SHORT canonical id from /azan/calculation-methods
  "madhab":             "SHAFI",                    // ← canonical uppercase from /azan/madhabs

  // --- Pre-reminder (Screen C "تذكير قبل الصلاة" + "دقائق التذكير") ---
  "preReminderEnabled": true,
  "preReminderMinutes": 15,

  // --- Per-prayer Azan toggles (Screen A "لكل صلاة") ---
  "prayers": { "fajr": true, "dhuhr": true, "asr": true, "maghrib": true, "isha": true },

  // --- FCM backup toggle (Screen A "نسخ احتياطي") ---
  "fcmPrayerBackupEnabled": true,

  // --- Location (enriched from User.latitude/longitude if saved) ---
  "lastLat":            30.0444 | null,
  "lastLng":            31.2357 | null,
  "lastLocationLabel":  "القاهرة" | null,
  "isDefaultLocation":  true,                     // true when Cairo defaults were filled in
  "locationSource":     "default_cairo" | "profile"  // how location was resolved
}
```

**Guest fallback `data` shape — same fields + `isGuestDefaults: true` marker.**

---

#### `PATCH /profile/azan-preferences` — 🔐 Partial update (save any field)

> Accepts any subset of fields (partial update). Sends back the full enriched preferences after save. All unknown aliases are internally resolved to canonical IDs.

**Allowed body fields (ALL OPTIONAL):**

```typescript
{
  azanEnabled?:            boolean,
  soundEnabled?:           boolean,
  vibrationEnabled?:       boolean,

  // Either azanSoundId (new, preferred) OR voiceId (legacy) — both accepted & synced.
  azanSoundId?:            "mishary_alafasy" | "mishary_alafasy_2" | "mishary_alafasy_3" | "ali_mulla" | "yasser_al_dosari" | "nasser_al_qatami" | "abdul_basit" | "mohamed_minshawi" | "mohamed_rifaat" | string,
  voiceId?:                string,  // legacy alias of azanSoundId

  notificationSoundId?:    "soft_chime" | "meditation_bell" | "singing_bowl" | "xylophone_chime" | "bell_chime" | "hand_bell" | "silent" | string,

  calculationMethod?:      "EGYPT" | "MWL" | "MAKKAH" | "KARACHI" | "ISNA" | "TEHRAN"
                          | "EGYPTIAN" | "EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY"
                          | "MUSLIM_WORLD_LEAGUE" | "UMM_AL_QURA" | "NORTH_AMERICA" | string,
  madhab?:                 "SHAFI" | "HANAFI" | "shafi" | "hanafi",  // case-insensitive

  preReminderEnabled?:     boolean,
  preReminderMinutes?:     number,  // 0..120 integer (zod coerced, so strings OK too)

  prayers?: { fajr: boolean; dhuhr: boolean; asr: boolean; maghrib: boolean; isha: boolean },

  fcmPrayerBackupEnabled?: boolean,

  // Optional: if user also saves GPS from this screen, sync it to User table + preferences row:
  lastLat?:                number | null,   // -90..90
  lastLng?:                number | null,   // -180..180
  lastLocationLabel?:      string | null,   // e.g. "القاهرة" or "Cairo"
}
```

**curl example — user selects نغمة روحانية لطيفة (xylophone_chime) + Mishary variant 2 + 15-min reminder:**

```bash
curl -X PATCH \
  'https://noorapp-backend-production.up.railway.app/api/v1/profile/azan-preferences' \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "notificationSoundId": "xylophone_chime",
    "azanSoundId":         "mishary_alafasy_2",
    "preReminderMinutes":  15,
    "preReminderEnabled":  true
  }'
```

**Response → full preferences envelope with canonicalized short IDs already filled.**

---

### 2.5 Prayer Times — Today / Schedule (Used by Home card, Prayer screen, Azan scheduler)

#### `GET /prayers/today` — Main screen data (with `nextPrayer` + `countdownSeconds` + completions if logged-in)

> - **With `?lat=&lng=` query coords → uses GPS coords (locationSource=`query`)** — wins over profile.
> - **Authenticated 🔐 no coords → reads `User.latitude / User.longitude / User.prayerCalculationMethod` from DB → locationSource=`profile`. Fills each schedule item with `completed: true/false` from the DB prayerCompletions table.
> - **Guest no coords → Cairo default → `isDefaultLocation: true`, `locationSource=default_cairo`.**

**Query params (ALL OPTIONAL):**
```
latitude|lat  = number  (GPS latitude)
longitude|lng = number  (GPS longitude)
timezone     = string    (IANA zone, e.g. Africa/Cairo; inferred from coords if omitted)
method       = string    (calculation method — accepts short/long aliases, default EGYPT)
madhab       = string    (SHAFI|HANAFI, default SHAFI)
city, cityAr, country, countryAr = strings (optional UI labels only)
```

**Exact `data` response shape:**

```jsonc
{
  // --- Calendar / meta ---
  "date":     "2026-09-23",          // YYYY-MM-DD, local to timezone
  "timezone": "Africa/Cairo",

  // --- Location + calculation (enriched) ---
  "latitude":  30.0444,
  "longitude": 31.2357,
  "city":      "Cairo",
  "cityAr":    "القاهرة",
  "country":   "Egypt",
  "countryAr": "مصر",
  "calculationMethod": "EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY",  // display label (may be long form)
  "madhab":            "SHAFI",                                  // uppercase canonical
  "locationSource":    "default_cairo" | "profile" | "query",
  "isDefaultLocation": true | false,

  // --- Next prayer countdown ---
  "nextPrayer": {   // null only if impossible (never in practice)
    "name":              "Fajr",      // Title Case English
    "key":               "FAJR",      // enum uppercase FAJR|DHUHR|ASR|MAGHRIB|ISHA
    "nameAr":            "الفجر",
    "time":              "04:12",     // HH:MM 24h in local timezone
    "displayEn":         "4:12 AM",
    "displayAr":         "٤:١٢ ص",
    "iso":               "2026-09-23T01:12:00.000Z",
    "timestamp":         "<Date object (ISO in JSON)>",
    "countdownSeconds":  8640         // integer seconds from now → next prayer; 0 or positive; always safe to render
  },

  // --- 5-prayer schedule array (in FAJR→ISHA order) ---
  "schedule": [
    {
      "name":        "Fajr",        // "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"  — Title Case
      "key":         "FAJR",        // enum uppercase — use for toggles / PATCH /:id/mark
      "nameAr":      "الفجر",
      "time":        "04:12",       // HH:MM 24h local
      "displayEn":   "4:12 AM",     // 12h format
      "displayAr":   "٤:١٢ ص",      // 12h format + Arabic digits
      "iso":         "2026-09-23T01:12:00.000Z",
      "timestamp":   "<Date>",
      "completed":   false          // true/false — filled if authenticated with DB completion row
    }
    // … 4 more in order: Dhuhr, Asr, Maghrib, Isha
  ],

  // --- Sunrise (DISPLAY ONLY — never Azan, never markable) ---
  "sunrise": {
    "name":       "Sunrise",
    "key":        "SUNRISE",        // STRING — NOT a PrayerName enum! Do NOT call /prayers/SUNRISE/mark.
    "nameAr":     "الشروق",
    "time":       "05:45",
    "displayEn":  "5:45 AM",
    "displayAr":  "٥:٤٥ ص",
    "iso":        "2026-09-23T02:45:00.000Z",
    "trackable":  false             // Flutter: hide mark/toggle UI when trackable=false
  },

  // --- Completion counters ---
  "completedCount": 2,              // 0..5 — how many schedule items are completed:true
  "totalCount":     5
}
```

**Sunrise rule:** The `sunrise` object is **not** inside `schedule[]`. It's a top-level sibling. The `trackable:false` field is a Flutter hard-stop: **do not render the completion toggle** for Sunrise. Only FAJR/DHUHR/ASR/MAGHRIB/ISHA in `schedule[]` can be marked.

---

#### `GET /prayers/schedule` — Public, arbitrary-date calculator (no auth required; no completions)

Same response shape as `/prayers/today` plus:
- Accepts `date=YYYY-MM-DD` query param for any date (past/future)
- `completed` always `false`, `completedCount` always `0`
- No user lookup — always coords or Cairo default.

---

#### `PATCH /prayers/:id/mark` — 🔐 Toggle "I prayed / I didn't pray" (circle tap in UI)

**Path param `:id` — one of these 5 strings exactly (case-insensitive internally):**
`FAJR` | `DHUHR` | `ASR` | `MAGHRIB` | `ISHA` (UPPERCASE is the canonical contract).

**`data` response on success:**
```jsonc
{
  "prayer":    "Asr",      // Title Case English — display
  "key":       "ASR",      // enum uppercase — sync to your list
  "completed": true        // new state after toggle (true=marked prayed; false=unmarked)
}
```

**curl example — toggle Asr prayer:**
```bash
curl -X PATCH \
  'https://noorapp-backend-production.up.railway.app/api/v1/prayers/ASR/mark' \
  -H 'Authorization: Bearer <access_token>'
```

---

### 2.6 Location Sync (use when user saves GPS / City in Account or Azan screens)

#### `PUT /profile/location` — 🔐 Persist GPS to User table (auto-infers timezone from coords)

```jsonc
// Request body (latitude/lat and longitude/lng both accepted; required pair):
{
  "latitude" | "lat":  30.0444,
  "longitude"| "lng":  31.2357,
  "timezone":          "Africa/Cairo" | null,   // if null, backend INFERS correct IANA zone from coords
  "city":              "القاهرة" | null,
  "country":           "Egypt" | null
}
```

Response → full `/profile/me` `UserProfile` shape.

---

## 3. User Azan Preferences — Full Entity / Valid Ranges Summary

Single source of truth — prefer this table when validating input client-side (before sending PATCH):

| Field | Type / Range | Default | Persisted in DB? | Screen |
| --- | --- | --- | --- | --- |
| `azanEnabled` | bool | true | ✅ | C (عام) |
| `soundEnabled` | bool | true | ✅ | C (عام) |
| `vibrationEnabled` | bool | true | ✅ | C (عام) |
| `azanSoundId` (or legacy `voiceId`) | 9 canonical IDs — see §2.2 | `mishary_alafasy` | ✅ | C (صوت الأذان) |
| `notificationSoundId` | 7 canonical IDs — see §1/Screen B | `soft_chime` | ✅ | B (نغمة التذكير) |
| `calculationMethod` | 6 short IDs (EGYPT/MWL/MAKKAH/KARACHI/ISNA/TEHRAN) — aliases accepted | `EGYPT` | ✅ | A (الحساب) + stored in sync to `User.prayerCalculationMethod` |
| `madhab` | SHAFI \| HANAFI (case-insensitive) | `SHAFI` | ✅ | A (مذهب العصر) |
| `preReminderEnabled` | bool | true | ✅ | C (تذكير قبل الصلاة) |
| `preReminderMinutes` | integer 0 to 120 (coerced) | 15 | ✅ | C (دقائق التذكير — ١٥ shown) |
| `prayers.fajr` | bool | true | ✅ | A (الفجر) |
| `prayers.dhuhr` | bool | true | ✅ | A (الظهر) |
| `prayers.asr` | bool | true | ✅ | A (العصر) |
| `prayers.maghrib` | bool | true | ✅ | A (المغرب) |
| `prayers.isha` | bool | true | ✅ | A (العشاء) |
| `fcmPrayerBackupEnabled` | bool | true | ✅ | A (نسخ FCM احتياطي) |
| `lastLat` | -90..90 \| null | null | ✅ (via sync to User.latitude) | - |
| `lastLng` | -180..180 \| null | null | ✅ | - |
| `lastLocationLabel` | string max 200 \| null | null | ✅ (sync to User.city) | - |
| `isDefaultLocation`, `locationSource` | enums (meta) | computed | ❌ read-only meta | - |
| `azanSound`, `notificationSound` | enriched objects with URLs | computed | ❌ derived at GET time | - |
| `isGuestDefaults` | bool marker | on guest only | ❌ marker only | - |

---

## 4. FCM Backup Flow (when local alarm is killed by OEM battery saver)

1. User device registers token with existing `POST /devices/fcm-token` endpoint (platform=`android`|`ios`, `appVersion`, `locale`).
2. Toggle `fcmPrayerBackupEnabled=true` (default).
3. Backend cron (`prayer-reminder-cron.yml`) walks users 1 minute before each prayer time → sends FCM push of type `AZAN` to tokens.
4. FCM payload shape (Flutter onMessage/onBackgroundMessage):
```jsonc
{ "notification": { "title_ar": "حان موعد صلاة العصر", "title_en": "It's time for Asr",
                     "body_ar":"…", "body_en":"…", "sound": "default" },
  "data": { "type": "AZAN", "prayerKey": "ASR", "timeIso": "…",
            "azanSoundMediaFile": "mishary_alafasy.mp3",
            "notificationSoundMediaFile": "xylophone_chime.mp3" } }
```
5. Flutter displays system notification + plays Azan when app is in background/foreground based on the user's chosen `azanEnabled / soundEnabled / prayers.X` settings that were synced via PATCH (Flutter stores these; backend will attach the selected IDs to FCM payload for deterministic playback).

---

## 5. Guest Flow vs Logged-In Flow

| Scenario | Strategy | Endpoint to call |
| --- | --- | --- |
| **Guest opens Azan settings first time** | Don't force login. Show catalog options + Cairo defaults + allow changes saved locally. | `GET /azan/calculation-methods`, `/azan/madhabs`, `/azan/sounds`, `/azan/notification-sounds`, `/azan/audio-defaults` (guest defaults) |
| **Guest changes any toggle** | Save to local storage (Hive/SharedPreferences) under `azan_*` keys. Do not call PATCH (would 401). PATCH requires 🔐 | No network. |
| **Guest taps login/onboards → becomes logged-in** | POST /auth/login (or /auth/signup, /auth/google). After receiving access token, read latest backend preferences from `GET /profile/azan-preferences` (merge with local or override with server). If local preferences are newer, call `PATCH /profile/azan-preferences` to push them. | `GET /profile/azan-preferences` 🔐, then optional `PATCH`. |
| **Logged-in user changes any setting** | Call `PATCH /profile/azan-preferences 🔐` with partial body containing only changed fields. Update local state from response `data` (already canonicalized + enriched). | PATCH + optimistic local update. |
| **Logged-in user saves GPS in Azan screen** | Call `PATCH /profile/azan-preferences 🔐` with `{lastLat,lastLng,lastLocationLabel}` (or `PUT /profile/location` which updates User table directly). Both work; use PUT when it's the "Account Location" screen and PATCH when it's inside Azan Settings. | PATCH (or PUT). |

---

## 6. Offline Schedule Strategy (Device — Adhan Alarm Reliability)

Backend /prayers/today is a **cross-check / UI source**. But **Azan alarms must be scheduled LOCALLY on-device**:

1. On app start / after location load → call `GET /prayers/today?lat=&lng=&method=&madhab=` once → refresh UI cards + countdown.
2. Parse the returned `schedule[]` array (`time`, `iso` fields, etc) → schedule local exact alarms via `flutter_local_notifications` + `android_alarm_manager_plus` / `awesome_notifications` (for exact Android alarms + foreground service / full-screen intent at prayer time).
3. Cancel all stale alarms → reschedule remaining today + next-day Fajr after the current day's Isha fires or at midnight local.
4. If network offline: use `adhan_dart` package to calculate locally with the **same method/madhab** the user saved. Canonical method mapping:
   - `EGYPT` → `CalculationMethod.Egyptian()`
   - `MWL` → `MuslimWorldLeague()`
   - `MAKKAH` → `UmmAlQura()`
   - `KARACHI` → `Karachi()`
   - `ISNA` → `NorthAmerica()`
   - `TEHRAN` → `Tehran()`
   - `SHAFI` → `Madhab.Shafi`
   - `HANAFI` → `Madhab.Hanafi`
5. At every prayer time alarm:
   a. Show system notification (title/body localized).
   b. If `soundEnabled && prayers[X] == true && azanEnabled` → play the MP3 from `notificationSound.audioUrl` (pre-reminder N min before) or `azanSound.audioUrl` (at exact Azan time). Prefer caching MP3 locally after first play.
   c. If only `vibrationEnabled == true` (sound=false or silent sound) → vibrate only.
   d. If `azanEnabled==false` → skip everything (no sound/vibration/notification). Still update countdown UI.

---

## 7. Edge Cases & Important "Gotchas" (Flutter must handle)

1. **`prayerCalculationMethod` LONG vs SHORT form** — The `/profile/me` returns the stored `User.prayerCalculationMethod` which, on first signup, is `EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY` (long form). After first Azan PATCH, backend syncs it to SHORT `EGYPT`. **To avoid dropdown selection mismatch:** always resolve method via `CALCULATION_METHODS_CATALOG` aliases. On load, take `profile.prayerCalculationMethod` OR `azanPrefs.calculationMethod` → check each catalog entry's `aliases[]` array → match to canonical `id` → set selected value to that short `id`. (Backend normalizes internally on every input anyway; this is just for UI selected state correctness on first load.)

2. **`voiceId` vs `azanSoundId`** — They are the same field. Legacy Flutter code may send `voiceId`. New code should prefer `azanSoundId`. On GET response, backend fills BOTH with the same canonical ID + fills `azanSound` full object (URLs). Always save/patch the ID, never patch the `azanSound` object back (it's read-only enrichment).

3. **Sunrise is NEVER in `schedule[]`.** Sunrise is in its own top-level `sunrise` object with `trackable: false`. **Must never call PATCH `/prayers/SUNRISE/mark`.** It will 400 with VALIDATION_ERROR ("Invalid prayer name"). Only the 5 enum keys in schedule[] can be marked.

4. **preReminderMinutes = 0** — valid. Means no N-minutes-earlier reminder; reminder fires exactly at Azan time itself.

5. **`locationSource` matters for analytics.** If `query` → user GPS worked. If `profile` → saved city used. If `default_cairo` → we fell back to Cairo (prompt user to grant location).

6. **Audio URLs contain the correct domain for the current request** (Railway vs Vercel vs local) because backend builds them from `req.headers`. If you're storing URLs in a local DB, rebuild them each launch instead of hardcoding — production URLs won't break, but local dev URLs are nicer if you're testing local audio streaming.

7. **`isGuestDefaults: true`** — never call PATCH for these users; they don't have a user row to save to. Save changes locally only. After login + sync, do PATCH to push local settings once (or let server's azan-preferences overwrite — you decide UX).

8. **Partial PATCH is partial update.** If you send `{prayers:{fajr:false}}` only, the other 4 prayer toggles, sound, azan voice, etc — **stay unchanged in the database**. Safe to send only the delta. However: if you DO send `prayers` object, all 5 keys (fajr/dhuhr/asr/maghrib/isha) must be present or Zod will reject (prayerTogglesSchema requires all 5). So if you patch prayers, always send all 5 booleans.

9. **`timezone` with stale Cairo default on non-Cairo coords.** Example: user saved timezone as Africa/Cairo but GPS is London (51.5, -0.1). Backend detects this (called `looksLikeStaleCairoDefault`) and ignores the Cairo timezone, then **infers correct Europe/London from coordinates**. Flutter doesn't need to do anything; this is transparent.

10. **Aliases for sound IDs.** If user somehow sends id `"makkah"` (not in catalog), backend resolves it to canonical `ali_mulla` via `AZAN_ID_ALIASES` map. Response will always have the canonical ID. Safe.

---

## 8. Quick Reference — Required Calls per Screen (Flutter Feature Build Order)

| Screen / Feature | Required API calls |
| --- | --- |
| **Home Prayer Card** (countdown, next prayer name, 5 toggles) | `GET /prayers/today` (with lat/lng if available; auth if logged-in for completed flags). When user taps circle → `PATCH /prayers/:KEY/mark` 🔐. |
| **Prayer Times screen** (full list with times + location row) | Same `GET /prayers/today`. "Update location" → device geolocator → call `PUT /profile/location` 🔐 or append to the next `/prayers/today?lat=&lng=` as query params (auto-filled if PUT was called). |
| **Azan Settings Screen A** (Calculation Method / Madhab / 5 toggles / FCM) | On enter: `GET /azan/calculation-methods`, `GET /azan/madhabs`, `GET /profile/azan-preferences` (auth or guest). On each change: `PATCH /profile/azan-preferences` 🔐 with delta (for logged-in) or local save (guest). |
| **Azan Settings Screen B** (Reminder tone picker — 6 sounds) | On enter: `GET /azan/notification-sounds`. On pick: `PATCH /profile/azan-preferences` 🔐 body `{notificationSoundId: "xylophone_chime"}`. |
| **Azan Settings Screen C** (General toggles / reminder mins / Azan voice picker) | On enter: `GET /azan/sounds`, `GET /profile/azan-preferences`. On toggles/minutes change → partial PATCH. On voice pick → play `sounds[i].previewUrl` on tap; save `{azanSoundId: "mishary_alafasy_2"}`. |
| **Onboarding / Permissions Flow** (GPS → Notifications → Exact Alarms Android) | Geolocator → `PUT /profile/location` 🔐. Notif permission → local. Exact alarm intent → local. FCM token after permission granted → `POST /devices/fcm-token` 🔐. |

---

## 9. Endpoint URL Index (all prefixed with `/api/v1`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/azan/calculation-methods` | 🆗 Public | 6-method dropdown catalog (EGYPT/MWL/MAKKAH/KARACHI/ISNA/TEHRAN) |
| GET | `/azan/madhabs` | 🆗 Public | 2-madhab dropdown catalog (SHAFI default / HANAFI) |
| GET | `/azan/sounds` | 🆗 Public | 9 famous-voice full Azan catalog (MP3 URLs) |
| GET | `/azan/notification-sounds` | 🆗 Public | 7 short pre-reminder tones (6 MP3s + silent) |
| GET | `/azan/audio-defaults` | 🆗 Public | One-shot default sound IDs + objects for guests |
| GET | `/azan/media/:file` | 🆗 Public | HTTP Range streaming for MP3 playback |
| GET | `/profile/azan-preferences` | 🆗 guest default / 🔐 user synced | Load saved settings + enriched sound objects |
| PATCH | `/profile/azan-preferences` | 🔐 Auth only | Persist any subset of Azan settings (partial update) |
| GET | `/prayers/today` | 🆗 or 🔐 optional auth | Main data for Home card + Azan scheduler |
| GET | `/prayers/schedule` | 🆗 Public | Any-date prayer calculator; no completion flags |
| PATCH | `/prayers/:id/mark` | 🔐 Auth only | Toggle prayer completed status (FAJR/DHUHR/ASR/MAGHRIB/ISHA only) |
| PUT | `/profile/location` | 🔐 Auth only | Persist GPS/city/timezone to User table (auto-infers tz) |
| POST | `/devices/fcm-token` | 🔐 Auth only | Register FCM device token (for Azan backup push) |

---

## 10. Change Log (when this doc was finalized)

- **2026-09-23 — Final contract v1.0**
  - Added 2 new public catalog endpoints: `/azan/calculation-methods` and `/azan/madhabs` with EN/AR labels so Flutter no longer needs to hardcode picker lists.
  - Backend TypeScript compiled 0 errors. All existing endpoints preserved **100% contract compatibility** (no response shape changes to previously-documented fields).
  - Envelope format unified: every 2xx/4xx uses the `{success,message,data,meta,timestamp,requestId}` shape mandated by project convention.
  - Famous-voice Azan catalog: 9 verified voices self-hosted for reliable streaming (CDN alone was flaky — backend mirrors from AlAdhan + Assabile under `/azan/media/*`).
  - Notification tones: 6 CC0/CC-BY gentle spiritual tones + silent option (IDs exactly match Flutter UI screens in §1/Screen B).
  - Calculation-method short/long alias normalization happens inside `resolveCalculationParams()` on every input (both EGYPT and EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY accepted → canonical short IDs returned on output).

**Known unimplemented (per earlier AZAN_FEATURE.md v2+ only — NOT part of current Flutter screens):**
- Per-prayer tuning offsets (N-minutes manual adjustments for each prayer per mosque).
- Iqama delay time (minutes after Azan for mosque Iqama schedule).
- Quiet hours / DND window.
- These are out of scope for current UI; schema can extend via additional Zod fields later without breaking current contract.

---

**Flutter Integration Checklist — sign-off when all 10 are complete:**

- [ ] Dropdowns "طريقة الحساب" and "مذهب العصر" populated from `/azan/calculation-methods` + `/azan/madhabs` — user selected value persists via `PATCH /profile/azan-preferences`
- [ ] 5 per-prayer toggles in Azan Settings save to `prayers: {fajr,dhuhr,asr,maghrib,isha}` in preferences
- [ ] General toggles (تفعيل الأذان/الصوت/الاهتزاز/تذكير قبل الصلاة) + دقائق التذكير (0..120 int) save in same PATCH
- [ ] نغمة التذكير picker shows 7 sounds from `/azan/notification-sounds`; selected matches `notificationSoundId`; tapping plays via audioUrl (Range streaming)
- [ ] صوت الأذان picker shows 9 famous voices from `/azan/sounds`; tap plays previewUrl; selected saves via `azanSoundId`
- [ ] FCM backup toggle saves; device token registered; prayer-reminder FCM payload consumed in background
- [ ] Home prayer card countdown uses `/prayers/today` `nextPrayer.countdownSeconds` (positive int); Sunrise shows `sunrise.time` with no mark/toggle UI (trackable=false)
- [ ] 5 prayer completion circles call `PATCH /prayers/:KEY/mark`; UI reflects new `completed` state from the `data.completed` boolean in response
- [ ] Guest flow: Azan settings load via `/azan/audio-defaults`, changes saved locally, no PATCH attempted until login
- [ ] Offline: local Azan alarms scheduled using same method/madhab IDs mapped to `adhan_dart` correctly; network returns → sync via `/prayers/today` for UI but keep device alarms as source of truth for ringing

---

> **Final:** This document IS the contract. If any Flutter implementation diverges, prefer updating Flutter to match — not changing the backend, as changing backend shapes will break existing users in production.
