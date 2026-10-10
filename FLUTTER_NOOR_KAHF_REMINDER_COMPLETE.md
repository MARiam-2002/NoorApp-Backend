# Noor — Silent Friday Surah Al-Kahf Reminder

Backend/Flutter handoff, 2026-10-10. All API paths below use base `https://noorapp-backend-production.up.railway.app/api/v1`.

## Product placement

Add **Surah Al-Kahf reminder / تذكير سورة الكهف** under **Reminders / تذكيرات** on the existing Nawafel settings screen, alongside Salawat, Duha, Qiyam and Al-Mulk. Match existing Noor spacing, icons, navy/gold colors, RTL/LTR layout and typography.

The reminder is independent of rawatib selection and Nawafel home-card visibility. Do not include it in completed prayer counts or mark Quran progress when a notification is opened.

Default disabled; default local time 09:00; fixed weekday Friday. Users can enable/disable and select the time. There is no sound picker: always silent, with no requested vibration. Tap opens Surah 18 using the user's existing reader/edition preference. Never use a hard-coded Hafs page number for Warsh.

## Authenticated settings API

Send `Authorization: Bearer <accessToken>`. Existing Noor success envelope is used; Dio reads settings at `response.data.data`. Cache-Control is private, no-store.

### GET /profile/kahf-preferences

Example `data`:

```json
{
  "enabled": false,
  "time": "09:00",
  "timezone": "Africa/Cairo",
  "weekday": "FRIDAY",
  "surahId": 18,
  "deepLink": "/quran/surah/18",
  "soundEnabled": false,
  "vibrationEnabled": false,
  "deliveryMode": "SERVER_ONLY",
  "titleAr": "سورة الكهف",
  "titleEn": "Surah Al-Kahf",
  "bodyAr": "تذكير بقراءة سورة الكهف اليوم",
  "bodyEn": "A reminder to read Surah Al-Kahf today"
}
```

### PATCH /profile/kahf-preferences

```json
{"enabled": true, "time": "09:00"}
```

Partial updates supported: `{"enabled":false}` or `{"time":"10:30"}`. At least one field is required. Boolean must be a real JSON boolean. Time is ASCII HH:mm, 00:00–23:59. Unknown fields, weekday overrides and sound settings are rejected. The backend uses the saved account timezone; do not send a timezone here.

Responses: 200 success; 400 invalid input; 401 login required; 404 absent account. On network/5xx failure retain previous confirmed state, show Retry and refetch after uncertain writes. Never show a successful save without persistence confirmation or rollback behavior.

## Delivery ownership and deduplication

**Backend is the only scheduler/sender. Do not schedule a local recurring Friday copy.** Azan `localScheduledUntil` does not cover or suppress this reminder.

The minute scheduler evaluates Friday and target HH:mm in the user's IANA timezone. It uses the existing short late-tick grace, never sends early and does not catch up several hours after downtime. Active accounts must have a registered device token.

Database claim identity is user + `YYYY-MM-DD|KAHF`. Overlapping/retried runs and editing the time after delivery cannot create another send on the same local Friday date. Claims precede send: avoiding duplicate sends is prioritized, and failed provider delivery after claiming is not automatically retried that Friday. This is not an exactly-once delivery guarantee.

Do not manually redisplay a notification already displayed by the OS. Follow existing foreground/background Firebase handling. A permitted foreground display must use the silent channel, existing dedupe mechanism and expiry handling. Never play separate audio or TTS for KAHF.

## Android silent channel — required

Create at app initialization **before FCM token registration**:

- ID: `kahf_silent_v1`.
- Localized name: Surah Al-Kahf reminders.
- Sound disabled, vibration disabled.
- Normal/default importance; no alarm or full-screen behavior.

Adapt to the installed plugin version:

```dart
const channel = AndroidNotificationChannel(
  'kahf_silent_v1',
  'Surah Al-Kahf reminders',
  description: 'Silent Friday reading reminders',
  importance: Importance.defaultImportance,
  playSound: false,
  enableVibration: false,
);
await notifications
    .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>()
    ?.createNotificationChannel(channel);
```

