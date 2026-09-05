# Backend: Firebase / FCM project alignment

**Audience:** Backend / Vercel ops  
**Status:** Flutter client is locked to Firebase project **`noorapp-d5d7d`** with application ID **`com.noor.app`**.

---

## Canonical Firebase project (use this only)

| Field | Value |
|-------|--------|
| **Project ID** | `noorapp-d5d7d` |
| **Console** | https://console.firebase.google.com/project/noorapp-d5d7d/overview |
| **Project number / messagingSenderId** | `770958562307` |
| **Storage bucket** | `noorapp-d5d7d.firebasestorage.app` |

> Do **not** use `noor-app-mahmoud` (or any other project). Device FCM tokens are issued only for `noorapp-d5d7d`. Sending from a different project → `sent:0` / undelivered.

---

## Registered mobile apps (Flutter)

| Platform | Package / Bundle ID | Firebase App ID |
|----------|---------------------|-----------------|
| Android | **`com.noor.app`** | `1:770958562307:android:5031fcc31f80a886796a36` |
| iOS | **`com.noor.app`** | `1:770958562307:ios:b286f822000af347796a36` |

Do **not** use package `com.example.noor`.

If Backend docs or Firebase Console still list `com.example.noor`, update them to **`com.noor.app`**. The Flutter `applicationId` / iOS bundle ID is already `com.noor.app`.

Register (or confirm) both apps under **`noorapp-d5d7d`**, then Flutter regenerates client config with:

```powershell
.\tool\configure_firebase.ps1
```

---

## Required Vercel env (must match this project)

Use a service account from **`noorapp-d5d7d` only**:

**Option A (preferred)**

```text
FIREBASE_SERVICE_ACCOUNT_JSON=<full JSON from noorapp-d5d7d>
```

**Option B**

```text
FIREBASE_PROJECT_ID=noorapp-d5d7d
FIREBASE_CLIENT_EMAIL=<service-account@noorapp-d5d7d.iam.gserviceaccount.com>
FIREBASE_PRIVATE_KEY=<private key>
```

### Verify

```http
GET https://noor-app-backend-one.vercel.app/api/v1/health
```

Expect:

```json
"fcm": { "configured": true }
```

`configured: true` only proves credentials parse — **also confirm** the service account’s `project_id` is `noorapp-d5d7d` in the Vercel dashboard (do not paste private keys into docs or chat).

If credentials were previously from `noor-app-mahmoud` or another project ID, **replace them** with `noorapp-d5d7d` and redeploy.

---

## Android notification channel

Backend keeps (see `src/lib/fcm.ts`):

```text
android.notification.channelId = "azan"
```

Flutter creates / reuses channel id **`azan`** for local Azan and FCM foreground display.

---

## Flutter ↔ Backend FCM contract

| Action | Endpoint | Notes |
|--------|----------|--------|
| Register token | `POST /api/v1/devices/fcm-token` | Body: `token` / `fcmToken`, optional `platform`, `locale`, `appVersion` |
| Unregister | `DELETE /api/v1/devices/fcm-token` | On logout |
| Test push | `POST /api/v1/devices/test-push` | After client re-registers under `noorapp-d5d7d` |
| Prayer backup | cron / prayer reminders | Data `type: "AZAN"` — **backup only**; local Azan is primary |

### Notification `data.type` values the app handles

- `TEST` — test / QA (`POST /devices/test-push`)
- `AZAN` — prayer backup (honors `fcmPrayerBackupEnabled`)
- `SALAWAT` — Pray for the Prophet ﷺ (honors `salawatReminderEnabled`; every 3h, max 5/day, quiet 22:00–08:00 local)

Suggested / actual Backend data shapes:

**TEST** (from `test-push`):

```json
{
  "type": "TEST",
  "titleAr": "نور",
  "bodyAr": "إشعار تجريبي"
}
```

(Notification title/body are also set on the FCM `notification` block.)

**AZAN** (from prayer-reminder cron — already implemented):

```json
{
  "type": "AZAN",
  "prayer": "Maghrib",
  "time": "18:05",
  "kind": "prayer_time",
  "titleAr": "...",
  "bodyAr": "..."
}
```

(`prayer` / `kind` / `time` come from `src/services/prayer-reminder.service.ts`.)

**SALAWAT** (same cron job — `runSalawatReminders`):

```json
{
  "type": "SALAWAT",
  "kind": "salawat_reminder",
  "titleAr": "الصلاة على النبي ﷺ",
  "bodyAr": "اللهم صل وسلم على نبينا محمد ﷺ"
}
```

Preference sync: `GET/PATCH /profile/salawat-preferences` with `{ "enabled": true|false }`.

---

## Checklist for backend

- [ ] Vercel Firebase env is for **`noorapp-d5d7d`** (not `noor-app-mahmoud`)
- [ ] `GET /health` → `fcm.configured: true`
- [ ] Firebase Console Android app package is **`com.noor.app`** (not `com.example.noor`)
- [ ] Firebase Console iOS bundle is **`com.noor.app`**
- [ ] Push channel id remains **`azan`**
- [ ] `POST /devices/test-push` delivers after Flutter re-registers a token from `noorapp-d5d7d`
- [ ] Prayer reminder cron uses same Firebase credentials
- [ ] Confirm no leftover env pointing at `noor-app-mahmoud` or other IDs

---

## Related docs

- Flutter client setup (Backend copy): [`FIREBASE_FLUTTER_SETUP.md`](./FIREBASE_FLUTTER_SETUP.md)
- API contract: [`BACKEND_DATA_CONTRACT.md`](./BACKEND_DATA_CONTRACT.md)
- Flutter status: [`FLUTTER_TO_BACKEND_STATUS_REPLY.md`](./FLUTTER_TO_BACKEND_STATUS_REPLY.md)
