# Noor — Morning, evening and bedtime Adhkar reminders

Backend implementation and complete Flutter integration handoff — 20 October 2026.

## 1. What is implemented

Three independent opt-in reminders: **أذكار الصباح**, **أذكار المساء** and **أذكار النوم** (BEFORE_SLEEP). Each has a configurable local HH:mm. Initial defaults are OFF, morning 07:00, evening 17:00, bedtime 22:00, sound OFF. Times are user-editable reminders, not a claim that the religious time for every country is always 07:00/17:00.

The backend owns scheduling and push dispatch through Noor's existing reminder runner. It suppresses a reminder when the actual complete matching Adhkar category is recorded for that account/local day. A durable database claim prevents another notification for the same account/day/category across retries, multiple cron callers, repeated DST hours and time edits.

Flutter must provide settings, notification permission/token handling, notification channels, category routing and foreground deduplication. This document is not proof that those client changes or real-phone FCM delivery have already been tested.

There is no new audio download, alarm, exact-alarm access, foreground service, GPS permission, microphone or paid notification provider for this feature. It uses existing FCM setup and normal app notifications. Ordinary service usage remains subject to existing provider quotas/billing.

## 2. Deploy before enabling the UI

1. Deploy the changed backend source.
2. Apply `prisma migrate deploy` in the normal deployment step. Migrations: `20261020090000_adhkar_reminders` and the additive `20261020093000_adhkar_bedtime_reminder`. The second migration preserves existing preferences, revisions and send logs; bedtime starts OFF for existing users. Do not replace or edit an already applied migration.
3. Generate Prisma client through the usual install/build process.
4. Check health and GET/PATCH below using a dedicated account.
5. Release the Flutter integration and verify real-device delivery.

New tables: `adhkar_reminder_preferences` and `adhkar_reminder_send_logs`. Both cascade on account deletion. Existing profile, Adhkar progress, continuity, Quran, Adhan and other reminder request/response fields remain unchanged. The cron summary gains an additive `adhkar` section and includes its counts in totals.

No new Railway variables, separate service or additional cron is required. Existing FCM and reminder-scheduler configuration must continue working. Uploading this source is still required; the previous deployment cannot serve these new settings automatically.

