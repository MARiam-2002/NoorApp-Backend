# Noor App — Flutter Integration Guide — 2026-07-31

## 🔹 API Integration Changes Summary — 2026-07-31

- **New**: `POST /auth/logout` — documented for the first time. Revokes the refresh token on the server so the pair cannot be rotated again. Flutter must additionally call `GoogleSignIn.signOut()` on the device when `user.provider === "GOOGLE"`.
- **New**: `GET /auth/me` — documented for the first time. Verifies the current Bearer access token and returns the full `AuthUserProfile`. Used at app launch to confirm session validity and refresh the locally cached profile state.
- **Updated**: Generic response envelope. Success (`2xx`) responses now formally use `{ success, message, data, meta, timestamp, requestId }`; error (`4xx` / `5xx`) responses use the same envelope plus `{ code, details }`. The two shapes were previously merged into one description (showing `code` / `details` inside success samples), which broke strict Dart sealed-class deserialization.
- **Updated**: `requestId` semantics. A UUID v4 generated inside `buildSuccess` / `buildError` is now explicitly present in every single sample block (Sign-Up, Login, Google, Refresh, Logout, Me, Dashboard, all 4 Tasbih endpoints, Qibla, and every 4xx / 5xx example). Previously it was omitted everywhere.
- **Updated**: Auth success response shapes for `POST /auth/sign-up`, `POST /auth/login`, `POST /auth/google`, `POST /auth/refresh`, and `GET /auth/me`. The token pair is now nested as `data.tokens: { accessToken, refreshToken, expiresIn }` instead of flat `data.accessToken` / `data.refreshToken` keys. This corrects a deserialization-breaking mismatch versus the real server `AuthResult` contract.
- **Updated**: `expiresIn` semantics. Previously documented as a seconds integer (`900` for 15 minutes). It is now correctly shown as the raw duration string returned by `env.JWT_EXPIRES_IN` (default `"7d"`), and the guide instructs Flutter to decode the JWT `exp` claim directly or rotate on first `401`. The phantom `tokenType: "Bearer"` field, which is never emitted by the server, has been removed from all samples.
- **Updated**: `POST /auth/refresh` — response body is now correctly documented as the full `{ user, tokens }` `AuthResult`, identical in shape to Sign-Up / Login, instead of the previous incorrect flat-tokens-only description.
- **Updated**: `AuthUserProfile` samples. `providerId: string | null` is now present in every sample. For `LOCAL` users the value is `null`; for `GOOGLE` users it equals the `sub` claim (same as `googleId`), following the `googleId ?? providerId ?? null` precedence in the server's `mapUserToProfile`.
- **Updated**: `POST /auth/google` Flutter contract. The guide now explicitly documents the **Hybrid Firebase scenario**: apps that already use Firebase for Crashlytics, Analytics, FCM, Remote Config or Performance are fully supported, but the `idToken` sent to Noor's backend MUST come from `google_sign_in`'s `GoogleSignInAuthentication.idToken`. Using `FirebaseAuth.instance.signInWithGoogle()` as the _source_ of the idToken is marked as FORBIDDEN. A commented optional step for `FirebaseAuth.instance.signInWithCredential(GoogleAuthProvider.credential(idToken:..., accessToken:...))` is now included in the Dart reference.
- **Updated**: Tasbih (`/tasbih/today`, `/tasbih/increment`, `/tasbih/reset`, `/tasbih/change-dhikr`), Dashboard (`/dashboard`), and Qibla (`/qibla/calculate`) response samples. Every `2xx`, `4xx`, and `5xx` block now explicitly includes `message`, `timestamp`, and `requestId`.
- **Updated**: Integration Totals and `Route Endpoint Index` table. The index expanded from 10 rows to 12: row 5 is now `POST /auth/logout`, row 6 is `GET /auth/me`, and all subsequent rows are renumbered. Totals now correctly report 12 endpoints total (6 Authenticated, 6 Public).
- No endpoints were removed in this change set.

### Change Totals (2026-07-31 batch)

- New endpoint documentation entries: 2
- Updated documentation entries: 10
- Removed documentation entries: 0

---

## 🔹 API Integration Changes Summary — 2026-08-21 (Quran + Profile + Journey Expansion)

- **New (8 module sections added below)**:
  - **Forgot / Reset Password (Auth)** — `POST /auth/forgot-password` and `POST /auth/reset-password` (token emailed + reset form).
  - **Full Profile screen** — `GET /profile/me`, `PATCH /profile/update`, `PATCH /profile/change-password`, `PUT /profile/location`, `GET/PATCH /profile/reading-preferences` (font size / reciter / tafsir / translation settings for the Quran reader bottom sheet).
  - **Quran Browser / Reader (10 endpoints)** — Surah list with `revelationType` (MAKKI/MADANI for icons 🕋/🕌), Surah+Ayah list with pagination, **physical-page reader** (`/pages/:pageNumber` for 1..604 page-by-page Mushaf view), Juz 1–30 list + Juz Surahs, Quran search and random-ayah.
  - **Quran Bookmarks / Favorites** (4 endpoints: list with `textAr` inline preview for the bookmark tab preview cards, create, patch note, delete).
  - **Last Read / Resume pointer** (`GET /quran/last-read`, `PUT /quran/last-read`) — resumes exactly where the user stopped on the Mushaf page.
  - **Khatmah tracker** (`GET /quran/khatmah`, `PATCH /quran/khatmah/progress`, `GET /quran/khatmah/stats` ⭐, `POST /quran/khatmah/reset`). Stats endpoint drives the "استكمال الختمة" screen hero with `dailyGoal` (pages read today vs 5-page target) + `stats.streakDays` + `stats.completedKhatmahCount` + `stats.totalPagesRead`.
  - **Daily Journey tracker** (`GET /journey/today`, `GET /journey/progress`, `PATCH /journey/quran-pages`, `POST /journey/quran-pages/increment`, `PATCH /journey/adhkar`, `PATCH /journey/sadaqah`) — feeds the Home dashboard daily-progress widgets and keeps khatmah stats in sync.
  - **Challenges + Notifications + My-Qibla** secondary modules.
- **Updated (critical contracts)**:
  - `errors[]` vs `details` distinction now applied consistently to **every** Zod-validated 400 sample in the document (the old Google 400 sample incorrectly used `details` for a schema issue; corrected below).
  - Dashboard `dailyJourney` → now matches the `JourneyDailyView` struct (prayer/quran/adhkar/sadaqah). Dashboard `khatmah` → same shape as the khatmah-core response for safe `?`-navigation.
  - **Reading settings are now server-side fields on User** (`quranFontSize: 12..60 default 28`, `quranReciter`, `quranTafsir`, `quranTranslation`) with dedicated `reading-preferences` endpoints. Flutter must not cache these settings locally only; the authoritative source is the backend so resuming on a second device picks them up.
  - **Dual-page counter rule (critical for Khatmah–Journey consistency)**: When the user reads `N` new pages, Flutter MUST call **both** `POST /journey/quran-pages/increment {pages:N}` AND `PATCH /quran/khatmah/progress {pagesRead:N, currentPage, surahId}`. Omitting either leaves the Home daily card and the Khatmah stats screen out of sync.
- **No endpoints were removed** in this 2026-08-21 revision.

### Change Totals (2026-08-21 batch)

- New endpoint documentation entries: **45**
- Updated documentation entries: **3** (summary totals, Google 400 sample, Dashboard `khatmah` + `dailyJourney` notes)
- Removed documentation entries: 0

---

## 🔹 API Integration Summary

- **Base URLs (store these in `env` / flavors)**:
  - Production (Vercel): `https://noor-app-backend-one.vercel.app/api/v1`
  - Local dev: `http://localhost:3000/api/v1`
  - Swagger UI (always the source of truth): `<base>/api/v1/docs`
- **Auth pattern**: Every endpoint below is `Authorization: Bearer <accessToken>` **except** the ones explicitly marked `Public`.
- **Response envelope**: Every response uses the same wrapper so Flutter can deserialize with one generic model: `{ success, message?, data, meta?, timestamp, requestId }` for 2xx, plus `{ code, errors?, details? }` for 4xx/5xx.
- **Auth endpoints (9 total)**:
  - Sign-up / Login / Google exchange (tokens nested inside `data.tokens`).
  - Refresh / Logout / `/auth/me`.
  - **NEW** Forgot password + Reset password.
- **Main screens covered (now 20 UI states)**:
  1. Sign-Up screen.
  2. Login screen (email + Google).
  3. **NEW** Forgot Password (email input) & Reset Password (token form).
  4. Home / Dashboard (one GET, returns 8 widgets — greeting, prayers, verse, hadith, dailyJourney, khatmah, challenge, utilities).
  5. Tasbih / Digital Counter (4 endpoints, 3 visible states).
  6. Qibla / Compass (public `GET /qibla/calculate` + authenticated `GET /qibla/my-qibla` that uses saved `user.latitude/longitude`).
  7. **NEW** Full Profile screen — personal info, change password, location, **Quran Reading Preferences** bottom sheet (4 sliders/menus: AA font size, 🎧 reciter, ✍️ tafsir, 🌐 translation).
  8. **NEW** Quran main screen — 3 tabs: المفضلة (bookmarks with inline text preview), السور (list with Makkah/Madinah icons), الاجزاء (Juz 1..30).
  9. **NEW** Mushaf page reader (`GET /quran/pages/:pageNumber`) with السابق / التالي navigation that clamps to 1..604.
  10. **NEW** Juz reader: tapping a Juz lists the Surahs of that Juz, tapping a Surah jumps to page=`startPage` of the Juz.
  11. **NEW** استكمال الختمة screen — hero with current surah+page and progress bar, daily goal circular indicator (default 5 pages), 3 stat cards: streak days / completed khatmahs / total pages read, CTA "متابعة القراءة" that opens last-read page.
- **No endpoints were removed** in this revision of the integration guide.

### Integration Totals

| Area                                    | Count (2026-08-21)                                        |
| --------------------------------------- | --------------------------------------------------------- |
| Screens / UI states documented          | 20                                                        |
| Endpoints covered                       | **67**                                                    |
| Authenticated endpoints (Bearer)        | 45                                                        |
| Public (no Bearer) endpoints            | 22                                                        |
| HTTP statuses covered (success + error) | 200 / 201 / 204 / 400 / 401 / 403 / 404 / 409 / 500 / 503 |

---

## 🔹 Global Rules (read once, applies to every screen)

### 1) Bearer Token

For every authenticated endpoint send two headers:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
Content-Type: application/json
accept: application/json
```

Behaviour:

- Missing / expired token returns `401 UNAUTHORIZED`. When you see `401`, call `POST /auth/refresh` with the stored `refreshToken` and retry the original request once. If refresh also returns `401`, route the user to the Login screen.
- Tokens are **JWT**. Do **NOT** rely on `data.tokens.expiresIn` (it is a raw duration string like `"7d"` or `"15m"` passed verbatim from the server env). Instead, decode the `exp` claim from the access-token JWT payload to get the real Unix-timestamp expiry in seconds, or simply refresh on the first 401.
- Never store tokens in `SharedPreferences`. Use `flutter_secure_storage` (or equivalent encrypted keystore).

### 2) Generic Response Envelope

Every 2xx, 4xx and 5xx response shares a common outer envelope. The **success** envelope and **error** envelope differ slightly in which keys appear.

**Success envelope (2xx status codes):**

```json
{
  "success": true,
  "message": "Short Arabic label — safe to show in a SnackBar if non-null",
  "data": { "...": "..." },
  "meta": null,
  "timestamp": "2026-07-31T07:15:00.000Z",
  "requestId": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv"
}
```

**Error envelope (4xx / 5xx status codes):**

Two mutually exclusive error-detail keys may appear (never rely on both at once):

```json
{
  "success": false,
  "message": "Human-readable error description",
  "code": "VALIDATION_ERROR | CONFLICT | UNAUTHORIZED | TOKEN_EXPIRED | INVALID_TOKEN | NOT_FOUND | INTERNAL_SERVER_ERROR | DATABASE_ERROR | FORBIDDEN | SERVICE_UNAVAILABLE",
  "errors": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "code": "too_small"
    }
  ],
  "timestamp": "2026-07-31T07:15:00.000Z",
  "requestId": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv"
}
```

Alternative shape when the error is not a per-field schema issue:

```json
{
  "success": false,
  "message": "Email already exists",
  "code": "CONFLICT",
  "details": { "field": "email" },
  "timestamp": "2026-07-31T07:15:00.000Z",
  "requestId": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv"
}
```

Notes:

- `success = false` always means the HTTP status is 4xx or 5xx.
- On error, `code` is the stable error identifier (branch on it, not on `message`).
  - **`errors[]` is used for per-field validation failures** (Zod schema: bad email, password too short, etc.). Loop `errors[]`, read `.field` and `.message` to show inline red hints. Do **not** read `details` here.
  - **`details` is used for application-level / Prisma-level errors** (duplicate email, missing exam, forbidden role…). Read `details.field` (when present) to know which TextField to highlight; `details` may be `null` for generic errors like `INTERNAL_SERVER_ERROR`.
  - **401 sub-types & refresh strategy (critical):** All three below share HTTP status `401`, but the `code` field changes Flutter's behaviour. The simplest correct rule is: **always attempt refresh on 401 first; only skip refresh when `code === "INVALID_TOKEN"`**.
    | `code` | HTTP | Semantics | Flutter action |
    | --------------- | ---- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
    | `TOKEN_EXPIRED` | 401 | Access token was valid but its `exp` claim is in the past. | ✅ Call `POST /auth/refresh`, then retry the original request **once**. |
    | `UNAUTHORIZED` | 401 | Generic auth failure (wrong password / missing Bearer / deactivated user).| ✅ Attempt refresh + retry once. If refresh also 401 → navigate to Login. |
    | `INVALID_TOKEN` | 401 | Token is forged / truncated / signed with a different secret. | ❌ Do NOT attempt refresh. Clear tokens and go to Login immediately (soft-logout, keep cached UI). |
  - **500 `DATABASE_ERROR`:** Transient Neon/Prisma connection issue. Retry with 1–2s exponential backoff. Persistent failure → show "Try again later" helper.
- On pagination endpoints, `meta` contains `{ total, page, pageSize, hasMore }` and is always a JSON object (never omitted).
- `requestId` is always present (a UUID v4) and can be sent to backend support to trace the exact failing request in server logs.

### 3) Dart quick-start (generic client)

```dart
// dependencies: dio, flutter_secure_storage
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class NoorApi {
  static const String kDefaultBaseUrl = 'https://noor-app-backend-one.vercel.app/api/v1';

  final _dio = Dio(BaseOptions(
    baseUrl: const String.fromEnvironment('NOOR_BASE_URL', defaultValue: kDefaultBaseUrl),
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
    // 👇 Always send JSON. Do NOT omit — otherwise some Dio versions send x-www-form-urlencoded.
    contentType: Headers.jsonContentType,
    responseType: ResponseType.json,
  ));
  final _store = const FlutterSecureStorage();

  NoorApi() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        await _injectAuth(options);
        return handler.next(options);
      },
    ));
  }

  Future<void> _injectAuth(RequestOptions o) async {
    final t = await _store.read(key: 'accessToken');
    if (t != null) o.headers['Authorization'] = 'Bearer $t';
  }

  Future<Map<String, dynamic>> request(
    String method, String path, { Object? data, Map<String, dynamic>? query }) async {
    try {
      final resp = await _dio.request(path,
        options: Options(
          method: method,
          // 👇 Explicit JSON content type on every request (belt-and-braces).
          contentType: Headers.jsonContentType,
          headers: <String, dynamic>{'Accept': 'application/json'},
        ),
        data: data,
        queryParameters: query,
      );
      return resp.data as Map<String, dynamic>;
    } on DioException catch (e) {
      final body = e.response?.data as Map<String, dynamic>?;
      final int? status = e.response?.statusCode;
      final String? code = body?['code'] as String?;
      // 👇 IMPORTANT: refresh flow triggers on ANY 401,
      //    regardless of the specific sub-code (UNAUTHORIZED / TOKEN_EXPIRED).
      //    Only INVALID_TOKEN (forged / tampered token) skips refresh and forces
      //    a hard logout, since no amount of refreshing can fix it.
      final bool isAuthError =
          status == HttpStatus.unauthorized401 ||
          const <String>{
            'UNAUTHORIZED',
            'TOKEN_EXPIRED',
            'INVALID_TOKEN',
          }.contains(code);
      if (isAuthError) {
        if (code == 'INVALID_TOKEN') {
          // hard logout: clear tokens, navigate to Login immediately.
        } else {
          // attempt token refresh + retry the original request once here.
          // if refresh itself also returns 401 → hard logout.
        }
      }
      rethrow; // or convert to typed exceptions
    }
  }

  // ------------- Auth convenience helpers -------------

  Future<Map<String, dynamic>> signUp({
    required String fullName,
    required String email,
    required String password,
  }) => request('POST', '/auth/sign-up', data: <String, dynamic>{
    'fullName': fullName.trim(),
    'email': email.trim().toLowerCase(),
    'password': password,
  });

  Future<Map<String, dynamic>> logIn({
    required String email,
    required String password,
  }) => request('POST', '/auth/login', data: <String, dynamic>{
    'email': email.trim().toLowerCase(),
    'password': password,
  });
}
```

---

## 🔹 Auth (2 screens: Sign-Up & Login)

### 1) POST /auth/sign-up — Sign-Up Screen (3 fields only)

Description: Creates a new local account. The Sign-Up UI renders **three TextFields**:

1. Labeled `اسم المستخدم` ("Full Name" in English) → maps to body field `fullName`.
2. Labeled `البريد الإلكتروني` → maps to `email`.
3. Labeled `كلمة المرور` → maps to `password`.

**The field `username` in the API is OPTIONAL and must not appear in the form.** The server auto-generates a username handle from the email prefix if the caller omits it. Display names always read from `fullName` (or fall back to `username` if `fullName` is `null`).

Authorization: **Public** (no Bearer token).

Validation rules (enforced server-side; mirror client-side for UX):

| Field      | Required?              | Rules                                                                                                                                                                                                                                                                                                        |
| ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fullName` | No (server) / Yes (UI) | When provided: min 2 chars, max 150 chars. `null` / omitted is accepted by the server; Flutter should require it because the UI exposes the field.                                                                                                                                                           |
| `email`    | Yes                    | RFC email format (any valid `user@domain.tld`). Stored lower-cased. Client-side `.trim().toLowerCase()` before sending is recommended but not required (server already trims + lowers).                                                                                                                      |
| `password` | Yes                    | **Min 8 chars, max 128 chars. Must contain at least one letter (A-Z or a-z) AND at least one digit (0-9).** This matches `z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).+$/)` on the server. Example valid: `StrongPass123`, `MyP@ssw0rd`. Example invalid: `1234567` (no letter), `password` (no digit). |
| `username` | No                     | **Do not render.** Leave out of the body entirely. Server auto-generates a unique handle.                                                                                                                                                                                                                    |

