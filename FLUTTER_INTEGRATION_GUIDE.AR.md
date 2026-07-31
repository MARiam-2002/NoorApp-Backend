# دليل تكامل تطبيق Noor مع واجهة Flutter (النسخة الكاملة 2026)

> مكتوب خصيصًا لفريق Flutter حتى يربط كل الشاشات **بدون أي لخبطة**. كل قسم بالملف ده بيقولك:
>
> - شاشة إيه + إظهار إيه فيها (أسماء الحقول بالعربي زي ما هي في التصميم)
> - Endpoint إيه + HTTP method إيه
> - Headers إيه + Body إيه (لو فيه)
> - Response مثال حقيقي 100% مطابق للإنتاج
> - مثال Dart Code جاهز (تقدر تقصه وتلصقه في Flutter فورًا)

---

## 🔗 1. الروابط الأساسية (تقدر تحطها في `env` بـ Flutter)

| البيئة                 | Base URL                                         | Docs           |
| ---------------------- | ------------------------------------------------ | -------------- |
| 🚀 الإنتاج (Vercel)    | `https://noor-app-backend-one.vercel.app/api/v1` | `/api/v1/docs` |
| 💻 Localhost (التطوير) | `http://localhost:3000/api/v1`                   | `/api/v1/docs` |

---

## 🔑 2. قواعد الـ API

### ✅ Authentication (Bearer Token)

كل الـ endpoints عدا:

- `POST /auth/sign-up`
- `POST /auth/login`
- `POST /auth/google`
- `GET /health`
- `GET /qibla/calculate` (مفتوح للجميع — مش محتاج توثيق)

تحتاج تضيف في الـ **Headers**:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
Content-Type: application/json
accept: application/json
```

### ✅ شكل الرد الموحد

كل الـ Responses بنفس الشكل:

```json
{
  "success": true,
  "message": "رسالة شرح بالعربي",
  "data": { ..... },  // اللي Flutter بيستخدمه
  "meta": null,        // للـ pagination لو موجود
  "timestamp": "2026-07-28T06:00:00.000Z"
}
```

في حالة الـ Error:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR", // مثال: CONFLICT, UNAUTHORIZED, NOT_FOUND ...
  "message": "بريد إلكتروني خاطئ",
  "details": { "field": "email" }, // أحياناً
  "timestamp": "..."
}
```

### ✅ Refresh Token

لو الـ `accessToken` انتهى → استخدم الـ `refreshToken` في:

- `POST /auth/refresh` → هيجبلك access جديد.

---

## 📱 شاشة رقم 1: إنشاء حساب جديد (Sign-Up — بيانات كاملة)

> **شاشة الـ UI فيها 3 حقول فقط**:
>
> 1. `اسم المستخدم` (اللي في الواجهة ده الـ `fullName` في الـ API)
> 2. `البريد الإلكتروني`
> 3. `كلمة المرور`
>
> مفيش field اسمه `username` للـ Flutter، هو بيولد تلقائياً من الـ backend.

### Endpoint

```
POST /api/v1/auth/sign-up
```

### Request Body

```json
{
  "fullName": "أحمد محمد علي",
  "email": "AhmedMohamed@gmail.com",
  "password": "StrongPass123!"
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "ddecba0c-757d-43a4-a867-c1b0d1870bab",
      "username": "ahmed_mohamed_8472", // auto-generated — ملهوش لازمة للـ UI
      "fullName": "أحمد محمد علي",
      "email": "ahmedmohamed@gmail.com",
      "role": "USER",
      "provider": "LOCAL",
      "createdAt": "2026-07-28T06:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....", // ← خليها في الـ Secure Storage
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
    "tokenType": "Bearer",
    "expiresIn": 900 // 15 دقيقة بالثواني
  }
}
```

### ⚠️ حالات الخطأ الشائعة

