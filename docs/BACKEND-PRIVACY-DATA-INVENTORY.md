# Noor Backend — Privacy & Data Inventory (Google Play 2026)

> **Scope:** Backend codebase only (`prisma/schema.prisma`, services, controllers, routes, middleware, config, integrations).  
> **Rule:** Only facts confirmed from backend code. Unverified items marked **Flutter/Product confirmation required.**  
> **Code changes:** None (this document only).  
> **Audit date:** 2026-09-26  
> **Production API:** `https://noorapp-backend-production.up.railway.app/api/v1`  
> **Account deletion API:** `DELETE /auth/me` (Bearer) → immediate hard-delete.

### Product note on location (read carefully)

Product instruction for Play disclosure: **Noor does not collect user location.**

Separately, this backend **does contain** optional PostgreSQL fields and APIs that *can* store coordinates / city / country if a client sends them (`User.latitude`, `User.longitude`, `User.city`, `User.country`, `azanPreferences.lastLat/lastLng`, `PATCH /profile/location`, Azan prefs PATCH). Prayer times also use an in-process `adhan` library with a **default Cairo** fallback when no coordinates are stored.

Those fields are listed in **§1** as *backend-capable storage* so the inventory is honest. They are **not** asserted as “collected in production” here.  
**Play Data Safety / Privacy Policy may claim “Location not collected” only if Flutter confirms the app never requests device location and never sends lat/lng/city/country to these APIs.** That confirmation is **Flutter/Product confirmation required.**

---

## How to read each field row

| Column | Meaning |
|--------|---------|
| Collected from user? | Backend accepts it on an authenticated/public write path (body/query), or derives it from user action |
| Stored in PostgreSQL? | Present on a Prisma model mapped to Neon/Postgres |
| Required / optional | Schema nullability + API validation |
| Sensitive / personal? | Identity, credentials, contact, device identifiers, worship activity profiles, etc. |
| Shared with third party? | Confirmed outbound call that includes or uses that data |
| Retention / deletion | What `DELETE /auth/me` / cascades do; any survivor rows |
| Hashed / encrypted? | Application-level hashing (bcrypt/SHA-256). DB/disk encryption at rest = **Flutter/Product confirmation required** (hosting/Neon settings not visible in app code) |
| User deletion path | How the user removes it |

---

# 1. Backend Data Inventory

## 1.1 Account & identity (`users`)

