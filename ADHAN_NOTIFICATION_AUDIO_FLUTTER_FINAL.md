# Noor App — Azan Notification + Audio (Flutter Integration Spec v2026)

> **Production Backend**: `https://noorapp-backend-production.up.railway.app/api/v1`
> **Contract Status**: NON-BREAKING — all existing endpoints + Response Shape preserved.
> **This spec adds**: Full audio-metadata injection into FCM payloads so Flutter can display the native notification **and** stream the user-selected Azan / pre-reminder MP3 **in parallel, atomically, with zero drift**.

---

## 1. Response Shape Guarantee (Do NOT Break)

Every endpoint returns:

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": { "page": 1, "perPage": 20, "total": 0, "unreadCount": 0 },
  "timestamp": "2026-09-24T00:00:00.000Z",
  "requestId": "uuid"
}
```

Access `response.data` only. **Never** rely on root-level fields outside this envelope.

---

## 1.5 Asset Folder Layout 2026 (Exact Mirror for Flutter)

Noor backend organises self-hosted MP3s under four folders inside `assets/`.
Flutter should mirror this exact layout into two places:

1. `flutter/assets/…` (declared in `pubspec.yaml` → used by `just_audio` with `AudioSource.asset(...)`)
2. `android/app/src/main/res/raw/` (lowercase, no dashes → used by Android native notification sound)

| Folder                 | What lives here                                                                                                                                                                                                                              | # files (Sep 2026)                                                                                                              | Playback policy                                                                                                                                                | Flutter mirror path                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `assets/azan/`         | **Full, long Azan recordings** (2–5 min each). Famous voices: Mishary Alafasy (3 variants), Ali Mulla, Yasser Al-Dosari, Nasser Al-Qatami, Abdul Basit, Minshawi, Rifaat.                                                                    | 9                                                                                                                               | Played on `kind == 'prayer_time'` via `azanSoundUrl` OR bundled `azan/<id>.mp3`.                                                                               | `flutter/assets/azan/…` + `android/…/res/raw/azan_…`         |
| `assets/notification/` | **Generic short tones** (≤ 5s, bells/chimes, no speech). Used by users who prefer a non-verbal reminder.                                                                                                                                     | 6 tones + `silent` (no file)                                                                                                    | Played on `kind == 'pre_reminder'` when user selected any tone EXCEPT the new "Auto Arabic voice" option.                                                      | `flutter/assets/notification/…` + `res/raw/soft_chime` etc.  |
| `assets/near-prayer/`  | Arabic short-voice announcements ("اقتربت صلاة الفجر" / … / الجمعة). **Only** these six files — never under `azan/` or `notification/`. | 6 on disk (fajr, dhuhr, asr, maghrib, isha, **jumuah**) | `kind == 'pre_reminder'` when `notificationSoundId == 'sc_near_auto'` (backend resolves per prayer; Friday Dhuhr → jumuah). | `flutter/assets/near-prayer/…` + `res/raw/sc_near_*` |
| `assets/salawat/`      | Short Salawat audio (unrelated to Azan — used by the Dhikr / Salawat reminder feature).                                                                                                                                                      | 1                                                                                                                               | Ignore for Azan integration.                                                                                                                                   | (Optional)                                                   |

**How to mirror correctly in Dart:**

- Always use the FCM `notificationSoundMediaFile` / `azanSoundMediaFile` field **verbatim** to build the relative key. The backend sends exactly the filename you need (e.g. `sc_near_fajr.mp3`).
- Strip `.mp3` to build the Android `R.raw.xxx` resource name.
- If a `near-prayer/` file is missing locally (see §5.3), fall back to `notification/soft_chime.mp3`. Do NOT crash.

---

## 2. Endpoint Quick Reference (100% Mapping)

| #   | Method  | Path                        | Auth     | Purpose (Flutter usage)                                                                                                                                                                                                                |
| --- | ------- | --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `GET`   | `/azan/sounds`              | Public   | List **14 Azan voices** (9 self-hosted famous + 5 SoundCloud premium refs). Use `id` field to store in user prefs. Play via `audioUrl` (Range/206 supported on self-hosted).                                                           |
| 2   | `GET`   | `/azan/notification-sounds` | Public   | List 7 short pre-reminder tones. Play via `audioUrl`.                                                                                                                                                                                  |
| 3   | `GET`   | `/azan/audio-defaults`      | Public   | Default Azan + notification sound resolved objects (guest fallback).                                                                                                                                                                   |
| 4   | `GET`   | `/azan/media/:file`         | Public   | **Stream self-hosted MP3** (Azan or notification). Supports HTTP `Range` requests for seek/preview (206 Partial Content). Pass the `mediaFile` field from the catalog.                                                                 |
| 5   | `GET`   | `/azan/calculation-methods` | Public   | 6 calculation methods for Settings dropdown.                                                                                                                                                                                           |
| 6   | `GET`   | `/azan/madhabs`             | Public   | 2 Madhabs (SHAFI / HANAFI) for Settings dropdown.                                                                                                                                                                                      |
| 7   | `GET`   | `/profile/azan-preferences` | Optional | Get synced Azan prefs for current user (includes resolved `azanSound` + `notificationSound` objects with absolute URLs).                                                                                                               |
| 8   | `PATCH` | `/profile/azan-preferences` | Required | Save user selections: `azanSoundId`, `notificationSoundId`, `calculationMethod`, `madhab`, `preReminderMinutes`, `preReminderEnabled`, `prayers:{fajr,dhuhr,asr,maghrib,isha}`, `soundEnabled`, `vibrationEnabled`, `lastLat/lastLng`. |
| 9   | `GET`   | `/prayers/today`            | Optional | Today's 5 prayer times + `nextPrayer` countdown.                                                                                                                                                                                       |
| 10  | `POST`  | `/devices/fcm-token`        | Required | Register FCM token for this device. **Must call after login + after token refresh.**                                                                                                                                                   |
| 11  | `POST`  | `/devices/test-push`        | Required | Dev/QA: send a test push to THIS device immediately.                                                                                                                                                                                   |
| 12  | `GET`   | `/notifications/`           | Required | In-app notification center (includes `AZAN`-type rows with `payload.audioUrl`).                                                                                                                                                        |
| 13  | `POST`  | `/cron/prayer-reminders`    | Secret   | Railway cron (every 10 min). **Flutter never calls this.**                                                                                                                                                                             |

---

## 3. FCM Payload — Complete Field-by-Field Contract

When the Railway cron fires (`/cron/prayer-reminders`), FCM delivers a push to your registered tokens.

Two distinct kinds of pushes are sent — **distinguish by `data.kind`**:

### 3.1 `kind = "prayer_time"` (Actual Azan — full Adhan MP3)

This fires **at the exact prayer time** (within the 10-min cron window).
It carries **the user's selected full Azan sound metadata**.

```jsonc
// FCM `notification` (visible to user in system tray):
{
  "title": "Time for Fajr",           // EN
  "body":  "It's time for Fajr (04:32)"
}

