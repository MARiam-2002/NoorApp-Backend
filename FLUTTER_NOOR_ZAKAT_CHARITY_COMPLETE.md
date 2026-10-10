# Noor — Zakat and Charity Reminder Flutter Handoff

Release specification: 2026-10-10. All integration instructions are in English. Arabic UI copy is provided where needed.

## 1. Product decision

Replace the Home Sadaqah card with **Zakat**. Retire the Sadaqah monetary goal, donation categories, daily charity progress, monetary achievements and charity points in the new Flutter experience. Keep a separate optional **Charity reminder** accessible from the Zakat screen and Settings.

Daily Journey completion includes **Prayer, Quran and Adhkar only**. Zakat has an independent lunar-year assessment and private payment ledger. Never present Zakat as a fourth daily task, streak requirement, competition or spiritual score.

The new backend feature is implemented in local source; it must be deployed with its database migration before Flutter enables it. Older Sadaqah endpoints/fields remain temporarily for compatibility. Do not call them from the new experience. Existing historical entries and previously earned points are not erased or reinterpreted as Zakat payments.

## 2. Religious and calculation scope

This is a monetary-wealth calculator, not a universal calculator for crops, livestock, all investment structures or every school-specific ruling.

- Rate: **2.5% per completed Hijri lunar hawl**, subject to qualifying wealth reaching the selected nisab.
- The backend does not infer a completed hawl from salary, account age, a Gregorian year or 354 fixed days. The user explicitly confirms the lunar hawl under their chosen guidance.
- The due date is the user's actual assessment date at their lunar anniversary, represented as Gregorian `YYYY-MM-DD` for API transport. Do not label the anniversary as Gregorian annual recurrence.
- Personal-use home, vehicle, clothes and household goods are not included as calculator fields.
- Jewelry treatment, investment valuation, collectible debts and deductible liabilities require the relevant scholarly guidance. The user supplies their eligible values; positive deductions require `deductionsConfirmed: true`.
- No automatic FX conversion. All amounts and the metal quote must be in the selected currency.
- No automatic interpretation of an excess ledger amount as next year's Zakat or as charity.
- Only current-price `DUE` assessments with positive due amounts can be saved. Hawl-pending estimates and stale quotes are never recorded as a confirmed liability.
- This ledger records actual user-reported payments on/after the assessed due date. Advance Zakat payments are not implemented. Do not silently treat saving allocations as payments.

References exposed by `/zakat/config`:

| ID | Exact quote required | Nisab |
|---|---|---|
| `GOLD_24K_85G` | Price per gram of 24-karat/pure gold | 85 grams |
| `EGYPT_GOLD_21K_85G` | Price per gram of 21-karat gold | 85 grams, Egyptian Dar al-Ifta reference |
| `SILVER_999_595G` | Price per gram of pure silver | 595 grams |

Do not combine a 24K price with the Egyptian 21K basis or silently choose the lower nisab. `/zakat/config` returns `defaultNisabBasis: null`: make the selection explicit. A regional suggestion may be shown, but the user must confirm it.

