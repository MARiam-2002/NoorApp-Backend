# نور - توثيق API الشامل
**Noor API - Complete Documentation**

---

## 📖 جدول المحتويات

- [مقدمة](#مقدمة)
- [البدء السريع](#البدء-السريع)
- [المصادقة](#المصادقة)
- [معايير API](#معايير-api)
- [المراحل](#المراحل)
- [الأخطاء](#الأخطاء)
- [أمثلة الاستخدام](#أمثلة-الاستخدام)
- [دليل الربط](#دليل-الربط)

---

## مقدمة

**نور** تطبيق إسلامي شامل يجمع بين أوقات الصلاة والقرآن الكريم والمحتوى الديني. واجهة البرمجة (API) مبنية بأعلى معايير الأمان والأداء.

### المميزات الرئيسية
- ✅ مصادقة آمنة (JWT + Google OAuth)
- ✅ معالجة أخطاء موحدة مع رسائل عربية واضحة
- ✅ Rate limiting لحماية الخدمة
- ✅ دعم RTL (العربية والإنجليزية)
- ✅ Swagger UI احترافي مع تثيل عملي

---

## البدء السريع

### الوصول للـ API
```
Base URL: https://noor-app-backend.vercel.app/api/v1
Docs URL: https://noor-app-backend.vercel.app/api/v1/docs
```

### الحصول على JWT Token
```bash
curl -X POST https://noor-app-backend.vercel.app/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**الرد:**
```json
{
  "success": true,
  "message": "تم تسجيل الدخول بنجاح",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "أحمد"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 86400
    }
  }
}
```

### استخدام الـ Token في الطلبات
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://noor-app-backend.vercel.app/api/v1/dashboard
```

---

## المصادقة

### 1. إنشاء حساب جديد
**POST** `/auth/signup`

```json
{
  "username": "أحمد محمد",
  "email": "ahmed@example.com",
  "password": "SecurePass123!",
  "timezone": "Africa/Cairo"
}
```

**الرد الناجح (201):**
```json
{
  "success": true,
  "message": "تم إنشاء الحساب بنجاح",
  "data": {
    "user": {
      "id": "550e8400-e29b",
      "username": "أحمد محمد",
      "email": "ahmed@example.com"
    },
    "tokens": { /* ... */ }
  }
}
```

### 2. تسجيل الدخول
**POST** `/auth/signin`

```json
{
  "email": "ahmed@example.com",
  "password": "SecurePass123!"
}
```

### 3. Google OAuth
**POST** `/auth/google`

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6In..."
}
```

### 4. تحديث الـ Token
**POST** `/auth/refresh`

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 5. استعادة كلمة المرور
**POST** `/auth/forgot-password`

```json
{
  "email": "ahmed@example.com"
}
```

---

## معايير API

### 1. صيغة الطلب
```
Method: GET | POST | PUT | PATCH | DELETE
Content-Type: application/json
Authorization: Bearer {accessToken}
```

### 2. صيغة الرد الناجح
```json
{
  "success": true,
  "message": "رسالة النجاح",
  "data": { /* البيانات المطلوبة */ },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  },
  "timestamp": "2024-07-26T10:30:00Z"
}
```

### 3. صيغة الرد الخاطئ
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "البيانات المدخلة غير صحيحة",
  "details": [
    {
      "field": "email",
      "message": "البريد الإلكتروني مطلوب"
    }
  ],
  "timestamp": "2024-07-26T10:30:00Z"
}
```

### 4. رموز الأخطاء
| الكود | المعنى | HTTP |
|------|-------|------|
| `VALIDATION_ERROR` | بيانات غير صحيحة | 400 |
| `UNAUTHORIZED` | بدون مصادقة | 401 |
| `FORBIDDEN` | لا توجد صلاحيات | 403 |
| `NOT_FOUND` | لم يتم العثور | 404 |
| `CONFLICT` | تعارض البيانات | 409 |
| `INTERNAL_SERVER_ERROR` | خطأ الخادم | 500 |

---

## المراحل

### مرحلة 1: أوقات الصلاة
**GET** `/prayers/today?latitude=30.0444&longitude=31.2357&timezone=Africa/Cairo`

```json
{
  "success": true,
  "data": {
    "date": "2024-07-26",
    "location": "القاهرة",
    "prayers": [
      {
        "name": "FAJR",
        "nameAr": "الفجر",
        "time": "03:55",
        "completed": false
      },
      {
        "name": "DHUHR",
        "nameAr": "الظهر",
        "time": "12:58",
        "completed": true
      }
    ]
  }
}
```

### مرحلة 2: المسبحة (Tasbih)
**POST** `/tasbih/increment`

```json
{
  "dhikr": "ALHAMDULILLAH"
}
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "count": 45,
    "totalAllTime": 2158,
    "dhikr": "الحمد لله"
  }
}
```

### مرحلة 3: اتجاه القبلة
**GET** `/qibla?latitude=30.0444&longitude=31.2357`

```json
{
  "success": true,
  "data": {
    "direction": 282.5,
    "directionAr": "شمال غربي",
    "distance": 1200.5
  }
}
```

### مرحلة 4: القرآن الكريم
**GET** `/quran/surahs`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nameEn": "Al-Fatihah",
      "nameAr": "الفاتحة",
      "totalAyahs": 7
    }
  ]
}
```

**GET** `/quran/surah/1`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "nameEn": "Al-Fatihah",
    "ayahs": [
      {
        "number": 1,
        "textAr": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
      }
    ]
  }
}
```

### مرحلة 5: رحلتي
**GET** `/journey/overview`

```json
{
  "success": true,
  "data": {
    "user": { "name": "أحمد" },
    "milestones": {
      "quranCompletion": {
        "progressPercent": 35,
        "pagesRead": 212
      },
      "adhkarConsistency": {
        "daysCompleted": 24
      }
    }
  }
}
```

### مرحلة 6: التحديات
**POST** `/challenges/{challengeId}/complete`

```json
{}
```

### مرحلة 7: المحتوى اليومي
**GET** `/content/verse-of-day`

```json
{
  "success": true,
  "data": {
    "textAr": "الله لا إله إلا هو الحي القيوم",
    "surah": "البقرة",
    "ayahNumber": 255
  }
}
```

---

## الأخطاء

### مثال خطأ التحقق
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "بيانات غير صحيحة",
  "details": [
    { "field": "email", "message": "بريد إلكتروني غير صحيح" },
    { "field": "password", "message": "كلمة مرور ضعيفة جداً" }
  ]
}
```

### مثال خطأ مصادقة
```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Token غير صحيح أو منتهي الصلاحية"
}
```

### مثال خطأ خادم
```json
{
  "success": false,
  "code": "INTERNAL_SERVER_ERROR",
  "message": "حدث خطأ في الخادم، يرجى المحاولة لاحقاً"
}
```

---

## أمثلة الاستخدام

### Dart/Flutter
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class NoorApi {
  final String baseUrl = "https://noor-app-backend.vercel.app/api/v1";
  String? accessToken;

  Future<void> signin(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/signin'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      accessToken = data['data']['tokens']['accessToken'];
    }
  }

  Future<dynamic> getDashboard() async {
    final response = await http.get(
      Uri.parse('$baseUrl/dashboard'),
      headers: {
        'Authorization': 'Bearer $accessToken',
      },
    );
    return jsonDecode(response.body);
  }
}

// الاستخدام
void main() async {
  final api = NoorApi();
  await api.signin('user@example.com', 'password');
  final dashboard = await api.getDashboard();
  print(dashboard);
}
```

