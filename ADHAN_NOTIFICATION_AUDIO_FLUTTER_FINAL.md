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
  "data": {  },
  "meta": { "page": 1, "perPage": 20, "total": 0, "unreadCount": 0 },
  "timestamp": "2026-09-24T00:00:00.000Z",
  "requestId": "uuid"
}
```

Access `response.data` only. **Never** rely on root-level fields outside this envelope.

---

## 2. Endpoint Quick Reference (100% Mapping)

| # | Method | Path | Auth | Purpose (Flutter usage) |
|---|---|---|---|---|
| 1 | `GET` | `/azan/sounds` | Public | List **14 Azan voices** (9 self-hosted famous + 5 SoundCloud premium refs). Use `id` field to store in user prefs. Play via `audioUrl` (Range/206 supported on self-hosted). |
| 2 | `GET` | `/azan/notification-sounds` | Public | List 7 short pre-reminder tones. Play via `audioUrl`. |
| 3 | `GET` | `/azan/audio-defaults` | Public | Default Azan + notification sound resolved objects (guest fallback). |
| 4 | `GET` | `/azan/media/:file` | Public | **Stream self-hosted MP3** (Azan or notification). Supports HTTP `Range` requests for seek/preview (206 Partial Content). Pass the `mediaFile` field from the catalog. |
| 5 | `GET` | `/azan/calculation-methods` | Public | 6 calculation methods for Settings dropdown. |
| 6 | `GET` | `/azan/madhabs` | Public | 2 Madhabs (SHAFI / HANAFI) for Settings dropdown. |
| 7 | `GET` | `/profile/azan-preferences` | Optional | Get synced Azan prefs for current user (includes resolved `azanSound` + `notificationSound` objects with absolute URLs). |
| 8 | `PATCH` | `/profile/azan-preferences` | Required | Save user selections: `azanSoundId`, `notificationSoundId`, `calculationMethod`, `madhab`, `preReminderMinutes`, `preReminderEnabled`, `prayers:{fajr,dhuhr,asr,maghrib,isha}`, `soundEnabled`, `vibrationEnabled`, `lastLat/lastLng`. |
| 9 | `GET` | `/prayers/today` | Optional | Today's 5 prayer times + `nextPrayer` countdown. |
| 10 | `POST` | `/devices/fcm-token` | Required | Register FCM token for this device. **Must call after login + after token refresh.** |
| 11 | `POST` | `/devices/test-push` | Required | Dev/QA: send a test push to THIS device immediately. |
| 12 | `GET` | `/notifications/` | Required | In-app notification center (includes `AZAN`-type rows with `payload.audioUrl`). |
| 13 | `POST` | `/cron/prayer-reminders` | Secret | Railway cron (every 10 min). **Flutter never calls this.** |

---

## 3. FCM Payload — Complete Field-by-Field Contract

When the Railway cron fires (`/cron/prayer-reminders`), FCM delivers a push to your registered tokens.

Two distinct kinds of pushes are sent — **distinguish by `data.kind`**:

### 3.1 `kind = "prayer_time"`  (Actual Azan — full Adhan MP3)

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

### 3.2 `kind = "pre_reminder"`  (Short tone — N minutes before prayer)

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
  "notificationSoundId":              "soft_chime", // | meditation_bell | singing_bowl | xylophone_chime | bell_chime | hand_bell | silent
  "notificationSoundNameEn":          "Very Soft Notification",
  "notificationSoundNameAr":          "تنبيه ناعم جدًا",
  "notificationSoundUrl":             "https://noorapp-backend-production.up.railway.app/api/v1/azan/media/soft_chime.mp3",
  "notificationSoundMediaFile":       "soft_chime.mp3",
  "notificationSoundFormat":          "mp3",
  "notificationSoundDurationSeconds": "",
  "notificationSoundMood":            "calm",       // calm | gentle | soft_bell | silent
  "titleAr":                          "اقترب موعد الفجر",
  "bodyAr":                           "تذكير: تبقى حوالي ١٥ دقيقة على الفجر (٠٤:٣٢)"
}
```

---

## 4. Flutter Audio Playback Flow (2026 Perfect Implementation)

### 4.1 Dependencies (pubspec.yaml)