Behaviour:

- Duplicate email returns `409 CONFLICT` with `details.field = "email"`. Show inline red hint on the email TextField.
- Server-side validation failures (bad email, password too short, password missing digit/letter, fullName too long) return **`400 VALIDATION_ERROR` with `errors[]` array** (one item per failing field, `.field`, `.message`, and `.code` set). Loop through `errors[]` and show `.message` under the matching `.field` TextField; never read a `details` object for Zod-style validation (that key is used for AppError / Prisma-level errors, _not_ per-field schema issues).
- The returned `user.username` is server-generated (example: `ahmedmohamed_8472`). Do **not** overwrite it with `fullName`.
- Google sign-up follows a different flow (see endpoint #3 below). Do **not** call this endpoint for the Google button.
- **Rate limit**: Auth public endpoints are limited to **5 requests per IP per hour** at the Vercel edge (headers `Ratelimit-Limit: 5`, `Ratelimit-Remaining`, `Ratelimit-Reset`). If `Ratelimit-Remaining` reaches `0` during onboarding, show a toast: `"Too many attempts. Try again in one hour."` instead of retrying (retries will keep hitting 429).

Request Body (matches the Sign-Up screen exactly):

```json
{
  "fullName": "Ahmed Mohamed Ali",
  "email": "AhmedMohamed@gmail.com",
  "password": "StrongPass123!"
}
```

Response Body (201 Created):

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
      "username": "ahmedmohamed_8472",
      "fullName": "Ahmed Mohamed Ali",
      "email": "ahmedmohamed@gmail.com",
      "role": "USER",
      "provider": "LOCAL",
      "providerId": null,
      "createdAt": "2026-07-31T07:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh....",
      "expiresIn": "7d"
    }
  },
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0001-aaaa-bbbb-000000000001"
}
```

Action after receiving 201:

- Persist `data.tokens.accessToken` + `data.tokens.refreshToken` in secure storage (do **not** persist the raw `password`).
- Persist `user.id` + `user.displayName = user.fullName ?? user.username` (used in the home greeting).
- Navigate immediately to the Home / Dashboard screen — no extra login step is needed.

Response Body (400 — VALIDATION_ERROR, per-field via Zod errors[]):

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
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "code": "too_small"
    },
    {
      "field": "password",
      "message": "Password must contain at least one letter and one number",
      "code": "invalid_format"
    }
  ],
  "timestamp": "2026-08-07T21:47:00.149Z",
  "requestId": "399dbf7a-f9a2-4cbf-8b41-877776efd3c1"
}
```

Flutter deserialization hint: `final List<dynamic> errs = (json['errors'] as List<dynamic>? ?? <dynamic>[]); for (final e in errs) { ... }`. Never try to read `json['details']['field']` for this status — `details` is a separate key used only for non-Zod AppError situations (see 409 below).

Response Body (409 — duplicate email, AppError with details.field):

```json
{
  "success": false,
  "message": "Email already exists",
  "code": "CONFLICT",
  "details": { "field": "email" },
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0003-aaaa-bbbb-000000000003"
}
```

Response Body (500):

```json
{
  "success": false,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error",
  "details": null,
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0004-aaaa-bbbb-000000000004"
}
```

---

### 2) POST /auth/login — Login Screen

Description: Logs in a LOCAL-provider user and returns the token pair. The Login UI renders two TextFields (`email`, `password`) plus two buttons (`تسجيل الدخول` = local login, `التسجيل عبر جوجل` = Google flow).

Authorization: **Public**.

Behaviour:

- Wrong password or unknown email → `401`. The `message` is intentionally generic ("Invalid credentials") so attackers cannot enumerate emails.
- A Google-provider user who hits this endpoint → `401` (the message does not reveal the provider; route them to the Google button if they fail twice).
- Rate limiting is applied at the edge; show a "Too many attempts, try later" toast after 3 consecutive 401s rather than retrying in a loop.

Request Body:

```json
{
  "email": "AhmedMohamed@gmail.com",
  "password": "StrongPass123!"
}
```

Response Body (200 OK): exact same envelope and `data` shape as Sign-Up (201): `{ user, tokens: { accessToken, refreshToken, expiresIn } }`. Persist `data.tokens.*` in secure storage + navigate to Dashboard. The HTTP status differs (200 vs 201) but the JSON keys are identical.

Response Body (401):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Invalid credentials",
  "details": null,
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0005-aaaa-bbbb-000000000005"
}
```

---

### 3) POST /auth/google — Google Sign-In / Sign-Up button (both screens)

Description: Exchanges the **full Google ID token JWT** obtained from the official
`google_sign_in` Flutter SDK for a Noor account + the same JWT token pair
(`accessToken` + `refreshToken`) returned by the normal email/password Sign-Up.
Works for **both** first-time users (account auto-created) and returning users.
This single endpoint serves the Google button on **both** the Sign-Up screen and
the Login screen — the backend decides internally whether to insert or to sign in.

> ##### ⚠️ Critical 2026 Do / Do-Not contract for Flutter
>
> | Action                                                                  | Status                                           | Why                                                                                                                                                                                          |
> | ----------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | Send `{ idToken: "<full Google JWT>" }` (1000+ char string with 2 dots) | ✅ **REQUIRED**                                  | Digitally signed by Google. Only this is verifiable server-side.                                                                                                                             |
> | Send `{ googleId: "103456789..." }` (raw UID string only)               | ❌ **FORBIDDEN — will 400 or silently be wrong** | UID-only strings are not signed. Anyone could forge them to hijack accounts.                                                                                                                 |
> | Use package `google_sign_in` from pub.dev                               | ✅ **REQUIRED**                                  | Official Google SDK that performs the native picker and gives you the real `idToken`.                                                                                                        |
> | Use `firebase_auth` **instead of** `google_sign_in` to obtain `idToken` | ❌ **DO NOT USE as the source of idToken**       | `FirebaseAuth.instance.signInWithGoogle()` gives you a Firebase auth session, but the raw Google `idToken` claim you need for Noor still comes from `google_sign_in`. See hybrid note below. |
> | Send `accessToken` instead of `idToken`                                 | ❌ **DO NOT SEND**                               | Different token meant for Google API calls, not OIDC identity verification.                                                                                                                  |
> | Set any Google env vars on the Noor backend                             | ⚪ **OPTIONAL**                                  | `POST /auth/google` works with **zero backend env vars**. `GOOGLE_CLIENT_ID` only enables an optional extra strict `aud` check for production hardening (see below).                         |
>
> ##### 🔀 Hybrid Firebase note (very common in 2026 Flutter shops)
>
> If your Flutter team already uses Firebase for other services (**Crashlytics,
> Analytics, FCM push notifications, Remote Config, Performance Monitoring**
> etc.) you are fully supported. The correct order is:
>
> 1. First call the official `GoogleSignIn().signIn()` + `.authentication` as
>    documented below to get a real `GoogleSignInAuthentication` object. This
>    gives you the raw **Google `idToken` JWT** that Noor's backend requires.
> 2. Send that same `idToken` to **`POST /auth/google`** against Noor's API
>    (this is what creates / authenticates the user inside Noor's database).
> 3. **Optionally, as step 3 only**, feed the identical `idToken` + the
>    accompanying `accessToken` into
>    `FirebaseAuth.instance.signInWithCredential(GoogleAuthProvider.credential(...))`
>    so the Firebase side of the app also gets a signed-in session for the
>    extra services you want from Google/Firebase.
>
> Never skip step 1 and never take a "Firebase Custom Token" or the
> `FirebaseAuth.instance.currentUser.uid` string and send that as `idToken` to
> Noor's backend — it will fail verification.

Authorization: **Public**. No Bearer token needed before calling this.

Validation / Request Body shape:

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE0NT...<long 3-part JWT with two dots>"
}
```

- `idToken` is **required** and must be a non-empty string. Empty, blank, or
  omitted values are rejected by model validation as `400` before the endpoint
  is reached.

Behaviour:

- The server sends the received token to Google's public
  `https://www.googleapis.com/oauth2/v3/tokeninfo` endpoint. If Google returns
  anything other than `200 OK`, the request fails with `401` and the
  `Invalid Google ID token` message. **No database write occurs in that case.**
- The decoded, verified token contains claims: `{ sub, email, name, aud, exp, iss, ... }`.
- **Account lookup priority (new, secure):**
  1. First the server tries `prisma.user.findUnique({ where: { googleId: sub } })`
     using the unique-indexed `googleId` column. This ensures that users who
     later **change their primary Google email** still land on their original
     Noor account (they never lose their points / tasbih history).
  2. Only if no such `googleId` match exists does the server fall back to
     matching by `email`. This path covers (a) brand-new sign-ups and (b)
     pre-existing **LOCAL** password users whose email already matched before
     they first clicked Continue with Google.
- On **first Google sign-in ever for this Google account**:
  - A new user row is inserted with:
    - `provider = "GOOGLE"`,
    - `googleId  = sub` claim (non-null, unique indexed),
    - `providerId = sub` claim,
    - `fullName = name` claim when present, otherwise `null`,
    - `email    = email` claim **lowercased**,
    - `username` is auto-generated from the Google display name (same
      server-side generator as local sign-up — guaranteed unique via retries).
  - HTTP response status is **`201 Created`**.
- On **returning Google sign-in** (googleId already in DB), or on a
  **LOCAL password user who matches by email**:
  - The server **back-fills any missing columns on the user row atomically**:
    - If `googleId` was `null` it gets set to the `sub` claim (both for
      previously-LOCAL users whose email matched, and for legacy GOOGLE users
      created before the server started persisting the field).
    - If `fullName` was `null` and Google sent a name, it is populated.
  - The primary `provider` column is **never downgraded**. A user who
    originally registered with email+password keeps `provider = LOCAL` so they
    can still sign in with their password AND via Google going forward.
  - HTTP response status is **`200 OK`**.
- A matching email whose `provider` is **neither** `LOCAL` **nor** `GOOGLE`
  (e.g. `APPLE`) fails with `409 Conflict` so the user is directed to sign in
  via the provider they originally used.
- Returned `data.user.providerId` holds the `sub` claim so Flutter can use it
  as an immutable stable identifier alongside the HTTP status code
  (`201` → show onboarding tour; `200` → go straight to Home).
- Returned envelope shape and token semantics (`expiresIn`, `tokenType`) are
  identical to Sign-Up. Store them in `flutter_secure_storage` the same way.
- Google-provider users have no server-side password. Never route them to the
  "Forgot password" screen. If they see "Invalid credentials" twice, show a
  hint: `"This email was registered with Google — tap Continue with Google."`

#### ① Flutter Google Sign-In — required setup steps (NO FIREBASE REQUIRED, Firebase optional for extras)

Before you write a single line of Dart, the Flutter engineer must perform these
3 one-time tasks. Without them `auth.idToken` will always be `null` and the
endpoint cannot be called.

You are free to also add `firebase_core`, `firebase_crashlytics`,
`firebase_analytics`, `firebase_messaging`, or any other Firebase Flutter
packages to your project for their respective features — they do not conflict
with this integration. The only rule is: **the `idToken` you send to Noor's
backend must come from the `google_sign_in` package's `.authentication.idToken`
property, never from any Firebase package.**

1. **Create 3 OAuth 2.0 Client IDs on Google Cloud Console**
   (console.cloud.google.com → APIs & Services → Credentials, same Google Cloud
   project the Noor backend team uses):

   | Client type | Fields to fill                                                                                 | Output                                                                                                                           |
   | ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
   | **Android** | Package name (`com.noor.app`) + **SHA-1 fingerprint of the debug AND release keystore**        | A numeric Client ID (no downloadable file needed).                                                                               |
   | **iOS**     | Bundle ID (`com.noor.app`) + optional App Store ID + Team ID                                   | A plist `GoogleService-Info.plist` plus numeric Client ID.                                                                       |
   | **Web**     | Authorized JavaScript origins (e.g. `http://localhost:3000`, the production Web domain if any) | A numeric **Web Client ID string of the form** `123456-abcdef.apps.googleusercontent.com`. **Copy this string — Dart needs it.** |

   > **CRITICAL Android gotcha (90% of "idToken is null" support tickets come from this):**
   > In Google Cloud Console → **OAuth Consent Screen** → Publishing status must be set to
   > **"In production" (PUBLISHED)** with "Testing" user list containing nothing useful.
   > If left in "Testing" with no users added, every Google account that is not
   > explicitly whitelisted will silently authenticate but return a **null** idToken.
   > Same symptom happens if the Android SHA-1 or package name is a typo.

