# Noor App — Flutter Integration Guide — 2026-07-31

## 🔹 API Integration Summary

- **Base URLs (store these in `env` / flavors)**:
  - Production (Vercel): `https://noor-app-backend-one.vercel.app/api/v1`
  - Local dev: `http://localhost:3000/api/v1`
  - Swagger UI (always the source of truth): `<base>/api/v1/docs`
- **Auth pattern**: Every endpoint below is `Authorization: Bearer <accessToken>` **except** the ones explicitly marked `Public`.
- **Response envelope**: Every response uses the same wrapper so Flutter can deserialize with one generic model: `{ success, message?, data, meta?, code?, details?, timestamp }`.
- **Auth endpoints**: `POST /auth/sign-up` creates a local account; `POST /auth/login` returns the token pair; `POST /auth/refresh` rotates the access token after 15 minutes; `POST /auth/google` exchanges a Google ID token for the same envelope.
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
| Endpoints covered                       | 10                                                  |
| Authenticated endpoints                 | 9                                                   |
| Public (no Bearer) endpoints            | 1                                                   |
| HTTP statuses covered (success + error) | 200 / 201 / 204 / 400 / 401 / 403 / 404 / 409 / 500 |

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
- Tokens are **JWT**. `expiresIn` in the login response is in **seconds** (default `900` = 15 minutes).
- Never store tokens in `SharedPreferences`. Use `flutter_secure_storage` (or equivalent encrypted keystore).

### 2) Generic Response Envelope

Every 2xx, 4xx and 5xx response shares this envelope:

```json
{
  "success": true,
  "message": "Short Arabic label — safe to show in a SnackBar if non-null",
  "data": { "...": "..." },
  "meta": null,
  "code": "SUCCESS | VALIDATION_ERROR | CONFLICT | UNAUTHORIZED | NOT_FOUND | INTERNAL_SERVER_ERROR",
  "details": null,
  "timestamp": "2026-07-31T07:15:00.000Z"
}
```

Notes:

- On error, `success` is `false`, `code` is the stable error identifier, `details.field` (when present) tells you which TextField to underline red.
- On pagination endpoints, `meta` contains `{ total, page, pageSize, hasMore }`.

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
      "createdAt": "2026-07-31T07:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh....",
    "tokenType": "Bearer",
    "expiresIn": 900
  },
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

Action after receiving 201:

- Persist `accessToken` + `refreshToken` in secure storage (do **not** persist the raw `password`).
- Persist `user.id` + `user.displayName = user.fullName ?? user.username` (used in the home greeting).
- Navigate immediately to the Home / Dashboard screen — no extra login step is needed.

Response Body (400 — VALIDATION_ERROR):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request payload",
  "details": { "field": "email", "issue": "Email format is invalid" },
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

Response Body (409 — duplicate email):

