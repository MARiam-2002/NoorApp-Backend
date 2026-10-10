# Noor — Nawafel Settings and Daily Completion

English implementation handoff. Backend source is implemented locally; deployment and real-device Flutter verification are required before release.

## Screen meaning

The supplied screen is a settings screen. Its switches select which sunnah slots the user wants to track. They must never mean that the user has performed a prayer today.

- `Show Nawafel on Home`: controls only the Home card's visibility.
- Five sunnah switches: control which slots contribute to the user's selected Nawafel progress.
- Today's completion checklist: a separate action confirming actual performance.
- Reminder links: open the corresponding reminder settings screens; they are not completion actions.

Use the existing Noor cream/navy/gold identity and Arabic RTL/English LTR layout. Language and theme controls stay in the app's existing preference system. Use the Arabic numeral handoff for localized display; API numbers and dates remain canonical.

## Backend release

New migration: `20261010100000_nawafel_preferences` adds nullable `users.nawafelPreferences` JSONB. No existing completions are deleted or rewritten.

Railway Pre-deploy Command:

```bash
npx prisma migrate deploy
```

Upload source plus migration before deployment. Do not retain the previous one-off Zakat `migrate resolve` command as a recurring deployment step. Do not use a boot-time SQL replay, `migrate reset` or `db push` for this production release.

For existing accounts without saved settings, the compatibility default is `showOnHome=true` and all five slots selected. This preserves the existing 12-rakah catalog rather than silently changing their selection. Users can change it explicitly.

## API conventions

Base: `https://noorapp-backend-production.up.railway.app/api/v1`.

Every endpoint below requires `Authorization: Bearer <accessToken>`. Read the standard success envelope's `data`. Nawafel/settings responses are private/no-store. Do not retain another account's preferences or checklist after logout/account switch.

### Get and update settings

```http
GET /profile/nawafel-preferences
```

Example `data`:

```json
{
  "showOnHome": true,
  "selectedKeys": [
    "FAJR_BEFORE_2",
    "DHUHR_BEFORE_4",
    "DHUHR_AFTER_2",
    "MAGHRIB_AFTER_2",
    "ISHA_AFTER_2"
  ]
}
```

```http
PATCH /profile/nawafel-preferences
Content-Type: application/json
```

```json
{
  "showOnHome": false,
  "selectedKeys": ["FAJR_BEFORE_2", "DHUHR_BEFORE_4"]
}
```

Send one or both fields. The request must be non-empty, contain only supported fields and use real booleans. `selectedKeys` is an array of unique supported keys, maximum five. An empty array is supported. The backend atomically merges the supplied fields, so a visibility-only update does not overwrite another device's saved selection. A selection update replaces the full selected array; concurrent selection edits use the last database update.

After saving, use the returned settings and refresh the checklist/Home card. Serialize settings requests in Flutter, disable controls while their save is pending, and show Retry if it fails. Do not show success for a switch that was only changed locally.

| Key | Arabic title | Rakahs |
| --- | --- | --- |
| `FAJR_BEFORE_2` | سنة الفجر | 2 |
| `DHUHR_BEFORE_4` | سنة الظهر القبلية | 4 |
| `DHUHR_AFTER_2` | سنة الظهر البعدية | 2 |
| `MAGHRIB_AFTER_2` | سنة المغرب | 2 |
| `ISHA_AFTER_2` | سنة العشاء | 2 |

Fetch the titles/captions from the checklist catalog instead of maintaining a conflicting hard-coded list. This screen tracks the existing five rawatib slots; Duha/Qiyam reminder toggles do not add other slots to this catalog.

### Today's checklist

```http
GET /nawafel/today
```

Existing fields remain, plus:

```json
{
  "date": "2026-10-10",
  "timezone": "Africa/Cairo",
  "preferences": {
    "showOnHome": false,
    "selectedKeys": ["FAJR_BEFORE_2", "DHUHR_BEFORE_4"]
  },
  "tracking": {
    "state": "ACTIVE",
    "completedSlots": 1,
    "totalSlots": 2,
    "completedRakahs": 2,
    "totalRakahs": 6,
    "progress": 0.33
  }
}
```

This is an illustrative excerpt; `items` and existing catalog fields are also returned. Each item now includes `selected` separately from `completed`.

- Use `tracking` for the selected-only progress view.
- Legacy root totals/progress describe the full catalog of 12 rakahs for backward compatibility. Do not mix root totals with `tracking` totals.
- Progress is weighted by rakahs: completing Fajr in the example gives 2/6, not 1/2. `progress` is a rounded 0..1 fraction; convert to a displayed percentage once.
- `NONE_SELECTED` means no targets: total=0, progress=0. Show “Choose the sunnah slots you want to track”. Never display 100% or a completion award for an empty selection.
- Hiding the Home card preserves selections and completion records. Changing selection does not erase history; restoring a selected key reveals its existing completion for that day.
- Nawaﬁl remain a separate optional progress view. Do not change the five obligatory prayers' denominator or present optional worship as an obligatory daily failure.

### Explicit completion state

```http
PUT /nawafel/FAJR_BEFORE_2/completion
Content-Type: application/json
```

```json
{
  "completed": true,
  "date": "2026-10-10"
}
```