### JavaScript/TypeScript
```typescript
class NoorAPI {
  private baseUrl = "https://noor-app-backend.vercel.app/api/v1";
  private accessToken: string | null = null;

  async signin(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    this.accessToken = data.data.tokens.accessToken;
    return data;
  }

  async getDashboard() {
    const response = await fetch(`${this.baseUrl}/dashboard`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });
    return response.json();
  }
}

// الاستخدام
const api = new NoorAPI();
await api.signin('user@example.com', 'password');
const dashboard = await api.getDashboard();
console.log(dashboard);
```

### Python
```python
import requests
import json

class NoorAPI:
    def __init__(self):
        self.base_url = "https://noor-app-backend.vercel.app/api/v1"
        self.access_token = None

    def signin(self, email: str, password: str):
        response = requests.post(
            f"{self.base_url}/auth/signin",
            json={"email": email, "password": password}
        )
        data = response.json()
        self.access_token = data['data']['tokens']['accessToken']
        return data

    def get_dashboard(self):
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.get(
            f"{self.base_url}/dashboard",
            headers=headers
        )
        return response.json()

# الاستخدام
api = NoorAPI()
api.signin('user@example.com', 'password')
dashboard = api.get_dashboard()
print(json.dumps(dashboard, indent=2, ensure_ascii=False))
```

