# Noor — backend/Flutter integration audit and release checklist

Audit date: 23 October 2026. Flutter repository: `MahmoudAbuelazm/noor`, main **7dd857e323c703faaf74b6d6e910d3725f0731a3**. Remote main and the inspected local checkout matched. This is still the earlier Flutter version; backend handoffs published afterwards are not evidence of implementation in Flutter.

## Verdict and evidence limits

There are confirmed integration defects and unfinished release tasks. Do not describe the combined product as error-free or 100% verified. The static inventory found **164 literal Flutter API calls**, matching method/path shapes among **222 registered backend routes**. This rules out obvious missing literal routes in that inventory; it does not validate every request body, dynamic URL, widget, OS permission, account lifecycle or delivery path.

Flutter source and tests were inspected, but Flutter/Dart/ADB were not available on this audit machine. No Flutter analyzer, widget suite, release build or physical phone audio test was run. No real user's progress was changed and no test push was sent to live users.

## Backend fixes delivered by this audit

1. **Tasbih local date:** today/get/increment/reset/change use the account's stored IANA timezone, not the server date. Cairo, Riyadh and Los Angeles boundary cases are covered.
2. **Tasbih lifetime total:** current responses aggregate stored `totalAllTime` contributions across daily rows. A new day or reset of today's counter no longer makes the API lifetime total disappear. Existing records are not rewritten and missing historic data is not invented.
3. **Seven-day stats:** inclusive range is today minus six days through today, rather than eight dates labelled seven days.
4. **Monthly stats:** daily ledger bounds use UTC-encoded calendar dates; challenge counts are filtered by claimedAt between the user's local month start and the next local month start, including year boundaries.
5. **Quran chart targets:** Journey progress, weekly category summary and monthly heatmap use the current canonical Quran goal instead of hardcoded four pages. Additive `quranGoal` metadata exposes pagesTarget/source/basis=`current_goal`. Historical daily goal snapshots do not currently exist: these are comparisons with the CURRENT goal, not reconstructed historical plan targets. Label accordingly; do not claim historical goal fidelity.
6. **Prayer-only activity:** progress rows and calendar heatmaps include a day with completed prayers even when there is no DailyProgress row. It no longer disappears or appears missed solely because that row is absent.
7. **Degraded home response:** unavailable prayer data returns an empty schedule, `prayers.available=false` and `dataStatus=degraded`, rather than fabricated 00:00 entries with a current ISO instant. Do not schedule alarms from unavailable placeholders.
8. **Daily content year:** the normal dashboard's hadith and figure selection receive the user's local calendar year, consistent with the local day ordinal at New Year.
9. **Challenge integration metadata:** dashboard.dailyChallenge exposes `type` and, on the normal path, `dayOfYear`. The home card uses the same challenge-bank fallback as the challenge service when a DB template is absent.
10. **Safe logout/device unlink:** public `POST /auth/logout` additionally accepts optional `fcmToken`. With a valid signed refresh token, refresh revocation and device unlink run together; unlink is scoped to both that token and the refresh-token owner. Legacy refresh-only logout remains supported. An invalid/expired refresh token remains a no-op; this does not guarantee remote cleanup while offline.

These changes preserve existing URLs and legacy fields and do not require a new database schema migration.

## P0 — Flutter tasks before claiming integrated readiness

### A. Fix authenticated Adhkar home, then its cache

`lib/features/azkar/data/datasources/azkar_remote_datasource.dart:getHome()` calls `/adhkar` with `skipAuth:true`. `ApiClient._onRequest` therefore does not attach the session token: the server cannot return that user's personal wird progress. For an authenticated session, make this request with authentication; retain guest/public access explicitly for guests. Public catalog availability is not the same as authenticated progress.

`azkar_repository_impl.dart:getHome()` also returns immediately when the offline static catalog is complete, reusing cached dailyWird progress and never reaching the remote request. Separate immutable content from current account/day progress. Explicitly prefer GENERAL_WIRD; `.where(GENERAL_WIRD || MORNING).first` is order-dependent. Recompute/invalidate the home counter after taps, reconcile confirmed remote progress, and emit fresh state. Do not replace today's content with stale cached item text.

GENERAL_WIRD 0/8 and completed MORNING are different facts. MORNING alone is 50% of the daily morning/evening Journey task and approximately 7% of fourteen weekly portions. Do not mark evening done to make a general-wird counter look complete. Respect the existing general-wird alternative completion policy. Journey model branches currently replace partial captions with `Not yet`/`0`; use server progress and localized partial captions.

### B. Isolate accounts, dates and pending work

`azkar_local_datasource.dart:_progressKey()` includes category only. `TasbihLocalDataSource` uses a global tasbihState key. `OfflineOutbox` uses one global list without account ownership. `UserCachePurger.purgeOnLogout()` does not clear/isolate the legacy outbox or all personal adhkar/tasbih state; the stronger removal occurs only on account deletion. The replay service has no account-owner check. This permits old account work/state to be displayed or replayed into a later session.

