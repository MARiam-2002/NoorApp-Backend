# Noor: optional Fajr wake-up alarm

Backend implementation and Flutter/native integration contract — 18 October 2026.

## 1. Delivery status and ownership

Backend source includes private preference GET/PATCH, revision conflict protection, and a future UTC Fajr schedule. These are additive endpoints: existing Adhan, location, prayer progress, refresh tokens, reminders and Home contracts are unchanged.

The alarm itself MUST run on the device. The backend does not ring a phone, send an FCM wake-up message, generate dismissal questions, or verify that someone has prayed. This handoff is an implementation specification, not a claim that Flutter/native behavior has already been delivered or certified on phones.

Feature name: **منبّه الاستيقاظ للفجر** / **Fajr wake-up alarm**.
Place it in Adhan settings as a separate optional card. Default OFF. Keep regular Fajr Adhan available independently.

Product behavior on supported Android devices: locally scheduled alarm, locally bundled sound loop, simple math challenge to stop, optional limited snooze, visible emergency stop and automatic timeout. Never promise an unstoppable alarm. System Stop, force-stop, powered-off devices and OS restrictions remain effective.

iOS: use AlarmKit on supported iOS 26+ devices with user authorization. The system Stop control remains available. A math challenge may be offered after opening Noor but cannot be a mandatory prerequisite for the system's Stop action. On older versions, expose a clearly labelled notification fallback; do not describe it as the same persistent wake-up alarm.

## 2. Deploy the backend first

1. Upload the modified backend source using the normal Git deployment.
2. Apply `prisma migrate deploy` through the existing deployment migration step. New migration: `20261018140000_fajr_wakeup_alarm`.
3. Generate Prisma client as in the normal install/build process.
4. Confirm deployment health and all three new authenticated routes below.
5. No new Railway environment variables, provider subscription, cron service or FCM topic is needed for this feature. Ordinary database/API usage remains metered.

New table: `fajr_alarm_preferences`, one row per account with cascading account deletion. A GET with no saved row returns defaults without creating a row. The migration is additive and does not rewrite Adhan settings or user data.

This source change has not itself published a new Railway deployment. A successful previous deployment does not include these routes until the new source is uploaded.

