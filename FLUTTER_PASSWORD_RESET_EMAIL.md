# Noor App — Flutter Integration Note — 2026-08-22

This is a **delta note** for Flutter. Same style and envelope as [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md). It covers **only** two 2026-08-22 backend drops:

1. Password-reset **email delivery** (same two auth routes; no new JSON keys).
2. **Tasbih sync contract** (existing tasbih routes; atomic increment; official local-first + server-authoritative rule).

**Base URL (unchanged):** `https://noor-app-backend-one.vercel.app/api/v1`

---

## 🔹 API Integration Changes Summary — 2026-08-22 (Password-Reset Email Delivery)

- **Updated (ops, not a new route):** `POST /auth/forgot-password` now **sends a real email** when a matching active LOCAL account exists. Previously the server stored a hashed token and did **not** deliver it to the inbox. Flutter still **never** receives the raw token in the JSON body.
- **Updated:** Reset email includes (1) the raw token for **manual paste** on the existing Reset screen, and (2) a deep link so the app can open the same screen when the OS handles the scheme.
- **Updated:** `POST /auth/reset-password` accepts **either** `newPassword` (guide field) **or** `password` (legacy field). Same sign-up password rules. One of the two is required.
- **Unchanged:** Public auth rate limiter, anti-enumeration 200 envelope, `data: null` on both success responses, no Bearer on either route.

### Change Totals (password-reset email)

- New endpoint documentation entries: **0**
- Updated documentation entries: **2**
- Removed documentation entries: **0**
- Wire-level JSON keys added/removed: **none** on the Flutter-facing envelopes

---

## 🔹 API Integration Changes Summary — 2026-08-22 (Tasbih sync)

- **Official product decision (no new routes):** Tasbih is **local-first UX** + **server-authoritative persistence** + **operation-based offline sync**. Increments are **atomic** on the server. Clients must **not** overwrite the server total with a stale local count.
- **Updated (server):** `POST /tasbih/increment` uses an atomic `count += amount` / `totalAllTime += amount`. Two devices tapping at once cannot clobber each other (70 + 1 + 1 = 72). There is **no** “set count to N” endpoint — do not invent one.
- **Unchanged routes:** `GET /tasbih/today`, `POST /tasbih/increment`, `POST /tasbih/reset`, `PATCH /tasbih/change-dhikr` (Bearer). Optional `GET /tasbih/history` is unchanged.
- **No endpoints were added, removed, or renamed.**

### Change Totals (tasbih sync)

- New endpoint documentation entries: **0**
- New Flutter-facing contract (sync rules): **1**
- Removed documentation entries: **0**

---

## 🔹 What Flutter should do

1. Keep the Forgot Password screen: POST email only. On **200**, show a generic SnackBar (Arabic UX is fine) — **do not** branch on “account exists vs not”. The body is identical either way, including when SMTP fails.
2. Keep **manual token paste** on Reset Password — that remains a supported path.
3. Optionally handle the deep link below so tapping the mail button/link opens Reset with `token` pre-filled.
4. After reset **200**: navigate to Login; do **not** auto-login.

---

## 🔹 Deep link (email → app)

Default scheme (backend `RESET_PASSWORD_DEEPLINK`):

```
noorapp://auth/reset-password?token={{token}}
```

Example after substitution (token is URL-encoded):

```
noorapp://auth/reset-password?token=a1b2c3d4e5f6...
```

Flutter: register `noorapp` as a custom URL scheme. Read query param `token`. If the OS cannot open the link, the user pastes the token from the same email.

---

## 🔹 Auth Forgot / Reset Password (same 2 endpoints)

Authorization: **Public** (no Bearer) on both.

Rate limit: auth sensitive limiter (same as login / sign-up).

### 1) POST /auth/forgot-password — Request a reset email

