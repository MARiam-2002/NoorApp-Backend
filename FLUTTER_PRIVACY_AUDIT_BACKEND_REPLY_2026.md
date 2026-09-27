# Backend → Flutter — reply to "Flutter privacy and data inventory" (2026-09-26)

**Date:** 2026-09-27  
**Related:** `docs/BACKEND-PRIVACY-DATA-INVENTORY.md`, `FLUTTER_PLAY_LAUNCH_HANDOFF_2026.md`

Your audit matches the backend. The public pages were updated to match it:

- Privacy Policy: `https://noorapp-backend-production.up.railway.app/privacy`
- Account deletion: `https://noorapp-backend-production.up.railway.app/delete-account`

Both now say **Account tab → Delete account → Confirm**, disclose precise location, Firebase Analytics/Crashlytics, Google Fonts, and the Quran audio hosts, and say that on-device data is removed on uninstall.

This is the **only file** you need from Backend for this round. It replaces the earlier `FLUTTER_PLAY_LAUNCH_HANDOFF_2026.md` updates.

---

## 0. API changes in this deploy (auth)

No endpoint, request, or response shape changed. Only these behaviors:

### `DELETE /auth/me` — new `429`

| Condition | HTTP | `code` |
|-----------|------|--------|
| More than 5 delete attempts / hour for the same user | 429 | `RATE_LIMIT_EXCEEDED` |

On `429`: show `message`, do **not** auto-retry. Other delete errors are unchanged (`401 UNAUTHORIZED` / `INVALID_TOKEN` / `TOKEN_EXPIRED`; on `TOKEN_EXPIRED` refresh once and retry).

### Auth rate limits (same `429` envelope as before)

Limits are now per account, so users sharing a mobile-carrier IP no longer block each other.

| Route | Limit |
|-------|-------|
| `POST /auth/login` | 10 **failed** attempts / 15 min per email (successful logins never count) |
| `POST /auth/sign-up` | 30 / hour per IP |
| `POST /auth/forgot-password` | 5 / hour per email |
| `POST /auth/reset-password` | 10 / hour per reset code |
| `DELETE /auth/me` | 5 / hour per user |

`429` body stays `{ "success": false, "code": "RATE_LIMIT_EXCEEDED", "message": "...", "requestId": "..." }`.

### Bug fixed

Double-tapping login / sign-up (two requests in the same second) used to return `409 CONFLICT`. It now returns `200` for both.

---

## 1. Answers to §17 (backend items)

| # | Question | Answer |
|---|----------|--------|
| 1 | What does `DELETE /auth/me` delete? | Immediate, permanent hard-delete in one DB transaction: user row + everything linked (profile, timezone, lat/lng/city/country, Azan/reading/reminder prefs, Quran bookmarks/notes/last-read/khatmah, prayers, nawafel, adhkar, tasbih + custom phrases, sajdah, journey, sadaqah, challenges/points, stances, ayah history, notifications, FCM device rows, refresh tokens, password-reset tokens). Only a `deleted_identities` row is kept: email, Google `sub`, `deletedAt`. It is removed if the user signs up again with the same email. Database backups (Neon point-in-time restore) expire on their own after the plan's history window; there is no separate backup copy. |
| 2 | Google ID-token claims | Backend verifies the token with Google and reads `sub`, `email`, `name`, `picture`. It **stores** `sub` (as `googleId`/`providerId`), `email`, `name`. `picture` is **not** stored. |
| 3 | Does the backend log IP, bodies, or tokens? | Noor API logs record method, path **without query string**, status, error code, duration, request id, and the Noor `userId`. No IP, no user agent, no email, no request bodies, no tokens, no passwords (tightened in the 2026-09-27 deploy). So coordinates sent as query params (`/qibla/calculate`, `/prayers/*`) are not in Noor logs. IP is used only in memory for rate limiting. Railway (hosting) may keep its own edge logs with IP. |
| 4 | Audio hosts | Quran recitation: `everyayah.com` and `audio.qurancdn.com` (URL returned by `GET /quran/audio`). Azan sounds: Noor server `/api/v1/azan/media/*`. Salawat clips: Noor server `/api/v1/salawat/media/*`. Salawat `listenUrl`/`youtubeUrl`/`spotifyUrl` are external pages the user opens. External hosts see the device IP and file name only, no Noor account data. |
| 15 | Should tomorrow's `GET /prayers/schedule` (coords, no auth) be authenticated? | Not required. Without a token the request is a stateless calculation; nothing is saved and query params are not logged. Keep as is. |
| 16 | Other deletion channels? | Three: in-app (Account tab), the public web page `/delete-account` (email/password form; Google users get an email link), and email to the privacy contact. |