| Status Code            | السبب                            | الحل في Flutter                                     |
| ---------------------- | -------------------------------- | --------------------------------------------------- |
| `409 CONFLICT`         | البريد مسجل قبل كده              | اظهر SnackBar "بريد إلكتروني خاطئ — هو مسجل بالفعل" |
| `400 VALIDATION_ERROR` | كلمة المرور أقل من 6 أو بريد غلط | اظهر رسالة تحت الـ field اللي فيها المشكلة          |

### 🎯 مثال Dart Code (Flutter) — جاهز لللصق

```dart
// dependencies: dio, flutter_secure_storage
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  final Dio _dio = Dio(BaseOptions(baseUrl: 'https://noor-app-backend-one.vercel.app/api/v1'));
  final _storage = const FlutterSecureStorage();

  Future<Map<String, dynamic>> signUp({
    required String fullName,
    required String email,
    required String password,
  }) async {
    final resp = await _dio.post('/auth/sign-up', data: {
      'fullName': fullName,
      'email': email,
      'password': password,
    });
    final data = resp.data['data'];
    await _storage.write(key: 'accessToken',  value: data['accessToken']);
    await _storage.write(key: 'refreshToken', value: data['refreshToken']);
    return resp.data;  // data.user فيه الاسم عشان تحطه في الـ greeting بعدين
  }
}
```

---

## 📱 شاشة رقم 2: تسجيل الدخول (Login)

> **الشاشة فيها 2 حقول فقط**: بريد إلكتروني + كلمة المرور

### Endpoint

```
POST /api/v1/auth/login
```

### Request Body

```json
{
  "email": "AhmedMohamed@gmail.com",
  "password": "StrongPass123!"
}
```

### Response (200 OK)

نفس شكل الـ sign-up تمامًا (فيه access + refresh token).

---

## 📱 شاشة رقم 3: الشاشة الرئيسية (Dashboard)

> 🏆 **أهم endpoint في التطبيق كلّه** — يستدعى **مرة واحدة** فقط عند فتح التطبيق.
> فيه كل البيانات اللي محتاجها للشاشة الرئيسية (8 أقسام كاملة).

### Endpoint

```
GET /api/v1/dashboard
Headers: Authorization: Bearer <accessToken>
```

### Response (200 OK) — المثال ده 1:1 زي اللي الـ service بيرجعه

