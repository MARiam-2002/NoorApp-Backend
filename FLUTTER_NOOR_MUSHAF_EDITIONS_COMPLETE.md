# Noor Quran editions and Warsh — complete Flutter handoff

Updated: 2026-10-10. This replaces earlier drafts of this file. All paths are relative to `/api/v1`.

## Actual release status

Backend implementations are saved locally: Madani/Indo-Pak page reader infrastructure; Warsh surah/ayah text, resume position, bookmarks and a unique-verse Khatmah with daily goals. Warsh data uses the owner-supplied QUL JSON without changing its text. This release has NOT been deployed or tested on Flutter devices by this change.

Warsh text redistribution evidence and external corpus review have not been established by the structural tests. `WARSH_TEXT_APPROVED=false` is the default. The backend therefore exposes the capability as unavailable and rejects Warsh requests until the release owner records text permission and review and explicitly enables it. This is an actual release dependency, not a missing Flutter feature. Font license evidence is available; it does not automatically license the separate JSON text.

Implemented Warsh functions do NOT require printed page metadata. They intentionally use surah/ayah navigation and verse-based accounting. No Warsh physical pages, Hafs-key audio/tafsir joins, Warsh push reminders, offline bulk-download endpoint or Warsh points award are claimed. Existing Hafs daily progress, points and reminder systems retain their existing meaning.

## Backend owner's deployment steps

1. Upload the backend source, its JSON asset, build script and migrations together.
2. Keep Railway Pre-deploy Command: `npx prisma migrate deploy`. Do not mark new migrations applied without executing them or restore the old raw-SQL boot runner.
3. Required new migrations: `20261010110000_mushaf_reader_states` and `20261010120000_warsh_verse_reader` (plus any earlier unapplied project migrations).
4. Run the normal `npm run build`. It copies the Warsh source to `dist/shared/data` and checks SHA-256. Source-file corruption fails the build. Keep existing Quran Foundation production credentials server-side for Madani/Indo-Pak.
5. Leave `WARSH_TEXT_APPROVED=false` until text permission and corpus review are documented. After that set `WARSH_TEXT_APPROVED=true` in Railway and redeploy/restart. No key is required for the local Warsh JSON.
6. Verify the deployed catalog and all private endpoints with a dedicated test account. Confirm the migration succeeded, then test Flutter on actual devices. Current local tests do not certify the Railway release.
7. Do not change Warsh JSON under an existing content version. New content requires a new verified digest, review, version handling and release tests.

## Source and font assets

Text: QUL resource `https://qul.tarteel.ai/resources/quran-script/qpc-warsh-script-ayah`, supplied by the project owner as ZIP. Source file is `src/shared/data/qpc-warsh-script-ayah.json` in the backend.

SHA-256: `4f1ca6245b059aafa3917e1ef06bd22e70d27f7b417f303e97dbcb5d60b77f7a`.

Warsh content version:

`qul-warsh-4f1ca6245b059aafa3917e1ef06bd22e70d27f7b417f303e97dbcb5d60b77f7a`

Read this value from the catalog/response and send it back on every Warsh write. Do not hardcode a different Hafs version.

The text contains 6,214 verse records across 114 surahs. It has no page/juz/line metadata. Structural checks verify checksum, identities, consecutive local numbering and the final record. They do not certify the linguistic correctness of every verse.

Matching font: `uthmanic-warsh-v21.ttf`, QPC Warsh Version 2.1, downloaded from the direct link published at `https://qul.tarteel.ai/resources/font/583`. License/copyright metadata is preserved in `QPC_WARSH_FONT_LICENSE.txt`. Both are also supplied in `docs/warsh` in the backend project as handoff assets. Keep the binary unmodified and retain its license.

```yaml
flutter:
  fonts:
    - family: NoorWarsh
      fonts:
        - asset: assets/fonts/uthmanic-warsh-v21.ttf
```

Render Warsh text with `TextStyle(fontFamily: 'NoorWarsh')`. Test joining, diacritics, Quranic signs, text scaling and dark mode on Android and iOS. A browser WOFF2 font URL is not a Flutter TTF asset.

## Common API behavior

Noor success envelope: `{success,message,data,meta,timestamp,requestId}`. Read values under `data`. Errors use HTTP status and Noor error envelope. Public chapter endpoints are short-lived cacheable; private state endpoints require `Authorization: Bearer <access token>` and are `private, no-store`.

Relevant statuses: 400 invalid input/key/version; 401 unauthorized; 404 cycle not owned/found; 409 stale revision/day/cycle/request-key conflict; 503 text unavailable. Warsh 503 code is `WARSH_SOURCE_UNAVAILABLE`, with a reason such as `TEXT_RELEASE_APPROVAL_REQUIRED` or `WARSH_SOURCE_INVALID`.

Do not silently substitute Hafs content after any error. Cache private state by account, edition and contentVersion, and clear it on logout. Ignore responses from an earlier account, edition or screen generation.

## Edition selector

`GET /quran/editions`

Returns `data.defaultEditionId` and `data.editions`.