To undo an entry, send `completed=false` with the same current local day. Use `date` returned by `/nawafel/today`, not the device/server UTC calendar day. The backend determines today's date using the user's stored IANA timezone.

Response `data` includes `key`, requested `completed` state and a fresh `today` snapshot. Replace local state with that response.

Identical `completed=true` retries do not remove the record or create duplicates. Identical `completed=false` retries keep it absent. The user's daily unique key protects concurrent identical writes. This is state-based idempotency; no client-generated request key is needed.

Serialize writes for the same slot. A newer opposite action must not race an old retry, because independent conflicting state requests are processed in database arrival order. Ignore obsolete UI responses using a per-slot request sequence; fetch fresh state after ambiguous failures or when resuming.

Unselected slots cannot be modified through this endpoint. Select the slot first if the user wants to record or correct its completion. Unknown keys return 400. A stale/historical/future date returns 409; refresh Today and ask for confirmation for the new day rather than silently recording yesterday's action today. Offline queued completion requests must retain their original date and must not be replayed into the next day.

**Deprecated:** `PATCH /nawafel/{key}/mark` is the legacy toggle route and remains for existing clients. It exposes a deprecation header and Swagger flag. Do not use or automatically retry it in the new Flutter implementation. Retry-safe behavior requires switching to the new PUT endpoint.

## Home integration

`GET /dashboard` returns the Nawafel tile in `dailyJourney.nawafel` with:

- `visible`: whether to display the card.
- `trackingState`: `ACTIVE` or `NONE_SELECTED`.
- `completed`, `total`: selected completed/target rakahs.
- `completedSlots`, `totalSlots`: selected slot counts.
- `progress`: selected rakah completion fraction 0..1.
- Arabic/English labels and captions.

When `visible=false`, remove the card from the Home layout. This does not disable the settings page or clear records. If `visible=true` and no slots are selected, use an inviting empty-state card linking to these settings. Do not render a ring requiring division by zero.

Settings must also be refreshed after sign-in, account switch and return from settings. Stale cached data may be shown only as an explicit loading transition, never as another account's state.

## Existing reminder settings

The four navigation rows already have backend preferences. Integrate the existing APIs rather than storing only a local switch:

| Row | GET/PATCH endpoint | Main input fields |
| --- | --- | --- |
| Pray for the Prophet | `/profile/salawat-preferences` | `enabled`, `intervalMinutes`, `startTime`, `endTime`, `audioClipId` |
| Duha | `/profile/duha-preferences` | `enabled`, `time` |
| Qiyam | `/profile/qiyam-preferences` | `enabled`, `time` |
| Surah Al-Mulk | `/profile/mulk-preferences` | `enabled`, `time` |

Times use canonical 24-hour `HH:mm` and the account timezone, while the UI can display localized 12/24-hour labels. Salawat currently supports intervals 30/60/120/180 minutes; read its catalog/Swagger and returned fields rather than guessing additional values. Use `GET /salawat/audio` for its available sound choices.

Example Duha patch:

```json
{ "enabled": true, "time": "09:30" }
```

Examples are settings requests, not a command to enable reminders during testing. Check and request OS notification permission as part of the app UX; if denied, show that notifications are blocked even if the server preference is enabled. Saving settings is not evidence that OS audio will play.

For backend FCM reminders, do not schedule a second local alarm for the same event. Let the OS notification channel own notification sound; do not also start an audio player for the same native notification. Honor event expiry/dedupe metadata where present in the existing contract. Foreground/background/killed-app behavior, channel sound settings, Do Not Disturb and Android/iOS permission behavior require real-device verification. This settings update does not add a new rawatib reminder scheduler.

## Flutter interaction and accessibility

- Settings switches: bind to saved `selectedKeys`/`showOnHome` only.
- Daily checklist controls: bind to each item's actual `completed` state, and show only selected tracking targets or clearly distinguish unselected ones.
- Rebuild from the response; avoid fabricating completion before the server confirms. If optimistic UI is used, roll back on failure and serialize actions.
- Use clear localized labels, semantic switch state, visible focus and touch targets. Check contrast for muted text in the screenshots.
- Respect Arabic digit display, RTL layout, large text and dark mode. Keep API IDs/times/date values canonical.
- A loading skeleton must not look like a selectable switch. If catalog/preferences fail, show Retry and do not default silently to false.

## Release checks

1. Backend Build, Prisma schema validation and mocked preference/completion/HTTP tests pass.
2. Deploy the new migration with normal `prisma migrate deploy` and verify it completes.
3. On a dedicated production test account: save visibility/selection, re-read, mark true twice, mark false twice, verify one state and no duplicate records, and restore previous settings/records.
4. Verify empty selection, two-rakah/four-rakah weighting, hidden card, selection changes preserving completions and correct account isolation.
5. Test local midnight/timezone changes and 409 stale-date handling. Check that queued old-day actions cannot mark the new day.
6. Verify auth failures, invalid duplicate/unknown selections, private cache headers and Swagger paths.
7. Test all four reminder settings on real Android/iOS devices, including permission denial, foreground/background and a single notification/audio owner.

Local tests use a mocked database and do not enable live pushes. Production success and device notification behavior must be verified after deployment/integration; this handoff is not a guarantee of 100% reliability.
