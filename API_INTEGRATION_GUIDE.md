# دليل الربط API - للفلاتر (Frontend Teams)
**API Integration Guide for Frontend Teams**

---

## 🚀 ابدأ بسرعة (Quick Start)

### 1. تثبيت المكتبات

#### Flutter/Dart
```bash
flutter pub add dio
flutter pub add shared_preferences
flutter pub add flutter_secure_storage
```

#### React Native
```bash
npm install axios react-native-secure-storage
```

#### Web (React)
```bash
npm install axios zustand
```

---

## 📝 إعداد API Service

### Dart/Flutter
```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiService {
  static const String baseUrl = 'https://noor-app-backend.vercel.app/api/v1';
  static const storage = FlutterSecureStorage();
  
  late Dio dio;

  ApiService() {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: Duration(seconds: 30),
      receiveTimeout: Duration(seconds: 30),
      contentType: 'application/json',
    ));

    // إضافة Interceptor للـ Token
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await storage.read(key: 'accessToken');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401) {
            // تحديث الـ Token
            final refreshed = await refreshToken();
            if (refreshed) {
              return handler.resolve(await _retry(error.requestOptions));
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // Sign Up
  Future<Map<String, dynamic>> signUp({
    required String username,
    required String email,
    required String password,
  }) async {
    try {
      final response = await dio.post('/auth/signup', data: {
        'username': username,
        'email': email,
        'password': password,
        'timezone': 'Africa/Cairo',
      });

      if (response.statusCode == 201) {
        final data = response.data['data'];
        await storage.write(
          key: 'accessToken',
          value: data['tokens']['accessToken'],
        );
        await storage.write(
          key: 'refreshToken',
          value: data['tokens']['refreshToken'],
        );
        return response.data;
      }
      throw Exception('Sign up failed');
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Sign In
  Future<Map<String, dynamic>> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final response = await dio.post('/auth/signin', data: {
        'email': email,
        'password': password,
      });

      final data = response.data['data'];
      await storage.write(
        key: 'accessToken',
        value: data['tokens']['accessToken'],
      );
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Get Dashboard
  Future<Map<String, dynamic>> getDashboard() async {
    try {
      final response = await dio.get('/dashboard');
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Get Today Prayers
  Future<Map<String, dynamic>> getTodayPrayers({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await dio.get('/prayers/today', queryParameters: {
        'latitude': latitude,
        'longitude': longitude,
        'timezone': 'Africa/Cairo',
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Increment Tasbih
  Future<Map<String, dynamic>> incrementTasbih(String dhikr) async {
    try {
      final response = await dio.post('/tasbih/increment', data: {
        'dhikr': dhikr,
      });
      return response.data;
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Refresh Token
  Future<bool> refreshToken() async {
    try {
      final refreshToken = await storage.read(key: 'refreshToken');
      if (refreshToken == null) return false;

      final response = await dio.post('/auth/refresh', data: {
        'refreshToken': refreshToken,
      });

      final data = response.data['data'];
      await storage.write(
        key: 'accessToken',
        value: data['tokens']['accessToken'],
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  // Error handling
  String _handleError(DioException error) {
    if (error.response?.data != null) {
      return error.response?.data['message'] ?? 'An error occurred';
    }
    return error.message ?? 'An error occurred';
  }

  Future<Response<dynamic>> _retry(RequestOptions requestOptions) async {
    final options = Options(
      method: requestOptions.method,
      headers: requestOptions.headers,
    );
    return dio.request<dynamic>(
      requestOptions.path,
      data: requestOptions.data,
      queryParameters: requestOptions.queryParameters,
      options: options,
    );
  }
}
```

---

## 🎯 استخدام في الـ UI

### تسجيل الدخول
```dart
class LoginScreen extends StatefulWidget {
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final apiService = ApiService();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  bool isLoading = false;

  Future<void> handleLogin() async {
    setState(() => isLoading = true);
    try {
      final result = await apiService.signIn(
        email: emailController.text,
        password: passwordController.text,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'])),
        );
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('تسجيل الدخول')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(
              controller: emailController,
              decoration: InputDecoration(labelText: 'البريد الإلكتروني'),
            ),
            TextField(
              controller: passwordController,
              decoration: InputDecoration(labelText: 'كلمة المرور'),
              obscureText: true,
            ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: isLoading ? null : handleLogin,
              child: isLoading
                  ? CircularProgressIndicator()
                  : Text('دخول'),
            ),
          ],
        ),
      ),
    );
  }
}
```

