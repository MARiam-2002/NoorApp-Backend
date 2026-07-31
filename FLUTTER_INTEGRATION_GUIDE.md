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

### Change Totals

- New endpoint documentation entries: 2
- Updated documentation entries: 10
- Removed documentation entries: 0

---

## 🔹 API Integration Summary

- **Base URLs (store these in `env` / flavors)**:
  - Production (Vercel): `https://noor-app-backend-one.vercel.app/api/v1`
  - Local dev: `http://localhost:3000/api/v1`
  - Swagger UI (always the source of truth): `<base>/api/v1/docs`
- **Auth pattern**: Every endpoint below is `Authorization: Bearer <accessToken>` **except** the ones explicitly marked `Public`.
- **Response envelope**: Every response uses the same wrapper so Flutter can deserialize with one generic model: `{ success, message?, data, meta?, timestamp, requestId }` for 2xx, plus `{ code, details? }` for 4xx/5xx.
- **Auth endpoints (6 total)**: `POST /auth/sign-up` creates a local account; `POST /auth/login` returns the token pair; `POST /auth/google` exchanges a Google ID token; `POST /auth/refresh` rotates the access token; `POST /auth/logout` revokes the refresh token server-side; `GET /auth/me` returns the current user profile from the Bearer token.
- **Main screens covered (8 states)**:
  1. Sign-Up screen (3 fields only: fullName, email, password; username is server-generated).
  2. Login screen (email, password + Google button).
  3. Home / Dashboard (one GET, returns all 8 widgets in one call).
  4. Tasbih / Digital Counter (4 endpoints, 3 visible states).
  5. Qibla / Compass (one public GET, takes GPS coordinates, returns bearing + direction).
- **No endpoints were removed in this revision of the integration guide**.

### Integration Totals

| Area                                    | Count                                               |
| --------------------------------------- | --------------------------------------------------- |
| Screens / UI states documented          | 8                                                   |
| Endpoints covered                       | 12                                                  |
| Authenticated endpoints (Bearer)        | 6 (/auth/me, dashboard, 4 × tasbih)                 |
| Public (no Bearer) endpoints            | 6 (sign-up, login, google, refresh, logout, qibla)  |
| HTTP statuses covered (success + error) | 200 / 201 / 400 / 401 / 403 / 404 / 409 / 500 / 503 |

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

```json
{
  "success": false,
  "message": "Human-readable error description (Arabic)",
  "code": "VALIDATION_ERROR | CONFLICT | UNAUTHORIZED | NOT_FOUND | INTERNAL_SERVER_ERROR | FORBIDDEN",
  "details": null,
  "timestamp": "2026-07-31T07:15:00.000Z",
  "requestId": "a1b2c3d4-5678-90ef-ghij-klmnopqrstuv"
}
```

Notes:

- `success = false` always means the HTTP status is 4xx or 5xx.
- On error, `code` is the stable error identifier (branch on it, not on `message`). `details.field` (when present) tells you which TextField to underline red.
- On pagination endpoints, `meta` contains `{ total, page, pageSize, hasMore }` and is always a JSON object (never omitted).
- `requestId` is always present (a UUID v4) and can be sent to backend support to trace the exact failing request in server logs.

### 3) Dart quick-start (generic client)

```dart
// dependencies: dio, flutter_secure_storage
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class NoorApi {
  final _dio = Dio(BaseOptions(
    baseUrl: const String.fromEnvironment('NOOR_BASE_URL',
        defaultValue: 'https://noor-app-backend-one.vercel.app/api/v1'),
    connectTimeout: const Duration(seconds: 15),
  ));
  final _store = const FlutterSecureStorage();

  Future<void> _injectAuth(RequestOptions o) async {
    final t = await _store.read(key: 'accessToken');
    if (t != null) o.headers['Authorization'] = 'Bearer $t';
  }

  Future<Map<String, dynamic>> request(
    String method, String path, { Object? data, Map<String, dynamic>? query }) async {
    try {
      final resp = await _dio.request(path,
        options: Options(method: method),
        data: data,
        queryParameters: query,
        onReceiveProgress: null,
        // ↓ wrap with _injectAuth via interceptor in a real app:
      );
      return resp.data as Map<String, dynamic>;
    } on DioException catch (e) {
      final body = e.response?.data as Map<String, dynamic>?;
      if (body?['code'] == 'UNAUTHORIZED') {
        // attempt token refresh + retry once here
      }
      rethrow; // or convert to typed exceptions
    }
  }
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

| Field      | Required?              | Rules                                                                                                                               |
| ---------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fullName` | No (server) / Yes (UI) | When provided: min 2 chars. `null` / omitted is accepted by the server; Flutter should require it because the UI exposes the field. |
| `email`    | Yes                    | RFC email format. Stored lower-cased.                                                                                               |
| `password` | Yes                    | Min 6 chars; at least one letter + one digit (recommended).                                                                         |
| `username` | No                     | **Do not render.** Leave out of the body entirely.                                                                                  |

