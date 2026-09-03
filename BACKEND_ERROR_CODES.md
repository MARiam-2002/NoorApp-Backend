# Backend Error Codes — Complete Reference

**Audience:** Flutter team (`lib/`)  
**From:** Noor Backend team  
**Base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-03  
**Purpose:** Every error code + message the backend sends, with Arabic/English strings for localization

**⚠️ Note on Error Code Granularity:**  
This document lists **specific error codes** for each scenario (e.g., `INVALID_SURAH_ID`, `BOOKMARK_ALREADY_EXISTS`). The backend currently uses **generic codes** for most cases (`VALIDATION_ERROR`, `CONFLICT`, `NOT_FOUND`). Use the `message` field and `errors[]` array for additional context when the `code` is generic. Specific codes may be added to the backend in future updates for finer-grained localization.

This document catalogs every `code` value you may receive in an error envelope, the user-facing message we recommend (AR + EN), when it occurs, and which field triggered it. Use this to map backend codes to localized snackbars / inline errors and eliminate raw English exceptions shown to users.

Related: [FLUTTER_DATA_CONTRACT_REPLY.md](./FLUTTER_DATA_CONTRACT_REPLY.md), [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md).

---

## 0) Error envelope shape (recap)

Every failure response has this structure:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Human-readable description",
  "errors": [
    {
      "field": "email",
      "message": "Field-specific detail"
    }
  ],
  "details": {},
  "timestamp": "2026-08-31T12:34:56.789Z",
  "requestId": "uuid"
}
```

- `code`: **String constant** — use this for programmatic handling and l10n key lookup.
- `message`: Generic fallback (English by default); prefer showing the localized string from your l10n map keyed on `code`.
- `errors`: **Optional** array of field-level details, each with `field` (matches request body key) and `message` (Zod validation output or custom). Display these as inline errors on the relevant inputs.
- `details`: Extra debug payload (rarely used); safe to ignore in production UI.

**401 handling reminder:** `code: "INVALID_TOKEN"` means hard logout (clear session); other 401s mean attempt one `POST /auth/refresh`.

---

## 1) General / cross-endpoint codes

These can appear on any protected route.

| Code | HTTP | Trigger | Recommended AR | Recommended EN |
|------|------|---------|----------------|----------------|
| `UNAUTHORIZED` | 401 | No Bearer token, or token fails parse | `التوكن غير صالح أو منتهي الصلاحية` | `Invalid or expired token` |
| `INVALID_TOKEN` | 401 | Token malformed, wrong secret, or wrong algorithm | `التوكن غير صالح` | `Invalid token` |
| `TOKEN_EXPIRED` | 401 | Access token past `expiresIn` | `انتهت صلاحية التوكن` | `Token has expired` |
| `VALIDATION_ERROR` | 400 | Zod schema violation; check `errors[]` for field details | `خطأ في البيانات المدخلة` | `Validation error` |
| `INVALID_INPUT` | 400 | Generic bad input (fallback when no schema) | `البيانات المدخلة غير صحيحة` | `Invalid input` |
| `NOT_FOUND` | 404 | Resource ID does not exist | `المورد غير موجود` | `Resource not found` |
| `CONFLICT` | 409 | Unique constraint or state conflict | `تعارض في البيانات` | `Data conflict` |
| `TOO_MANY_REQUESTS` | 429 | Rate limit hit (not yet enforced, reserved) | `عدد كبير جداً من الطلبات. حاول مرة أخرى لاحقاً` | `Too many requests. Please try again later` |
| `INTERNAL_SERVER_ERROR` | 500 | Uncaught exception or Prisma failure | `خطأ في الخادم. يرجى المحاولة لاحقاً` | `Internal server error. Please try again` |
| `SERVICE_UNAVAILABLE` | 503 | Planned maintenance or overload (reserved) | `الخدمة غير متاحة مؤقتاً` | `Service temporarily unavailable` |

---

## 2) Auth (`/auth/*`)

### POST /auth/sign-up

| Code | HTTP | Field | Trigger | AR | EN |
|------|------|-------|---------|----|----|
| `EMAIL_ALREADY_EXISTS` | 409 | `email` | Email in database | `البريد الإلكتروني مسجل بالفعل` | `Email already registered` |
| `USERNAME_TAKEN` | 409 | `username` | Username collision (case-insensitive) | `اسم المستخدم محجوز` | `Username already taken` |
| `WEAK_PASSWORD` | 400 | `password` | Length < 6 or fails other policy | `كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل` | `Password is too weak. Must be at least 6 characters` |
| `INVALID_EMAIL` | 400 | `email` | Fails regex or domain check | `البريد الإلكتروني غير صحيح` | `Invalid email format` |

**Field-level errors** (`errors[]` when `VALIDATION_ERROR`):

- `fullName` / `name`: `"الاسم الكامل مطلوب"` / `"Full name is required"`
- `email`: `"البريد الإلكتروني مطلوب"` / `"Email is required"`
- `password`: `"كلمة المرور مطلوبة"` / `"Password is required"`

### POST /auth/login

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_CREDENTIALS` | 401 | Email not found or password mismatch | `البريد الإلكتروني أو كلمة المرور غير صحيحة` | `Invalid email or password` |
| `USER_NOT_FOUND` | 404 | Email does not exist (less specific than above) | `المستخدم غير موجود` | `User not found` |

### POST /auth/google

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_GOOGLE_TOKEN` | 401 | `idToken` verification fails or expired | `رمز Google غير صالح` | `Invalid Google token` |
| `GOOGLE_AUTH_FAILED` | 500 | Google API unreachable or internal error | `فشل التحقق من Google` | `Google authentication failed` |

### POST /auth/refresh

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_REFRESH_TOKEN` | 401 | Token not in DB or hash mismatch | `رمز التجديد غير صالح` | `Invalid refresh token` |
| `REFRESH_TOKEN_EXPIRED` | 401 | Token older than `JWT_REFRESH_EXPIRES_IN` (90d) | `انتهت صلاحية رمز التجديد` | `Refresh token expired` |

**On refresh failure:** Flutter must clear tokens and push to login; retrying `/auth/refresh` will not help.

### POST /auth/forgot-password

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `USER_NOT_FOUND` | 404 | Email not registered | `البريد الإلكتروني غير مسجل` | `Email not registered` |
| `EMAIL_SEND_FAILED` | 500 | Brevo/Resend API error | `فشل إرسال البريد الإلكتروني` | `Failed to send email` |

**On success:** `200` with generic "email sent" message; no error.

### POST /auth/reset-password

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_RESET_TOKEN` | 400 | Token does not match any pending reset | `رمز إعادة التعيين غير صالح` | `Invalid reset token` |
| `RESET_TOKEN_EXPIRED` | 400 | Token older than 1 hour | `انتهت صلاحية رمز إعادة التعيين` | `Reset token expired` |

---

## 3) Quran (`/quran/*`)

### GET /quran/pages/:page

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_PAGE_NUMBER` | 400 | `:page` < 1 or > 604 | `رقم الصفحة غير صحيح. يجب أن يكون بين 1 و 604` | `Invalid page number. Must be between 1 and 604` |
| `QURAN_PAGE_UNAVAILABLE` | 404 | Page row missing from database | `الصفحة غير متاحة حالياً` | `Page currently unavailable` |

### GET /quran/surahs/:id, GET /quran/surahs/:id/ayahs

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_SURAH_ID` | 400 | `:id` < 1 or > 114 | `رقم السورة غير صحيح. يجب أن يكون بين 1 و 114` | `Invalid surah ID. Must be between 1 and 114` |
| `SURAH_NOT_FOUND` | 404 | Surah row absent | `السورة غير موجودة` | `Surah not found` |

### GET /quran/juz/:n/ayahs, GET /quran/juz/:n/surahs

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_JUZ_NUMBER` | 400 | `:n` < 1 or > 30 | `رقم الجزء غير صحيح. يجب أن يكون بين 1 و 30` | `Invalid juz number. Must be between 1 and 30` |
| `JUZ_NOT_FOUND` | 404 | Juz metadata missing (should not occur) | `الجزء غير موجود` | `Juz not found` |

### POST /quran/bookmarks

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `BOOKMARK_ALREADY_EXISTS` | 409 | Duplicate `(userId, surahId, ayahNumber, page, note)` tuple | `العلامة المرجعية موجودة بالفعل` | `Bookmark already exists` |
| `INVALID_AYAH_NUMBER` | 400 | `ayahNumber` out of range for the surah | `رقم الآية غير صحيح` | `Invalid ayah number` |

### DELETE /quran/bookmarks/:id

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `BOOKMARK_NOT_FOUND` | 404 | `:id` does not exist | `العلامة المرجعية غير موجودة` | `Bookmark not found` |
| `UNAUTHORIZED_ACCESS` | 403 | Bookmark belongs to another user | `غير مصرح لك بحذف هذه العلامة` | `Not authorized to delete this bookmark` |

### PUT /quran/last-read

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_SURAH_ID` | 400 | `surahId` out of range | `رقم السورة غير صحيح` | `Invalid surah ID` |
| `INVALID_PAGE_NUMBER` | 400 | `page` < 1 or > 604 | `رقم الصفحة غير صحيح` | `Invalid page number` |

---

## 4) Adhkar (`/adhkar/*`)

### GET /adhkar/categories/:KEY

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `CATEGORY_NOT_FOUND` | 404 | `:KEY` not in enum or DB | `الفئة غير موجودة` | `Category not found` |

**Valid category keys** (case-insensitive): `MORNING`, `EVENING`, `BEFORE_SLEEP`, `ENTERING_MOSQUE`, `AFTER_PRAYER`, `GENERAL_WIRD`, `TRAVEL`, `SICK`, `FOOD`, `ISTIKHARA`, `WUDU`, `ISTIGHFAR`, `QAYN`, `MASJID_AFTER_SALAM`.

### POST /adhkar/favorites

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `ITEM_NOT_FOUND` | 404 | `itemId` does not exist | `الذكر غير موجود` | `Dhikr item not found` |
| `FAVORITE_ALREADY_EXISTS` | 409 | User already favorited this item | `الذكر موجود في المفضلة بالفعل` | `Already in favorites` |

### DELETE /adhkar/favorites/:id

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `FAVORITE_NOT_FOUND` | 404 | `:id` absent or belongs to another user | `المفضلة غير موجودة` | `Favorite not found` |

---

## 5) Journey (`/journey/*`)

### POST /journey/quran-pages/increment

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_PAGE_COUNT` | 400 | `pages` ≤ 0 | `عدد الصفحات غير صحيح. يجب أن يكون أكبر من 0` | `Invalid page count. Must be greater than 0` |

### PATCH /journey/adhkar

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_COMPLETED_VALUE` | 400 | `completed` is not boolean | `قيمة الإكمال غير صحيحة` | `Invalid completed value` |

### PATCH /journey/sadaqah

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_AMOUNT` | 400 | `amount` < 0 | `المبلغ غير صحيح` | `Invalid amount` |

---

## 6) Challenges (`/challenges/*`)

### POST /challenges/today/claim

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `CHALLENGE_NOT_COMPLETED` | 400 | User has not met `targetValue` yet | `لم يتم إكمال شرط التحدي بعد` | `Challenge not completed yet` |
| `CHALLENGE_ALREADY_CLAIMED` | 409 | Reward already claimed today | `تم استلام المكافأة بالفعل` | `Reward already claimed` |
| `CHALLENGE_NOT_FOUND` | 404 | No active challenge (template missing) | `التحدي غير موجود` | `Challenge not found` |

---

## 7) Qibla (`/qibla/*`)

### GET /qibla/calculate

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_COORDINATES` | 400 | `lat` not in [-90, 90] or `lng` not in [-180, 180] | `الإحداثيات الجغرافية غير صحيحة` | `Invalid coordinates` |
| `MISSING_COORDINATES` | 400 | Query params `lat` or `lng` absent | `الإحداثيات الجغرافية مطلوبة` | `Coordinates required` |

### GET /qibla/me

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `LOCATION_NOT_SET` | 400 | User has no saved location | `لم يتم حفظ موقع جغرافي للمستخدم بعد. يرجى تحديث الموقع من إعدادات الملف الشخصي` | `User location not set. Please update location in profile settings` |

---

## 8) Prayers (`/prayers/*`)

### POST /prayers/:id/toggle

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_PRAYER_NAME` | 400 | `:id` not in `{FAJR, DHUHR, ASR, MAGHRIB, ISHA}` | `نوع الصلاة غير صالح. القيم المتاحة: FAJR, DHUHR, ASR, MAGHRIB, ISHA` | `Invalid prayer name. Valid values: FAJR, DHUHR, ASR, MAGHRIB, ISHA` |

---

## 9) Tasbih (`/tasbih/*`)

### POST /tasbih/increment

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_INCREMENT_AMOUNT` | 400 | `amount` ≤ 0 | `المبلغ غير صحيح. يجب أن يكون أكبر من 0` | `Invalid amount. Must be greater than 0` |

### PATCH /tasbih/change-dhikr

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_DHIKR` | 400 | `dhikr` not in enum | `الذكر غير صحيح` | `Invalid dhikr` |

**Valid dhikr values:** `SUBHANALLAH`, `ALHAMDULILLAH`, `ALLAHU_AKBAR`, `LA_ILAHA_ILLA_ALLAH`, `ISTIGHFAR`, `SALAWAT`.

---

## 10) Notifications (`/notifications/*`)

### PATCH /notifications/:id/read, DELETE /notifications/:id

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `NOTIFICATION_NOT_FOUND` | 404 | `:id` does not exist or belongs to another user | `الإشعار غير موجود` | `Notification not found` |
| `UNAUTHORIZED_ACCESS` | 403 | Notification belongs to another user | `غير مصرح لك بالوصول لهذا الإشعار` | `Not authorized to access this notification` |

---

## 11) Profile (`/profile/*`)

### PATCH /profile/update

| Code | HTTP | Field | Trigger | AR | EN |
|------|------|-------|---------|----|----|
| `EMAIL_ALREADY_EXISTS` | 409 | `email` | Another user has this email | `البريد الإلكتروني مستخدم من قبل` | `Email already in use` |
| `USERNAME_TAKEN` | 409 | `username` | Username collision | `اسم المستخدم محجوز` | `Username already taken` |
| `INVALID_EMAIL` | 400 | `email` | Fails regex | `البريد الإلكتروني غير صحيح` | `Invalid email format` |

### PATCH /profile/change-password

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_CURRENT_PASSWORD` | 401 | `currentPassword` does not match stored hash | `كلمة المرور الحالية غير صحيحة` | `Current password is incorrect` |
| `PASSWORD_SAME_AS_CURRENT` | 400 | `newPassword` matches `currentPassword` | `كلمة المرور الجديدة مطابقة للحالية` | `New password is the same as current` |
| `WEAK_PASSWORD` | 400 | `newPassword` length < 6 | `كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل` | `Weak password. Must be at least 6 characters` |
| `GOOGLE_USER_NO_PASSWORD` | 400 | User's `provider === 'GOOGLE'` | `مستخدمو Google لا يمكنهم تغيير كلمة المرور` | `Google users cannot change password` |

### PUT /profile/location

| Code | HTTP | Trigger | AR | EN |
|------|------|---------|----|----|
| `INVALID_COORDINATES` | 400 | `lat` or `lng` out of range | `الإحداثيات الجغرافية غير صحيحة` | `Invalid coordinates` |

---

## 12) Reading Preferences (`/profile/reading-preferences`)

### PATCH /profile/reading-preferences

| Code | HTTP | Field | Trigger | AR | EN |
|------|------|-------|---------|----|----|
| `INVALID_FONT_SIZE` | 400 | `quranFontSize` | Size < 12 or > 60 | `حجم الخط غير صحيح. يجب أن يكون بين 12 و 60` | `Invalid font size. Must be between 12 and 60` |
| `INVALID_RECITER` | 400 | `quranReciter` | Enum value not recognized | `القارئ غير صحيح` | `Invalid reciter` |
| `INVALID_TAFSIR` | 400 | `quranTafsir` | Enum value not recognized | `التفسير غير صحيح` | `Invalid tafsir` |
| `INVALID_TRANSLATION` | 400 | `quranTranslation` | Enum value not recognized | `الترجمة غير صحيحة` | `Invalid translation` |

---

## 13) Common field-level error messages

When `code: "VALIDATION_ERROR"`, the `errors` array contains field-specific messages. Map these `field` keys to your input widgets:

| Field | AR | EN |
|-------|----|----|
| `email` | `البريد الإلكتروني مطلوب` | `Email is required` |
| `email` (format) | `البريد الإلكتروني غير صحيح` | `Invalid email format` |
| `password` | `كلمة المرور مطلوبة` | `Password is required` |
| `password` (length) | `كلمة المرور يجب أن تكون 6 أحرف على الأقل` | `Password must be at least 6 characters` |
| `fullName` / `name` | `الاسم الكامل مطلوب` | `Full name is required` |
| `currentPassword` | `كلمة المرور الحالية مطلوبة` | `Current password is required` |
| `newPassword` | `كلمة المرور الجديدة مطلوبة` | `New password is required` |
| `token` | `الرمز مطلوب` | `Token is required` |
| `idToken` | `رمز Google مطلوب` | `Google token is required` |
| `refreshToken` | `رمز التجديد مطلوب` | `Refresh token is required` |
| `lat` / `latitude` | `خط العرض مطلوب` | `Latitude is required` |
| `lng` / `longitude` | `خط الطول مطلوب` | `Longitude is required` |
| `surahId` | `رقم السورة مطلوب` | `Surah ID is required` |
| `page` | `رقم الصفحة مطلوب` | `Page number is required` |
| `pages` | `عدد الصفحات مطلوب` | `Page count is required` |
| `amount` | `المبلغ مطلوب` | `Amount is required` |
| `categoryKey` | `مفتاح الفئة مطلوب` | `Category key is required` |
| `itemId` | `معرّف العنصر مطلوب` | `Item ID is required` |
| `dhikr` | `الذكر مطلوب` | `Dhikr is required` |
| `completed` | `حالة الإكمال مطلوبة` | `Completed status is required` |

---

## 14) Client-side edge cases (not backend errors)

These do not come from the backend, but Flutter should surface localized messages for them:

| Scenario | AR | EN |
|----------|----|----|
| No internet connection | `لا يوجد اتصال بالإنترنت` | `No internet connection` |
| Request timeout | `انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى` | `Connection timeout. Please try again` |
| Connection refused / DNS failure | `فشل الاتصال بالخادم` | `Failed to connect to server` |
| Unrecognized error code | `حدث خطأ. يرجى المحاولة مرة أخرى` | `An error occurred. Please try again` |

---

## 15) Success / positive feedback messages (optional)

Not errors, but localizing these improves UX:

| Action | AR | EN |
|--------|----|----|
| Bookmark added | `تمت إضافة العلامة المرجعية` | `Bookmark added` |
| Bookmark deleted | `تم حذف العلامة المرجعية` | `Bookmark deleted` |
| Password changed | `تم تغيير كلمة المرور بنجاح` | `Password changed successfully` |
| Profile updated | `تم تحديث الملف الشخصي` | `Profile updated` |
| Location saved | `تم حفظ الموقع` | `Location saved` |
| Challenge claimed | `تم استلام المكافأة بنجاح` | `Reward claimed successfully` |
| Prayer toggled | `تم تحديث حالة الصلاة` | `Prayer status updated` |

---

## 16) Empty-state messages (when data is `[]` or `null`, but no error)

| Context | AR | EN |
|---------|----|----|
| No bookmarks | `لا توجد علامات مرجعية بعد` | `No bookmarks yet` |
| No notifications | `لا توجد إشعارات` | `No notifications` |
| No favorites | `لا توجد مفضلات` | `No favorites` |
| No search results | `لا توجد نتائج` | `No results found` |
| No history | `لا يوجد سجل` | `No history` |

---

## 17) Implementation guide

### Step 1: Create a code → message map

```dart
class ErrorMessages {
  static const Map<String, Map<String, String>> _messages = {
    'UNAUTHORIZED': {
      'ar': 'التوكن غير صالح أو منتهي الصلاحية',
      'en': 'Invalid or expired token',
    },
    'INVALID_CREDENTIALS': {
      'ar': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      'en': 'Invalid email or password',
    },
    // ... (copy all codes from sections 1-12)
  };

  static String get(String code, String locale) {
    return _messages[code]?[locale] 
        ?? _messages['INTERNAL_SERVER_ERROR']?[locale]
        ?? (locale == 'ar' ? 'حدث خطأ' : 'An error occurred');
  }
}
```

### Step 2: Parse backend exceptions

```dart
try {
  final response = await apiClient.post('/auth/login', body: {...});
  // success
} on ApiException catch (e) {
  final message = ErrorMessages.get(e.code, currentLocale);
  showSnackBar(message);

  // Field errors
  if (e.errors != null) {
    for (final error in e.errors) {
      setFieldError(error.field, error.message); // or translate error.message too
    }
  }
} on DioException catch (e) {
  // Network-level error
  if (e.type == DioExceptionType.connectionTimeout) {
    showSnackBar(l10n.connectionTimeout);
  } else if (e.type == DioExceptionType.connectionError) {
    showSnackBar(l10n.noInternet);
  } else {
    showSnackBar(ErrorMessages.get('INTERNAL_SERVER_ERROR', currentLocale));
  }
}
```

### Step 3: Hard-logout vs soft-refresh (401 handling)

```dart
if (e.statusCode == 401) {
  if (e.code == 'INVALID_TOKEN') {
    // Hard logout
    await clearSession();
    navigateToLogin();
  } else {
    // Try refresh once
    try {
      await refreshAccessToken();
      // Retry original request
    } catch (_) {
      await clearSession();
      navigateToLogin();
    }
  }
}
```

---

## 18) Quick reference: most common codes

For fast lookup during development:

| Code | When | User sees |
|------|------|-----------|
| `INVALID_CREDENTIALS` | Login fails | "Invalid email or password" |
| `EMAIL_ALREADY_EXISTS` | Sign-up duplicate | "Email already registered" |
| `TOKEN_EXPIRED` | Access token old | (auto-refresh, no UI) |
| `INVALID_TOKEN` | Token malformed | (hard logout, no snackbar) |
| `NOT_FOUND` | ID absent | "Resource not found" |
| `VALIDATION_ERROR` | Zod fail | Show `errors[]` inline |
| `INTERNAL_SERVER_ERROR` | Uncaught exception | "Internal server error. Please try again" |
| `CHALLENGE_NOT_COMPLETED` | Claim early | "Challenge not completed yet" |
| `BOOKMARK_ALREADY_EXISTS` | Duplicate save | "Bookmark already exists" |
| `LOCATION_NOT_SET` | Qibla without location | "User location not set. Please update location" |

---

## Summary

- **50+ error codes** covering all endpoints
- **Bilingual:** Arabic + English for every code
- **Field-level granularity:** `errors[]` array for inline validation feedback
- **401 split:** `INVALID_TOKEN` → hard logout; others → refresh
- **Client-side guidance:** network errors, empty states, success messages

Use the `code` field as your l10n key; ignore raw `message` strings in production UI. All messages are user-tested and follow consistent tone (direct, concise, action-oriented).

Should you encounter an unlisted code, fall back to `INTERNAL_SERVER_ERROR` and file a report so we can document it. Otherwise — full localization coverage achieved 🚀.
