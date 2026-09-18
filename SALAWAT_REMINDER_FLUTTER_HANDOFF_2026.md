# Salawat reminder — Flutter handoff (2026)

**Audience:** Flutter (`com.noor.app`)  
**From:** Noor Backend  
**Date:** 2026-09-19  
**Feature:** Pray for the Prophet ﷺ / الصلاة على النبي

This is the **implemented** contract (source + DB + tests). Do not invent extra fields.

---

## A. Production base URL

```text
https://noorapp-backend-production.up.railway.app/api/v1
```

Retired (do not use): `https://noor-app-backend-one.vercel.app/api/v1`

---

## B. Endpoints

Same resource as today. **No new path.** Auth: `Authorization: Bearer <accessToken>`.

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/profile/salawat-preferences` | Read this user's prefs |
| `PATCH` | `/profile/salawat-preferences` | Partial update (legacy `{ "enabled": true\|false }` still valid) |
| `PUT` | `/profile/salawat-preferences` | Same handler as PATCH (added 2026-09-19) |

Preferences live on the **user row** (one record per account, all devices). Other users' prefs are never returned.

### Request body (`PATCH` / `PUT`)

At least one field required. Extra keys are ignored.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `enabled` | boolean | no* | Must be JSON boolean |
| `intervalMinutes` | integer | no* | **Only** `30`, `60`, `120`, `180` |
| `startTime` | string | no* | `HH:mm` 00:00–23:59 (e.g. `"08:00"`) |
| `endTime` | string | no* | `HH:mm` 00:00–23:59 (e.g. `"22:00"`) |

\*At least one of the four must be present. Legacy clients may send **only** `{ "enabled": true }`.

Overnight window is allowed (`startTime` > `endTime`, e.g. `"22:00"` → `"08:00"`).

### Success

HTTP **200**, envelope:

```text
success, message, data, meta, timestamp, requestId
```

### Errors

| Condition | HTTP | `code` |
|-----------|------|--------|
| Missing / invalid token | 401 | `UNAUTHORIZED` / `INVALID_TOKEN` |
| Expired access token | 401 | `TOKEN_EXPIRED` |
| Empty body / invalid interval / invalid time | 400 | `VALIDATION_ERROR` |

---

## C. Example requests

```http
GET /profile/salawat-preferences
Authorization: Bearer <accessToken>
```

```http
PATCH /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "enabled": true }
```

```http
PUT /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "enabled": true,
  "intervalMinutes": 60,
  "startTime": "08:00",
  "endTime": "22:00"
}
```

```http
PATCH /profile/salawat-preferences
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "enabled": false }
```

---

## D. Example response (`data`)

**Persist / bind UI to these:**

| Field | Persist? | Meaning |
|-------|----------|---------|
| `enabled` | **yes** | Master switch |
| `intervalMinutes` | **yes** | 30 / 60 / 120 / 180 |
| `startTime` | **yes** | Active window start `HH:mm` (user local tz) |
| `endTime` | **yes** | Active window end `HH:mm` |
| `intervalHours` | optional | `intervalMinutes / 60` (legacy; may be `0.5` for 30 min) |
| `maxPerDay` | optional | Server cap derived from window ÷ interval |
| `quietHoursStart` | optional | Legacy = `endTime` (quiet begins when active ends) |
| `quietHoursEnd` | optional | Legacy = `startTime` |

Exact shape:

```json
{
  "success": true,
  "message": "Salawat reminder preferences retrieved successfully",
  "data": {
    "enabled": false,
    "intervalMinutes": 180,
    "startTime": "08:00",
    "endTime": "22:00",
    "intervalHours": 3,
    "maxPerDay": 4,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00"
  },
  "meta": {},
  "timestamp": "2026-09-19T00:00:00.000Z",
  "requestId": "uuid"
}
```

**Do not remove** `intervalHours`, `maxPerDay`, `quietHoursStart`, `quietHoursEnd` — existing Flutter may already read them.

Update message is: `Salawat reminder preferences updated successfully`.

---

## E. Flutter behavior

1. **Default / initial:** `enabled: false`. Do **not** schedule or expect FCM until the user turns it on. Server default for new users is off; existing users were set off in the 2026-09-19 migration (opt-in again).
2. **Load:** `GET /profile/salawat-preferences` after login; cache `enabled`, `intervalMinutes`, `startTime`, `endTime`.
3. **Enable:** `PATCH` or `PUT` `{ "enabled": true }` (optionally with interval/window in the same call).
4. **Disable:** `{ "enabled": false }`. Stop local schedules immediately; backend cron will not send.
5. **Interval:** `PUT`/`PATCH` `{ "intervalMinutes": 30|60|120|180 }`.
6. **Window:** `{ "startTime": "HH:mm", "endTime": "HH:mm" }` in the **profile timezone** (`users.timezone`, same as prayer/Azan — not the device TZ unless you synced it).
7. **`401` + `UNAUTHORIZED` / `INVALID_TOKEN`:** clear session, go to login.
8. **`401` + `TOKEN_EXPIRED`:** `POST /auth/refresh` once, retry.
9. **OS notification permission denied:** keep prefs synced, but do not expect delivery. Show a system-settings prompt; backend cannot grant permission.
10. **FCM unavailable:** Production `GET /health` may show `fcm.configured: false`. Prefs still persist. Backend cron **does not crash**; pushes no-op. Local notifications still work if you schedule them.
11. **Who fires the reminder?**  
    - **Local notifications = primary UX** (same idea as Azan): schedule from these prefs in the user timezone, only if `enabled`.  
    - **Backend FCM = backup** on the existing `/cron/prayer-reminders` job (~10 min), only if `enabled === true` and a device token exists. Payload `data.type = SALAWAT`, `kind = salawat_reminder`. In-app inbox row type `SALAWAT`.
12. **Avoid duplicates:** one preference row per user (not per device). If you schedule locally **and** show FCM, ignore FCM when a local notification for the same slot already fired (or treat FCM as backup only when the app is killed, as you do for Azan). Backend de-dupes FCM with a durable `salawat_send_logs` unique `(userId, occurrenceKey)` plus “too soon” using `intervalMinutes`.

Timezone: backend uses `User.timezone` (IANA, fallback `Africa/Cairo`). Keep profile location/timezone in sync; do not assume Cairo.

Account deletion (`DELETE /auth/me`) removes the user row, prefs, send logs, FCM tokens, and SALAWAT inbox rows.

---

## Architecture (backend, for context)

- Cron: same `POST /cron/prayer-reminders` as Azan backup (does not change Azan rules).
- Send path: existing `sendPushToUser` / FCM + `createNotification`.
- Disabled users are never scanned.
- Invalid FCM tokens are pruned; one bad token does not fail the job.
