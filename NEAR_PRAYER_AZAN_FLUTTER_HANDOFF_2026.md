# Near-Prayer + Azan Notification Audio — Flutter handoff (2026)

**To:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-25  
**Production base:** `https://noorapp-backend-production.up.railway.app/api/v1`

**Contract rule:** NON-BREAKING. Envelope, field names, and existing Azan endpoints stay the same. New fields are **additive only**.

---

## 0. What this feature does

When a **pre-reminder** fires (e.g. “اقترب موعد أذان الفجر”), the backend sends:

1. An **FCM / in-app notification** (`type = AZAN`, `kind = pre_reminder`)
2. The **matching Arabic short voice** clip for that prayer (from `assets/near-prayer/`)

Flutter must show the notification **and** play the audio (native sound and/or `just_audio`) using the URLs / media file names in the FCM `data` payload — **same envelope style you already integrated**.

At exact prayer time (`kind = prayer_time`), play the **full Azan** from `azanSoundUrl` (unchanged).

---

## 1. Response envelope (unchanged)

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

Parse `response.data` only.

---

## 2. Asset folders (no duplicates)

| Folder | Contents | Use |
|--------|----------|-----|
| `assets/azan/` | Full Adhan (2–5 min) | `kind == prayer_time` |
| `assets/notification/` | Generic short tones only (chimes) | Optional pre-reminder if user did **not** pick auto voice |
| `assets/near-prayer/` | Arabic “اقتربت صلاة …” voices | Pre-reminder when `notificationSoundId == sc_near_auto` |

**Do not put near-prayer MP3s under `azan/` or `notification/`.** Mirror the same three folders in Flutter assets + Android `res/raw/`.

### Near-prayer files on disk (all present)

| File | Prayer |
|------|--------|
| `sc_near_fajr.mp3` | Fajr |
| `sc_near_dhuhr.mp3` | Dhuhr (Sun–Thu) |
| `sc_near_asr.mp3` | Asr |
| `sc_near_maghrib.mp3` | Maghrib |
| `sc_near_isha.mp3` | Isha |
| `sc_near_jumuah.mp3` | Friday Dhuhr / Jumuah |

Stream URL pattern:

```text
GET /azan/media/{mediaFile}
→ https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_fajr.mp3
```

---

## 3. Catalog endpoints (unchanged paths)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/azan/notification-sounds` | Public | List tones + near-prayer ids + sentinel `sc_near_auto` |
| `GET` | `/azan/sounds` | Public | Full Azan voices |
| `GET` | `/azan/media/:file` | Public | Stream MP3 (Range / 206) |
| `GET` | `/profile/azan-preferences` | Optional | Saved prefs + resolved sound objects |
| `PATCH` | `/profile/azan-preferences` | Bearer | Save `notificationSoundId`, `preReminderEnabled`, etc. |

Recommended setting for this feature:

```json
{
  "notificationSoundId": "sc_near_auto",
  "preReminderEnabled": true,
  "preReminderMinutes": 10,
  "soundEnabled": true
}
```

- `sc_near_auto` = sentinel (no MP3). Backend picks the right `sc_near_*` per prayer.
- Explicit ids (`sc_near_fajr`, `soft_chime`, …) still work if the user picks one manually.

---

## 4. FCM / push payload — preserve + additive

### 4.1 `kind = "pre_reminder"` (اقترب موعد …)

**Existing fields (keep using):**

| Field | Example |
|-------|---------|
| `type` | `AZAN` |
| `kind` | `pre_reminder` |
| `prayer` | `FAJR` \| `DHUHR` \| `ASR` \| `MAGHRIB` \| `ISHA` |
| `time` | `04:52` |
| `soundEnabled` | `true` \| `false` |
| `vibrationEnabled` | `true` \| `false` |
| `titleAr` / `bodyAr` / `titleEn` / `bodyEn` | Arabic/English copy |
| `audioScope` | `pre_reminder` |
| `notificationSoundId` | e.g. `sc_near_fajr` (resolved, **not** always `sc_near_auto`) |
| `notificationSoundUrl` | absolute `/azan/media/...` URL |
| `notificationSoundMediaFile` | e.g. `sc_near_fajr.mp3` |
| `notificationSoundNameAr` / `NameEn` | labels |
| `notificationSoundFormat` | `mp3` |
| `nativeSound` (via FCM android/APNS) | basename without `.mp3` |

**Additive (2026 — safe to ignore if unused):**

| Field | Meaning |
|-------|---------|
| `autoMatched` | `"true"` if backend resolved from `sc_near_auto` |
| `matchedPrayerKey` | `FAJR` \| `DHUHR` \| `ASR` \| `MAGHRIB` \| `ISHA` \| `JUMUAH` |

### 4.2 Auto-match rules (`sc_near_auto`)

| Prayer | Local weekday | Clip id |
|--------|---------------|---------|
| FAJR | any | `sc_near_fajr` |
| DHUHR | Friday | `sc_near_jumuah` |
| DHUHR | other days | `sc_near_dhuhr` |
| ASR | any | `sc_near_asr` |
| MAGHRIB | any | `sc_near_maghrib` |
| ISHA | any | `sc_near_isha` |

Timezone = user profile timezone (IANA), same as Azan — not the server clock.

### 4.3 `kind = "prayer_time"` (full Azan)

Unchanged: use `azanSoundId`, `azanSoundUrl`, `azanSoundMediaFile`, etc. Do **not** play near-prayer voices at prayer time.

---

## 5. Flutter integration (notification + sound together)

1. Register FCM token: `POST /devices/fcm-token` after login.
2. On message with `data.kind == pre_reminder` and `soundEnabled == true`:
   - Show local/system notification with title/body from payload.
   - Play audio:
     - Prefer Android/iOS **native** sound from `notificationSoundMediaFile` (strip `.mp3` → `res/raw/sc_near_fajr`).
     - **Also** (or fallback) stream/play `notificationSoundUrl` with `just_audio` so audio still plays if the engine is cold.
3. Bundle all six `near-prayer/*.mp3` in Flutter assets **and** `android/.../res/raw/` (lowercase, no hyphens in raw names if required by Android).
4. If a file is missing locally, fall back to `soft_chime` — do not crash.
5. Deduplicate: if a local schedule already fired for the same prayer slot, ignore the FCM backup (same pattern as Azan).

---

## 6. Checklist for Flutter

- [ ] Envelope still `success` / `data` / `meta` / `timestamp` / `requestId`
- [ ] Prefs: `notificationSoundId = sc_near_auto` for auto Arabic voices
- [ ] Mirror `assets/near-prayer/` (6 files including `sc_near_jumuah.mp3`)
- [ ] Pre-reminder: play `notificationSoundUrl` / native sound **with** the notification
- [ ] Prayer time: still full Azan only
- [ ] Friday Dhuhr uses Jumuah voice when auto is on
- [ ] No hard-coded YouTube/SoundCloud scrapes — only backend catalog + `/azan/media`

---

## 7. Backend verification notes

- Near-prayer files live **only** under `assets/near-prayer/` (not duplicated in `notification/` or `azan/`).
- Phantom ids (`sc_fajr_alarm`, `sc_near_qiyam`, premium `sc_noor_azan_*`) are **not** in the live catalog.
- Cron: existing `POST /cron/prayer-reminders` (Flutter never calls this).

Ship this file to Flutter as the contract for **pre-reminder notification + matching Arabic voice**.
