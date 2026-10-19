# Noor — Your consistency with Noor

Complete backend/Flutter integration handoff — 19 October 2026.

Product title: **استمرارك مع نور** / **Your consistency with Noor**.

## 1. Scope and delivery status

The backend implements a private, account-scoped consistency streak, current/best/total statistics, monthly calendar, milestones, opt-in near-day-end reminder, signed offline context, full Adhkar portion confirmation and optional share-card data. Quran confirmations and guided reading sessions credit the same consistency ledger.

This document describes the delivered backend source and the Flutter work still required. It does not certify a Flutter build, real-phone notification delivery, store approval, load capacity or future 2027 OS behavior. The source must be deployed before the new endpoints work in production.

The feature is free. There are no grace/freeze days, paid recovery, manual restore endpoint, public leaderboard, additional points or religious ranking. It tracks self-reported use of Noor, not someone's faith or proof that worship was performed.

## 2. Exact product rules

One completed calendar day is earned by at least one of:

- A newly accepted Quran reading unit through the existing canonical reading ledger. Hafs editions use their own pages; Warsh uses its own numbered verses. Confirming a real offered unit qualifies; merely opening a page, moving the resume marker, playing audio or starting a session does not.
- Completing one entire offered MORNING, EVENING or GENERAL_WIRD Adhkar portion. GENERAL_WIRD uses up to the first eight actual items, matching Noor's existing daily wird rules. Every required repetition must be completed. One isolated tap or one short guided-session dhikr task does not qualify as a full portion.

A day counts once even if the user completes several pages, both Adhkar portions, retries requests, reinstalls or uses several devices. Quran and Adhkar can both appear as sources for that day without adding another day.

If today is not complete but yesterday is complete, keep yesterday's running streak and show **CONTINUE_TODAY**. Do not reset the counter at the beginning of an unfinished day. After an entire missing calendar day, current streak becomes zero. Best streak, all earned days and total count remain intact. Completing today after a gap starts a new streak of one.

Days legitimately completed offline and synced within the supported window can fill an actual missing day and recompute the streak. This is delayed recording of an accomplishment, not a grace day or purchased restoration. A failed/out-of-window sync must not silently become today's achievement.

Once a day is earned, later counter edits or changing a Khatmah plan do not revoke it. Account deletion removes its records through database cascade.

## 3. Timezone and day boundary

The backend captures the account's saved, valid IANA timezone at first continuity enrolment. This **continuity timezone is fixed** and returned in every relevant response. If the account timezone is missing/invalid, the existing Noor timezone resolver falls back to Africa/Cairo. Set a real profile location/timezone before first enrolment where possible.

Travel/profile timezone changes do not relabel past days or create additional consistency days. Version 1 does not expose an arbitrary timezone-edit endpoint. This deliberately keeps history stable across devices and travel. Show the continuity timezone in settings; if it differs from the phone/profile timezone, explain that the streak and its reminder still follow the displayed continuity timezone. Do not imply that it silently follows every destination.

Use `today`, `serverTime` and `dayEndsAtUtc` from the server. Do not calculate eligibility from the phone's date. Countdown UI should advance from a server-clock offset using monotonic elapsed time and refresh on resume/day boundary. Handle a materially incorrect phone clock as a sync issue.

The server calculates the actual next local date boundary, including DST and fractional offsets. Reminder lead time is measured in real minutes before that boundary. Never assume a day is exactly 86,400 seconds.

Historical import retains the original stored date-only keys; old records do not contain enough information to reconstruct their original timezone. No dates or accomplishments are invented to fill missing history.