```json
{
  "success": true,
  "message": "Dashboard loaded successfully",
  "data": {
    // ─── ① التحية في أعلى الشاشة (أهلا احمد + اسم اليوم + التاريخ الهجري) ───
    "greeting": {
      "displayName": "أحمد محمد علي", // ← ده اللي تكتبه في: "أهلا، أحمد"
      "fullName": "أحمد محمد علي", //   (لو null — fallback إلى الـ displayName)
      "username": "ahmed_mohamed_8472", //   (ملاحظة، مش بيظهر عادة)
      "points": 2450, // ← النقاط في أعلى اليمين لو فيها
      "weekdayName": "السبت", // ← اسم اليوم في أعلى اليمين (قبل الهجري)
      "hijriDate": "15 ذو القعدة 1447", // ← التاريخ الهجري (اللي بجانب اسم اليوم)
      "gregorianDate": "28 يوليو 2026" //   (لو Flutter محتاجه كـ fallback)
    },

    // ─── ② كارت أوقات الصلاة + العداد التنازلي ───
    "prayers": {
      "date": "2026-07-28",
      "timezone": "Africa/Cairo",
      "nextPrayer": {
        // ← ده فوق الـ 5 صلوات
        "name": "ASR",
        "nameAr": "صلاة العصر", // ← النص الكبير "صلاة العصر"
        "time": "15:24", // وقت الصلاة
        "countdownSeconds": 4468 // ← احسب: 4468 ث = 01:14:28 (العداد)
      },
      "schedule": [
        // ← الـ 5 صلوات بالترتيب + النقاط تحت
        {
          "name": "FAJR",
          "nameAr": "الفجر",
          "time": "04:11",
          "completed": true
        }, // ✅ ذهبي
        {
          "name": "DHUHR",
          "nameAr": "الظهر",
          "time": "12:58",
          "completed": true
        }, // ✅ ذهبي
        {
          "name": "ASR",
          "nameAr": "العصر",
          "time": "15:24",
          "completed": false
        }, // ⚪ رمادي
        {
          "name": "MAGHRIB",
          "nameAr": "المغرب",
          "time": "18:49",
          "completed": false
        }, // ⚪ رمادي
        {
          "name": "ISHA",
          "nameAr": "العشاء",
          "time": "20:18",
          "completed": false
        } // ⚪ رمادي
      ],
      "completedCount": 2,
      "totalCount": 5
    },

    // ─── ③ آية اليوم ───
    "verseOfTheDay": {
      "textAr": "الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
      "referenceAr": "[ الرعد: 28 ]", // ← المرجع اللي تحت الآية بين أقواس
      "surahNumber": 13,
      "ayahNumber": 28
    },

    // ─── ④ رحلتك اليومية — 4 كروت صغيرة ───
    "dailyJourney": {
      "prayer": { "completed": 3, "total": 5, "progress": 60 }, // ← الصلاة 3/5 (كارت أخضر)
      "quran": { "pagesRead": 4 }, // ← القرآن 4 صفحات (كارت أزرق)
      "adhkar": { "completed": true }, // ← الذكار ✓ تم الانجاز (كارت أصفر)
      "sadaqah": { "amount": 0 } // ← الصدقة 0 (كارت وردي)
    },

    // ─── ⑤ المزيد: أدوات سريعة (2 كروت: المسبحة + القبلة) ───
    "utilities": {
      "tasbih": { "enabled": true }, // ← عند الضغط: تروح لشاشة المسبحة (GET /tasbih/today)
      "qibla": { "enabled": true } // ← عند الضغط: تروح لشاشة القبلة  (GET /qibla/calculate?lat=..&lng=..)
    },

    // ─── ⑥ استكمل الختمة ───
    "khatmah": {
      "surahId": 2,
      "surahNameEn": "Al-Baqarah",
      "surahNameAr": "البقرة", // ← في أعلى الكارت "سورة البقرة"
      "currentPage": 35, // ← "صفحة 35" تحت اسم السورة
      "progressPercent": 6 // ← الـ progress bar تحت زر "متابعة القراءة"
    },

    // ─── ⑦ تحدي اليوم ───
    "dailyChallenge": {
      "titleAr": "اقرأ 5 صفحات من القرآن", // ← في الكارت
      "descriptionAr": "اقرأ 5 صفحات من القرآن اليوم لتحصل على 50 نقطة",
      "rewardPoints": 50, // ← "+ 50 نقطة" تحت الكارت
      "targetValue": 5,
      "completed": false, // ← لو true → زر استلام المكافأة يتفعل
      "claimed": false // ← لو true → الزر معطّل (اتسلمت قبل كده)
    },

    // ─── ⑧ حديث اليوم ───
    "hadithOfTheDay": {
      "textAr": "المؤمن للمؤمن كالبنيان يشد بعضه بعضاً",
      "sourceAr": "[ متفق عليه ]" // ← المصدر بين أقواس تحت الحديث
    }
  }
}
```

### 🎯 أمثلة لحسابات Flutter من الـ response

```dart
// ١. العداد التنازلي للصلاة القادمة (منثلي: 01:14:28)
int sec = data['prayers']['nextPrayer']['countdownSeconds'];
String hh = (sec ~/ 3600).toString().padLeft(2,'0');
String mm = ((sec % 3600) ~/ 60).toString().padLeft(2,'0');
String ss = (sec % 60).toString().padLeft(2,'0');
String countdown = '$hh:$mm:$ss';   // 01:14:28 ✅

// ٢. تحويل اسم اليوم + التاريخ الهجري زي الشاشة: "السبت 15 ذو القعدة"
//    استخدم ده مباشرة:
String topRight = '${data['greeting']['weekdayName']}  ${data['greeting']['hijriDate']}';

// ٣. التحية اليسار: "أهلا، أحمد محمد"
String greetingTitle = 'أهلا، ${data['greeting']['displayName']}';

// ٤. نسبة تقدم الصلاة في كارت الصلاة
double prayerProgress = (data['dailyJourney']['prayer']['progress'] as int) / 100;
```