2. **Project files** (Flutter engineer owns these):
   - **Android:** add the Android OAuth Client ID to
     `android/app/src/main/res/values/strings.xml` under the key
     `default_web_client_id`. Also make sure `android/app/build.gradle` applies
     the Google services plugin only if you _really_ need it — with
     `google_sign_in: ^6.x` you can actually **skip** the whole google-services
     gradle plugin if this string exists.
   - **iOS:** Add the `CFBundleURLSchemes` entry from
     `GoogleService-Info.plist` → `REVERSED_CLIENT_ID` into your `Info.plist`
     file, and drop the `GoogleService-Info.plist` file into the Runner
     project via Xcode.
   - **Web:** Add the Web Client ID to `index.html` meta tag
     `google-signin-client_id`.

3. **pubspec.yaml dependencies** (the 3 below are required for the Noor
   integration; add any Firebase extras separately if you need them — e.g.
   `firebase_core`, `firebase_crashlytics`, `firebase_analytics`,
   `firebase_messaging`, `firebase_remote_config`):

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_secure_storage: ^9.2.2
  dio: ^5.7.0
  google_sign_in: ^6.3.0 # 👈 OFFICIAL ONLY — source of the real Google idToken JWT.
```

#### ② Production-hardening optional backend env var

The endpoint works with **zero backend env vars set**. Optionally, the backend
team may add to Vercel (and nowhere else — not in the Flutter app):

```
GOOGLE_CLIENT_ID=123456-abcdefghijkl.apps.googleusercontent.com   # the WEB client ID, copied verbatim
```

When present, the server performs one extra check _after_ Google already
verified the signature: it compares the `aud` claim in the token to the
configured value and rejects the call with `401` if they differ. This
guarantees that a valid Google token issued for a completely different
third-party app cannot be replayed against Noor. **This is never mandatory for
integration to work; leave it out while the Flutter team is wiring things up.**

#### ③ Reference Dart implementation (copy-paste-ready)

```dart
// lib/core/auth/google_sign_in_service.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

class NoorGoogleAuth {
  static const String _kWebClientId = String.fromEnvironment(
    'NOOR_GOOGLE_WEB_CLIENT_ID',
    // 👈 Pass via --dart-define=NOOR_GOOGLE_WEB_CLIENT_ID=xxxx at build time.
    // NEVER commit this to git. For Android-only builds you can leave it empty.
    defaultValue: '',
  );

  static final GoogleSignIn _signIn = GoogleSignIn(
    // clientId is required on iOS & Web; on Android the SDK reads it from
    // the strings.xml default_web_client_id resource so passing it here is
    // harmless but redundant.
    clientId: _kWebClientId.isEmpty ? null : _kWebClientId,
    scopes: const <String>[
      'openid',
      'email',
      'profile',
    ],
    // Force the account picker to appear every time — avoids silently
    // re-signing the user in with a stale account during testing.
    forceCodeForRefreshToken: true,
  );

  final Dio _dio;
  final FlutterSecureStorage _storage;

  NoorGoogleAuth(this._dio, this._storage);

  /// Returns the raw HTTP status so callers can distinguish 201 (new user)
  /// from 200 (returning user). Throws typed Dart errors for all 4xx/5xx.
  Future<int> signInOrSignUp() async {
    final GoogleSignInAccount? account = await _signIn.signIn();
    if (account == null) {
      throw const UserCancelledGoogleSignInException(); // handle in UI
    }

    final GoogleSignInAuthentication auth = await account.authentication;
    final String? idToken = auth.idToken;
    if (idToken == null || idToken.isEmpty) {
      // 99% of the time this means:
      //   Android  → wrong SHA-1 in Google Cloud, wrong package name, or
      //              OAuth consent screen still in "Testing" status without
      //              the current account in the Test-users list.
      //   iOS      → reversed URL scheme missing from Info.plist.
      //   Any      → clientId passed to GoogleSignIn() is from the wrong
      //              cloud project entirely.
      throw const GoogleIdTokenNullException();
    }

    // *********************************************************
    // ✅ ONLY this body is sent to Noor. Nothing else.
    //    Do NOT send .id, do NOT send accessToken, do NOT send UID.
    // *********************************************************
    final Response<Map<String, dynamic>> resp = await _dio.post<Map<String, dynamic>>(
      '/auth/google',
      data: <String, dynamic>{'idToken': idToken},
    );

    final Map<String, dynamic> data = resp.data!['data'] as Map<String, dynamic>;
    final Map<String, dynamic> tokens = data['tokens'] as Map<String, dynamic>;
    await Future.wait(<Future<void>>[
      _storage.write(key: 'accessToken', value: tokens['accessToken'] as String?),
      _storage.write(key: 'refreshToken', value: tokens['refreshToken'] as String?),
    ]);

    // ******************************************************************
    // 🔀 OPTIONAL HYBRID STEP — only if you also use Firebase services
    //    (Crashlytics, Analytics, FCM, Remote Config, Performance, …).
    //    You can delete this entire block if you don't use Firebase.
    //
    // import 'package:firebase_auth/firebase_auth.dart' show FirebaseAuth,
    //   GoogleAuthProvider; // add at the top of the file if using.
    //
    // if (FirebaseAuth.instance.app.isInitialized) {
    //   await FirebaseAuth.instance.signInWithCredential(
    //     GoogleAuthProvider.credential(
    //       idToken: idToken,                  // same idToken we sent to Noor
    //       accessToken: auth.accessToken,     // companion token from Google
    //     ),
    //   );
    // }
    // ******************************************************************

    // 201 → first-ever sign-in for this Google account → show onboarding.
    // 200 → returning user → skip onboarding, navigate to Home.
    return resp.statusCode!;
  }

  Future<void> signOut() async {
    await _signIn.signOut();
    await Future.wait(<Future<void>>[
      _storage.delete(key: 'accessToken'),
      _storage.delete(key: 'refreshToken'),
    ]);
  }
}
```

#### ④ Common error branches (with their Flutter-side fix)

Response Body (400 — idToken missing or Zod validation failed — **use `errors[]`, not `details`**):

```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "idToken",
      "message": "Google ID token is required",
      "code": "too_small"
    }
  ],
  "timestamp": "2026-08-21T12:00:00.000Z",
  "requestId": "a1b2c3d4-0007-aaaa-bbbb-000000000007"
}
```

Action for Flutter: the request body was serialized wrong. Ensure your request uses `jsonEncode({'idToken': token})` with exactly that key name and no extra top-level wrapper. Iterate `errors[]`, read `errors[i].field`, and highlight the matching input (there is only one field here anyway). Do **NOT** read `details` for a Zod validation error (that key is a separate channel used by AppError-level / Prisma-level failures, not schema rejects).

---

Response Body (401 — Google rejected the token / token expired / forged):

```json
{
  "success": false,
  "message": "Invalid Google ID token",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "requestId": "a1b2c3d4-0008-aaaa-bbbb-000000000008"
}
```

Action for Flutter: call `_signIn.signOut(); _signIn.disconnect();` and prompt
the user to try again. If this is 100% reproducible and not an expiration
issue, verify the token was not truncated when you serialized it (watch for
buggy log-printers that cut long strings mid-JWT — compare length to >1000
chars).

---

Response Body (401 — Optional strict `aud` mismatch, only when backend has
`GOOGLE_CLIENT_ID` set):

```json
{
  "success": false,
  "message": "Google ID token audience does not match this server",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "requestId": "a1b2c3d4-0009-aaaa-bbbb-000000000009"
}
```

Action for Flutter: the Web Client ID string hard-coded in Google Cloud →
Credentials, and the one the backend team copied into `GOOGLE_CLIENT_ID` env
var on Vercel are from different cloud projects or different client types
(e.g. backend pasted the Android ID instead of the Web ID). Ask both teams to
paste each other the full string including `.apps.googleusercontent.com` and
make sure byte-for-byte they are identical.

---

Response Body (409 — email registered with a non-Google, non-LOCAL provider):

```json
{
  "success": false,
  "message": "This email is already registered with a different provider",
  "code": "CONFLICT",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "requestId": "a1b2c3d4-0010-aaaa-bbbb-000000000010"
}
```

Action for Flutter: show a dialog:
`"This email is already signed up with Apple — please continue with Apple instead."`
Do not auto-migrate anything.

---

Response Body (503 — only applies to the unrelated `GET /auth/google/url`
web-redirect endpoint, NOT to this POST call. If you see it here it means you
sent the request to the wrong path):

```json
{
  "success": false,
  "message": "Google authentication is not configured on the server... (Note: the POST /auth/google endpoint that accepts idToken works WITHOUT this env variable set)",
  "code": "INTERNAL_SERVER_ERROR",
  "timestamp": "2026-07-31T12:00:00.000Z",
  "requestId": "a1b2c3d4-0011-aaaa-bbbb-000000000011"
}
```

Action for Flutter: double-check your request URL ends with **exactly**
`POST https://noor-app-backend-one.vercel.app/api/v1/auth/google` (no `/url`,
no `/callback` suffix).

---

Response Body (200 / 201):

```json
{
  "success": true,
  "message": "Signed in via Google successfully",
  "data": {
    "user": {
      "id": "03f9b4bb-1e8a-4654-9329-a157798e5b74",
      "username": "ahmed_mohamed_4821",
      "fullName": "Ahmed Mohamed Ali",
      "email": "ahmed.mohamed.ali.1997@gmail.com",
      "role": "USER",
      "provider": "GOOGLE",
      "providerId": "103456789012345678901",
      "createdAt": "2026-07-18T10:23:11.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access....",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh....",
      "expiresIn": "7d"
    }
  },
  "timestamp": "2026-07-31T12:00:00.000Z",
  "requestId": "a1b2c3d4-0006-aaaa-bbbb-000000000006"
}
```

HTTP status is `201` when a brand-new user row was just inserted; `200` when
the Google account already had a `googleId` row (or matched a LOCAL user by
email). Use this difference inside Flutter to decide whether to show the
onboarding carousel (`201`) or to jump straight to the Home screen (`200`).
`data.user.providerId` holds the stable Google `sub` claim.

---

### 4) POST /auth/refresh — Rotate access token (background / retry flow)

Description: Flutter calls this when an API request returns `401`. It exchanges the long-lived `refreshToken` for a brand new `accessToken` (+ new refresh token). Call BEFORE the original 401-triggering request is retried once.

Authorization: **Public** (token is in the body, not the `Authorization` header).

Request Body:

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh...." }
```

Response Body (200): Same `{ user, tokens }` shape as Sign-Up, Login, and Google. This lets you overwrite the stored user profile atomically alongside the token rotation.

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
      "username": "ahmedmohamed_8472",
      "fullName": "Ahmed Mohamed Ali",
      "email": "ahmedmohamed@gmail.com",
      "role": "USER",
      "provider": "LOCAL",
      "providerId": null,
      "createdAt": "2026-07-31T07:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-rotated....",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.new-rotated....",
      "expiresIn": "7d"
    }
  },
  "timestamp": "2026-07-31T07:15:00.000Z",
  "requestId": "a1b2c3d4-0012-aaaa-bbbb-000000000012"
}
```

Action on 200: Overwrite `data.tokens.accessToken` + `data.tokens.refreshToken` in secure storage. Optionally re-apply `data.user` to profile state (catches username / fullName edits made server-side).

Response Body (401 — refresh token revoked, never issued, or user account was deactivated):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired refresh token",
  "details": null,
  "timestamp": "2026-07-31T07:15:00.000Z",
  "requestId": "a1b2c3d4-0013-aaaa-bbbb-000000000013"
}
```

Action on 401: Navigate the user back to the Login screen. Treat this state as "soft logout" (keep cached UI data but clear the token pair from secure storage).

---

### 5) POST /auth/logout — Sign out button (side drawer / profile screen)

Description: Invalidates the refresh token server-side so it can never be re-used. Call this when the user explicitly taps "تسجيل خروج" in the profile menu. The Google SDK sign-out (local only) should be called in addition to this endpoint if the provider is GOOGLE.

Authorization: **Public** (refresh token lives in the request body, not the Bearer header).

Request Body:

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh...." }
```

Response Body (200):

```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null,
  "timestamp": "2026-07-31T22:00:00.000Z",
  "requestId": "a1b2c3d4-0014-aaaa-bbbb-000000000014"
}
```

Response Body (400 — empty / malformed refresh token):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid refresh token",
  "details": null,
  "timestamp": "2026-07-31T22:00:00.000Z",
  "requestId": "a1b2c3d4-0015-aaaa-bbbb-000000000015"
}
```

Action after 200 (or even 400, since the token is already unusable):

1. Clear `accessToken` + `refreshToken` from `flutter_secure_storage`.
2. If `user.provider == "GOOGLE"`, also call `GoogleSignIn().signOut()` so the next Google tap re-shows the account picker.
3. Navigate to the Login screen (NOT the Sign-Up screen).

---

### 6) GET /auth/me — Current user profile (verify session + refresh profile state)

Description: Returns the same `AuthUserProfile` shape that comes inside the sign-up/login/google/refresh responses. Useful to verify a stored access token is still valid after app cold-start, or to pick up server-side edits to `fullName` / `username` that happened after the last login. Returns 401 if the account was deactivated or the token expired without a refresh in flight.

Authorization: **Bearer token** (must send the current access token).

Query Params: none.

Response Body (200):

```json
{
  "success": true,
  "message": "Current user retrieved successfully",
  "data": {
    "id": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
    "username": "ahmedmohamed_8472",
    "fullName": "Ahmed Mohamed Ali",
    "email": "ahmedmohamed@gmail.com",
    "role": "USER",
    "provider": "LOCAL",
    "providerId": null,
    "createdAt": "2026-07-31T07:00:00.000Z"
  },
  "timestamp": "2026-07-31T22:30:00.000Z",
  "requestId": "a1b2c3d4-0016-aaaa-bbbb-000000000016"
}
```

For GOOGLE users, `data.provider` equals `"GOOGLE"` and `data.providerId` holds the stable Google `sub` string.

Response Body (401):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "details": null,
  "timestamp": "2026-07-31T22:30:00.000Z",
  "requestId": "a1b2c3d4-0017-aaaa-bbbb-000000000017"
}
```

Action on 401: attempt the standard refresh flow; if that also 401s, go to Login.

---

## 🔹 Home / Dashboard Screen (one GET, 8 widgets)

### 1) GET /dashboard — Home Screen data (call exactly once at app launch)

Description: The **single most important endpoint** for the app. It returns every widget for the Home screen in one round-trip. After user actions (tapping a prayer complete, finishing a tasbih session, claiming a challenge, etc.) call the fine-grained per-module endpoints for partial updates, then **re-read `/dashboard` once** on the next app foregrounding rather than hammering it repeatedly.

Authorization: Bearer token (401 redirects to Login via refresh logic).

Route Params: none.

Query Params: none.

Behaviour:

- Returns **exactly 8 sections**: `greeting`, `prayers`, `verseOfTheDay`, `hadithOfTheDay`, `dailyJourney`, `khatmah`, `dailyChallenge`, `utilities`. No keys are ever omitted; nullable sections return `null` explicitly (never absent) so a strict Dart `required` model deserializes safely.
- `prayers.nextPrayer.countdownSeconds` is the seconds remaining **at response time**. In Flutter, drive a Timer that subtracts 1 every second locally. When this counter reaches zero, **re-fetch `/dashboard` once** to get the next upcoming prayer.
- Prayer completion dots under each of the 5 daily prayers follow `prayers.schedule[i].completed`: `true` → gold dot; `false` → gray dot. Do **not** drive the dot from `dailyJourney.prayer.completed` (that number is an aggregate and can be stale on the same render cycle).
- `greeting.displayName` is the user-facing greeting ("Ahlan, Ahmed …") and is always non-empty: it equals `fullName` when present, else falls back to `username`. Widgets should **never** read `fullName` directly for display; always use `displayName`.
- `greeting.weekdayName` + `greeting.hijriDate` are pre-formatted Arabic strings and can be concatenated as-is: `"$weekdayName  $hijriDate"` ("السبت 15 ذو القعدة 1447").
- `utilities` are static flags (`enabled: true` is a contract). Tapping the Tasbih card navigates to the Tasbih screen; tapping the Qibla card navigates to the Qibla screen. No extra lookup is needed.

Response Body (200):

```json
{
  "success": true,
  "message": "Dashboard loaded successfully",
  "data": {
    "greeting": {
      "displayName": "Ahmed Mohamed Ali",
      "fullName": "Ahmed Mohamed Ali",
      "username": "ahmedmohamed_8472",
      "points": 2450,
      "weekdayName": "السبت",
      "hijriDate": "15 ذو القعدة 1447",
      "gregorianDate": "28 يوليو 2026"
    },

    "prayers": {
      "date": "2026-07-28",
      "timezone": "Africa/Cairo",
      "nextPrayer": {
        "name": "ASR",
        "nameAr": "صلاة العصر",
        "time": "15:24",
        "countdownSeconds": 4468
      },
      "schedule": [
        {
          "name": "FAJR",
          "nameAr": "الفجر",
          "time": "04:11",
          "completed": true
        },
        {
          "name": "DHUHR",
          "nameAr": "الظهر",
          "time": "12:58",
          "completed": true
        },
        {
          "name": "ASR",
          "nameAr": "العصر",
          "time": "15:24",
          "completed": false
        },
        {
          "name": "MAGHRIB",
          "nameAr": "المغرب",
          "time": "18:49",
          "completed": false
        },
        {
          "name": "ISHA",
          "nameAr": "العشاء",
          "time": "20:18",
          "completed": false
        }
      ],
      "completedCount": 2,
      "totalCount": 5
    },

    "verseOfTheDay": {
      "textAr": "الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
      "referenceAr": "[ الرعد: 28 ]",
      "surahNumber": 13,
      "ayahNumber": 28
    },

    "hadithOfTheDay": {
      "textAr": "المؤمن للمؤمن كالبنيان يشد بعضه بعضاً",
      "sourceAr": "[ متفق عليه ]"
    },

    "dailyJourney": {
      "prayer": { "completed": 3, "total": 5, "progress": 60 },
      "quran": { "pagesRead": 4 },
      "adhkar": { "completed": true },
      "sadaqah": { "amount": 0 }
    },

    "khatmah": {
      "surahId": 2,
      "surahNameEn": "Al-Baqarah",
      "surahNameAr": "البقرة",
      "currentPage": 35,
      "progressPercent": 6
    },

    "dailyChallenge": {
      "titleAr": "اقرأ 5 صفحات من القرآن",
      "descriptionAr": "اقرأ 5 صفحات من القرآن الكريم اليوم للحصول على 50 نقطة",
      "rewardPoints": 50,
      "targetValue": 5,
      "completed": false,
      "claimed": false
    },

    "utilities": {
      "tasbih": { "enabled": true },
      "qibla": { "enabled": true }
    }
  },
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0100-aaaa-bbbb-000000000100"
}
```

Response Body (401):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Expired or missing Bearer token",
  "details": null,
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0101-aaaa-bbbb-000000000101"
}
```

**Action on 401**: attempt refresh, retry once, else Login screen.

Response Body (500):

```json
{
  "success": false,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error",
  "details": null,
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0102-aaaa-bbbb-000000000102"
}
```

**Flutter helpers — computed directly from the 200 response body:**

```dart
// 1) Countdown display for next prayer (HH:MM:SS)
int sec = data['prayers']['nextPrayer']['countdownSeconds'] as int;
String hh = (sec ~/ 3600).toString().padLeft(2, '0');
String mm = ((sec % 3600) ~/ 60).toString().padLeft(2, '0');
String ss = (sec % 60).toString().padLeft(2, '0');
String countdown = '$hh:$mm:$ss';

// 2) Top-right header (Arabic weekday + Hijri)
String topRight = '${data['greeting']['weekdayName']}  ${data['greeting']['hijriDate']}';

// 3) Top-left greeting (safe display name)
String greeting = 'أهلا، ${data['greeting']['displayName']}';

// 4) Daily prayer card progress (for a LinearPercentIndicator 0..1)
double pProgress =
    ((data['dailyJourney']['prayer']['progress'] as int) ?? 0) / 100;
```

---

## 🔹 Tasbih / Digital Counter Screen (4 endpoints, 3 visible states)

### Critical clarification — two counters, one screen

The Tasbih screen renders **two separate numeric values**. Mixing them up causes the middle screen bug (user changes the dhikr and the "grand total" suddenly resets — which must NOT happen).

| Position on screen                                           | JSON field          | Semantics                                                      | Resets to 0 when …                                                                                           |
| ------------------------------------------------------------ | ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Top-right (label: "مجموع التسبيحات")                         | `todayCount`        | Running total for the calendar day across ALL dhikrs combined. | ONLY when user explicitly taps `POST /tasbih/reset` OR a new day rolls over (server-side).                   |
| Inside the big navy circle (under the dhikr name, e.g. "33") | `currentDhikrCount` | Count for the **currently selected dhikr only**.               | User taps `PATCH /tasbih/change-dhikr` (new dhikr starts at 0) OR user performs global `POST /tasbih/reset`. |

The 3 provided screen captures map 1:1 to these endpoints:

| Screen   | Situation                                           | `todayCount`          | `currentDhikrAr`         | `currentDhikrCount` | Triggering endpoint          |
| -------- | --------------------------------------------------- | --------------------- | ------------------------ | ------------------- | ---------------------------- |
| Screen 1 | Fresh reset / new day                               | `0`                   | "الحمد لله" (or default) | `0`                 | `POST /tasbih/reset`         |
| Screen 2 | User just changed dhikr from سبحان الله → الحمد لله | **`278` (unchanged)** | "الحمد لله"              | `0`                 | `PATCH /tasbih/change-dhikr` |
| Screen 3 | User is mid-session on سبحان الله                   | `245`                 | "سبحان الله"             | `33`                | N× `POST /tasbih/increment`  |

---

### 1) GET /tasbih/today — Tasbih screen initial load

Description: Call once when the Tasbih screen is opened.

Authorization: Bearer token.

Response Body (200 — matches Screen 3):

```json
{
  "success": true,
  "message": "Tasbih today loaded",
  "data": {
    "todayCount": 245,
    "currentDhikr": "SUBHAN_ALLAH",
    "currentDhikrAr": "سبحان الله",
    "currentDhikrCount": 33,
    "dailyGoal": 99,
    "progressPercent": 33.33,
    "lastDhikrChangeAt": "2026-07-28T09:15:30.000Z"
  },
  "timestamp": "2026-07-31T09:00:00.000Z",
  "requestId": "a1b2c3d4-0200-aaaa-bbbb-000000000200"
}
```

Available `currentDhikr` enum values (6 dhikrs — build the "تغيير الذكر" BottomSheet from this list):

| Enum value                           | Arabic rendering         |
| ------------------------------------ | ------------------------ |
| `SUBHAN_ALLAH`                       | سبحان الله               |
| `ALHAMDULILLAH`                      | الحمد لله                |
| `LA_ILAHA_ILLA_ALLAH`                | لا إله إلا الله          |
| `ALLAHU_AKBAR`                       | الله أكبر                |
| `ASTAGHFIRULLAH`                     | أستغفر الله              |
| `LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH` | لا حول ولا قوة إلا بالله |

Rendering rule:

- Show `currentDhikrAr` as the label inside the big circle (NOT the enum key).
- Show `currentDhikrCount` as the big number inside the circle.
- Show `todayCount` at top-right under "مجموع التسبيحات".

---

### 2) POST /tasbih/increment — Tap on the big navy circle

Description: Increments **both counters** by `amount` (default `1`). Call this on every tap of the circular button. Haptic / vibration feedback is 100% client-side; no server round-trip is required for feedback but server state must be kept authoritative. Optimistic UI is safe because the endpoint is idempotent-ish (if retry sends a duplicate +1, the user will lose at most one tap; compensate by re-fetching `/tasbih/today` on the first retry failure).

Authorization: Bearer token.

Request Body:

```json
{ "amount": 1 }
```

`amount` is optional; omit the body entirely and it defaults to 1.

Response Body (200): Same shape as `/tasbih/today` with `currentDhikrCount + 1` and `todayCount + 1`.

Response Body (401): standard envelope (refresh + retry).

---

### 3) POST /tasbih/reset — "إعادة ضبط" button

Description: Resets **both counters** to 0 for the day. Confirm with a small dialog; the operation is irreversible (the day's totals are zeroed).

Authorization: Bearer token.

Request Body: none.

Response Body (200 — matches Screen 1):

```json
{
  "success": true,
  "message": "Tasbih reset for today",
  "data": {
    "todayCount": 0,
    "currentDhikr": "SUBHAN_ALLAH",
    "currentDhikrAr": "سبحان الله",
    "currentDhikrCount": 0,
    "dailyGoal": 99,
    "progressPercent": 0,
    "lastDhikrChangeAt": "2026-07-31T09:00:00.000Z"
  },
  "timestamp": "2026-07-31T09:00:00.000Z",
  "requestId": "a1b2c3d4-0201-aaaa-bbbb-000000000201"
}
```

The current dhikr stays the same after reset (it does **not** jump to الحمد لله or any other value). If you want Screen 1 style "الحمد لله + 0" as a visual default on app first-launch with an empty record, render client-side until the first 200 response arrives.

---

### 4) PATCH /tasbih/change-dhikr — "تغيير الذكر" button

Description: Switches to a new dhikr from the 6-enum list. This is where Screen 2 semantics apply:

Behaviour:

- `currentDhikr` + `currentDhikrAr` change to the requested dhikr.
- ⚠️ **`currentDhikrCount` resets to `0`** (new dhikr starts fresh — matches Screen 2).
- ✅ **`todayCount` is PRESERVED exactly as it was.** The top-right grand total does NOT move.
- Passing the **same** dhikr that is already active returns 200 unchanged and does NOT reset `currentDhikrCount` (safe no-op for Flutter rebuilds).
- Passing a string outside the enum list → `400 VALIDATION_ERROR` with `details.field = "dhikr"`.

Authorization: Bearer token.

Request Body:

```json
{ "dhikr": "ALHAMDULILLAH" }
```

Response Body (200 — matches Screen 2 exactly):

```json
{
  "success": true,
  "message": "Dhikr changed",
  "data": {
    "todayCount": 278,
    "currentDhikr": "ALHAMDULILLAH",
    "currentDhikrAr": "الحمد لله",
    "currentDhikrCount": 0,
    "dailyGoal": 99,
    "progressPercent": 0,
    "lastDhikrChangeAt": "2026-07-28T07:12:45.000Z"
  },
  "timestamp": "2026-07-28T07:12:45.000Z",
  "requestId": "a1b2c3d4-0202-aaaa-bbbb-000000000202"
}
```

Response Body (400):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Unknown dhikr value",
  "details": { "field": "dhikr" },
  "timestamp": "2026-07-28T07:12:45.000Z",
  "requestId": "a1b2c3d4-0203-aaaa-bbbb-000000000203"
}
```

---

## 🔹 Qibla / Compass Screen

### 1) GET /qibla/calculate — Qibla bearing + direction (public)

Description: Given real GPS coordinates from the device returns the Qibla bearing, direction label and distance. This is the only authenticated-free widget endpoint. Call it once after the platform grants location permission; if permission is denied, fall back to showing a "Enable location permission" placeholder (no request body or alternative endpoint exists for a default / guessed bearing).

Authorization: **Public** — no Bearer token. This lets you show a compass even during a transient 401 token-refresh race.

Query Params:

- `lat` (number, required) — device latitude in decimal degrees (WGS-84).
- `lng` (number, required) — device longitude in decimal degrees.

Example URL:

```
GET /api/v1/qibla/calculate?lat=30.0444&lng=31.2357
```

Behaviour:

- `bearingDegrees` is in the range `[0, 360)` clockwise from true north. 0 = North, 90 = East, 180 = South, 270 = West.
- The compass arrow must be rotated on screen by `arrowAngleDeg = bearingDegrees - currentHeading`, where `currentHeading` is read continuously from `flutter_compass` (or equivalent magnetometer + rotation vector fusion package). `Transform.rotate` takes radians, so convert via `* pi / 180`.
- The Kaaba location (Makkah) is also returned for debug overlays: `(21.4225, 39.8262)`.
- `distanceKm` is optional UI: show below the compass or in a settings chip if desired.

Response Body (200):

```json
{
  "success": true,
  "message": "Qibla bearing computed",
  "data": {
    "bearingDegrees": 215.67,
    "bearingRadians": 3.764,
    "directionAr": "الجنوب الغربي",
    "distanceKm": 1246.35,
    "kaaba": {
      "latitude": 21.4225,
      "longitude": 39.8262
    },
    "userLocation": {
      "latitude": 30.0444,
      "longitude": 31.2357
    }
  },
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0300-aaaa-bbbb-000000000300"
}
```

Response Body (400 — missing coordinates):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Missing or invalid lat/lng",
  "details": { "field": "lat" },
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0301-aaaa-bbbb-000000000301"
}
```

Dart compass example (copy/paste into the Qibla screen's `initState`):

```dart
// dependencies: flutter_compass
import 'package:flutter_compass/flutter_compass.dart';
// ...
double _arrowDeg = 0;
double _bearingFromApi = 215.67;   // ← from GET /qibla/calculate

@override
void initState() {
  super.initState();
  FlutterCompass.events?.listen((CompassEvent event) {
    final heading = event.heading ?? 0;
    setState(() => _arrowDeg = _bearingFromApi - heading);
  });
}