// FCM `data` (ALL VALUES ARE STRINGS — convert in Dart):
{
  "type":                     "AZAN",
  "kind":                     "prayer_time",        // KEY — play full Azan
  "audioScope":               "prayer_time_azan",
  "prayer":                   "FAJR",               // FAJR | DHUHR | ASR | MAGHRIB | ISHA
  "time":                     "04:32",              // HH:mm in USER'S LOCAL TZ
  "locale":                   "ar",

  // USER PREFERENCE FLAGS (respect these):
  "soundEnabled":             "true",               // "true" | "false"
  "vibrationEnabled":         "true",               // "true" | "false"

  // ——— FULL AZAN AUDIO OBJECT (16 fields) ———
  "azanSoundId":              "mishary_alafasy",    // or ali_mulla / sc_noor_azan_1 etc.
  "azanSoundNameEn":          "Mishary Alafasy",
  "azanSoundNameAr":          "مشاري العفاسي",
  "azanSoundUrl":             "https://noorapp-backend-production.up.railway.app/api/v1/azan/media/mishary_alafasy.mp3",
  "azanSoundPreviewUrl":      "(same as audioUrl)",
  "azanSoundMediaFile":       "mishary_alafasy.mp3",
  "azanSoundFormat":          "mp3",
  "azanSoundDurationSeconds": "182",                // "" if unknown
  "azanSoundMuezzin":         "Mishary Rashid Alafasy",
  "azanSoundMuezzinEn":       "Mishary Rashid Alafasy",
  "azanSoundMuezzinAr":       "مشاري راشد العفاسي",
  "azanSoundCategory":        "famous_contemporary",
  "azanSoundIsFamousVoice":   "true",
  "azanSoundProvider":        "aladhan_selfhosted", // "aladhan_selfhosted" | "assabile_selfhosted" | "soundcloud_reference"
  "titleAr":                  "حان موعد صلاة الفجر",
  "bodyAr":                   "حان موعد صلاة الفجر (٠٤:٣٢)"
}
```

### 3.2 `kind = "pre_reminder"` (Short tone — N minutes before prayer)

This fires **exactly `preReminderMinutes` before the prayer** (default 15 min).
It carries **the user's selected short notification-tone metadata**.

```jsonc
// FCM `notification`:
{
  "title": "Fajr soon",
  "body":  "Reminder: Fajr in about 15 minutes (04:32)"
}

