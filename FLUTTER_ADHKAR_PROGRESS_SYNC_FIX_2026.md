# Adhkar progress integration audit — 23 October 2026

Flutter reviewed: MahmoudAbuelazm/noor, main commit 7dd857e323c703faaf74b6d6e910d3725f0731a3. Local checkout matched the remote main ref. This is a targeted source audit, not certification of the entire app or physical-device testing.

## Required Flutter changes

1. In `lib/features/azkar/data/repositories/azkar_repository_impl.dart`, `getHome()` returns immediately when the static offline catalog is complete. It therefore never refreshes personal progress from the API. Separate static content readiness from user progress freshness. Read current local progress for immediate display, then reconcile authenticated remote progress when online and notify the home state. Saving taps must update/invalidate the home progress cache too.
2. Select `GENERAL_WIRD` explicitly. The current `where(GENERAL_WIRD || MORNING).first` selects whichever category appears first. Do not label morning items as the server's eight-item general wird. Items, category key, goal and completion ledger must belong to the same category and item IDs.
3. In `azkar_local_datasource.dart`, `_progressKey` only includes category. Scope progress by authenticated account (or separate guest identity), authoritative local calendar day and category. Audit logout/session cleanup before relying on it. Never merge yesterday's or another account's counts with today's remote counts using max. On midnight, account switch or timezone change, reload the appropriate day. Do not delete favorites, bookmarks or unrelated reading history.
4. In `journey_today_model.dart`, the azkar branch replaces the supplied caption with `Not yet` and value `0` unless fully done. Respect the server's partial progress and localized caption: morning complete / evening pending is 50% for the daily Journey task. Apply the same correction to the flat fallback in `journey_dashboard_model.dart`.
5. Audit `offline_outbox.dart` and its replay consumer. Adhkar job payload currently contains categoryKey/itemId/tapCount without an explicit completion day or account. Do not replay yesterday's taps as today's worship or replay an old account's jobs after switching accounts. The job envelope's createdAt is not sufficient unless the consumer validates and uses it. Do not invent unsupported backend date fields; use an agreed server-validated contract for historical credit, or retain historical unsynced status without crediting today.
6. Keep optimistic completion visible while offline, with a pending sync state; replace it with confirmed server state after successful synchronization. Surface validation failures instead of treating them as successful completion. Serialize/coalesce concurrent tap updates so max-count merges cannot lose taps.

## Existing backend semantics to preserve

- `dailyWird` is `GENERAL_WIRD`, up to eight items. Completing MORNING alone legitimately leaves this separate counter at 0/8.
- MORNING completion sets morningAdhkarCompleted, not eveningAdhkarCompleted. Daily Journey progress is 50% until evening is complete. The existing alternative GENERAL_WIRD completion policy completes the Journey adhkar task; this audit does not change that policy.
- Weekly adhkar percentage covers fourteen morning/evening portions over seven days. One completed morning is approximately 7%, not 100%.
- Backend repair removes date-generated fake progress from anonymous/degraded GENERAL_WIRD responses; unverifiable progress is zero. It does not erase saved ledger rows or alter API field names.

## Acceptance tests

- Complete every MORNING item's repeat count: morning is confirmed, daily Journey shows 50% and an accurate caption; GENERAL_WIRD remains independently calculated.
- Complete GENERAL_WIRD: home reaches 8/8 immediately, remains correct after navigation, restart and remote refresh.
- Complete morning and evening: Journey reaches 100%; weekly total increases by two portions.
- Test a fully installed offline catalog, stale home cache, offline taps then reconnect, concurrent rapid taps and remote validation errors.
- Test local midnight in Africa/Cairo and Asia/Riyadh, account A → logout → account B, guest → login, timezone changes and delayed outbox replay.
- Verify catalog v4 corrected Quran text survives personal-cache updates; no cached old item text replaces the current static pack.

No Flutter source was modified by this audit. A real Android/iOS build and device test remain required after implementation.