| Category | Model/table | Field | Collected from user? | Stored in PG? | Why backend uses it | Required / optional | Sensitive / personal? | Shared with 3rd party? | Retention / deletion | Hashed / encrypted? | How user deletes |
|----------|-------------|-------|----------------------|---------------|---------------------|---------------------|------------------------|------------------------|----------------------|---------------------|------------------|
| Name | `User` / `users` | `fullName` | Yes (sign-up / Google name / `PATCH /profile`) | Yes | Display name (Home greeting, auth contract) | Optional (nullable) | Yes (personal) | No (not sent outbound as profile sync). Email provider only sees email on reset, not fullName | Deleted with user row | No | `DELETE /auth/me` or clear via profile update (null) |
| Username | `User` | `username` | Yes (sign-up) or derived from email/Google name | Yes | Unique handle / fallback display | Required | Yes | No | Deleted with user | No | `DELETE /auth/me` |
| Email | `User` | `email` | Yes (sign-up / login / Google) | Yes | Auth, password reset, uniqueness | Required | Yes | **Yes — email only** to Resend or SMTP (e.g. Brevo) on password-reset mail | User row deleted; **copy may remain** in `deleted_identities.email` | No | `DELETE /auth/me` (block row kept — see §3) |
| Password (plaintext) | — | — | Yes on sign-up / change / reset body | **No** | Only processed in memory for hashing | Required for LOCAL auth | Yes | No | Never persisted plaintext | N/A (not stored) | N/A |
| Password hash | `User` | `password` | Derived from password | Yes | Verify LOCAL login / change password | Optional (null for Google-only) | Yes (credential) | No | Deleted with user | **bcrypt** (`BCRYPT_SALT_ROUNDS`, default 12) | `DELETE /auth/me` |
| User ID | `User` | `id` | Generated (UUID) | Yes | Primary key; JWT `userId`; FKs | Required | Yes (identifier) | Appears in FCM `data` payloads as string fields when reminders fire (**Flutter/Product confirmation required** for exact payload keys in production traffic). Logged in Winston as `userId` | Deleted with user | No | `DELETE /auth/me` |
| Role | `User` | `role` | Set by backend (`USER` default); not a public self-elevate path found | Yes | Authorization contract field on auth user | Required (default `USER`) | Low (internal) | No | Deleted with user | No | `DELETE /auth/me` |
| Auth provider | `User` | `provider` | Set on LOCAL sign-up or Google | Yes | Distinguish LOCAL vs GOOGLE | Required (default LOCAL) | Low | No | Deleted with user | No | `DELETE /auth/me` |
| Google subject | `User` | `googleId` | From Google ID token `sub` | Yes | Link Google account; block after delete | Optional / unique | Yes | Verified via **Google** `tokeninfo` at login (token sent to Google); stored `sub` not re-shared later | Deleted with user; **may remain** in `deleted_identities.googleId` | No | `DELETE /auth/me` |
| Provider ID | `User` | `providerId` | Often same as Google `sub` | Yes | Legacy / provider link | Optional | Yes | Same as Google verify path | Deleted with user | No | `DELETE /auth/me` |
| Account active flag | `User` | `isActive` | Backend-managed | Yes | Gate auth | Required (default true) | Low | No | Deleted with user | No | `DELETE /auth/me` |
| Timestamps | `User` | `createdAt`, `updatedAt` | System | Yes | Audit / profile “joined” | Required | Low | No | Deleted with user | No | `DELETE /auth/me` |
| Phone | `User` | `phone` | Yes if Flutter sends `PATCH /profile` | Yes | Profile field | Optional | Yes | No outbound use found in services beyond storage/return | Deleted with user | No | Profile clear or `DELETE /auth/me` |
| Avatar URL | `User` | `avatarUrl` | Yes if Flutter sends URL string on profile | Yes | Profile photo URL | Optional | Yes | **No file upload pipeline found** in backend runtime; URL string only. If URL points to third-party CDN, hosting is outside Noor DB — **Flutter/Product confirmation required** | Deleted with user | No | Profile clear or `DELETE /auth/me` |
| Points / level | `User` | `points`, `level` | Derived from worship/challenge activity | Yes | Journey gamification | Required (defaults) | Personal activity | No | Deleted with user | No | `DELETE /auth/me` |
| Timezone (IANA) | `User` | `timezone` | Yes (`PATCH /profile` / location update / defaults) | Yes | Local calendar day, reminders, prayer scheduling | Required (default `Africa/Cairo`) | Personal (approx. region) | Not sent as a dedicated third-party profile sync; used server-side | Deleted with user | No | `DELETE /auth/me` |
| Prayer calculation method | `User` | `prayerCalculationMethod` | Yes (profile / defaults) | Yes | Choose `adhan` calculation method | Required (default Egyptian authority) | Low preference | No (computed locally via `adhan` package) | Deleted with user | No | `DELETE /auth/me` |
| Quran reading prefs | `User` | `quranFontSize`, `quranReciter`, `quranTafsir`, `quranTranslation`, `quranAutoScrollEnabled` | Yes | Yes | Reader UX sync | Required defaults | Low preference | Tafsir/audio may be **fetched** from Quran Foundation / api.quran.com using content IDs — **not** sending these preference strings as PII was not confirmed; content requests are for catalog text/audio | Deleted with user | No | `DELETE /auth/me` |
| Sadaqah goal | `User` | `sadaqahGoal` | Yes / default | Yes | Personal charity target (not payment) | Required (default 1000) | Personal financial *goal* (not card data) | No payment processor found | Deleted with user | No | `DELETE /auth/me` |
| Reminder prefs | `User` | `salawatReminderEnabled`, `salawatIntervalMinutes`, `salawatWindowStart/End`, `salawatAudioClipId`, `mulkReminderEnabled/Time`, `duha*`, `qiyam*`, `khatmahReminderEnabled/Time` | Yes (prefs APIs) | Yes | Opt-in FCM scheduling | Defaults off / times defaulted | Personal prefs | Used to decide **Firebase FCM** sends | Deleted with user | No | Prefs PATCH or `DELETE /auth/me` |
| Azan preferences JSON | `User` | `azanPreferences` | Yes (Azan settings PATCH) | Yes | Cross-device azan / near-prayer settings; may include `lastLat`/`lastLng` if client sends | Optional JSON | May include approximate location if client sends | Used for FCM azan logic; coords not sent to AlAdhan CDN for calculation (prayer math is local `adhan`) | Deleted with user | No | Prefs clear / `DELETE /auth/me` |
| Coordinates / city / country | `User` | `latitude`, `longitude`, `city`, `country` | **Only if client calls** `PATCH /profile/location` or Azan prefs that write lat/lng/city | Yes (nullable) | Prayer times / Qibla / labels when set; otherwise Cairo default path | Optional | Yes (location-related) | Not required for third-party prayer API (local `adhan`). See Product note above | Deleted with user | No | `DELETE /auth/me` / stop sending updates |