// FCM `data` (ALL VALUES ARE STRINGS):
{
  "type":                     "AZAN",
  "kind":                     "pre_reminder",       // KEY — play SHORT tone
  "audioScope":               "pre_reminder",
  "prayer":                   "FAJR",
  "time":                     "04:32",
  "preReminderMinutes":       "15",

  // USER PREFERENCE FLAGS:
  "soundEnabled":             "true",
  "vibrationEnabled":         "true",
  "locale":                   "ar",

  // ——— NOTIFICATION TONE AUDIO OBJECT (8 fields) ———
  "notificationSoundId":              "soft_chime", // | sc_near_fajr | sc_near_dhuhr | sc_near_asr | sc_near_maghrib | sc_near_isha | sc_near_jumuah | sc_fajr_alarm | sc_near_qiyam | silent | ...
  "notificationSoundNameEn":          "Very Soft Notification",
  "notificationSoundNameAr":          "تنبيه ناعم جدًا",
  "notificationSoundUrl":             "https://noorapp-backend-production.up.railway.app/api/v1/azan/media/soft_chime.mp3",
  "notificationSoundMediaFile":       "soft_chime.mp3",
  "notificationSoundFormat":          "mp3",
  "notificationSoundDurationSeconds": "",
  "notificationSoundMood":            "calm",       // calm | gentle | soft_bell | silent | prayer_specific_voice

  // ——— ADDITIVE 2026 FIELDS (always present, non-breaking — old code can ignore)
  "autoMatched":                      "true",       // "true" if backend picked the per-prayer voice automatically because user chose `sc_near_auto`; "false" otherwise
  "matchedPrayerKey":                 "FAJR",       // FAJR | DHUHR | ASR | MAGHRIB | ISHA | JUMUAH | FAJR_ALARM | QIYAM | "" — which prayer the auto-matched clip is for
  "titleAr":                          "اقترب موعد الفجر",
  "bodyAr":                           "تذكير: تبقى حوالي ١٥ دقيقة على الفجر (٠٤:٣٢)"
}
```

---

## 4. Flutter Audio Playback Flow (2026 Perfect Implementation)

### 4.1 Dependencies (pubspec.yaml)

```yaml
dependencies:
  firebase_messaging: ^15.0.0 # FCM delivery
  flutter_local_notifications: ^17.0.0 # Head-ups notification on Android
  just_audio: ^0.9.30 # Streaming + local asset playback (Range/206 supported)
  vibration: ^2.0.0 # Haptic feedback
```

### 4.2 Step-by-Step Execution (At the moment FCM arrives)

```dart
// ===== TOP-LEVEL HANDLER (background + foreground) =====
Future<void> _handleAzanPush(RemoteMessage message) async {
  final data = message.data;
  final kind = data['kind'] ?? '';
  final soundEnabled   = data['soundEnabled']   == 'true';
  final vibrationEnabled = data['vibrationEnabled'] == 'true';
  final title = data['titleAr']?.isNotEmpty == true
      ? data['titleAr']!
      : message.notification?.title ?? '';
  final body  = data['bodyAr']?.isNotEmpty == true
      ? data['bodyAr']!
      : message.notification?.body ?? '';

  // Step 1: Show native notification FIRST (instant UI feedback).
  //         Use flutter_local_notifications — do NOT block on audio.
  _showLocalNotification(id: title.hashCode, title: title, body: body);

  // Step 2: Vibrate in parallel if user enabled it.
  if (vibrationEnabled) {
    if (kind == 'prayer_time') {
      Vibration.vibrate(pattern: [0, 400, 200, 400, 200, 600]); // Long Azan-style
    } else {
      Vibration.vibrate(duration: 200); // Short gentle buzz
    }
  }

  // Step 3: Play the correct audio — ONLY if soundEnabled.
  if (soundEnabled) {
    await _playCorrectAudio(kind: kind, data: data);
  }
}

