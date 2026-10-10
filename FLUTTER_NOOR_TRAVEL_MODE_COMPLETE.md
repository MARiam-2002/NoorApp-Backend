# Noor Travel Mode — Complete Flutter Integration Handoff

Version: 2026-10-10. Language: English. This document is the single handoff for the Travel Mode change. All paths below are relative to `/api/v1`.

Production base URL: `https://noorapp-backend-production.up.railway.app/api/v1`.
Swagger: `https://noorapp-backend-production.up.railway.app/api/v1/docs`.

## 1. Scope and release status

Backend implementation is saved locally and tested. Deploy this code and its Prisma migration before integrating the new endpoints in production. It has not been deployed or verified against production in this work item.

Travel Mode changes the saved prayer location and timezone. It preserves the user's calculation method, madhab, prayer toggles, notification sounds, and Quran progress. It does not calculate religious concessions for travelers, shorten prayers, or combine prayers. Prayer times are calculation estimates; regional automatic methods do not guarantee agreement with every local official timetable.

No additional paid API or API key is required for this feature. Timezone inference uses the existing bundled coordinate lookup. City/country names are optional; do not add a paid geocoding service just to display a label. Existing hosting and notification platform constraints still apply.

Use foreground location only. No background GPS tracking or continuous location history feature is implemented. Updates happen when the user opens/resumes the application and has enabled automatic mode. The application cannot detect a new destination while closed without a separately designed background feature; do not promise otherwise.

## 2. Backend deployment — owner checklist

1. Upload the changed backend repository, including `prisma/migrations/20261010160000_travel_mode/migration.sql`.
2. Railway Pre-deploy Command remains `npx prisma migrate deploy`.
3. Railway Start Command remains `npm start`. Keep the existing build command; Prisma client generation remains part of installation.
4. No new Railway variable, GPS API key, map subscription, or email setting is needed.
5. Confirm the migration completed and authenticated `GET /travel` and `GET /travel/schedule` work after deployment. An account without coordinates must receive a clear choose-location error from the schedule endpoint.
6. Complete the physical Android/iOS tests in section 12 before release.

Migration adds `users.travelPreferences` and `travel_operations`. Account deletion cascades operation receipts. Do not run migration SQL manually at application boot, ignore migration failures, reset the production database, or mark an unverified migration applied.

## 3. Backend behavior

- Default mode: `MANUAL`.
- Supported modes: `MANUAL`, `FOREGROUND_AUTO`.
- GPS commits require a timestamp and accuracy. Maximum observation age: 10 minutes; future clock tolerance: 1 minute. GPS older than the saved observation is rejected.
- Accuracy is accepted between 0 and 5000 meters. Prefer accurate fixes; do not claim a 5000-meter fix is precise.
- Coordinate ranges: latitude -90..90, longitude -180..180. JSON numbers only. Zero is valid.
- Backend infers the IANA timezone from coordinates. Do not submit the handset timezone as authority for a manually selected destination.
- User profile coordinates and Azan preference coordinates are updated in one transaction.
- Old `localScheduledUntil` is cleared on location commit; the new client must cancel and rebuild old OS alarms.
- Prayer method and madhab are preserved. `AUTO` remains automatic; explicit user selections remain explicit.
- Missing city/country clears old location labels rather than keeping the previous destination's name.
- `scheduleKey` is a SHA-256 fingerprint of effective prayer scheduling inputs. It changes when relevant coordinates/timezone/method/madhab/toggles/sounds change. Coverage acknowledgements and translated city labels do not change it.
- Writes require the current `expectedScheduleKey` and a UUID `requestKey`.
- Operation receipts are scoped to the authenticated user. Exact retry returns the original response; using the same key with different input returns 409. Always GET current state after a delayed/replayed success because its original result may describe a previous location.
- GPS updates are serialized by a user row lock. Existing Azan preference writes also use that lock to avoid overwriting a simultaneous travel update.
- Cron checks that its prayer/location snapshot is still current before claiming a reminder. Existing durable occurrence deduplication stays unchanged. Location changes never create a new duplicate namespace for a previously delivered same-day prayer event.
- This is an account-level saved location. Another device changing it changes the account. One designated scheduling device is required for account-wide local coverage; no per-device coverage arbitration was added here.

## 4. Authentication and errors

Every endpoint requires `Authorization: Bearer <accessToken>` and uses the existing Noor response envelope. Read the payload from `response.data.data` when using Dio. Responses are `Cache-Control: private, no-store`.

- 400: invalid input, missing location, invalid coverage horizon.
- 401: refresh/login through the existing authentication flow.
- 404: authenticated account no longer exists.
- 409: stale schedule fingerprint, stale/future GPS observation, or conflicting request key. Refresh state; never blindly replay a stale location update with a new key.
- 5xx/network timeout: keep the exact request body and request key for retry; show saved-location/offline state. Do not claim synchronization succeeded.