**Google `picture` URL:** Received during Google token verify; **not written** to `avatarUrl` on create/update in `auth.service.ts` (confirmed).

---

## 1.2 Authentication sessions & reset

| Category | Model/table | Field | Collected from user? | Stored in PG? | Why | Required / optional | Sensitive? | Shared 3rd party? | Retention / deletion | Hashed / encrypted? | User deletion |
|----------|-------------|-------|----------------------|---------------|-----|---------------------|------------|-------------------|----------------------|---------------------|---------------|
| Refresh token (raw JWT) | — | body `refreshToken` | Yes | **No** (raw) | Session refresh / logout | Required for those routes | Yes | No | Client-held; server stores hash only | N/A | Logout revokes hash; account delete removes rows |
| Refresh token hash | `RefreshToken` / `refresh_tokens` | `tokenHash`, `userId`, `expiresAt`, `revokedAt`, `createdAt` | Derived | Yes | Validate refresh; revoke | Required per session | Yes | No | Deleted on logout (revoke), expiry unused until cleanup, or **cascade / explicit delete on account delete** | **SHA-256** of JWT | `DELETE /auth/me`, `POST /auth/logout` |
| Access token (JWT) | — | `Authorization: Bearer` | Issued to client | **Not stored** in PG | Authenticate API calls | Short-lived (`JWT_EXPIRES_IN`, default `1h`) | Yes | No | Until expiry; invalid after user delete | Signed JWT (not hashed at rest on server) | Delete account / wait expiry |
| Password reset raw token | — | email + reset body | Generated; emailed | **No** (raw) | Reset link/token | Ephemeral | Yes | **Yes — raw token in email** via Resend/SMTP | ~1 hour (email copy subject to provider retention — **Flutter/Product confirmation required** for provider retention) | N/A | Use once / expiry / account delete |
| Password reset hash | `PasswordResetToken` | `tokenHash`, `expiresAt`, `usedAt` | Derived | Yes | Validate reset | Per request | Yes | No | Explicit delete on account delete; marked used on success | **SHA-256** | `DELETE /auth/me` |
| Deleted identity block | `DeletedIdentity` / `deleted_identities` | `email`, `googleId`, `deletedAt` | Copied at delete time | Yes | Prevent login/Google restore after Play deletion; cleared only on **new** explicit `POST /auth/sign-up` with same email | Survives account delete | Yes (email / Google id) | No | **Retained after account deletion** until new sign-up clears email block | No | New sign-up clears; no end-user API to purge block alone |

JWT payload claims confirmed: `userId`, `email` (access & refresh generators in `src/lib/auth.ts`).

---

## 1.3 Devices & push (`device_tokens`)

| Category | Model/table | Field | Collected from user? | Stored in PG? | Why | Required / optional | Sensitive? | Shared 3rd party? | Retention / deletion | Hashed / encrypted? | User deletion |
|----------|-------------|-------|----------------------|---------------|-----|---------------------|------------|-------------------|----------------------|---------------------|---------------|
| FCM device token | `DeviceToken` | `token` | Yes (`POST` device/FCM register) | Yes | Push delivery | Required for row | Yes (device identifier) | **Yes — sent to Firebase Cloud Messaging** to deliver notifications | Cascade delete on user delete; unregister endpoint | Stored **plaintext** in DB | Unregister device or `DELETE /auth/me` |
| Platform | `DeviceToken` | `platform` | Yes (ios/android/web/unknown) | Yes | Routing / diagnostics | Default `unknown` | Low | May travel with FCM platform targeting | Cascade | No | Same |
| App version | `DeviceToken` | `appVersion` | Yes if sent | Yes | Diagnostics | Optional | Low | No (except logs) | Cascade | No | Same |
| Locale | `DeviceToken` | `locale` | Yes if sent | Yes | Localization diagnostics | Optional | Low | No | Cascade | No | Same |
| lastSeenAt / timestamps | `DeviceToken` | `lastSeenAt`, `createdAt`, `updatedAt` | System | Yes | Freshness | Required defaults | Low | No | Cascade | No | Same |

