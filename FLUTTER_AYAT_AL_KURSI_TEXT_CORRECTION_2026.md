# Ayat al-Kursi content correction — 22 October 2026

## Confirmed cause and live repair

This was a backend content error, not a font/shaping bug. The old catalog contained `عَلِمَ مَا بَيْنَ أَيْدِيهِمْ` where Quran 2:255 reads `يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ`.

The six live records in MORNING, EVENING, BEFORE_SLEEP, AFTER_PRAYER, SICK and MASJID_AFTER_SALAM were repaired in place in one transaction. Item IDs, category relationships, repetition counts, favorites and user completion records were preserved. Only the erroneous word was replaced; derived textArPlain was invalidated for recalculation. Original public content snapshots were retained separately. Public GET `/api/v1/adhkar/full-catalog` was independently checked after the transaction: all six copies are correct.

The source constant is corrected, and the complete verse is compared against the checked-in Quran 2:255 in `npm run test:adhkar-catalog`, allowing only explicit orthographic normalization. All six source copies must equal the same constant. A guarded, idempotent SQL migration preserves this correction during subsequent deployments.

Source catalog version is now **4**. The currently running API still advertises version **3** until a successful deployment. Do not say existing device caches have all updated merely because the live database is corrected.

## Required Flutter behavior

1. Keep using the Arabic text supplied by the corrected catalog; do not replace fonts or strip Quran diacritics to fix this content issue.
2. For an immediate refresh while production still advertises version 3, call the existing `StaticContentSyncService.retryPack(StaticPackKind.adhkar)` to force a real content download. `ensurePacks(forceCheck: true)` alone is insufficient when version and hash remain equal: `_syncOne` deliberately skips that download.
3. After version 4 is live, run `ensurePacks(forceCheck: true)` at the appropriate online lifecycle point. Verify `/content/static-meta`, `/adhkar/static-meta` and `/adhkar/full-catalog` agree on the new version. Existing scheduled version checks should then trigger the pack update.
4. Refresh the visible category after replacement. Also invalidate/rebuild cached **content** in the Azkar local data source (home/daily-wird/category JSON). `AzkarRepositoryImpl.getHome` currently prefers nonempty `cachedWird.items` over newly downloaded pack items, so refreshing only the offline catalog can leave old text in the daily-wird view.
5. Preserve user progress, favorite IDs, resume marks, offline outbox and authentication. Do not ask users to clear app data or reinstall. Use item IDs to reconcile content. If a one-time local content repair is used before online sync, limit it to the exact confirmed old phrase inside Ayat al-Kursi items; do not run generic Arabic spelling substitutions.
6. For an offline device with an old pack, implement the same narrowly scoped one-time content correction in a client release so the known erroneous text is not displayed indefinitely. An API update cannot modify an offline phone's existing database.

## Acceptance checks

- Install/restore a version-3 cached pack containing the old wording, mark progress and favorite a Kursi item.
- Force-download the corrected pack while the server still advertises version 3; verify the displayed category, home/wird, share card and any bookmark/favorite preview all read `يَعْلَمُ`.
- With version 4 available, verify normal version sync downloads it, replaces content atomically, and preserves progress/favorites/resume state.
- Test an offline device: the narrow local content repair must preserve the rest of the verse exactly and all user state.
- Verify the six categories in Arabic and with accessibility/font scaling. No physical-device UI verification was performed by the backend repair script.

Reference: https://quran.com/2/255 . This is a confirmed correction to one word; it does not certify the entire religious catalog as independently reviewed.