- `madani-hafs`: Hafs, Uthmani Unicode, Quran Foundation mushaf 4, 604 pages.
- `indopak-hafs`: Hafs, general Indo-Pak Unicode, mushaf 3, 604 pages. This is not the 610-page 15-line or 548-page 16-line edition.
- `warsh-nafi`: Warsh, navigation `SURAH_AYAH`, Khatmah unit `VERSE`. In this release `pages` is null and no page bundle is installed.

Use `available`, `availabilityReason`, `navigation`, `textReadingAvailable`, `pageReadingAvailable`, `khatmahUnit` and `contentVersion` to select the correct flow. Reading availability is a configured capability, not a guarantee that a live upstream can never be temporarily unavailable.

`GET /quran/edition-preference` returns `{editionId,available}`.

`PUT /quran/edition-preference` body:

```json
{"editionId":"warsh-nafi"}
```

Rejects unavailable choices. Selection never counts reading or resets plans. It does not automatically select a reciter. Keep the last saved position for each edition and source version; do not copy physical page numbers between editions.

## Warsh chapters and text

`GET /quran/warsh/chapters`

Returns `{editionId,contentVersion,unit:"VERSE",totalVerses:6214,chapters:[{surah,totalAyahs}]}`. Use these verse counts, not Hafs counts. Surah display names may come from the existing 114-surah name catalog; do not reuse its Hafs verse totals.

`GET /quran/warsh/chapters/{surah}?fromAyah=1&limit=50`

Bounds: surah 1–114, fromAyah at least 1 and within that surah, limit 1–100. Response:

```text
{editionId,contentVersion,surah,totalAyahs,
 verses:[{key,surah,ayah,text,ordinal}],nextFromAyah}
```

`nextFromAyah:null` ends the surah. Append only responses belonging to the current request generation. Use `(editionId,contentVersion,key)` as identity. Ordinal is the source-specific overall order, 1–6214.

Display text unchanged as plain Unicode text. Do not strip the Basmala, normalize letters, remove marks or globally rewrite Quran digits. UI counters may use Arabic numerals; identifiers and corpus text remain unchanged. The source's `1:1` is Al-Hamd; Hafs numbering is different. Identical numeric keys are NOT safe joins to Hafs audio, tafsir, translations or sajdah entries.

## Warsh last read

`GET /quran/warsh/reader-state`

Returns `{editionId,contentVersion,verseKey,revision,surah,ayah}`. Default is `1:1`, revision 0.

`PUT /quran/warsh/reader-state`

```json
{"contentVersion":"<version from response>","verseKey":"1:2","revision":0}
```

Use the exact real version string, not the angle-bracket placeholder. The server verifies the key and increments revision atomically. An identical already-applied retry can recover the saved state. A conflicting stale write returns 409. Serialize and debounce position writes; update revision from each response. On conflict, reload and obtain explicit user intent before overwriting another device's position. Saving a position awards no reading credit.

## Warsh bookmarks

`GET /quran/warsh/bookmarks?afterOrdinal=0&limit=50`

Returns `{editionId,contentVersion,items:[{verseKey,ordinal,note,updatedAt}],nextAfterOrdinal}`. Cursor is ordinal, ascending Quran order. Null cursor ends the list. Limit 1–100.

`PUT /quran/warsh/bookmarks`

```json
{"contentVersion":"<version>","verseKey":"1:2","saved":true,"note":""}
```

`saved:false` removes the same bookmark. Note length at most 500. Identical saves cannot duplicate it; serialize opposite save/remove intents for one key. There is no page field. Legacy Hafs bookmarks remain separate.

## Warsh Khatmah: start, restart and recover

`GET /quran/warsh/cycles/current`

Returns `{editionId,contentVersion,cycle:null}` when no plan exists. Otherwise `cycle` contains:

`cycleId,editionId,contentVersion,active,unit,totalVerses,completedVerses,remainingVerses,progress,status,durationDays,startedOn,targetEndDate,dailyGoal`.

Progress is 0–1. Status is ACTIVE, OVERDUE or COMPLETED. Total verses is 6214. Dates are calendar dates in the user's backend timezone.

`POST /quran/warsh/cycles`

```json
{"contentVersion":"<version>","requestKey":"<fresh UUID>","expectedCycleId":null,"durationDays":30}
```

Duration: 1–365 days. For the first plan, expectedCycleId is null. For restart, first show a confirmation, then send the current cycle UUID as expectedCycleId and a fresh requestKey. A changed current cycle returns 409. The old cycle and its reading history remain; only one cycle is active per user.

Persist each requestKey with its exact payload until the response is recovered. Retry the SAME key/payload after a timeout. A different payload with the same requestKey returns 409. Retrying an old start after a later restart returns the original inactive cycle; do not mistake it for the current cycle or reactivate it locally. Refresh `/cycles/current` when active=false.

`GET /quran/warsh/cycles/{cycleId}` reads an owned current/historical cycle. Another account receives 404.

## Confirm actual reading

`GET /quran/warsh/cycles/{cycleId}/completions?surah=1`

Returns `{editionId,contentVersion,cycleId,surah,items:[{verseKey,completedOn}]}` for the requested surah. Load this before rendering checked-state; do not infer completed reading from resume position.

