# Noor — Notifications FINAL (Flutter) — 2026

> **One file. If anything in an older doc disagrees with this file, this file wins.**
> Supersedes the notification parts of: `FLUTTER_PRAYER_NOTIFICATIONS_CONTRACT.md`,
> `FLUTTER_NEAR_PRAYER_NOTIFICATION_HANDOFF.md`, `ADHAN_NOTIFICATION_AUDIO_FLUTTER_FINAL.md`,
> `FLUTTER_REMINDER_TIMING_FIX_2026.md`, `FLUTTER_PRAYER_AZAN_PRODUCTION_HANDOFF_2026.md` §8.
>
> Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`
> All responses keep the usual envelope `{ success, message, data, meta, timestamp }`.

**TL;DR**
- **Azan, pre-prayer reminder, Duha, Qiyam:** scheduled **locally on the phone**, with the correct sound.
- **Salawat, Surat Al-Mulk, Khatmah:** sent by the **server only**.
- **No duplicates:** the app tells the server how far ahead it has scheduled (`localScheduledUntil`), and the server sends no FCM backup inside that window. A reminder never arrives twice, and if local alarms stop (permissions revoked, app not opened for days) the backup takes over automatically.
- **Sounds:** every sound file is bundled under the **exact** name listed in the tables below. Android: `res/raw` with one channel per sound. iOS: `.caf`, ≤ 30 seconds.

---

## 0. What the backend changed for you (already live after deploy)

| Change | Why it matters to you |
|---|---|
| `androidChannelId` is now **per sound**: `azan_<soundId>`, `near_<sound>` (+ `_novib`, `azan_silent`, `near_silent`) | Android freezes a channel's sound forever at creation; one fixed `azan` channel can never change voice. |
| APNs `sound` is now `<name>.caf` (was bare `<name>`) | iOS needs the extension, otherwise it silently plays the default tone. |
| APNs `interruption-level: time-sensitive` on Azan + pre-prayer | Breaks through Focus / Scheduled Summary once you enable the capability (§4). |
| Azan FCM `sound` = the voice id (was `default`) | iOS plays the 30 s clip of the chosen muezzin; Android uses the channel. |
| New pref `localScheduledUntil` on `/profile/azan-preferences` | Kills duplicates (local + FCM) without losing the safety net. §6.4 |
| Android `tag` + `apns-collapse-id` = `occurrenceKey` | Retries of the same reminder replace each other in the tray. |
| `POST /devices/test-push` accepts `androidChannelId` + `nativeSound`; default channel is `general` | QA every channel/sound end-to-end. §10 |
| Timing: server backup fires in the exact minute (never early, ≤10 min late max) | See `FLUTTER_REMINDER_TIMING_FIX_2026.md` if curious; nothing to do. |

---

## 1. Ownership — who fires what

| Reminder | `type` / `eventType` | Fired by | Server FCM backup |
|---|---|---|---|
| Azan (prayer time) | `AZAN` / `PRAYER_AZAN` or `JUMUAH` (Fri Dhuhr) | **Local** (primary) | Only for instants **after** `localScheduledUntil` |
| Pre-prayer reminder | `AZAN` / `PRE_PRAYER` | **Local** | Same rule |
| Duha | `DUHA` | **Local** | Same rule |
| Qiyam | `QIYAM` | **Local** | Same rule |
| Salawat | `SALAWAT` | **Server only** | — (do **not** schedule locally) |
| Surat Al-Mulk | `MULK` | **Server only** | — (do **not** schedule locally) |
| Khatmah | `KHATMAH` | **Server only** (needs server progress) | — (do **not** schedule locally) |

If you currently schedule Salawat / Mulk / Khatmah locally: **delete that code** — the server sends them on time, with quiet hours / intervals / "ward already done" logic you'd otherwise have to duplicate.

---

## 2. Packages

Use latest stable of:

```yaml
firebase_core:
firebase_messaging:
flutter_local_notifications:   # scheduling + channels + actions
timezone:                      # TZDateTime
flutter_timezone:              # device IANA zone
permission_handler:            # battery-optimization status
just_audio:                    # full Azan in-app + previews
workmanager:                   # periodic re-schedule (Android + iOS BGTask)
adhan_dart:                    # offline fallback only (§6.2)
```

> Code below targets `flutter_local_notifications` v19+. If your version still requires
> `uiLocalNotificationDateInterpretation` on `zonedSchedule`, pass `absoluteTime`.

---

## 3. Sound files — exact names (this is where "no sound" bugs come from)

The **basename is the contract**. The backend sends it; Android looks it up in `res/raw`; iOS looks up `<basename>.caf`.

### 3.1 The list

| Group | Basenames | Source URL (download once at build time) |
|---|---|---|
| Azan voices (9) | `nasser_al_qatami` (default), `mishary_alafasy`, `mishary_alafasy_2`, `mishary_alafasy_3`, `ali_mulla`, `yasser_al_dosari`, `abdul_basit`, `mohamed_minshawi`, `mohamed_rifaat` | `/azan/media/<name>.mp3` |
| Near-prayer voices (auto) | `sc_near_fajr`, `sc_near_dhuhr`, `sc_near_asr`, `sc_near_maghrib`, `sc_near_isha`, `sc_near_jumuah` | `/azan/media/<name>.mp3` |
| Duha / Qiyam | `sc_event_duha`, `sc_event_qiyam` | `/azan/media/<name>.mp3` |
| Salawat | `salli_ala_muhammad` | `/salawat/media/salli_ala_muhammad.mp3` |
| Pre-reminder tones (user pick) | `soft_chime` (default), `notify_beep`, `digital_blip`, `ui_alert`, `sparkle_tone`, `message_pop`, `gui_notify`, `game_notify`, `notify_punchy`, `dingaling`, `meditation_bell`, `singing_bowl`, `xylophone_chime`, `bell_chime`, `hand_bell` | `/azan/media/<name>.mp3` |

`silent` and `sc_near_auto` are ids, **not** files. Mulk / Khatmah / `general` use the OS default sound.

### 3.2 Download everything (one-time)

```bash
BASE=https://noorapp-backend-production.up.railway.app/api/v1
mkdir -p sounds && cd sounds
for f in nasser_al_qatami mishary_alafasy mishary_alafasy_2 mishary_alafasy_3 ali_mulla \
         yasser_al_dosari abdul_basit mohamed_minshawi mohamed_rifaat \
         sc_near_fajr sc_near_dhuhr sc_near_asr sc_near_maghrib sc_near_isha sc_near_jumuah \
         sc_event_duha sc_event_qiyam \
         soft_chime notify_beep digital_blip ui_alert sparkle_tone message_pop gui_notify \
         game_notify notify_punchy dingaling meditation_bell singing_bowl xylophone_chime \
         bell_chime hand_bell; do
  curl -fSL "$BASE/azan/media/$f.mp3" -o "$f.mp3"
