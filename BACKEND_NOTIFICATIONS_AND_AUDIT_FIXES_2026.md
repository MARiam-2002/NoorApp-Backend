# Noor — Backend fixes (notifications + audit) — 20 October 2026

## Summary

The backend and the Flutter code were audited together. **The reason notification sound does not work is in Flutter** (Android channels were created silent, and some FCM types and sounds are not supported). Details are in `FLUTTER_NOTIFICATION_SOUND_FIX_HANDOFF_2026.md`. The backend is now the source of truth for channels and sounds. It never targets a sound the device does not have, and it repairs the silent channels for devices that update. The most serious audit findings had already been fixed in the repository; they were reviewed and their tests pass.

All changes pass a typecheck (0 errors) and the offline tests. The production database was not touched.

## 1. What changed in the code

> Note: after the audit, other work on the same repository fixed most of the audit findings (Google sign-in, challenges, cron, rate limiter, tasbih, production-database guard, `prisma:deploy` before deploy). That work was kept as is; only the notification fixes were merged on top of it. The final merged version is the one that was typechecked and tested.

### Notification fixes (new)

| # | Change | Files |
| --- | --- | --- |
| 1 | **New endpoint** `GET /api/v1/devices/notification-channels`: returns every Android channel (89), every iOS sound file, every FCM type the backend sends, and the sounds the app must bundle (39). Flutter builds its channels from it instead of guessing. | `src/shared/utils/notification-channel-manifest.ts` (new), `src/routes/devices.ts`, `src/controllers/device.controller.ts` |
| 2 | **Device capabilities**: `POST /devices/fcm-token` accepts `capabilities` (channel schema version, bundled sounds, supported types, permission and exact-alarm state) and stores them per device. `GET /devices` returns them. A request without `platform` no longer resets the platform to `unknown`. | `src/services/device.service.ts`, `prisma/schema.prisma`, migration `20261020120000_device_notification_capabilities` |
| 3 | **Silent channel repair**: for any device that declares `channelSchemaVersion >= 2`, the backend sends to `general_v2`, `mulk_v2` and `khatmah_v2` instead of the old silent channels. Older devices are unchanged. A user with both old and new devices gets one multicast per group. | `src/services/device.service.ts` (`resolveDeviceChannelId`) |
| 4 | **Prayer-time announcement sound**: sent only when every device of the user declared the clip; otherwise the selected Azan voice is used with `audioFallbackReason = ANNOUNCEMENT_NOT_BUNDLED_ON_DEVICE`. Before, it went to a channel the device did not have and played nothing. | `src/services/prayer-reminder.service.ts` |
| 5 | **New test** `npm run test:notification-contract`, also added to `test:fcm-contract`. `test-prayer-delivery` now covers the fallback to the Azan voice. | `scripts/test-notification-contract.ts`, `scripts/test-prayer-delivery.ts`, `package.json` |

### Audit fixes already in the repository (reviewed, tests pass)

Google sign-in uses `google-auth-library` with an explicit audience list and no longer links a LOCAL account whose email is unverified. Challenges are claimable only for the current day in the user's timezone, keyed by year, and the claim is atomic. The user-cleanup endpoint was removed from cron, and the cron secret comparison is constant-time. The global rate limiter keys only valid tokens per user, and password change has its own limiter. Tasbih `amount` is capped at 1000. A guard blocks development and tests from reaching the production database. `npm run prisma:deploy` runs before each Railway deploy, and `prisma:push` was removed.

## 2. Deploy steps (in order)

1. Commit and push. Railway runs `prisma:deploy` before start, which applies the challenges migration (`challenge_claim_year`) and the notifications migration (`device_notification_capabilities`, which only adds a nullable JSONB column).
   - If a migration fails, Railway stops the deploy and the previous version keeps running.
2. **Important before deploying — Google sign-in:** the new code rejects any token whose audience is not in the list, and returns 503 when the list is empty. Flutter uses `serverClientId = 770958562307-2sfil69qvaa33p15r7407b6eip2r6qb1.apps.googleusercontent.com`, but your `.env` has `GOOGLE_SERVER_CLIENT_ID=…-d3o03m06…`, which is a **different client**. Set on Railway:
   - `GOOGLE_SERVER_CLIENT_ID=770958562307-2sfil69qvaa33p15r7407b6eip2r6qb1.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_IDS=` any other client that issues tokens for the app (Android client, and `…-d3o03m06…` if still used), comma-separated.
   - Note: the iOS project has no `CLIENT_ID` in `GoogleService-Info.plist` and no `GIDClientID` in `Info.plist`, so check that Google sign-in on iOS is configured at all.
   - Right after deploying, test Google sign-in on Android and iOS.
3. After deploying, confirm this URL returns `channelSchemaVersion: 2` and 89 channels:
   `GET https://noorapp-backend-production.up.railway.app/api/v1/devices/notification-channels`
4. Send `FLUTTER_NOTIFICATION_SOUND_FIX_HANDOFF_2026.md` to the Flutter team (a copy is in the Flutter folder). The backend is compatible with the current app; once Flutter ships schema 2, sound starts working automatically.

## 3. What was verified

- `tsc --noEmit` on the final merged version: 0 errors.
- All offline tests pass on the merged version: `test-notification-contract` (new), `test-security-hardening`, `test-fcm-audio-contract`, `test-prayer-voice-catalog`, `test-near-prayer-resolver`, `test-near-prayer-audit`, `test-prayer-delivery`, `test-salawat-eligibility`, `test-mulk-eligibility`, `test-kahf-reminder`, `test-prayer-global`, `test-adhkar-reminders`.
- Local HTTP test: the new endpoint returned 200 with 89 channels and `Cache-Control: public, max-age=3600`.
- All 39 required sounds exist under `assets/` in the backend. Only 6 are missing from Flutter: `sc_event_fajr/dhuhr/asr/maghrib/isha/jumuah`.
- No request was made to production and no push was sent.

## 4. Still open (from the audit, needs a decision)

| # | Item | Why it was not done now |
| --- | --- | --- |
| H2 | Your local `.env` still points at the production database. The code now blocks access to it, but the secrets are still in the file. | Point `DATABASE_URL` at a local database (`ops/development/compose.yml`) and rotate the production secrets. |
| M2 | Changing the password does not immediately invalidate other access tokens (valid up to 1 hour). | Needs `tokenVersion` plus a matching Flutter change. |
| M4 | No refresh-token reuse detection. | Needs token families plus testing with Flutter. |
| M5 | `refresh_tokens`, `*_send_logs` and notifications tables grow without limit. | Needs a daily cleanup job, ideally after you decide retention periods. |
| M7 | "Today" now uses the user's timezone in challenges and journey, but tasbih, part of adhkar and the dashboard still use server time. | User-visible behaviour change between midnight and 3 AM; needs agreement with Flutter. |
| — | Old LOCAL accounts with an unverified email can no longer sign in with Google (409). | Needs a "verify your email" flow in Flutter for those users. |
| M8 | Dependency vulnerabilities (`npm audit`), including a critical one in `proxy-addr`. A non-breaking `npm audit fix` brings them from 21 to 12 with no critical. | Not applied to `package-lock.json` to avoid disturbing the `google-auth-library` addition. Run `npm audit fix`, then `npm test`. |
| — | No CI runs the typecheck and tests. | Needs GitHub Actions plus a Postgres container. |
