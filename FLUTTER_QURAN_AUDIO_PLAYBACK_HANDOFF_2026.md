# Noor Quran Audio Playback — Flutter Integration (2026/2027)

## Scope and release boundary

This document supersedes the small Banna-only handoff for audio playback integration. The backend supplies public audio catalogs and ordered verse playlists. Flutter implements playback, buffering, download storage, background controls and UI. These capabilities do not appear in the mobile app merely because the backend is deployed.

Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`

No database migration is needed. Existing reader string IDs, numeric Quran Foundation aliases, and the Alafasy default remain unchanged. The legacy `/quran/reciters` response remains an array. Banna has no Quran Foundation resource ID: model `resourceId` as nullable/optional, never default it to zero or another reader's ID.

The supplied external JSON contains 45 recording entries, including multiple styles, not necessarily 45 distinct people. It is **not activated** by this release. Do not copy its numeric IDs into Noor selections: they are unrelated to Quran Foundation resource IDs. Do not assume `001000.mp3` is Quran verse 1:1. External-provider basmala/verse mapping and recording completeness need separate validation before publication. Never decrement verse numbers globally.

## Backend endpoints

All responses use Noor's existing `{ success, data, message, meta, timestamp, requestId }` envelope. New endpoints are public and return `Cache-Control: public, max-age=300` on success.

### GET /quran/audio/catalog

`data` contains:

- `schemaVersion: 1`
- `catalogVersion: 1` — audio-specific version, separate from Quran text catalog versions.
- `defaultReciterId: "Mishary_Alafasy"`
- `reciters`: existing reader objects enriched with:
  - `riwaya: "Hafs"`
  - `provider: "everyayah"`
  - `availableQualities`: actual configured bitrate numbers, e.g. `[32]` for Banna. Currently one configured quality per reader; no fictional 64/128 options.
  - `filenamePattern: "{surah:03}{ayah:03}.mp3"`
  - `ayahNumbering: "one_based"`
  - `supportsAyahPlayback: true`
  - `supportsFullSurahFile: false`

Use this endpoint for the new playback UI. Preserve an existing saved reader if it still exists. A catalog refresh must not overwrite a valid selection. For a removed/unknown reader ask the user to select a reader and show the actual selection clearly.

### GET /quran/audio/playlist

Query parameters:

- `surahId`: required integer 1–114.
- `reciterId`: optional stable Noor reader ID. Omitted means Alafasy. Numeric aliases work for existing readers with an assigned Quran Foundation resource ID; prefer string IDs.
- `fromAyah`: optional, defaults to 1.
- `toAyah`: optional, defaults to the surah's actual final verse.
- `qualityKbps`: optional; must be one of that reader's advertised qualities. Omitted chooses the configured quality.

Example: `/quran/audio/playlist?surahId=2&fromAyah=255&toAyah=257&reciterId=Mahmoud_Ali_Al_Banna&qualityKbps=32`

`data` contains schema/catalog versions, enriched `reciter`, `surahId`, `totalAyahs`, `fromAyah`, `toAyah`, `qualityKbps`, and ordered `items`:

```json
{
  "verseKey": "2:255",
  "surahId": 2,
  "ayahNumber": 255,
  "audioUrl": "https://everyayah.com/data/mahmoud_ali_al_banna_32kbps/002255.mp3",
  "cacheKey": "quran-audio:v1:Mahmoud_Ali_Al_Banna:32:2:255"
}
```

One request returns up to 286 entries (a complete Al-Baqarah). No per-verse external lookup or database query is performed by the playlist service. This endpoint returns URLs, not audio bytes, merged audio, timings, or a server download archive. URLs are not evidence that every remote file is currently reachable.

HTTP 400: unknown reader, invalid surah/verse, reverse range, malformed query, or unavailable quality. Do not retry a 400 indefinitely. Never replace a failed chosen reader with Alafasy under the original label.

### Existing GET /quran/audio

Still supports `surahId`, `ayahNumber`, and `reciter` / `reciterId` / `id`. It may return Quran Foundation audio with an EveryAyah fallback as before. Invalid verse coordinates and unknown readers now return 400 instead of a misleading URL/default voice. Banna resolves through EveryAyah. Use the new playlist consistently within a playback session; do not mix provider files arbitrarily between verses.

## Flutter playback architecture

### Specific findings in the available local Flutter snapshot

These files were inspected read-only; they were not edited by this backend change. Reconcile with the developer's latest branch before applying changes.

- `lib/features/quran/data/quran_audio_handler.dart`: `playAyah` calls `setUrl`/`setFilePath` for each verse. Replace this per-verse loading cycle with an ordered queue. `_prefetchUrl` caches a URL string only, not the next audio's bytes. It is also invoked after `await _player.play()`; do not rely on this placement for lookahead buffering. Start preparation before waiting for playback completion.
- In that handler, `_onComplete` probes the next verse through `getAudioUrl` and then `playAyah` may fetch it again. Use the known playlist bounds and native transitions, avoiding duplicate lookups and a request for the non-existent verse after the surah's end. Apply the same bounds to `skipToNext`. Keep the existing generation guard and extend it to queue replacement/preloading.
- Preserve the existing `audio_service` background/lock-screen integration and flip-to-mute bridge while changing queue internals. The snapshot declares `just_audio: ^0.10.6` and `audio_service: ^0.18.19`; inspect the actual lockfile and supported queue API, rather than copying an example for a different package version.
- `lib/features/quran/data/datasources/quran_remote_datasource.dart`: add catalog and playlist methods, keeping existing methods for compatibility. The static fallback reader IDs include entries not in the backend (`Saad_Al_Ghamdi`, `Maher_Al_Muaiqly`, `Sudais_And_Shuraim`). Do not send these as if they were supported: prefer the last successful server catalog, or a clearly labelled offline default actually present in the catalog. Unknown IDs now correctly return 400.
- `lib/features/quran/data/models/quran_models.dart` and `lib/features/quran/domain/entities/quran_entities.dart`: extend the reader models and introduce typed catalog/playlist/item models. Preserve the string ID; parse optional numeric `resourceId` without requiring it. Introduce typed `qualityKbps`, `verseKey`, and `cacheKey` fields.
- `lib/features/quran/data/quran_audio_cache.dart`: introduce quality/version-aware keys and safe migration. Existing downloads are reader/surah/verse keyed; only reuse a legacy file when its reader and configured quality can be determined. Do not delete unrelated user progress during migration.
- `lib/features/quran/presentation/cubit/reciter_audio_download_cubit.dart`: use one playlist per requested surah instead of resolving a remote URL per verse. In `refreshFor`, replace `hasFullPackRough`/count-only completion with verification that every expected manifest item exists and is valid. Do not label a recording pack complete solely from an approximate count.
- `lib/features/quran/presentation/widgets/reciter_audio_download_card.dart`: retain useful progress/pause/cancel controls and add clear per-surah download choices. A complete-reader download remains optional and must accurately track all requested items.

The backend playlist is database-free; adopting it also reduces API calls during large downloads. Actual media traffic still goes to the audio provider, not through the Noor API.

1. Use one application-wide audio session/player, compatible with the project's current Flutter dependencies and Android/iOS versions. Review the pinned dependencies before choosing or upgrading packages.
2. Convert playlist items into an ordered native playback queue with stable media IDs from `cacheKey` and verse metadata. Do not destroy/recreate the player for each verse.
3. Prepare the next few items with bounded lookahead. Test the player's actual network preloading behavior: adding a URL to a Dart list alone does not prove it was buffered.
4. Use player item-transition events to highlight the current verse. Do not guess progress from a timer or file size. No word-level timing is provided.
5. Model idle, loading/buffering, playing, paused, completed and recoverable error states. Show a small buffering indicator near the controls; retain the selected verse.
6. Ignore stale asynchronous results using a playback-session generation ID. Rapid reader/surah switches must not let an earlier fetch replace the current queue.
7. Pause or stop gracefully on interruption, headphones disconnect and audio focus loss. Resume according to platform/user intent; do not compete with prayer alarms, adhan or another app's audio.
8. Never overlap verses with crossfade. Do not automatically trim breaths, silence or verse endings. Sequential playback reduces loading gaps but cannot remove silence embedded in source recordings.

## Player design

- Reader picker with Arabic/English name and distinct style labels (Murattal/Mujawwad/Muallim where present).
- Mini player while browsing, expanded player with surah, verse, reader, play/pause, previous/next verse and repeat.
- Tapping a verse starts that exact verse. A selected range can repeat a configurable finite number of times; avoid accidentally repeating the entire surah.
- Show quality options only when more than one real quality exists; no empty selector for Banna's single 32 kbps source.
- A download button with progress, cancel and explicit completion/failure states. Show storage use and delete controls under downloads.
- Arabic RTL layout, accessible labels, large enough controls and dark/light themes consistent with Noor.
- No full-surah-file choice is advertised by this backend. A full-surah listening session is a queue of verse files, not an invented `001.mp3` URL.

## Downloads, caching and offline behavior

Key audio by the supplied `cacheKey`. Keep reader, quality, surah and verse independent. Never use only verse number as a cache key. Keep audio catalog version separate from Quran text content version.

Download to a temporary file, check successful HTTP status, plausible audio content/size and decodability where supported, then atomically mark it complete. HTML error pages and partial files are not playable downloads. The backend does not provide checksums or durations for these upstream files; do not claim checksum verification.

Use bounded concurrency, cancellation, retry with backoff for transient failures and an optional Wi-Fi-only preference. Respect user storage limits. A failed verse must remain visibly missing; do not mark the whole surah downloaded until every requested item is present. On offline playback prefer verified completed local files; report missing items rather than silently skipping them or changing reader.

Refresh the catalog when online and cache the last successful response. A temporary API failure must not wipe a valid reader selection or downloaded files. Catalog updates must not delete reading/adhkar progress.

## Background playback and progress

Integrate the existing Android media-playback foreground service and iOS audio background configuration as appropriate. Provide accurate lock-screen/notification metadata and transport controls. Test screen-off, app backgrounding and interruptions on physical devices. Do not add exact-alarm permission for ordinary Quran playback.

Resume position may be persisted locally with reader, verse and within-verse position. This change adds no server endpoint for listening history or cross-device audio resume. Do not count preloading, automatic playback, or downloads as Quran reading completion, streak activity or daily goal completion. Use existing documented progress contracts only for their intended user actions.

## Basmala and content correctness

The playlist contains Quran verse numbers 1 through the official surah total. No extra `000` item is inserted, including for At-Tawbah. Do not synthesize a basmala from an unverified file or shift verse text to match filenames. Source recordings may include introductory material: verify actual audio-to-text alignment rather than assuming filename reachability proves content accuracy.

If a future provider uses different numbering, the backend must expose a verified provider-specific mapping. The Flutter player should consume the resulting explicit verse items, not encode provider offsets itself. A future full-surah recording needs timings from the same recording to highlight verses accurately.

## Required mobile verification before rollout

- Catalog works for a guest; saved existing readers remain selected after refresh/restart.
- Banna selection, first/last verse and Ayat Al-Kursi correspond to the displayed text.
- Al-Fatihah has 7 items, Al-Baqarah 286, At-Tawbah 129, An-Nas 6; no extra numbered basmala.
- Repeat one verse/range, previous/next, end-of-range and end-of-surah behavior.
- Rapid reader changes, seek/skip while buffering, slow network, disconnect and reconnect.
- Download interrupted/cancelled, retry, low space, corrupted/partial file, offline restart.
- Distinct caches for different readers/qualities; downloaded selection never plays another reader.
- Background/screen-off playback, calls, Bluetooth/headset disconnect, adhan/alarm interaction.
- Arabic/English, RTL, dark/light mode and accessibility.
- Invalid selection/range returns 400 and is handled without retry loops.
- Reading progress and streak do not change merely because audio was queued/preloaded.

Backend automated checks validate all 114 surahs / 6,236 verse coordinates, catalog/default compatibility, ranges/quality rejection and public HTTP responses. They do not prove all remote recordings are present, correctly segmented, licensed for redistribution, or seamless on physical devices. External JSON expansion and future full-surah files remain separate work.

## Reference

Android native playlists support sequential item playback and item-transition events: https://developer.android.com/media/media3/exoplayer/playlists . Preserve the Quran recitation as recorded; test the chosen Flutter player's behavior on both target platforms.