// ===== AUDIO SELECTION + PLAYBACK =====
Future<void> _playCorrectAudio({required String kind, required Map<String,String> data}) async {
  String? url;
  bool isSoundcloudRef = false;
  String silentId = '';
  String? mediaFile;        // NEW 2026 — exact relative filename: "sc_near_fajr.mp3" | "soft_chime.mp3" | …
  String? matchedPrayerKey; // NEW 2026 — "FAJR"|"DHUHR"|…|"" — for logging / analytics

  if (kind == 'prayer_time') {
    url             = data['azanSoundUrl'];
    isSoundcloudRef = data['azanSoundProvider'] == 'soundcloud_reference';
  } else {
    url             = data['notificationSoundUrl'];
    silentId        = data['notificationSoundId'] ?? '';
    mediaFile       = data['notificationSoundMediaFile'];
    matchedPrayerKey = data['matchedPrayerKey'];
  }

  // Case A: User selected "Silent" for notifications — skip entirely.
  if (silentId == 'silent') return;

  // Case B: No URL resolved — fall back to local bundled default MP3.
  if (url == null || url.isEmpty) {
    return _playLocalAssetFallback(kind, mediaFile: mediaFile);
  }

  // Case C: Self-hosted (azanSoundProvider ends with "_selfhosted" or host is ours).
  //         Use just_audio with AudioSource.uri — supports Range/206 so it starts instantly.
  if (!isSoundcloudRef && !url.contains('soundcloud.com')) {
    try {
      final player = AudioPlayer();
      await player.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await player.play();
      player.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) player.dispose();
      });
      return;
    } catch (e) {
      // Fallback to local bundled asset on ANY network error.
      return _playLocalAssetFallback(kind, mediaFile: mediaFile);
    }
  }

  // Case D: SoundCloud reference (sc_noor_azan_1..5).
  //         Resolve through your SoundCloud SDK OR use the bundled fallback.
  //         Recommended: ship MP3s locally as assets under assets/azan/sc_noor_azan_N.mp3
  return _playLocalAssetFallback(kind, soundcloudIndex: _extractScIndex(data), mediaFile: mediaFile);
}

/// NEW 2026 — plays the bundled asset, with smart subfolder detection:
///   - If mediaFile looks like "sc_near_*.mp3" or "sc_fajr_alarm.mp3" → folder = "near-prayer"
///   - If mediaFile looks like a generic tone (soft_chime/bell/…)       → folder = "notification"
///   - If mediaFile looks like a full Azan (mishary/ali_mulla/sc_noor_azan) → folder = "azan"
/// Falls back 100% safely to "notification/soft_chime.mp3" if the exact file is not bundled.
Future<void> _playLocalAssetFallback(
  String kind, {
  int? soundcloudIndex,
  String? mediaFile,
}) async {
  String assetPath;
  if (mediaFile != null && mediaFile.isNotEmpty) {
    final f = mediaFile.toLowerCase();
    final String folder;
    if (f.startsWith('sc_near_') || f == 'sc_fajr_alarm.mp3') {
      folder = 'near-prayer';
    } else if (kind == 'prayer_time' || f.startsWith('sc_noor_azan_')) {
      folder = 'azan';
    } else {
      folder = 'notification';
    }
    assetPath = 'assets/$folder/$mediaFile';
  } else if (kind == 'prayer_time' && soundcloudIndex != null) {
    assetPath = 'assets/azan/sc_noor_azan_$soundcloudIndex.mp3';
  } else {
    assetPath = kind == 'prayer_time'
        ? 'assets/azan/mishary_alafasy.mp3'
        : 'assets/notification/soft_chime.mp3';
  }

  try {
    final player = AudioPlayer();
    await player.setAudioSource(AudioSource.asset(assetPath));
    await player.play();
    player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) player.dispose();
    });
  } catch (e) {
    // ——— 2026 missing-file fallback (CRITICAL — never crash on missing near-prayer MP3) ———
    // If the specific file (e.g. near-prayer/sc_near_jumuah.mp3) is not bundled yet,
    // gracefully degrade to the always-present soft_chime tone.
    final safeFallback = kind == 'prayer_time'
        ? 'assets/azan/mishary_alafasy.mp3'
        : 'assets/notification/soft_chime.mp3';
    final player = AudioPlayer();
    await player.setAudioSource(AudioSource.asset(safeFallback));
    await player.play();
    player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) player.dispose();
    });
  }
}