Do not log access tokens, operation bodies containing precise location, GPS coordinates, or API credentials in analytics/crash breadcrumbs.

## 5. API: get state

`GET /travel`

Example `data` (timestamps and hashes are illustrative):

```json
{
  "mode": "FOREGROUND_AUTO",
  "scheduleKey": "<64-character lowercase SHA-256>",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.006,
    "timezone": "America/New_York",
    "city": "New York",
    "country": "United States"
  },
  "observedAt": "2026-10-10T12:00:00.000Z",
  "accuracyMeters": 30,
  "source": "GPS",
  "updatedAt": "2026-10-10T12:00:01.000Z",
  "timezoneMatchesCoordinates": true,
  "calculationMethod": "AUTO",
  "madhab": "SHAFI",
  "localScheduledUntil": null,
  "foregroundOnly": true,
  "backgroundTracking": false,
  "serverTime": "2026-10-10T12:00:02.000Z"
}
```

`location` is nullable. `source` is `GPS`, `MANUAL`, `SAVED`, or `UNSET`. Legacy accounts may have `updatedAt`, `observedAt`, and `accuracyMeters` null. Do not manufacture Cairo as a user's confirmed location. If `timezoneMatchesCoordinates` is false, invite the user to refresh or confirm their location before publishing new alarms.

## 6. API: save location and mode together

`PUT /travel/location`

GPS example:

```json
{
  "requestKey": "e3f2a6d7-723a-4e40-975a-d0a0eb45872b",
  "expectedScheduleKey": "<key from latest GET /travel>",
  "mode": "FOREGROUND_AUTO",
  "source": "GPS",
  "latitude": 40.7128,
  "longitude": -74.006,
  "observedAt": "<actual current GPS observation ISO timestamp>",
  "accuracyMeters": 30,
  "city": "New York",
  "country": "United States"
}
```

Manual example:

```json
{
  "requestKey": "aaec1540-270f-4c44-b824-3ed729df3dd3",
  "expectedScheduleKey": "<latest key>",
  "mode": "MANUAL",
  "source": "MANUAL",
  "latitude": 27.7172,
  "longitude": 85.324,
  "city": "Kathmandu",
  "country": "Nepal"
}
```

GPS requires `FOREGROUND_AUTO`; manual selection may use either mode. For turning automatic mode off, serialize outstanding GPS work, then commit `MANUAL` using the currently confirmed coordinates and `source: MANUAL`. With no saved coordinates, default mode is already manual. Never restore an old home location automatically when disabling Travel Mode.

Do not use historical coordinates from examples as real user data. Do not attach fields such as device ID, timezone, method, or madhab to this strict request schema. Update prayer settings through existing `/profile/azan-preferences`, then fetch a new travel schedule.

Response `data` is the saved travel state from section 5.

## 7. API: fetch UTC prayer schedule

`GET /travel/schedule`

Returns travel state plus:

```json
{
  "timezone": "America/New_York",
  "date": "2026-10-10",
  "prayers": [
    {
      "prayerKey": "ASR",
      "date": "2026-10-10",
      "time": "16:12",
      "prayerAtUtc": "2026-10-10T20:12:00.000Z"
    }
  ],
  "notificationPreferences": "<the existing full Azan preference object>",
  "refreshAfterUtc": "<server timestamp approximately six hours ahead>",
  "calculationIsEstimate": true
}
```

The snippet illustrates shape, not a real timetable. Actual `notificationPreferences` is an object, not a string. Schedule contains future instants from the calculation window around today (yesterday/today/tomorrow). Use the supplied local `date`; cross-midnight prayer instants may belong to a neighboring prayer date.

Do not assume five rows only, 24-hour gaps, a fixed UTC offset, or that Gregorian dates match the handset's current timezone. Refresh on resume, destination change, local date change, settings change, system clock/timezone change, and no later than `refreshAfterUtc` while running. Obtain fresh schedules rather than repeating yesterday's HH:mm indefinitely.

Parse `prayerAtUtc` as an instant and convert using the returned IANA timezone with the timezone package. Never parse `time` to construct an alarm or recompute prayer times independently in Flutter. Countdown uses the UTC instant; displayed date/time uses locale and selected timezone. Keep ASCII digits in API values; Arabic-digit conversion belongs only to presentation.

Pre-reminder instant = prayer instant minus `preReminderMinutes`; it may cross midnight. Respect all enable/sound/vibration/prayer toggles. The existing notification handoff remains authoritative for Arabic/English copy, Friday Dhuhr/Jumuah announcements, sound catalog IDs, Android channel IDs and audio ownership. Travel Mode does not supply arbitrary new sound assets.

## 8. API: acknowledge successful local coverage

`PUT /travel/local-coverage`