---

## 📱 شاشة رقم 4: المسبحة (التسبيح) — States كاملة + الفرق بين العددين

> **⚠️ أهم نقطة في الشاشة كلّها (من الشاشات الثلاث المرفوعة):**
> فيه **عدّادين مختلفين تمامًا** — لو خلطتهما الفلاتر هيحصل عشان الكلمة نفسها "مجموع التسبيحات"
>
> | المكان في الشاشة                            | الـ Field في الـ JSON | ماذا يعمل؟                                       | لما بيرجع صفر؟                                                 |
> | ------------------------------------------- | --------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
> | 🔼 **الأعلى يمين** ("مجموع التسبيحات")      | `todayCount`          | **العدد التراكمي لليوم كله** (كل الأذكار مجتمعة) | فقط عند زر **"إعادة ضبط"** أو يوم جديد                         |
> | 🔽 **جوه الدائرة** (تحت اسم الذكر، زي "33") | `currentDhikrCount`   | **عدد تكرار الذكر الحالي فقط**                   | عند أي تغيير للذكر via زر "تغيير الذكر" **أو** عند "إعادة ضبط" |
>
> الشاشة الـ middle في الصور المرفقة توضح ده تمامًا:
>
> - `مجموع التسبيحات: 278` (العدد التراكمي اللي فضل قدام)
> - **جوه الدائرة:** "الحمد لله" + `0` (عشان المستخدم غير الذكر، فصفر العدد الداخلي بس، والمجموع باقي)
>
> الشاشة فيها:
>
> - زر رجوع يسار
> - عنوان "المسبحة"
> - `مجموع التسبيحات` الأعلى يمين (العدد الكلي اليوم)
> - الدائرة الكبيرة اللي فيها اسم الذكر الحالي + العدد اللي جوهها
> - زرين تحت: `إعادة ضبط` (يمسح كل حاجة) + `تغيير الذكر` (غير الاسم + يصفر العدد الداخلي فقط)

### Endpoints

| ما بتعمله                                 | Method + Endpoint            | متى تستخدمه                                      |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------ |
| تحميل الشاشة لأول مرة                     | `GET /tasbih/today`          | أول ما تفتح شاشة المسبحة                         |
| النقر على الدائرة (زيادة +1)              | `POST /tasbih/increment`     | كل نقرة على الدائرة الكبيرة                      |
| إعادة الضبط للصفر (العددين كلاهما يصير 0) | `POST /tasbih/reset`         | زر "إعادة ضبط"                                   |
| تغيير الذكر (SUBHAN → ALHAMDULILLAH إلخ)  | `PATCH /tasbih/change-dhikr` | زر "تغيير الذكر" — يصفر **currentDhikrCount** بس |

---

### 📌 جدول الشاشات الثلاث (States) + الـ Response المطابق لكل واحدة

| الشاشة                       | وصف الحالة                                      | `todayCount` (الأعلى يمين)  | الذكر الحالي `currentDhikrAr`   | `currentDhikrCount` (داخل الدائرة) | متى بتحصل؟                                                  |
| ---------------------------- | ----------------------------------------------- | --------------------------- | ------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| **Screen 1** (Reset)         | بعد ما المستخدم يضغط زر "إعادة ضبط"             | `0`                         | "الحمد لله" (أو أي ذكر افتراضي) | `0`                                | بعد استدعاء `POST /tasbih/reset` أو أول يوم جديد            |
| **Screen 2** (Dhikr changed) | بعد تغيير الذكر من سبحان الله → الحمد لله       | **`278`** (باقي غير متغير!) | "الحمد لله"                     | `0` (صفر جديد)                     | بعد استدعاء `PATCH /tasbih/change-dhikr` مع `ALHAMDULILLAH` |
| **Screen 3** (In progress)   | أثناء التسبيح (قبل اكتمال الـ 33 و قبل التغيير) | `245`                       | "سبحان الله"                    | `33`                               | بعد الاستدعاءات المتتالية لـ `POST /tasbih/increment`       |