void _showLocalNotification({required int id, required String title, required String body}) {
  // Use androidChannelId = "azan"  for prayer_time
  //     androidChannelId = "azan-reminder" for pre_reminder
  // IMPORTANCE.max + fullScreenIntent for Fajr night wake-up.
}
```

### 4.3 Priority Precedence Rules (Never Skip)

1. **`soundEnabled == 'false'` → NO AUDIO EVER.** Vibrate only if `vibrationEnabled`.
2. **`notificationSoundId == 'silent'` → NO AUDIO** (pre-reminder only; vibration still fires).
3. **`kind == 'prayer_time'` always uses `azanSoundUrl`** — NEVER the notification tone.
4. **`kind == 'pre_reminder'` always uses `notificationSoundUrl`** — NEVER the full Azan.
5. **If `azanSoundProvider == 'soundcloud_reference'`**: Flutter MUST either (a) mirror those 5 MP3s as local assets named `assets/azan/sc_noor_azan_{1..5}.mp3`, OR (b) integrate the SoundCloud SDK; **do NOT stream the raw web link directly** (it's an HTML page, not an MP3).
6. **On ANY network error / 4xx / 5xx** → fall back to the locally bundled default (`mishary_alafasy.mp3` for Azan, `soft_chime.mp3` for pre-reminder).

---

## 5. Azan Sound Catalog (14 Voices — IDs + Names)

Use `GET /azan/sounds` → `data.sounds[]`. Every row has:

| Field                     | Type    | Meaning                                                                             |
| ------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `id`                      | string  | **Store this.** The canonical ID to send back in `PATCH /profile/azan-preferences`. |
| `nameEn` / `nameAr`       | string  | Display name for Settings list (pick by locale).                                    |
| `muezzinEn` / `muezzinAr` | string  | Muezzin's name (subtitle).                                                          |
| `audioUrl`                | string  | Absolute streaming URL. Self-hosted: points to `/azan/media/:file` (HTTP 206).      |
| `mediaFile`               | string  | The `:file` path segment you can pass directly to `/azan/media/:file`.              |
| `provider`                | string  | `"aladhan_selfhosted"` \| `"assabile_selfhosted"` \| `"soundcloud_reference"`.      |
| `available`               | boolean | `true` for every entry in this list.                                                |
| `isDefault`               | boolean | Only `mishary_alafasy` has this true.                                               |

### 5.1 IDs Table — 9 Self-Hosted (Reliable, No SDK Needed) + 5 SoundCloud Refs

| #   | `id`                | Muezzin / Label                | Provider             | Ship locally?                                           |
| --- | ------------------- | ------------------------------ | -------------------- | ------------------------------------------------------- |
| 1   | `mishary_alafasy`   | Mishary Alafasy (DEFAULT)      | aladhan_selfhosted   | **Yes** — bundle as `azan/mishary_alafasy.mp3` fallback |
| 2   | `mishary_alafasy_2` | Mishary Alafasy (var 2)        | aladhan_selfhosted   | Yes optional                                            |
| 3   | `mishary_alafasy_3` | Mishary Alafasy (var 3)        | aladhan_selfhosted   | Yes optional                                            |
| 4   | `ali_mulla`         | Ali Ahmed Mulla (Makkah Haram) | assabile_selfhosted  | Yes — most requested                                    |
| 5   | `yasser_al_dosari`  | Yasser Al-Dosari               | assabile_selfhosted  | Yes                                                     |
| 6   | `nasser_al_qatami`  | Nasser Al-Qatami (Riyadh)      | assabile_selfhosted  | Yes                                                     |
| 7   | `abdul_basit`       | Abdul Basit (Egypt Fajr)       | assabile_selfhosted  | Yes — classic                                           |
| 8   | `mohamed_minshawi`  | El-Minshawi (Egypt)            | assabile_selfhosted  | Yes                                                     |
| 9   | `mohamed_rifaat`    | Mohamed Rifaat (Cairo)         | assabile_selfhosted  | Yes                                                     |
| 10  | `sc_noor_azan_1`    | Noor Premium Azan — Track 1    | soundcloud_reference | **Bundle manually** (extract from playlist link below)  |
| 11  | `sc_noor_azan_2`    | Noor Premium Azan — Track 2    | soundcloud_reference | Bundle manually                                         |
| 12  | `sc_noor_azan_3`    | Noor Premium Azan — Track 3    | soundcloud_reference | Bundle manually                                         |
| 13  | `sc_noor_azan_4`    | Noor Premium Azan — Track 4    | soundcloud_reference | Bundle manually                                         |
| 14  | `sc_noor_azan_5`    | Noor Premium Azan — Track 5    | soundcloud_reference | Bundle manually                                         |

> **SoundCloud Playlist source for sc_noor_azan_1..5**: https://on.soundcloud.com/6uPo6iLHvhLfD211Hu
> Open the link → download the 5 MP3s locally → place under `assets/azan/` with matching filenames → register in `pubspec.yaml` → Flutter's fallback in Section 4 Case D will pick them up automatically.

### 5.2 Notification Tones (7 IDs — `GET /azan/notification-sounds`)

| `id`                   | Mood      | Notes                                                                      |
| ---------------------- | --------- | -------------------------------------------------------------------------- |
| `soft_chime` (DEFAULT) | calm      | Ship as `notification/soft_chime.mp3`                                      |
| `meditation_bell`      | gentle    |                                                                            |
| `singing_bowl`         | gentle    |                                                                            |
| `xylophone_chime`      | gentle    |                                                                            |
| `bell_chime`           | soft_bell | CC-BY attribution required in Settings "About"                             |
| `hand_bell`            | soft_bell | CC-BY attribution required                                                 |
| `silent`               | silent    | Do NOT ship a file. Flutter must return immediately when `id == 'silent'`. |

### 5.3 NEW 2026 — Near-Prayer Voice Clips (8 IDs — Prayer-Specific Arabic Short Voice)

**Playlist URL**: https://on.soundcloud.com/6uPo6iLHvhLfD211Hu (the near-prayer 8-clip sub-playlist — download each MP3 individually and place under `assets/near-prayer/` as shown below).

These IDs are exposed in `GET /azan/notification-sounds` but have `mood == 'prayer_specific_voice'` so you can group them in a separate "Arabic Voice (2026)" section in the Flutter Settings UI.

> **Recommended sentinel ID**: `sc_near_auto` — show a single toggle in Settings labelled **"Auto Arabic voice per prayer"**; store `notificationSoundId = 'sc_near_auto'` in the user prefs. The **backend resolver** picks the exact matching clip for the upcoming prayer (Friday Jumuah override, Fajr-alarm for long pre-reminder, etc.) and returns its `notificationSoundId + notificationSoundMediaFile` inside FCM. No client-side branching is needed.

| #   | `id`              | Status (Sep 2026)   | Media file (exact name in `AZAN_MEDIA_FILES`) | Exact folder / relative path             | Fallback if clip is missing or not bundled                                                                                    |
| --- | ----------------- | ------------------- | --------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | `sc_near_auto`    | ✅ Always available | (none — sentinel, resolved by backend)        | N/A                                      | N/A                                                                                                                           |
| 2   | `sc_near_fajr`    | ✅ ON DISK          | `sc_near_fajr.mp3`                            | `assets/near-prayer/sc_near_fajr.mp3`    | `notification/soft_chime.mp3`                                                                                                 |
| 3   | `sc_near_dhuhr`   | ✅ ON DISK          | `sc_near_dhuhr.mp3`                           | `assets/near-prayer/sc_near_dhuhr.mp3`   | `notification/soft_chime.mp3`                                                                                                 |
| 4   | `sc_near_asr`     | ✅ ON DISK          | `sc_near_asr.mp3`                             | `assets/near-prayer/sc_near_asr.mp3`     | `notification/soft_chime.mp3`                                                                                                 |
| 5   | `sc_near_maghrib` | ✅ ON DISK          | `sc_near_maghrib.mp3`                         | `assets/near-prayer/sc_near_maghrib.mp3` | `notification/soft_chime.mp3`                                                                                                 |
| 6   | `sc_near_isha`    | ✅ ON DISK          | `sc_near_isha.mp3`                            | `assets/near-prayer/sc_near_isha.mp3`    | `notification/soft_chime.mp3`                                                                                                 |
| 7   | `sc_near_jumuah`  | ❌ MISSING on disk  | `sc_near_jumuah.mp3`                          | `assets/near-prayer/sc_near_jumuah.mp3`  | **Backend**: falls back to `sc_near_dhuhr` → then `soft_chime`. **Flutter**: if asset missing → `notification/soft_chime.mp3` |
| 8   | `sc_fajr_alarm`   | ❌ MISSING on disk  | `sc_fajr_alarm.mp3`                           | `assets/near-prayer/sc_fajr_alarm.mp3`   | **Backend**: falls back to `sc_near_fajr` → then `soft_chime`. **Flutter**: if asset missing → `notification/soft_chime.mp3`  |
| 9   | `sc_near_qiyam`   | ❌ MISSING on disk  | `sc_near_qiyam.mp3`                           | `assets/near-prayer/sc_near_qiyam.mp3`   | **Backend**: falls back to `sc_near_isha` → then `soft_chime`. **Flutter**: if asset missing → `notification/soft_chime.mp3`  |

**Android `res/raw` naming convention for these clips** (the name you drop in `res/raw/` is the `nativeSound` value the backend sends as filename-without-`.mp3`):

| File inside `assets/near-prayer/`    | Android res/raw (copy here exactly) | Backend `nativeSound` value in FCM                           |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------ |
| `sc_near_fajr.mp3`                   | `sc_near_fajr.mp3`                  | `sc_near_fajr`                                               |
| `sc_near_dhuhr.mp3`                  | `sc_near_dhuhr.mp3`                 | `sc_near_dhuhr`                                              |
| `sc_near_asr.mp3`                    | `sc_near_asr.mp3`                   | `sc_near_asr`                                                |
| `sc_near_maghrib.mp3`                | `sc_near_maghrib.mp3`               | `sc_near_maghrib`                                            |
| `sc_near_isha.mp3`                   | `sc_near_isha.mp3`                  | `sc_near_isha`                                               |
| `sc_near_jumuah.mp3` (when provided) | `sc_near_jumuah.mp3`                | `sc_near_jumuah` → fallback to `sc_near_dhuhr` until on disk |
| `sc_fajr_alarm.mp3` (when provided)  | `sc_fajr_alarm.mp3`                 | `sc_fajr_alarm` → fallback to `sc_near_fajr` until on disk   |
| `sc_near_qiyam.mp3` (when provided)  | `sc_near_qiyam.mp3`                 | `sc_near_qiyam` → fallback to `sc_near_isha` until on disk   |

> **Flutter Dev Note**: If you try to create `RawResourceAndroidNotificationSound('sc_near_jumuah')` before the MP3 is bundled → Android crashes. Always fall back to `RawResourceAndroidNotificationSound('soft_chime')` for any of the 3 currently-missing IDs if the local raw is absent.

---

## 6. Android Native Setup (Critical for Fajr Wake-up)

### 6.1 `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.VIBRATE"/>
```

### 6.2 Notification Channels (Two Channels)

Create these channels ONCE at app launch (inside `main()` before `runApp`):

| Channel ID        | Name                    | Importance                   | Sound                                                                     | Use for                  |
| ----------------- | ----------------------- | ---------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `"azan"`          | "Azan (Call to Prayer)" | **MAX** + `fullScreenIntent` | Android resource: `res/raw/mishary_alafasy.mp3` → `R.raw.mishary_alafasy` | `kind == 'prayer_time'`  |
| `"azan-reminder"` | "Prayer Reminder"       | HIGH                         | `res/raw/soft_chime.mp3` → `R.raw.soft_chime`                             | `kind == 'pre_reminder'` |

> **Pro tip for 2026 high-end**: Place all 9 self-hosted Azan MP3s + 6 generic tones + 5 on-disk `near-prayer/` clips **all together** in `android/app/src/main/res/raw/` so `nativeSound` resolved from FCM (`mishary_alafasy` → `R.raw.mishary_alafasy`, `sc_near_fajr` → `R.raw.sc_near_fajr`) can be set on the notification **per-notification** via `flutter_local_notifications`'s `AndroidNotificationDetails(sound: RawResourceAndroidNotificationSound(name))`. This ensures **Android plays the audio natively even when the Flutter engine is cold** (Fajr scenario). Flutter audio via `just_audio` then acts as a **guarantee layer** — if native sound is muted by DND, just_audio still plays through the media stream.
>
> **For the 3 currently-missing near-prayer clips** (Jumuah / Fajr-alarm / Qiyam): _do not create an empty_ file in `res/raw/` — either skip them until the MP3 is provided, or copy `soft_chime.mp3` as a temporary filler. The backend already falls back to the matching alternative (`sc_near_dhuhr` for Jumuah etc.), so FCM `nativeSound` should resolve cleanly.

### 6.3 iOS Native Setup

Place all sounds in `ios/Runner/Assets.xcassets/` or `Library/Sounds/`.
Register in `Info.plist` `UIBackgroundModes` → `audio`, `remote-notification`.
For Fajr: use `UNUserNotificationCenter` with `UNNotificationSound(named: "mishary_alafasy.mp3")`.

---

## 7. Preference PATCH Payload (Azan Settings Screen → Backend)

When the user taps **Save** in Settings:

```http
PATCH /api/v1/profile/azan-preferences
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "azanEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "azanSoundId": "ali_mulla",           // or "sc_noor_azan_3" or "mishary_alafasy" (legacy alias: "voiceId" also accepted)
  "notificationSoundId": "bell_chime",  // from GET /azan/notification-sounds
  "calculationMethod": "EGYPT",         // from GET /azan/calculation-methods
  "madhab": "SHAFI",                    // or "HANAFI"
  "preReminderEnabled": true,
  "preReminderMinutes": 15,
  "prayers": {
    "fajr": true,  "dhuhr": true,  "asr": true,
    "maghrib": true,  "isha": true
  },
  "lastLat": 30.0444,
  "lastLng": 31.2357,
  "lastLocationLabel": "Cairo, Egypt"
}
```

The `PATCH /profile/azan-preferences → data.azanSound` response returns the **resolved** object with absolute URLs (use to refresh the preview player in Settings immediately).

---

## 8. In-App Notification Center Row (AZAN type)

After a push is delivered, the backend also writes a `Notification` DB row. Flutter reads these via `GET /notifications/`:

```json
{
  "id": "uuid",
  "type": "AZAN",
  "titleAr": "حان موعد صلاة الفجر",
  "titleEn": "Time for Fajr",
  "bodyAr": "...",
  "bodyEn": "...",
  "deepLink": "/prayer-times",
  "readAt": null,
  "payload": {
    "prayer": "FAJR",
    "kind": "prayer_time",
    "time": "04:32",
    "audioScope": "prayer_time_azan",
    "azanSoundId": "mishary_alafasy",
    "azanSoundUrl": "https://.../api/v1/azan/media/mishary_alafasy.mp3"
  },
  "createdAt": "2026-09-24T02:32:00.000Z"
}
```

**Flutter behavior when user taps the row**:

- Navigate to `deepLink` → `/prayer-times`
- If `payload.azanSoundUrl` is present → give the user a ▶️ "Play Adhan Again" button that streams the URL via `just_audio`.

---

## 9. Testing / QA Checklist (Must Pass 100%)

| #   | Test Case                                                 | Expected Result                                                                                            |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Register FCM token → call `/devices/test-push`            | Notification arrives instantly, `type=SYSTEM`                                                              |
| 2   | Set `azanSoundId=ali_mulla`, `preReminderMinutes=15`      | Cron fires 15 min before + at prayer time; correct audio URLs in data                                      |
| 3   | Set `soundEnabled=false`, `vibrationEnabled=true`         | No MP3 plays; device DOES vibrate                                                                          |
| 4   | Set `notificationSoundId=silent`, pre-reminder fires      | No audio; vibration only if enabled                                                                        |
| 5   | Fajr time on Android 13+                                  | Full-screen intent launches; Azan plays via native channel + Flutter just_audio (double guarantee)         |
| 6   | Stream `/azan/media/ali_mulla.mp3` with `Range: bytes=0-` | HTTP 206 Partial Content, audio starts in < 200 ms                                                         |
| 7   | Select `sc_noor_azan_4` → wait for prayer trigger         | `azanSoundProvider=soundcloud_reference` in data; Flutter plays bundled asset `azan/sc_noor_azan_4.mp3`    |
| 8   | Toggle `prayers.sunrise = false` in prefs (if UI allows)  | No push for Sunrise; backend skips Sunrise in cron per legacy rules                                        |
| 9   | Offline during Fajr → back online after 20 min            | In-app Notification Center still shows the row (cron wrote it)                                             |
| 10  | Arabic digits in UI (`٠٤:٣٢`)                             | Parse correctly; backend always sends "04:32" in `time` field, Flutter formats to Arabic if `locale=='ar'` |

---

## 10. Soundcloud Playlist Integration Notes

- **Playlist URL**: https://on.soundcloud.com/6uPo6iLHvhLfD211Hu
- Short link resolves to a 5-track playlist. Use any SoundCloud downloader / browser DevTools to extract raw MP3s.
- Recommended filenames for bundling:
  - `assets/azan/sc_noor_azan_1.mp3` (Track 1)
  - `assets/azan/sc_noor_azan_2.mp3` (Track 2)
  - `assets/azan/sc_noor_azan_3.mp3` (Track 3)
  - `assets/azan/sc_noor_azan_4.mp3` (Track 4)
  - `assets/azan/sc_noor_azan_5.mp3` (Track 5)
- Register these in `pubspec.yaml` under `flutter: assets:`.
- **Critical**: If user's network is offline, **always** fall back to the self-hosted 9 (`mishary_alafasy`) — these are already mirrored on Railway CDN and available offline if bundled.

---

## 11. Version History

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2026.2 | 2026-09-24 | **Non-breaking update.** (1) New Section 1.5: 4-folder Asset Layout 2026 (azan / notification / near-prayer / salawat). (2) New Section 5.3: 8 Near-Prayer Arabic voice clips (`sc_near_*`, `sc_fajr_alarm`, `sc_near_qiyam`) with exact folder paths, on-disk status (✅ 5 / ❌ 3 missing), and documented per-id fallback. (3) `kind == 'pre_reminder'` FCM now always includes 2 new **additive-only** string fields: `autoMatched` ("true"/"false") + `matchedPrayerKey` ("FAJR"\|"DHUHR"\|...). (4) Backend resolver `resolvePreReminderSoundFor` does a deterministic disk check before returning clips; missing Jumuah / Fajr-alarm / Qiyam fall back safely to their logical neighbour with a `logger.warn` (no crash). (5) Section 4 Dart playback code updated with a new `_playLocalAssetFallback` that auto-picks the correct folder using `notificationSoundMediaFile`, plus a try/catch around asset loading to silently degrade to `soft_chime` when a near-prayer MP3 is not yet bundled. (6) Android §6.2 Pro Tip now tells Flutter devs to drop only currently-shipped files in `res/raw/` (9 Azan + 6 tones + 5 on-disk near-prayer) with explicit advice to not empty-fill the 3 missing. |
| v2026.1 | 2026-09-24 | Initial release: FCM audio-metadata injection (16 fields for Azan, 8 fields for pre-reminder), 5 SoundCloud refs added to catalog, nativeSound passthrough, full Flutter flow, double-guarantee playback (native channel + just_audio).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

**Backend Status**: All changes are LIVE on Railway after deploy. No DB migrations needed for this feature (all audio selection is read from existing JSONB column `azanPreferences` + new catalog rows in constants).

**Remember**: Response Shape never breaks. If a field is missing or empty string in FCM data → fall back to the 2026 defaults in Section 5.1 Table rows #1 and `soft_chime`.
