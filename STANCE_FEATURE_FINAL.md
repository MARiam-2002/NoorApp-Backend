# Noor App — موقفك إيه؟ (What's Your Stance) — Final Backend Integration Contract

> **Status:** 100% READY — Backend implementation for Flutter screen **"موقفك إيه؟"** (daily ethical situation + 3 choices + شرعي reveal + consecutive **الموقف التالي**). Additive routes only under `/stances/*`. Existing Azan / Journey / Quran / Sajdah contracts are unchanged.
>
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`
>
> **Hard Rule for Flutter — DO NOT BREAK:** Every JSON response uses the mandatory `{success,message,data,meta,timestamp,requestId}` standard envelope. Never invent response shapes. Use catalog **`id`** values (`stance_001` …) exactly as returned.

---

## 0. Standard Envelope (MANDATORY — every endpoint)

```jsonc
{
  "success": true | false,
  "message": "human readable string",
  "data": { /*…*/ } | [/*…*/] | null,
  "meta": {} | { /* optional */ },
  "timestamp": "2026-09-26T00:00:00.000Z",
  "requestId": "uuid"
}
```

4xx/5xx errors also include `"code"` (e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`) and may include additive diagnostics fields `blame` / `nextCheck` (safe to log; ignore in UI if unused).

**Auth**

| Endpoint | Auth |
|----------|------|
| `GET /stances/today` | Optional Bearer |
| `GET /stances/next` | Optional Bearer |
| `GET /stances/catalog` | Public |
| `GET /stances/:id` | Optional Bearer |
| `POST /stances/:id/answer` | Optional Bearer (**points only if logged in**) |

```http
Authorization: Bearer <access_token>
```

---

## 1. UI → Exact API Mapping (matches screenshot)

| UI element (AR) | Backend field |
|-----------------|---------------|
| Title **موقفك إيه؟** | App chrome (fixed) |
| Gold label **موقف اليوم** | `data.situation.labelAr` (today) or `"الموقف"` for next |
| Situation paragraph | `data.situation.situationAr` |
| 3 radio options | `data.situation.options[0..2]` → `key` = `A`\|`B`\|`C`, `textAr` |
| Selected option | Local UI; submit `selectedOptionKey` |
| Green card title **الرأي الشرعي والأصح** | `data.rulingTitleAr` **or** after answer `same` + show `data.reveal.rulingAr` |
| Green card body | `data.reveal.rulingAr` (+ optional show `data.reveal.sourceAr`) |
| Button **الموقف التالي** | Label `data.nextCtaAr`; navigate using `data.situation.nextId` or `GET /stances/next?afterId=` |
| Content disclaimer (optional footer) | `data.contentPolicyAr` |

**Important UX rules**

1. **Before answer:** do **not** show `correctOptionKey` / `rulingAr`. Backend omits `reveal` (or `reveal: null`) until answered.
2. **On option tap:** call `POST /stances/{id}/answer` immediately, then render the green card from `data.reveal`.
3. **الموقف التالي:** call `GET /stances/next?afterId={currentId}` (preferred) or open `GET /stances/{nextId}`.

---

## 2. Product logic (2026)

| Concern | Behavior |
|---------|----------|
| Catalog size | DB-backed curated list (currently **80** active rows; grows via seed — Flutter does not hard-code count) |
| **موقف اليوم** | `dayOfYear` (1–366) → `index = (dayOfYear - 1) % catalogSize` |
| **الموقف التالي** (logged-in) | Prefer **unanswered** situations after current, then any unanswered, then wrap |
| **الموقف التالي** (guest) | Sequential wrap by `sortOrder` |
| Answer once | Same user + same `situationId` → idempotent; returns saved reveal; **no double points** |
| Points | `rewardPoints` (default 15) awarded **once** on first answer when Bearer present |
| Correctness policy | Every row has `sourceAr` (Qur’an / authentic Hadith / agreed principle). Educational — **not** a personal fatwa (`contentPolicyAr`) |

---

## 3. Endpoint catalog

### 3.1 `GET /stances/today` — Situation of the day

```http
GET /api/v1/stances/today
Authorization: Bearer <optional>
```

Optional query: `?dayOfYear=268` (tests / overrides; default = server calendar day-of-year).

**Success `data` shape**

```jsonc
{
  "dayOfYear": 268,
  "isToday": true,
  "situation": {
    "id": "stance_028",
    "sortOrder": 28,
    "catalogSize": 80,
    "labelAr": "موقف اليوم",
    "situationAr": "…",
    "situationEn": null,
    "options": [
      { "key": "A", "textAr": "…" },
      { "key": "B", "textAr": "…" },
      { "key": "C", "textAr": "…" }
    ],
    "nextId": "stance_029",
    "prevId": "stance_027",
    "rewardPoints": 15,
    "alreadyAnswered": false,
    "selectedOptionKey": null
  },
  "reveal": null,
  "rulingTitleAr": "الرأي الشرعي والأصح",
  "nextCtaAr": "الموقف التالي",
  "contentPolicyAr": "محتوى تعليمي بمراجع من القرآن والسنة؛ ليس بديلاً عن فتوى شخصية لحالتك."
}
```