```json
{
  "requestKey": "2c26b2df-5374-4f3b-b5e1-a75638e78dce",
  "expectedScheduleKey": "<key for the successfully scheduled alarms>",
  "localScheduledUntil": "<end of fully covered UTC interval>"
}
```

`localScheduledUntil` must be in the future and no more than 48 hours ahead. It must not exceed actual fully scheduled coverage. `null` releases coverage. The field is inherited account-wide coverage used by backend notification fallback; it is not a count of scheduled alarms.

Do not acknowledge before OS scheduling succeeds. Do not send this field through the legacy Azan preference PATCH in the new travel flow: use this guarded endpoint. If a concurrent location/settings change makes the key stale, the endpoint returns 409 instead of suppressing fallback using obsolete coverage.

Coverage may also affect existing Duha/Qiyam fallback. Only acknowledge an interval after all enabled reminders that rely on this shared coverage field are handled. If the app cannot schedule them, keep coverage null and use the existing server delivery mode. Designate one primary device; users with several independently scheduling devices can still receive duplicate local alarms without client coordination.

## 9. Flutter architecture and serialized reconciliation

Recommended files (adapt names to your codebase):

- `travel_models.dart`: typed state, location input, schedule, prayer instant.
- `travel_api.dart`: authenticated Dio requests, UUID request receipts, error mapping.
- `travel_controller.dart`: single-flight reconciliation and location mode state.
- `prayer_schedule_repository.dart`: UTC schedule cache keyed by account and scheduleKey.
- `notification_schedule_coordinator.dart`: cancellation, rescheduling and guarded coverage.
- `travel_settings_screen.dart`: mode/location/permission UI.

Use compatible supported releases of `geolocator`, `timezone`, `flutter_local_notifications`, a UUID generator and the existing state-management stack. Pin tested versions in the application lockfile; do not copy a future version number from a design document.

Reconciliation order:

1. Acquire one app-wide scheduling mutex. Cancel/ignore previous GPS tasks when the mode changes; never allow an earlier auto-mode request to re-enable automatic mode after the user disables it.
2. GET current travel state.
3. If automatic mode is enabled and foreground permission is granted, obtain a fresh location. Prefer a good fix; if approximate or weak, label it and allow manual confirmation. Never silently require precise permission.
4. Suggested client battery policy: refresh on resume if cached fix is older than 15 minutes; consider movement meaningful at approximately 5 km or a timezone change. These are UX thresholds, not religious guarantees. Always offer an explicit Refresh Location action. Avoid polling every second or sending every GPS sample.
5. Before committing a changed location, stop the local scheduler and cancel old pending prayer/pre-prayer and timezone-sensitive Noor alarms. Keep an inventory of Noor IDs; do not indiscriminately cancel unrelated notification features.
6. PUT location with the latest key and one durable UUID. Preserve the exact request on network retry.
7. GET state/schedule again after success, including replayed success. Never apply a delayed receipt directly as the latest location.
8. Refresh home prayer times, Qibla coordinate context, daily local-date views and relevant timezone-dependent reminders. Never modify Quran reading completion to compensate for a new timezone.
9. Schedule only future allowed UTC instants. Attach the returned scheduleKey to stored alarm payloads. Use deterministic OS IDs scoped to prayer date + prayer + event kind; create separate IDs for pre-reminder and at-time event.
10. Verify pending OS requests and all required permissions. Only then acknowledge the fully covered interval using the exact scheduleKey.
11. On 409, cancel the schedule just created, refresh state and reconcile. Bound retries and show a synchronization error rather than looping forever.
12. Release mutex. Persist state/cache/receipts safely. On logout/account switch, clear that account's caches and cancel its pending alarms.

If the network is unavailable after travel, show the last synchronized destination and its timestamp. Do not present its prayer times as current-destination times. Keep an explicit retry/manual path. If reliable old alarms cannot be maintained for the new destination, cancel them; explain notifications are waiting for synchronization.

## 10. Notification deduplication and platform limits

FCM prayer payloads now include `scheduleKey`. Backend checks its scheduling snapshot before the durable event claim. Flutter data-message handlers should discard stale keys and expired payloads and deduplicate using existing `occurrenceKey`/`idempotencyKey` (or existing dedupeKey semantics).

Do not add scheduleKey to the durable occurrence identity: a location change must not re-ring an already delivered same-day prayer event. Do not manually display an FCM notification that the OS already displayed. Do not play audio separately from a channel-owned sound.

Important practical limit: an OS-rendered FCM notification can be displayed while the app is closed before Dart can inspect its key. The snapshot check reduces stale sends but cannot retract an already in-flight or displayed notification. Client filtering alone does not fix OS-rendered duplicates. Keep local-primary/FCM-backup coverage consistent; do not enable two independent primary senders. Existing durable backend claims prioritize avoiding duplicate sends and do not guarantee delivery after every provider failure.