Registration logs may include `userId`, `userEmail`, `tokenFingerprint` (first 8 chars) via Winston → host logs (Railway). **Host log retention: Flutter/Product confirmation required.**

---

## 1.4 Worship / habits / journey progress

| Category | Model/table | Fields (summary) | Collected from user? | Stored in PG? | Why | Required / optional | Sensitive? | Shared 3rd party? | Retention / deletion | Hashed / encrypted? | User deletion |
|----------|-------------|------------------|----------------------|---------------|-----|---------------------|------------|-------------------|----------------------|---------------------|---------------|
| Daily progress | `DailyProgress` | `date`, `quranPagesRead`, adhkar flags, `sadaqahAmount`, `sadaqahBreakdown` | Yes (journey/adhkar/sadaqah APIs) | Yes | Home / Journey | Per day row | Yes (religious practice) | No | `onDelete: Cascade` | No | `DELETE /auth/me` |
| Prayer completions | `PrayerCompletion` | `date`, `prayer`, `completedAt` | Yes | Yes | Prayer checklist / streaks | Per prayer/day | Yes | No | Cascade | No | `DELETE /auth/me` |
| Nawafel completions | `NawafelCompletion` | `date`, `key`, `completedAt` | Yes | Yes | Rawatib checklist | Per slot/day | Yes | No | Cascade | No | `DELETE /auth/me` |
| Challenge completions | `ChallengeCompletion` | `dayOfYear`, `completedAt`, `claimedAt` | Yes | Yes | Daily challenge + points | Per dayOfYear | Yes | No | Cascade | No | `DELETE /auth/me` |
| Challenge templates | `DailyChallengeTemplate` | titles, targets, rewards | **Seed/content** (not user PII) | Yes | Catalog | N/A | No | No | Not user-owned | No | N/A |
| Stance answers | `StanceAnswer` | `situationId`, `selectedOptionKey`, `isCorrect`, `pointsAwarded` | Yes | Yes | “موقفك إيه؟” | Per situation | Yes (religious quiz) | No | Cascade | No | `DELETE /auth/me` |
| Stance catalog | `StanceSituation` | texts, rulings, sources | Seed/content | Yes | Feature content | N/A | No | No | Not user-owned | No | N/A |
| Tasbih logs | `TasbihLog` | `date`, `dhikr`, `count`, `totalAllTime` | Yes | Yes | Digital tasbih | Per day | Yes | No | Cascade | No | `DELETE /auth/me` |
| Tasbih reset history | `TasbihResetHistory` | `countBeforeReset`, `date` | Derived | Yes | History | Optional rows | Yes | No | Cascade | No | `DELETE /auth/me` |
| Custom tasbih phrases | `UserTasbih` | `text`, `count`, `sortOrder` | Yes | Yes | Personal dhikr list | Optional | Yes | No | Cascade | No | `DELETE /auth/me` |
| Daily dhikr completions | `DailyDhikrCompletion` | category/item, `countDone`, `date` | Yes | Yes | Adhkar progress | Per day/item | Yes | No | Cascade | No | `DELETE /auth/me` |
| Adhkar favorites | `AdhkarFavorite` | `itemId` | Yes | Yes | Favorites | Optional | Low personal | No | Cascade | No | `DELETE /auth/me` |
| Adhkar resume marks | `AdhkarResumeMark` | `categoryKey`, `markedItemId` | Yes | Yes | Resume reading | Optional | Low | No | Cascade | No | `DELETE /auth/me` |
| In-app notifications | `Notification` | titles/bodies, `type`, `payload`, `readAt` | System / features | Yes | In-app inbox | Optional | May be personal | No | Cascade | No | `DELETE /auth/me` |

FCM **idempotency logs** (not analytics products): `SalawatSendLog`, `MulkSendLog`, `DuhaSendLog`, `QiyamSendLog`, `KhatmahSendLog`, `AzanReminderSendLog` — store `userId` + `occurrenceKey` + `createdAt`. Cascade on user delete. Shared with Firebase only insofar as the push itself was sent.

---

## 1.5 Quran user data

