# Noor notification audio — audited Flutter/backend handoff

Audit date: 20 October 2026. Flutter checkout: `C:\Users\Mariam Khaled\Desktop\noor`, HEAD `7dd857e`, version `1.0.10+10`. Backend base HEAD `0d641cc`, plus the fixes described below. Scope: prayer notification sound, notification transport/ownership, adjacent reminder integration. This is not a certification of every feature in the app.

## 1. Outcome and ownership

The backend hosts the approaching-prayer and prayer-time announcement recordings. All 12 public media endpoints passed live HTTP Range checks (206, correct prefix bytes). All six approaching-prayer Android files in this Flutter checkout exactly match the backend files. The six prayer-time announcement recordings are missing from both Android raw resources and the iOS app bundle. This checkout deliberately lists no bundled prayer-time announcements, so local announcement mode falls back to the selected Adhan. A visible Arabic notification title does not itself speak that text.

Backend fixes are implemented locally and must be deployed. Flutter source was inspected, not edited. Flutter implementation and physical-device acceptance remain required. No real push was sent, no production-wide cron was triggered, and no users' settings were changed during this audit.

## 2. Backend fixes completed

Files: `src/lib/fcm.ts`, `src/services/azan-audio.service.ts`, `src/controllers/azan-audio.controller.ts`, `src/routes/azan.ts`, `scripts/test-fcm-audio-contract.ts`, `scripts/test-prayer-voice-catalog.ts`, `scripts/test-prayer-delivery.ts`, `package.json`.

1. The transport now includes the actual `nativeSound` and `androidChannelId` in FCM data, matching the Android/APNs envelope. Previously regular scheduler messages selected a native sound but did not consistently carry that basename in data; Flutter foreground code had to infer it. Existing keys and channel-ID formulas are retained.
2. `nativeSound: null` means silent: data contains `nativeSound: ""`, `soundEnabled: "false"`, and neither native platform envelope includes a sound. Undefined retains the existing OS-default behavior. Never interpret an empty basename as a raw resource or as a request to enable sound.
3. Token pruning now removes only definitively invalid/unregistered tokens. `messaging/invalid-argument` can describe a bad message payload, so it no longer deletes a potentially healthy device token.
4. Added transport-level regression tests and assertions on actual prayer-runner payloads: pre-prayer, prayer-time announcement, selected Adhan, silent, Android channel identity, APNs CAF naming, TTL and safe token classification. They use fake tokens/mocked delivery and do not send real messages.

5. Added public `GET /azan/prayer-voice-sounds` for spoken audio discovery, keeping `/azan/notification-sounds` as the existing generic-tone catalog. It returns the auto selector plus six approaching clips, six obligatory-prayer/Friday at-time clips, resolved media URLs/native basenames, file availability and `requiresNativeBundling: true`. Duha/Qiyam remain separate. This new endpoint is tested locally and is available in production only after deployment.

Deployment: normal source build/redeploy. No new environment variable, migration, table, service or cron is required for these audio fixes. Do not change the existing channel IDs on the server alone; old app versions must remain compatible.

## 3. Flutter changes required, in order

### P0 — bundle the six prayer-time announcement recordings

Evidence:

- `lib/features/azan/domain/prayer_notification_contract.dart:162`: `bundledPrayerEventBasenames = <String>[]`.
- `android/app/src/main/res/raw/`: no `sc_event_fajr`, `sc_event_dhuhr`, `sc_event_asr`, `sc_event_maghrib`, `sc_event_isha`, `sc_event_jumuah`.
- The corresponding `.caf` files and Xcode resource entries are also absent.
- `azan_settings_page.dart` currently tells users that announcement clips are not bundled.

Use the existing public endpoint, without sending backend credentials:

```text
https://noorapp-backend-production.up.railway.app/api/v1/azan/media/<basename>.mp3
```

Download the six `sc_event_*` files listed in section 8. Put the MP3s in `android/app/src/main/res/raw/` using exactly those lowercase filenames. Add the basenames, without extensions, to `bundledPrayerEventBasenames` only after bundling the actual files. Keep `sc_event_duha` and `sc_event_qiyam` separate from the five obligatory prayer slots. Friday uses the Dhuhr slot, selects `sc_event_jumuah`, and keeps the occurrence identity `...|DHUHR|prayer_time`.