---

## دليل الربط

### خطوات الربط من الفلاتر

#### 1️⃣ إضافة المكتبات
```bash
# Flutter
flutter pub add http dio
```

#### 2️⃣ إنشاء API Service
```dart
class ApiService {
  static const baseUrl = "https://noor-app-backend.vercel.app/api/v1";
  
  static Future<Response> post(String endpoint, Map body) {
    return Dio().post('$baseUrl$endpoint', data: body);
  }
}
```

#### 3️⃣ استخدام في الـ UI
```dart
// تسجيل الدخول
final response = await ApiService.post('/auth/signin', {
  'email': emailController.text,
  'password': passwordController.text,
});

if (response.statusCode == 200) {
  final token = response.data['data']['tokens']['accessToken'];
  // حفظ التوكن وحفظ البيانات
}
```

#### 4️⃣ تخزين الـ Token (هام!)
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const storage = FlutterSecureStorage();

// الحفظ
await storage.write(key: 'accessToken', value: token);

// الاسترجاع
final token = await storage.read(key: 'accessToken');
```

#### 5️⃣ إضافة Token للطلبات
```dart
static Future<Response> get(String endpoint) {
  final token = await storage.read(key: 'accessToken');
  return Dio().get(
    '$baseUrl$endpoint',
    options: Options(headers: {'Authorization': 'Bearer $token'}),
  );
}
```

---

## قائمة الـ Endpoints الكاملة

### Auth
- `POST /auth/signup` - إنشاء حساب
- `POST /auth/signin` - تسجيل الدخول
- `POST /auth/google` - Google OAuth
- `POST /auth/refresh` - تحديث Token
- `POST /auth/forgot-password` - استعادة كلمة المرور

### Dashboard
- `GET /dashboard` - الشاشة الرئيسية

### Prayers
- `GET /prayers/today` - أوقات اليوم
- `GET /prayers/weekly` - أوقات الأسبوع
- `POST /prayers/{id}/complete` - تعليم الصلاة

### Tasbih
- `POST /tasbih/increment` - زيادة العداد
- `POST /tasbih/reset` - إعادة تعيين
- `GET /tasbih/today` - اليوم

### Journey
- `GET /journey/overview` - نظرة عامة
- `GET /journey/weekly-stats` - إحصائيات أسبوعية
- `GET /journey/monthly-stats` - إحصائيات شهرية

### Quran
- `GET /quran/surahs` - قائمة السور
- `GET /quran/surah/{id}` - سورة محددة
- `POST /quran/bookmark` - إضافة علامة
- `GET /quran/last-read` - آخر قراءة

### Content
- `GET /content/verse-of-day` - آية اليوم
- `GET /content/hadith-of-day` - حديث اليوم

### Notifications
- `GET /notifications` - قائمة الإشعارات
- `PATCH /notifications/{id}/read` - وضع علامة مقروء

---

## ملاحظات أمنية

1. **لا تحفظ التوكن بصيغة نص عادي** - استخدم secure storage
2. **أضف X-Request-ID لكل طلب** - يساعد في التتبع
3. **لا تظهر التوكن في الـ logs**
4. **استخدم HTTPS فقط في الإنتاج**
5. **حدد صلاحيات الـ CORS بشكل صحيح**

---

## الدعم والمساعدة

- 📧 البريد الإلكتروني: support@noor.app
- 📱 Discord: [رابط السيرفر]
- 📖 Wiki: https://docs.noor.app
- 🐛 Report Issues: https://github.com/MARiam-2002/Noor-App-Backend/issues

---

**آخر تحديث:** يوليو 2024
**نسخة API:** 1.0.0
**حالة الخدمة:** https://status.noor.app