### عرض أوقات الصلاة
```dart
class PrayerTimesWidget extends StatefulWidget {
  @override
  State<PrayerTimesWidget> createState() => _PrayerTimesWidgetState();
}

class _PrayerTimesWidgetState extends State<PrayerTimesWidget> {
  final apiService = ApiService();
  late Future<Map<String, dynamic>> prayersFuture;

  @override
  void initState() {
    super.initState();
    prayersFuture = apiService.getTodayPrayers(
      latitude: 30.0444,
      longitude: 31.2357,
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: prayersFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return Center(child: Text('Error: ${snapshot.error}'));
        }

        final prayers = snapshot.data?['data']['prayers'] ?? [];
        
        return ListView.builder(
          itemCount: prayers.length,
          itemBuilder: (context, index) {
            final prayer = prayers[index];
            return ListTile(
              title: Text(prayer['nameAr']),
              subtitle: Text(prayer['time']),
              trailing: Checkbox(
                value: prayer['completed'],
                onChanged: (_) {},
              ),
            );
          },
        );
      },
    );
  }
}
```

---

## 🔐 تخزين البيانات الحساسة

### استخدام Secure Storage
```dart
// الكتابة
await storage.write(
  key: 'accessToken',
  value: token,
  aOptions: _getAndroidOptions(),
  iOptions: _getIOSOptions(),
);

// القراءة
final token = await storage.read(
  key: 'accessToken',
  aOptions: _getAndroidOptions(),
  iOptions: _getIOSOptions(),
);

// الحذف
await storage.delete(key: 'accessToken');

AndroidOptions _getAndroidOptions() => AndroidOptions(
  keyCipherAlgorithm: KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
  storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
  resetOnError: true,
);

IOSOptions _getIOSOptions() => IOSOptions(
  accessibility: KeychainAccessibility.first_available_when_unlocked_this_device_only,
);
```

---

## ❌ معالجة الأخطاء

### Custom Exception Classes
```dart
class ApiException implements Exception {
  final String message;
  final String code;
  final int statusCode;

  ApiException({
    required this.message,
    required this.code,
    this.statusCode = 500,
  });

  @override
  String toString() => message;
}

class NetworkException implements Exception {
  final String message;
  NetworkException({this.message = 'Network error occurred'});

  @override
  String toString() => message;
}

// الاستخدام
try {
  await apiService.signIn(email: email, password: password);
} on ApiException catch (e) {
  // معالجة أخطاء API
  print('API Error: ${e.message} (${e.code})');
} on NetworkException catch (e) {
  // معالجة أخطاء الشبكة
  print('Network Error: ${e.message}');
} catch (e) {
  // معالجة الأخطاء الأخرى
  print('Unexpected error: $e');
}
```

---

## 🔄 Refresh Token Logic

### تطبيق التحديث التلقائي
```dart
// إضافة إلى InterceptorWrapper
onError: (error, handler) async {
  if (error.response?.statusCode == 401) {
    // الـ Token منتهي الصلاحية
    try {
      final success = await refreshToken();
      if (success) {
        // إعادة محاولة الطلب الأصلي
        final response = await dio.request(
          error.requestOptions.path,
          options: Options(
            method: error.requestOptions.method,
            headers: error.requestOptions.headers,
          ),
          data: error.requestOptions.data,
          queryParameters: error.requestOptions.queryParameters,
        );
        return handler.resolve(response);
      }
    } catch (e) {
      // تسجيل الخروج
      await logout();
    }
  }
  return handler.next(error);
},
```

---

## 🧪 الاختبار

### Unit Testing
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

class MockDio extends Mock implements Dio {}

void main() {
  group('ApiService', () {
    late ApiService apiService;
    late MockDio mockDio;

    setUp(() {
      mockDio = MockDio();
      apiService = ApiService();
    });

    test('signIn returns user data', () async {
      final response = Response(
        data: {
          'success': true,
          'data': {
            'tokens': {
              'accessToken': 'test_token',
            }
          }
        },
        statusCode: 200,
        requestOptions: RequestOptions(path: '/auth/signin'),
      );

      when(mockDio.post(
        '/auth/signin',
        data: anyNamed('data'),
      )).thenAnswer((_) async => response);

      final result = await apiService.signIn(
        email: 'test@example.com',
        password: 'password',
      );

      expect(result['success'], true);
    });
  });
}
```

---

## 🌐 متغيرات البيئة

### إنشاء `.env` file
```
API_BASE_URL=https://noor-app-backend.vercel.app/api/v1
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
TIMEOUT_DURATION=30
```

### استخدام في الكود
```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

final apiBaseUrl = dotenv.env['API_BASE_URL'] ?? 'https://noor-app-backend.vercel.app/api/v1';
```

---

## 📱 أفضل الممارسات

1. **استخدم Secure Storage** - لا تحفظ التوكن في Preferences
2. **تطبيق Interceptors** - للـ Token refresh التلقائي
3. **معالجة Timeout** - اضبط المهلة الزمنية المناسبة
4. **Log الأخطاء** - للمتابعة والتصحيح
5. **تخزين مؤقت** - استخدم caching للبيانات الثابتة
6. **SSL Pinning** - في الإنتاج (اختياري)

---

## 📞 الدعم

- 📧 support@noor.app
- 📖 Full Docs: https://noor-app-backend.vercel.app/api/v1/docs
- 🐛 Issues: https://github.com/MARiam-2002/Noor-App-Backend/issues

---

**آخر تحديث:** يوليو 2024