@override
Widget build(BuildContext context) {
  return Transform.rotate(
    angle: _arrowDeg * math.pi / 180,
    child: Image.asset('assets/qibla_arrow_gold.png'),
  );
}
```

---

## 🔹 Auth Forgot / Reset Password (2 new endpoints)

### 1) POST /auth/forgot-password — Request a reset link by email

Description: User taps "نسيت كلمة المرور" on the Login screen and enters their email. This sends a one-time password-reset token (server stores it hashed). Flutter **never** receives the raw token; the token is delivered via email.

Authorization: **Public** (no Bearer).

Rate limit: Auth rate limiter (same 5/hour per IP).

Request Body:

```json
{ "email": "AhmedMohamed@gmail.com" }
```

Response Body (200 — **always** the same message, even for unknown emails — to prevent enumeration):

```json
{
  "success": true,
  "message": "If an account exists for this email, a password reset link has been sent",
  "data": null,
  "timestamp": "2026-08-21T08:00:00.000Z",
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
  "timestamp": "2026-08-21T08:00:00.000Z",
  "requestId": "a1b2c3d4-0019-aaaa-bbbb-000000000019"
}
```

---

### 2) POST /auth/reset-password — Submit the new password using the token from the email

Description: The deep link / URL in the email includes `?token=<raw-jwt-looking-token>` and opens Flutter; the form has two fields `newPassword` + `confirmNewPassword`; only `{ token, newPassword }` is sent to the backend.

Authorization: **Public**.

Request Body:

```json
{
  "token": "<long token string from the email link>",
  "newPassword": "NewStrongP@ss9!"
}
```

Validation on `newPassword`: **same rules as sign-up** — min 8 chars, at least one letter AND at least one digit. Use the same client-side regex validator you already wrote for Sign-Up.

Response Body (200):

```json
{
  "success": true,
  "message": "Password reset successfully",
  "data": null,
  "timestamp": "2026-08-21T08:05:00.000Z",
  "requestId": "a1b2c3d4-0020-aaaa-bbbb-000000000020"
}
```

Response Body (400 — token expired / malformed / already used):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired reset token",
  "details": { "field": "token" },
  "timestamp": "2026-08-21T08:05:00.000Z",
  "requestId": "a1b2c3d4-0021-aaaa-bbbb-000000000021"
}
```

After 200: auto-navigate the user back to Login and show a SnackBar `"تم تغيير كلمة المرور. سجل دخول الآن."`. Do **not** auto-login the user; force one fresh Login so `refreshToken` is issued cleanly.

---

## 🔹 Profile / Settings Screen (6 endpoints — "حسابي" bottom-nav tab)

This screen renders the editable personal info card, the 4-item Quran reading-settings bottom sheet, change-password, and update-location. Use `GET /profile/me` for the initial card content; send partial PATCHes on Save taps; use `PUT /profile/location` when the user grants fresh GPS permission.

### 1) GET /profile/me — Full profile card load

Authorization: Bearer.

Response Body (200):

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
    "username": "ahmedmohamed_8472",
    "fullName": "Ahmed Mohamed Ali",
    "email": "ahmedmohamed@gmail.com",
    "points": 2450,
    "timezone": "Africa/Cairo",
    "latitude": 30.0444,
    "longitude": 31.2357,
    "quranFontSize": 28,
    "quranReciter": "Mishary_Alafasy",
    "quranTafsir": "Ibn_Kathir",
    "quranTranslation": "Sahih_International"
  },
  "timestamp": "2026-08-21T08:10:00.000Z",
  "requestId": "a1b2c3d4-0400-aaaa-bbbb-000000000400"
}
```

Note: For the greeting display-name rule keep using the Dashboard's `greeting.displayName` (it falls back to `username` when `fullName` is null). Never read `username` as the primary display label.

Response Body (401): standard envelope → refresh + retry.

---

### 2) PATCH /profile/update — Edit fullName + timezone (partial)

Authorization: Bearer.

Request Body (send only the fields you want updated — omitting a field leaves it unchanged):

```json
{ "fullName": "أحمد محمد علي", "timezone": "Africa/Cairo" }
```

Response Body (200): same shape as `GET /profile/me` (reflects the new merged state in DB).

---

### 3) PATCH /profile/change-password — Change password form (LOCAL users only)

Authorization: Bearer.

Request Body:

```json
{ "oldPassword": "StrongPass123!", "newPassword": "BrandNewP@ss9!" }
```

`newPassword` validation: min 8 chars / one letter + one digit (same global rule).

Response Body (200):

```json
{
  "success": true,
  "message": "Password changed successfully",
  "data": null,
  "timestamp": "2026-08-21T08:15:00.000Z",
  "requestId": "a1b2c3d4-0401-aaaa-bbbb-000000000401"
}
```

Response Body (400 — wrong old password, AppError → use `details`):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Old password is incorrect",
  "details": { "field": "oldPassword" },
  "timestamp": "2026-08-21T08:15:00.000Z",
  "requestId": "a1b2c3d4-0402-aaaa-bbbb-000000000402"
}
```

Response Body (409 — GOOGLE users who never had a password):

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "This account was registered with Google — password is not available",
  "details": null,
  "timestamp": "2026-08-21T08:15:00.000Z",
  "requestId": "a1b2c3d4-0403-aaaa-bbbb-000000000403"
}
```

UX rule for Flutter: when `user.provider === "GOOGLE"` hide the change-password card (or gray it out with a helper `"حسابك مسجل مع جوجل، لا توجد كلمة مرور محلية."`) — do **not** let the user waste a tap submitting this.

---

### 4) PUT /profile/location — Save fresh GPS + timezone (replaces, not partial)

Authorization: Bearer.

Use PUT (not PATCH) because the semantics are "overwrite device-reported location". Send this when the user presses "السماح بالموقع" and you get a real `Position` from the GPS package.

Request Body:

```json
{ "latitude": 30.0444, "longitude": 31.2357, "timezone": "Africa/Cairo" }
```

Response Body (200): same shape as `GET /profile/me` (with updated lat/lng).

Side-effect: after a successful PUT, the next `GET /qibla/my-qibla` call (authenticated variant below) uses the saved coordinates without requiring query params — ideal for onboarding flows where the GPS permission pop-up just closed.

---

### 5) GET /profile/reading-preferences — Open the "إعدادات القارئ" bottom sheet (4 rows: AA / 🎧 / ✍️ / 🌐)

Authorization: Bearer.

Response Body (200):

```json
{
  "success": true,
  "message": "Reading preferences retrieved successfully",
  "data": {
    "quranFontSize": 28,
    "quranReciter": "Mishary_Alafasy",
    "quranTafsir": "Ibn_Kathir",
    "quranTranslation": "Sahih_International"
  },
  "timestamp": "2026-08-21T10:30:00.000Z",
  "requestId": "a1b2c3d4-0410-aaaa-bbbb-000000000410"
}
```

Default values if the record is fresh (new user, never opened the sheet):

- `quranFontSize = 28` (in px). Clamp UI slider range **12..60** (backend rejects outside range with 400).
- `quranReciter = "Mishary_Alafasy"` (suggested dropdown list: Mishary_Alafasy, Abdul_Basit, Saad_Al_Ghamdi, Maher_Al_Muaiqly, Sudais_And_Shuraim).
- `quranTafsir = "Ibn_Kathir"` (suggested list: Ibn_Kathir, Al_Tabari, Al_Qurtubi, Al_Saadi).
- `quranTranslation = "Sahih_International"` (suggested list: Sahih_International, Yusuf_Ali, Pickthall, Dr_Ghali).

The actual list of reciter/tafsir/translation names that appear in the dropdown is **Flutter's responsibility** for now — the backend only stores the selected slug as a string. Keep slugs identical between the two sides so a later audio / tafsir lookup service can match them without a mapping step.

---

### 6) PATCH /profile/reading-preferences — User taps a new font size or selects a new reciter / tafsir / translation

Authorization: Bearer.

Partial update — send only the keys the user actually changed (no need to echo unchanged ones). The endpoint merges.

Request Body — three realistic examples:

```json
{ "quranFontSize": 32 }
```

```json
{ "quranReciter": "Saad_Al_Ghamdi", "quranTafsir": "Al_Tabari" }
```

```json
{
  "quranFontSize": 34,
  "quranReciter": "Abdul_Basit",
  "quranTafsir": "Ibn_Kathir",
  "quranTranslation": "Yusuf_Ali"
}
```

Response Body (200): returns all 4 keys in their merged post-update state (so Flutter can redraw all 4 rows without a second GET):

```json
{
  "success": true,
  "message": "Reading preferences updated successfully",
  "data": {
    "quranFontSize": 34,
    "quranReciter": "Abdul_Basit",
    "quranTafsir": "Ibn_Kathir",
    "quranTranslation": "Yusuf_Ali"
  },
  "timestamp": "2026-08-21T10:32:00.000Z",
  "requestId": "a1b2c3d4-0411-aaaa-bbbb-000000000411"
}
```

Response Body (400 — fontSize outside 12..60 — Zod `errors[]`):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "quranFontSize",
      "message": "Font size must be between 12 and 60",
      "code": "too_big"
    }
  ],
  "timestamp": "2026-08-21T10:32:00.000Z",
  "requestId": "a1b2c3d4-0412-aaaa-bbbb-000000000412"
}
```

Apply the new `data.quranFontSize` to the Mushaf page-reader's `TextStyle` immediately on the next page render.

---

## 🔹 Quran Main Screen + Reader (20 endpoints — the new core)

The Quran module has a 3-tab main screen:

- **Tab 1 — المفضلة** `GET /quran/bookmarks` (list with inline `textAr` preview, so the favorite card shows both `Surah: الآية N` + a snippet of the actual verse).
- **Tab 2 — السور** `GET /quran/surahs` (114 rows, icons driven by `revelationType`).
- **Tab 3 — الاجزاء** `GET /quran/juz` (30 rows).

Plus:

- **Page reader** `GET /quran/pages/:pageNumber` (the actual Mushaf view — السابق / التالي switch pages 1..604).
- **By-Juz sub-flow** `GET /quran/juz/:juzNumber/surahs` (open a Juz → list its Surahs → tap a Surah → `GET /quran/pages/${thatSurah.startPage}`). There is **no** `/quran/juz/:juzNumber/ayahs` route.
- **By-Surah reader** `GET /quran/surahs/:surahId` and `GET /quran/surahs/:surahId/ayahs?page&perPage` for continuous scroll by surah (Fatiha then next surah). `perPage` is capped at 100.
- **Khatmah + Stats** (`/khatmah` / `/khatmah/stats` / `/khatmah/progress` / `/khatmah/reset`) for screen "استكمال الختمة".
- **Last-read + reading history** (`GET/PUT /quran/last-read`, `GET/POST /quran/reading-history`).
- **Search + Random ayah**.
- **Reading preferences bottom sheet** (overflow ⋮ on the reader) is **not** under `/quran` — it is `GET/PATCH /profile/reading-preferences`.

All Quran lookup endpoints (`/surahs`, `/juz`, `/pages/:pageNumber`, `/search`, `/ayahs/random`) are **public** so they work during the 401→refresh transient and for unauthenticated onboarding tours. Anything user-specific (bookmarks, last-read, khatmah, reading-history, stats) requires Bearer.

#### Bismillah (بسم الله الرحمن الرحيم) — UI rendering rule (2026)

Follow the printed Mushaf convention exactly as in your screenshots.

| Case                                                   | Flutter must                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surahId = 1` (Al-Fatihah)                             | **Optional:** treat Bismillah as the unnumbered centered header (recommended for visual consistency with all other surahs). If Hafs-numbered layout is preferred, render it as ayah `{1}` — either is acceptable; the backend still ships the original `textAr` for ayah 1 unchanged.                                                                                                                                                       |
| `surahId = 9` (At-Tawbah)                              | **❌ NEVER render a Bismillah header** for this surah. No exception.                                                                                                                                                                                                                                                                                                                                                                        |
| `surahId = 2..8` or `10..114`                          | **Render Bismillah as a standalone, UN-NUMBERED, CENTERED header** (just below the surah name), then render `ayahs[]` starting at `ayahNumber = 1` directly under it. **Do not attach a `{1}` badge to the Bismillah header.**                                                                                                                                                                                                              |
| `textAr` content (backend 2026 sanitization)           | The backend guarantees, for surahs `2..8` and `10..114`, that the `textAr` of `ayahNumber = 1` contains **only the real first numbered ayah**, with the opening Bismillah already removed. This means you will **never see Bismillah duplicated** between your header and the first numbered ayah, so you do **NOT** need to strip / split / substring any `textAr` on Flutter side — render every `ayah.textAr` field exactly as received. |
| Page that straddles two surahs (`surahs.length === 2`) | After the last ayah belonging to `surahs[0]`, draw a divider, draw `surahs[1].nameAr`, then draw the Bismillah header (unless `surahs[1].id == 9`), then continue with ayahs whose `surahId == surahs[1].id`.                                                                                                                                                                                                                               |

Recommended constant for the centered unnumbered header (use in a RichText / custom widget):

```dart
const quranBismillah = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
```

**Screenshot → endpoint map (Quran UI):**

| Screen                                     | Flutter calls                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Greeting `اهلا، احمد`                      | `GET /dashboard` → `greeting.displayName` (or `GET /profile/me` `fullName`)         |
| Tab السور                                  | `GET /quran/surahs` → `revelationType` `MAKKI`/`MADANI` for Kaaba vs mosque icons   |
| Tab الاجزاء                                | `GET /quran/juz` → `nameAr` / `nameEn`                                              |
| Tab المفضلة                                | `GET /quran/bookmarks` → `surah.nameAr`, `textAr`, `ayahNumber`                     |
| Mushaf page (السابق / رقم الصفحة / التالي) | `GET /quran/pages/:pageNumber` → `ayahs[]`, `surahs[]`, `page`, `juz` on each ayah  |
| Continuous surah scroll                    | `GET /quran/surahs/:id/ayahs?page&perPage` then next `surahId + 1`                  |
| Reader ⋮ sheet                             | `GET/PATCH /profile/reading-preferences`                                            |
| استكمال الختمة                             | `GET /quran/khatmah/stats` + CTA → `GET /quran/last-read` then `/quran/pages/:page` |

### 1) GET /quran/surahs — Tab "السور" (114 rows)

Authorization: **Public**.

Response Body (200 — icon-selection rule inline):

```json
{
  "success": true,
  "message": "Surahs retrieved successfully",
  "data": [
    {
      "id": 1,
      "nameEn": "Al-Fatihah",
      "nameAr": "الفاتحة",
      "revelationType": "MAKKI",
      "totalAyahs": 7,
      "totalPages": 1
    },
    {
      "id": 2,
      "nameEn": "Al-Baqarah",
      "nameAr": "البقرة",
      "revelationType": "MADANI",
      "totalAyahs": 286,
      "totalPages": 48
    },
    {
      "id": 3,
      "nameEn": "Aal-i-Imran",
      "nameAr": "آل عمران",
      "revelationType": "MADANI",
      "totalAyahs": 200,
      "totalPages": 20
    }
  ],
  "timestamp": "2026-08-21T09:00:00.000Z",
  "requestId": "a1b2c3d4-0500-aaaa-bbbb-000000000500"
}
```

Flutter icon rule: `revelationType === "MAKKI"` → 🕋 Kaaba icon (dark navy), `revelationType === "MADANI"` → 🟢 Qubbat al-Sakhra / green mosque icon. Do **NOT** fall back to a single generic Book icon — the UI design explicitly differentiates them.

---

### 2) GET /quran/surahs/:surahId — Surah metadata (name, ayah count, etc.)

Authorization: **Public**.

Example: `GET /quran/surahs/2` for البقرة.

Response Body (200):

```json
{
  "success": true,
  "message": "Surah retrieved successfully",
  "data": {
    "id": 2,
    "nameEn": "Al-Baqarah",
    "nameAr": "البقرة",
    "revelationType": "MADANI",
    "totalAyahs": 286,
    "totalPages": 48
  },
  "timestamp": "2026-08-21T09:01:00.000Z",
  "requestId": "a1b2c3d4-0501-aaaa-bbbb-000000000501"
}
```

Response Body (404 — surahId not in 1..114):

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Surah not found",
  "details": { "field": "surahId" },
  "timestamp": "2026-08-21T09:01:00.000Z",
  "requestId": "a1b2c3d4-0502-aaaa-bbbb-000000000502"
}
```

---

### 3) GET /quran/surahs/:surahId/ayahs — Paginated ayahs inside a Surah (alternative view to pages)