Reuse this channel for permitted foreground display. If missing, FCM may fall back to an audible default channel. Android channel settings persist and users may change them. If an older development build created this ID with sound, coordinate a new versioned silent channel ID with the backend; recreating the same ID does not reliably overwrite established settings. Do not use Mulk/general/Azan channels.

Use existing contextual notification-permission handling. No exact-alarm or background-location permission is needed for this server-delivered feature.

## iOS and silence

Backend omits APNs sound. Foreground presentation must also set sound off (`presentSound: false` or the installed plugin equivalent). Do not enable global foreground sound presentation for KAHF. This is a visible notification without audio, not a data-only silent background push.

OS permission, connectivity and platform delays can affect delivery. Physical Android/iOS verification is required; server configuration alone cannot guarantee silence if the Android channel is wrongly configured or changed by the user.

## Payload and navigation

FCM data includes strings:

```json
{
  "type": "KAHF",
  "eventType": "KAHF",
  "eventKey": "KAHF",
  "kind": "kahf_reminder",
  "surahId": "18",
  "deepLink": "/quran/surah/18",
  "timezone": "Africa/Cairo",
  "dayKey": "2026-10-09",
  "occurrenceKey": "2026-10-09|KAHF",
  "idempotencyKey": "2026-10-09|KAHF",
  "dedupeKey": "2026-10-09|<userId>|KAHF",
  "soundEnabled": "false",
  "vibrationEnabled": "false",
  "androidChannelId": "kahf_silent_v1",
  "source": "SERVER",
  "deliveryMode": "OS_NOTIFICATION",
  "scheduledAtUtc": "<ISO instant>",
  "expiresAtUtc": "<ISO instant>"
}
```

Arabic/English title/body variants are also included. OS push follows the existing Arabic-copy convention; automatic OS language switching is not added by this feature. Foreground/history display may use the provided localized variants.

Existing notification history endpoints surface type KAHF. History payload surahId can be numeric; accept string or integer safely. Tap handling must work foreground, background, terminated and from history. Defer navigation through login if needed. Open Surah 18 in the selected reader without automatically marking reading completed.

## Flutter work

1. Add the reminder row under Nawafel Reminders.
2. Add typed model and authenticated GET/PATCH.
3. Settings page: enabled switch, fixed Friday label, local time picker; no sound control.
4. Format displayed time/numerals using app language, keeping API HH:mm ASCII.
5. Create dedicated silent Android channel before registering FCM token.
6. Handle KAHF in Firebase/history handlers without audible generic fallback.
7. Route taps to Surah 18 in the selected edition.
8. Cancel any experimental local Kahf schedules from previous development builds.
9. Refetch after Travel Mode changes to show the new timezone; keep selected HH:mm.
10. Handle offline, denied notifications and save errors honestly; do not block Quran reading.

## Backend deployment

Migration: `20261010180000_kahf_reminder`. New tables: kahf_preferences and kahf_send_logs, both cascade on account deletion. Notification history is stored as GENERAL with payload.type KAHF and serialized as KAHF; no new notification database enum is required.

Railway Pre-deploy stays `npx prisma migrate deploy`; Start stays `npm start`. No new environment variable or API subscription. Upload code, migration, schema and package files together. Never execute migration statements manually at boot or ignore migration errors.

This feature is saved locally and needs a production check after deployment. Database tests use an isolated schema within a rolled-back transaction and mock push delivery; no real production notification is sent.

## Acceptance tests

- Defaults disabled; enable/time edits/disable persist independently.
- Thursday/Saturday never send; Friday sends at the selected local time, never early.
- Cairo/New York/Kathmandu/international-date-line and DST dates use the account's local Friday.
- Repeated runs or time edits after sending produce no second Friday notification; next Friday can send.
- Android/iOS foreground/background/closed app display without sound; Android channel does not vibrate.
- No local/FCM double display, TTS or separate audio.
- Tap opens correct Surah and edition without adding reading credit.
- Travel changes timezone for the next local Friday schedule.
- Account deletion clears preference/claim records.
- Live Swagger exposes GET/PATCH /profile/kahf-preferences and a dedicated test account can read/write them.