Use `zonedSchedule` with exact alarms only when permission and platform eligibility permit it. If exact scheduling is unavailable, disclose the limitation and do not falsely acknowledge exact coverage. Handle Android notification permission, channel creation, boot restoration, exact-alarm permission changes, manufacturer battery behavior, and iOS pending-notification limits. Schedule a bounded upcoming window instead of unlimited repeating alarms. Check the actual installed plugin documentation.

The system may delay notifications, deny permission, disable sound or limit background work. Physical device QA is necessary; passing backend tests is not a guarantee of delivery on every device.

## 11. Noor design and privacy

Add Travel Mode under Prayer/Location settings and a compact location row on Home, not a large promotional card.

Visual identity: cream background `#FAF8F3`, white surfaces, navy text `#1A1040`, gold accent `#C9A86A`. Use existing Noor logo/icon set and type scale. Comfortable touch targets, accessible contrast, natural RTL layout and matching English LTR. Use Arabic digits when Arabic UI is selected, while keeping API numbers unchanged.

Suggested copy:

- Title: “Travel mode” / “وضع السفر”.
- Automatic subtitle: “Update prayer location when you open Noor” / “تحديث موقع الصلاة عند فتح نور”.
- Manual action: “Choose location” / “اختيار الموقع”.
- Status: “Last updated …” / “آخر تحديث …”.
- Weak location: “Approximate location — confirm your destination” / “الموقع تقريبي — أكّد مكانك”.
- Offline: “Showing the last synced location” / “نعرض آخر موقع تمت مزامنته”.

States: no location, saved manual location, automatic permission missing, location service off, permanently denied, approximate fix, refreshing, synchronized, offline, stale conflict, server error. Provide manual selection in all denial cases. Do not repeatedly prompt for permission or block Quran reading because GPS was refused.

Backend stores the latest location and travel settings. Durable mutation receipts also contain saved response snapshots, including coordinates, to support safe replay; they are retained until account deletion in this implementation. They are not a continuous GPS tracking product, but must be treated as location data in privacy disclosures. If the owner wants a time-limited receipt retention policy, implement and document it before claiming automatic deletion. Do not state that all location remains only on the device.

Update the app's actual privacy wording and Play/App Store declarations to reflect location transmitted to the server for prayer/location features. Obtain contextual consent before enabling automatic updates. Request only while-in-use location for this workflow; do not add background location permissions. Never use location for advertising or unrelated analytics without a separately reviewed product decision.

## 12. Acceptance tests before launch

Backend checks already completed locally: build, Prisma schema validation, global prayer tests including 2026/2027 season/DST/date-line cases, mocked prayer delivery regressions, and isolated rollback PostgreSQL travel tests.

Flutter/production tests still required:

1. Cairo → New York → Kathmandu → Sydney: timezone, UTC countdown, city label, prayer method and madhab remain coherent.
2. Auto method changes regional effective method when appropriate; explicit chosen method is preserved.
3. Approximate location, denied/permanently denied permission, GPS off and manual destination all have usable UI.
4. Stale GPS, future device clock and out-of-order update cannot replace a newer confirmed location.
5. Retry the same request after a dropped response: no duplicate operation; fetch latest state after the receipt.
6. Change settings/location while scheduling: stale coverage receives 409; obsolete OS alarms are canceled.
7. Pre-reminder crossing midnight, Friday Jumuah audio, DST transitions, half/quarter-hour timezones and international date line display correctly.
8. Background/closed application: no promised automatic GPS updates. Boot/resume restores a current bounded schedule.
9. Local alarms + FCM fallback: one visible notification/audio per event in the selected delivery mode; no Dart re-display of OS notifications.
10. Sounds off, vibration off, prayer disabled, exact-alarm denied, Android notifications denied, iOS permission denied and battery restrictions behave honestly.
11. Two signed-in devices follow the primary-scheduler policy. A foreign location update invalidates current schedules on next sync.
12. Logout/account deletion cancels alarms and clears cached location; no notification belonging to another account appears.
13. Home daily goals and reading sessions remain correct after timezone changes; do not rewrite past completion dates.
14. Deployed migration appears successful and new routes are present in live Swagger. Use a dedicated test account for writes.

## 13. Primary references

- Android location permissions: https://developer.android.com/develop/sensors-and-location/location/permissions
- Android runtime location and approximate access: https://developer.android.com/develop/sensors-and-location/location/permissions/runtime
- Android background location guidance: https://developer.android.com/develop/sensors-and-location/location/background
- Flutter notification plugin maintained documentation: https://pub.dev/documentation/flutter_local_notifications/latest/

Recheck platform and plugin requirements at release time. No claim here guarantees unknown 2027 policy changes or universal official prayer timetable accuracy.