## 3. API basics

Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`.

The three personal settings/schedule routes require `Authorization: Bearer <accessToken>`, use the standard Noor success/error envelope, and return `Cache-Control: private, no-store`. The two sound catalog/media routes below are public and cacheable. Never send a userId: ownership comes from the access token.

On 401 follow the existing serialized refresh-token flow. A network error, 409, 5xx or timeout must not clear the session. Ringing and dismissal must never wait for authentication or an API request.

### GET `/profile/fajr-alarm-preferences`

The relevant `data` object on a new account:

```json
{
  "preferences": {
    "enabled": false,
    "beforeFajrMinutes": 0,
    "weekdays": [1, 2, 3, 4, 5, 6, 7],
    "dismissalMode": "math",
    "difficulty": "easy",
    "questionCount": 2,
    "snoozeEnabled": true,
    "snoozeMinutes": 5,
    "maxSnoozes": 1,
    "maxRingMinutes": 10,
    "gradualVolumeEnabled": true,
    "vibrationEnabled": true,
    "soundId": "system_alarm"
  },
  "revision": 0,
  "updatedAt": null,
  "policy": {
    "deliveryMode": "DEVICE_LOCAL",
    "cloudEnabledDoesNotArmDevice": true,
    "emergencyStopHoldSeconds": 5,
    "iosMathDismissalEnforceable": false,
    "awardsPrayerCompletion": false,
    "schemaVersion": 1
  }
}
```

Field rules:

- `enabled`: boolean, account preference/intent only. It does not prove that this device is armed.
- `beforeFajrMinutes`: integer 0–60. Zero means at Fajr; do not add an independent fixed clock time.
- `weekdays`: unique ISO weekdays, Monday=1 through Sunday=7, at least one day. Applies to the Fajr date, even if subtracting the offset crosses midnight.
- `dismissalMode`: `math` or `button`. Always retain emergency/system escape regardless of mode.
- `difficulty`: `easy` or `medium`; `questionCount`: integer 1–5.
- `snoozeEnabled`: boolean; `snoozeMinutes`: integer 1–15; `maxSnoozes`: integer 0–3. Hidden/disabled fields retain their values; zero means no snoozes.
- `maxRingMinutes`: integer 1–15; total audible ringing budget per occurrence, including challenge screens and subsequent snooze cycles.
- `gradualVolumeEnabled`: ramp the app player gain, not the system volume setting.
- `vibrationEnabled`: boolean, subject to device settings.
- `soundId`: `system_alarm` or `fajr_wakeup_voice_v1`. Missing or unusable custom asset falls back to the OS alarm sound.

### PATCH `/profile/fajr-alarm-preferences`

Only send edited fields with the revision last read:

```json
{
  "expectedRevision": 0,
  "preferences": {
    "enabled": true,
    "beforeFajrMinutes": 10,
    "soundId": "fajr_wakeup_voice_v1"
  }
}
```

Returns the full settings object with revision 1. A later one-field edit preserves all other fields. Empty patches, unknown fields, string booleans, invalid days/ranges and unsupported sounds are rejected. No generic arbitrary audio URL is accepted.

Stale `expectedRevision` returns HTTP 409 (`CONFLICT`). Fetch current settings and reconcile. Do not automatically overwrite the newer cloud state. A response lost after a successful PATCH can also produce 409 on retry: GET and compare the intended fields before offering a retry. Each successful PATCH increments revision, including a same-value PATCH.

The backend serializes changes using an owner-row lock, including the first insert. Only the authenticated account is edited.

For an explicit local OFF action, cancel this device immediately, even offline; queue a deliberate disable sync separately. Do not let a failed network request keep an unwanted alarm armed. For ON, require a successful settings/schedule fetch and permission verification before displaying a confirmed armed state. Keep pending unsynced changes distinct from server state.

### GET `/fajr-alarm/schedule?days=7`

`days` defaults to 7 and accepts integers 1–14. It covers that many Fajr calendar dates starting today in the resolved location timezone, not that many future occurrences and not N periods of 24 hours. After today's alarm has passed, a seven-day response can contain only six future occurrences. Request 14 days for a larger native offline scheduling horizon, subject to OS pending-alarm limits.

Response `data` includes the settings/revision/policy, plus:

```json
{
  "status": "READY",
  "timezone": "Africa/Cairo",
  "calculationIsEstimate": true,
  "serverTime": "2026-10-18T00:00:00.000Z",
  "refreshAfterUtc": "2026-10-18T06:00:00.000Z",
  "scheduleKey": "<64-character SHA-256 fingerprint>",
  "windowStartFajrLocalDate": "2026-10-18",
  "windowEndFajrLocalDate": "2026-10-24",
  "calculationMethod": "<effective existing prayer method>",
  "madhab": "SHAFI",
  "occurrences": [
    {
      "occurrenceKey": "FAJR_WAKE|2026-10-18",
      "fajrLocalDate": "2026-10-18",
      "alarmLocalDate": "2026-10-18",
      "fajrAtUtc": "<ISO UTC instant>",
      "alarmAtUtc": "<ISO UTC instant after subtracting offset>"
    }
  ],
  "unavailableDates": []
}
```

This illustrates the shape, not hardcoded Cairo prayer times. All actual timestamp fields contain valid ISO UTC strings. Calculate UI clock labels using the returned timezone and locale. Do not parse ISO dates through a device-default timezone or reverse Arabic digit strings.

Statuses:

- `DISABLED`: empty occurrences, null scheduleKey. Cancel pending wake-up alarms owned by this account on this device.
- `LOCATION_REQUIRED`: enabled intent but no valid saved account coordinates. Empty occurrences, null scheduleKey. Ask for a manual location or foreground GPS through existing location/travel APIs; no silent Cairo fallback and no automatic background tracking.
- `READY`: the requested calendar window was evaluated without missing eligible Fajr calculations. It does not guarantee at least one future occurrence or device readiness.
- `PARTIAL`: `unavailableDates` identifies eligible dates where no finite Fajr calculation could be obtained. Schedule only actual returned occurrences and show a warning.

Uses the same effective prayer method, madhab and timezone resolution as existing prayers. Existing high-latitude/polar approximation rules are preserved, and `calculationIsEstimate` is true. No invented midnight or alternate hidden Fajr algorithm is used. A legitimate finite high-latitude estimate is not automatically treated as unavailable.

The location/timezone/method/configuration fingerprint changes when scheduling inputs change. It is NOT an occurrence identity. Occurrence identity remains `FAJR_WAKE|<Fajr local date>`, scoped locally by account. Refreshing the same date with a newer revision must replace a pending occurrence, never create another independently ringing copy.

No past occurrences are returned. Never ring old cached occurrences immediately when opening the app. A daytime refresh does not re-arm today's completed/missed alarm. Do not silently extend the last known time beyond the returned calendar window.

## 4. Separate account sync from this-device activation

Persist device-local `ownerUserId`, `localActivationEnabled`, permission/capability state, schedule snapshot/fingerprint, native IDs, occurrence state and last successful scheduling timestamp. These do not belong in the shared preferences row.

Cloud `enabled=true` arriving from another phone, a reinstall or backup restoration must NOT automatically arm this device. Show **تفعيل على هذا الجهاز** and obtain explicit activation plus permissions. A cloud OFF cancels pending alarms when the device next receives/syncs that state; an offline second device cannot instantly learn a remote disable. Explain the device scope when necessary.

Refresh on foreground/resume when due, successful preference/location/method changes, clock/timezone changes, permission restoration and reboot when supported. `refreshAfterUtc` is a suggested fetch time, not a guarantee that the OS will run background work in six hours. A background sync job must not keep the backend/phone awake indefinitely.

Use a serialized local scheduler/reconciliation queue and a local settings generation number. Discard responses belonging to a previous user, previous requested location or superseded settings generation, even if they arrive last. Re-fetch after applying location changes instead of mixing an old schedule and new UI location.

Within one local transaction, persist desired snapshot, replace/cancel matching native entries, and record scheduling results. Recover incomplete reconciliation on next launch. If alarm replacement fails, do not display “ready”; either restore the previous coherent valid schedule or clearly disable the failed occurrence. Platform-specific ordering must prevent duplicate old/new native entries.

Logout/account switch/account deletion: cancel this account's pending wake-up and snooze alarms, stop its active player, remove challenge state and erase account-owned cached schedule. Do not cancel unrelated system alarms or another signed-in account's records.

## 5. Flutter UI and copy

Card: optional activation, next scheduled local time, before-Fajr offset, weekdays, sound preview, math/button, difficulty/questions, snooze controls and a readiness/details entry. Avoid exposing all advanced controls at once; use an expandable advanced section.

Keep account intent, device capability and armed state distinct. Suggested states: OFF, needs location, needs permission, needs local activation, scheduling, armed with next time, limited mode, expired offline schedule, scheduling failed. Do not show a green enabled switch as proof of scheduling success.

Ringing screen: **حان وقت الاستيقاظ للفجر**, one question at a time, large accessible keypad, question progress, a bounded snooze button if available, and visible **إيقاف طارئ — اضغط مطولًا ٥ ثوانٍ**. Never lock the user into an impossible task. Button mode has a normal explicit stop action.

Provide a **جرّب المنبّه الآن** preview/test with the same local player and dismissal UI, labelled as a test. A test must use a separate TEST identity, must not mark tomorrow's real occurrence dismissed, must never earn streak/prayer credits and must clean up its own service and notification.

## 6. Native state and duplicate prevention

Persist an occurrence state machine: `scheduled -> ringing -> challenge -> dismissed`, with branches for `snoozed`, `timed_out`, `emergency_stopped`, `interrupted`, `missed` and `cancelled`.

On delivery, atomically claim `(ownerUserId, occurrenceKey)`. Duplicate receivers, notification taps, retries, app restarts or a new schedule fingerprint cannot start a second player. Keep terminal-state tombstones through the corresponding Fajr day plus a bounded cleanup period. Snooze is a child of the same occurrence with a persisted attempt counter, not a new independent daily alarm.

Use an immutable native alarm identity/data URI derived from account + occurrenceKey, with a stored collision-safe numeric ID mapping if the plugin requires integers. Do not use a short string hash alone as a unique native request code. Store snooze IDs separately and cancel them on final dismissal.

Set a cumulative audible-time budget of `maxRingMinutes`. Preserve consumed time across challenge navigation, retries and snooze. Use monotonic elapsed time while the device is running; retain sufficient durable wall-clock/boot information to avoid resetting the budget after process death/reboot. Also bound the occurrence's total lifetime by ring budget + allowed snooze durations. A restart never starts another full budget.

Snooze stops/releases the player, schedules one local child occurrence and consumes one allowed snooze. Successful challenge, normal stop, timeout and emergency stop cancel all remaining child records. Never resume yesterday's ringing state after a reboot.

## 7. Math challenge

Generate questions locally at first ring and persist the current challenge. No network, AI, camera, microphone or backend validation is needed. This is a voluntary wake-up aid, not a secure exam or proof of prayer.

- Easy: integer addition/subtraction within 0–20; nonnegative results.
- Medium: addition/subtraction within 0–99 and multiplication using 2–9; no fractions or ambiguous operator precedence.
- Normalize Arabic-Indic and Eastern Arabic-Indic digits to ASCII; trim whitespace; require a whole integer, not an empty field. Validate the complete input, never just the first character.
- Wrong answer keeps the current question with clear feedback; correct answers advance until `questionCount` is reached. Do not change difficulty unexpectedly while someone is waking.
- Maintain TalkBack/VoiceOver support, large text, adequate contrast and an accessible emergency action. For people unable to use math, allow button mode in settings.
- Do not automatically mark FAJR completed, confirm Quran pages, advance a streak or grant points for answering.

## 8. Android implementation

Use a native AlarmManager-based mechanism that survives a stopped Dart isolate; do not rely on Dart Timer, a periodic FCM push or a repeating 24-hour alarm. Schedule individual UTC one-shots because Fajr and UTC offsets change each day.

For the explicitly enabled user-facing wake-up alarm, evaluate `setAlarmClock` with an immutable PendingIntent and a visible alarm-management intent. Check `canScheduleExactAlarms()` and request appropriate special access only after explaining it. `SCHEDULE_EXACT_ALARM` is user-granted and can be revoked. Do not blindly add `USE_EXACT_ALARM`; its Play eligibility is narrower. Recheck after returning from settings and handle SecurityException without crashing.

Check notification permission, alarm notification channel sound/importance and fullscreen capability separately. Full-screen intent access is restricted on modern Android; do not assume Noor automatically qualifies for a default grant. If allowed, use the documented locked-screen activity/notification path. If denied, show the honest notification-based limited experience and a fix action.

Use a correctly declared foreground service for the actual implemented behavior and SDK target, with a visible ongoing notification and OS stop support. Review foreground-service type/permission and Google Play declaration against the real native implementation; existing Quran media-playback declarations are not automatic approval for a different service. Do not copy a manifest permission simply to suppress a platform exception.

Use audio attributes for alarm usage and request/release audio focus appropriately. Respect calls, audio-route changes, device policies and user sound settings. Never force system volume to maximum, disable system Stop, ask for accessibility service to resist stopping, or request broad permissions just to make the alarm unkillable. Battery guidance should be device-specific and contextual.

On BOOT_COMPLETED, time/timezone changes, app replacement and permission restoration: reconcile future persisted occurrences, ownership and capability. A normal app swipe-away is not Android force-stop; test both and do not promise delivery after force-stop. The phone being powered off is outside the app's control. Decide/document whether pre-unlock reboot delivery is supported; a standard credential-encrypted store alone cannot provide it.

## 9. iOS implementation

Use AlarmKit only after runtime availability and authorization checks on supported iOS 26+ devices, with SDK-compatible native integration. Store stable AlarmKit identifiers mapped to account/occurrenceKey. Cancel/update existing IDs when the schedule changes. Respect the actual OS scheduling limits and authorization changes.

AlarmKit provides system-level alarm controls, including Stop. Noor cannot replace every system Stop path with a mandatory math question. Offer **Open Noor** as a supported secondary action for optional challenge UI. Label the product capability accurately in iOS UI and marketing. Do not restart an alarm to punish a system dismissal.

For older/unsupported systems or denied AlarmKit access, provide a clearly labelled local-notification fallback with OS sound limits. A 41-second MP3 is not directly a universally valid iOS notification-sound asset; prepare supported format/duration per the selected API, or use system sound. Do not use a permanently running silent background player, pretend to have critical-alert entitlement, or promise Android-style indefinite looping.

## 10. Coordinate with Fajr Adhan

Keep one device-level audio coordinator for Quran playback, Adhan and wake-up alarm. They must never play over one another. Preserve prayer notification/progress behavior and do not change Adhan preferences on the backend.

Recommended explicit local policy: a Fajr Adhan due while the wake-up occurrence is actively ringing/challenging/snoozed may take exclusive audio focus for its normal playback; the wake-up audible player pauses. Keep its challenge and safety deadline intact. Resume wake-up audio only if still permitted, not dismissed, not snoozed and within its original budget/lifetime. If Adhan is already playing when wake-up becomes due, wait for completion under the same bounded lifetime. A silenced/disabled Adhan does not prevent the optional alarm from operating.

Implement this through the existing playback owner, not two independent notification plugins racing for focus. Account for an iOS system-managed alarm separately: when the OS alarm owns audio, suppress competing app audio. Never use this feature to globally mute another application's alarms or change the user's saved Fajr Adhan selection.

## 11. Selected sound delivery

The MP3 is now included in backend source at `assets/fajr-alarm/fajr_wakeup_alarm_v1.mp3`; no manual transfer of the file to the Flutter developer is required.

Public catalog: `GET /fajr-alarm/sounds`. Standard Noor envelope, `data.defaultId`, `data.downloadBeforeArming`, and `data.sounds[]` containing `id`, `audioUrl`, `previewUrl`, `sha256`, `sizeBytes` for the custom recording, and `available`. System sound has null URLs/checksum and needs no download. Custom recording metadata records `licenseStatus: NOT_VERIFIED`; hosting does not change source-rights status.

Public media after deploying this source:
`https://noorapp-backend-production.up.railway.app/api/v1/fajr-alarm/media/fajr_wakeup_alarm_v1.mp3`