**Response لكل شاشة:**

<details>
<summary>👆 Screen 1 — Response بعد إعادة الضبط</summary>

```json
{
  "success": true,
  "data": {
    "todayCount": 0, // ← مجموع التسبيحات في الأعلى = 0
    "currentDhikr": "ALHAMDULILLAH",
    "currentDhikrAr": "الحمد لله", // ← اسم الذكر في الدائرة
    "currentDhikrCount": 0, // ← العدد في الدائرة = 0
    "dailyGoal": 99,
    "progressPercent": 0,
    "lastDhikrChangeAt": "2026-07-28T06:00:00.000Z"
  }
}
```

</details>

<details>
<summary> 👆 Screen 2 — بعد تغيير الذكر من سبحان الله إلى الحمد لله (أهم مثال!)</summary>

```json
{
  "success": true,
  "data": {
    "todayCount": 278, // ← مجموع التسبيحات = 278 (سابق مش مَمسوح)
    "currentDhikr": "ALHAMDULILLAH",
    "currentDhikrAr": "الحمد لله", // ← الذكر تغير
    "currentDhikrCount": 0, // ← بس! العدد صفر لانه ذكر جديد
    "dailyGoal": 99,
    "progressPercent": 0, // ← نسبة التقدم للذكر الجديد = 0
    "lastDhikrChangeAt": "2026-07-28T07:12:45.000Z"
  }
}
```

✨ الذكاء الاصطناعي في فريق Flutter لازم يميّز بين الـ 2 أعداد جيدًا في الـ Widget state.

</details>

<details>
<summary> 👆 Screen 3 — أثناء التسبيح (مثال: سبحان الله 33)</summary>

```json
{
  "success": true,
  "data": {
    "todayCount": 245, // ← مجموع التسبيحات (245) في الأعلى يمين
    "currentDhikr": "SUBHAN_ALLAH",
    "currentDhikrAr": "سبحان الله", // ← الذكر في الدائرة
    "currentDhikrCount": 33, // ← العدد في الدائرة 33
    "dailyGoal": 99,
    "progressPercent": 33.33, // ← نسبة الهدف (لو عايز تعمل indicator حلزوني حول الدائرة)
    "lastDhikrChangeAt": "2026-07-28T06:10:00.000Z"
  }
}
```

</details>

---

### 📌 GET /tasbih/today — تحميل بيانات اليوم

```
GET /api/v1/tasbih/today
Authorization: Bearer <accessToken>
```

**Response:** نفس المثال الـ Screen 3 بالفوق.

---

### 📌 POST /tasbih/increment — النقر على الدائرة (زيادة)

```
POST /api/v1/tasbih/increment
Authorization: Bearer <accessToken>
Body: { "amount": 1 }   // اختياري — default 1 لو مبعتوش
```

**Effect:**

- `currentDhikrCount += 1`
- `todayCount        += 1`

**Response:** نفس هيكل `/tasbih/today` بعد الزيادة.

**Use in Flutter:** استخدم الـ response عشان تحدث الدائرة فورًا (مش محتاج تعمل GET تاني).

---

### 📌 POST /tasbih/reset — إعادة ضبط (يمسح العددين كلاهما)

```
POST /api/v1/tasbih/reset
Authorization: Bearer <accessToken>
```

**Effect:**

- `currentDhikrCount` = 0
- `todayCount` = 0
- `progressPercent` = 0

**Response:** زي Screen 1 — كل الأعداد صفر.