```json
{
  "success": false,
  "code": "CONFLICT",
  "message": "Email is already registered. Try logging in.",
  "details": { "field": "email" },
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

Response Body (500):

```json
{
  "success": false,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error",
  "details": null,
  "timestamp": "2026-07-31T07:00:00.000Z"
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

Response Body (200 OK): exact same envelope and `data` shape as Sign-Up (201). Persist tokens + navigate to Dashboard.

Response Body (401):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Invalid credentials",
  "details": null,
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

---

### 3) POST /auth/google — Google Sign-In / Sign-Up button (both screens)

Description: Exchanges the Google ID token obtained from the Google Sign-In SDK for a Noor account + tokens. Works for both first-time and returning users; creates the account automatically on first use (so this one endpoint serves **both** the Sign-Up screen Google button and the Login screen Google button).

Authorization: **Public**.

Request Body:

```json
{ "idToken": "<raw Google ID token returned by GoogleSignIn>" }
```

Behaviour:

- A missing or malformed `idToken` → `400`.
- A valid Google token maps to a user by `sub` claim (`googleId` in the DB). First-time sign-in creates the user with `provider = "GOOGLE"` and `fullName` + `email` populated from the ID token's claims.
- Returned envelope and `data` shape is identical to Sign-Up (201).
- Google users have no server-side password. Never route them to the "Forgot password" screen; show a "Continue with Google" hint instead.

Response Body (200 / 201): same `{ user, accessToken, refreshToken, tokenType, expiresIn }` shape.

---

### 4) POST /auth/refresh — Rotate access token (background / retry flow)

Description: Flutter calls this when an API request returns `401`. It exchanges the long-lived `refreshToken` for a brand new `accessToken` (+ new refresh token). Call BEFORE the original 401-triggering request is retried once.

Authorization: **Public** (token is in the body, not the `Authorization` header).

Request Body:

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh...." }
```

Response Body (200):

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh....",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

Response Body (401 — refresh token revoked or never issued):
Navigate the user back to the Login screen. Treat this state as "soft logout" (keep cached UI data but clear the token pair from secure storage).

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
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

Response Body (401):

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Expired or missing Bearer token",
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

**Action on 401**: attempt refresh, retry once, else Login screen.

Response Body (500):

```json
{
  "success": false,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error",
  "timestamp": "2026-07-31T07:00:00.000Z"
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
  "data": {
    "todayCount": 245,
    "currentDhikr": "SUBHAN_ALLAH",
    "currentDhikrAr": "سبحان الله",
    "currentDhikrCount": 33,
    "dailyGoal": 99,
    "progressPercent": 33.33,
    "lastDhikrChangeAt": "2026-07-28T09:15:30.000Z"
  }
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
  "data": {
    "todayCount": 0,
    "currentDhikr": "SUBHAN_ALLAH",
    "currentDhikrAr": "سبحان الله",
    "currentDhikrCount": 0,
    "dailyGoal": 99,
    "progressPercent": 0,
    "lastDhikrChangeAt": "2026-07-31T09:00:00.000Z"
  }
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
  "data": {
    "todayCount": 278,
    "currentDhikr": "ALHAMDULILLAH",
    "currentDhikrAr": "الحمد لله",
    "currentDhikrCount": 0,
    "dailyGoal": 99,
    "progressPercent": 0,
    "lastDhikrChangeAt": "2026-07-28T07:12:45.000Z"
  }
}
```

Response Body (400):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Unknown dhikr value",
  "details": { "field": "dhikr" }
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
  "timestamp": "2026-07-31T07:00:00.000Z"
}
```

Response Body (400 — missing coordinates):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Missing or invalid lat/lng",
  "details": { "field": "lat" }
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
| 5   | `/dashboard`           | GET    | Yes  | Home / Dashboard — single-source-of-truth GET |
| 6   | `/tasbih/today`        | GET    | Yes  | Tasbih screen initial load                    |
| 7   | `/tasbih/increment`    | POST   | Yes  | Tasbih circle tap (+1)                        |
| 8   | `/tasbih/reset`        | POST   | Yes  | Tasbih reset button                           |
| 9   | `/tasbih/change-dhikr` | PATCH  | Yes  | Tasbih change-dhikr bottom sheet              |
| 10  | `/qibla/calculate`     | GET    | No   | Qibla / Compass screen                        |

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

Never branch on `response.message` (it's translated / can change). Branch on `response.code` (`SUCCESS`, `VALIDATION_ERROR`, `CONFLICT`, `UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`). Use `message` only for human-facing `SnackBar`s / helper text.

### 5) Nullable sections

Any top-level `data.*` section that is not present in DB seed returns JSON `null` explicitly (e.g., no khatmah created yet → `khatmah = null`). Use Dart null-aware operators (`khatmah?.surahNameAr ?? ''`) and a small "Coming soon" placeholder card per nullable section so the first-launch onboarding render does not throw `NoSuchMethodError: null`.

### 6) Swagger UI is always the ground truth

If there is a discrepancy between this guide and the live Swagger spec at `<base>/api/v1/docs`, trust the Swagger. This guide is a portable Flutter reference; the Swagger spec is generated from the source code and redeployed with every backend release.