GET/HEAD and byte ranges are supported, with a versioned filename and cache headers. Unknown filenames return 404. This separate catalog does not add the wake-up clip to regular Adhan choices.

Primary Flutter flow: select sound -> fetch catalog -> download HTTPS audio to a temporary file -> validate exact byte length and SHA-256 -> atomically move to persistent application storage -> prepare the platform-specific native sound resource -> mark custom sound ready -> arm. Reuse the local validated copy on subsequent launches. Do not use an evictable cache folder as the only copy. Network failure/missing bytes must use system sound or leave activation clearly pending, never arm a silent custom alarm. Do not stream the URL at alarm time.

Some native APIs require compiled resources or specific audio formats rather than an arbitrary downloaded MP3; use the supplied optional asset during the native build where required, or fall back to system sound. Test the chosen Android implementation and iOS AlarmKit sound support explicitly. Backend hosting alone does not make an MP3 a valid iOS notification sound.

Logical ID: `fajr_wakeup_voice_v1`.
Suggested Flutter path: `assets/alarms/fajr_wakeup_alarm.mp3`.
The supplied MP3 has SHA-256:

`77f64784a80c4f189bae24521f6e4433ac0f3f96fd5e31888277ce33fac5971f`

Size: 994,816 bytes. Preserve this original file; loop locally on platforms where supported, never download or stream it at ring time. Register the asset in pubspec.yaml and copy/package it into the native resource location required by the actual alarm implementation. Verify Android release shrinker/resource packaging and iOS supported audio format separately. The backend soundId is an identifier, not a URL or proof that the phone has the asset.