| Category | Model/table | Fields | Collected from user? | Stored in PG? | Why | Required / optional | Sensitive? | Shared 3rd party? | Retention / deletion | Hashed / encrypted? | User deletion |
|----------|-------------|--------|----------------------|---------------|-----|---------------------|------------|-------------------|----------------------|---------------------|---------------|
| Bookmarks | `QuranBookmark` | `surahId`, `ayahNumber`, `page`, `note` | Yes | Yes | Bookmarks | Optional | Yes (esp. `note`) | No | Cascade | No | Delete bookmark APIs / `DELETE /auth/me` |
| Last read | `QuranLastRead` | `surahId`, `ayahNumber`, `page` | Yes | Yes | Continue reading | One row/user | Yes | No | Cascade | No | `DELETE /auth/me` |
| Reading history | `QuranReadingHistory` | `surahId`, `ayahFrom`, `ayahTo`, `readAt` | Yes | Yes | History | Optional rows | Yes | No | Cascade | No | `DELETE /auth/me` |
| Ayah history sessions | `UserAyahHistory` | `sessionId`, `surahId`, `ayahNumber`, `displayDate` | Yes | Yes | Session-linked ayah tracking | Optional | Yes | No | Cascade | No | `DELETE /auth/me` |
| Sajdah completions | `QuranSajdahCompletion` | `surahId`, `ayahNumber`, `completed`, `sessionId` | Yes | Yes | آيات السجود checklist | Optional | Yes | No | Cascade | No | `DELETE /auth/me` |
| Khatmah progress | `Khatmah` | current surah/page, totals, plan fields, ward | Yes | Yes | ختمة tracking + reminders | One row/user | Yes | Reminder pushes via FCM | Cascade | No | `DELETE /auth/me` |
| Quran catalog | `Surah`, `Ayah`, `VerseOfTheDay`, `HadithOfTheDay` | texts | Seed/content | Yes | App content | N/A | No (religious content, not user PII) | May be sourced/synced from Quran Foundation / api.quran.com for some tafsir/audio | Retained (global) | No | N/A |

---

## 1.6 IP addresses, User-Agent, request diagnostics

| Category | Where | Stored in PG? | Collected? | Why | Sensitive? | Shared 3rd party? | Retention | Hashed / encrypted? | User deletion |
|----------|-------|---------------|------------|-----|------------|-------------------|-----------|---------------------|---------------|
| Client IP | Express `req.ip` (trust proxy) | **No PG model found** | Used in-memory for **rate-limit key** when no Bearer token (`express-rate-limit`) | Abuse protection | Yes | No intentional third-party analytics SDK found | Process memory / window only for limiter | Rate-limit auth key hashes Bearer with SHA-256 prefix; IP used raw as key when anonymous | Not in DB; **host access logs may retain** — see below |
| User-Agent | Morgan `combined` format in production | **No PG model** | Logged to Winston console stream | HTTP access logging | Yes | Logs go to hosting stdout (e.g. Railway). **No separate analytics vendor in code** | Host log retention: **Flutter/Product confirmation required** | No | Cannot delete historical host logs via `DELETE /auth/me` |
| Request ID | Header `X-Request-ID` or UUID | Not a user table | Correlates responses / diagnostics | Debugging | Low | Returned to client; may appear in logs | Ephemeral + logs | No | N/A |
| API diagnostics logs | `requestDiagnosticsMiddleware`, `logApiError` | No | Method/path/status/duration/blame; may include user context on some paths | Ops | May include identifiers | Host logs only | Host retention unknown | No | Account delete does **not** purge host logs |

**Confirmed:** No Sentry / Crashlytics / Mixpanel / Amplitude / OpenAI / Stripe packages or service calls in `src/`.

---

## 1.7 Logs, analytics, crash, AI, payments, uploads

| Category | Backend finding |
|----------|-----------------|
| Application logs | Winston → Console (JSON in production). Includes HTTP (Morgan combined), auth events, FCM/email diagnostics, cron warnings. May contain `userId`, email (e.g. device register, Google login, account delete). |
| Product analytics DB | **Not found** |
| Crash reporting service | **Not found** in backend |
| AI / LLM user data | **Not found** |
| Payment / subscription / IAP | **Not found** (sadaqah is personal tracking amounts only; route docs state no payment gateway) |
| Uploaded binary files | `STORAGE_PROVIDER` env supports `local`/`s3`/`cloudinary`, but **no multer/upload controller wiring confirmed** that stores user files. `avatarUrl` is a **string URL**, not an upload. Static `assets/` (azan/salawat media) are app content, not user uploads. |