Sources: [Egyptian Dar al-Ifta](https://www.dar-alifta.org/ar/fatwa/details/13922/حكم-تعجيل-زكاة-المال), [ZATCA individual Zakat guide](https://zatca.gov.sa/en/HelpCenter/guidelines/Documents/Zakat_Individual.pdf).

## 3. Financial privacy

`POST /zakat/calculate` is stateless: the server calculates and returns the result without saving the asset breakdown. Saving a cycle is an explicit separate action. Its snapshot stores financial totals, currency, due date, calculation basis, price metadata and user confirmation; it does not store the individual asset categories. Payment entries store amount/date and a request key; no recipient/bank/payment-provider data is requested.

- Mask Home amounts and percentage by default. Reveal only after an explicit eye-button action; hide again on logout/account switch. Do not put amounts in notifications or notification previews.
- Do not send asset fields, totals, payments or request bodies to analytics, crash reports or debug logs. Log a safe request ID and status only.
- Keep editing drafts in memory by default. If on-device persistence is introduced, use secure storage, explicit consent and account-separated keys. Purge account-specific caches on logout.
- Authenticated responses use `Cache-Control: private, no-store`. Keep financial pages out of general shared HTTP caches.
- Show a clear save disclosure before saving: “Save this assessment privately to your Noor account?”
- An API-reported payment is a **user-reported ledger entry**, not a verified bank transaction. The app does not collect donations or execute payments.
- Users can remove a mistaken payment or delete a cycle. Cycle deletion also deletes its payments. Account deletion cascades to cycles, payments, reminder preferences and reminder send claims.
- Use appropriate platform sensitive-screen protections for financial details where supported; preserve accessibility and explain any screenshot restrictions.

## 4. API basics

Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`

All endpoints use the existing envelope:

```json
{
  "success": true,
  "message": "...",
  "data": {},
  "meta": {},
  "timestamp": "...",
  "requestId": "..."
}
```

Private endpoints require `Authorization: Bearer <accessToken>`. Use the existing refresh-token flow once on 401, then prompt sign-in if refresh fails. Never refresh indefinitely.

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | `/zakat/config` | Public | References, pricing mode and rollout policy |
| POST | `/zakat/calculate` | Public | Stateless estimate |
| GET | `/zakat/summary` | Required | Latest cycle and experience metadata |
| GET | `/zakat/cycles?limit=20&cursor=...` | Required | Paginated history |
| POST | `/zakat/cycles` | Required | Save a current due assessment |
| GET | `/zakat/cycles/{cycleId}` | Required | Assessment and aggregated settlement |
| DELETE | `/zakat/cycles/{cycleId}` | Required | Delete assessment and its payments |
| GET | `/zakat/cycles/{cycleId}/payments?limit=20&cursor=...` | Required | Paginated payment entries |
| POST | `/zakat/cycles/{cycleId}/payments` | Required | Record an actual payment |
| DELETE | `/zakat/cycles/{cycleId}/payments/{paymentId}` | Required | Correct a mistaken ledger entry |
| GET | `/charity/reminder-preferences` | Required | Reminder configuration |
| PATCH | `/charity/reminder-preferences` | Required | Partial configuration update |

History endpoints return `data: { "items": [...], "nextCursor": "uuid-or-null" }`. `limit` is 1–50, default 20. Stop at null; use the previous cursor unchanged. Cursors are scoped to the account/cycle. Show currency on every historical row; never sum amounts across currencies.

Errors: 400 invalid input/business rule; 401 auth; 404 missing or other user's record; 409 request-key conflict; 429 rate limit; 5xx unavailable. Show a retry state for 5xx; never replace it with “No Zakat due”. User-owned IDs must not be inferred from other API responses or account caches.

## 5. Calculation request and result

This is **hypothetical test data**, not a real gold price:

```json
{
  "currency": "EGP",
  "asOfDate": "2026-10-10",
  "nisabBasis": "EGYPT_GOLD_21K_85G",
  "pricePerGram": "1000",
  "priceAsOfDate": "2026-10-10",
  "priceSource": "Metals.dev international spot benchmark",
  "quoteToken": "COPY_FROM_GET_METAL_PRICES_DO_NOT_USE_THIS_PLACEHOLDER",
  "hawlCompleted": true,
  "assets": {
    "cash": "100000",
    "bankBalances": "0",
    "zakatableGoldValue": "0",
    "zakatableSilverValue": "0",
    "tradeInventory": "0",
    "zakatableInvestments": "0",
    "collectibleReceivables": "0"
  },
  "deductibleLiabilities": "0",
  "deductionsConfirmed": false
}
```

Asset fields are values in the selected currency, **not grams**. The gold/silver asset values are independent of the selected nisab metal. Do not send arbitrary personal assets or total net worth. Missing asset fields default to string `"0"`; send an object even when empty.

Amounts must be decimal **strings**, non-negative, at most 15 integer digits and 6 decimal places. Do not send JSON doubles, negatives, scientific notation, commas or localized digits. Normalize Arabic digits and locale separators in Flutter with unambiguous validation before transport; preserve the exact decimal value. Payment precision follows the currency minor unit: EGP/USD 2, KWD 3, JPY 0. The server returns `minorUnitDigits` for calculations. Do not assume every currency uses 2 decimals.

The server uses decimal arithmetic:

```text
gross = sum(eligible asset values)
net = max(0, gross - eligible confirmed liabilities)
nisab = selected metal grams × pricePerGram
meetsNisab = net >= nisab
estimate = meetsNisab ? net × 0.025 : 0
due = current quote AND hawl completed AND meetsNisab ? estimate : 0
```

The rate applies to **the full qualifying net amount**, not only the portion above nisab. Currency rounding happens at output using half-up rounding.

The result includes `status`, `grossAssets`, `netZakatableAssets`, `nisabAmount`, `estimatedZakat`, `dueAmount`, `rate`, `calendar`, `reference`, `quote`, `monthlySavingSuggestion`, `minorUnitDigits`, `notice` and flags.

| Status | UI behavior |
|---|---|
| `QUOTE_STALE` | “Update the metal price for the assessment date.” Explain that it is only an estimate. Disable Save. |
| `BELOW_NISAB` | “Your entered wealth is below the selected nisab.” Show selected basis/date. Disable Save. |
| `HAWL_PENDING` | “The lunar hawl is not complete.” Show the estimate separately. Disable Save. |
| `DUE` | Show calculated liability, calculation breakdown and explicit Save action. |

Before calculating, call `GET /api/v1/zakat/metal-prices?currency=EGP&nisabBasis=EGYPT_GOLD_21K_85G&timezone=Africa%2FCairo`. Copy `currency`, `nisabBasis`, `asOfDate`, `pricePerGram`, `priceAsOfDate`, `priceSource` and `quoteToken` into the calculation request without changes. Prices are read-only. The server validates the signature, currency, purity, dates and expiry. Display “International spot benchmark”, provider source and `quote.asOfUtc` converted to the device timezone. Fresh provider quotes have `verifiedByBackend: true`; this verifies provider retrieval, not religious eligibility or local dealer prices. Missing key, provider failure or stale data returns 503: show an unavailable state and disable Calculate/Save. Expired/changed tokens return 400: fetch a new quote and recalculate, then ask the user to confirm the revised result. Never use a fabricated, cached client-side or manually entered fallback. The complete live-price contract and Railway settings are included below in this document.

`monthlySavingSuggestion = estimatedZakat / 12` is a budgeting approximation, not a monthly Zakat obligation, automatic payment, lunar-month installment mandate or permission to delay due Zakat. Do not show it by default on a due-payment card. If exposed before a future assessment in an educational panel, label it “Optional saving estimate — recalculate at your Zakat date.”

## 6. Saving and payment idempotency

Save only after the user reviews the current quote, eligible asset inputs and completed lunar hawl. Reuse the exact calculation object sent for the result; changing input invalidates the result and requires recalculation.

```json
{
  "requestKey": "GENERATE_A_NEW_UUID_V4_FOR_THIS_SAVE",
  "dueDate": "2026-10-10",
  "calculation": { "...": "the complete validated calculation object" }
}
```

`dueDate` must equal `calculation.asOfDate` and cannot be in the future in the user's stored timezone. The backend saves an immutable assessment snapshot; it does not accept a client-supplied final due amount. To revise an assessment, explicitly delete/replace it after confirmation, or create a separate cycle with clear user intent. Do not silently create several annual assessments on every app launch.

To record a payment:

```json
{
  "requestKey": "GENERATE_A_NEW_UUID_V4_FOR_THIS_PAYMENT",
  "amount": "625.00",
  "currency": "EGP",
  "paidOn": "2026-10-10"
}
```

The date must be on/after the cycle due date and not in the future. Currency must equal the cycle currency. No bank connection or gateway is involved. The response contains `paymentId` and the updated `cycle`.

- Generate a UUID once when the user submits. Keep it through timeout/retry/401-refresh for that same logical action.
- Disable double-tap submission, but do not rely on that alone. The server unique key is the source of duplicate protection.
- Retrying the same key/body returns the same logical record. Reusing a key with changed amounts/date/calculation returns 409.
- A new genuine payment requires a new UUID. After deletion, consider the old action closed; do not retry its creation request automatically.
- Use a Dart decimal package or preserve strings; do not recalculate financial totals in `double`.
- Consume the returned settlement rather than optimistic financial totals. Refresh summary/cycle/history after mutations.

Settlement fields:

```text
dueAmount
recordedPaidAmount
remainingAmount = max(0, due - recordedPaid)
excessRecordedAmount = max(0, recordedPaid - due)
paidPercent = min(100, recordedPaid / due × 100)
paymentVerification = USER_REPORTED
countsTowardDailyJourney = false
awardsPoints = false
```

For the hypothetical assessment above, a reported payment of `625.00` yields `paidPercent: 25`, `remainingAmount: "1875.00"`. Progress is “Recorded as paid”, never “Verified paid” or a spiritual achievement.

## 7. Dashboard and Journey rollout

`GET /dashboard` now includes:

```json
{
  "charityExperience": {
    "version": 2,
    "sadaqahMode": "REMINDER_ONLY",
    "legacySadaqahTrackingDeprecated": true,
    "homeTile": "ZAKAT",
    "dailyJourneyCategories": ["PRAYER", "QURAN", "ADHKAR"],
    "financialAmountsHiddenByDefault": true,
    "zakatCountsTowardDailyJourney": false,
    "sadaqahAwardsPoints": false,
    "zakatAwardsPoints": false
  },
  "zakat": {
    "state": "NOT_CALCULATED",
    "latestCycle": null,
    "labelAr": "الزكاة",
    "labelEn": "Zakat",
    "deepLink": "/zakat",
    "hideAmountsByDefault": true,
    "countsTowardDailyJourney": false
  }
}
```

`GET /zakat/summary` returns `experience`, `state`, and `latestCycle`. Dashboard and `/journey/dashboard` return a Home-compatible `zakat` object. States:

- `NOT_CALCULATED`: no saved assessment. Display “Calculate your Zakat”; do not display 0%, 0 due or “completed”.
- `ASSESSED`: `latestCycle` is available. Show its currency/date, masked values and optional recorded-payment progress after reveal.
- `UNAVAILABLE`: Dashboard aggregation could not read the Zakat store. Show “Temporarily unavailable” with retry. Do not interpret null as below nisab.

When the backend exposes version 2, hide legacy `dailyJourney.sadaqah`, `todayTiles.sadaqah`, `sadaqahAmount`, `sadaqah.goal` and `sadaqah.percent` from all new screens. They remain compatibility data, not Zakat data. Do not migrate those amounts into Zakat payments.

`/journey/today.tasks` now has Quran, Prayer and Adhkar. `/journey/weekly-summary.categories` has PRAYER, QURAN and ADHKAR. Daily overall completion and heatmap percentages exclude charity. Use the backend values rather than dividing by four. Historical charity amounts may still appear in legacy payloads; hide them in the new experience. Old monetary Sadaqah challenges are mapped to a Quran challenge; new charity entries cannot earn challenge points. Past awarded points are preserved.

If the API/config is absent before deployment, keep the feature disabled behind a rollout flag; do not invent a working calculator or silently fall back to monetary charity goals. Deploy backend/migration first, then enable the updated Flutter experience.

## 8. Charity reminder preferences and delivery

Default: **off**, Friday (`[5]`) at `12:00` in the user's stored IANA timezone. It can be changed to any non-empty set of weekdays and any valid local HH:mm. `0=Sunday`, `1=Monday`, … `6=Saturday`.

```json
{
  "enabled": true,
  "localTime": "12:00",
  "weekdays": [5],
  "language": "ar"
}
```

PATCH is partial. The response includes `timezone`, `deliveryOwner: "BACKEND_FCM"`, `sound: "default"`, `androidChannelId: "noor_charity_v1"`, `amountTracking: false`. The API boolean is a real boolean; FCM `data` values are strings.

Show the timezone returned by the server. Keep account timezone/location in sync using the existing Noor settings flow; do not assume the device timezone automatically changes the account. Reminder scheduling follows local dates and weekdays across world timezones. It does not depend on a fixed UTC offset.

**One scheduler owner:** the backend sends the charity reminder. Flutter must not also schedule a local daily/weekly charity alarm. Cancel any old Sadaqah/charity local alarms during migration. Existing prayer reminder ownership rules are unchanged.

Sample FCM data:

```json
{
  "type": "CHARITY_REMINDER",
  "notificationId": "stable-32-character-hash",
  "occurrenceKey": "CHARITY|2026-10-09",
  "deepLink": "/charity-reminder",
  "deliveryMode": "OS_NOTIFICATION",
  "audioOwner": "NOTIFICATION_CHANNEL",
  "expiresAtUtc": "2026-10-09T09:05:00.000Z"
}
```

- FCM contains an OS notification. In background/terminated state, **do not redisplay** it from the data callback and do not start a second audio player/TTS.
- In foreground, choose exactly one display path. Android may show one local notification with the same channel; iOS may use OS foreground presentation or a local notification, never both.
- Deduplicate using `(accountId, notificationId)` in an account-scoped bounded store. Do not use a random local notification ID on every callback.
- Ignore an expired message before displaying it in foreground. The OS background TTL is short; Flutter cannot intercept an OS-displayed notification to guarantee exact timing.
- Create Android channel `noor_charity_v1` **before** enabling the feature: normal notification category, default system notification sound, appropriate importance. Android channels are immutable in sound after creation; a different sound requires a new channel ID and coordinated backend update.
- Request notification permission contextually when the user turns the reminder on (Android 13+/iOS). If permission is denied or FCM token registration fails, show that the reminder cannot currently appear; do not claim successful delivery merely because the preference was saved.
- No exact alarm permission is required for this backend-owned reminder.
- No spoken charity clip is supplied. The configured sound is the device notification sound, subject to channel settings, silent mode, DND and platform policies.
- Reminder tap opens `/charity-reminder`, a gentle explanatory/settings screen; it does not execute a donation or imply any amount was paid.
- The notification inbox uses `type: CHARITY_REMINDER` and the same deep link.

Backend guarantees durable **at-most-once transport attempt per user/local day**, including time edits/repeated DST hours and concurrent workers. Claim failure suppresses sending. A crash/transport failure after claim can miss that day's notification; this is not exactly-once delivery. The scheduler catches up only within a 5-minute local slot, not hours later. A nonexistent DST local time can be skipped; advise a daytime time such as 12:00. FCM requires connectivity and cannot guarantee exact on-device delivery.

## 9. Visual design specification

Match the current Noor Home screenshot and legal/developer branding; do not redesign the whole navigation.

Tokens:

| Token | Value |
|---|---|
| Page background | `#FAF8F3` |
| Surface | `#FFFFFF` |
| Heading / primary CTA | `#1A1040` |
| Zakat card tint | `#F1ECFA` |
| Brand gold / subtle accents | `#C9A86A` |
| Secondary text | `#77717F` |
| Border | `#EAE5DE` |
| Success / settlement accent | `#0F5A50` |
| Card radius | 16–20 logical pixels |
| Page horizontal padding | 20–24 logical pixels |
| Card spacing | 12–16 logical pixels |
| Minimum interactive target | 48×48 logical pixels |

Use the existing Noor Arabic/English font assets and logo. Use Material Symbols `calculate_outlined` / `account_balance_wallet_outlined` for Zakat and `notifications_outlined` for reminders. Do not use a donation heart/trophy as the Zakat icon. Use semantic typography, readable contrast and 200% text-scaling support. Avoid tiny pale captions that fail contrast. Use logical start/end spacing for RTL; keep formatted money/date fragments directionally isolated. Long currencies and labels must wrap, not clip.

### Home card

Keep the same 2×2 grid: Prayer + Quran, then Adhkar + Zakat. In Arabic, preserve current directional ordering. Zakat is a financial utility placed beside daily tasks, not counted as a daily worship goal.

Empty state:

```text
[calculator icon]                 الزكاة
                         احسب زكاة مالك
                     النصاب والحول الهجري
```

Assessed state: title “الزكاة”, secondary “سجل سداد خاص”, eye button, masked amount `••••` and no percentage until reveal. Revealed state may show “المسدَّد: 25%” and a small settlement bar based on `latestCycle.paidPercent`. A completed ledger says “المبلغ المستحق مسجَّل كمدفوع”, not “عبادتك اكتملت”. A zero/absent assessment never shows a completed ring.

Tap anywhere on the card opens `/zakat`. Keep the card size aligned with the existing Prayer/Quran/Adhkar cards. Do not put a monthly obligation amount on the Home card.

### Zakat screen

1. Noor header with back button, “الزكاة” / “Zakat”, optional amounts visibility control.
2. Short introduction: “احسب زكاة المال وفق النصاب والحول الهجري.” / “Calculate monetary Zakat using nisab and your lunar hawl.”
3. Primary card: calculate a new assessment, or latest saved assessment with date/currency, masked totals, remaining amount, recorded settlement progress and “Record a payment”.
4. “Previous assessments” list with date/currency and privacy masking.
5. Separate “Charity reminder” card with an off/on state and settings shortcut. Explain that charity has no monetary target in Noor.
6. Reference/help link and informational calculator notice. Do not present payment categories, donation processors, social totals or leaderboard rankings.

### Calculator flow

Use a 3-step flow with a clear Back action and preserved in-memory inputs:

1. **Basis & date:** currency, selected scholarly nisab reference, current local assessment date from the quote, lunar-hawl confirmation. Fetch a signed provider quote and show its exact purity as read-only text. Historical live pricing is not supported by this endpoint.
2. **Eligible wealth:** collapsible groups for cash/bank, eligible metals, trade stock/investments, eligible receivables. Optional confirmed eligible liabilities. Plain helper text that personal-use assets are excluded.
3. **Review:** server quote/source/update timestamp, full calculation and status. Run the backend calculation. Offer explicit Save only for DUE; never auto-save by opening the result.

When quote/asOfDate/basis/assets change, mark the previous result outdated and disable Save until recalculated. Do not create a bank-like “Pay now” CTA. Use “Record a payment” only on a saved cycle.

### Payment form

Amount, read-only cycle currency, actual payment date and a notice: “This records a payment you already made; Noor does not transfer money.” / “هذا تسجيل لمبلغ دفعته بالفعل؛ نور لا يحوّل الأموال.” Disable Save during submission and preserve the same request key on retry. A successful response updates settlement. Deletion requires an explicit confirmation describing that only the app's ledger entry is removed, not the real payment.

### Reminder settings

Off by default; show weekdays as accessible selectable chips, local time picker, account timezone, language and permission status. Copy:

- Title: “تذكير بالصدقة” / “Charity reminder”
- Description: “تذكير لطيف بما تيسر، بدون هدف مالي أو تسجيل مبلغ.” / “A gentle reminder to give what you can, without a monetary target.”
- Notification: “باب الخير واسع؛ تصدّق بما تيسر لك، ولو بالقليل.”
- Success: “تم حفظ تفضيلات التذكير.” / “Reminder preferences saved.” Do not say “Notification delivery guaranteed”.

## 10. Flutter implementation outline

Suggested files, adapted to the app's existing architecture:

```text
features/zakat/data/zakat_api.dart
features/zakat/data/zakat_models.dart
features/zakat/presentation/zakat_controller.dart
features/zakat/presentation/zakat_home_tile.dart
features/zakat/presentation/zakat_screen.dart
features/zakat/presentation/zakat_calculator_screen.dart
features/zakat/presentation/zakat_payment_sheet.dart
features/charity/data/charity_reminder_api.dart
features/charity/presentation/charity_reminder_screen.dart
core/notifications/noor_notification_router.dart
```

Preserve monetary strings in DTOs:

```dart
class ZakatSettlement {
  final String dueAmount;
  final String recordedPaidAmount;
  final String remainingAmount;
  final String excessRecordedAmount;
  final double paidPercent; // Display only; never calculate money from this.

  ZakatSettlement.fromJson(Map<String, dynamic> json)
      : dueAmount = json['dueAmount'] as String,
        recordedPaidAmount = json['recordedPaidAmount'] as String,
        remainingAmount = json['remainingAmount'] as String,
        excessRecordedAmount = json['excessRecordedAmount'] as String,
        paidPercent = (json['paidPercent'] as num).toDouble();
}
```

Separate calculation state from saved-cycle state. Retain draft input and action request key during transient errors, and invalidate results on input changes. Cancel/ignore responses when the account changes or the screen is disposed. Never merge a response from the previous user into the current user's Home card. Localize display formatting while transporting ASCII decimal strings.

## 11. Acceptance tests for Flutter

- Home has Zakat instead of Sadaqah; no monetary charity goal appears on Home, Journey, weekly summary or challenges.
- No saved cycle shows “Calculate your Zakat”, not 0% or “completed”. Missing table/server error shows unavailable, not “nothing owed”.
- Calculator statuses have distinct truthful copy; unavailable prices and expired tokens block calculation/save. Only signed provider quotes claim backend verification.
- 85g exact threshold qualifies; below threshold does not. Hawl false never creates a due cycle. Full net amount is assessed at 2.5%, not only the excess above nisab.
- EGP/USD, KWD and JPY formatting follows currency precision; localized digits are normalized accurately; negatives/unknown fields are rejected.
- Wrong currency, future date, invalid date, pre-assessment payment and unconfirmed deductions show readable errors.
- Rapid double taps, a network timeout and a retry create one cycle/payment with the same request key. Changed body under the old key shows conflict.
- Another account cannot view/delete a cycle, payment or cursor. Account switching clears drafts, amount reveal state and response caches.
- Recording 25% updates the card; overpayment caps the bar at 100% and shows excess privately without auto-allocation.
- Deleting a payment refreshes aggregate settlement; deleting a cycle removes its payments; account deletion removes all associated data.
- Default reminder is off. Weekdays/time/timezone are respected; permission-denied and offline states are clear.
- One background notification and one sound only; no duplicate local schedule. Foreground uses one display path. Expired/duplicate events are ignored.
- Test foreground, background, terminated, DND, notification denial, two devices and account changes on real Android/iOS devices. Backend mocks are not a device-delivery guarantee.
- RTL/LTR, narrow screens, dark mode, screen reader, keyboard/focus order and 200% text scaling remain usable. Dark mode should use existing Noor semantic tokens while preserving contrast.

## 12. Backend deployment and validation

New migration: `prisma/migrations/20261010090000_zakat_charity_reminders/migration.sql`.

Run the migration as a Railway pre-deploy/release step before serving the new code:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
npm run test:zakat-charity
npm run test:swagger-calendar
```

Do not run schema reset or database push against production. If the existing deployment relies on the old boot-time auto-migration helper, explicitly verify the new tables/indexes/foreign keys: that helper can log warnings and continue after SQL errors. A successful HTTP health response alone does not verify this migration.

Tables: `zakat_cycles`, `zakat_payments`, `charity_reminders`, `charity_send_logs`. Unique indexes protect user/request keys and user/local-day reminder claims; cascading foreign keys protect account deletion. Configure `METALS_DEV_API_KEY` on Railway, keep `ZAKAT_ALLOW_MANUAL_PRICES=false`, choose a sufficient provider subscription and redeploy. Verify `/zakat/config` reports `priceProviderConfigured: true`, then smoke-test `/zakat/metal-prices` before enabling the Flutter screen. The API key is never stored in Flutter. See the live-price section below for cache, outage and pricing semantics.

Locally verified: calculation boundaries and currency rounding; stale quote/hawl/date rules; tenant ownership; concurrent cycle/payment idempotency; reminder claim failure/duplicate suppression; HTTP auth/validation; OpenAPI exposure. Tests use a mocked database and injected push sender; they do not send real pushes or apply production migrations.

After deployment, test config/calculate/auth guards on the actual host, then use a dedicated account to save/delete a sample cycle/payment and restore reminder preferences. Enable Flutter only after these checks. Do not assess arbitrary production users or send test pushes to them.

## 13. Deliverables

- This specification is the source of truth for Flutter integration and screen states.
- The Flutter source repository was not provided in this workspace. The backend changes and this handoff are ready for its developer to implement; real-device audio/UI validation remains required.


---

# Noor — Live Metal Prices / Flutter Integration

This document supersedes all previous manual-price instructions. All code and integration instructions are in English. This is an implementation handoff for Flutter; no HTML preview is required.

## Railway configuration

Add these variables to the backend service and redeploy:

```dotenv
METALS_DEV_API_KEY=<your private Metals.dev API key>
METALS_CACHE_TTL_SECONDS=900
METALS_MAX_AGE_SECONDS=1800
METALS_REQUEST_TIMEOUT_MS=8000
ZAKAT_ALLOW_MANUAL_PRICES=false
```

Never put the key in Flutter, source control, screenshots or logs. `.env.example` intentionally leaves it blank. Without a valid key, calculator configuration remains available and requesting prices returns 503. The deployed service must be tested after configuration; local mocked tests do not prove live subscription activation.

Provider: [Metals.dev documentation](https://metals.dev/docs). The backend requests `/v1/latest` with `currency=USD&unit=g` and validates status, units, currency, positive prices/rates and both metal/FX collection timestamps. The current provider returns `timestamps.metal` and `timestamps.currency`; the adapter also accepts its legacy single `timestamp` format. Its USD-per-currency rates are divided into the USD metal price. Gold 21K is derived as pure gold × 21/24. Silver uses the provider's silver benchmark without an extra 0.999 multiplier. This is an international spot benchmark, not an Egyptian or other local dealer quote. Taxes, premiums and making charges are excluded. Provider retrieval is verified; user assets, scholarly eligibility and payments are not automatically verified.

## Price request

```http
GET /api/v1/zakat/metal-prices?currency=EGP&nisabBasis=EGYPT_GOLD_21K_85G&timezone=Africa%2FCairo
```

Public endpoint; use the standard `{ success, message, data, ... }` response envelope. `currency` and `nisabBasis` are required. `timezone` is an IANA identifier; default UTC. Flutter should send the user's current/account timezone explicitly. No asset values are sent to Metals.dev.

Read these `data` fields:

| Field | Meaning |
| --- | --- |
| `currency`, `nisabBasis` | Exact requested currency and scholarly basis |
| `asOfDate` | Current assessment date in requested timezone |
| `pricePerGram` | Decimal string, six decimals; copy exactly |
| `priceAsOfDate`, `priceSource` | Copy exactly; do not edit |
| `quoteToken` | Opaque signed receipt; keep only in memory for this flow |
| `asOfUtc` | Older of the metal/FX collection timestamps; freshness of the combined quote |
| `metalAsOfUtc`, `currencyAsOfUtc` | Actual separate provider collection timestamps; display in local time |
| `fetchedAtUtc` | Backend snapshot retrieval timestamp; not a substitute for collection time |
| `expiresAt` | Expiry in Unix **milliseconds** |
| `verifiedByBackend` | Provider receipt/signature verification, not a religious endorsement |
| `priceType` | `INTERNATIONAL_SPOT` |
| `derivedPurity` | True for derived 21K gold |
| `supportedCurrencies` | Supported ISO currencies present in this snapshot |

Supported references: `GOLD_24K_85G`, `EGYPT_GOLD_21K_85G`, `SILVER_999_595G`. Do not silently switch reference or currency if unavailable. Historical pricing is not provided by this endpoint.

## Calculate and save

Build the existing calculation payload using the quote fields and the user's eligible wealth inputs. Every amount remains a decimal string; never convert the server price to a binary floating-point number and back.

```dart
Map<String, dynamic> buildCalculation(
  Map<String, dynamic> quote,
  Map<String, String> assets,
  bool hawlCompleted,
) => {
  for (final key in [
    'currency', 'nisabBasis', 'asOfDate', 'pricePerGram',
    'priceAsOfDate', 'priceSource', 'quoteToken',
  ]) key: quote[key],
  'hawlCompleted': hawlCompleted,
  'assets': assets,
  'deductibleLiabilities': '0',
  'deductionsConfirmed': false,
};
```

Send to `POST /api/v1/zakat/calculate`. Assets use the categories in the main handoff. This request saves no financial data. Only a `DUE` result with a positive due amount can be explicitly saved:

```json
{
  "requestKey": "one UUID generated per Save action",
  "dueDate": "copy calculation.asOfDate",
  "calculation": "the actual calculation object, including quoteToken"
}
```

The above is structural notation, not an executable JSON request. `POST /api/v1/zakat/cycles` requires authentication and a real nested calculation object. Retry the exact request/body/key on ambiguous network failures. The backend checks an existing saved request before revalidating price expiry, so a successful Save can be recovered after receipt expiry. Reusing a key with changed data returns 409. After a definitive expiry rejection, fetch a fresh quote, recalculate, show the updated result for confirmation and generate a new Save action key. Do not recalculate silently and overwrite an existing financial assessment.

Saved snapshots keep source, provider collection timestamp, currency, purity basis and calculated totals immutable. Subsequent price updates never change an existing cycle's liability or payment percentage. The financial ledger remains private and payments remain user-reported.

## UI behavior and design

Keep Noor cream, navy, gold and green styles from the main handoff. Replace editable metal price/source/date fields with a read-only card:

- Arabic title: `سعر المعدن المرجعي`; English: `Reference metal price`.
- Display chosen metal/purity, price per gram, selected currency, `Metals.dev` and local collection time.
- Caption: `سعر عالمي مرجعي؛ لا يشمل مصنعية أو فروق السوق المحلي.` / `International spot benchmark; excludes local premiums and making charges.`
- Loading: skeleton price card; Calculate/Save disabled; avoid a fake zero price.
- Missing setup, network failure, stale provider data or exhausted quota: unavailable card with Retry. Do not display “no Zakat due”.
- Refresh after changing currency, basis or timezone, after receipt expiry, and when resuming an expired calculator flow.
- Keep amounts hidden by default on saved-cycle/Home views. No points, leaderboard, public sharing or monthly Zakat obligation.

The price receipt expires within 10 minutes or sooner at the configured maximum provider-data age. Before Save, check expiry locally for UX, but always handle the server response as authoritative. The server rejects tampering even if Flutter misses a check.

## Errors and cache semantics

| Response | Flutter behavior |
| --- | --- |
| 400 invalid currency/timezone/basis | Correct selection; no automatic substitute |
| 400 invalid/changed/expired quote | Fetch new quote, recalculate, request confirmation |
| 503 provider unavailable or no configured key | Disable calculation/save, show Retry |
| 401 private ledger route | Refresh auth/re-login |
| 409 changed payload with reused request key | Resolve action state; do not blindly retry with different data |

Backend cache is in memory and shared across currencies/metals **within each process**, with one in-flight provider request and a 60-second failure cooldown. No stale fallback is returned. Data freshness is checked against the provider timestamp, not only cache insertion time. Restart clears cache; replicas have independent caches. At 900 seconds, continuously active usage is approximately 2,976 calls per 31 days **per replica**, plus restarts/failures. Select a sufficient subscription and monitor provider quota. This is request-driven refresh, not a paid background polling loop. Multi-replica deployments must account for independent cache usage; there is no distributed Redis cache in this implementation.

## Acceptance and release checks

1. Deploy backend source and existing Zakat database migration, add the provider key, keep manual prices disabled.
2. Verify `/api/v1/zakat/config`: `priceMode=LIVE_SIGNED_QUOTE`, `priceProviderConfigured=true`, `manualPricesAllowed=false`.
3. Verify a real EGP, USD and another required currency quote and timestamps; cross-check quote values with provider dashboard/data.
4. Calculate with the copied receipt. Change its price/currency/token and confirm rejection. Save on a dedicated test account and retry the identical action.
5. Verify source outage, stale response, expiry and quota failure disable calculations. No raw upstream URL or secret may appear in responses/logs.
6. Test Flutter loading, Resume, Retry, RTL, accessibility, currency minor units and hidden amounts on real devices.

Local automated coverage includes FX direction, 21K derivation, gold/silver, concurrent requests, shared currency cache, token tampering, manual rejection, expiry, failure cooldown and safe errors. Provider calls are mocked; no paid API call or real push notification is sent by these tests.