`PUT /quran/warsh/cycles/{cycleId}/completions`

```json
{"contentVersion":"<version>","verseKeys":["1:1","1:2"],"completed":true,"date":"<dailyGoal.date>"}
```

Up to 100 distinct existing Warsh keys per request. Use the current date supplied by the cycle dailyGoal. Old offline dates return 409; do not silently change the date and replay an earlier intent. Only an active owned cycle accepts writes.

Each verse counts once per cycle. Repeated confirmation is idempotent, including retries and repeated reading on another day. The first confirmation day remains stored. `completed:false` explicitly removes the selected confirmations and recalculates progress. It can lower cycle and daily progress; show this action clearly. Serialize contradictory mark/unmark intents and ignore old responses.

Response is the updated cycle envelope. Do not increment local totals independently after the response. Splitting more than 100 verses into batches is not one atomic action; if a later batch fails, refresh server state before retrying unfinished batches.

Fetching text, preloading, navigating, switching editions, adding a bookmark or saving last-read does not count as reading. Use an explicit “Mark as read” action. Do not award Hafs page points or call legacy Hafs completion APIs for Warsh keys.

## Daily goal math and Home

`cycle.dailyGoal` is `{date,timezone,unit:"VERSE",targetVerses,completedVerses,remainingVerses,completed}`.

Initial 30-day plan: `ceil(6214/30)=208` verses/day. Goal adjusts to remaining unique verses and remaining calendar days. Already-confirmed unique verses today are included before calculating the target, so each confirmation does not shrink that day's target. Once overdue, the remaining verses form the catch-up goal. Completion is based on confirmed unique verses, not view count.

For Warsh's selected Khatmah card, use the Warsh cycle and dailyGoal endpoints. Display “verses”, not “pages”, with a source-specific goal and progress. Without a cycle, show a setup action. Existing dashboard `dailyGoal`, Hafs daily journey totals, points, streaks and Hafs reminders remain their existing data source and have NOT been converted to Warsh. Do not present those legacy totals as Warsh totals or replace fields without explicit unit handling. This release supplies separate Warsh accounting; it does not claim a unified cross-riwayah reward system.

## Existing Madani and Indo-Pak APIs

- GET `/quran/editions/{editionId}/pages/{page}`: `{editionId,riwayah,page,totalPages,rendering,contentVersion,verses:[{key,text,surah,ayah}]}`.
- GET/PUT `/quran/editions/{editionId}/reader-state`: PUT `{page,verseKey,revision}`. VerseKey may be null; when supplied it must belong to the page.
- GET/PUT `/quran/editions/{editionId}/bookmarks`: PUT `{page,verseKey,note,saved}`. GET currently returns up to 500 newest entries.

Use these only for page-based Hafs editions in this release. Warsh requests to these page/state/bookmark paths return a conflict pointing to surah/ayah routes once Warsh text is enabled. Do not reuse the generic page body for Warsh.

Page text uses Unicode reflow, not exact printed line layout. Server validates page bounds, all provider pagination, duplicate keys and first/last verse against the chosen edition page lookup. No other-edition fallback is permitted. Old Hafs Khatmah APIs retain their 604-page contract.

## UI design and error states

Use Noor cream #FAF8F3, navy #1A1040 and gold #C9A86A with the existing icon family. Show script plus riwayah and navigation type in the edition selector. Warsh must say surah/ayah rather than advertising a 604-page layout. Keep Quran RTL under English and Arabic app languages. Localize UI numbers without altering JSON identifiers or Quran text.

Use a skeleton on initial loading. Keep prior valid content until the next load succeeds, with a loading indicator; do not put a new edition title above old edition text. On 503 show unavailable/retry; never substitute content. On 401 recover authentication. On 409 refresh the relevant state and recover user intent. Support large text and dark mode without clipping Quranic marks.

No full offline download endpoint is provided. Quran Foundation offline copies require its approved Content Sync workflow, not mass-calling page APIs. Warsh's local backend asset does not imply that a Flutter bulk-download route or all corpus redistribution permissions are already implemented.

## Validation evidence and remaining release checks

Passed locally: TypeScript build, Prisma validation, existing Swagger checks and edition regressions; exact-source checksum/numbering tests; HTTP text fidelity/pagination/input validation/private auth/no-store/release gate tests; real PostgreSQL migration, account isolation, CAS retries/conflicts, unique bookmarks, idempotent cycle creation, unique reading accounting, guarded restart/history preservation and cascade deletion in a temporary schema.

The PostgreSQL test used its own stub users and tables, rolled the entire schema back, and confirmed it no longer existed. It did not apply the production migrations or change production user data. Test 400/401/503 logs are intentional negative cases.

Before release: establish text permission and external corpus review, deploy migrations and code, enable approved capability, verify deployed endpoints with a dedicated account, and test font shaping, RTL, numeral localization, conflict/retry behavior and Home unit handling on Android/iOS. Warsh audio and printed-page features require their own matching verified resources. No 100% production certification or future 2027 compatibility is claimed.