done
curl -fSL "$BASE/salawat/media/salli_ala_muhammad.mp3" -o salli_ala_muhammad.mp3
```

### 3.3 Android → `android/app/src/main/res/raw/<basename>.mp3`

Azan files are big (Abdul Basit is 11.7 MB). Re-encode the 9 azan voices to mono 64 kbps (≈14 MB total, no audible loss on a phone speaker):

```bash
mkdir -p android_raw
for f in nasser_al_qatami mishary_alafasy mishary_alafasy_2 mishary_alafasy_3 ali_mulla \
         yasser_al_dosari abdul_basit mohamed_minshawi mohamed_rifaat; do
  ffmpeg -y -i "$f.mp3" -ac 1 -ar 44100 -b:a 64k "android_raw/$f.mp3"
done
# short clips: copy as-is
cp sc_*.mp3 salli_ala_muhammad.mp3 soft_chime.mp3 notify_beep.mp3 digital_blip.mp3 ui_alert.mp3 \
   sparkle_tone.mp3 message_pop.mp3 gui_notify.mp3 game_notify.mp3 notify_punchy.mp3 dingaling.mp3 \
   meditation_bell.mp3 singing_bowl.mp3 xylophone_chime.mp3 bell_chime.mp3 hand_bell.mp3 android_raw/
