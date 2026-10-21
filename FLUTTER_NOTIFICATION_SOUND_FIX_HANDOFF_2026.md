# Noor — Notification sound & delivery fix (Flutter handoff)

Backend → Flutter handoff — 20 October 2026. Channel schema version: **2**.

## Summary

Notification sound fails for two main reasons, both in the Flutter code, not the backend:

1. **The `general`, `mulk` and `khatmah` channels were created silent** (`playSound: false`). Android locks a channel's sound the first time it is created, and re-creating a deleted channel with the same id restores its old silent settings. Fix: new channels `general_v2`, `mulk_v2` and `khatmah_v2` with sound. The backend already sends to them for any device that declares schema 2.
2. **The backend sends a type and sounds Flutter is not ready for**: `ADHKAR_REMINDER` is not supported at all, and the prayer-time announcement sounds `sc_event_fajr…jumuah` are not in the app.

The backend now has an endpoint returning every required channel and sound (`GET /devices/notification-channels`), accepts device capabilities with the FCM token, and will never again target a sound the device does not have. Flutter's work is in sections 2 to 9 below, in order.

---

## 1. Root causes (verified in the Flutter source)

| # | Severity | Problem | Where |
| --- | --- | --- | --- |
| 1 | P0 | `general`, `mulk`, `khatmah` channels are created with `playSound: false`. Backend sends `nativeSound: "default"` (sound ON), so Mulk, Khatmah, test pushes and anything on the FCM fallback channel are silent. Android locks channel sound forever; re-creating a deleted id restores the old silent settings. | `lib/features/azan/data/notification_channel_sync.dart` → `_channel()` (`raw == null` ⇒ `playSound: false`) for `general`, `mulk`, `khatmah`; `lib/features/azan/data/fcm_service.dart` → `ensureFcmNotificationChannel()` loop over `DailyReminderKind` (`nativeSound: null` ⇒ `playSound: false`); `lib/features/reminders/data/daily_reminder_scheduler.dart` (`soundName` is null for Mulk/Khatmah ⇒ silent local notification on Android **and** iOS) |
| 2 | P0 | Two code paths create the same channel ids with different settings and race at startup (`AzanScheduler.ensureScheduled` vs `FcmService.start`, both fire-and-forget in `main.dart`). Whichever runs first wins forever. | `notification_channel_sync.dart` vs `fcm_service.dart` |
| 3 | P0 | FCM type `ADHKAR_REMINDER` (morning/evening/bedtime Adhkar) is not in `FcmNotificationType.isSupported`, so foreground messages are dropped, and channels `adhkar_reminders_default_v1` / `adhkar_reminders_silent_v1` are never created (background push lands on the fallback channel). | `fcm_service.dart` → `FcmNotificationType` |
| 4 | P0 | Prayer-time **announcement** mode: backend may target `azan_sc_event_<prayer>` with `sc_event_fajr/dhuhr/asr/maghrib/isha/jumuah`, but these clips are not in `res/raw` nor `ios/Runner`, and `bundledPrayerEventBasenames` is empty. Backend now falls back to the Azan unless the device declares the clips (section 4). | `prayer_notification_contract.dart` line `bundledPrayerEventBasenames = <String>[]` |
| 5 | P0 (iOS) | `RunnerRelease.entitlements` lacks `com.apple.developer.usernotifications.time-sensitive` (only the debug entitlements have it). Release builds cannot break through Focus / Scheduled Summary, so Azan can arrive silently. | `ios/Runner/RunnerRelease.entitlements` |
| 6 | P1 | Daily reminders schedule with `AndroidScheduleMode.exactAllowWhileIdle` unconditionally. On Android 14+ `SCHEDULE_EXACT_ALARM` is denied by default for new installs, so `zonedSchedule` throws and Duha/Qiyam/Mulk/Khatmah are never scheduled locally. | `daily_reminder_scheduler.dart` `_scheduleDay` |
| 7 | P1 | Azan uses `exactAllowWhileIdle`; in Doze it is throttled (≈ one alarm per 9 min per app), so pre-reminder + Azan close together can fire late. | `azan_scheduler.dart` `_scheduleItem` |
| 8 | P2 | Daily reminder local payload `kind` is `qiyam_reminder` for Mulk and Khatmah. | `daily_reminder_scheduler.dart` payload ternary |
| 9 | P2 | FCM token registration sends only `token` + `locale` — no `platform`, `appVersion` or capabilities, so the backend cannot tell what the device can play. | `fcm_service.dart` `_registerToken` |

Not a problem: all 9 Azan voices, 15 tones, 6 near-prayer clips, Salawat, Duha and Qiyam sounds that the backend uses are bundled on Android (`res/raw/*.mp3`) and iOS (`*.caf`, ≤ 30 s), and `res/raw/keep.xml` keeps them from resource shrinking.

## 2. Backend changes already live in source (deploy with migration)

