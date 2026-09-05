# Tasbih Feature — Backend Contract for Flutter

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-05  
**Language:** English only  

This document is the **verified** Backend → Flutter contract for the **Tasbih** feature only. It is based on the current Production Backend implementation (routes, services, Prisma models). Do **not** invent client behavior from older OpenAPI samples if they conflict with this file — **this file wins**.

Related:

- Full app contract: [`FLUTTER_DATA_CONTRACT_REPLY.md`](./FLUTTER_DATA_CONTRACT_REPLY.md)
- Auth / envelope rules: same as that document  

---

## Status snapshot

| Area | Status |
|------|--------|
| Session APIs (`/tasbih/*`) | Implemented + Production-live (auth required) |
| Global catalog (`GET /tasbihs`) | Implemented + Production-verified (public) |
| Personal custom add (`POST /tasbihs`) | Implemented + Production-live (auth required) |
| Personal custom remove (`DELETE /tasbihs/:id`) | Implemented + Production-live (auth required) |
| Personal custom **list** (`GET` of user customs) | **Not exposed** — service helper exists; no HTTP route yet |
| Dashboard utility flag | `utilities.tasbih.enabled: true` on `GET /dashboard` |

---

## 0) Envelope

### Success

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "meta": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Error

```json
{
  "success": false,
  "message": "string",
  "code": "UNAUTHORIZED | INVALID_TOKEN | TOKEN_EXPIRED | VALIDATION_ERROR | NOT_FOUND | CONFLICT | …",
  "details": {},
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Auth rules (Tasbih)

| Endpoint group | Auth |
|----------------|------|
| `GET /tasbihs` (catalog) | **Public** (no Bearer) |
| `POST /tasbihs`, `DELETE /tasbihs/:id` | **Bearer** access token |
| All `/tasbih/*` session APIs | **Bearer** access token |

| Condition | Flutter action |
|-----------|----------------|
| `401` + `INVALID_TOKEN` | Clear session |
| `401` + `TOKEN_EXPIRED` | `POST /auth/refresh` once, retry |
| Network / 5xx | Do **not** hard-logout |

Header:

```http
Authorization: Bearer <accessToken>
```

---

## 1) Two route prefixes (do not mix)

| Prefix | Purpose |
|--------|---------|
| `/tasbih` (singular) | **Session counter** for the logged-in user (today / increment / reset / change-dhikr / history) |
| `/tasbihs` (plural) | **Catalog** of authentic phrases + **personal custom** add/remove |

Dashboard only exposes a launch flag under `utilities.tasbih.enabled` — it does **not** return the counter state. Load counter via `/tasbih/today`.

---

## 2) Global catalog — `GET /tasbihs` (public)

### Request

```http
GET /api/v1/tasbihs
```

No auth. No query params.

### Response `data`

`data` is a **JSON array** (not wrapped in `{ items: … }`).

Each element:

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string enum | Stable id — use with `PATCH /tasbih/change-dhikr` as `dhikr` |
| `order` | int | 1-based display order |
| `text` | string | Arabic phrase for the picker UI |
| `count` | int \| null | Suggested target repetitions when an authentic fixed count exists; otherwise `null` |

### Production-verified catalog (9 items)

| order | id | text | count |
|------:|----|------|------:|
| 1 | `SUBHAN_ALLAH` | سبحان الله | 33 |
| 2 | `ALHAMDULILLAH` | الحمد لله | 33 |
| 3 | `LA_ILAHA_ILLA_ALLAH` | لا إله إلا الله | null |
| 4 | `ALLAHU_AKBAR` | الله أكبر | 33 |
| 5 | `ASTAGHFIRULLAH` | أستغفر الله | null |
| 6 | `LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH` | لا حول ولا قوة إلا بالله | null |
| 7 | `SUBHAN_ALLAHI_WA_BIHAMDIHI` | سبحان الله وبحمده | 100 |
| 8 | `LA_ILAHA_ILLA_ALLAH_WAHDAHU` | لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير | 100 |
| 9 | `SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM` | سبحان الله وبحمده، سبحان الله العظيم | null |

### Example

```json
{
  "success": true,
  "message": "Tasbih catalog retrieved successfully",
  "data": [
    {
      "id": "SUBHAN_ALLAH",
      "order": 1,
      "text": "سبحان الله",
      "count": 33
    }
  ],
  "meta": {},
  "timestamp": "…",
  "requestId": "…"
}
```

### Flutter notes

- Prefer this endpoint for the **اختر الذكر** sheet instead of hardcoding the first six phrases.  
- Catalog `id` values are the **only** values accepted by `PATCH /tasbih/change-dhikr`.  
- Custom personal phrases (below) use UUID `id`s — they are **not** valid `change-dhikr` enum values.

---

## 3) Personal custom list — add / remove (auth)

Stored per user in `user_tasbihs`. Scoped to the authenticated user only.

### 3.1 Add — `POST /tasbihs`

```http
POST /api/v1/tasbihs
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body**

| Field | Required | Rules |
|-------|----------|-------|
| `text` | yes | string, trimmed, 1–500 chars |
| `count` | no | integer 1…100000, or `null` / omit for open-ended |

```json
{
  "text": "رب اغفر لي",
  "count": 100
}
```

**Success:** `201`

```json
{
  "success": true,
  "message": "Custom tasbih added to your list",
  "data": {
    "id": "uuid",
    "order": 1,
    "text": "رب اغفر لي",
    "count": 100,
    "isCustom": true
  },
  "meta": {},
  "timestamp": "…",
  "requestId": "…"
}
```

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` / … | Missing/invalid Bearer |
| 400 | `VALIDATION_ERROR` | Bad body |
| 409 | `CONFLICT` | Same normalized `text` already exists for this user |

Whitespace is normalized (trim + collapse spaces) before uniqueness check.

### 3.2 Remove — `DELETE /tasbihs/:id`

```http
DELETE /api/v1/tasbihs/<uuid>
Authorization: Bearer <accessToken>
```

`:id` must be a **UUID** of a row owned by the caller.

**Success:** `200`

```json
{
  "success": true,
  "message": "Custom tasbih removed from your list",
  "data": { "removed": true },
  "meta": {},
  "timestamp": "…",
  "requestId": "…"
}
```

| Status | Code | When |
|--------|------|------|
| 401 | … | Auth failed |
| 400 | `VALIDATION_ERROR` | `:id` not a UUID |
| 404 | `NOT_FOUND` | Unknown id, or id belongs to another user |

Catalog items cannot be deleted via this endpoint (they are not rows in `user_tasbihs`).

### 3.3 Important gap

There is **no** Production HTTP endpoint today that returns the full personal custom list (`listUserTasbihs` exists only in Backend service code).

Flutter must:

- Keep the `id` returned from `POST /tasbihs`, and/or  
- Persist personal customs locally until a list endpoint is added.

---

## 4) Session counter — `/tasbih/*` (auth)

### Important implementation fact (read carefully)

Backend stores **one** `tasbih_logs` row per user per calendar day with a **single** `count` integer and a current `dhikr` enum.

Therefore in API responses today:

- `count`  
- `todayCount`  
- `currentDhikrCount`  

are **the same number** (all mapped from `log.count`).

`PATCH /change-dhikr` changes the selected `dhikr` label only — it does **not** zero the stored count.

`POST /reset` sets `count` to `0` for today (dhikr selection is kept).

`dailyGoal` is fixed at **99**.  
`progressPercent` = `min(100, round(count * 100 / 99))`.

English labels (`dhikrEn` / `currentDhikrEn`) are also returned by the service mapping.

---

### 4.1 `GET /tasbih/today`

Initial load for the Tasbih screen.

```http
GET /api/v1/tasbih/today
Authorization: Bearer <accessToken>
```

Creates today’s row if missing (default dhikr `ALHAMDULILLAH` at DB level; response still maps AR/EN names).

**Example `data` shape (fields actually returned):**

```json
{
  "count": 0,
  "dhikr": "ALHAMDULILLAH",
  "dhikrAr": "الحمد لله",
  "dhikrEn": "All praise is due to Allah",
  "dailyGoal": 99,
  "progressPercent": 0,
  "todayCount": 0,
  "currentDhikr": "ALHAMDULILLAH",
  "currentDhikrAr": "الحمد لله",
  "currentDhikrEn": "All praise is due to Allah",
  "currentDhikrCount": 0,
  "id": "uuid",
  "date": "2026-09-05T00:00:00.000Z",
  "totalAllTime": 0
}
```

---

### 4.2 `POST /tasbih/increment`

Circle tap.

```http
POST /api/v1/tasbih/increment
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Body** (optional):

```json
{ "amount": 1 }
```

- `amount` integer ≥ 1 (default `1` if omitted)  
- Increments both `count` and `totalAllTime` by `amount`  
- Returns the same enriched today shape as `/today`

---

### 4.3 `POST /tasbih/reset`

```http
POST /api/v1/tasbih/reset
Authorization: Bearer <accessToken>
```

No body. Sets today’s `count` to `0`. Returns enriched today shape (`progressPercent: 0`). Current `dhikr` is unchanged.

---

### 4.4 `PATCH /tasbih/change-dhikr`

```http
PATCH /api/v1/tasbih/change-dhikr
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{ "dhikr": "SUBHAN_ALLAH" }
```

**Allowed `dhikr` values** (must match catalog `id`s):

| Enum | Arabic (`dhikrAr`) |
|------|--------------------|
| `SUBHAN_ALLAH` | سبحان الله |
| `ALHAMDULILLAH` | الحمد لله |
| `LA_ILAHA_ILLA_ALLAH` | لا إله إلا الله |
| `ALLAHU_AKBAR` | الله أكبر |
| `ASTAGHFIRULLAH` | أستغفر الله |
| `LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH` | لا حول ولا قوة إلا بالله |
| `SUBHAN_ALLAHI_WA_BIHAMDIHI` | سبحان الله وبحمده |
| `LA_ILAHA_ILLA_ALLAH_WAHDAHU` | لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير |
| `SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM` | سبحان الله وبحمده، سبحان الله العظيم |

Unknown value → `400 VALIDATION_ERROR`.  
Custom personal UUID from `POST /tasbihs` is **not** accepted here.

---

### 4.5 `GET /tasbih/history`

```http
GET /api/v1/tasbih/history?limit=30
Authorization: Bearer <accessToken>
```

| Query | Default | Rules |
|-------|---------|-------|
| `limit` | 30 | int 1…100 |
| `page` | accepted by validator | **not applied** in current service (ignored) |

**`data`:** array of daily logs (newest first), each:

```json
{
  "id": "uuid",
  "date": "2026-09-05T00:00:00.000Z",
  "dhikr": "SUBHAN_ALLAH",
  "count": 42,
  "totalAllTime": 900,
  "dhikrAr": "سبحان الله"
}
```

This is **not** a paginated `{ data, meta.page }` envelope today — it is a plain array inside `data`.

---

## 5) Endpoint index

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/tasbihs` | No | Global authentic catalog |
| POST | `/tasbihs` | Yes | Add personal custom phrase |
| DELETE | `/tasbihs/:id` | Yes | Remove own custom phrase |
| GET | `/tasbih/today` | Yes | Today counter state |
| POST | `/tasbih/increment` | Yes | +N taps |
| POST | `/tasbih/reset` | Yes | Zero today’s count |
| PATCH | `/tasbih/change-dhikr` | Yes | Switch catalog dhikr |
| GET | `/tasbih/history` | Yes | Recent daily logs |

---

## 6) Flutter integration checklist

- [ ] Load picker from `GET /tasbihs` (do not hardcode catalog)  
- [ ] Show `text`; use catalog `count` as optional target UI when non-null  
- [ ] On select catalog item → `PATCH /tasbih/change-dhikr` with `{ "dhikr": "<id>" }`  
- [ ] Screen open → `GET /tasbih/today`  
- [ ] Circle tap → `POST /tasbih/increment` (optimistic UI OK; reconcile on response)  
- [ ] Reset button → `POST /tasbih/reset`  
- [ ] Treat `todayCount` / `currentDhikrCount` / `count` as **one** server counter today  
- [ ] Custom add → `POST /tasbihs`; store returned `id` locally  
- [ ] Custom remove → `DELETE /tasbihs/:id`  
- [ ] Do **not** send custom UUID to `change-dhikr`  
- [ ] Haptics / animation are client-only  
- [ ] Offline: session APIs are online-authoritative — show offline banner; do not invent silent sync unless you add an outbox yourself  

---

## 7) Ownership

| Concern | Backend | Flutter |
|---------|---------|---------|
| Authentic catalog + counts | Owns | Render picker |
| Personal custom storage | Owns (add/remove) | UI + keep returned ids until list API exists |
| Daily counter persistence | Owns | UI + optimistic taps |
| AR/EN labels for catalog enums | Owns | Display `dhikrAr` / catalog `text` |
| Guest / offline local counter | — | Owns if product requires guests |

---

## 8) Known limitations (current Backend)

1. **No GET for personal customs** — only POST/DELETE.  
2. **Single daily counter** — not separate per-dhikr counters server-side.  
3. **`change-dhikr` does not reset count.**  
4. **History `page` query is not applied.**  
5. Custom phrases are **picker/list data only** until a future change allows counting them via `/tasbih/*`.

---

## 9) Production URLs (copy/paste)

```text
https://noor-app-backend-one.vercel.app/api/v1/tasbihs
https://noor-app-backend-one.vercel.app/api/v1/tasbih/today
https://noor-app-backend-one.vercel.app/api/v1/tasbih/increment
https://noor-app-backend-one.vercel.app/api/v1/tasbih/reset
https://noor-app-backend-one.vercel.app/api/v1/tasbih/change-dhikr
https://noor-app-backend-one.vercel.app/api/v1/tasbih/history
```

---

*Document generated from the live Backend Tasbih implementation as of 2026-09-05. If code and this file diverge later, re-verify against Production before shipping Flutter changes.*