Scope all private caches and jobs by owner identity; scope daily counters by the authoritative user day/timezone too. Freeze ownerId, occurredAt, local day and payload when creating a job; never derive ownership from whoever is logged in during replay. Re-check session generation before/after awaits. On account switch, stop in-flight replay and load the next owner's state. Keep guest data separate and merge only intentionally. Quarantine legacy jobs whose owner cannot be proved; do not silently assign them to the next account or silently discard unsynced history.

### C. Implement the notification/audio contract

`devices_remote_datasource.dart:registerFcmToken()` does not submit capabilities. No channel-manifest synchronization was found in this Flutter snapshot. Add schema **3** synchronization and actual bundled-sound reporting, not a hardcoded claim of support. The current manifest contains 117 channels and 53 required sound basenames. Create channels before scheduling/registration, and re-register capabilities even if the token string did not change.

Implement the complete existing handoffs linked below for short Takbir and notification sounds. Short recordings are already served by the backend; they do not install themselves into Android res/raw or the iOS Runner bundle. The Flutter snapshot has no takbir settings/catalog integration and is missing the six at-time sc_event prayer clips in the native resource set inspected earlier. Keep full Adhan, short takbir, prayer announcements and pre-reminder sounds separate.

In `fcm_service.dart`, requested-channel handling occurs before the `!useSound` branch and may still resolve a raw nativeSound. Another fallback path selects azanSoundId when nativeSound is empty. Make explicit silence the first decision in every foreground/background/local path. Parse FCM string flags correctly. Never reinterpret empty nativeSound as permission to play full Adhan. Preserve one audio owner and occurrence deduplication; do not show/play a second copy of an OS notification.

The inspected code has no `ADHKAR_REMINDER` handler/preferences integration. Add the morning/evening/bedtime preference UI and FCM type routing from the existing handoff, or explicitly keep those switches unavailable until wired. Do not advertise a working reminder based solely on a backend endpoint.

### D. Unlink FCM while logging out

`auth_repository_impl.dart:logout()` clears tokens before `FcmService.unregisterOnLogout()`, whose authenticated DELETE may then fail. Capture refresh and FCM tokens before clearing, and send:

```json
{"refreshToken":"<captured refresh token>","fcmToken":"<this device's FCM token>"}
```

Use the public `/auth/logout` request with skipAuth=true; never log either token. If fcmToken is absent, omit it. Alternatively unregister via the authenticated device endpoint while the current session still exists. Preserve session-generation protection against a concurrent refresh resurrecting logout. Cancel private local notifications, clear/isolate private caches, and perform local logout even when network cleanup fails. Consider invalidating this Firebase installation token on logout and obtaining a fresh token on the next login; report offline cleanup as best effort rather than guaranteed server completion.

## P1 — correctness and recovery work

1. **Replay ambiguity and dates:** `OutboxSyncService` replays journeyIncrement/khatmahProgress/tasbihIncrement without a stable server idempotency key; a server commit followed by a lost response can be counted twice. Adhkar and legacy Journey jobs also omit an authoritative completion day and can credit a later day. The backend does NOT yet provide a universal idempotent historical replay contract for these legacy mutations. Do not just add an ignored requestKey field. Prefer the existing `/reading/confirmations` contract for reading units; coordinate a separate server contract/migration for legacy increments. UI must distinguish pending vs confirmed progress.
2. **Queue reliability:** outbox enqueue/remove are read-modify-write operations without serialization. A new enqueue can race a flush/remove and lose work. Serialize mutations. Treat terminal 4xx rejections separately from retryable connection/5xx failures, so one invalid job does not permanently block everything. Unknown OutboxJobType currently defaults to lastReadPut; quarantine unknown versions instead of mutating unrelated last-read state.
3. **Bookmark identity:** bookmarkCreate replay ignores the server-created ID and localId mapping; update/delete ignore local_ IDs. A user can create offline, edit or delete before replay, and still leave a resurrected/stale server bookmark. Coalesce dependent jobs, map localId to real ID, update the cached object, and translate queued references. Do not queue a validation/permission error as an offline success.
4. **Tasbih reconciliation:** remote totals now reflect account-local dates and lifetime contributions. Reconcile by account/day with explicit pending deltas, not unconditional max(local,server). Reset is currently optimistic/best effort without a replayable reset operation, so it can reappear after hydration. Add ordered reset/change handling or make those actions explicitly online-only until the contract exists. Custom tasbih IDs are not supported by `/tasbih/change-dhikr`'s enum; do not imply that selecting a custom local phrase is synced server selection. The legacy server count is daily aggregate, not a per-phrase ledger; don't copy it into the selected-phrase circle. The existing global daily goal of 99 is a product target, not a prescribed count for every phrase.
5. **Challenge truth:** `HomeRepositoryImpl._mergeChallengeProgress()` sets completion from Quran pages regardless of challenge type. Parse the new dailyChallenge.type and apply local reading progress only to QURAN_PAGES; never complete a PRAYER/ADHKAR challenge from pages. Use server-confirmed claim/reward/points, and reconcile rejected claims rather than preserving a local fake success.
6. **Auth resilience:** the refresh code already has single-flight, session generation/version checks and network/server error handling. Keep these. A 200 response with malformed/missing token fields is currently classified as authentication rejection; classify that as integration failure and retain the current session unless the server explicitly rejects it. Test persistent-storage failures and account switching during refresh. The inspected Google Web client ID matches the current configured audience; that does not test the signed Play release's Google sign-in setup.
7. **Content update:** ensure adhkar catalog **v4** replaces the old Quran text and nested cached home/wird items while preserving favorites/progress IDs. A complete static pack must still support version refresh. Retain the Quran-text correction handoff. This audit did not independently certify every hadith, translation, edition or historical story.
8. **Home/reporting:** handle dataStatus=degraded and prayers.available=false as unavailable data, not zero-time alarms. Use dynamic goal fields. `quranGoal.basis=current_goal` is not a historical target snapshot. Respect server daily reading state per selected edition; avoid double credit via legacy increment plus reading confirmations for the same read.
9. **Notification inbox:** markRead/markAllRead update local state before a network request; add pending replay or rollback/reconcile on failure so unread badges don't diverge indefinitely.
10. **Noor Plus:** `lib/features/plus/presentation/pages/noor_plus_page.dart` still uses showComingSoonSnackBar for an action. It is not evidence of a completed paid subscription or purchase flow. Present it as unavailable until implemented; do not count it as a functioning business feature.