Behaviour:

- Duplicate email returns `409 CONFLICT` with `details.field = "email"`. Show inline red hint on the email TextField.
- `password` < 6 chars or non-email format returns `400 VALIDATION_ERROR` with `details.field` set.
- The returned `user.username` is server-generated (example: `ahmedmohamed_8472`). Do **not** overwrite it with `fullName`.
- Google sign-up follows a different flow (see endpoint #3 below). Do **not** call this endpoint for the Google button.

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

Response Body (400 — VALIDATION_ERROR):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request payload",
  "details": { "field": "email", "issue": "Email format is invalid" },
  "timestamp": "2026-07-31T07:00:00.000Z",
  "requestId": "a1b2c3d4-0002-aaaa-bbbb-000000000002"
}
```

Response Body (409 — duplicate email):

```json
{
  "success": false,
  "code": "CONFLICT",
  "message": "Email is already registered. Try logging in.",
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

Response Body (400 — idToken missing or model validation failed):

```json
{
  "success": false,
  "message": "Google ID token is required",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "idToken",
      "message": "Google ID token is required"
    }
  ],
  "timestamp": "2026-07-31T12:00:00.000Z",
  "requestId": "a1b2c3d4-0007-aaaa-bbbb-000000000007"
}
```

Action for Flutter: the request body was serialized wrong. Ensure your request
uses `jsonEncode({'idToken': token})` with exactly that key name and no extra
top-level wrapper.

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

## 🔹 Route Endpoint Index (quick jump for 2026 AI Flutter generators)

| #   | Route                  | Method | Auth | Screen / module                               |
| --- | ---------------------- | ------ | ---- | --------------------------------------------- |
| 1   | `/auth/sign-up`        | POST   | No   | Sign-Up screen "إنشاء حساب جديد"              |
| 2   | `/auth/login`          | POST   | No   | Login screen "تسجيل الدخول"                   |
| 3   | `/auth/google`         | POST   | No   | Google button (both screens)                  |
| 4   | `/auth/refresh`        | POST   | No   | Token rotation (background)                   |
| 5   | `/auth/logout`         | POST   | No   | Sign-out button (profile drawer)              |
| 6   | `/auth/me`             | GET    | Yes  | Verify session / refresh cached profile       |
| 7   | `/dashboard`           | GET    | Yes  | Home / Dashboard — single-source-of-truth GET |
| 8   | `/tasbih/today`        | GET    | Yes  | Tasbih screen initial load                    |
| 9   | `/tasbih/increment`    | POST   | Yes  | Tasbih circle tap (+1)                        |
| 10  | `/tasbih/reset`        | POST   | Yes  | Tasbih reset button                           |
| 11  | `/tasbih/change-dhikr` | PATCH  | Yes  | Tasbih change-dhikr bottom sheet              |
| 12  | `/qibla/calculate`     | GET    | No   | Qibla / Compass screen                        |

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

Any top-level `data.*` section that is not present in DB seed returns JSON `null` explicitly (e.g., no khatmah created yet → `khatmah = null`). Use Dart null-aware operators (`khatmah?.surahNameAr ?? ''`) and a small "Coming soon" placeholder card per nullable section so the first-launch onboarding render does not throw `NoSuchMethodError: null`.

### 6) Swagger UI is always the ground truth

If there is a discrepancy between this guide and the live Swagger spec at `<base>/api/v1/docs`, trust the Swagger. This guide is a portable Flutter reference; the Swagger spec is generated from the source code and redeployed with every backend release.