Authorization: **Public**.

Query Params (optional):

- `page` (int, default 1)
- `perPage` (int, default 20, max 200)

Example: `GET /quran/surahs/2/ayahs?page=11&perPage=3` → آيات 220..222 سورة البقرة.

Response Body (200 — `meta.pagination` present because it is paginated):

```json
{
  "success": true,
  "message": "Ayahs retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "surahId": 2,
      "ayahNumber": 220,
      "textAr": "فِي الدُّنْيَا وَالْآخِرَةِ...",
      "page": 35,
      "juz": 2
    },
    {
      "id": "uuid-2",
      "surahId": 2,
      "ayahNumber": 221,
      "textAr": "آيَاتِهِ لِلنَّاسِ لَعَلَّهُمْ يَتَذَكَّرُونَ...",
      "page": 35,
      "juz": 2
    },
    {
      "id": "uuid-3",
      "surahId": 2,
      "ayahNumber": 222,
      "textAr": "التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ",
      "page": 35,
      "juz": 2
    }
  ],
  "meta": {
    "pagination": { "total": 286, "page": 11, "pageSize": 3, "hasMore": true }
  },
  "timestamp": "2026-08-21T09:05:00.000Z",
  "requestId": "a1b2c3d4-0503-aaaa-bbbb-000000000503"
}
```

This endpoint is best for a per-surah scroll view. For the real Mushaf-style page reader (recommended per the Figma design, which shows "السابق 35 التالي") — use `/quran/pages/:pageNumber` below.

---

### 4) GET /quran/pages/:pageNumber — Physical Mushaf page reader (1..604 pages)

Authorization: **Public**.

This is the screen that matches the screenshots exactly (عنوان السورة → آيات → السابق / التالي navigation, with page number centered between them).

`:pageNumber` path param is an integer. Clamp it client-side before calling to the range `[1, 604]`.

Example: `GET /quran/pages/35`

Response Body (200):

```json
{
  "success": true,
  "message": "Quran page 35 retrieved successfully",
  "data": {
    "page": 35,
    "totalPages": 604,
    "ayahs": [
      {
        "id": "uuid-1",
        "surahId": 2,
        "ayahNumber": 220,
        "textAr": "فِي الدُّنْيَا وَالْآخِرَةِ وَيَسْأَلُونَكَ عَنِ الْيَتَامَىٰ...",
        "page": 35,
        "juz": 2
      },
      {
        "id": "uuid-2",
        "surahId": 2,
        "ayahNumber": 221,
        "textAr": "آيَاتِهِ لِلنَّاسِ لَعَلَّهُمْ يَتَذَكَّرُونَ وَيَسْأَلُونَكَ عَنِ الْمَحِيضِ...",
        "page": 35,
        "juz": 2
      },
      {
        "id": "uuid-3",
        "surahId": 2,
        "ayahNumber": 222,
        "textAr": "التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ",
        "page": 35,
        "juz": 2
      }
    ],
    "surahs": [
      {
        "id": 2,
        "nameEn": "Al-Baqarah",
        "nameAr": "البقرة",
        "revelationType": "MADANI"
      }
    ]
  },
  "timestamp": "2026-08-21T09:10:00.000Z",
  "requestId": "a1b2c3d4-0504-aaaa-bbbb-000000000504"
}
```

Notes for the Mushaf page-reader UI:

- Page number at **bottom center between buttons** = `data.page`.
- "السابق" button → call `GET /quran/pages/${max(1, page - 1)}`.
- "التالي" button → call `GET /quran/pages/${min(604, page + 1)}`.
- Top title (اسم السورة / اسم الجزء):
  - If `surahs.length === 1` → title = `surahs[0].nameAr`.
  - If `surahs.length === 2` (some pages straddle the end of one surah and start of the next) → show separator `---` / Bismillah graphic in the middle, then show `surahs[1].nameAr` below it — exactly like the second screenshot in your request (the one with البقرة + البقرة 2).
  - The Juz name ("الجزء الثاني") that appears above the page title comes from `ayahs[0].juz` → cross-reference with the Juz list (endpoint below) to fetch the Arabic label.
- **Dual counter rule (MANDATORY on every `التالي` / "next page" tap)**: When the user reads a full new page (or flips N pages forward in one go), call BOTH:
  1. `POST /journey/quran-pages/increment { pages: N }` (feeds the home daily card + streak).
  2. `PATCH /quran/khatmah/progress { pagesRead: N, currentPage: newPage, surahId: firstSurahIdOnNewPage }` (feeds the Khatmah stats screen).
     After both 200s, then `PUT /quran/last-read { surahId, page }` once to save the resume pointer. Skipping step 1 or step 2 makes the Home dashboard's `dailyJourney.quran.pagesRead` disagree with the استكمال الختمة screen's daily goal — you will get a bug report.

