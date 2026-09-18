# Sadaqah Goal Edit — Flutter handoff (2026)

**Audience:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-19  

Authoritative contract for the **تعديل الهدف** sheet (Sadaqah goal slider → حفظ).

This is personal **tracking only**. There is no payment gateway.

---

## A. Production base URL

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

Do not use the retired Vercel host.

---

## B. Endpoint

Existing write path — **no new URL**.

| Item | Value |
|------|--------|
| Method | `PATCH` |
| Path | `/journey/sadaqah` |
| Auth | `Authorization: Bearer <accessToken>` |
| Content-Type | `application/json` |

Related reads (unchanged paths):

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/journey/sadaqah` | Sadaqah screen (goal + today’s amount) |
| `GET` | `/journey/today` | `data.sadaqah.goal` / `amount` |
| `GET` | `/dashboard` | `data.dailyJourney.sadaqah.goal` / `amount` |

User id is taken from the access token only. The client **cannot** pass another user’s id.

---

## C. Request examples

Load current goal:

```http
GET /journey/sadaqah
Authorization: Bearer <accessToken>
```

Edit goal only (does **not** change today’s donated total):

```http
PATCH /journey/sadaqah
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "goal": 2000 }
```

Existing Flutter body still valid (sets **today’s amount**, does not change goal):

```http
PATCH /journey/sadaqah
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "amount": 350 }
```

Both in one call:

```json
{ "amount": 350, "goal": 2000 }
```

---

## D. Response example (real envelope)

```json
{
  "success": true,
  "message": "Sadaqah updated successfully",
  "data": {
    "sadaqahAmount": 350,
    "amount": 350,
    "goal": 2000,
    "percent": 18,
    "currency": "EGP",
    "currencyLabelAr": "جنيه",
    "currencyLabelEn": "EGP",
    "date": "2026-09-19"
  },
  "meta": {},
  "timestamp": "2026-09-19T00:00:00.000Z",
  "requestId": "uuid"
}
```

`GET /journey/sadaqah` uses the same `data` progress fields plus existing screen helpers (`goalTitleAr`, `categories`, `featured`, `trackingOnly`, …). Those extra GET fields are unchanged.

---

## E. Fields

### Request (`PATCH /journey/sadaqah`)

| Name | Type | Required | Meaning | Persist |
|------|------|----------|---------|---------|
| `amount` | number | no* | Today’s recorded sadaqah (EGP). Default `mode=set` **replaces** today’s total. | yes (today’s `DailyProgress`) |
| `goal` | number | no* | Personal daily target (EGP). | yes (user profile; survives logout) |
| `mode` | `"set"` \| `"add"` | no | Only applies when `amount` is sent. Default `set`. | n/a |
| `category` | string | no | `FOOD` \| `CLOTHES` \| `EDUCATION` \| `MONEY` \| `GENERAL` | optional breakdown |

\*At least one of `amount` or `goal` is required. Legacy `{ "amount": N }` remains valid.

**Goal rules:** finite number, **1 … 1_000_000**, up to 2 decimal places. Not 0, not negative.

**Amount rules (unchanged intent):** `>= 0`, same max `1_000_000`.

### Response `data` (PATCH) — do not rename/remove

| Name | Type | Persist/cache | Meaning |
|------|------|---------------|---------|
| `sadaqahAmount` | number | **yes** | Today’s total (existing contract) |
| `amount` | number | yes | Same as `sadaqahAmount` |
| `goal` | number | **yes** | Current personal target (was always `1000`; now user-editable) |
| `percent` | number | derived | `round(amount/goal*100)` capped 0–100 |
| `currency` | string | display | `"EGP"` |
| `currencyLabelAr` | string | display | `"جنيه"` |
| `currencyLabelEn` | string | display | `"EGP"` |
| `date` | string | display | `YYYY-MM-DD` (today) |
| `category` | string | optional | Only if request sent `category` |
| `breakdown` | object | optional | Category buckets when present |

---

## F. Goal update behavior

| Situation | Result |
|-----------|--------|
| User never set a goal | Default **`goal: 1000`**. Amount starts at **0**. |
| `PATCH { "goal": 2000 }` with amount 350 | Goal **2000**, amount **350** (progress **not** reset). |
| Decrease goal below amount (goal 200, amount 350) | Goal **200**, amount **350**, `percent` **100**. Amount is not reduced. |
| Repeated goal updates | Last write wins; amount unchanged unless `amount` is also sent. |
| `{ "amount": 350 }` only | Amount set; **goal unchanged**. |
| No row yet for today | Goal still stored on the user. GET amount is `0` until an amount is recorded. |

---

## G. Errors

Envelope:

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | VALIDATION_ERROR | …",
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

| Condition | HTTP | `code` |
|-----------|------|--------|
| Missing / invalid token | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` |
| Expired access token | 401 | `TOKEN_EXPIRED` |
| Missing both amount and goal | 400 | `VALIDATION_ERROR` |
| Goal `0`, negative, `NaN`, `> 1000000` | 400 | `VALIDATION_ERROR` |
| Invalid `amount` type / negative | 400 | `VALIDATION_ERROR` |

---

## H. Flutter integration (Edit Goal sheet)

1. Open screen → `GET /journey/sadaqah` → bind slider to `data.goal`, progress text to `data.amount` / `data.goal`.
2. User taps **حفظ** → `PATCH /journey/sadaqah` `{ "goal": <slider> }` only.
3. On **200**, update local UI from `data.goal`, `data.amount`, `data.percent`. Do not zero the bar.
4. On **400**, show `message` (keep the sheet open).
5. On **401** `TOKEN_EXPIRED` → refresh once, retry. Other 401 → login.
6. Re-fetch `GET /journey/sadaqah` (and Home `GET /dashboard` or `GET /journey/today` if those tiles show the same goal).
7. Debounce double-tap on حفظ (one in-flight PATCH).
8. Record donations as today: still `{ "amount": N }` or `{ "amount": N, "mode": "add", "category": "FOOD" }`.

---

## I. Backward compatibility

**Must stay unchanged:**

- Envelope: `success`, `message`, `data`, `meta`, `timestamp`, `requestId`
- `PATCH /journey/sadaqah` with `{ "amount": N }` (`mode` default `set`)
- Response fields `sadaqahAmount`, `amount`, `goal`, `percent`, `currency`, labels, `date`
- `GET /journey/sadaqah` extra screen fields (`goalTitleAr`, `categories`, `featured`, `trackingOnly`, …)
- Nesting of `GET /journey/today` → `data.sadaqah.{ amount, goal, percent, currency, … }`

**Additive only:** request field `goal`. `goal` in responses is the same field name; it is no longer a hardcoded `1000` after the user edits it.
