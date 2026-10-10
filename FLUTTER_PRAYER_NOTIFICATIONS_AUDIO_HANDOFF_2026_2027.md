# Flutter Prayer Notifications, Audio and Worldwide Timing Handoff — 2026/2027

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`  
**Updated:** 2026-10-10  
**Language:** English  
**Status:** Backend changes saved and validated locally. They are not deployed to Railway. Flutter implementation and real-device acceptance remain required.

## 1. Problem and required behavior

The supplied screenshot shows two identical Jumuah tray notifications. The backend cannot identify their source from an image. Audit whether the second notification comes from a local alarm, a second FCM handler, duplicated listener registration, or a second delivery. Record source and occurrence identity to establish this.

For each enabled prayer occurrence, the device must produce exactly one visible notification and one audio action. A pre-prayer reminder and the prayer-time event are separate occurrences. Opening a notification must navigate only; it must not show or play the event again.

## 2. Backend changes in this patch

- The database unique occurrence claim is mandatory. If it fails, the server logs `Azan reminder claim failed; send suppressed` and does not send. Removed the non-atomic scan-and-send fallback.
- Duplicate claims return zero affected rows and do not send, including concurrent workers.
- Friday naming and automatic clip selection use the prayer instant, not the scheduler's current date. This matters for reminders crossing local midnight.
- FCM prayer data adds `deliveryMode`, `audioOwner`, `scheduledAtUtc`, `prayerAtUtc`, and `expiresAtUtc`.
- Push TTL uses actual remaining seconds to the absolute expiry. Pre-prayer messages expire at prayer time, including one-minute reminders; at-time messages expire 15 minutes after their scheduled instant. Already expired events are not submitted.
- New preference `prayerTimeSoundMode` selects the existing full Azan or a short prayer-event announcement. The default is `azan`, preserving existing users' selection. Missing announcement media falls back to the selected Azan with `audioFallbackReason`.
- No new database migration is needed. The existing `20260925070000_azan_reminder_send_logs` migration and its unique `(userId, occurrenceKey)` constraint must already be applied.

The claim is recorded before transport submission. This prioritizes preventing duplicate sends: a process crash or transport failure after the claim may miss the event. It is not an exactly-once delivery guarantee. There is no new retry/outbox implementation in this patch.

## 3. API and preferences

Use bearer authentication for saved preferences:

- `GET /profile/azan-preferences`
- `PATCH /profile/azan-preferences`
- `GET /prayers/today` for saved/profile location
- `GET /prayers/schedule?latitude=...&longitude=...&timezone=...&date=YYYY-MM-DD&method=...&madhab=...` for explicit dates/location
- `GET /azan/sounds`, `/azan/audio-defaults`, `/azan/calculation-methods`, `/azan/madhabs`
- `GET /azan/media/{file}` for known audio files

Responses use the existing `data` wrapper. PATCH only the changed settings. Do not submit a stale complete preferences object.

To select short spoken approaching and prayer-time clips, explicitly save:

```json
{
  "soundEnabled": true,
  "preReminderEnabled": true,
  "preReminderMinutes": 15,
  "notificationSoundId": "sc_near_auto",
  "prayerTimeSoundMode": "announcement"
}
```

To select the full Azan at prayer time:

```json
{
  "prayerTimeSoundMode": "azan",
  "azanSoundId": "mishary_alafasy"
}
```

`notificationSoundId: soft_chime` is a tone, not a spoken announcement. Notification title/body text does not synthesize speech. Do not reset a user's explicit silent/tone/Azan choice automatically. Offer the spoken option in settings and require normal user selection. `prayerTimeSoundMode` is an additive field; old clients can ignore it.

## 4. One delivery owner: local alarms OR FCM

### Recommended for precise device scheduling: local alarms

Use backend prayer instants to schedule local alarms. For the first safe rollout, turn off prayer FCM backup on the account with `fcmPrayerBackupEnabled: false` while local prayer alarms are active. This avoids a local-plus-server race. All active devices on that account must have the chosen mode configured.

Cancel old Noor prayer/pre-prayer schedules before installing the replacement schedule. Use stable IDs and upsert/replacement, not a new random ID on every refresh. On failure to establish local scheduling, show its unavailable state; do not claim coverage that was never installed.

If retaining the existing hybrid coverage mechanism, report `localScheduledUntil` only after verifying every enabled occurrence up to that instant was scheduled. It is an account-level field, not per device. One device's coverage suppresses pushes to all account devices. Do not treat this contract as per-device coverage. A safe multi-device hybrid requires a separate future per-device design; do not implement it using this single field.

### Alternative: FCM owns presentation

Cancel all local prayer alarms before enabling `fcmPrayerBackupEnabled: true` with `localScheduledUntil: null`. Avoid briefly running both sources. FCM is a backup transport and can be delayed; it cannot provide an exact-alarm guarantee.

The backend sends notification-plus-data messages. In background/terminated delivery, the operating system displays the notification. Do not call local `show()` or an audio player from the background callback for that same message. Foreground delivery may be displayed once by the client, using the specified sound channel, after persistent deduplication. On iOS, select either OS foreground presentation or custom local presentation, never both.

Register FCM foreground/background/tap listeners once. Dispose UI subscriptions correctly. Do not initialize listeners separately on every screen visit.

## 5. FCM data contract

All FCM data values are strings, including booleans and numeric values. Parse explicitly; `"false"` is not a truthy enabled flag.

| Field | Meaning |
|---|---|
| `eventType` | `PRE_PRAYER`, `PRAYER_AZAN`, or `JUMUAH` |
| `kind` | `pre_reminder` or `prayer_time` |
| `key` / `prayerKey` | Stable prayer enum: FAJR, DHUHR, ASR, MAGHRIB, ISHA |
| `eventKey` | JUMUAH for Friday Dhuhr at prayer time; otherwise prayer key |
| `date` | Prayer calculation date used for occurrence identity; preserve it across midnight |
| `occurrenceKey` / `idempotencyKey` | Canonical logical occurrence identity |
| `dedupeKey` | Existing legacy identity; prefer occurrenceKey for exact matching |
| `scheduledAtUtc` | Absolute fire time, with Z suffix |
| `prayerAtUtc` | Absolute prayer instant |
| `expiresAtUtc` | Discard stale client-handled audio/presentation after this instant |
| `timezone` | Resolved IANA prayer timezone |
| `time`, `scheduledAtLocal` | Display clock strings; do not parse as UTC |
| `deliveryMode` | `OS_NOTIFICATION` for this server notification-plus-data transport |
| `audioOwner` | `NOTIFICATION_CHANNEL`: no second application audio player |
| `soundEnabled`, `vibrationEnabled` | String flags reflecting settings |
| `soundType` | NEAR_PRAYER, AZAN, PRAYER_EVENT, GENERIC_NOTIFICATION, or DEFAULT |
| `soundId`, `androidChannelId` | Resolved sound and Android channel |
| `notificationSoundUrl` | Short reminder/announcement media when applicable |
| `azanSoundUrl` | Selected full Azan media; do not play this when soundType is PRAYER_EVENT |
| `prayerTimeSoundMode` | Resolved prayer-time mode where provided |
| `audioFallbackReason` | Optional ANNOUNCEMENT_MEDIA_UNAVAILABLE |

Canonical identity formats:

```text
2026-10-09|DHUHR|pre_reminder|pre15
2026-10-09|DHUHR|prayer_time
```

Build the same identity for local scheduling. Scope persistent deduplication by account plus occurrenceKey. Store a stable integer notification ID mapping; do not use runtime-dependent Dart hashCode or a process-only Set. Atomic acquisition is required across foreground/background isolates. Changing the pre-reminder lead time changes its key; cancel the old schedule before rescheduling. Jumuah still uses DHUHR in occurrenceKey.

## 6. Audio mapping and Android channels

| Prayer/event | Approaching clip | At-time announcement clip |
|---|---|---|
| Fajr | sc_near_fajr | sc_event_fajr |
| Dhuhr | sc_near_dhuhr | sc_event_dhuhr |
| Asr | sc_near_asr | sc_event_asr |
| Maghrib | sc_near_maghrib | sc_event_maghrib |
| Isha | sc_near_isha | sc_event_isha |
| Friday Dhuhr/Jumuah | sc_near_jumuah | sc_event_jumuah |

The backend files are in `assets/near-prayer/` and `assets/prayer-events/`. Include the chosen audio in the Android app's `res/raw` using matching lowercase resource names. A server media URL is not an Android native notification sound resource. `sc_near_auto` is a sentinel, not a sound file; resolve it to the prayer-specific clip before local channel creation. These internal voice clips are not enumerated by `/azan/notification-sounds`.

Channel formulas must match the backend:

```text
Azan/at-time: azan_{soundEnabled ? soundId : "silent"}{vibrationEnabled ? "" : "_novib"}
Pre-prayer: near_{rawSoundNameOrDefaultOrSilent}{vibrationEnabled ? "" : "_novib"}
Examples: near_sc_near_fajr, azan_sc_event_jumuah, azan_mishary_alafasy, azan_silent_novib
```

Create required channels before registering the device for push and before installing local schedules. Query their actual sound/importance settings during diagnosis. Android channel behavior is fixed after creation and may be changed by the user. Recreating an existing channel does not repair its old sound. If an earlier app version installed an incorrect channel, provide a path to its system settings. Any future channel-version migration must be coordinated with the backend IDs and must respect user controls.

Use one audio owner. A notification channel plus an application audio player causes two sounds. This patch supports choosing either a short announcement or the selected Azan. It does not concatenate speech plus full Azan. If that product behavior is desired later, use a single validated combined audio asset, rather than two independently triggered players.

Listen to all shipped clips on a real device and confirm their actual spoken wording. The backend tests verify mapping and file availability, not acoustic contents. Bundle valid iOS sound files with the names used by APNs (`{soundId}.caf`); custom notification sounds must satisfy Apple's duration/format limits. Do not expect an MP3 URL to play automatically from an APNs notification. Full-length iOS Azan is not guaranteed by a native notification sound.

## 7. Worldwide timing and rescheduling

Use each schedule row's `iso`/absolute timestamp. Subtract preReminderMinutes from that instant. Do not combine today's local date with an HH:mm string, assume every country is Cairo, add 24-hour durations to compute tomorrow, or calculate the five prayers independently in Flutter.

Fetch explicit local dates and the user's coordinates, method and madhab. Use the returned IANA timezone. `AUTO` uses the existing regional mapping; user-selected methods take precedence. Validate locally against the intended religious authority where methods differ. Worldwide calculation coverage is not proof of an exact official timetable match in every city.

Update saved location/settings as well as the displayed query; querying a new location alone does not update the server's reminder location. Reschedule on timezone/location/method/madhab/settings changes, local midnight, reboot and app upgrade. Use calendar days in the prayer timezone for date iteration and absolute instants for firing. Test DST transitions and Isha/pre-reminders crossing midnight. Sunrise is display-only, not an Azan occurrence.

Keep location, timezone and scheduled coverage consistent during travel. Do not reuse coverage for a stale schedule. Respect notification permissions, exact-alarm availability, silent mode, Do Not Disturb, user channel settings and battery restrictions. Explain a missing permission to the user instead of pretending an alarm is installed.

## 8. Real-device acceptance checklist

- [ ] First install: permission flow, channels and raw assets are ready before scheduling/token registration.
- [ ] Foreground, background and terminated: one visible notification and one sound for each event.
- [ ] Tap notification: navigation only, no replay.
- [ ] Repeated initialization/app resume does not add listeners or duplicate schedules.
- [ ] Repeated same occurrenceKey is suppressed atomically across isolates.
- [ ] Local mode and server mode never deliver the same occurrence concurrently.
- [ ] Pre-reminder uses the correct spoken/tone selection; prayer time uses the selected mode.
- [ ] Friday: Jumuah copy and clip, distinct pre/at-time occurrence keys.
- [ ] Disabled sound/prayer/pre-reminder choices are respected.
- [ ] Offline/delayed push is not played after expiry by client-handled paths.
- [ ] Cairo, Riyadh, London, New York, Sydney, Kathmandu and date-line locations show the same API and local-alarm instants.
- [ ] Midnight, DST, travel, reboot, upgraded installs with old channels and multiple devices are covered.
- [ ] OEM battery restrictions and denied exact-alarm/notification access show a truthful scheduling state.
- [ ] All Arabic clips are listened to and iOS bundled sound files are verified.

Log account-safe diagnostics: occurrenceKey, source, eventType, scheduled instant, receive time, channel ID, selected mode and suppression reason. Do not log FCM tokens or personal location history. Capture both duplicate entries' diagnostic identities to confirm the fix.

## 9. Backend validation and release

Passed locally: near-prayer resolver/audit, new mocked delivery regressions (failed claim, duplicate claim, local coverage, eight concurrent workers, pre expiry, announcement preference, silent/full-Azan selection and Thursday-to-Friday midnight sound selection), worldwide timing tests, 2026/2027 seasonal/DST/date-line schedule-versus-reminder consistency, 718 existing reference timetable checks and production build.

Commands:

```text
npm run test:near-prayer
npm run test:prayer-global
npm run test:prayer-method
npm run build
```

Deploy the tested backend after confirming the existing send-log migration is applied. Then verify Railway logs and real phone delivery. Neither production pushes nor the Flutter source were tested in this session. The sender's per-account claim and account-level local coverage are existing limitations; this patch does not claim global exactly-once or future platform acceptance.

## 10. Official platform references

- [Firebase: receiving FCM messages in Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages)
- [Android: notification channel creation and immutable behavior](https://developer.android.com/develop/ui/views/notifications/channels)
- [Android: alarm scheduling and exact-alarm access](https://developer.android.com/develop/background-work/services/alarms/schedule)
- [Apple: custom notification sounds](https://developer.apple.com/documentation/usernotifications/unnotificationsound)

Follow the platform requirements available at release time. The 2027 test dates exercise calendar calculations; they do not certify unannounced future OS or store policies.