```yaml
dependencies:
  firebase_messaging: ^15.0.0          # FCM delivery
  flutter_local_notifications: ^17.0.0 # Head-ups notification on Android
  just_audio: ^0.9.30                  # Streaming + local asset playback (Range/206 supported)
  vibration: ^2.0.0                    # Haptic feedback
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

  if (kind == 'prayer_time') {
    url             = data['azanSoundUrl'];
    isSoundcloudRef = data['azanSoundProvider'] == 'soundcloud_reference';
  } else {
    url      = data['notificationSoundUrl'];
    silentId = data['notificationSoundId'] ?? '';
  }

  // Case A: User selected "Silent" for notifications — skip entirely.
  if (silentId == 'silent') return;

  // Case B: No URL resolved — fall back to local bundled default MP3.
  if (url == null || url.isEmpty) {
    return _playLocalAssetFallback(kind);
  }

  // Case C: Self-hosted (azanSoundProvider ends with "_selfhosted" or host is ours).
  //         Use just_audio with AudioSource.uri — supports Range/206 so it starts instantly.
  if (!isSoundcloudRef && !url.contains('soundcloud.com')) {
    try {
      final player = AudioPlayer();
      await player.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await player.play();
      // Dispose after finish (or let lifecycle handle it for full Azan).
      player.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) player.dispose();
      });
      return;
    } catch (e) {
      // Fallback to local bundled asset on ANY network error.
      return _playLocalAssetFallback(kind);
    }
  }

  // Case D: SoundCloud reference (sc_noor_azan_1..5).
  //         Resolve through your SoundCloud SDK OR use the bundled fallback.
  //         Recommended: ship MP3s locally as assets under assets/azan/sc_noor_azan_N.mp3
  return _playLocalAssetFallback(kind, soundcloudIndex: _extractScIndex(data));
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

| Field | Type | Meaning |
|---|---|---|
| `id` | string | **Store this.** The canonical ID to send back in `PATCH /profile/azan-preferences`. |
| `nameEn` / `nameAr` | string | Display name for Settings list (pick by locale). |
| `muezzinEn` / `muezzinAr` | string | Muezzin's name (subtitle). |
| `audioUrl` | string | Absolute streaming URL. Self-hosted: points to `/azan/media/:file` (HTTP 206). |
| `mediaFile` | string | The `:file` path segment you can pass directly to `/azan/media/:file`. |
| `provider` | string | `"aladhan_selfhosted"` \| `"assabile_selfhosted"` \| `"soundcloud_reference"`. |
| `available` | boolean | `true` for every entry in this list. |
| `isDefault` | boolean | Only `mishary_alafasy` has this true. |

### 5.1 IDs Table — 9 Self-Hosted (Reliable, No SDK Needed) + 5 SoundCloud Refs

| # | `id` | Muezzin / Label | Provider | Ship locally? |
|---|---|---|---|---|
| 1 | `mishary_alafasy` | Mishary Alafasy (DEFAULT) | aladhan_selfhosted | **Yes** — bundle as `azan/mishary_alafasy.mp3` fallback |
| 2 | `mishary_alafasy_2` | Mishary Alafasy (var 2) | aladhan_selfhosted | Yes optional |
| 3 | `mishary_alafasy_3` | Mishary Alafasy (var 3) | aladhan_selfhosted | Yes optional |
| 4 | `ali_mulla` | Ali Ahmed Mulla (Makkah Haram) | assabile_selfhosted | Yes — most requested |
| 5 | `yasser_al_dosari` | Yasser Al-Dosari | assabile_selfhosted | Yes |
| 6 | `nasser_al_qatami` | Nasser Al-Qatami (Riyadh) | assabile_selfhosted | Yes |
| 7 | `abdul_basit` | Abdul Basit (Egypt Fajr) | assabile_selfhosted | Yes — classic |
| 8 | `mohamed_minshawi` | El-Minshawi (Egypt) | assabile_selfhosted | Yes |
| 9 | `mohamed_rifaat` | Mohamed Rifaat (Cairo) | assabile_selfhosted | Yes |
| 10 | `sc_noor_azan_1` | Noor Premium Azan — Track 1 | soundcloud_reference | **Bundle manually** (extract from playlist link below) |
| 11 | `sc_noor_azan_2` | Noor Premium Azan — Track 2 | soundcloud_reference | Bundle manually |
| 12 | `sc_noor_azan_3` | Noor Premium Azan — Track 3 | soundcloud_reference | Bundle manually |
| 13 | `sc_noor_azan_4` | Noor Premium Azan — Track 4 | soundcloud_reference | Bundle manually |
| 14 | `sc_noor_azan_5` | Noor Premium Azan — Track 5 | soundcloud_reference | Bundle manually |

> **SoundCloud Playlist source for sc_noor_azan_1..5**: https://on.soundcloud.com/6uPo6iLHvhLfD211Hu
> Open the link → download the 5 MP3s locally → place under `assets/azan/` with matching filenames → register in `pubspec.yaml` → Flutter's fallback in Section 4 Case D will pick them up automatically.

### 5.2 Notification Tones (7 IDs — `GET /azan/notification-sounds`)

| `id` | Mood | Notes |
|---|---|---|
| `soft_chime` (DEFAULT) | calm | Ship as `notification/soft_chime.mp3` |
| `meditation_bell` | gentle | |
| `singing_bowl` | gentle | |
| `xylophone_chime` | gentle | |
| `bell_chime` | soft_bell | CC-BY attribution required in Settings "About" |
| `hand_bell` | soft_bell | CC-BY attribution required |
| `silent` | silent | Do NOT ship a file. Flutter must return immediately when `id == 'silent'`. |

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

| Channel ID | Name | Importance | Sound | Use for |
|---|---|---|---|---|
| `"azan"` | "Azan (Call to Prayer)" | **MAX** + `fullScreenIntent` | Android resource: `res/raw/mishary_alafasy.mp3` → `R.raw.mishary_alafasy` | `kind == 'prayer_time'` |
| `"azan-reminder"` | "Prayer Reminder" | HIGH | `res/raw/soft_chime.mp3` → `R.raw.soft_chime` | `kind == 'pre_reminder'` |

> **Pro tip for 2026 high-end**: Place all 14 Azan MP3s + 6 tones in `android/app/src/main/res/raw/` so `nativeSound` resolved from FCM (`mishary_alafasy` → `R.raw.mishary_alafasy`) can be set on the channel **per-notification** via `flutter_local_notifications`'s `AndroidNotificationDetails(sound: RawResourceAndroidNotificationSound('mishary_alafasy'))`. This ensures **Android plays the audio natively even when the Flutter engine is cold** (Fajr scenario). Flutter audio then acts as a **guarantee layer** — if native sound is muted by DND, just_audio will still play through the media stream.

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

| # | Test Case | Expected Result |
|---|---|---|
| 1 | Register FCM token → call `/devices/test-push` | Notification arrives instantly, `type=SYSTEM` |
| 2 | Set `azanSoundId=ali_mulla`, `preReminderMinutes=15` | Cron fires 15 min before + at prayer time; correct audio URLs in data |
| 3 | Set `soundEnabled=false`, `vibrationEnabled=true` | No MP3 plays; device DOES vibrate |
| 4 | Set `notificationSoundId=silent`, pre-reminder fires | No audio; vibration only if enabled |
| 5 | Fajr time on Android 13+ | Full-screen intent launches; Azan plays via native channel + Flutter just_audio (double guarantee) |
| 6 | Stream `/azan/media/ali_mulla.mp3` with `Range: bytes=0-` | HTTP 206 Partial Content, audio starts in < 200 ms |
| 7 | Select `sc_noor_azan_4` → wait for prayer trigger | `azanSoundProvider=soundcloud_reference` in data; Flutter plays bundled asset `azan/sc_noor_azan_4.mp3` |
| 8 | Toggle `prayers.sunrise = false` in prefs (if UI allows) | No push for Sunrise; backend skips Sunrise in cron per legacy rules |
| 9 | Offline during Fajr → back online after 20 min | In-app Notification Center still shows the row (cron wrote it) |
| 10 | Arabic digits in UI (`٠٤:٣٢`) | Parse correctly; backend always sends "04:32" in `time` field, Flutter formats to Arabic if `locale=='ar'` |

---

## 10. Soundcloud Playlist Integration Notes

- **Playlist URL**: https://on.soundcloud.com/6uPo6iLHvhLfD211Hu
- Short link resolves to a 5-track playlist. Use any SoundCloud downloader / browser DevTools to extract raw MP3s.
- Recommended filenames for bundling:
  - `assets/azan/sc_noor_azan_1.mp3`  (Track 1)
  - `assets/azan/sc_noor_azan_2.mp3`  (Track 2)
  - `assets/azan/sc_noor_azan_3.mp3`  (Track 3)
  - `assets/azan/sc_noor_azan_4.mp3`  (Track 4)
  - `assets/azan/sc_noor_azan_5.mp3`  (Track 5)
- Register these in `pubspec.yaml` under `flutter: assets:`.
- **Critical**: If user's network is offline, **always** fall back to the self-hosted 9 (`mishary_alafasy`) — these are already mirrored on Railway CDN and available offline if bundled.

---

## 11. Version History

| Version | Date | Changes |
|---|---|---|
| v2026.1 | 2026-09-24 | Initial release: FCM audio-metadata injection (16 fields for Azan, 8 fields for pre-reminder), 5 SoundCloud refs added to catalog, nativeSound passthrough, full Flutter flow, double-guarantee playback (native channel + just_audio). |

---

**Backend Status**: All changes are LIVE on Railway after deploy. No DB migrations needed for this feature (all audio selection is read from existing JSONB column `azanPreferences` + new catalog rows in constants).

**Remember**: Response Shape never breaks. If a field is missing or empty string in FCM data → fall back to the 2026 defaults in Section 5.1 Table rows #1 and `soft_chime`.