---

### 📌 PATCH /tasbih/change-dhikr — تغيير الذكر الحالي (⚠️ بيعمل reset للعداد الداخلي بس)

> الـ **6 أذكار** المتاحة (عالشاشة بيظهر زر "تغيير الذكر" يفتح BottomSheet بيهم):

| القيمة المرسلة                       | التقديم العربي           |
| ------------------------------------ | ------------------------ |
| `SUBHAN_ALLAH`                       | سبحان الله               |
| `ALHAMDULILLAH`                      | الحمد لله                |
| `LA_ILAHA_ILLA_ALLAH`                | لا إله إلا الله          |
| `ALLAHU_AKBAR`                       | الله أكبر                |
| `ASTAGHFIRULLAH`                     | أستغفر الله              |
| `LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH` | لا حول ولا قوة إلا بالله |

```
PATCH /api/v1/tasbih/change-dhikr
Authorization: Bearer <accessToken>
Body: { "dhikr": "ALHAMDULILLAH" }
```

**Effect:**

- تغيير `currentDhikrAr` + `currentDhikr` إلى الجديد
- ✨ **`currentDhikrCount` = 0** (العداد الداخلي بيصفر، زي الشاشة الـ middle)
- ✨ **`todayCount` stays (بيبقى كما هو)** — المجموع التراكمي مش بيتأثر
- `progressPercent` reset for new dhikr

**Response:** زي Screen 2 — اسم الذكر الجديد + `currentDhikrCount` = 0 لكن `todayCount` لسه 278.

---

## 📱 شاشة رقم 5: القبلة (البوصلة)

> الشاشة فيها:
>
> - إسم الاتجاه + المدينة (مصر + القاهرة تحت العنوان)
> - دائرة بوصلة كبيرة فيها سهم ذهبي يشير إلى الكعبة
> - النص تحت الدائرة: "وجه هاتفك حتى يشير السهم إلى القبلة"

### Endpoint (مفتوح — مش محتاج Bearer Token!)

```
GET /api/v1/qibla/calculate?lat=30.0444&lng=31.2357
```

**الـ parameters:**

- `lat` → خط العرض اللي جايب من GPS الخاص بالهاتف
- `lng` → خط الطول اللي جايب من GPS الخاص بالهاتف

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "bearingDegrees": 215.67, // ← ⭐ الأهم: الزاوية بالدرجات (215.67 = الجنوب الغربي)
    "bearingRadians": 3.764, // زي اللي فوقها لكن بالراديان (مفيد لـ CustomPainter)
    "directionAr": "الجنوب الغربي", // ← اسم الاتجاه بالعربي لو Flutter محتاجه كـ نص
    "distanceKm": 1246.35, // المسافة إلى مكة بالكيلومتر
    "kaaba": {
      "latitude": 21.4225,
      "longitude": 39.8262
    },
    "userLocation": {
      "latitude": 30.0444,
      "longitude": 31.2357
    }
  }
}
```

### 🎯 كيف تعمل البوصلة في Flutter؟ (المعادلة المهمة)

1. خد `heading` من **مستشعر البوصلة** (Flutter Compass package).
2. زاوية دوران السهم = `(bearingDegrees - heading)` درجة.
3. مررها للـ `Transform.rotate` أو للـ `CustomPainter` عشان السهم يكون دائمًا متجه للقبلة مهما كان اتجاه الهاتف.

**مثال Dart Code:**

```dart
// dependencies: flutter_compass, sensors_plus
import 'package:flutter_compass/flutter_compass.dart';

// داخل initState:
FlutterCompass.events?.listen((CompassEvent event) {
  double? heading = event.heading;           // اتجاه الهاتف من الشمال
  double bearing = 215.67;                   // من الـ API (data.bearingDegrees)
  double arrowRotation = bearing - heading!; // ← ده اللي تديه للـ Transform.rotate
  setState(() => _arrowRotation = arrowRotation);
});