---

## 1.8 Permanence classification (backend)

### Stored “permanently” (until user delete or explicit clear)

All user-owned Prisma rows listed above under the `User` relation graph (progress, tokens, prefs, etc.), for as long as the account exists.

### Stored temporarily / expiring

| Data | Behavior |
|------|----------|
| Access JWT | Expires per `JWT_EXPIRES_IN` (default 1h); not in DB |
| Refresh JWT | Expires per `JWT_REFRESH_EXPIRES_IN` (default 90d); hash in DB until revoke/delete |
| Password reset token | ~1 hour; hash in DB; raw in email |
| Rate-limit counters | In-process memory windows |
| Quran Foundation OAuth client-credentials token | In-memory cache in `quran-foundation.ts` (server credentials, **not** end-user tokens) |
| Host stdout logs | Temporary relative to app process; durable if Railway retains logs — **Flutter/Product confirmation required** |

### Sent to third parties (confirmed from code)

| Third party | User-related data that may be sent | Purpose |
|-------------|------------------------------------|---------|
| **Google** (`oauth2/v3/tokeninfo`) | Google ID token (contains email/sub/name/picture claims) | Verify Sign-In |
| **Firebase Cloud Messaging** | Device FCM tokens + notification title/body/`data` map | Push reminders (azan, salawat, mulk, duha, qiyam, khatmah, etc.) |
| **Resend API** and/or **SMTP** (e.g. Brevo) | User email + password-reset token content | Password reset email |
| **Quran Foundation** / **api.quran.com** / **audio.qurancdn.com** | **No end-user PII confirmed** in client-credentials content fetches; requests are for Quran content | Tafsir/audio/content |
| **Neon / PostgreSQL host** | All PG data | Primary datastore |
| **Railway** (or host) | HTTP logs, env, process output | Hosting |

### Deleted when account is deleted (`DELETE /auth/me`)

Confirmed path: `hardDeleteUserAccount` → explicit delete of refresh tokens, device tokens, password-reset tokens → `user.delete` → Prisma **`onDelete: Cascade`** for related user-owned models listed in schema (journey, prayer, nawafel, challenges, stance answers, tasbih, adhkar user rows, quran user rows, khatmah, notifications, FCM send logs, etc.).

### NOT deleted when account is deleted

| Data | Why |
|------|-----|
| `deleted_identities` row (`email`, optional `googleId`, `deletedAt`) | Block re-login / Google restore until explicit new sign-up |
| Global content tables (surahs, ayahs, adhkar catalog, challenge templates, stance situations, verse/hadith of day) | Not user-owned |
| Historical **host / email-provider / FCM** logs outside Postgres | Outside DB cascade; retention not defined in app code |
| Email already delivered to user’s inbox | On user’s mail provider |

---

# 2. Third-Party Services

| Service | Config evidence | User data involvement | Notes |
|---------|-----------------|----------------------|-------|
| Neon PostgreSQL | `DATABASE_URL` | All persisted app data | Primary DB |
| Railway (deployment) | Production URL / ops docs | Runtime + logs | Host |
| Google Sign-In verify | `fetch` tokeninfo; env `GOOGLE_CLIENT_ID` optional strict `aud` | ID token verification | Stores `email`, `sub`, `name` locally after verify |
| Firebase Admin / FCM | `FIREBASE_*` / `FIREBASE_SERVICE_ACCOUNT_JSON` | Device tokens + notification payloads | Optional until configured |
| Resend | `RESEND_API_KEY`, `EMAIL_PROVIDER` | Password-reset emails | |
| SMTP (Brevo-compatible vars in `.env.example`) | `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | Password-reset emails | |
| Quran Foundation OAuth + Content API | `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, `QF_ENV` | Server credentials; content fetch | Fallback `api.quran.com` |
| `adhan` npm library | `package.json` | Local prayer calculation | **Not** a network third party |
| Redis | `REDIS_URL`, `CACHE_PROVIDER` | Config present; cache client **not fully wired** for storing user PII in current redis helper | Treat as unused for PII until wired — **Flutter/Product confirmation required** if enabled in prod |
| S3 / Cloudinary storage enums | `STORAGE_PROVIDER` | Enum only; no confirmed user upload pipeline | |

**Not found:** Stripe, PayPal, OpenAI, Sentry, analytics SDKs, advertising SDKs.