## Known backend/operational work still open

- Universal owner/day-aware, idempotent legacy offline mutations are not implemented by this audit; the modern reading confirmation contract is the safer existing path for reading. Historical goal snapshots and per-phrase tasbih selection/counters also need an explicit data model if those cross-device behaviors are required.
- `npm audit --omit=dev` on 23 October reports **12 findings: 4 high, 8 moderate, 0 critical**. Suggested fixes include major Prisma, Firebase Admin and Nodemailer upgrades. No blind force-upgrade was applied to this live backend. A compatibility-tested upgrade remains required; passing functional tests is not proof these findings are harmless or exploitable.
- Rotation/verification of all affected secrets after the earlier hosting incident is not established by this source audit. Never include database URLs, signing keys, service-account JSON or user exports in a Flutter handoff or public repository.
- Latest scheduled backup success, restore drills, external monitoring and real capacity/load remain operational checks. An earlier manual restore verification is not proof every future scheduled run succeeds. No load test or notification delivery SLA was established here.

## Verification record and release gate

New backend regression scripts cover local tasbih/lifetime/reset, exact week/month boundaries, dynamic current Quran targets, prayer-only activity, explicit content year, and signed logout device ownership using a mocked database. Existing tests passed for refresh rotation, notification transport/catalogs, global prayer calculations, calculation-method fixtures (718 prayer times), reading goal math, khatmah plan math, travel, continuity, Fajr alarm, adhkar and reviewed takbir contracts. Typecheck/build are required on the final commit; CI runs the new regression scripts alongside its existing disposable-PostgreSQL checks.

The broad `npm test` run stopped at `test:sadaqah-goal` because its database branch requires a reachable isolated test database. It was deliberately pointed at localhost, not production; do not report that entire suite as passed. Some opt-in DB branches (e.g. READING_TEST_DB) were not run locally. A full seeded disposable DB suite and the Flutter release suite still need completion. No Flutter runtime was available here.

Flutter release gate: run analyzer and existing tests; add regression tests for A–D and each P1 correction; build signed release variants; test two accounts and offline/online replay, local midnight/DST, device reboot, permission denial/recovery, actual foreground/background/terminated audio, two devices with different capabilities, app upgrade from the current Play version, Quran pack update and zero duplicate notifications. Start with Cairo and Riyadh for the reported Fajr/Maghrib case and also a different-offset timezone. Preserve occurrence IDs, titles, prayer keys, channel IDs and requestId in redacted diagnostics; never log tokens or Quran/user content unnecessarily.

## Detailed implementation documents

Use this audit as the prioritized checklist and these files for the full established contracts. They are in the backend repository root; the links open the exact documents, not an instruction to send credentials:

- [Short Takbir: screen design, 14 MP3/CAF assets, API, schema 3, per-prayer modes and release tests](https://github.com/MARiam-2002/NoorApp-Backend/blob/main/FLUTTER_SHORT_TAKBIR_HANDOFF_2026.md)
- [Adhkar progress and cache correction](https://github.com/MARiam-2002/NoorApp-Backend/blob/main/FLUTTER_ADHKAR_PROGRESS_SYNC_FIX_2026.md)
- [Notification sound audit and native wiring](https://github.com/MARiam-2002/NoorApp-Backend/blob/main/FLUTTER_NOTIFICATION_SOUND_FIX_HANDOFF_2026.md)
- [Quran text/cache correction](https://github.com/MARiam-2002/NoorApp-Backend/blob/main/FLUTTER_AYAT_AL_KURSI_TEXT_CORRECTION_2026.md)
- [Adhkar reminder preferences and delivery](https://github.com/MARiam-2002/NoorApp-Backend/blob/main/FLUTTER_ADHKAR_REMINDERS_HANDOFF_2026.md)

Mark each item with implementation commit, test evidence and remaining device limitations. A developer saying “done” without these checks is not verification of the integrated product.