If the user already answered today (Bearer), `reveal` is populated and `alreadyAnswered=true`.

---

### 3.2 `POST /stances/{id}/answer` — Submit choice → green card

```http
POST /api/v1/stances/stance_001/answer
Authorization: Bearer <optional>
Content-Type: application/json

{ "selectedOptionKey": "A" }
```

`selectedOptionKey` must be `"A"` | `"B"` | `"C"` (case-insensitive; normalized to upper).

**Success `data` shape**

```jsonc
{
  "alreadyAnswered": false,
  "situation": { /* same public card; alreadyAnswered may be true */ },
  "reveal": {
    "correctOptionKey": "A",
    "isCorrect": true,
    "rulingAr": "…",
    "rulingEn": null,
    "sourceAr": "حديث: «من غش فليس منا» (مسلم)",
    "pointsAwarded": 15,
    "selectedOptionKey": "A"
  },
  "nextId": "stance_002",
  "rulingTitleAr": "الرأي الشرعي والأصح",
  "nextCtaAr": "الموقف التالي",
  "contentPolicyAr": "…"
}
```

| Client | Points |
|--------|--------|
| Guest (no Bearer) | `pointsAwarded = 0`; ruling still returned |
| Logged-in first answer | `pointsAwarded = situation.rewardPoints`; `User.points` incremented |
| Logged-in repeat | `alreadyAnswered: true`; same saved reveal; **0 new points** |

---

### 3.3 `GET /stances/next` — Consecutive next

```http
GET /api/v1/stances/next?afterId=stance_001
Authorization: Bearer <optional>
```

- `afterId` required for true consecutive behavior (if omitted, backend falls back to today).
- Response shape = same as `/stances/today` (`isToday: false`, `labelAr: "الموقف"`).

---

### 3.4 `GET /stances/{id}` — Open one situation by id

```http
GET /api/v1/stances/stance_001
Authorization: Bearer <optional>
```

Same payload shape as today/next.

---

### 3.5 `GET /stances/catalog` — Lightweight list (optional)

```http
GET /api/v1/stances/catalog
```

```jsonc
{
  "count": 80,
  "items": [
    { "id": "stance_001", "sortOrder": 1, "situationAr": "…", "sourceAr": "…" }
  ]
}
```

Use for debug / admin previews — **not** required for the main screen.

---

## 4. Flutter implementation checklist

- [ ] Screen open → `GET /stances/today`
- [ ] Render `situation.situationAr` + 3 radios from `options`
- [ ] On select → `POST /stances/{id}/answer` with `{ selectedOptionKey }`
- [ ] Show green card: title `rulingTitleAr`, body `reveal.rulingAr` (optionally source line)
- [ ] Disable changing answer after success (or allow re-open saved reveal only)
- [ ] **الموقف التالي** → `GET /stances/next?afterId={id}` then repeat
- [ ] Do **not** hard-code option texts, rulings, or catalog size
- [ ] Log `requestId` on errors for Backend diagnosis
- [ ] Guest mode works without login; login enables points + unanswered queue

---

## 5. Flutter QA matrix (production)

- [ ] Today returns `success: true`, `situation.options.length == 3`
- [ ] Before answer: `reveal == null`
- [ ] Answer `A` on wallet situation (`stance_001` when that is today’s mapped id **or** open by id) → green card appears
- [ ] Wrong option → `reveal.isCorrect == false` but ruling still shown
- [ ] Second answer same id (logged-in) → `alreadyAnswered: true`, points not doubled
- [ ] Next (logged-in) skips already-answered when possible
- [ ] Guest next walks sequentially and wraps at end → first
- [ ] Offline / 401 handling does not crash; missing token does not delete account

---

## 6. cURL smoke (production)

```bash
BASE=https://noorapp-backend-production.up.railway.app/api/v1

curl -sS "$BASE/stances/today" | jq '.success,.data.situation.id,.data.situation.catalogSize'

ID=$(curl -sS "$BASE/stances/today" | jq -r '.data.situation.id')

curl -sS -X POST "$BASE/stances/$ID/answer" \
  -H 'Content-Type: application/json' \
  -d '{"selectedOptionKey":"A"}' | jq '.success,.data.reveal.rulingAr,.data.nextId'

curl -sS "$BASE/stances/next?afterId=$ID" | jq '.success,.data.situation.id'
```

---

## 7. Do / Don’t

**Do**

- Trust `options[].key` as `A`/`B`/`C`
- Use `nextId` / `/stances/next` for consecutive flow
- Show `sourceAr` in a small caption under the ruling (recommended)

**Don’t**

- Guess the correct option client-side
- Hard-code 60/80 as forever count
- Treat rulings as personalized fatwas
- Call answer twice expecting more points

---

## 8. Ops note (Backend)

```bash
npx prisma migrate deploy
npx tsx src/scripts/seed-stances.ts
```

Additive migrations: `stance_answers`, `stance_situations`.

---

*End of contract — send this file only for the What's Your Stance / موقفك إيه؟ feature.*