## 4. Deployment and compatibility

Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`.

1. Deploy the changed backend source.
2. Run the existing `prisma migrate deploy` deployment step. New migration: `20261019090000_noor_continuity`.
3. Generate the Prisma client through the usual install/build process.
4. Verify health and the authenticated endpoints below with a dedicated test account.
5. Deploy Flutter integration only after the new API is available.

No new Railway environment variables, paid integration, service or additional cron is required. Existing JWT signing configuration is used with a separate purpose prefix for offline contexts. Existing FCM configuration/device-token registration and the existing reminder scheduler/cron route deliver reminders. Ordinary DB/API/FCM usage remains subject to the providers' existing limits and billing.

New tables: `continuity_preferences`, `continuity_days`, `continuity_operations`, `continuity_send_logs`. Migration is additive. Per-user first-use import copies eligible existing daily-progress/reading-unit dates once, preserving their actual stored dates.

Existing required request properties, endpoint paths and response fields remain. The optional `continuity` receipt is added to reading confirmation/session-update bodies. Home/dashboard and Journey today have a new additive `data.continuity` field. Existing `streakDays`, `streak`, `streakCard` and Quran-specific streak fields remain legacy fields with their previous meanings: **do not mix them with the new counter**. Use the canonical continuity object for this feature everywhere.

## 5. API conventions and errors

All continuity routes require `Authorization: Bearer <accessToken>` and return the standard Noor success/error envelope with `Cache-Control: private, no-store`. Send no userId; the token determines the account. Respect existing refresh-token handling: serialize refresh, retry the original request once after success, and do not sign out on network errors, conflicts or 5xx responses.

HTTP 400 means invalid fields, ranges, month, category, duplicate item IDs or an incomplete offered Adhkar portion. HTTP 401 means authentication/refresh handling. HTTP 404 means account unavailable. HTTP 409 means stale settings revision, reused request key with different input, changed Adhkar target or invalid/expired/off-account offline context. Re-fetch/reconcile instead of blindly replacing the user's work. A server/database failure is not a zero streak.

## 6. GET `/continuity`

Read `response.data`. Example with yesterday complete and today pending:

```json
{
  "available": true,
  "currentStreak": 6,
  "bestStreak": 12,
  "totalCompletedDays": 24,
  "completedToday": false,
  "lastCompletedDate": "2026-10-18",
  "status": "CONTINUE_TODAY",
  "milestones": [
    { "days": 7, "achieved": true },
    { "days": 30, "achieved": false },
    { "days": 100, "achieved": false }
  ],
  "today": "2026-10-19",
  "timezone": "Africa/Cairo",
  "serverTime": "2026-10-19T12:00:00.000Z",
  "dayEndsAtUtc": "2026-10-19T21:00:00.000Z",
  "preferences": {
    "remindersEnabled": false,
    "reminderMinutesBeforeMidnight": 120,
    "revision": 0
  },
  "messageAr": "خطوة بسيطة اليوم تكمل استمرارك 🌱",
  "messageEn": "One small activity today keeps your consistency going.",
  "policy": {
    "version": 1,
    "titleAr": "استمرارك مع نور",
    "titleEn": "Your consistency with Noor",
    "minimumReadingUnits": 1,
    "eligibleSources": ["QURAN", "ADHKAR"],
    "graceDays": 0,
    "paidRestoration": false,
    "leaderboard": false,
    "awardsPoints": false,
    "offlineWindowDays": 7,
    "reminderDelivery": "SERVER_ONLY",
    "timezonePolicy": "FIXED_AT_ENROLMENT"
  }
}
```

Status values: `GET_STARTED` (no history), `NEW_START` (history exists but current streak is zero), `CONTINUE_TODAY` (yesterday's streak remains available), `COMPLETED_TODAY` (today is earned).

Milestones are based on best achieved streak, so they remain achieved after a gap. They do not grant points or imply a new award on every fetch. Store per-account celebration acknowledgements locally; compare a fresh before/after summary and show a milestone animation once. On a new device, do not replay all historical celebrations automatically.

Home `data.continuity` and Journey today `data.continuity` have the same summary. On a feature-only failure they can instead contain `{ "available": false, "retryable": true }` while the rest of the screen still loads. Show a retry/unavailable state; preserve a labelled cached summary instead of replacing it with zeros. Direct `/continuity` failures use normal error responses.

## 7. GET `/continuity/calendar?month=2026-10`

Month is optional and defaults to the server's current continuity month. Accepted range is years 2000–2100 and months 01–12. Only one month is returned; do not request an unbounded history payload.

```json
{
  "month": "2026-10",
  "today": "2026-10-19",
  "timezone": "Africa/Cairo",
  "serverTime": "2026-10-19T12:00:00.000Z",
  "days": [
    { "date": "2026-10-01", "completed": true, "isToday": false, "isFuture": false, "sources": ["QURAN", "ADHKAR"] }
  ]
}
```

Actual `days` contains every day in the selected month, including incomplete and future dates, with correct leap-year length. Render future cells neutrally, never as failures. Parse date-only strings as calendar keys, not UTC instants converted into another date by the device timezone.

## 8. PATCH `/continuity/preferences`

Default reminder OFF, default lead time 120 minutes. Example:

```json
{ "expectedRevision": 0, "remindersEnabled": true, "reminderMinutesBeforeMidnight": 120 }
```

Send only edited fields plus `expectedRevision` from the last summary. At least one actual setting is required. Lead time is an integer 60–240 minutes. Unknown fields, timezone edits and string booleans are rejected. The response is a complete updated continuity summary; revision increments for each successful PATCH.

On 409 GET the current summary and reconcile. If a successful response was lost, a retry with the old revision also returns 409: compare the current saved settings before deciding whether another update is needed. Never assume a timeout means nothing was saved.

Keep reminder preference separate from OS permission and FCM-token readiness. Before enabling, explain notifications and check/request permission through Noor's existing flow. A saved preference alone does not establish that the device can receive notifications. Provide a clear OFF action and pending/offline sync state.

## 9. Quran reading integration

Normal reader: use the existing `POST /reading/confirmations` with the real editionId, current contentVersion, expectedPlanId, original server goal date, valid unitKeys and durable requestKey. New accepted units credit continuity in the same transaction. Exact retries and previously credited units never add another day for that same dated confirmation.

Guided reading: use the existing `PATCH /reading/sessions/{id}`. Only offered units, proper revision and the existing session validity rules are accepted. Preparing/opening/pausing a session, completing its short optional dhikr, or completing only reflection does not credit continuity.

The existing legacy Journey Quran page setters/incrementers also credit continuity atomically without changing their response fields. Their old progress semantics still apply; new Flutter code should use canonical reading confirmations rather than call both pathways for the same reading. Saving last-read position or reading history alone is not a qualifying completion.

### Optional `continuity` receipt on both existing reading write bodies

```json
{
  "context": "<context from GET /continuity/offline-context>",
  "completedAt": "2026-10-19T12:05:00.000Z"
}
```

Place this object under the optional body property named `continuity`; all existing required reading fields remain unchanged. Obtain a fresh context while online and retain the original completion timestamp with each queued operation. Prefer including it for guided-session confirmations even while online: a session can span days, and the receipt identifies when the newly confirmed units were actually completed.

With a valid receipt, continuity credits the actual captured completion day in its fixed timezone. The pre-existing reading-plan/session progress ledger retains its own original server day; this change does not rewrite that contract or move Khatmah progress between dates. A session started yesterday can therefore retain yesterday's reading-plan bookkeeping while its newly completed activity counts toward today's consistency.

Without a receipt, old clients retain the verified original server reading-day behavior (bounded for continuity credit). An activity from the account's current profile date maps to the current continuity date after travel; old issued sessions can retain their original eligible date. Out-of-window/future legacy dates do not invent a continuity day. Upgrade Flutter to receipts for precise delayed sync.

`POST /reading/confirmations` still requires its current goal day. It does not become a general historical import API because a receipt is present. To support offline reading across days, prepare and cache an actual guided reading session and its offered content while online, then queue session updates inside its existing seven-day expiry. A signed continuity context does not bypass session/plan/content-version checks.

An ordinary confirmation receipt must fall on that same current reading day in the account's profile timezone. A session receipt must not predate creation of the offered session. These checks prevent a newly created session or today's normal reader from being used to fabricate an earlier reading day.

Do not post another invented “streak increment” after Quran confirmation. Re-fetch `/continuity` and invalidate Home/Journey cached continuity after success. No separate arbitrary Quran-completion endpoint exists.

## 10. Full Adhkar portion integration

### GET `/continuity/adhkar-target?category=GENERAL_WIRD`

Allowed categories: MORNING, EVENING, GENERAL_WIRD. Response fields:

```json
{
  "category": "GENERAL_WIRD",
  "targetVersion": "<64-character SHA-256>",
  "requiredItems": [{ "itemId": "<actual item ID>", "repeatCount": 3 }],
  "categoryId": "<database category ID or null>",
  "progressMode": "PERSISTED_DHIKR_LEDGER"
}
```

The real array includes the complete required portion. Use returned IDs and repeat counts, matched against Noor's normal Adhkar catalog for the text. Do not substitute another catalog's IDs or hardcode the example UUID/number of items.

If no persisted category items exist, the server can provide its static fallback target with `progressMode: FALLBACK_CONTINUITY_ONLY`, fallback IDs and null categoryId. This can earn a continuity day, but does not pretend that those IDs exist in the FK-backed global Dhikr ledger.

### POST `/continuity/adhkar-completions`

```json
{
  "requestKey": "<persisted UUID>",
  "category": "GENERAL_WIRD",
  "targetVersion": "<exact returned targetVersion>",
  "items": [{ "itemId": "<actual required ID>", "countDone": 3 }],
  "offline": {
    "context": "<signed context>",
    "completedAt": "2026-10-19T12:05:00.000Z"
  }
}
```

`offline` is optional: without it the server uses receipt time in the continuity timezone. Use the captured receipt for queued work. Submit every required item exactly once; no extra or unknown IDs. All counts must meet the offered repeat count. Whole integers 0–100000 are accepted as input; the server credits the target requirement, never sums inflated counts. Maximum 200 items per request.

Persist one requestKey and the exact immutable payload before network submission. Exact request replay returns the original saved result even after context expiry, because no new credit is being created. Harmless item-order differences are canonicalized. Same key with different work returns 409; a new requestKey with the same complete portion still cannot add a second day.

The server validates current targetVersion; a changed target returns 409. Re-fetch and reconcile the actual completed portion; do not fabricate missing repetitions, rewrite the original completion time, or create an online success to hide an expired offline event.

For persisted targets, completion max-merges target counts into the existing Dhikr ledger and updates the existing daily flags in the same transaction as continuity and the durable request result. It does not overwrite a higher count or add a replay to it. For a fallback target, only continuity is credited. Check `globalAdhkarCredit` in the response.

Response `data`: `creditedDate`, `timezone`, `dayChanged`, `globalAdhkarCredit`, `summary`. `dayChanged` can mean a new source was added to an already earned day; it is not an extra streak day. Use summary totals as the authority. An idempotent replay contains its original summary snapshot; fetch a fresh summary when the response is old or after draining an offline queue.

Existing online Adhkar tap/Journey completion endpoints continue working. Actual completed category flags can credit continuity on the write path; GET-only cosmetic progress does not. This implementation also resolves those daily Adhkar operations using the saved account's local day instead of host-machine midnight. New Flutter offline completion should use the endpoint above rather than replay old taps as if they occurred today.

## 11. GET `/continuity/offline-context`

Returns `context`, `timezone`, `issuedAt`, `expiresAt`, `policy`. It is authenticated, bound to one account and fixed timezone, signed with a separate-purpose HMAC, and valid for seven elapsed days from issue. Store it privately under that account. Never embed it in a share card, analytics event, screenshot, public link or another user's request.

The completion timestamp must be at or after issue, not materially in the future, before expiry, and received while the context is still valid. Future calendar days and edited signatures are rejected. A context downloaded today cannot retroactively authorize yesterday. Refresh it while online before expiry, and obtain it before offline use begins.

Offline queue rules:

1. Keep account ID, endpoint, stable requestKey, exact payload, original context and original UTC completion timestamp together in durable local storage. Capture timestamps using an estimated server-clock offset/monotonic elapsed time when the device clock is wrong; do not manufacture a different timestamp on retry.
2. Show provisional local completion as **pending sync**; do not present an unconfirmed value as the authoritative server streak.
3. For session updates, preserve per-session ordering/revisions and refresh/reconcile after conflicts. Do not collapse completions from different days into a single timestamped batch.
4. Retry network/5xx failures with the same immutable requestKey and payload. Never assign the current time to an old completion on retry.
5. On 409 retain the user's local work for an honest conflict/expired status. Refresh applicable settings/session/target and reconcile explicitly. No automatic date shifting or grace-day replacement.
6. After successful drain, refresh continuity summary/calendar and Home/Journey. A valid late event can reconnect an earlier gap.
7. Logout/account switch: isolate and stop processing that account's queue, contexts and cached summaries. Never send a former account's work with a new token. Apply the app's explicit retention/deletion policy; do not silently discard unfinished work without telling the user.

The timestamp/content is still user-confirmed activity, not a tamper-proof observation of a human reading or reciting. Signing constrains account, dates and replay, not the physical truth of worship. No money or competitive score depends on it.

## 12. Reminder delivery — backend owns it

Opt-in only, silent by default, 120 minutes before the actual continuity day boundary; supported setting range 60–240. The existing scheduler checks for a due window with ten-minute late tolerance. If the scheduler misses that window, it does not send an hours-late catch-up or yesterday's reminder.

Send only when the user has an active streak ending yesterday, has not earned today, remains active, enabled this preference and has an FCM device token. No empty-account daily nag. The server rechecks eligibility and preferences under the same owner lock used by completion writes, and again before dispatch. Completion committed before the claim suppresses the reminder.

Durable account/day claims prevent multiple scheduler processes, external cron calls or replicas from sending another logical occurrence. There is one account occurrence; each registered device can receive its own copy. Provider failures/ambiguous dispatches are not automatically retried under a new claim, because that could duplicate an already delivered message. This favors at-most-once attempts, not guaranteed delivery.

Flutter must NOT schedule a second local continuity reminder. Add FCM handling for:

```json
{
  "type": "CONTINUITY",
  "eventType": "CONTINUITY",
  "kind": "continuity_reminder",
  "deepLink": "/continuity",
  "dayKey": "2026-10-19",
  "timezone": "Africa/Cairo",
  "occurrenceKey": "CONTINUITY|2026-10-19",
  "idempotencyKey": "CONTINUITY|2026-10-19",
  "dedupeKey": "<account>|CONTINUITY|2026-10-19",
  "source": "SERVER",
  "deliveryMode": "OS_NOTIFICATION",
  "soundEnabled": "false",
  "vibrationEnabled": "false",
  "androidChannelId": "continuity_silent_v1",
  "expiresAtUtc": "<real next boundary UTC>",
  "scheduledAtUtc": "<due UTC>"
}
```

Data also includes Arabic/English title/body. Use the existing app-wide FCM rendering policy: do not display another local notification on top of an OS-rendered background notification. In foreground, suppress expired or already handled occurrences and use the appropriate locale. Android channel should be silent with vibration disabled; no alarm/exact-alarm/fullscreen permission is required for this feature.

On tap, authenticate if needed, refresh summary and open the consistency screen. If today's work has already completed locally/server-side, show the completed state rather than a warning. Cancel any app-managed matching displayed notification after completion when the platform permits.

An already in-flight or OS-displayed push cannot always be recalled. The backend cannot know an unsynced offline accomplishment, and FCM/OS/network settings can delay or suppress delivery. Never promise that a banner will disappear instantly on every device. Clear stale warnings in UI after refresh and avoid guilt-based copy.

## 13. UI, calendar, milestones and optional share card

Home card: title, current streak and today's done/pending status. Detail screen: current streak, best streak, total completed days, monthly calendar, timezone, reminder setting, and useful actions to Quran/Adhkar. Keep statistics readable with Arabic/English locale and font scaling; don't reverse digits in dates or countdowns.

Use calm wording: **يوم جديد، نكمّل مع بعض 🌱** after a gap. Do not erase total achievements or show a red moral-failure message. Keep sharing optional and no friend comparison/rankings.

`GET /continuity/share` returns titleAr/titleEn, currentStreak, bestStreak, totalCompletedDays, textAr/textEn, `includesWorshipDetails:false`, and generatedAt. It is private data for Flutter to render, not an uploaded public image or automatic social post.

Flutter renders a branded card with a few accessible design variants in Noor colors, localizes its text and opens the native share sheet only after an explicit user action. Exclude prayer checklists, reading history, Adhkar category names, account email/ID and offline contexts. Refresh before generating; label/avoid sharing provisional unsynced numbers.

Do not force account contacts, camera, microphone, location or gallery permissions for the share card. Use app-private temporary output and the platform's normal share mechanism. Clean up temporary images according to platform lifecycle, not by deleting user files.

## 14. Required Flutter acceptance tests

1. New account has zero stats, reminder OFF, no day earned by Home/continuity/calendar GET.
2. One genuine Quran-unit confirmation or full Adhkar portion earns one day. Repeat requests, double taps and two devices stay one day. Short/incomplete Dhikr tasks do not qualify.
3. Yesterday's streak survives while today remains open. After a fully missed day, only current streak resets; history, best and totals remain.
4. Late valid offline completion credits its original captured day and can fill a real gap. Expired, pre-issue, future, wrong-account and altered contexts do not become today's activity.
5. Session revision/plan/content conflict preserves the local queue for reconciliation. Never repeat an old request under a new key just to bypass a conflict.
6. Gregorian month/year boundaries, leap day, Cairo/New York DST, fractional offsets and date-line zones use server day keys/boundary. Device clock edits and timezone changes do not invent days.
7. Travel keeps the explicitly displayed continuity timezone stable. Quran prayer/location UI can independently use its existing current location behavior.
8. Reminder permission denied, no FCM token, OFF, completed today, no active streak, duplicate delivery, delayed/expired delivery and account switching are handled without duplicated local notifications.
9. Network/5xx/unavailable continuity never logs out the user or replaces a valid cached streak with a new confirmed zero.
10. Milestone animation occurs once for a newly reached threshold. No points/currency or past milestone replay on every launch.
11. Share card contains only intended aggregate data, respects explicit user action and works with RTL, large text and both locales.
12. No grace day, purchased recovery, restore button, religious ranking or extra streak increment appears in the app.

## 15. Backend validation and practical release boundary

New tests: `npm run test:continuity`. PostgreSQL/HTTP/race suite: set `$env:CONTINUITY_TEST_DB='true'` in PowerShell and run the same command with an authorized reachable database. The suite creates a uniquely named test schema, uses independent transactions for actual race checks, stubs only external delivery/account lookups where needed, and removes the entire test schema in finally. It does not edit real/public user tables or send pushes to real users.

Checks cover counters/gaps/history, leap/year boundaries, signed offline constraints, DST/global day ends, preferences, actual migration, legacy-history import, full target validation, max-merge, idempotency, real concurrent completion/preference/cron requests, Quran ledger integration/rollback, late offline gap filling, fallback target mode, timezone immutability, auth/cache/errors, calendar and account cascade. Existing reading-session integration and Adhkar derivation regression tests are run separately.

These checks validate the backend logic and contract. They do not replace testing the actual Flutter build, real FCM delivery, provider outages, user acceptance or realistic load. Complete the phone acceptance list above and verify the deployed endpoints before calling the end-to-end feature ready for release.