```

**Stop R8 from deleting them** (they're referenced only by name at runtime) — `android/app/src/main/res/raw/keep.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@raw/*" />
```

### 3.4 iOS → `ios/Runner/Sounds/<basename>.caf` (added to the **Runner** target → Copy Bundle Resources)

iOS rules: **≤ 30 seconds** (longer = default sound plays), format Linear PCM / IMA4 in `.caf`/`.wav`/`.aiff` (**not** mp3/AAC).
Azan voices → first 29.5 s with a 2 s fade-out; everything else as-is. On a Mac (`afconvert` is the reference tool):

```bash
mkdir -p ios_caf
for f in *.mp3; do
  n="${f%.mp3}"
  case "$n" in
    nasser_al_qatami|mishary_alafasy|mishary_alafasy_2|mishary_alafasy_3|ali_mulla|yasser_al_dosari|abdul_basit|mohamed_minshawi|mohamed_rifaat)
      ffmpeg -y -i "$f" -t 29.5 -af "afade=t=out:st=27.5:d=2" -ac 1 -ar 44100 "/tmp/$n.wav" ;;
    *)
      ffmpeg -y -i "$f" -ac 1 -ar 44100 "/tmp/$n.wav" ;;
  esac
  afconvert -f caff -d ima4 "/tmp/$n.wav" "ios_caf/$n.caf"
done
```

(No Mac: `ffmpeg -i in.wav -c:a adpcm_ima_qt out.caf` works too.)

---

## 4. Platform setup

### 4.1 Android

`AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.WAKE_LOCK"/>

<application ...>
  <!-- flutter_local_notifications -->
  <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver"/>
  <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">
    <intent-filter>
      <action android:name="android.intent.action.BOOT_COMPLETED"/>
      <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
      <action android:name="android.intent.action.QUICKBOOT_POWERON"/>
      <action android:name="com.htc.intent.action.QUICKBOOT_POWERON"/>
    </intent-filter>
  </receiver>
  <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ActionBroadcastReceiver"/>

  <!-- FCM: fallback channel + monochrome status-bar icon -->
  <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="general"/>
  <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_noor"/>
  <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/noor_primary"/>
</application>
```

- `ic_stat_noor` = white-on-transparent silhouette (a colored icon shows as a white square).
- **Don't** use `USE_EXACT_ALARM` (Play only allows it for alarm-clock/calendar apps) and **don't** use `USE_FULL_SCREEN_INTENT` (Android 14 restricts it to calling/alarm apps). `SCHEDULE_EXACT_ALARM` + asking the user is the accepted 2026 path.
- **Don't** request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` (Play policy). Open the settings screen instead (§4.3).

### 4.2 iOS

Xcode → Runner → Signing & Capabilities:
1. **Push Notifications**
2. **Background Modes** → *Remote notifications* + *Background fetch*
3. **Time Sensitive Notifications** (adds `com.apple.developer.usernotifications.time-sensitive`)

Firebase console → Project settings → Cloud Messaging → upload the **APNs Auth Key (.p8)**.
`Info.plist` → `BGTaskSchedulerPermittedIdentifiers` = `["noor.reschedule"]` (for workmanager).

`AppDelegate.swift`:

```swift
import flutter_local_notifications
// in application(_:didFinishLaunchingWithOptions:)
FlutterLocalNotificationsPlugin.setPluginRegistrantCallback { registry in
  GeneratedPluginRegistrant.register(with: registry)
}
if #available(iOS 10.0, *) {
  UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
}
```

**Honest iOS limits** (don't promise these to the user):
- A notification can play at most **30 s** → the tray plays the 30 s clip; the **full Azan plays when the user opens/taps** (§8).
- The ring/silent switch mutes notification sounds. Only *Critical Alerts* bypass it, and Apple doesn't grant those to prayer apps. Time-Sensitive bypasses Focus, not the silent switch.
- Max **64** pending local notifications per app (§6.3 handles it).

### 4.3 Permissions flow (first launch + every resume)

```dart
final android = fln.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
final ios = fln.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();

Future<NotifHealth> ensurePermissions({bool interactive = true}) async {
  bool notifOk, exactOk = true, batteryOk = true;
  if (Platform.isAndroid) {
    notifOk = await android!.areNotificationsEnabled() ?? false;
    if (!notifOk && interactive) notifOk = await android.requestNotificationsPermission() ?? false;
    exactOk = await android.canScheduleExactNotifications() ?? false;
    if (!exactOk && interactive) {
      await android.requestExactAlarmsPermission(); // opens "Alarms & reminders" settings
      exactOk = await android.canScheduleExactNotifications() ?? false;
    }
    batteryOk = await Permission.ignoreBatteryOptimizations.isGranted;
  } else {
    notifOk = await ios!.requestPermissions(alert: true, badge: true, sound: true) ?? false;
  }
  return NotifHealth(notifOk: notifOk, exactOk: exactOk, batteryOk: batteryOk);
}
```

Aggressive-OEM guide (Xiaomi, Huawei, Honor, Oppo, Realme, Vivo, OnePlus, Tecno, Infinix, Samsung): show a one-time screen ("So the Azan arrives on time") with buttons that open battery-optimization settings (`AppSettings`/intent `android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS`) and, on Xiaomi, Autostart. Reference: dontkillmyapp.com.

---

## 5. Channels (Android) — same formula as the backend

Android copies sound/vibration/importance into the channel **once**. Changing the voice therefore means a **new channel id**, never "update" or "delete + recreate same id" (Android restores the old settings on re-create).

### 5.1 Ids

```dart
String azanChannelId(String azanSoundId, {required bool soundEnabled, required bool vibrationEnabled}) =>
    'azan_${soundEnabled ? azanSoundId : 'silent'}${vibrationEnabled ? '' : '_novib'}';

/// nativeSound: raw basename (sc_near_fajr / soft_chime), 'default', or null when silent.
String nearChannelId(String? nativeSound, {required bool vibrationEnabled}) =>
    'near_${(nativeSound == null || nativeSound.isEmpty) ? 'silent' : nativeSound}${vibrationEnabled ? '' : '_novib'}';
```

| Channel id | Sound | Importance | Audio usage |
|---|---|---|---|
| `azan_<soundId>[ _novib]` | `res/raw/<soundId>` (full Azan) | max | **alarm** (plays on alarm volume, allowed in DND "alarms") |
| `azan_silent[ _novib]` | none | max | — |
| `near_<sound>[ _novib]` | `res/raw/<sound>` or default | high | notification |
| `near_silent[ _novib]` | none | high | — |
| `duha` | `sc_event_duha` | high | notification |
| `qiyam` | `sc_event_qiyam` | high | notification |
| `salawat` | `salli_ala_muhammad` | default | notification |
| `mulk` | OS default | high | notification |
| `khatmah` | OS default | high | notification |
| `general` | OS default | high | notification (test push + fallback) |

### 5.2 Create / clean up

```dart
AndroidNotificationChannel _channel(String id, String name, {String? raw, bool vib = true,
    Importance imp = Importance.high, bool alarm = false, bool silent = false}) =>
  AndroidNotificationChannel(
    id, name,
    importance: imp,
    playSound: !silent,
    sound: (silent || raw == null || raw == 'default') ? null : RawResourceAndroidNotificationSound(raw),
    enableVibration: vib,
    audioAttributesUsage: alarm ? AudioAttributesUsage.alarm : AudioAttributesUsage.notification,
  );

Future<void> syncChannels(AzanPrefs p) async {
  final vib = p.vibrationEnabled;
  final wanted = <AndroidNotificationChannel>[
    _channel('general', 'General'),
    _channel('salawat', 'Salawat', raw: 'salli_ala_muhammad', imp: Importance.defaultImportance),
    _channel('mulk', 'Surat Al-Mulk'),
    _channel('khatmah', 'Khatmah'),
    _channel('duha', 'Duha prayer', raw: 'sc_event_duha'),
    _channel('qiyam', 'Qiyam prayer', raw: 'sc_event_qiyam'),
    _channel(azanChannelId(p.azanSoundId, soundEnabled: p.soundEnabled, vibrationEnabled: vib),
        'Azan', raw: p.azanSoundId, vib: vib, imp: Importance.max, alarm: true, silent: !p.soundEnabled),
    // one near_* channel per distinct pre-reminder sound (auto = up to 6 different clips)
    for (final s in p.distinctNearSounds()) // e.g. {sc_near_fajr, ..., sc_near_jumuah} or {soft_chime} or {null}
      _channel(nearChannelId(s, vibrationEnabled: vib), 'Pre-prayer reminder',
          raw: s, vib: vib, silent: s == null),
  ];
  for (final c in wanted) { await android!.createNotificationChannel(c); }

  // Remove stale per-sound channels + legacy fixed ones from older builds.
  final keep = wanted.map((c) => c.id).toSet();
  for (final c in await android!.getNotificationChannels() ?? const []) {
    final stale = (c.id.startsWith('azan_') || c.id.startsWith('near_')) && !keep.contains(c.id);
    if (stale || c.id == 'azan' || c.id == 'near_prayer') await android.deleteNotificationChannel(c.id);
  }
}
```

Channel names are shown to the user in Android settings — pass them through your l10n.

Call `syncChannels` on app start **and** whenever azan prefs change — FCM backups arriving while the app is closed need the channel to already exist.

---

## 6. Local scheduling (the heart of it)

### 6.1 Inputs

| Data | Endpoint |
|---|---|
| Azan prefs (voice, tone, pre minutes, prayer toggles, sound/vibration, method, madhab, `localScheduledUntil`) | `GET /profile/azan-preferences` |
| Duha `{enabled, time}` / Qiyam `{enabled, time}` | `GET /profile/duha-preferences`, `GET /profile/qiyam-preferences` |
| Prayer instants for a day | `GET /prayers/schedule?latitude=&longitude=&timezone=&date=YYYY-MM-DD&method=&madhab=` → `data.schedule[]` with `key`, `time`, **`iso`** |

Use the **same** lat/lng/timezone you `PUT /profile/location`, and the `calculationMethod` / `madhab` from azan prefs. Schedule with **`iso`** (absolute instant) — never rebuild from `time` + device zone. Cache each day's response; re-fetch when location/method/madhab changes.

### 6.2 Offline fallback (`adhan_dart`) — must match the server

```dart
params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
params.polarCircleResolution = PolarCircleResolution.aqrabBalad;
if (method == 'MAKKAH' && isRamadanUmmAlQura(date)) params.ishaInterval = 120;
```
Method id → adhan mapping is in `ADHAN_FEATURE_FINAL.md` §6. Prefer server `iso` whenever online.

### 6.3 What to schedule

For each day in the horizon, in order of `fireAt`:

| Item | `fireAt` | occurrenceKey (exact string) | Channel | iOS sound |
|---|---|---|---|---|
| Azan (each enabled prayer) | `iso` | `YYYY-MM-DD\|FAJR\|prayer_time` | `azanChannelId(...)` | `<azanSoundId>.caf` |
| Pre-reminder (if `preReminderEnabled` and `preReminderMinutes` > 0) | `iso − pre min` | `YYYY-MM-DD\|FAJR\|pre_reminder\|pre15` | `nearChannelId(sound)` | `<sound>.caf` |
| Duha (if enabled) | local `YYYY-MM-DD time` | `YYYY-MM-DD\|DUHA\|09:30` | `duha` | `sc_event_duha.caf` |
| Qiyam (if enabled) | local `YYYY-MM-DD time` | `YYYY-MM-DD\|QIYAM\|02:30` | `qiyam` | `sc_event_qiyam.caf` |

- `YYYY-MM-DD` = the **prayer's own local date** (Fajr 00:10 with a 15-min pre → the pre fires 23:55 the day before but keeps the Fajr date).
- Prayer keys: `FAJR DHUHR ASR MAGHRIB ISHA`. Skip anything with `fireAt <= now`.
- **Pre-reminder sound:** if `notificationSoundId == 'sc_near_auto'` → `sc_near_fajr|dhuhr|asr|maghrib|isha`, and **Friday Dhuhr → `sc_near_jumuah`**. `silent` or `soundEnabled == false` → no sound. Otherwise the tone id (`soft_chime` …).
- **Horizon:** Android 7 days. iOS: take items in time order until **60** (keep 4 slots free) — ≈5 days.
- **Notification id:** stable 31-bit hash of the occurrenceKey (same key ⇒ same id ⇒ replaces, never duplicates):

```dart
int notificationIdFor(String occurrenceKey) {
  var h = 0x811c9dc5;
  for (final b in utf8.encode(occurrenceKey)) { h ^= b; h = (h * 0x01000193) & 0xffffffff; }
  return h & 0x7fffffff;
}
```

**Copy** — keep these Arabic strings byte-for-byte identical to the server, so a backup push and a local notification look the same:

| Kind | titleAr | bodyAr |
|---|---|---|
| Pre | `اقترب موعد صلاة {name}` | `تذكير: اقترب موعد صلاة {name} بعد {n} دقيقة ({HH:mm})` — when n = 1: `بعد دقيقة` |
| Azan | `حان الآن موعد أذان {name}` | `حان الآن موعد أذان {name} ({HH:mm})` |
| Duha | `صلاة الضحى` | `حان الآن موعد صلاة الضحى` |
| Qiyam | `قيام الليل` | `حان الآن موعد صلاة قيام الليل` |

`{name}`: Fajr `الفجر`, Dhuhr `الظهر`, Asr `العصر`, Maghrib `المغرب`, Isha `العشاء` — **Friday Dhuhr = `الجمعة`** (Jumuah). `{HH:mm}` = the prayer time (24 h, as `schedule[].time`).

**Schedule one item:**

```dart
Future<void> scheduleItem(LocalItem it, AzanPrefs p, bool exactOk) async {
  final isAzan = it.kind == 'prayer_time';
  final android = AndroidNotificationDetails(
    it.channelId, it.channelName,
    importance: isAzan ? Importance.max : Importance.high,
    priority: Priority.high,
    category: isAzan ? AndroidNotificationCategory.alarm : AndroidNotificationCategory.reminder,
    visibility: NotificationVisibility.public,
    playSound: it.rawSound != null,
    sound: it.rawSound == null || it.rawSound == 'default' ? null : RawResourceAndroidNotificationSound(it.rawSound!),
    enableVibration: p.vibrationEnabled,
    audioAttributesUsage: isAzan ? AudioAttributesUsage.alarm : AudioAttributesUsage.notification,
    tag: it.occurrenceKey,
    actions: isAzan
        ? [AndroidNotificationAction('stop_azan', l10n.stopAzan, cancelNotification: true)]
        : null,
  );
  final ios = DarwinNotificationDetails(
    presentAlert: true, presentBanner: true, presentList: true,
    presentSound: it.rawSound != null,
    sound: it.rawSound == null ? null : (it.rawSound == 'default' ? null : '${it.rawSound}.caf'),
    interruptionLevel: (isAzan || it.kind == 'pre_reminder')
        ? InterruptionLevel.timeSensitive : InterruptionLevel.active,
    threadIdentifier: it.type, // AZAN / DUHA / QIYAM
  );
  await fln.zonedSchedule(
    notificationIdFor(it.occurrenceKey), it.titleAr, it.bodyAr,
    tz.TZDateTime.from(it.fireAt.toUtc(), tz.UTC),
    NotificationDetails(android: android, iOS: ios),
    androidScheduleMode: exactOk
        ? AndroidScheduleMode.exactAllowWhileIdle
        : AndroidScheduleMode.inexactAllowWhileIdle,
    payload: jsonEncode({'type': it.type, 'kind': it.kind, 'occurrenceKey': it.occurrenceKey,
                         'deepLink': it.deepLink}),
  );
}
```

The "Stop Azan" action cancels the notification, which stops the Azan sound immediately.

### 6.4 Tell the server what you covered (no duplicates, no gaps)

After every (re)schedule:

```dart
final trusted = health.notifOk &&
    (!Platform.isAndroid || (health.exactOk && (health.batteryOk || !isAggressiveOem)));
final until = (trusted && scheduled.isNotEmpty)
    ? scheduled.map((i) => i.fireAt).reduce((a, b) => a.isAfter(b) ? a : b)
    : null;

await api.patch('/profile/azan-preferences', {
  'localScheduledUntil': until?.toUtc().toIso8601String(), // null = "server, please back me up"
});
```

Server rule: an Azan / pre / Duha / Qiyam occurrence whose fire moment is **≤ `localScheduledUntil`** is **not** sent by FCM. After that instant (user didn't open the app for days, permission revoked…) the server backup resumes automatically. Values more than 16 days ahead are capped by the server.
Only PATCH when the value actually changes (or flips to/from `null`).

`fcmPrayerBackupEnabled` still exists: `false` disables the Azan/pre backup entirely. Leave it `true`; `localScheduledUntil` is the right tool.

### 6.5 When to reschedule

`cancelAllPendingNotifications()` → `syncChannels()` → schedule → PATCH `localScheduledUntil`, on:

1. App start and **every resume** (permissions may have changed; Android revokes all exact alarms when the user turns "Alarms & reminders" off).
2. Any change to azan / duha / qiyam prefs, location, method, madhab.
3. Device timezone change (`flutter_timezone` on resume) and date change.
4. Periodic background task every ~6 h:
   `Workmanager().registerPeriodicTask('noor.reschedule', 'reschedule', frequency: const Duration(hours: 6))` — in the callback init `tz` + FLN, use **cached** prefs/times (or `adhan_dart`), schedule, PATCH if a token exists.
5. **Any FCM backup received** (`source == FCM_BACKUP`) in `onMessage` / background handler — it means local coverage ran out; reschedule.
6. Reboot / app update: handled by `ScheduledNotificationBootReceiver`.

On logout: `cancelAll()`, `DELETE /devices/fcm-token`, and PATCH `localScheduledUntil: null` **before** dropping the auth token.

---

## 7. FCM

### 7.1 Token

```dart
await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
if (Platform.isIOS) {
  // FCM token is null until APNs gives a device token.
  for (var i = 0; i < 10 && await FirebaseMessaging.instance.getAPNSToken() == null; i++) {
    await Future.delayed(const Duration(milliseconds: 500));
  }
  await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: false, badge: false, sound: false); // we show foreground pushes ourselves (§7.3)
}
Future<void> register(String t) => api.post('/devices/fcm-token', {
  'token': t, 'platform': Platform.isIOS ? 'ios' : 'android',
  'appVersion': packageInfo.version, 'locale': 'ar',
});
final t = await FirebaseMessaging.instance.getToken();
if (t != null) await register(t);
FirebaseMessaging.instance.onTokenRefresh.listen(register);
```

Register after every login and on every app start (idempotent).

### 7.2 App in background / killed

The OS displays the push itself using `android.notification.channelId` + `sound` and APNs `aps.sound` (`<name>.caf`). Nothing to draw — but the channels (§5) and sound files (§3) **must** exist. Register a background handler only to reschedule:

```dart
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage m) async {
  if (m.data['source'] == 'FCM_BACKUP') await rescheduleFromCache();
}
FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
```

### 7.3 App in foreground — show it yourself, deduped

```dart
FirebaseMessaging.onMessage.listen((m) async {
  final d = m.data;
  final key = d['occurrenceKey'];
  final id = key != null ? notificationIdFor(key) : m.hashCode & 0x7fffffff;
  final active = await fln.getActiveNotifications();
  if (key != null && active.any((n) => n.id == id || n.tag == key)) return; // local already showing

  final raw = d['nativeSound'] ?? _rawFor(d); // see table below
  await fln.show(id, d['titleAr'] ?? m.notification?.title, d['bodyAr'] ?? m.notification?.body,
    NotificationDetails(
      android: AndroidNotificationDetails(d['androidChannelId'] ?? 'general', 'Noor',
        importance: Importance.high, priority: Priority.high, tag: key,
        playSound: raw != null,
        sound: raw == null || raw == 'default' ? null : RawResourceAndroidNotificationSound(raw)),
      iOS: DarwinNotificationDetails(presentAlert: true, presentBanner: true, presentSound: raw != null,
        sound: raw == null || raw == 'default' ? null : '$raw.caf'),
    ),
    payload: jsonEncode(d));
  if (d['source'] == 'FCM_BACKUP') unawaited(rescheduleFromCache());
});
```

### 7.4 What each push contains

Common data keys: `type`, `eventType`, `kind`, `occurrenceKey`, `dedupeKey`, `androidChannelId`, `source` (`FCM_BACKUP`), `timezone`, `titleAr`, `bodyAr`, `titleEn`, `bodyEn`.

| `type` / `kind` | `androidChannelId` | Sound (Android raw / iOS `.caf`) | Extra keys | Tap → |
|---|---|---|---|---|
| `AZAN` / `prayer_time` | `azan_<soundId>` | `<azanSoundId>` | `prayer`, `key`, `date`, `time`, `azanSoundId`, `azanSoundUrl`, `azanSoundDurationSeconds` | `/prayer-times` + play full Azan |
| `AZAN` / `pre_reminder` | `near_<sound>` | `sc_near_*` or tone | `preReminderMinutes`, `nearPrayerLocalTime`, `notificationSoundId` | `/prayer-times` |
| `DUHA` / `duha_reminder` | `duha` | `sc_event_duha` | `dayKey`, `reminderTime`, `audioUrl` | `/prayers/duha` |
| `QIYAM` / `qiyam_reminder` | `qiyam` | `sc_event_qiyam` | `dayKey`, `reminderTime`, `audioUrl` | `/prayers/qiyam` |
| `SALAWAT` | `salawat` | `salli_ala_muhammad` | `audioClipId`, `audioUrl` | salawat screen |
| `MULK` | `mulk` | default | `surahId=67`, `deepLink=/quran/surah/67` | `/quran/surah/67` |
| `KHATMAH` | `khatmah` | default | `deepLink=/quran/khatmah`, `pagesTarget`, `pagesReadToday` | `/quran/khatmah` |
| `TEST` | whatever you sent (default `general`) | whatever you sent | — | — |

`soundEnabled == 'false'` → silent channel/no sound. `eventType == 'JUMUAH'` → Friday Dhuhr Azan.

TTL: an undelivered Azan push expires after 15 min, a pre-reminder at prayer time, Duha/Qiyam/Mulk/Khatmah after 1 h, Salawat after 30 min — a phone that was offline never gets a stale "it's time now" hours later.

### 7.5 Taps (all three entry points)

```dart
final launch = await fln.getNotificationAppLaunchDetails();     // local, cold start
final initial = await FirebaseMessaging.instance.getInitialMessage(); // FCM, cold start
FirebaseMessaging.onMessageOpenedApp.listen(_openFromData);     // FCM, background
// + onDidReceiveNotificationResponse in fln.initialize(...) for local taps / 'stop_azan'
```
Route with `deepLink` (or the table above). For `prayer_time` open `/prayer-times` and start the full Azan (§8).

---

## 8. Full Azan in the app

- Android: the channel already plays the **whole** Azan file from `res/raw`; the "Stop Azan" action stops it.
- iOS: the tray plays the 30 s clip. When the user taps the notification (or opens the app within a few minutes of the Azan), play the full file with `just_audio`:
  - Local copy: download `azanSoundUrl` (`/azan/media/<soundId>.mp3`) once into the app documents dir when the user picks a voice; play from file (no network at Azan time).
  - Audio session: `AVAudioSessionCategory.playback` so it plays with the screen locked.
- Previews in settings use the same URLs (`GET /azan/sounds`, `GET /azan/notification-sounds`, `GET /salawat/audio` → `audioUrl` / `previewUrl`).

---

## 9. Preferences API (unchanged, plus one field)

| Endpoint | Fields that affect notifications |
|---|---|
| `GET/PATCH /profile/azan-preferences` | `azanEnabled`, `soundEnabled`, `vibrationEnabled`, `azanSoundId` (alias `voiceId`), `notificationSoundId` (`sc_near_auto`, `silent`, tone id), `preReminderEnabled`, `preReminderMinutes` 0–120 (aliases `reminderMinutes`, `prePrayerReminderMinutes`), `prayers{fajr..isha}`, `calculationMethod`, `madhab`, `fcmPrayerBackupEnabled`, **`localScheduledUntil`** (ISO-8601 with offset, or `null`) |
| `GET/PATCH /profile/duha-preferences` | `enabled`, `time` (HH:mm) |
| `GET/PATCH /profile/qiyam-preferences` | `enabled`, `time` (HH:mm) |
| `GET/PATCH /profile/salawat-preferences` | `enabled`, `intervalMinutes` (30/60/120/180), `startTime`, `endTime`, `audioClipId` |
| `GET/PATCH /profile/mulk-preferences` | `enabled`, `time` |
| `GET/PATCH /profile/khatmah-reminder-preferences` | `enabled`, `time` |
| `PUT /profile/location` | `latitude`, `longitude`, `timezone` — send the **device IANA zone** (`flutter_timezone`) |

After any PATCH to azan / duha / qiyam / location → reschedule (§6.5). Salawat / Mulk / Khatmah need nothing locally.

---

## 10. Test checklist (do all before release)

**Server → device, each channel and sound** (`POST /devices/test-push`, Bearer token):

```bash
curl -X POST "$BASE/devices/test-push" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Azan test","body":"Nasser Al-Qatami voice","androidChannelId":"azan_nasser_al_qatami","nativeSound":"nasser_al_qatami"}'
# repeat with: near_sc_near_fajr/sc_near_fajr, near_soft_chime/soft_chime, duha/sc_event_duha,
#              qiyam/sc_event_qiyam, salawat/salli_ala_muhammad, general/default
```
Response `data.sent` > 0 = FCM accepted it. Test with the app **killed**, **backgrounded**, and **open**.

**Local alarms**
- [ ] Set pre-reminder to 1–2 min, set a test prayer 3 min ahead → pre + Azan fire in the exact minute.
- [ ] Android Doze: `adb shell dumpsys deviceidle force-idle` then wait for the alarm → still fires.
- [ ] Pending alarms exist: `adb shell dumpsys alarm | grep <applicationId>`.
- [ ] Swipe app away from recents → still fires. Reboot → still fires.
- [ ] Turn "Alarms & reminders" off → on resume the app reschedules inexact and PATCHes `localScheduledUntil: null`; the server backup then arrives.
- [ ] Change the voice → a new `azan_<id>` channel appears, the old one is gone, the next Azan uses the new voice.
- [ ] `sc_near_auto` on a Friday → Dhuhr pre plays `sc_near_jumuah`, and the title uses Jumuah (`الجمعة`).
- [ ] Sound off / vibration off → `azan_silent` / `_novib` channels are used.
- [ ] iOS: `pendingNotificationRequests().length` ≤ 64; Azan plays the 30 s clip; Focus on → Azan still shows (Time Sensitive).
- [ ] Change the phone timezone → times shift correctly after resume.
- [ ] **No duplicates:** with the app scheduled, each reminder arrives exactly once. Check the GET response's `localScheduledUntil` is a few days ahead.
- [ ] **Backup works:** PATCH `localScheduledUntil: null`, cancel local notifications, wait for the next reminder → it arrives by FCM with the right sound.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Plays the default "ding" instead of the voice (Android) | Channel created earlier with another sound / file missing in `res/raw` / R8 removed it | New channel id (§5), check the basename, `keep.xml` |
| Default sound on iOS | File missing from the Runner target, is mp3, or is > 30 s | `.caf`, ≤ 30 s, check Copy Bundle Resources |
| Push lands in "Miscellaneous" | `androidChannelId` not created on this device | `syncChannels()` at startup and after pref changes |
| Duplicate notification | `localScheduledUntil` not PATCHed / stale, or showing FCM in foreground without the active-check | §6.4, §7.3 |
| Nothing after a few days (iOS) | 64 pending limit reached, user didn't open the app | Background task + PATCH `localScheduledUntil` (the server backs up after it) |
| Late on Xiaomi/Huawei/Oppo | OEM battery killer | OEM guide (§4.3); `trusted = false` until battery is unrestricted, so the server backs up |
| Nothing at all by FCM | No token registered / APNs key missing in Firebase | `GET /devices` lists the tokens; upload the `.p8` key |
| Azan cuts at 30 s (iOS) | iOS limit | Expected; full Azan plays in the app on tap (§8) |