## 3. Settings API

Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`.

GET and PATCH `/profile/adhkar-reminder-preferences` require `Authorization: Bearer <accessToken>` and return the standard Noor envelope with `Cache-Control: private, no-store`. Never send userId. Personal settings belong to the authenticated account.

### GET response data

```json
{
  "morningEnabled": false,
  "morningTime": "07:00",
  "eveningEnabled": false,
  "eveningTime": "17:00",
  "bedtimeEnabled": false,
  "bedtimeTime": "22:00",
  "soundEnabled": false,
  "revision": 0,
  "timezone": "Africa/Cairo",
  "deliveryMode": "SERVER_ONLY",
  "skipWhenCompleted": true,
  "timezonePolicy": "CURRENT_PROFILE_TIMEZONE",
  "updatedAt": null
}
```

No saved row means defaults/revision 0, without creating a row. `updatedAt` becomes an ISO timestamp after saving.

### PATCH example

```json
{
  "expectedRevision": 0,
  "morningEnabled": true,
  "morningTime": "07:15",
  "eveningEnabled": true,
  "eveningTime": "17:30",
  "bedtimeEnabled": true,
  "bedtimeTime": "22:00",
  "soundEnabled": false
}
```

`expectedRevision` is required. Send only edited settings. At least one setting must be provided. Unknown keys, string booleans, invalid times, missing/negative/noninteger revisions and empty patches are rejected. HH:mm uses 24-hour ASCII digits with leading zero, 00:00–23:59. Do not send localized Arabic digits to the API; localize only UI presentation.

Every successful PATCH returns full settings and increments revision, including same-value edits. Omitted values retain their previous settings. Disabling one reminder does not disable the others. Older clients that omit bedtime fields preserve the saved bedtime settings.

HTTP 400: invalid input. HTTP 401: existing serialized access-token refresh flow. HTTP 404: account missing. HTTP 409: stale expectedRevision. Fetch current settings and reconcile before another update. A response lost after a successful save can make a retry return 409: compare the intended fields with the fresh GET rather than overwriting newer settings. Network errors and 5xx do not mean the user should be signed out.

## 4. Flutter settings and user experience

Add an **تذكير بالأذكار** card on the Adhkar hub/settings screen:

- Separate morning, evening and bedtime toggles and accessible time pickers.
- One optional notification-sound toggle. Silent is the initial default.
- Display the returned profile timezone and a link to Noor's existing location/timezone settings.
- Explain **لن نذكّرك بالورد إذا أكملته بالفعل** and show pending-save/error states accurately.
- Do not automatically enable any reminders for an existing account, after reinstall or simply because the user opened the screen.

Before enabling: explain notifications, request/check the ordinary OS notification permission, create the native channels, and register the FCM token with the existing device endpoint. Separate account preference from device capability. A saved ON toggle does not guarantee that OS notifications or delivery are available on this phone.

Serialize saves or reconcile 409s. On explicit OFF while offline, show that the server change is pending: this is a server-owned reminder, so an unsent preference change cannot stop a server push immediately. Do not pretend that a local toggle changed the server. Retry the deliberate saved change after reconnect and surface unresolved conflicts.

These reminders follow the **current saved account/profile timezone**, unlike the fixed timezone of Noor's continuity streak. Changing the phone timezone alone does not update the saved account timezone. Use the existing location/travel flow and then re-fetch these settings. No separate Adhkar GPS/background-tracking mechanism is needed.

Version 1 uses explicit local-clock times; it does not automatically follow Fajr/Asr prayer times. The app should not label these as prayer-relative or universally prescribed religious times.

### Bedtime versus Surah Al-Mulk

BEFORE_SLEEP opens the actual bedtime Adhkar category. The existing Surah Al-Mulk reminder is separate: never toggle its preferences, mark it read, or merge completion with bedtime Adhkar. If the user deliberately chooses the same time for both, two distinct reminders may arrive. The UI may offer a gentle time-conflict hint and an edit shortcut, but must not silently disable or merge either reminder.

## 5. Delivery ownership and timing

Delivery mode is `SERVER_ONLY`. Flutter MUST NOT schedule a second local morning/evening/bedtime notification for these settings, or mirror an incoming OS-rendered push with another notification. Remove/deactivate duplicate local scheduling for these three reminders when integrating this flow, without touching unrelated Adhan, Fajr wake-up or other reminders.

The existing per-minute backend scheduler and external backup cron use one shared runner. Delivery has a bounded ten-minute late tolerance. There is no hours-late or previous-day catch-up if the service was unavailable. A nonexistent local clock time during a DST jump is skipped; a repeated hour cannot produce a second logical occurrence. Defaults at 07:00/17:00/22:00 avoid the usual overnight DST gap.

The dedupe identity is account + local date + MORNING/EVENING/BEFORE_SLEEP, independent of the chosen time, sound and revision. Editing a time or disabling/re-enabling after a claim does not schedule another occurrence of that category today. The three categories are distinct: the expected maximum is three logical account occurrences per local day when all are enabled and due. Bedtime after midnight belongs to the new profile-local calendar date. The server does not infer when the user actually goes to sleep.

Every currently registered device may receive its own copy. Do not interpret multiple devices as duplicate account claims. Server filtering requires an active account and a registered device token. No token/permission/network means no guaranteed push; account preferences remain saved.

Provider failures or crashes after a claim are not blindly retried, because a timed-out provider request might already have delivered the message. This is at-most-once dispatch, not an exactly-once delivery guarantee. Logs can retain CLAIMED for an ambiguous failure, or SENT/FAILED/CANCELLED after a known result. Finishing/turning OFF after an already-dispatched push cannot always recall an OS banner.

## 6. Correct completion suppression

Suppression checks all actual items and required repetitions in the matching MORNING, EVENING or BEFORE_SLEEP database category for the same profile-local date. Partial completion does not suppress it. Completing one category does not suppress either of the others.

Do NOT use Home's `morningAdhkarCompleted`/`eveningAdhkarCompleted` flags as exact category evidence for this feature. Existing GENERAL_WIRD completion can force both of those legacy Journey flags to true; it is a different portion. The server deliberately reads the actual Dhikr ledger instead, so finishing GENERAL_WIRD alone does not hide a still-unfinished morning/evening reminder.

The existing normal Adhkar progress endpoints, and the new continuity full-category confirmation when it persists real Dhikr rows, supply the matching ledger. A fallback-only continuity accomplishment does not fabricate FK-backed category counts, and therefore may not suppress the reminder. Unsynced offline work also cannot be known to the server yet.

Flutter should show the actual selected category progress on the opened Adhkar screen, not mark it done just because the notification was tapped or a legacy Home checkbox is true. Only activities qualifying under the existing continuity contract can advance continuity. Adding bedtime reminders does not expand that policy; BEFORE_SLEEP alone is not a new qualifying continuity activity. In particular, receiving/opening/dismissing the reminder earns no day, points or prayer completion.

## 7. FCM routing and payload

Representative data payload (all FCM data values are strings):

```json
{
  "type": "ADHKAR_REMINDER",
  "eventType": "ADHKAR_REMINDER",
  "kind": "adhkar_reminder",
  "categoryKey": "MORNING",
  "deepLink": "/adhkar/MORNING",
  "dayKey": "2026-10-20",
  "timezone": "Africa/Cairo",
  "occurrenceKey": "ADHKAR_REMINDER|2026-10-20|MORNING",
  "idempotencyKey": "ADHKAR_REMINDER|2026-10-20|MORNING",
  "dedupeKey": "<account>|ADHKAR_REMINDER|2026-10-20|MORNING",
  "source": "SERVER",
  "deliveryMode": "OS_NOTIFICATION",
  "androidChannelId": "adhkar_reminders_silent_v1",
  "soundEnabled": "false",
  "vibrationEnabled": "false",
  "expiresAtUtc": "<ISO UTC expiry>",
  "titleAr": "أذكار الصباح",
  "titleEn": "Morning adhkar",
  "bodyAr": "وقت هادئ لورد أذكار الصباح 🌿",
  "bodyEn": "Take a quiet moment for your morning adhkar."
}
```

Evening uses `categoryKey: EVENING`, deepLink `/adhkar/EVENING`, its own occurrence identity and evening text. Bedtime uses `categoryKey: BEFORE_SLEEP`, deepLink `/adhkar/BEFORE_SLEEP`, title `أذكار النوم` / `Bedtime adhkar`, and body `اختم يومك بأذكار النوم 🌙` / `End your day with your bedtime adhkar.` Its occurrence identity ends in BEFORE_SLEEP. The normal default OS alert uses the Arabic title/body; localized Arabic/English strings are also supplied in data for client presentation. Do not assume that a background OS-rendered alert is automatically localized per device.

Implement all three category routes. In foreground, use the existing app-wide notification renderer, dedupe per account/occurrence, suppress expired/already handled events and avoid adding another banner when the matching category is already complete locally. In background/terminated state, reuse the OS-rendered notification and handle its tap; do not create a duplicate local notification in the background handler.

On tap: wait for app initialization/auth restoration if needed, load the actual category and restore its reading/tap progress. Fetch content through existing `/adhkar/categories/MORNING`, `/adhkar/categories/EVENING` or `/adhkar/categories/BEFORE_SLEEP` APIs or the valid cached Adhkar catalog. The frontend deepLink and the API content path have different purposes.

Preserve only a safe pending category route across cold start. Do not apply old account settings/queue updates to another signed-in account. Register/update the device token using the existing flow and unregister it on logout as appropriate.

## 8. Native channels and sound

Create both Android channels at app startup **before device-token registration and reminder opt-in**:

- `adhkar_reminders_silent_v1`: silent sound, vibration disabled.
- `adhkar_reminders_default_v1`: normal notification sound, vibration disabled.

Use normal reminder notification importance; no fullscreen alarm UI. Android channel sound settings are sticky/user-controlled, so the backend switches channel IDs when soundEnabled changes. Do not try to mutate an existing channel's sound silently or override a user's system settings. If a channel is missing, Android can fall back to a different channel; that is why startup registration is required even before the user visits this settings page.

For sound OFF the backend passes no APNs/Android native sound. Sound ON uses the normal system notification sound. No MP3 streaming is involved. Respect notification/DND/volume settings and do not request critical-alert entitlement or alarm permissions for this reminder.

TTL is bounded to at most one hour from dispatch and never beyond the profile-local day boundary. Flutter also checks `expiresAtUtc` for app-managed presentation. Do not replay old notifications when reconnecting after several hours.

## 9. In-app notification inbox

After a dispatch attempt the backend records an item through Noor's existing notification inbox service. Storage uses the existing GENERAL type to preserve the current enum/contract; the top-level serialized type can therefore be SYSTEM. Identify this reminder using `payload.eventType: ADHKAR_REMINDER`, `payload.kind` and `payload.categoryKey`, then route to the matching category.

Do not show a second OS notification simply because the inbox was fetched. Existing unread/read handling remains unchanged. A push may succeed while an inbox write fails, or an inbox item may exist after a failed push; the backend logs these outcomes and does not retry a whole logical occurrence to repair one channel.

## 10. Failure handling and device acceptance

Required checks before releasing Flutter:

1. All three toggles start OFF. Enable each individually, then all three; individual times and partial saves persist after relaunch.
2. Denied/granted/revoked OS notification permission, missing/rotated FCM token and logout/account switch have clear states and do not cause duplicate registration/display.
3. Correct category opens from foreground/background/terminated app and after auth restoration; no lost route or auto-completion.
4. Silent and default channels exist before opt-in. Sound toggle selects the right channel; system user overrides/DND are respected.
5. Repeated FCM delivery and concurrent callback paths display at most one app-managed copy per account/occurrence. OS-rendered background notifications are not mirrored.
6. Actual complete MORNING suppresses morning; partial morning and GENERAL_WIRD-only completion do not. Evening and bedtime remain independent. Fully completed BEFORE_SLEEP suppresses bedtime; partially completed bedtime does not. Verify the real category counters rather than legacy combined Journey flags.
7. Completing the portion while offline shows provisional local completion; after valid sync the backend can suppress a not-yet-claimed reminder. In-flight/OS banners may remain, so refresh state and clear app-managed stale presentation when possible.
8. Profile timezone changes, date boundary, repeated DST hour and unsupported/missing local time are handled according to the returned profile timezone, not continuity's fixed timezone or the phone clock alone.
9. Invalid input and 409 conflict are visible/reconciled; network/5xx does not log the user out or silently replace settings with defaults.
10. Verify a real end-to-end FCM message on Android/iOS with a dedicated consenting test device and account. Do not trigger a production-wide cron just to test one phone.

## 11. Backend verification performed

`npm run test:adhkar-reminders` covers defaults, strict settings schema, partial-edit preservation, global clocks, DST repeated/missing hours, no previous-day catch-up and OpenAPI.

For the isolated PostgreSQL/HTTP suite set `$env:ADHKAR_REMINDER_TEST_DB='true'` and run the same command. It applies both actual migrations in a unique test schema, including an upgrade fixture proving existing preferences/revisions/send logs survive, and uses independent transactions to test preference conflicts and simultaneous runner dedupe. It checks category completion, partial/wird-only distinction, no-token/inactive accounts, provider ambiguity, time-edit dedupe, separate morning/evening/bedtime events, bedtime-only account selection, completed-bedtime suppression, old-client partial saves and after-midnight bedtime dates, sound channels, DST/travel identity, authenticated cache behavior and account-delete cascade. External delivery and inbox creation are mocked: no real users receive a test push. The unique test schema is removed afterward.

Backend tests validate the delivered source. Production deployment, actual Flutter integration, physical-device delivery and future platform behavior need their own checks; no test suite guarantees 100% delivery in every network/OS condition.