Description: User taps "نسيت كلمة المرور" and submits email. Server hashes a one-time token (1 hour TTL) and emails it when the account exists and is active. Unknown emails, inactive users, and mail-provider failures **all** return the same 200 so attackers cannot enumerate accounts.

Request Body:

```json
{ "email": "AhmedMohamed@gmail.com" }
```

Response Body (200 — **always** this shape for a valid email string; `data` is always `null`; **no token field**):

```json
{
  "success": true,
  "message": "If an account exists for this email, a password reset link has been sent",
  "data": null,
  "timestamp": "2026-08-22T20:00:00.000Z",
  "requestId": "a1b2c3d4-0018-aaaa-bbbb-000000000018"
}
```

Response Body (400 — Zod invalid-email, use `errors[]`):

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address",
      "code": "invalid_string"
    }
  ],
  "timestamp": "2026-08-22T20:00:00.000Z",
  "requestId": "a1b2c3d4-0019-aaaa-bbbb-000000000019"
}
```

Email contents (not in the API): bilingual Noor template, **reset token** (paste), **Open reset screen** deep link, 1-hour expiry.

---

### 2) POST /auth/reset-password — Submit the new password

Description: User pastes the email token **or** arrives via deep link. Confirm field stays client-only. Send token + new password.

Authorization: **Public**.

Request Body (preferred — matches the original guide):

```json
{
  "token": "<token from email or deep-link query>",
  "newPassword": "NewStrongP@ss9!"
}
```

Request Body (also accepted):

```json
{
  "token": "<token from email or deep-link query>",
  "password": "NewStrongP@ss9!"
}
```

Validation: **same as sign-up** — min 8 characters, at least one letter AND at least one digit.

Response Body (200):

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null,
  "timestamp": "2026-08-22T20:05:00.000Z",
  "requestId": "a1b2c3d4-0020-aaaa-bbbb-000000000020"
}
```

Response Body (400 — token expired / malformed / already used):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid or expired reset token",
  "timestamp": "2026-08-22T20:05:00.000Z",
  "requestId": "a1b2c3d4-0021-aaaa-bbbb-000000000021"
}
```

Response Body (400 — missing/weak password, Zod `errors[]` on `password` or `newPassword`):

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least one letter and one number",
      "code": "invalid_string"
    }
  ],
  "timestamp": "2026-08-22T20:05:00.000Z",
  "requestId": "a1b2c3d4-0022-aaaa-bbbb-000000000022"
}
```

After 200: auto-navigate to Login and show a SnackBar `"تم تغيير كلمة المرور. سجل دخول الآن."`. Do **not** auto-login.

---

## 🔹 Tasbih — official sync contract (2026-08-22)

**Decision (locked):** Tasbih uses local-first UX with server-authoritative persistence and operation-based offline synchronization; increments must be atomic and clients must not overwrite server counts with stale local totals.

| Part | Decision |
| ---- | -------- |
| UI responsiveness | Local-first: update the circle immediately on tap |
| Source of truth | Server `GET /tasbih/today` after sync |
| Offline | Queue **operations** (`+amount`), not a replacement total |
| Increment | `POST /tasbih/increment` — atomic on the server |
| Multi-device | Replay queued increments; then trust server `count` |
| Reset | `POST /tasbih/reset` (server operation) |
| Change dhikr | `PATCH /tasbih/change-dhikr` (server operation) |
| Cold start / new device | `GET /tasbih/today` then render `data.count` / `data.dhikrAr` |
| Sending a full local `count` to overwrite the server | **Forbidden** |

Authorization on all tasbih routes: **Bearer**.

### Why not “set count = 50”

If Device A is at 70 on the server and Device B is stale at 50, a PUT/PATCH of `count: 50` **deletes** 20 taps. Never do that. Always send **deltas**.

Example: server `count = 70`, Device A `+1`, Device B `+1` → server `72`.

### Client flow (tap)