---

# 3. Account Deletion & Data Deletion

| Item | Confirmed behavior |
|------|--------------------|
| Endpoint | `DELETE /auth/me` (Bearer access token) |
| Body | None; no password re-confirm in controller |
| Model | **Immediate hard-delete** (no grace period in code) |
| Cascades | User-owned relational data via Prisma `onDelete: Cascade` + explicit session/FCM/reset deletes |
| After delete | `GET /auth/me`, login, Google, refresh → **401** for that identity |
| Survivor | `deleted_identities` email (+ googleId) |
| New account | Explicit `POST /auth/sign-up` with same email creates **new empty** account and clears deletion block; old data not restored |
| Extra maintenance | Manual cron `cleanup-users-without-fcm` can hard-delete eligible accounts (same `hardDeleteUserAccount`) when invoked with secrets/confirm — ops feature, not end-user. It does **not** write `deleted_identities`, so those users can sign in again (fresh empty account) |

**User self-service for partial data:** Feature-specific PATCH/DELETE endpoints (bookmarks, unregister FCM, prefs). Full wipe = account deletion.

**Data export (GDPR portability):** Dedicated export endpoint **not found** in routes — **Flutter/Product confirmation required** if Play/policy promises export.

---

# 4. Security Measures (confirmed in backend)

| Control | Evidence |
|---------|----------|
| Password hashing | bcrypt with configurable rounds (default 12) |
| Refresh / reset token storage | SHA-256 hashes only |
| JWT access/refresh | Separate secrets; min length enforced via env schema |
| HTTPS | Assumed at reverse proxy / Railway — **Flutter/Product confirmation required** for TLS termination details |
| Helmet, CORS allow-list, HPP, compression, cookie parser | `src/middleware/http.ts` |
| Rate limiting | Global API + stricter auth / sensitive auth limiters |
| Auth required on protected routes | `authenticate` middleware pattern |
| Trust proxy | `app.set('trust proxy', 1)` for correct client IP behind proxy |
| Cron protection | `CRON_SECRET` / `X-Cron-Secret` header pattern |
| No plaintext password column usage | Column stores bcrypt hash |
| Swagger | Can be enabled via `SWAGGER_ENABLED` — ensure disabled or locked in production (**ops confirmation required**) |

**Not confirmed in code:** field-level encryption, DB TDE, key rotation runbooks, WAF rules.

---

# 5. Data That Flutter Must Confirm

1. Whether the **shipping app** ever calls `PATCH /profile/location` or sends `latitude`/`longitude`/`city`/`country`/`lastLat`/`lastLng` (Product says location is not collected).  
2. Whether **phone** / **avatarUrl** are collected in UI and sent to `PATCH /profile`.  
3. Exact **FCM data payload** keys visible to Google/Firebase (and whether `userId`/email ever appear in notification `data`).  
4. Client-side storage: SharedPreferences/secure storage contents, local prayer caches, analytics (Firebase Analytics, Crashlytics, etc.) — **out of backend scope**.  
5. Whether Google Sign-In requests scopes beyond email/profile needed.  
6. Host log retention (Railway), email provider retention (Brevo/Resend), Firebase retention.  
7. Whether production has `SWAGGER_ENABLED=false`.  
8. Whether Redis/`CACHE_PROVIDER=redis` is enabled in production.  
9. Privacy Policy URL, delete-account UX path in-app, and support email for deletion requests if token lost.  
10. Whether any **web** client uses cookies beyond API Bearer flow.  
11. Age gate / children policy (backend has no age field).  
12. Data export / DSAR process if promised.

---

# 6. Information Needed for Privacy Policy

Use this as a drafting checklist (legal review still required):

**You (backend / product owner) can state from this audit:**

- What account data is stored in Postgres (email, name, password hash, Google id, prefs, worship progress, Quran history, FCM tokens, etc.).  
- Password hashing (bcrypt) and hashed refresh/reset tokens.  
- Account deletion via in-app `DELETE /auth/me` and what remains (`deleted_identities`).  
- Third parties: Google (Sign-In verify), Firebase (push), email provider (password reset), Quran content APIs (content, not user profiles), database/hosting providers.  
- No in-backend payments, AI chat of user content, or crash analytics SDK found.  
- Sadaqah amounts are user-tracked goals/progress, not card payments.

**Must align with Flutter before publishing:**