For iOS, convert each short recording to an Apple-supported CAF encoding, add it to the Runner target and Copy Bundle Resources, and verify the built app contains the exact filename. Example conversion for a short source:

```sh
ffmpeg -i sc_event_asr.mp3 -ac 1 -ar 44100 -c:a adpcm_ima_qt sc_event_asr.caf
```

Verify every custom sound is strictly shorter than 30 seconds. Do not just rename MP3 to CAF. Existing 33 top-level CAF files passed a header-based duration check; this does not prove the final IPA contains them. The six new files still need conversion and bundle verification.

After bundling, update the settings subtitle and the test that currently expects announcement mode to fall back. Add successful announcement resolution assertions for all five prayers plus Friday. Retain a separate injectable missing-media fallback test.

### P0 — expose the spoken pre-prayer choice in settings

`azan_settings_page.dart:355` iterates only `state.notificationSounds.items`. That datasource calls `/azan/notification-sounds`, which deliberately contains generic tones plus silent. The existing default is `soft_chime`; do not promise a spoken phrase while this tone is selected.

Add `GET /azan/prayer-voice-sounds` to the datasource and cache it with its own key. Standard Noor success-envelope data shape:

```json
{
  "requiresNativeBundling": true,
  "nearPrayer": {
    "autoSelectionId": "sc_near_auto",
    "sounds": [{"id":"sc_near_auto","nativeSound":null,"mediaFile":null,"available":true}]
  },
  "prayerTime": {
    "preferenceValue": "announcement",
    "sounds": [{"id":"sc_event_asr","nativeSound":"sc_event_asr","mediaFile":"sc_event_asr.mp3","available":true}]
  }
}
```

The arrays above are abbreviated examples: actual counts are 7 and 6. Sound entries also contain the existing names, matching-prayer metadata, `audioUrl` and `previewUrl`. Server availability is not a claim that the current APK bundles a resource. Do not display raw English prayer identifiers as Arabic labels; use existing localized prayer names/matchesPrayer.

Offer separate pre-prayer choices: automatic spoken prayer-specific voice, generic notification tones, and silent. Save the deliberate auto choice as `notificationSoundId: "sc_near_auto"` via the existing PATCH `/profile/azan-preferences`; do not silently replace existing choices. Optionally offer individual spoken clips if their fixed-prayer behavior is clearly labeled. Keep at-time choice on `prayerTimeSoundMode: "azan" | "announcement"`, rather than saving a fixed Asr announcement as the universal pre-reminder sound.

