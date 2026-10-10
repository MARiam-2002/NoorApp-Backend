# Noor — Live Metal Prices / Flutter Integration

This document supersedes all previous manual-price instructions. All code and integration instructions are in English. The preview uses illustrative data; it does not connect to a live provider.

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

Provider: [Metals.dev documentation](https://metals.dev/docs). The backend requests `/v1/latest` with `currency=USD&unit=g` and validates status, units, currency, positive prices/rates and timestamp. Its USD-per-currency rates are divided into the USD metal price. Gold 21K is derived as pure gold × 21/24. Silver uses the provider's silver benchmark without an extra 0.999 multiplier. This is an international spot benchmark, not an Egyptian or other local dealer quote. Taxes, premiums and making charges are excluded. Provider retrieval is verified; user assets, scholarly eligibility and payments are not automatically verified.

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
| `asOfUtc` | Actual provider collection timestamp; display converted to local time |
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