Response Body (400 — page out of range):

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Invalid Quran page. Page number must be between 1 and 604",
  "details": { "field": "pageNumber" },
  "timestamp": "2026-08-21T09:10:00.000Z",
  "requestId": "a1b2c3d4-0505-aaaa-bbbb-000000000505"
}
```

---

### 5) GET /quran/juz — Tab "الاجزاء" (30 rows, Arabic names match Figma exactly)

Authorization: **Public**.

Response Body (200 — first 13 rows exactly match the Figma list you shared):

```json
{
  "success": true,
  "message": "Juz list retrieved successfully",
  "data": [
    {
      "juzNumber": 1,
      "nameAr": "الجزء الأول",
      "nameEn": "Juz' 1",
      "totalAyahs": 148,
      "startPage": 1,
      "endPage": 22,
      "firstSurah": { "id": 1, "nameEn": "Al-Fatihah", "nameAr": "الفاتحة" }
    },
    {
      "juzNumber": 2,
      "nameAr": "الجزء الثاني",
      "nameEn": "Juz' 2",
      "totalAyahs": 148,
      "startPage": 23,
      "endPage": 44,
      "firstSurah": { "id": 2, "nameEn": "Al-Baqarah", "nameAr": "البقرة" }
    },
    {
      "juzNumber": 3,
      "nameAr": "الجزء الثالث",
      "nameEn": "Juz' 3",
      "totalAyahs": 148,
      "startPage": 45,
      "endPage": 63,
      "firstSurah": { "id": 2, "nameEn": "Al-Baqarah", "nameAr": "البقرة" }
    },
    {
      "juzNumber": 4,
      "nameAr": "الجزء الرابع",
      "nameEn": "Juz' 4",
      "totalAyahs": 148,
      "startPage": 64,
      "endPage": 81,
      "firstSurah": { "id": 3, "nameEn": "Aal-i-Imran", "nameAr": "آل عمران" }
    },
    {
      "juzNumber": 5,
      "nameAr": "الجزء الخامس",
      "nameEn": "Juz' 5",
      "totalAyahs": 148,
      "startPage": 82,
      "endPage": 101,
      "firstSurah": { "id": 4, "nameEn": "An-Nisa", "nameAr": "النساء" }
    },
    {
      "juzNumber": 6,
      "nameAr": "الجزء السادس",
      "nameEn": "Juz' 6",
      "totalAyahs": 148,
      "startPage": 102,
      "endPage": 120,
      "firstSurah": { "id": 5, "nameEn": "Al-Ma'idah", "nameAr": "المائدة" }
    },
    {
      "juzNumber": 7,
      "nameAr": "الجزء السابع",
      "nameEn": "Juz' 7",
      "totalAyahs": 148,
      "startPage": 121,
      "endPage": 141,
      "firstSurah": { "id": 6, "nameEn": "Al-An'am", "nameAr": "الأنعام" }
    },
    {
      "juzNumber": 8,
      "nameAr": "الجزء الثامن",
      "nameEn": "Juz' 8",
      "totalAyahs": 148,
      "startPage": 142,
      "endPage": 161,
      "firstSurah": { "id": 7, "nameEn": "Al-A'raf", "nameAr": "الأعراف" }
    },
    {
      "juzNumber": 9,
      "nameAr": "الجزء التاسع",
      "nameEn": "Juz' 9",
      "totalAyahs": 148,
      "startPage": 162,
      "endPage": 181,
      "firstSurah": { "id": 8, "nameEn": "Al-Anfal", "nameAr": "الأنفال" }
    },
    {
      "juzNumber": 10,
      "nameAr": "الجزء العاشر",
      "nameEn": "Juz' 10",
      "totalAyahs": 148,
      "startPage": 182,
      "endPage": 200,
      "firstSurah": { "id": 9, "nameEn": "At-Tawbah", "nameAr": "التوبة" }
    },
    {
      "juzNumber": 11,
      "nameAr": "الجزء الحادي عشر",
      "nameEn": "Juz' 11",
      "totalAyahs": 148,
      "startPage": 201,
      "endPage": 220,
      "firstSurah": { "id": 10, "nameEn": "Yunus", "nameAr": "يونس" }
    },
    {
      "juzNumber": 12,
      "nameAr": "الجزء الثاني عشر",
      "nameEn": "Juz' 12",
      "totalAyahs": 148,
      "startPage": 221,
      "endPage": 238,
      "firstSurah": { "id": 11, "nameEn": "Hud", "nameAr": "هود" }
    },
    {
      "juzNumber": 13,
      "nameAr": "الجزء الثالث عشر",
      "nameEn": "Juz' 13",
      "totalAyahs": 148,
      "startPage": 239,
      "endPage": 256,
      "firstSurah": { "id": 12, "nameEn": "Yusuf", "nameAr": "يوسف" }
    }
  ],
  "timestamp": "2026-08-21T09:15:00.000Z",
  "requestId": "a1b2c3d4-0510-aaaa-bbbb-000000000510"
}
```

The response returns all 30 Juz rows (not paginated — it is only 30 items). The Figma list stops at الجزء الثالث عشر for layout reasons; scroll in Flutter reveals Juz 14..30 automatically.

Typical tap flow: user taps Juz 2 → call `GET /quran/juz/2/surahs` to show the Surahs inside that Juz → user taps one → open `GET /quran/pages/${thatSurah.startPage}`.

---

### 6) GET /quran/juz/:juzNumber/surahs — Surahs that fall within a single Juz (1..30)

Authorization: **Public**.

Example: `GET /quran/juz/2/surahs`

Response Body (200):

```json
{
  "success": true,
  "message": "Juz 2 surahs retrieved successfully",
  "data": {
    "juzNumber": 2,
    "nameAr": "الجزء الثاني",
    "nameEn": "Juz' 2",
    "surahs": [
      {
        "id": 2,
        "nameEn": "Al-Baqarah",
        "nameAr": "البقرة",
        "revelationType": "MADANI",
        "totalAyahs": 286,
        "totalPages": 48,
        "fromAyah": 142,
        "toAyah": 252,
        "startPage": 22,
        "endPage": 41,
        "ayahsInJuz": 111
      }
    ]
  },
  "timestamp": "2026-08-21T09:16:00.000Z",
  "requestId": "a1b2c3d4-0511-aaaa-bbbb-000000000511"
}
```

---

### 7) Quran Bookmarks / Tab "المفضلة" (4 endpoints with inline `textAr`)

All require Bearer.

#### 7-A) GET /quran/bookmarks — Tab 1 "المفضلة" initial load

Response Body (200 — every bookmark has `textAr` populated so the preview card renders the actual verse without a second round-trip):

```json
{
  "success": true,
  "message": "Bookmarks retrieved successfully",
  "data": [
    {
      "id": "bm-uuid-1",
      "userId": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
      "surahId": 2,
      "ayahNumber": 221,
      "page": 35,
      "note": null,
      "textAr": "آيَاتِهِ لِلنَّاسِ لَعَلَّهُمْ يَتَذَكَّرُونَ وَيَسْأَلُونَكَ عَنِ الْمَحِيضِ فَقُلْ هُوَ أَذًى...",
      "surah": { "id": 2, "nameEn": "Al-Baqarah", "nameAr": "البقرة" },
      "createdAt": "2026-08-18T10:12:00.000Z"
    },
    {
      "id": "bm-uuid-2",
      "surahId": 3,
      "ayahNumber": 8,
      "page": 43,
      "note": "Dua for parents",
      "textAr": "رَبَّنَا لَا تُؤَاخِذْنِي إِن نَّسِيتُ أَوْ أَخْطَأْتُ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا...",
      "surah": { "id": 3, "nameEn": "Aal-i-Imran", "nameAr": "آل عمران" },
      "createdAt": "2026-08-19T11:00:00.000Z"
    }
  ],
  "timestamp": "2026-08-21T09:20:00.000Z",
  "requestId": "a1b2c3d4-0520-aaaa-bbbb-000000000520"
}
```

Flutter rendering for each card (matches your screenshots' first tab):

- Top-right heart icon → `♡` to `♥` (bookmarks are always favorited; the only bookmark-specific action is delete or edit note).
- Title row → `surah.nameAr` on one line.
- Body text → `textAr` (shows up to ~3 lines, `TextOverflow.ellipsis`).
- Bottom subline → `الاية {ayahNumber}` (small, muted).

The bookmark row may have `ayahNumber = null` if it was added for a full page rather than a specific verse; guard with `ayahNumber ?? ''` — in that case `textAr` also comes back as `null` so fall back to a placeholder `"صفحة رقم ${page}"`.

#### 7-B) POST /quran/bookmarks — Tap heart on an ayah (create a new bookmark)

Authorization: Bearer.

Request Body (must pass either `{surahId, ayahNumber}` **or** `{page}`, at least one):

```json
{ "surahId": 2, "ayahNumber": 221, "page": 35, "note": "Dua for parents" }
```

Response Body (201 — includes `textAr`):

```json
{
  "success": true,
  "message": "Bookmark added successfully",
  "data": {
    "id": "bm-uuid-new",
    "surahId": 2,
    "ayahNumber": 221,
    "page": 35,
    "note": "Dua for parents",
    "textAr": "آيَاتِهِ لِلنَّاسِ لَعَلَّهُمْ يَتَذَكَّرُونَ...",
    "surah": { "id": 2, "nameEn": "Al-Baqarah", "nameAr": "البقرة" },
    "createdAt": "2026-08-21T09:22:00.000Z"
  },
  "timestamp": "2026-08-21T09:22:00.000Z",
  "requestId": "a1b2c3d4-0521-aaaa-bbbb-000000000521"
}
```

Response Body (409 — duplicate bookmark — same user + same (surah,ayah) pair exists):

```json
{
  "success": false,
  "code": "CONFLICT",
  "message": "Bookmark already exists for this ayah",
  "details": { "field": "ayahNumber" },
  "timestamp": "2026-08-21T09:22:00.000Z",
  "requestId": "a1b2c3d4-0522-aaaa-bbbb-000000000522"
}
```

Flutter UX on 409: toggle the heart OFF and call `DELETE /quran/bookmarks/:id` instead (user is "un-bookmarking"). Or safer: always read the list first before creating.

#### 7-C) PATCH /quran/bookmarks/:bookmarkId — Edit note (swipe action → تعديل الملاحظة)

Authorization: Bearer.

Body: `{ "note": "اللهم تقبل منا" }`

Response Body (200): updated bookmark with `textAr` included.

#### 7-D) DELETE /quran/bookmarks/:bookmarkId — Swipe → حذف

Authorization: Bearer.

Response Body (200):

```json
{
  "success": true,
  "message": "Bookmark deleted successfully",
  "data": null,
  "timestamp": "2026-08-21T09:25:00.000Z",
  "requestId": "a1b2c3d4-0523-aaaa-bbbb-000000000523"
}
```

If another user's bookmark ID is used → 404 "Bookmark not found" (never returns 403 to avoid leaking that the ID even exists).

---

### 8) Last Read / Resume pointer (2 endpoints — saves one tap to resume the exact page)

Both require Bearer.

#### 8-A) GET /quran/last-read — "Continue where you left off" card in home / CTA in استكمال الختمة screen

Response Body (200 — with `surah` so the hero card shows سورة البقرة صفحة 35):

```json
{
  "success": true,
  "message": "Last read position retrieved successfully",
  "data": {
    "id": "lr-uuid-1",
    "userId": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
    "surahId": 2,
    "ayahNumber": 221,
    "page": 35,
    "juz": 2,
    "updatedAt": "2026-08-21T08:59:00.000Z",
    "surah": { "id": 2, "nameEn": "Al-Baqarah", "nameAr": "البقرة" }
  },
  "timestamp": "2026-08-21T09:30:00.000Z",
  "requestId": "a1b2c3d4-0530-aaaa-bbbb-000000000530"
}
```

If the user has **never** opened Quran yet → returns 200 with `data = null` explicitly (not an error). In that case show CTA `"ابدأ قراءتك الأولى من سورة الفاتحة"` → navigate to page 1.

#### 8-B) PUT /quran/last-read — Persist position (call after the dual-counter rule on every page flip)

Request Body:

```json
{ "surahId": 2, "ayahNumber": 221, "page": 35 }
```

This is idempotent PUT (always overwrites). Required: `surahId` + `page`. Optional: `ayahNumber` (defaults to `1` if omitted). Response Body (200): same expanded shape as GET.

---

### 8-C) GET / POST /quran/reading-history — Session log (optional; not a Figma tab)

Authorization: Bearer.

`GET /quran/reading-history?page=1&limit=20` returns paginated `{ id, surahId, ayahFrom, ayahTo, readAt }` with `meta` = `{ page, limit, total, totalPages, hasNextPage, hasPreviousPage }`.

`POST /quran/reading-history` body: `{ "surahId": 2, "fromAyah": 220, "toAyah": 222, "pagesRead": 35 }`. `pagesRead` here is the Mushaf page used to also upsert last-read. `fromAyah` / `toAyah` default to 1 if omitted.

---

### 9) Khatmah tracker (4 endpoints — "استكمال الختمة" screen)

All 4 require Bearer.

#### 9-A) GET /quran/khatmah — Core khatmah pointer (what surah/page I'm on now). This is what the Home dashboard `khatmah` widget mirrors.

Response Body (200):

```json
{
  "success": true,
  "message": "Khatmah progress retrieved successfully",
  "data": {
    "surahId": 2,
    "surahNameEn": "Al-Baqarah",
    "surahNameAr": "البقرة",
    "currentPage": 35,
    "totalPagesRead": 258,
    "progressPercent": 43
  },
  "timestamp": "2026-08-21T09:40:00.000Z",
  "requestId": "a1b2c3d4-0540-aaaa-bbbb-000000000540"
}
```

`progressPercent = round(totalPagesRead * 100 / 604)`. A full Quran (604 pages read) returns `progressPercent = 100`.

The first `GET /quran/khatmah` **auto-creates** a row at Surah 2 / page 1 if none exists — it never returns `data = null`. Flutter can always paint the استكمال الختمة hero from this payload. `PATCH /quran/khatmah/progress { pagesRead: 1, currentPage: 1, surahId: 2 }` is still the correct first-page write.

#### 9-B) PATCH /quran/khatmah/progress — Advance khatmah progress / update resume pointer (call together with Journey increment)

Request Body:

```json
{ "surahId": 2, "currentPage": 37, "pagesRead": 2 }
```

Semantics: `pagesRead` is the **delta** to add to `totalPagesRead` (not the new absolute total). `currentPage` and `surahId` replace the pointer values.

Response Body (200): updated Khatmah shape, same as GET. After every call the backend internally recomputes `progressPercent` → `completedKhatmahCount = floor(totalPagesRead/604)` (used by stats endpoint next).

#### 9-C) ⭐ GET /quran/khatmah/stats — The **استكمال الختمة screen** endpoint (Hero + Daily goal circle + 3 stat cards + CTA)

Response Body (200 — **matches Figma 1:1**):

```json
{
  "success": true,
  "message": "Khatmah with stats retrieved successfully",
  "data": {
    "surahId": 2,
    "surahNameEn": "Al-Baqarah",
    "surahNameAr": "البقرة",
    "currentPage": 35,
    "totalPagesRead": 258,
    "progressPercent": 43,

    "dailyGoal": {
      "pagesTarget": 5,
      "pagesReadToday": 4,
      "completed": false,
      "remainingToday": 1
    },

    "stats": {
      "streakDays": 12,
      "completedKhatmahCount": 0,
      "totalPagesRead": 258
    }
  },
  "timestamp": "2026-08-21T09:45:00.000Z",
  "requestId": "a1b2c3d4-0541-aaaa-bbbb-000000000541"
}
```

Exact screen ↔ JSON mapping:
| Widget in Figma | JSON key |
| --- | --- |
| Hero title "سورة البقرة" | `surahNameAr` |
| Hero subtitle "صفحة 35" | `currentPage` |
| Hero progress bar | `progressPercent / 100` |
| Green circular indicator "4 / 5 صفحات" (هدف اليوم) | `dailyGoal.pagesReadToday / dailyGoal.pagesTarget` |
| Helper "تبقي صفحة واحدة لكمال هدف اليوم" | `if dailyGoal.remainingToday > 1 → "تبقي X صفحات" else "تبقي صفحة واحدة"` |
| Card: ايام متتالية 12 يوم | `stats.streakDays` |
| Card: الختمات 3 (placeholder in Figma) | `stats.completedKhatmahCount` |
| Card: اجمالي الصفحات 258 | `stats.totalPagesRead` |
| CTA "متابعة القراءة" | onPress → read `GET /quran/last-read`, if null → `page = data.currentPage`, then navigate to Mushaf page reader → `GET /quran/pages/${page}`. |

The default daily goal is 5 pages (hardcoded server-side today as `5`; do not derive from env). When `dailyGoal.pagesReadToday >= dailyGoal.pagesTarget` the server flips `completed = true`. The "هدف اليوم" circle then shows "5 / 5" with 100% green and a check-mark helper `"أحسنت! لقد أكملت هدف اليوم 🎉"`.

Where each stat actually comes from (so you know which endpoint updates what when debugging):

- `dailyGoal.pagesReadToday` → `JourneyDailyRecord.quranPagesRead` for today's row (so if Journey increment is missing, the circle stays stale — enforce the dual-counter rule).
- `stats.streakDays` → rolling window computed by Journey service.
- `stats.completedKhatmahCount` → `floor(Khatmah.totalPagesRead / 604)`.
- `stats.totalPagesRead` → `Khatmah.totalPagesRead` (same as dashboard widget).

#### 9-D) POST /quran/khatmah/reset — "بدء ختمة جديدة" after completing 604 pages

Authorization: Bearer.

Soft behaviour: keeps historical data, zeroes pointer back to page 1 / surah 1 and resets `totalPagesRead` to start a new khatmah cycle.

Response Body (200): core khatmah shape plus `"reset": true`. Call `GET /quran/khatmah/stats` afterwards if you need the dailyGoal / stats cards again.

---

### 10) GET /quran/search?q=الرحمن — Full-text Quran search

Authorization: **Public**.

Query: `q` required; `page` optional (default 1); `limit` optional (default 20, max 200).

Example: `GET /quran/search?q=الرحمن&limit=20`

Response Body (200) — `data` is an **object**, not an array:

```json
{
  "success": true,
  "message": "Quran search for \"الرحمن\" completed (45 matches)",
  "data": {
    "query": "الرحمن",
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "results": [
      {
        "id": "uuid",
        "surahId": 1,
        "ayahNumber": 3,
        "textAr": "الرَّحْمَٰنِ الرَّحِيمِ",
        "page": 1,
        "juz": 1,
        "surah": {
          "id": 1,
          "nameAr": "الفاتحة",
          "nameEn": "Al-Fatihah",
          "revelationType": "MAKKI"
        }
      }
    ]
  },
  "timestamp": "2026-08-21T09:50:00.000Z",
  "requestId": "a1b2c3d4-0550-aaaa-bbbb-000000000550"
}
```

Tap a result → navigate to Mushaf reader for `page = result.page`.

Empty results → 200 with `data.results = []` and `data.total = 0` (never 404). Show "لا توجد نتائج للبحث".

---

### 11) GET /quran/ayahs/random — Random ayah widget (placeholder usage)

Authorization: **Public**.

Response Body (200) — nested `ayah` + `surah`:

```json
{
  "success": true,
  "message": "Random ayah from الرحمن:1 retrieved successfully",
  "data": {
    "ayah": {
      "id": "uuid",
      "surahId": 55,
      "ayahNumber": 1,
      "textAr": "الرَّحْمَٰنُ عَلَّمَ الْقُرْآنَ",
      "page": 531,
      "juz": 27
    },
    "surah": {
      "id": 55,
      "nameAr": "الرحمن",
      "nameEn": "Ar-Rahman",
      "totalAyahs": 78,
      "revelationType": "MADANI"
    }
  },
  "timestamp": "2026-08-21T09:55:00.000Z",
  "requestId": "a1b2c3d4-0551-aaaa-bbbb-000000000551"
}
```

---

## 🔹 Daily Journey tracker (6 endpoints — Home daily widgets + streak)

All require Bearer. This module owns today's "ماذا أنجزت اليوم؟" progress bar and the daily rolling numbers. The dual-counter rule is critical — the Quran page flip triggers BOTH `/journey/quran-pages/increment` AND `/quran/khatmah/progress` (see page-reader section above).

### 1) GET /journey/today — Full today view

Response Body (200 — **this is not the same shape as dashboard `dailyJourney`**):

```json
{
  "success": true,
  "message": "Daily journey retrieved successfully",
  "data": {
    "quranPagesRead": 4,
    "adhkarCompleted": true,
    "sadaqahAmount": 0
  },
  "timestamp": "2026-08-21T10:00:00.000Z",
  "requestId": "a1b2c3d4-0600-aaaa-bbbb-000000000600"
}
```

Home screen prayer/quran/adhkar/sadaqah cards should prefer `GET /dashboard` (`data.dailyJourney`). Use `/journey/today` only when you need today's raw counters.

### 2) GET /journey/progress — Rolling history (`?days=7` default)

Response Body (200):

```json
{
  "success": true,
  "message": "Journey progress retrieved successfully",
  "data": {
    "periodDays": 7,
    "records": [
      {
        "date": "2026-08-15",
        "quranPagesRead": 5,
        "adhkarCompleted": true,
        "sadaqahAmount": 0
      },
      {
        "date": "2026-08-21",
        "quranPagesRead": 4,
        "adhkarCompleted": true,
        "sadaqahAmount": 0
      }
    ],
    "summary": {
      "totalQuranPages": 34,
      "adhkarDaysCompleted": 6,
      "totalSadaqah": 0
    }
  },
  "timestamp": "2026-08-21T10:01:00.000Z",
  "requestId": "a1b2c3d4-0601-aaaa-bbbb-000000000601"
}
```

Render a bar chart from `records` using `quranPagesRead` as the primary series. Streak days for the Khatmah screen come from `GET /quran/khatmah/stats` (`stats.streakDays`), not from this payload.

### 3) PATCH /journey/quran-pages — Explicit set (used when user selects from a date picker or corrects a mistake)

Body: `{ "pages": 6 }` → sets today's pages to **exactly** 6. Response 200: `{ "quranPagesRead": 6 }`.

### 4) POST /journey/quran-pages/increment — The one you call on every page flip + dual-counter rule

Body (optional, omit to default `pages = 1`):

```json
{ "pages": 2 }
```

Response Body (200): `{ "quranPagesRead": 6 }` (new daily total). Re-fetch `/dashboard` or `/quran/khatmah/stats` to refresh Home / Khatmah UI.

This is the **only endpoint** that bumps `dailyGoal.pagesReadToday` shown in the Khatmah stats circular indicator. Do not rely on the Khatmah module for daily totals.

### 5) PATCH /journey/adhkar — Toggle "أذكار اليوم" completed

Body: `{ "completed": true }`. Response 200: `{ "adhkarCompleted": true }`.

### 6) PATCH /journey/sadaqah — Record sadaqah amount (optional)

Body: `{ "amount": 50 }`. Response 200: `{ "sadaqahAmount": 50 }`.

---

## 🔹 My Qibla (authenticated variant — uses saved location)

### 1) GET /qibla/my-qibla — Compute Qibla from the User's saved latitude/longitude (no query params needed)

Authorization: Bearer.

This endpoint exists specifically for the flow "user updates location once (`PUT /profile/location`) → forever after Qibla loads without Flutter needing to request GPS permission repeatedly." It reads the `user.latitude` / `user.longitude` saved in the DB and uses the same math engine as the public `/qibla/calculate`.

Response Body (200) — **exact same shape as `/qibla/calculate`** so your Dart `QiblaResult` model deserializes both:

```json
{
  "success": true,
  "message": "Qibla bearing computed from saved location",
  "data": {
    "bearingDegrees": 215.67,
    "bearingRadians": 3.764,
    "directionAr": "الجنوب الغربي",
    "distanceKm": 1246.35,
    "kaaba": { "latitude": 21.4225, "longitude": 39.8262 },
    "userLocation": { "latitude": 30.0444, "longitude": 31.2357 }
  },
  "timestamp": "2026-08-21T10:05:00.000Z",
  "requestId": "a1b2c3d4-0700-aaaa-bbbb-000000000700"
}
```

400 if location is not saved yet (`details.field = "latitude"`). UX rule for Flutter: always first try `/qibla/my-qibla`. If it 400s → fall back to the public `/qibla/calculate?lat=&lng=` live-GPS path. If GPS permission is also denied → show "افعل صلاحيات الموقع من الإعدادات" placeholder.

---

## 🔹 Challenges module (5 endpoints — Daily Challenge card + Challenges tab)

All require Bearer.

### 1) GET /challenges/today — Home `dailyChallenge` widget (mirror of what dashboard already includes)

Useful when the user dismisses Home and returns directly to the Challenges bottom-nav to claim today's reward.

Response Body (200):

```json
{
  "success": true,
  "message": "Today's challenge loaded",
  "data": {
    "id": "ch-uuid-1",
    "titleAr": "اقرأ 5 صفحات من القرآن",
    "descriptionAr": "اقرأ 5 صفحات من القرآن الكريم اليوم للحصول على 50 نقطة",
    "rewardPoints": 50,
    "targetValue": 5,
    "completed": false,
    "claimed": false
  },
  "timestamp": "2026-08-21T10:10:00.000Z",
  "requestId": "a1b2c3d4-0800-aaaa-bbbb-000000000800"
}
```

Rule: Dashboard's `dailyChallenge` section and this endpoint return the same struct — pick one source of truth, don't merge them. For consistency prefer Dashboard for Home initial screen, refresh Challenges tab with this endpoint.

### 2) POST /challenges/today/claim — "استلم النقاط" button on the daily card

Empty body. Response 201 (created, points added):

```json
{
  "success": true,
  "message": "Today's challenge reward claimed",
  "data": { "challengeId": "ch-uuid-1", "pointsAwarded": 50, "claimed": true },
  "timestamp": "2026-08-21T10:11:00.000Z",
  "requestId": "a1b2c3d4-0801-aaaa-bbbb-000000000801"
}
```

409 if already claimed (details.field = "challengeId"). Disable the button visually on `claimed = true` to avoid the round trip.

403 if the challenge is not completed yet (`completed = false`). Show a SnackBar: `"أكمل الهدف أولاً ثم استلم النقاط 🎯"`.

### 3) GET /challenges — Challenges list (Challenges bottom nav)

Paginated? Today backend returns all active challenges in a single array.

Response Body (200): `data = [ {id, titleAr, descriptionAr, rewardPoints, targetValue, completed, claimed} ]`.

### 4) GET /challenges/:id — Individual challenge detail screen

Response 200 same shape; 404 for unknown IDs.

### 5) POST /challenges/:id/claim — Claim a specific (non-today) challenge by ID.

Same 201 / 403 / 409 semantics as today's claim.

---

## 🔹 Notifications module (7 endpoints — "الاشعارات" bell)

All require Bearer.

| #   | Route                         | Method | Purpose                                               |
| --- | ----------------------------- | ------ | ----------------------------------------------------- |
| 1   | `/notifications`              | GET    | List notifications (paginated via `meta.pagination`). |
| 2   | `/notifications/unread-count` | GET    | Unread badge for the bell icon.                       |
| 3   | `/notifications/:id/read`     | PATCH  | Mark single notification as read.                     |
| 4   | `/notifications/read-all`     | PATCH  | "قراءة الكل" button.                                  |
| 5   | `/notifications/:id`          | GET    | Open one notification + mark read atomically.         |
| 6   | `/notifications/:id`          | DELETE | Swipe delete.                                         |

Typical shapes:

- Unread count (200): `data = { unread: 4 }`
- Notifications list (200): `data = [ { id, type, titleAr, bodyAr, isRead, createdAt, relatedEntityType, relatedEntityId } ]`
- Mark read (200): `data = { id, isRead: true }`
- Read all (200): `data = { marked: 4 }`
- Delete (200): `data = { id, deleted: true }`

Badge update rule: after `markAsRead` or `markAllAsRead` 200, immediately call `/notifications/unread-count` to keep the bell counter in sync.

---

## 🔹 Route Endpoint Index (quick jump for 2026 AI Flutter generators)

| #   | Route                            | Method | Auth | Screen / module                                                                                         |
| --- | -------------------------------- | ------ | ---- | ------------------------------------------------------------------------------------------------------- |
| 1   | `/auth/sign-up`                  | POST   | No   | Sign-Up screen "إنشاء حساب جديد"                                                                        |
| 2   | `/auth/login`                    | POST   | No   | Login screen "تسجيل الدخول"                                                                             |
| 3   | `/auth/google`                   | POST   | No   | Google button (both screens) — must send `idToken` JWT from `google_sign_in` SDK, never Firebase `uid`  |
| 4   | `/auth/google/url`               | GET    | No   | Web-only Google OAuth redirect URL (Flutter apps **ignore** this one)                                   |
| 5   | `/auth/forgot-password`          | POST   | No   | Forgot password email request                                                                           |
| 6   | `/auth/reset-password`           | POST   | No   | Reset password submit with token from email                                                             |
| 7   | `/auth/refresh`                  | POST   | No   | Token rotation (background / 401 retry flow)                                                            |
| 8   | `/auth/logout`                   | POST   | No   | Sign-out button (revokes refresh token server-side)                                                     |
| 9   | `/auth/me`                       | GET    | Yes  | Verify session / refresh cached AuthUserProfile                                                         |
| 10  | `/dashboard`                     | GET    | Yes  | Home / Dashboard — single-source-of-truth GET (8 widgets)                                               |
| 11  | `/profile/me`                    | GET    | Yes  | Profile screen "حسابي" initial card load                                                                |
| 12  | `/profile/update`                | PATCH  | Yes  | Profile edit: fullName / timezone (partial)                                                             |
| 13  | `/profile/change-password`       | PATCH  | Yes  | LOCAL users only: change password form                                                                  |
| 14  | `/profile/location`              | PUT    | Yes  | Save GPS + timezone (replaces; then `/qibla/my-qibla` works)                                            |
| 15  | `/profile/reading-preferences`   | GET    | Yes  | Quran Reader settings bottom sheet: AA / 🎧 / ✍️ / 🌐                                                   |
| 16  | `/profile/reading-preferences`   | PATCH  | Yes  | Apply new font size / reciter / tafsir / translation                                                    |
| 17  | `/tasbih/today`                  | GET    | Yes  | Tasbih screen initial load                                                                              |
| 18  | `/tasbih/history`                | GET    | Yes  | Tasbih daily history (bottom sheet / log view)                                                          |
| 19  | `/tasbih/increment`              | POST   | Yes  | Tasbih circle tap (+1 or custom amount)                                                                 |
| 20  | `/tasbih/reset`                  | POST   | Yes  | Tasbih reset button (zeros TODAY counter)                                                               |
| 21  | `/tasbih/change-dhikr`           | PATCH  | Yes  | Tasbih change-dhikr bottom sheet                                                                        |
| 22  | `/qibla/calculate`               | GET    | No   | Qibla / Compass screen (public, takes GPS via query)                                                    |
| 23  | `/qibla/my-qibla`                | GET    | Yes  | Qibla using stored `user.latitude/longitude` (no GPS needed)                                            |
| 24  | `/quran/surahs`                  | GET    | No   | Quran Main Tab 2 "السور" 114 rows (MAKKI/MADANI icons)                                                  |
| 25  | `/quran/surahs/:surahId`         | GET    | No   | Single surah metadata                                                                                   |
| 26  | `/quran/surahs/:surahId/ayahs`   | GET    | No   | Ayahs in a Surah, paginated                                                                             |
| 27  | `/quran/pages/:pageNumber`       | GET    | No   | **Mushaf page reader 1..604** (السابق / التالي)                                                         |
| 28  | `/quran/juz`                     | GET    | No   | Quran Main Tab 3 "الاجزاء" 30 rows (Arabic names)                                                       |
| 29  | `/quran/juz/:juzNumber/surahs`   | GET    | No   | List of Surahs inside a Juz (tap Juz → list of Surahs)                                                  |
| 30  | `/quran/reading-history`         | GET    | Yes  | Paginated reading-session log                                                                           |
| 31  | `/quran/reading-history`         | POST   | Yes  | Record a reading session (also upserts last-read)                                                       |
| 32  | `/quran/bookmarks`               | GET    | Yes  | Quran Main Tab 1 "المفضلة" (with inline `textAr` preview)                                               |
| 33  | `/quran/bookmarks`               | POST   | Yes  | Bookmark a new ayah/page (duplicate returns 409)                                                        |
| 34  | `/quran/bookmarks/:bookmarkId`   | PATCH  | Yes  | Edit bookmark note                                                                                      |
| 35  | `/quran/bookmarks/:bookmarkId`   | DELETE | Yes  | Remove bookmark (swipe-to-delete)                                                                       |
| 36  | `/quran/last-read`               | GET    | Yes  | "استكمال الختمة" CTA "متابعة القراءة" resume pointer                                                    |
| 37  | `/quran/last-read`               | PUT    | Yes  | Save resume pointer (call after page flip)                                                              |
| 38  | `/quran/khatmah`                 | GET    | Yes  | Core khatmah pointer + `progressPercent`                                                                |
| 39  | `/quran/khatmah/progress`        | PATCH  | Yes  | Advance khatmah (delta pages + update currentPage/surahId) — call with `/journey/quran-pages/increment` |
| 40  | `/quran/khatmah/stats`           | GET    | Yes  | **⭐ استكمال الختمة screen full payload** (Hero + dailyGoal + stats)                                    |
| 41  | `/quran/khatmah/reset`           | POST   | Yes  | Start a fresh khatmah cycle (zeroes pointer)                                                            |
| 42  | `/quran/search`                  | GET    | No   | Full-text Quran search `?q=الرحمن&limit=20` (`data.results`)                                            |
| 43  | `/quran/ayahs/random`            | GET    | No   | Random ayah widget (`data.ayah` + `data.surah`)                                                         |
| 44  | `/journey/today`                 | GET    | Yes  | Today's raw counters `{ quranPagesRead, adhkarCompleted, sadaqahAmount }`                               |
| 45  | `/journey/progress`              | GET    | Yes  | History `records[]` + `summary` (`?days=7`)                                                             |
| 46  | `/journey/quran-pages`           | PATCH  | Yes  | Explicit set today's quran pages value (correction flow)                                                |
| 47  | `/journey/quran-pages/increment` | POST   | Yes  | +N pages for today (call AFTER every Mushaf page flip)                                                  |
| 48  | `/journey/adhkar`                | PATCH  | Yes  | Toggle "أذكار اليوم" complete                                                                           |
| 49  | `/journey/sadaqah`               | PATCH  | Yes  | Record "صدقة" amount for today                                                                          |
| 50  | `/challenges`                    | GET    | Yes  | Challenges list screen (bottom nav "التحديات")                                                          |
| 51  | `/challenges/today`              | GET    | Yes  | Home daily challenge widget refresh                                                                     |
| 52  | `/challenges/today/claim`        | POST   | Yes  | Claim today's reward points button                                                                      |
| 53  | `/challenges/:id`                | GET    | Yes  | Challenge detail screen                                                                                 |
| 54  | `/challenges/:id/claim`          | POST   | Yes  | Claim reward for specific challenge by id                                                               |
| 55  | `/notifications`                 | GET    | Yes  | Notifications list screen (paginated)                                                                   |
| 56  | `/notifications/unread-count`    | GET    | Yes  | Bell badge unread counter                                                                               |
| 57  | `/notifications/:id/read`        | PATCH  | Yes  | Mark a single notification as read (swipe action)                                                       |
| 58  | `/notifications/read-all`        | PATCH  | Yes  | "قراءة الكل" button                                                                                     |
| 59  | `/notifications/:id`             | GET    | Yes  | Open single notification + mark read atomically                                                         |
| 60  | `/notifications/:id`             | DELETE | Yes  | Delete single notification                                                                              |
| 61  | `/prayers/today`                 | GET    | Yes  | Today's prayer times + completion flags                                                                 |
| 62  | `/prayers/:id/mark`              | PATCH  | Yes  | Toggle FAJR/DHUHR/ASR/MAGHRIB/ISHA completed                                                            |
| 63  | `/prayers/schedule`              | GET    | No   | Public prayer schedule by lat/lng                                                                       |
| 64  | `/content/verse-of-day`          | GET    | No   | Standalone verse-of-day (also inside dashboard)                                                         |
| 65  | `/content/hadith-of-day`         | GET    | No   | Standalone hadith-of-day                                                                                |
| 66  | `/content/daily-challenge`       | GET    | No   | Standalone daily-challenge template                                                                     |
| 67  | `/health`                        | GET    | No   | Liveness + database ping                                                                                |

---

## 🔹 Notes for Flutter Implementation

### 1) Dashboard refresh strategy

- Call `GET /dashboard` once on the authenticated `HomeScreen` `initState`.
- Subscribe to `WidgetsBindingObserver.didChangeAppLifecycleState(AppLifecycleState.resumed)` and re-fetch `/dashboard` one time whenever the app returns from the background (this picks up any server-side progression for new-day rollover, next-prayer switch, etc.).
- Do **not** attach `/dashboard` to a `PullToRefresh` alone; relying solely on pull-to-refresh means users whose app is in the foreground for >15 minutes see a stale prayer countdown. Combine pull-to-refresh with the lifecycle hook above.

### 2) Tasbih two-counter contract

`todayCount` (top-right) and `currentDhikrCount` (inside circle) must live in **separate** state atoms / ValueNotifiers. Never compute one from the other. A "change dhikr" event only touches the inner-counter atom; the global total atom must be left untouched.

### 3) Offline behaviour

These endpoints are **not** offline-first. Cache responses for display during offline, but do **not** allow submitting prayer completions / tasbih increments offline and syncing later — the server enforces ordering, daily windows and uniqueness. Show a small "You are offline" banner on the relevant screens and gray out submit buttons while the device reports `ConnectivityResult.none`.

### 4) Error handling — code over message

Never branch on `response.message` (it's translated / can change). On error responses branch on `response.code` (`VALIDATION_ERROR`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`). Use `message` only for human-facing `SnackBar`s / helper text. `code` is only present when `success = false`; successful responses do not include a `code` key.