```
Tap
 → update local UI immediately
 → enqueue { op: "increment", amount: 1 }
 → POST /tasbih/increment  { "amount": 1 }   // fire-and-forget / retry queue
 → on 200, optional: adopt data.count from the response
```

### Client flow (offline then back online)

```
queued +1, +1, +1
 → flush in order as POST /tasbih/increment { "amount": 1 }  (or one call with amount: 3 if you collapsed the queue locally)
 → GET /tasbih/today
 → replace on-screen totals with server data.count (pending queue must be empty)
```

If `GET /tasbih/today` returns `72` and local unsynced UI is `50` with **empty** queue: **show 72**. The other device already won.

If the queue still has unsynced `+N`, do **not** replace with GET first and then also replay if those `+N` were already included — flush the queue, then GET (or use the last increment 200 body).

### Wire shape (actual server `data` — keep this stable)

`GET /tasbih/today` and increment/reset/change-dhikr 200 `data`:

```json
{
  "success": true,
  "message": "Today tasbih retrieved successfully",
  "data": {
    "id": "clx8tasbih0001",
    "date": "2026-08-22T00:00:00.000Z",
    "dhikr": "SUBHAN_ALLAH",
    "dhikrAr": "سبحان الله",
    "count": 72,
    "totalAllTime": 1040
  },
  "timestamp": "2026-08-22T21:00:00.000Z",
  "requestId": "a1b2c3d4-0300-aaaa-bbbb-000000000300"
}
```

| Field | Meaning |
| ----- | ------- |
| `dhikr` | Enum (same 6 values as the main guide) |
| `dhikrAr` | Arabic label for the circle |
| `count` | Authoritative **today** total (this is what a new device must show) |
| `totalAllTime` | Lifetime counter (reset today does **not** zero this) |

`POST /tasbih/increment` body: `{ "amount": 1 }` — `amount` optional, default `1`, integer ≥ 1.

`POST /tasbih/reset`: no body. Sets **today** `count` to `0`. Does not clear `totalAllTime`. Current `dhikr` stays.

`PATCH /tasbih/change-dhikr` body: `{ "dhikr": "ALHAMDULILLAH" }`. Updates today’s dhikr. Server keeps the same today `count` (one daily counter, not a per-dhikr column). If the UI still shows a per-dhikr number inside the circle, that split is **local presentation**; do not send a reduced total to “reset the circle” on the server.

### What Flutter must not do

- Do not add `PUT /tasbih/today` or `PATCH` with `{ "count": 50 }`.
- Do not skip the increment queue and “sync once” with the local absolute number.
- Do not ignore `GET /tasbih/today` forever on a second device (otherwise the new phone stays at 0 while the server is 72).

Hydrating the UI from `GET /tasbih/today` at Tasbih-tab open / app resume is now **required** for multi-device correctness. Local-first still applies for taps.

---

## 🔹 Flutter QA after backend redeploy

### Password reset

1. Forgot Password with a **real** account email → 200 + envelope above → inbox (check spam) has token + `noorapp://...` link.
2. Forgot Password with an **unknown** email → **same** 200; no email.
3. Confirm JSON never contains `token`, `resetToken`, or `deeplink`.
4. Reset with `newPassword` → 200 → login works with the new password.
5. Reset with `password` only → 200 (same rules).
6. Reuse the same token → 400 `VALIDATION_ERROR`.
7. Optional: tap the email deep link → Reset screen with token filled.

### Tasbih

1. Two devices, same account: tap +1 on A and +1 on B → `GET /tasbih/today` `count` increased by 2 (not overwritten).
2. Airplane mode: tap 5 times locally → reconnect → five increments (or `amount: 5`) → GET matches local+server, not a stale smaller number.
3. New device: open Tasbih → GET → shows server `count`, not 0, if the other phone already synced.

---

## 🔹 Out of scope (not part of this drop)

No Flutter contract changes for dashboard, Quran hygiene, khatmah, journey dual-counter, profile, challenges, or notifications. Continue using [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md) for those screens.