- `GET /api/v1/devices/notification-channels` (public, `Cache-Control: public, max-age=3600`). Returns:
  - `channelSchemaVersion` (2), `defaultFcmChannelId` (`general_v2`), `legacyChannelIds` (`general`, `mulk`, `khatmah`),
  - `fcmTypes` — every `data.type` the backend sends: `AZAN, SALAWAT, MULK, DUHA, QIYAM, KHATMAH, KAHF, CONTINUITY, CHARITY_REMINDER, ADHKAR_REMINDER, TEST`,
  - `channels[]` — 89 channels: `{ id, group, nameEn, nameAr, nativeSound, iosSoundFile, importance, usage, vibration }`. `nativeSound: "default"` = OS default tone (**sound ON**); `null` = intentionally silent.
  - `requiredBundledSounds[]` — 39 basenames the app must ship.
- `POST /api/v1/devices/fcm-token` accepts an optional `capabilities` object (section 4) and stores it per device.
- Channel repair: for devices that declared `channelSchemaVersion >= 2`, the backend targets `general_v2`, `mulk_v2`, `khatmah_v2` instead of the silent legacy ids. Older app builds keep receiving the old ids (no regression). When a user has old and new devices, each group gets its own multicast.
- Announcement clips: sent only when **every** device of the user declared the clip in `bundledSounds`; otherwise the selected Azan voice is used with `data.audioFallbackReason = "ANNOUNCEMENT_NOT_BUNDLED_ON_DEVICE"`.

## 3. One channel sync, driven by the manifest

Replace both `NotificationChannelSync.sync` channel creation and `ensureFcmNotificationChannel` with a single `NoorChannels.sync()`:

1. Load the manifest: network (`GET /devices/notification-channels`), cached in SharedPreferences, with a bundled JSON copy in `assets/` as offline fallback (also needed in the background isolate).
2. Create **every** channel in `channels[]` (89 is cheap; it guarantees the channel exists even if the server changes the user's voice before the app next opens):

```dart
AndroidNotificationChannel toChannel(Map<String, dynamic> c) {
  final sound = c['nativeSound'] as String?;          // null = silent, 'default' = OS tone
  final silent = sound == null;
  return AndroidNotificationChannel(
    c['id'] as String,
    isArabic ? c['nameAr'] as String : c['nameEn'] as String,
    importance: switch (c['importance']) {
      'max' => Importance.max,
      'high' => Importance.high,
      'low' => Importance.low,
      _ => Importance.defaultImportance,
    },
    playSound: !silent,                                // 'default' MUST be playSound: true
    sound: (silent || sound == 'default') ? null : RawResourceAndroidNotificationSound(sound),
    enableVibration: c['vibration'] == true,
    audioAttributesUsage: c['usage'] == 'alarm'
        ? AudioAttributesUsage.alarm
        : AudioAttributesUsage.notification,
  );
}
```

3. Delete each id in `legacyChannelIds` and the existing legacy list (`azan`, `near_prayer`, …). **Never re-create a deleted id.**
4. Await this sync once in `main.dart` (and at the top of the background handler) **before** `FcmService.start()` and `AzanScheduler.ensureScheduled()` — no more race.
5. `android/app/src/main/AndroidManifest.xml`: change `com.google.firebase.messaging.default_notification_channel_id` from `general` to `general_v2`.
6. Local code that hard-codes ids must use the new ones: `PrayerNotificationChannels.general/mulk/khatmah` → `general_v2/mulk_v2/khatmah_v2`; `DailyReminderKind.mulk/khatmah.channelId` → `mulk_v2/khatmah_v2`; keep `duha`, `qiyam`, `salawat` (they already have sound).
7. Mulk and Khatmah local notifications must play the default tone: `playSound: true`, `sound: null` on Android; `presentSound: true`, `sound: null` (default) on iOS. Today they are silent on both platforms.

## 4. Register device capabilities

After the channel sync succeeds, and on every app update / token refresh, send:

```json
POST /api/v1/devices/fcm-token
{
  "token": "<fcm token>",
  "platform": "android",
  "appVersion": "1.0.11+11",
  "locale": "ar",
  "capabilities": {
    "channelSchemaVersion": 2,
    "bundledSounds": ["abdul_basit", "ali_mulla", "…every raw basename actually bundled…"],
    "supportedTypes": ["AZAN", "SALAWAT", "MULK", "DUHA", "QIYAM", "KHATMAH", "KAHF", "CONTINUITY", "CHARITY_REMINDER", "ADHKAR_REMINDER", "TEST"],
    "notificationsEnabled": true,
    "exactAlarmsAllowed": true
  }
}
```

Rules: `bundledSounds` lists only files really shipped in **this** build (generate it from a constant that the build verifies). Basenames match `^[a-z0-9_]{1,64}$`. Declare `channelSchemaVersion: 2` only after section 3 is shipped, otherwise the server will target `_v2` channels that do not exist. Response includes `capabilitiesStored: true`.

## 5. Handle `ADHKAR_REMINDER`

- Add `ADHKAR_REMINDER` to `FcmNotificationType` and `isSupported`.
- Foreground: show a local notification on `data.androidChannelId` (`adhkar_reminders_default_v1` when `soundEnabled == "true"`, else `adhkar_reminders_silent_v1`), title/body from `titleAr/bodyAr`, tag = `occurrenceKey`, tap → `data.deepLink` (`/adhkar/MORNING|EVENING|BEFORE_SLEEP`).
- Background with `message.notification != null`: the OS already showed it — only mark handled (same pattern as Kahf/Continuity).
- Drop when `expiresAtUtc` has passed. Full contract: `FLUTTER_ADHKAR_REMINDERS_HANDOFF_2026.md`.
- Safety net: for any future unknown `data.type` that carries `message.notification`, show it on `general_v2` in the foreground instead of dropping it.

## 6. Bundle the prayer-time announcement clips

1. Copy `assets/prayer-events/sc_event_{fajr,dhuhr,asr,maghrib,isha,jumuah}.mp3` from the backend repo into `android/app/src/main/res/raw/`.
2. Convert each to iOS `.caf` (≤ 30 s), add to the Runner target (Copy Bundle Resources):
   `afconvert -f caff -d LEI16@44100 -c 1 sc_event_fajr.mp3 sc_event_fajr.caf`
3. Fill `PrayerNotificationContract.bundledPrayerEventBasenames` with the six ids and include them in `capabilities.bundledSounds`.
4. Until this ships, the backend automatically uses the Azan voice for those users — nothing breaks.

## 7. Exact timing (on time, every time)

- One helper: `final exactOk = await android.canScheduleExactNotifications() ?? false;` reused by Azan **and** daily reminders.
- Azan + pre-reminder: `exactOk ? AndroidScheduleMode.alarmClock : AndroidScheduleMode.inexactAllowWhileIdle`. `alarmClock` is exempt from Doze throttling (Play policy allows it with the user-granted `SCHEDULE_EXACT_ALARM` you already declare; do not add `USE_EXACT_ALARM`).
- Daily reminders: `exactOk ? exactAllowWhileIdle : inexactAllowWhileIdle`, wrapped in try/catch so one failure never cancels the whole horizon.
- When `exactOk == false`: show a one-time card explaining that the Adhan may be late, with a button to `NotifPermissions.requestExactAlarmFromUser()`; also offer the battery-optimisation guide on Xiaomi/Oppo/Vivo/Samsung (existing `oem_battery_guide.dart`).
- Report `exactAlarmsAllowed` and `notificationsEnabled` in capabilities so support can see it.

## 8. iOS

- Add to `ios/Runner/RunnerRelease.entitlements`:
  ```xml
  <key>com.apple.developer.usernotifications.time-sensitive</key>
  <true/>
  ```
  and enable the "Time Sensitive Notifications" capability for the App ID.
- Sounds are resolved by file name from the app bundle: keep one copy of each `.caf` (today they exist both in `ios/Runner/` and `ios/Runner/Sounds/`; make sure only one is in Copy Bundle Resources). `ios/Runner/azan.mp3` (2 MB) is longer than 30 s and cannot be a notification sound — remove it or trim it.

## 9. "Test sound" in settings

Add a "Test notification sound" button next to each sound picker:

```http
POST /api/v1/devices/test-push
Authorization: Bearer <accessToken>
{ "androidChannelId": "<the channel id this choice uses>", "nativeSound": "<basename>" }
```

It sends a real push through the exact channel/sound the reminders use, so users (and QA) can confirm audio end-to-end. With schema v2 the backend maps `general` → `general_v2` automatically.

## 10. Acceptance checklist (real devices)

Run each on Android 13, 14, 15 (Samsung + Xiaomi) and iOS 17/18:

- [ ] Fresh install → open once → `adb shell dumpsys notification | grep -A3 "mulk_v2"` shows a sound URI (not `null`).
- [ ] Upgrade from the current Play build → `general`, `mulk`, `khatmah` deleted; `_v2` channels present with sound.
- [ ] Azan with app in foreground, background, killed, and device in Doze (`adb shell dumpsys deviceidle force-idle`) → plays on time (±1 min) with the selected voice.
- [ ] Pre-prayer reminder with `sc_near_auto` plays the matching prayer clip; with a tone plays that tone; with `silent` is silent.
- [ ] Mulk, Khatmah, Duha, Qiyam, Salawat, Adhkar (morning/evening/bedtime), Charity: audible when sound is enabled.
- [ ] Sound OFF in app → every channel silent, vibration follows the toggle.
- [ ] Phone on silent / DND: Azan (alarm usage) behaviour matches product decision; iOS Focus: Azan breaks through (time-sensitive).
- [ ] Exact alarm denied → warning card shown; reminders still delivered (inexact) and backend FCM backup covers.
- [ ] `GET /devices` shows `capabilities.channelSchemaVersion = 2` and the full `bundledSounds` list.