### 5) Nullable sections

Dashboard `verseOfTheDay`, `hadithOfTheDay`, and `dailyChallenge` may be JSON `null` if not seeded. `GET /quran/last-read` returns `data = null` when the user has never opened the Mushaf. `GET /quran/khatmah` **never** returns null (it auto-creates Al-Baqarah page 1). Use Dart null-aware operators so first-launch render does not throw.

### 6) Swagger UI is always the ground truth

If there is a discrepancy between this guide and the live Swagger spec at `<base>/api/v1/docs`, trust the Swagger. This guide is a portable Flutter reference; the Swagger spec is generated from the source code and redeployed with every backend release.

### 7) Dual-page counter (Khatmah + Journey)

When the user finishes `N` new Mushaf pages, Flutter MUST fire **two** writes, then last-read:

1. `POST /journey/quran-pages/increment` `{ "pages": N }` — updates today's `quranPagesRead` (Home daily card + Khatmah `dailyGoal.pagesReadToday`).
2. `PATCH /quran/khatmah/progress` `{ "surahId", "currentPage", "pagesRead": N }` — updates lifetime `totalPagesRead` and the current pointer.
3. `PUT /quran/last-read` `{ "surahId", "page" }` — resume pointer for "متابعة القراءة".

Skipping (1) desyncs Home vs the circular daily goal. Skipping (2) desyncs the lifetime bar / total pages / completed-khatmah count.

### 8) Counter rule (do not double-count)

- Count **net new pages** only (35 → 37 is `N = 2`, not `N = 37`).
- Debounce page flips: wait until the user leaves the page or after a short idle, then send one increment for the session delta.
- `PATCH /journey/quran-pages` **sets** the absolute daily total. Use it only for corrections. The page-reader flow must use **increment**, not set.
- `pagesRead` on khatmah progress is a **delta**, not an absolute total.
- Do not call increment on "السابق" (going backwards).

### 9) Reading Preferences (reader overflow ⋮ sheet)

The 4-row sheet (حجم الخط / الاستماع / التفسير / الترجمة) is `GET/PATCH /profile/reading-preferences`:

| UI row      | Field              | Default               | Notes                                                    |
| ----------- | ------------------ | --------------------- | -------------------------------------------------------- |
| حجم الخط AA | `quranFontSize`    | `28` (range 12..60)   | Apply locally as font size in px.                        |
| الاستماع 🎧 | `quranReciter`     | `Mishary_Alafasy`     | **Slug only.** Backend does not stream audio files.      |
| التفسير ✍️  | `quranTafsir`      | `Ibn_Kathir`          | **Slug only.** Backend does not return tafsir text.      |
| الترجمة 🌐  | `quranTranslation` | `Sahih_International` | **Slug only.** Backend does not return translation text. |

Dropdown option lists live in Flutter. Persist every change with a partial PATCH so a second device picks up the same settings.

### 10) Last-read (متابعة القراءة)

- `GET /quran/last-read` → `data = null` until the first PUT. Fallback: `GET /quran/khatmah` → `currentPage`.
- `PUT /quran/last-read` requires `surahId` + `page`. `ayahNumber` defaults to `1`.
- Last-read is **not** the daily counter and **not** khatmah lifetime progress. It is only the resume pointer for the CTA and the reader restore.
- After a successful dual-counter write, PUT last-read once with the page currently on screen.