// في البناء:
Transform.rotate(
  angle: _arrowRotation * pi / 180,  // حول للراديان عشان الـ Transform يفهم
  child: Image.asset('assets/qibla_arrow.png'),
)
```

---

## 🗺️ خريطة الـ Endpoints الكاملة (للمرجع السريع)

| #   | Endpoint               | Method | Auth؟ | شاشة/الاستخدام                                      |
| --- | ---------------------- | ------ | ----- | --------------------------------------------------- |
| 1   | `/auth/sign-up`        | POST   | ❌    | شاشة إنشاء حساب (3 fields: fullName + email + pass) |
| 2   | `/auth/login`          | POST   | ❌    | شاشة تسجيل الدخول                                   |
| 3   | `/auth/google`         | POST   | ❌    | زر "تسجيل عبر جوجل" في الشاشتين                     |
| 4   | `/auth/refresh`        | POST   | ❌    | جلب access جديد بـ refreshToken                     |
| 5   | `/dashboard`           | GET    | ✅    | **🏆 الشاشة الرئيسية كلّها**                        |
| 6   | `/tasbih/today`        | GET    | ✅    | تحميل شاشة المسبحة                                  |
| 7   | `/tasbih/increment`    | POST   | ✅    | نقرة الدائرة (زيادة +1)                             |
| 8   | `/tasbih/reset`        | POST   | ✅    | إعادة ضبط المسبحة                                   |
| 9   | `/tasbih/change-dhikr` | PATCH  | ✅    | تغيير الذكر من القائمة                              |
| 10  | `/qibla/calculate`     | GET    | ❌    | شاشة القبلة (بـ GPS coordinates)                    |
| 11  | `/prayers/today`       | GET    | ✅    | تحديث مفصل لأوقات الصلاة (لو Flutter محتاج)         |
| 12  | `/journey/today`       | GET    | ✅    | بيانات رحلتك اليومية standalone                     |
| 13  | `/profile/me`          | GET    | ✅    | شاشة الحساب الشخصي                                  |
| 14  | `/profile`             | PATCH  | ✅    | تعديل البيانات (الاسم، الموقع، المدينة...)          |
| 15  | `/health`              | GET    | ❌    | فحص حالة الـ API (للـ monitor بس)                   |

---

## ✅ نصائح أخيرة لفريق Flutter (تخلي التكامل نضيف)

1. **Secure Storage للأ tokens**: استخدم `flutter_secure_storage` — مش SharedPreferences عادي.
2. **Handle 401 بشكل عام**: لو فيه `401 UNAUTHORIZED` → استدعِ الـ refresh token → لو هو رفض كمان → روح للـ login.
3. **Convert countdownSeconds بشكل دوري**: في الـ dashboard، خد الـ `countdownSeconds` واخزنه في State، وكل ثانية نصص منه -1 عشان العداد يشتغل (لو وصل للصفر → اعمل GET /dashboard مرة واحدة عشان تجيب الصلاة اللي بعدها).
4. **ملاحظة على completed في الصلوات**: الـ `prayers.schedule[x].completed` هو اللي يحدد لون النقطة تحت كل صلاة (True → ذهبي ✅، False → رمادي ⚪).
5. **ملاحظة على تحدي اليوم**: لو `completed=true` و `claimed=false` → اظهر زر "استلام المكافأة" وروح على الـ endpoint بتاع الإClaim في الـ Challenges module.
6. **ملاحظة على الختمة**: اللينك تحت زر "متابعة القراءة" بيودي على شاشة القرآن (في عندنا endpoint `/quran/surahs/{id}` لو محتاج تحميل السورة نفسها).

---

> **تم التحديث: 28 يوليو 2026** — الملف ده بيلف تمامًا لـ Swagger بتاع الإنتاج وكل الـ services اللي موجودة في الـ backend. إذا حبيت تراجع أي حاجة بالتفصيل → `https://noor-app-backend-one.vercel.app/api/v1/docs`
