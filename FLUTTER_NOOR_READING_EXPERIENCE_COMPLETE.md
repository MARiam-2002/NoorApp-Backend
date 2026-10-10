# Noor Reading Experience — Complete Flutter Handoff

Version: 2026-10-10. Audience: Flutter developer, backend owner, release tester.

## 1. Scope and release status

Implement four connected features:

1. One selected-edition reading goal for Home and today's Journey.
2. Guided sessions for 5, 10 or 20 minutes, with explicit reading confirmation.
3. Durable request replay and seven-day offline session synchronization.
4. Flexible Khatmah adjustments with preview, confirmation and preserved progress.

The backend code and migration are saved in the backend project. Deploy them before enabling the Flutter entry points. Backend checks do not replace production migration verification, live content-provider tests, or testing the actual Flutter release on physical devices.

This Markdown file is the handoff. No HTML design preview is needed.

## 2. Connection and authentication

API base:

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

Every `/reading/*` endpoint requires:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
Accept: application/json
```

Responses use the existing Noor envelope:

```json
{
  "success": true,
  "message": "Selected-edition reading goal",
  "data": {},
  "meta": {},
  "timestamp": "2026-10-10T12:00:00.000Z",
  "requestId": "server-generated-id"
}
```

Read feature data from `data`. Errors contain `success: false`, message, code, timestamp and requestId; diagnostic fields may also exist. Log endpoint, status and requestId, never access tokens or private content.

Personal endpoints send `Cache-Control: private, no-store`. Flutter's explicit local cache must be account-scoped; never use a shared cache for reading state.

## 3. Edition identities

| editionId | Unit | Full cycle | Navigation |
| --- | --- | --- | --- |
| `madani-hafs` | `PAGE` | 604 edition pages | Page and verse |
| `indopak-hafs` | `PAGE` | 604 pages in the configured provider mapping | Page and verse |
| `warsh-nafi` | `VERSE` | 6214 source-specific verses | Surah and ayah |

Do not transfer page credit between editions. Warsh keys use Warsh numbering: never join them to Hafs by the same `surah:ayah` string.

Fetch capabilities through `GET /quran/editions`. Respect available, availabilityReason, navigation, khatmahUnit, contentVersion, pageReadingAvailable and offlineDownloadAvailable. Read contentVersion from the server; do not hardcode it. Cache keys must include account ID, edition ID and content version.

Current rendering is Unicode reflow, not a promised printed-page facsimile. Warsh printed-page navigation is not supplied by this feature; use the surah/ayah reader.

Selection remains:

```http
GET /quran/edition-preference
PUT /quran/edition-preference
```

```json
{"editionId":"warsh-nafi"}
```

Changing preference does not convert progress or restart a cycle. Refresh Home, Journey and goal after a successful switch. Do not leave the previous edition's figures displayed.

## 4. Canonical Home and Journey fields

Use `data.readingGoal` from `GET /dashboard`, `GET /journey/today` and `GET /journey/dashboard`.

You can also fetch:

```http
GET /reading/goal
GET /reading/goal?editionId=indopak-hafs
```

Omitting editionId uses the saved preference. Supplying it reads an edition without changing preference.

Example `data` for a new page plan:

```json
{
  "editionId":"indopak-hafs",
  "contentVersion":"qf-v4",
  "unit":"PAGE",
  "date":"2026-10-10",
  "timezone":"Africa/Cairo",
  "available":true,
  "availabilityReason":null,
  "target":21,
  "completed":0,
  "remaining":21,
  "percent":0,
  "done":false,
  "source":"EDITION_PLAN",
  "plan":{
    "id":"server-generated-plan-id",
    "status":"ACTIVE",
    "total":604,
    "completed":0,
    "remaining":604,
    "startedOn":"2026-10-10",
    "targetEndDate":"2026-11-08"
  },
  "resume":{
    "editionId":"indopak-hafs",
    "contentVersion":"qf-v4",
    "page":1,
    "verseKey":null,
    "revision":0
  }
}
```

Root completed and remaining describe today's goal. plan.completed and plan.remaining describe the whole cycle. Percent is 0–100; divide by 100 only for widgets that accept 0–1. targetEndDate is an inclusive local calendar date.

Sources:

- `EDITION_PLAN`: new page-based edition plan.
- `WARSH_CYCLE`: Warsh unique-verse cycle.
- `LEGACY_HAFS`: existing Madani aggregate goal retained for compatibility.
- `DEFAULT`: no active edition plan; 5 pages for Indo-Pak or 15 verses for Warsh.
- `UNAVAILABLE`: content cannot be used; display an availability message, not a completed goal.

Madani without a new plan continues to use its existing goal, normally 5 pages if no legacy plan is active.

The daily target follows remaining units and remaining local calendar days. Already-confirmed units today are included in the calculation so the target does not shrink as the user reads. Overdue plans remain readable; offer an extension instead of silently changing their deadline.

### Required binding changes

- Bind both the Quran tile and Today Goal card to the same readingGoal.
- Localize the correct PAGE/VERSE unit.
- Use readingGoal.resume for the selected edition's resume action.
- Use readingGoal.plan for Continue Khatmah.
- Display cycle completion separately from today's completion.
- Use readingJourney.percent for the new daily combined indicator: Quran, prayers and Adhkar. Charity is not a scored target.
- Home readingJourney also returns completedCategories and totalCategories: 3.
- Journey returns readingTasks for the selected-edition daily cards, plus readingJourney.

Legacy fields, including dailyGoal, dailyJourney.quran, khatmah, quran.pages, quranPagesRead, overallPercent, historical weekly/monthly Quran statistics, and old streak/reward calculations, remain compatible with older clients. They are not the new selected-edition ledger. Do not relabel those statistics as Warsh or Indo-Pak. New session confirmations do not promise additional points or automatically update old streak calculations.

### Ordinary reader: use the same progress ledger

The regular Quran reader must also use the new confirmation API. Otherwise its legacy page writes will not update a new edition-scoped plan.

```http
POST /reading/confirmations
```

```json
{
  "editionId":"indopak-hafs",
  "contentVersion":"qf-v4",
  "expectedPlanId":"exact-current-readingGoal-plan-id",
  "date":"2026-10-10",
  "unitKeys":["4","5"],
  "requestKey":"77777777-7777-4777-8777-777777777777"
}
```

Read contentVersion, expectedPlanId and date from a freshly fetched readingGoal. Use null for expectedPlanId when no active plan exists. unitKeys contains 1–100 distinct strings. Hafs keys are canonical page numbers 1–604; Warsh keys are validated against its own source. Confirm only units the user explicitly says they read.

200 data returns editionId, contentVersion, planId, date, unit, confirmedUnits and addedUnits. Repeating a unit under a new key adds zero additional cycle credit. Exact requestKey replay returns the original response, including its original addedUnits: never sum this field into a local total. Refresh the goal instead.

This endpoint shares the guided-session ledger. Confirming the same page through both paths does not duplicate credit in that ledger. Still choose one path per UI action, and never additionally write legacy history/progress for those units. Reading beyond today's target is allowed in the ordinary reader and still advances the cycle.

New ordinary-reader confirmations require the current server-local date and unchanged plan/content version. A queued past-day confirmation is not silently moved to today. For offline reading progress, prepare a session online first and confirm its offered units through the seven-day session API. Do not invent a new current date to bypass a 409.

Reader position and bookmarks remain separate from reading credit. A page opening or resume-position write does not imply it was read.

## 5. Starting a Khatmah cycle

Fetch the edition's reading goal first. If a plan exists, show an explicit new-cycle confirmation.

```http
POST /reading/plans
```

```json
{
  "editionId":"indopak-hafs",
  "durationDays":30,
  "expectedPlanId":null,
  "requestKey":"11111111-1111-4111-8111-111111111111"
}
```

durationDays must be an integer 7–365. expectedPlanId is mandatory: null when no plan exists, otherwise the exact readingGoal.plan.id. IDs are opaque; legacy Madani IDs can begin with `legacy:` and are not UUIDs.

Generate a fresh UUID requestKey per user intent and persist it before sending. Retry the identical request with the same key after a timeout. Never reuse it for another action or modified duration.

201 `data`:

```json
{
  "editionId":"indopak-hafs",
  "planId":"server-generated-plan-id",
  "startedOn":"2026-10-10",
  "targetEndDate":"2026-11-08",
  "newCycle":true,
  "previousProgressPreserved":true
}
```

Warsh uses the same response shape. Refetch the goal after success; do not calculate the target in Flutter.

Previous plans/history and legacy totals are preserved. A new cycle starts at zero. Historic aggregate totals cannot identify individual read pages, so they are not invented or transferred into a new unique-page cycle.

Do not dual-write new cycles through legacy `/quran/khatmah/plan` or `/quran/warsh/cycles`. Use one integration path per action.

## 6. Flexible adjustment

Offer two actions:

- Extend deadline: choose a later calendar date.
- Keep deadline: review the redistributed remaining daily portion. Goals already redistribute dynamically; this does not introduce a different calculation mode or change the deadline.

```http
POST /reading/plans/adjustment-preview
```

```json
{"editionId":"indopak-hafs","mode":"EXTEND","targetEndDate":"2026-11-15"}
```

For REDISTRIBUTE, omit targetEndDate:

```json
{"editionId":"indopak-hafs","mode":"REDISTRIBUTE"}
```

Preview `data`:

```json
{
  "editionId":"indopak-hafs",
  "planId":"server-generated-plan-id",
  "date":"2026-10-10",
  "timezone":"Africa/Cairo",
  "mode":"EXTEND",
  "oldTargetEndDate":"2026-11-08",
  "targetEndDate":"2026-11-15",
  "oldDailyTarget":21,
  "dailyTarget":17,
  "unit":"PAGE",
  "remainingInPlan":604,
  "completedToday":0,
  "durationDays":37,
  "previewToken":"64-character-server-token"
}
```

Show old/new deadlines, the returned daily portion and unit, and that completed reading is preserved. Cancelling the preview changes nothing.

After explicit confirmation:

```http
POST /reading/plans/adjustment
```

```json
{
  "editionId":"indopak-hafs",
  "mode":"EXTEND",
  "targetEndDate":"2026-11-15",
  "previewToken":"exact-token-from-preview",
  "requestKey":"22222222-2222-4222-8222-222222222222"
}
```

Success includes preview fields plus applied: true and progressPreserved: true. The preview token binds account, plan, local day and progress. If any change, obtain a new preview and ask the user to confirm it; do not silently rebase a 409.

A cycle must fit within 365 days from its original start. An overdue plan must be extended; keeping an already-past deadline is rejected. Adjustments preserve existing Madani legacy plans, new page plans and Warsh cycles. Starting a new cycle is a separate action.

## 7. Guided 5 / 10 / 20 minute sessions

Add a Home card with three choices and a Start button. Label duration as an estimate, not a guaranteed time or religious requirement.

```http
POST /reading/sessions
```

```json
{
  "editionId":"indopak-hafs",
  "minutes":10,
  "includeAdhkar":true,
  "includeReflection":true,
  "requestKey":"33333333-3333-4333-8333-333333333333"
}
```

Only 5, 10 and 20 are accepted. Both optional flags default to true. Prepare the session online before offering offline continuation.

201 data contains sessionId, editionId, contentVersion, date, timezone, minutes, expiresAt, revision, status, tasks, estimatedMinutes, timeIsEstimate, unit, goalAtStart, offlinePolicy, globalAdhkarCredit, confirmedUnits, doneTasks and skippedTasks.

Initial revision is 0, status ACTIVE, confirmedUnits/doneTasks/skippedTasks empty, timeIsEstimate true, offlinePolicy SERVER_ISSUED_SESSION_7_DAYS and globalAdhkarCredit false.

Tasks are dynamic. Example task shapes:

```json
{
  "id":"quran",
  "kind":"QURAN",
  "unit":"PAGE",
  "units":["1","2"],
  "references":[
    {"unitKey":"1","page":1,"firstVerseKey":"1:1","contentPath":"/quran/editions/indopak-hafs/pages/1"},
    {"unitKey":"2","page":2,"firstVerseKey":"2:1","contentPath":"/quran/editions/indopak-hafs/pages/2"}
  ],
  "estimatedMinutes":4,
  "labelAr":"server-localized-label",
  "labelEn":"Quran portion"
}
```

```json
{
  "id":"adhkar",
  "kind":"ADHKAR",
  "estimatedMinutes":1,
  "labelEn":"A short dhikr",
  "item":{
    "id":"server-item-id",
    "textAr":"exact-source-text",
    "textEn":"source-translation-if-available",
    "repeatCount":10,
    "referenceAr":"source-reference",
    "referenceEn":"source-reference-if-available"
  },
  "countsTowardFullDailyAdhkar":false
}
```

```json
{
  "id":"reflection",
  "kind":"REFLECTION",
  "estimatedMinutes":1,
  "labelEn":"Understand a verse from your portion",
  "verseKey":"1:1",
  "contentPath":"/quran/tafsir?surahId=1&ayahNumber=1",
  "requiresSourceAttribution":true,
  "optionalWhenProviderUnavailable":true
}
```

Real task references come from the source; do not hardcode the example verse bounds. Task count/duration may be smaller when remaining reading is small, today's goal is complete, or no eligible short dhikr is available. Render returned tasks, not a fixed three-step flow.

### Quran step

Fetch each returned contentPath relative to the API base. Render the edition's verified text/font. Confirm reading only after the user explicitly confirms the offered unit. Opening, scrolling, timing or audio playback must not auto-credit reading.

Page unit keys are strings such as `"1"`; Warsh keys are source-specific `"1:1"` strings. Never generate unoffered units or use page numbers for Warsh.

### Adhkar step

Show the exact text, repetition count and source. Use a session counter and explicit confirmation. One short dhikr does not complete the daily Adhkar category or morning/evening Adhkar. Do not send an additional journey/Adhkar category completion for this task.

### Reflection step

Fetch the returned tafsir path; display its actual source attribution. This feature adds no generated interpretation. If unavailable or the user chooses to skip this optional step, send skippedTasks: ["reflection"], not a false completion.

Warsh sessions omit this step because verified Warsh-specific tafsir mapping has not been supplied. They support Quran and Adhkar; never fetch Hafs tafsir by matching a Warsh verse key.

### Resume position

Session confirmations and reader position are separate. Save a live reading position through existing revision-guarded reader-state APIs. Never replay an old offline position over a newer other-device position.

Hafs:

```http
GET /quran/editions/indopak-hafs/reader-state
PUT /quran/editions/indopak-hafs/reader-state
```

```json
{"page":4,"verseKey":null,"revision":0}
```

Warsh uses `/quran/warsh/reader-state` with the returned contentVersion, verseKey and revision. Handle reader-state conflicts separately from confirmed reading.

## 8. Saving, pausing and completion

```http
GET /reading/sessions
GET /reading/sessions/{sessionId}
PATCH /reading/sessions/{sessionId}
```

List returns data.items and data.limit: 20, latest first. Sessions are private to the authenticated account.

Confirm an offered unit:

```json
{
  "requestKey":"44444444-4444-4444-8444-444444444444",
  "revision":0,
  "completedUnits":["1"],
  "doneTasks":[],
  "skippedTasks":[],
  "status":"ACTIVE"
}
```

Pause without credit:

```json
{
  "requestKey":"55555555-5555-4555-8555-555555555555",
  "revision":1,
  "completedUnits":[],
  "doneTasks":[],
  "skippedTasks":[],
  "status":"PAUSED"
}
```

Resume uses ACTIVE, the latest revision and a fresh key. Finish remaining offered units and other steps:

```json
{
  "requestKey":"66666666-6666-4666-8666-666666666666",
  "revision":2,
  "completedUnits":["2"],
  "doneTasks":["adhkar"],
  "skippedTasks":["reflection"],
  "status":"ACTIVE"
}
```

Rules:

- Revision must match the latest session revision.
- A successful new mutation increments revision. Exact requestKey replay returns the original result without another increment.
- Server arrays accumulate confirmations. Sending already-confirmed units with a new key/current revision is safe.
- Each unit counts once per account, edition, content version and cycle. Preparation and pausing credit nothing.
- doneTasks accepts only offered non-Quran IDs, currently adhkar/reflection. Do not send quran: its completion derives from offered units.
- Only an offered reflection can be skipped.
- The server assigns COMPLETED when all tasks are done or optional reflection is skipped. Clients submit only ACTIVE/PAUSED.
- New session confirmation does not provide undo; never emulate it through negative legacy totals.
- Replace local server state with the returned session, then refresh Home/goal. Do not add server totals to old local totals.

Never send legacy reading-history, Khatmah progress, journey-page, or Warsh-completion writes for the same units confirmed here. Dual writes bypass this integration's accounting guarantees.

## 9. Offline outbox

Use persistent account-scoped storage, separate from the content cache. Store:

```text
accountId, sessionId, editionId, contentVersion,
requestKey, expectedRevision, exactRequestBody,
createdAt, state: pending / sending / blocked / sent
```

1. Prepare a session online; cache its metadata.
2. Cache content only where source terms/current capabilities permit it. This feature does not grant bulk Quran download rights; offlineDownloadAvailable may remain false.
3. Show pending offline progress explicitly. Do not claim server synchronization.
4. Coalesce unsent confirmations before assigning/sending a request, or send sequentially using revisions from acknowledged responses.
5. Once a request might have reached the server, freeze its body/key. A timeout does not prove it failed.
6. Reconnect and send the exact frozen request first. Durable replay safely resolves a committed request with a lost response.
7. Save the returned revision before building the next mutation with a fresh key.
8. On 409, stop replay; refresh session and goal. Explain revision, plan, version or expiry changes.
9. Never edit the body under an old key or silently move old reading to a new plan.
10. On logout/account switch, isolate or clear private caches/queues. Never send account A's queue with account B's token.

New confirmations are accepted until the exact expiresAt, seven days after preparation. Credit belongs to the session's original server-issued local day, even if synced after midnight. It is not reassigned to today.

Fresh mutations on expired sessions or replaced plans/versions are rejected. Previously committed exact requests may replay their stored result. Creating a new session offline is not supported; offer continuation of prepared sessions.

## 10. Errors

| Result | Required action |
| --- | --- |
| 400 | Fix invalid input; do not retry unchanged invalid data. |
| 401 | Existing refresh/login flow; preserve account isolation. |
| 404 | Stop that operation: no owned session found. |
| 409 | Refresh and explain; no silent restart/rebase/reassignment. |
| 429 | Respect API rate limits and any Retry-After header. |
| 503 | Show unavailable state, retain pending operations and allow retry. |
| Timeout/network failure | Retry exact body and same requestKey. |

409 is not always a revision mismatch. It also covers stale preview, replaced plan, expired session and reused key. Read the message and refreshed state.

## 11. Noor UI specification

| Token | Value |
| --- | --- |
| Background | #FAF8F3 |
| Main text / primary button | #1A1040 |
| Gold accent | #C9A86A |
| Card surface | #FFFFFF |
| Card radius | 20 logical pixels |
| Screen horizontal padding | 20 logical pixels |
| Card padding | 20 logical pixels |
| Minimum main interactive height | 48 logical pixels |

Use gold for accents/dividers, readable dark body text and existing Arabic/English UI fonts. Use the supplied verified Quran fonts; the general UI font is not a Warsh substitute.

Home order: existing prayer/daily-verse cards, Journey tiles, Today Goal, compact 5/10/20 session card, Continue Khatmah. Session card has one Start action and Resume when appropriate.

Session screen: edition/estimated-time header, dynamic task stepper, explicit Quran confirmation, persistent Pause, dhikr counter/source, sourced meaning with Skip, then completion showing actual confirmed units, skipped steps and synchronization state.

Plan sheet: current totals/deadline; Extend/Keep deadline actions; old/new preview; explicit confirmation. Dismiss does not change the plan.

Use skeletons matching final card dimensions. Disable repeated taps while sending, while retaining request idempotency. No fake progress while loading. Keep unavailable selected editions visible with a reason instead of substituting another edition. Show completed cycles with an explicit Start new cycle action.

Localization/accessibility:

- Arabic UI: RTL and Arabic-Indic display digits; English: LTR and Latin digits.
- JSON numbers remain numbers. API dates, UUIDs, URLs, unit keys and verse keys remain original machine-readable strings.
- Format dates/counts at the presentation layer only.
- Isolate fractions, times and verse references so RTL does not reverse meaning.
- Preserve Quran text exactly; no global numeral/text replacement on scripture.
- Support text scaling, screen-reader labels and large tap targets; completion is not communicated only by color.
- Announce pending synchronization separately from server-confirmed progress.

## 12. Khatmah reminders

The backend reminder now checks the selected edition's canonical goal. Existing identifiers remain:

```text
eventType: KHATMAH
androidChannelId: khatmah
deepLink: /quran/khatmah
```

FCM data adds string editionId, contentVersion, unit, target and completed. Page reminders include pagesTarget/pagesReadToday; verse reminders include versesTarget/versesReadToday.

Route taps to the supplied edition's plan. Never treat Warsh reminders as Madani page goals. Keep existing dedupeKey/occurrenceKey and local-versus-FCM-backup handling; do not introduce a second independent notification stream. Existing preferences/channel/sound behavior remains applicable.

## 13. Backend owner actions

1. Upload/push changed source, schema, migration and package scripts from the actual backend project.
2. Railway pre-deploy command stays `npx prisma migrate deploy`; start command stays `npm start`.
3. Verify migration `20261010140000_reading_experience` succeeds. It adds reading_plans, reading_units, reading_sessions and reading_operations while preserving existing totals.
4. Do not run raw migration SQL again at application boot. Do not reset or overwrite production schema to recover a migration; inspect migration history/schema first.
5. Existing Quran Foundation credentials enable live Hafs pages/tafsir; existing Warsh capability enables Warsh. No additional provider/key is introduced by these features.
6. Check live `/api/v1/swagger.json` contains Reading experience endpoints.
7. Test writes using a dedicated account before public rollout.

## 14. Backend checks

Validation covers build/type checking, Prisma schema, calendar goal calculations, source-specific goal adapters, isolated PostgreSQL and local HTTP integration.

DB tests create a generated schema inside a transaction, set local search_path and roll back everything. No public user tables are changed; no email or push is sent. Provider pages are mocked in integration tests, so live delivery must still be checked after deployment.

```powershell
npm run build
npx prisma validate
npm run test:reading
```

Optional isolated DB + HTTP checks, with a connection that permits creating a temporary schema:

```powershell
$env:READING_TEST_DB='true'
$env:READING_TEST_HTTP='true'
npm run test:reading
```

These are test switches, not Railway production variables.

## 15. Release acceptance

- [ ] Deploy and migration succeed; new endpoints appear in live Swagger.
- [ ] Unauthorized reading requests return 401; private state is not shared-cached.
- [ ] Home tile, Today Goal and Continue Khatmah match the selected edition.
- [ ] Madani/Indo-Pak/Warsh render correct text, units and fonts.
- [ ] Fresh 30-day page/Warsh cycles start at 21 pages / 208 verses daily.
- [ ] Session preparation credits zero; 5/10/20 task flows render dynamically.
- [ ] Pause/resume and app restart preserve confirmations.
- [ ] Ordinary reader and guided sessions advance the same edition goal without duplicate credit.
- [ ] Double tap/lost response do not double-credit; two devices conflict safely.
- [ ] Unoffered unit confirmations are rejected.
- [ ] Short dhikr does not complete daily Adhkar; sourced reflection can explicitly skip.
- [ ] Warsh never joins Hafs tafsir by verse key.
- [ ] Extension preserves progress; cancelled/stale previews do not apply silently.
- [ ] Offline progress is pending and later credits its original day.
- [ ] Expiry/replaced plan stops replay; account switch isolates queues.
- [ ] Arabic digits/RTL, English/LTR, text scaling and screen readers work.
- [ ] Physical Android/iOS tests cover offline, reconnect, midnight and timezone changes.
- [ ] Existing auth, prayers, Adhkar, Zakat and notification routing pass in the release build.

Publish only after the deployed backend and actual Flutter release pass this checklist.