- Location collection claim (see Product note).  
- Whether phone/avatar are collected.  
- Notifications: opt-in nature of reminder prefs (defaults off for several FCM features in schema).  
- Children’s / under-13 policy.  
- Contact for privacy requests.  
- Cross-border processing (Neon/Railway/Firebase regions) — **Flutter/Product confirmation required**.  
- Retention of logs outside DB.

---

# 7. Information Needed for Google Play Data Safety

Map **only after Flutter confirms collection**. Backend-capable categories:

| Play Data Safety category | Backend-related data | Collected? (app must confirm) | Shared? | Purpose examples |
|---------------------------|----------------------|-------------------------------|---------|------------------|
| Personal info — Name | `fullName`, `username` | If sign-up / Google / profile | No (except display in-app) | Account |
| Personal info — Email | `email` | Yes for account | Yes (email provider on reset; Google on Sign-In) | Account |
| Personal info — User IDs | `id`, `googleId` | Yes | Google verify; possibly FCM data | Account |
| Personal info — Phone | `phone` | Only if Flutter sends | No found | Account |
| Photos | `avatarUrl` string | Only if Flutter sends URL | Depends on URL host | Account |
| App activity — in-app actions | Prayer/quran/adhkar/tasbih/challenges/stance | If features used | No (except push triggers) | App functionality |
| App info and performance — crash logs | Backend Winston/Morgan only | Server-side | Host | (Declare separately if Flutter uses Crashlytics) |
| Device or other IDs | FCM tokens, platform | If push registered | **Firebase** | Push notifications |
| Location | lat/lng/city/country fields exist | **Product: not collected** — confirm Flutter | N/A if never sent | Prayer/Qibla if ever enabled |
| Financial info | No cards; optional sadaqah amounts | If user enters amounts | No processor | App functionality |
| Auth credentials | Password (hashed), tokens | Yes for LOCAL | No password share | Account |

**Data deletion:** Declare account deletion in-app (`DELETE /auth/me`) + surviving email/Google id block.  
**Encryption in transit:** HTTPS — confirm production.  
**Encryption at rest:** Neon/Firebase defaults — **Flutter/Product confirmation required**.

---

# Who does what for a correct 2026 Privacy Policy (Backend vs Flutter)

## Backend / you (this repo + Play Console text owner)

1. Keep this inventory as the **source of truth** for server-stored data.  
2. Publish Privacy Policy that matches **actual** collection (after Flutter confirms location/phone/avatar).  
3. Ensure production env: strong JWT secrets, mail provider, Firebase, `SWAGGER_ENABLED` locked down.  
4. Document in policy: account deletion URL/path, what is deleted, what remains in `deleted_identities`, password-reset email sharing.  
5. Do **not** claim “we never store X” if Prisma has the column and Flutter might send it — either remove/stop API use or disclose.  
6. Fill Play Console **Data safety** form using §7 + Flutter answers.  
7. Provide support email for deletion if the user cannot log in.

## Flutter developer

1. Confirm every runtime permission and every API body field actually sent (especially location, phone, avatar, FCM register).  
2. Wire Play-required **Delete account** UI to `DELETE /auth/me` and verify 200 + post-delete 401s.  
3. List **client-only** data (local DB, analytics, Crashlytics, AdMob, etc.) for the same Privacy Policy — backend cannot see those.  
4. Ensure notification prefs UX matches opt-in defaults.  
5. If Product forbids location: **never** call location APIs; use Cairo/default prayer path only; do not request location permission.  
6. Provide Privacy Policy URL + Data safety answers for SDKs Flutter embeds.  
7. Test Google Sign-In data shared with Google vs stored in Noor.

## Do it correctly together (checklist)

- [ ] One Privacy Policy URL used in Play Console and in-app.  
- [ ] Data Safety form ↔ Privacy Policy ↔ real Flutter network traffic (Charles/mitmproxy sample).  
- [ ] Account deletion works on production for email and Google accounts.  
- [ ] Location row: either **Not collected** (Flutter proof) or disclosed accurately.  
- [ ] Third parties named: Google, Firebase, email provider, hosting/DB, Quran content CDN/API.  
- [ ] No claims of “no servers store worship data” — backend **does** store journey/quran/prayer progress.  
- [ ] Legal pass on Arabic + English policy text (this file is technical inventory, not legal advice).

---

*End of backend-only audit. No application code or configuration was modified to produce this document.*