Items 5–14 are Flutter/Product; recommendations below.

---

## 2. Required before Play release (Flutter)

### P0 — full local wipe on account deletion

`deleteAccount` currently reuses `UserCachePurger.purgeOnLogout`. On **delete**, also remove at least:

- `azan_settings` (contains `lastLat`, `lastLng`, `lastLocationLabel`) → reset to Cairo factory defaults
- `prayer_schedule_cache` (+ day / tomorrow variants)
- `offline_outbox` (can hold queued location / worship writes)
- `notifications_cache`, `azan_handled_keys`
- `tasbih_state`, points and challenge keys, adhkar favorites cache
- Home widget keys (`NoorWidgetKeys`) → write empty values and refresh widgets

Keeping public Quran/adhkar SQLite catalogs and downloaded reciter audio is fine (public content, not user data).

### P0 — Advertising ID

No ads in the app, so remove the permission that `firebase_analytics` / Play services may merge, and disable ad-id collection:

```xml
<!-- android/app/src/main/AndroidManifest.xml (inside <manifest>, needs xmlns:tools) -->
<uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove"/>

<!-- inside <application> -->
<meta-data android:name="google_analytics_adid_collection_enabled" android:value="false"/>
```

Then check the merged manifest of the release AAB (`build/app/intermediates/merged_manifests/release/`) and confirm `AD_ID` is gone. Play Console → App content → Advertising ID: **No**.

### P1 — religious data in Analytics

`prayer_marked` (`prayer_key`) and `khatmah_progress` (`surah_id`, `page`) are sent together with the Noor user id. Religious activity is special-category data under GDPR. Pick one:

1. Drop those parameters (keep event names only), **or**
2. Stop calling `Analytics.setUserId` (keep Crashlytics user id), **or**
3. Add a Settings toggle "Share usage analytics" that calls `setAnalyticsCollectionEnabled(false)`.

Option 1 is the smallest change. Tell Backend which one you ship so the Privacy Policy wording matches.

### P2 — nice to have

- Ask notification permission in context (first Azan setup) instead of at cold start.
- Call `FirebaseMessaging.instance.deleteToken()` on account deletion.
- iOS (App Store only): `aps-environment` → `production` for release; remove `fetch` from `UIBackgroundModes` if unused.
- Debug builds log bearer tokens and passwords via `PrettyDioLogger`. Fine for local dev, never ship debug builds to testers.

---

## 3. Play Data Safety — suggested answers

All data: **encrypted in transit: Yes**, **users can request deletion: Yes**, **sold: No**. Firebase/Google act as service providers → **not "shared"**.

| Category | Data type | Collected | Optional? | Purpose |
|----------|-----------|-----------|-----------|---------|
| Location | Precise location | Yes | Optional | App functionality |
| Personal info | Name | Yes | Required for account | Account management |
| Personal info | Email address | Yes | Required for account | Account management, app functionality |
| Personal info | User IDs | Yes | Required for account | Account management, analytics |
| App activity | App interactions | Yes | Required | App functionality, analytics |
| App activity | Other user-generated content (bookmark notes, custom dhikr) | Yes | Optional | App functionality |
| App activity | Other actions (prayer / Quran / worship records) | Yes | Optional | App functionality |
| App info and performance | Crash logs, Diagnostics | Yes | Required | Analytics |
| Device or other IDs | Device or other IDs (FCM token) | Yes | Optional | App functionality |
| Financial info | — | **No** (sadaqah is a self-reported number, no payment) | — | — |

Account creation methods: email/password and Google. Account deletion URL: `/delete-account` above.

---

## 4. Tell Backend if any of these change

- The in-app deletion path (pages say **Account tab → Delete account**).
- Analytics choice from P1.
- New SDKs, permissions, or data sent to the API.
