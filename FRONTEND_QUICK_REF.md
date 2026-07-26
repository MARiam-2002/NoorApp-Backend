# 📌 مرجع سريع للفلاتر
**Frontend Quick Reference Card**

---

## 🔗 روابط مهمة

| الرابط | الوصف |
|-------|-------|
| `https://noor-app-backend.vercel.app/api/v1` | Base URL |
| `https://noor-app-backend.vercel.app/api/v1/docs` | Swagger UI |
| `https://noor-app-backend.vercel.app/api/v1/docs.json` | OpenAPI JSON |
| `POSTMAN_COLLECTION.json` | Postman Collection |

---

## 🎯 أكثر الـ Endpoints استخداماً

### Auth (المصادقة)
```
POST /auth/signup       - إنشاء حساب جديد
POST /auth/signin       - تسجيل الدخول
POST /auth/google       - Google OAuth
POST /auth/refresh      - تحديث الـ Token
```

**مثال:**
```bash
curl -X POST https://noor-app-backend.vercel.app/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'
```

### Dashboard (الشاشة الرئيسية)
```
GET /dashboard          - الشاشة الرئيسية
```

### Prayers (أوقات الصلاة)
```
GET /prayers/today      - أوقات اليوم
GET /prayers/weekly     - أوقات الأسبوع
POST /prayers/{id}/complete - تعليم الصلاة
```

### Tasbih (المسبحة)
```
POST /tasbih/increment  - زيادة العداد
POST /tasbih/reset      - إعادة تعيين
GET /tasbih/today       - اليوم
```

### Quran (القرآن)
```
GET /quran/surahs       - قائمة السور
GET /quran/surah/{id}   - سورة محددة
POST /quran/bookmark    - إضافة علامة
GET /quran/last-read    - آخر قراءة
```

---

## 🔑 الـ Token والمصادقة

### الحصول على الـ Token
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 86400
    }
  }
}
```

### استخدام الـ Token
```
Authorization: Bearer {accessToken}
```

### تحديث الـ Token (عند انتهاء الصلاحية)
```bash
POST /auth/refresh
{
  "refreshToken": "eyJ..."
}
```

---

## 📊 صيغة الرد

### نجاح
```json
{
  "success": true,
  "message": "رسالة النجاح",
  "data": { /* البيانات */ },
  "timestamp": "2024-07-26T10:30:00Z"
}
```

### خطأ
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "بيانات غير صحيحة",
  "details": [{"field": "email", "message": "مطلوب"}],
  "timestamp": "2024-07-26T10:30:00Z"
}
```

---

## 🚀 Dart/Flutter Setup

### 1. إضافة المكتبات
```yaml
dependencies:
  dio: ^5.3.0
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.0
```

### 2. إنشاء ApiService
```dart
final apiService = ApiService();
```

### 3. تسجيل الدخول
```dart
await apiService.signIn(
  email: 'user@example.com',
  password: 'password'
);
```

### 4. الحصول على البيانات
```dart
final dashboard = await apiService.getDashboard();
```

---

## ❌ رموز الأخطاء الشائعة

| الكود | HTTP | المعنى |
|------|------|-------|
| `VALIDATION_ERROR` | 400 | بيانات غير صحيحة |
| `UNAUTHORIZED` | 401 | بدون مصادقة/Token منتهي |
| `FORBIDDEN` | 403 | لا توجد صلاحيات |
| `NOT_FOUND` | 404 | لم يتم العثور |
| `CONFLICT` | 409 | تعارض البيانات |
| `INTERNAL_SERVER_ERROR` | 500 | خطأ الخادم |

### معالجة الأخطاء
```dart
try {
  await apiService.signIn(email: email, password: password);
} catch (e) {
  // عرض رسالة الخطأ للمستخدم
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(e.toString()))
  );
}
```

---

## 💡 نصائح مهمة

1. ✅ احفظ الـ Token في Secure Storage (ليس SharedPreferences)
2. ✅ أضف Interceptor لـ Token refresh التلقائي
3. ✅ استخدم try-catch لمعالجة الأخطاء
4. ✅ أظهر loading indicator أثناء الطلب
5. ✅ تحقق من الإنترنت قبل الطلب
6. ✅ استخدم Timeout مناسب (30 ثانية)
7. ✅ اختبر مع الـ Network Throttling

---

## 📋 Checklist قبل النشر

- [ ] تم استخدام Secure Storage للـ Token
- [ ] تم إضافة Interceptors للـ Token refresh
- [ ] تم معالجة جميع الأخطاء
- [ ] تم إضافة Loading states
- [ ] تم اختبار Offline mode
- [ ] تم اختبار Timeout scenarios
- [ ] تم اختبار مع الـ Actual API
- [ ] تم إضافة Request logging (debug فقط)

---

## 🔍 الاختبار السريع (cURL)

### تسجيل دخول
```bash
curl -X POST http://localhost:3000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### أوقات الصلاة
```bash
curl -X GET "http://localhost:3000/api/v1/prayers/today?latitude=30.0444&longitude=31.2357&timezone=Africa/Cairo" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### المسبحة
```bash
curl -X POST http://localhost:3000/api/v1/tasbih/increment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dhikr":"ALHAMDULILLAH"}'
```

---

## 📞 التواصل

- **Email:** support@noor.app
- **Slack:** #api-support
- **GitHub:** github.com/MARiam-2002/Noor-App-Backend

---

**آخر تحديث:** يوليو 2024
**API Version:** 1.0.0