User-selected recording source: [uploader's YouTube video](https://www.youtube.com/watch?v=onvTvACwHCE), with a MediaFire download linked by the uploader in the comments. Source folder: [MediaFire collection](https://www.mediafire.com/folder/3l1u44s9xt8pp/). Original filename: `منبه الفجر - الصلاة خير من النوم من الحرم المكي.mp3`; MediaFire file ID `1envp6kjb8fn8s3`.

This is provenance, not a verified commercial redistribution license. The recording's attribution/usage rights have not been independently cleared. Keep `system_alarm` as the working default and use an authorized recording for public distribution; resolving the recording does not require redesigning the alarm feature.

## 12. Acceptance and device testing

Backend checks completed locally: TypeScript/build; settings validation; partial edits preserving previous values; calendar/weekday selection; existing prayer calculation parity; travel timezone correction; Cairo/New York DST; Kathmandu fractional offset; Apia date-line case; high-latitude estimates; future-only occurrences; stable identity with changing fingerprints; complete lazy OpenAPI registration. PostgreSQL checks execute the real new migration in an isolated temporary schema within a rolled-back transaction, test saved values, 409 conflicts, account isolation and deletion cascade. Real Express handlers/auth/envelopes are also exercised against those isolated preference rows; account lookups alone are stubbed to keep them away from public user tables. They do not apply the migration to the live public schema.

Run `npm run test:fajr-alarm` for the non-DB suite. For the isolated PostgreSQL/HTTP suite in PowerShell, set `$env:FAJR_ALARM_TEST_DB='true'` and run the same command with a reachable PostgreSQL connection. It creates a unique schema inside one transaction and rolls it all back. It does not load-test concurrent real connections or certify mobile alarm delivery.

Before release, Flutter/native QA must cover:

1. Release builds on supported Android versions and representative Samsung/Xiaomi/Oppo devices; supported iOS 26+ devices and older-system fallback.
2. Foreground, background, locked screen, screen off, Doze, app swipe-away, force-stop, reboot before/after unlock and app update. Record actual limits rather than marking every case supported.
3. Exact alarm/fullscreen/notification permission denied, granted, revoked and restored; muted channel, zero volume, DND and audio route/call interruption.
4. Offline ring, math, emergency stop, snooze and timeout; expired cached schedule with no fabricated next day.
5. Same occurrence delivered twice, concurrent notification taps, process recreation and crash during reconciliation: one player, one challenge, no budget reset.
6. Correct/incorrect/empty answers, Arabic digits, accessibility, font scaling, normal button mode and emergency hold cancellation.
7. Snooze disabled, zero allowance, allowance exhausted, all maximum bounds and custom audio missing/corrupt.
8. Travel/location update, changed calculation method, local date boundary and DST changes; returned UTC times match prayer screen.
9. Another phone's cloud ON does not arm this phone. Logout/switch/delete cancels the correct account. A stale network response cannot re-arm old settings.
10. Fajr Adhan, Quran audio and wake-up alarm collision: exclusive audio, no skipped user intent, no duplicate FCM alarm.
11. Test preview cleanup does not dismiss the next real Fajr; successful challenge does not change prayer progress, points or streak.
12. Store declarations/screenshots/video describe the real permission use and platform-specific capabilities.

## 13. Official implementation references

- [Android alarm scheduling and exact-alarm access](https://developer.android.com/develop/background-work/services/alarms)
- [Android 14 exact-alarm permission changes](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms)
- [Android 14 behavior changes, including fullscreen intent access](https://developer.android.com/about/versions/14/behavior-changes-14)
- [Apple AlarmKit](https://developer.apple.com/documentation/alarmkit)
- [Scheduling an alarm with AlarmKit](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit)
- [Apple alarm alert presentation](https://developer.apple.com/documentation/alarmkit/alarmpresentation/alert-swift.struct)

Review these again against the SDK/OS and store requirements used for the actual release. Future 2027 behavior cannot be certified by a 2026 backend test.