For auto-mode preview, resolve a real clip (e.g. the next prayer's `sc_near_asr`) using the catalog; the selector itself has no file/preview URL. Combine or separate UI sections without changing the meaning of the generic-tone catalog. If the new endpoint is not yet deployed, retain cached/current choices and explain unavailability rather than resetting preferences.

### P0 — create native channels before token registration or scheduling

Evidence: `fcm_service.dart:209–259` bootstraps general/Salawat/daily channels, but not the configured prayer channels. `FcmService.start()` can register a token at line 1293 while the separate startup prayer scheduler is still running. `NoorApplication.onCreate()` currently initializes plugin contexts but creates no channels. Channel sync happens later in `AzanScheduler`.

Create one centralized channel bootstrap with a single-flight initialization future. Await it before registering/updating a device token, before publishing local coverage, before scheduling and before foreground display. Resolve the saved authenticated settings first when available, rather than publishing an unrelated default configuration. For upgraded installations with a retained token, consider native `Application.onCreate` bootstrap from validated cached settings; keep native and Dart channel definitions identical.

At minimum prepare the configured Adhan, every auto-selected near-prayer clip (including Friday), all bundled announcement clips, explicit silent variants and both vibration settings that can be used. Re-run bootstrap on sound/vibration/settings changes before their effects are considered ready. Do not wait for a notification to arrive to create its background OS channel. For remotely selected audio that is not bundled, do not register a raw-resource channel pointing to a nonexistent name.

Current shared formulas MUST stay byte-identical:

```text
azan_<soundId>             // sound ON, vibration ON
azan_<soundId>_novib       // sound ON, vibration OFF
azan_silent               // sound OFF, vibration ON
azan_silent_novib          // sound OFF, vibration OFF
near_<rawBasename>         // e.g. near_sc_near_asr
near_<rawBasename>_novib
near_silent
near_silent_novib
```

For example an audible Asr announcement uses `azan_sc_event_asr`, not `near_sc_event_asr`. An approaching-Asr voice uses `near_sc_near_asr`. A sentinel such as `sc_near_auto` is a selector, never a sound file.

### P1 — correct silent/default/custom channel semantics

Evidence: `notification_channel_sync.dart:121` calculates `playSound = !silent && raw != null && raw != 'default'`. Consequently its `general` channel is created silent, while the FCM bootstrap creates `general` using default sound. The first creation wins, so startup order can change general/test behavior. An explicit `default` sound is also incorrectly treated as silent by this helper.

Use three explicit states in the centralized factory:

```dart
final audible = !silent; // caller explicitly chooses silent vs audible
final custom = audible && raw != null && raw.isNotEmpty && raw != 'default';
// AndroidNotificationChannel:
// playSound: audible,
// sound: custom ? RawResourceAndroidNotificationSound(raw!) : null,
```

Callers must explicitly request silence for intended silent channels (Mulk/Khatmah/continuity/Kahf/Adhkar-silent). A null custom sound with `playSound: true` means system default. Preserve appropriate category, importance, usage and vibration consistently across creation paths; use notification audio usage for short pre-reminders and alarm usage only where deliberately supported for prayer-time alerts.

Android does not let an app silently rewrite an existing channel's sound. Recreating the same ID does not repair an already-created silent or invalid channel. Inspect the actual channel on the affected phone. If the user has muted it, offer an explicit system-channel-settings shortcut. For an app-caused bad channel configuration, plan a coordinated, versioned migration with user awareness and server compatibility; do not globally rotate IDs to override deliberate user choices. Clear-data/reinstall is an acceptable controlled QA baseline, not a production repair instruction.

### P1 — honor sound OFF before accepting the incoming channel

Evidence: `_resolveFcmPrayerAndroidSound` (`fcm_service.dart:338–355`) returns a requested channel before the `!useSound` branch. An incoming audible channel can therefore survive a local mute decision. On Android 8+, setting `playSound: false` on an individual notification is not a reliable way to mute an already audible channel.

Resolve effective sound first. If OFF, immediately choose the matching silent channel and return no Android/iOS sound; ignore the incoming audible channel. Only then consider a validated requested audible channel. Require a known bundled basename or an explicitly prepared supported sound. Treat `nativeSound: ""` as silence, `default` as the OS tone, and other validated names as custom resources. Never use `null.caf`, `.caf`, `sc_near_auto`, an arbitrary URL, or an unknown raw ID.

For foreground rendering, use both the current local user preference and the payload's sound-enabled flag. For background OS-rendered notifications, the server preference must be synchronized before claiming the change is effective: Flutter cannot retrospectively mute a sound that the OS already played.

### P1 — enforce a single delivery owner before dispatch

Evidence: `AzanScheduler._install...` installs local notifications when notification and exact-alarm access are granted (`azan_scheduler.dart:368`) even if `health.trusted` is false. Coverage is then left null (`:430`). The backend is allowed to send notification-payload FCM backup. The foreground/background handler's later local-ownership checks cannot prevent the OS from already displaying/playing a background notification.

Implement one explicit, persisted ownership decision shared by scheduler, travel mode, foreground FCM and coverage sync. For this release, when selecting FCM ownership for an untrusted local setup, cancel those matching local occurrences before clearing local coverage; explain that fallback delivery needs connectivity. For LOCAL ownership, publish coverage only after all relevant occurrences and correct channels were successfully installed. Guest users have no authenticated server backup: show local permission limitations rather than claiming that cloud fallback will work for them.

Do not add a second `AudioPlayer`/`just_audio` playback over a sounding native notification channel. Do not replace this problem with data-only FCM as the sole offline/exact prayer delivery mechanism. Do not mirror an OS-rendered background notification with another local show call.

Coverage must mean complete coverage, not merely the maximum timestamp:

- `local_coverage_sync.dart:11` calls `raiseLocalScheduledUntil(coverage.latest)` from Duha/Qiyam schedules.
- That helper (`azan_scheduler.dart:476`) can extend the account's scalar coverage without proving that all intervening enabled prayer/pre-prayer occurrences exist. A lone Qiyam schedule must not suppress missing Fajr/Asr backups.
- Require successful, continuous installation of every enabled type covered by the shared scalar before extending it. If this cannot be proven, do not extend the scalar; select one consistent owner for the shared group. Do not claim one device's coverage guarantees another device's local delivery. Current backend coverage is account-level, not per-device. Per-device/per-kind coverage would require a separately versioned contract, not an undocumented client-only assumption.
- Travel has its own `/travel/local-coverage` owner. Preserve the existing travel schedule-key and timezone checks.

### P1 — read actual notification authorization on iOS

Evidence: the noninteractive iOS branch in `notif_permissions.dart` sets `notifOk = true` without querying system state. `NotifHealth.trusted` then trusts iOS and may allow coverage even after permission was revoked. Query `FirebaseMessaging.instance.getNotificationSettings()` (and available platform settings) on resume/startup; distinguish authorized, provisional, denied, alert-disabled and sound-disabled states. Revocation must invalidate delivery trust and update the UI. Do not repeatedly prompt after denial; provide a Settings action.

### P1 — integrate the new Adhkar reminders

This checkout has no references to `/profile/adhkar-reminder-preferences`, `ADHKAR_REMINDER` or `bedtimeEnabled` in `lib/` or `test/`. `resolveFcmNotificationType` and `FcmNotificationType.isSupported` do not accept the new event. Foreground presentation is globally disabled at the Firebase layer, so an unhandled Adhkar message is dropped in foreground. Existing FCM tap dispatch also lacks the new category route.

Implement the delivered `FLUTTER_ADHKAR_REMINDERS_HANDOFF_2026.md`:

- GET/PATCH `/profile/adhkar-reminder-preferences`, `expectedRevision`, partial saves, 409 reconciliation.
- Independent morning/evening/bedtime toggles, all OFF initially; defaults 07:00/17:00/22:00; sound OFF initially.
- Bootstrap `adhkar_reminders_silent_v1` (silent/no vibration) and `adhkar_reminders_default_v1` (default tone/no vibration) before token registration.
- Add ADHKAR_REMINDER type/event resolution, foreground renderer, expiry/occurrence dedupe and inbox handling.
- Normalize backend `/adhkar/MORNING`, `/adhkar/EVENING`, `/adhkar/BEFORE_SLEEP` into the existing `noorapp://adhkar/<KEY>` route and queue it until authentication/navigation are ready. The content endpoint is `/adhkar/categories/<KEY>`.
- Handle foreground local taps, background FCM taps and terminated cold starts. Never auto-complete a category on tap.
- Server-only scheduling: do not create a duplicate local schedule for these settings. Bedtime Adhkar remains distinct from Surah Al-Mulk.

### P2 — diagnostics and regression details

- `DevicesRemoteDataSource` accepts `appVersion`, but the inspected token-registration call only supplies locale. Send the release version/build to aid diagnosis. Keep registration on login and token rotation, and unregister the previous account's token on logout/account switch.
- Add a user-invoked sound test and readiness status: permission, configured sound, actual channel settings, schedule owner, saved timezone, last successful local installation, pending server save. Never expose raw tokens, keys or passwords in logs/support screens.
- The local backend Firebase configuration and Android app configuration reference the same project. Railway's live credential values were not inspected; do not confuse local configuration comparison with a production credential audit.
- Keep the existing resource keep rule, POST_NOTIFICATIONS permission, exact-alarm checks, boot/package/time-change rescheduling and single local notification initialization callback. Their existence alone is not a real-device pass.

## 4. Exact expected examples

With `soundEnabled: true`, `vibrationEnabled: true`, `preReminderEnabled: true`, `preReminderMinutes: 15`, `notificationSoundId: "sc_near_auto"`:

1. Fifteen minutes before Asr: PRE_PRAYER / NEAR_PRAYER, `sc_near_asr`, channel `near_sc_near_asr`, spoken approaching-Asr recording.
2. At Asr with `prayerTimeSoundMode: "announcement"`: PRAYER_AZAN / PRAYER_EVENT, `sc_event_asr`, channel `azan_sc_event_asr`, short spoken at-time recording.
3. At Asr with `prayerTimeSoundMode: "azan"`: PRAYER_AZAN / AZAN, selected Adhan ID and its `azan_<id>` channel.
4. Sound OFF: same logical event, silent channel, no extra audio playback.
5. Vibration OFF: corresponding `_novib` channel, no vibration.

The Arabic title alone never selects or synthesizes the spoken audio. Keep user-selected Adhan as the default mode; do not automatically opt existing users into announcements.

## 5. Controlled end-to-end test procedure

Use a dedicated consenting QA account/device. Do not trigger the production cron for all users. Register only the intended QA devices on that account. Prepare channels and verify the actual APK/IPA resources first.

The existing authenticated `POST /devices/test-push` tests the caller's registered devices and accepts `androidChannelId` and `nativeSound`. Example for approaching Asr:

```json
{
  "title": "Noor audio test",
  "body": "Approaching Asr recording",
  "androidChannelId": "near_sc_near_asr",
  "nativeSound": "sc_near_asr"
}
```

Repeat with `azan_sc_event_asr` / `sc_event_asr`, then with a bundled selected Adhan. This is a TEST message: it validates delivery/channel/audio, not all prayer scheduler logic. Run the real prayer flow separately using controlled fixtures/local scheduling on the QA device. The present test endpoint defaults invalid/omitted sound input to the OS tone; do not use a null test body to claim a silent test passed. Test actual silent prayer settings or a dedicated local silent notification instead.

Capture the OS/app version, channel ID, logical occurrence, timestamp, app state, selected owner, native sound ID and whether audio was heard. Do not record the actual FCM token in shared evidence. FCM `sent: 1` means accepted by the provider, not heard by a person.

On Android inspect Settings > Apps > Noor > Notifications > relevant channel, notification/alarm volume and DND. For engineering QA, `adb shell dumpsys notification --noredact` can expose private notification content: inspect locally and redact before sharing. Check the final release artifact (not just assets in the repository) for bundled raw files. Avoid uninstalling a real user's app to repair channels.

## 6. Release acceptance checklist

1. Fresh install and upgrade from the currently distributed build; real release APK/AAB and IPA contain required files. Verify announcement media digests against section 8 before conversion.
2. Five prayers + Friday Dhuhr, PRE and at-time; configured pre-minutes respected. Announcement and full-Adhan modes produce different intended sounds.
3. Foreground, background, locked screen and normally terminated state: exactly one audible event per logical occurrence. Android force-stop and iOS user force-quit/platform restrictions are separate states; never promise unconditional delivery.
4. Sound ON/OFF, vibration ON/OFF, system-muted channel, DND/Focus, low volume and denied/revoked notification permission. User choices remain respected.
5. Trusted LOCAL owner: coverage published only after complete installation; no FCM duplication. FCM owner: matching local events cancelled, coverage cleared, one cloud notification. Permission loss/failure does not leave stale claims of working coverage.
6. Network loss, process restart, reboot, package update, time/timezone change and travel: reschedule safely, no old/prior-location/expired event replay. Stop action behaves correctly without starting a second player.
7. Duha/Qiyam cannot extend scalar coverage across missing prayer occurrences. Test partial local installation, failed schedules and multiple account devices explicitly.
8. Foreground silent handling wins over an incoming audible channel; malformed/unknown raw IDs cannot create invalid channels. Existing user-muted channels are not silently bypassed.
9. Adhkar morning/evening/BEFORE_SLEEP settings, sound channels, completion suppression, expiry, foreground delivery and all tap/cold-start routes pass. No second local Adhkar scheduler.
10. Logout/account switch/token rotation: old account does not receive the new account's private reminder; settings and dedupe stores remain account scoped.
11. iOS CAF names resolve in the built Runner bundle, sounds are under 30 seconds, actual authorization is read on resume and the configured native notification plays without relying on background Dart audio playback.
12. Attach real-device evidence and affected-channel inspection before marking audio fixed. Automated backend tests alone cannot certify this checklist.

## 7. Automated checks and limitations

Passed backend commands: `npm run test:near-prayer` (includes the new `test:fcm-contract`), `npm run typecheck`, `npm run build`, `npm run test:adhkar-reminders`, `npm run test:salawat`, `npm run test:production-fixes`.

The new tests exercise the actual transport builder used by `sendFcmToTokens`; prayer tests exercise runner-produced payloads with mocked DB/delivery. The spoken-catalog test verifies the public guest HTTP route, native basenames, file availability and continued separation of the generic-tone catalog. No real Firebase send was performed. Live media checks verified all 12 endpoints. This is not a live production push-credential or scheduler-execution test.

Flutter/Dart/ADB were not available on PATH in this audit environment. No Flutter build, Flutter test suite, emulator or physical-device test is claimed. Required developer commands after implementation include `flutter analyze`, focused notification/azan/coverage tests, `flutter build appbundle --release`, and a release iOS build on macOS. Update `test/features/azan/prayer_notification_contract_test.dart` because its current announcement fallback expectation reflects the empty bundle list.

## 8. Verified media manifest

Every URL below is the existing public backend `/api/v1/azan/media/<file>` endpoint. A companion evidence JSON contains size, SHA-256, resource presence, Range results and existing CAF duration observations. Exact asset entries follow below.

- **sc_near_fajr** — 48525 bytes; Android/iOS bundled: True/True.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_fajr.mp3
  - SHA-256: `1aa67dfd4311926708f5dfbbb0e51ad418ef2ad1f7bd566a19e99c7cbb179ce1`
- **sc_near_dhuhr** — 55725 bytes; Android/iOS bundled: True/True.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_dhuhr.mp3
  - SHA-256: `6118975cae02cce65e992c98f81b1779dadf0721e32b1790e1bba23cb583ca7d`
- **sc_near_asr** — 59085 bytes; Android/iOS bundled: True/True.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_asr.mp3
  - SHA-256: `be84e9aa8d677cc1af75d22d73c56f30232ec85bc755ebf3170868d6f1033565`
- **sc_near_maghrib** — 60045 bytes; Android/iOS bundled: True/True.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_maghrib.mp3
  - SHA-256: `45baa9f16f90a422c5e060143597847901e37b911a7cfedae9e4befd1b41e4b6`
- **sc_near_isha** — 61965 bytes; Android/iOS bundled: True/True.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_isha.mp3
  - SHA-256: `dde5e9a6007a8045e8c5af6acee88ca601e49edd8777024e5df3b7429bb17937`
- **sc_near_jumuah** — 58125 bytes; Android/iOS bundled: True/True.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_near_jumuah.mp3
  - SHA-256: `10b70ccdb21274904076617e02aa30af74675b65b4273de50c90b80ea8ce800b`
- **sc_event_fajr** — 69645 bytes; Android/iOS bundled: False/False.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_event_fajr.mp3
  - SHA-256: `655f71c8b26b280a396369bc811e4362b47cbb72dfca8ddab27a470fdbe53873`
- **sc_event_dhuhr** — 69645 bytes; Android/iOS bundled: False/False.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_event_dhuhr.mp3
  - SHA-256: `6759944ea31e62cf770231145afa3857221bf979f240d99d542e3b5ccfe2e471`
- **sc_event_asr** — 72525 bytes; Android/iOS bundled: False/False.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_event_asr.mp3
  - SHA-256: `7a3b7fd97870c2db08232628ca78d726dcc424e75456f69500c7f13dfa4ccbc8`
- **sc_event_maghrib** — 69165 bytes; Android/iOS bundled: False/False.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_event_maghrib.mp3
  - SHA-256: `afc887eaef998812093d4dfa2b3cb810362e662c7d5871d2a1328be4ccdfaa7c`
- **sc_event_isha** — 69165 bytes; Android/iOS bundled: False/False.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_event_isha.mp3
  - SHA-256: `60d83dfcb711d31f33b0a5c43ca30e6b6aa3888de8ee2f2e60d2ebf0d64363d6`
- **sc_event_jumuah** — 69645 bytes; Android/iOS bundled: False/False.
  - Download: https://noorapp-backend-production.up.railway.app/api/v1/azan/media/sc_event_jumuah.mp3
  - SHA-256: `a90b63b37787ef9c387811e717ea027fac0179787de2329f2e7a34b1dc821c48`

## 9. Official platform references

- Android channel auditory behavior is fixed after first creation; user channel settings must be respected: [Android notification channels](https://developer.android.com/develop/ui/compose/notifications/channels)
- Android FCM background notification/data delivery: [FCM Android delivery](https://firebase.google.com/docs/cloud-messaging/android/receive-messages)
- Flutter foreground/background notification handling: [FCM Flutter delivery](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages)
- Apple custom sound formats, app-bundle requirements and duration limit: [Apple notification sounds](https://developer.apple.com/documentation/usernotifications/unnotificationsound)
- INVALID_ARGUMENT can describe payload errors, not just invalid registration: [FCM token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens)

Implement the Flutter items above, deploy the backend transport fixes, then complete physical-device acceptance. This handoff does not claim that unimplemented client work or future OS/network conditions are already 100% verified.
