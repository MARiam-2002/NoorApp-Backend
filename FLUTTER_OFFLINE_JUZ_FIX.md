# Flutter Offline Juz Fix — كيفية عرض الأجزاء بعد تحميل القرآن

**المشكلة:** بعد تحميل catalog offline، السور بتظهر لكن تاب الأجزاء فاضي.

**السبب:** البيانات موجودة في الcatalog! المشكلة في طريقة parsing على Flutter.

---

## ✅ البيانات الموجودة في `/quran/full-catalog`

الresponse بيرجع **3 طرق** عشان تعرض الأجزاء:

### 1. Array جاهز `data.juzs[]` - **الطريقة الأسهل والمفضلة** ⭐

```json
{
  "data": {
    "meta": {
      "totalJuz": 30
    },
    "juzs": [                    ← 🆕 Array جاهز فيه 30 juz
      {
        "juzNumber": 1,
        "nameAr": "الجزء الأول",
        "nameEn": "Juz' 1",
        "totalAyahs": 148,
        "startPage": 1,
        "endPage": 21,
        "firstSurah": {
          "id": 1,
          "nameAr": "الفاتحة",
          "nameEn": "Al-Faatiha"
        }
      },
      {
        "juzNumber": 2,
        "nameAr": "الجزء الثاني",
        "nameEn": "Juz' 2",
        "totalAyahs": 155,
        ...
      }
      // ... 28 more juz
    ],
    "surahs": [
      {
        "id": 1,
        "nameAr": "الفاتحة",
        "ayahs": [
          {
            "ayahNumber": 1,
            "textAr": "...",
            "page": 1,
            "juz": 1              ← كل آية فيها juz field برضه
          }
        ]
      }
    ]
  }
}
```

---

## 🔧 كود Flutter الصحيح - Offline Juz Tab

### الطريقة الصحيحة (استخدم `data.juzs` مباشرة):

```dart
// 1. Download catalog
final response = await http.get(
  Uri.parse('$baseUrl/quran/full-catalog')
);
final Map<String, dynamic> data = jsonDecode(response.body)['data'];

// 2a. 🆕 JUZ TAB — استخدم data.juzs مباشرة (بدون حسابات)
final List<dynamic> juzListRaw = data['juzs'] as List<dynamic>? ?? [];
final List<CachedJuzMeta> cachedJuzs = juzListRaw.map((j) {
  final Map<String, dynamic> jm = j as Map<String, dynamic>;
  final firstS = jm['firstSurah'] as Map<String, dynamic>;
  return CachedJuzMeta(
    juzNumber: jm['juzNumber'] as int,
    nameAr: jm['nameAr'] as String,
    nameEn: jm['nameEn'] as String,
    totalAyahs: jm['totalAyahs'] as int,
    startPage: jm['startPage'] as int?,
    endPage: jm['endPage'] as int?,
    firstSurahId: firstS['id'] as int,
    firstSurahNameAr: firstS['nameAr'] as String,
    firstSurahNameEn: firstS['nameEn'] as String,
  );
}).toList();

print('✅ Juz list ready: ${cachedJuzs.length}');  // → 30
print('Juz 1: ${cachedJuzs[0].nameAr} — ${cachedJuzs[0].totalAyahs} ayahs');
// Output: الجزء الأول — 148 ayahs

// 2b. احفظ في Isar/Hive/Drift
await isar.writeTxn(() async {
  await isar.cachedJuzMetas.putAll(cachedJuzs);
});

// 2c. Surahs & ayahs cache (نفس الكود القديم)
final List<dynamic> surahsRaw = data['surahs'] as List<dynamic>;
// ... existing code to cache surahs & ayahs
```

### Model class مقترح:

```dart
@collection
class CachedJuzMeta {
  Id? id;
  
  @Index()
  late int juzNumber;          // 1..30
  
  late String nameAr;          // "الجزء الأول"
  late String nameEn;          // "Juz' 1"
  late int totalAyahs;         // 148
  
  int? startPage;              // 1
  int? endPage;                // 21
  
  late int firstSurahId;       // 1
  late String firstSurahNameAr;// "الفاتحة"
  late String firstSurahNameEn;// "Al-Faatiha"
}
```

---

## 📱 عرض Juz Tab من الcache

```dart
// في JuzScreen
@override
Widget build(BuildContext context) {
  return FutureBuilder<List<CachedJuzMeta>>(
    future: isar.cachedJuzMetas
        .where()
        .sortByJuzNumber()
        .findAll(),
    builder: (context, snapshot) {
      if (!snapshot.hasData) {
        return Center(child: CircularProgressIndicator());
      }
      
      final juzs = snapshot.data!;
      
      if (juzs.isEmpty) {
        return Center(
          child: Text('لا توجد أجزاء محملة\nحمّل القرآن من الإعدادات'),
        );
      }
      
      return ListView.builder(
        itemCount: juzs.length,
        itemBuilder: (context, index) {
          final juz = juzs[index];
          return ListTile(
            leading: CircleAvatar(
              child: Text('${juz.juzNumber}'),
            ),
            title: Text(juz.nameAr),
            subtitle: Text(
              'يبدأ من سورة ${juz.firstSurahNameAr} • '
              '${juz.totalAyahs} آية'
            ),
            onTap: () => _navigateToJuzReader(juz),
          );
        },
      );
    },
  );
}
```

---

## 🔍 التأكد من البيانات موجودة

قبل ما تشك إن البيانات ناقصة، اعمل الcheck ده:

```dart
// بعد download الcatalog
final catalogData = jsonDecode(response.body)['data'];

print('📊 Catalog Analysis:');
print('Meta keys: ${catalogData['meta'].keys.toList()}');
print('Has juzs array: ${catalogData.containsKey('juzs')}');
print('Juzs count: ${(catalogData['juzs'] as List?)?.length ?? 0}');
print('Surahs count: ${(catalogData['surahs'] as List?)?.length ?? 0}');

if (catalogData.containsKey('juzs')) {
  final firstJuz = catalogData['juzs'][0];
  print('\n✅ First juz sample:');
  print('  juzNumber: ${firstJuz['juzNumber']}');
  print('  nameAr: ${firstJuz['nameAr']}');
  print('  totalAyahs: ${firstJuz['totalAyahs']}');
  print('  startPage: ${firstJuz['startPage']}');
}
```

**Expected output:**
```
📊 Catalog Analysis:
Meta keys: [catalogVersion, totalSurahs, totalAyahs, totalPages, totalJuz, bismillahStripped]
Has juzs array: true
Juzs count: 30
Surahs count: 114

✅ First juz sample:
  juzNumber: 1
  nameAr: الجزء الأول
  totalAyahs: 148
  startPage: 1
```

إذا الoutput مش كده، ممكن يكون في مشكلة في:
1. Network request مش كامل
2. JSON parsing مش صح
3. Cache layer بيشيل الdata

---

## ⚠️ الأخطاء الشائعة

### ❌ خطأ 1: مش بتقرا `data.juzs` خالص

```dart
// ❌ WRONG - بتعتمد على ayah.juz field و بتحسب كل حاجة
Map<int, List<Ayah>> juzMap = {};
for (var surah in surahs) {
  for (var ayah in surah.ayahs) {
    int juz = ayah.juz;
    juzMap[juz] ??= [];
    juzMap[juz].add(ayah);
  }
}
// ده بطيء جداً (6236 آية) و محتاج تحسب الnames بنفسك
```

```dart
// ✅ CORRECT - استخدم data.juzs الجاهز
final juzs = (data['juzs'] as List).map((j) => CachedJuzMeta.fromJson(j)).toList();
// ده instant و الnames جاهزة
```

### ❌ خطأ 2: بتخزن السور و الآيات بس، مش الأجزاء

```dart
// ❌ WRONG
await isar.writeTxn(() async {
  await isar.cachedSurahs.putAll(surahs);    // ✅
  await isar.cachedAyahs.putAll(ayahs);      // ✅
  // مش بتخزن الjuzs! ❌
});
```

```dart
// ✅ CORRECT
await isar.writeTxn(() async {
  await isar.cachedSurahs.putAll(surahs);
  await isar.cachedAyahs.putAll(ayahs);
  await isar.cachedJuzMetas.putAll(juzs);    // ✅ اخزن الأجزاء
});
```

### ❌ خطأ 3: الJuz screen بيقرا من online endpoints بدل cache

```dart
// ❌ WRONG - بيحاول يجيب الأجزاء من النت حتى offline
final response = await http.get(Uri.parse('$baseUrl/quran/juz'));
// لما النت مقفول، ده بيفشل و الtab بيبقى فاضي
```

```dart
// ✅ CORRECT - اقرا من الcache المحلي
final juzs = await isar.cachedJuzMetas.where().sortByJuzNumber().findAll();
// ده بيشتغل offline تماماً
```

---

## 🎯 Checklist للFix

- [ ] تأكد إن `data.juzs` array موجود في الresponse (print الdata)
- [ ] عامل `CachedJuzMeta` model/collection في Isar/Hive
- [ ] بتخزن الـ30 juz في الcache أثناء الdownload
- [ ] الJuz screen بيقرا من الcache مش من الnetwork
- [ ] لو عايز تعرض آيات juz معين، استخدم `isar.cachedAyahs.where().juzEqualTo(juzNumber).findAll()`

---

## 📞 للتواصل

لو المشكلة لسه موجودة بعد التعديلات دي:

1. ابعتلي الoutput بتاع الcheck script اللي فوق
2. ابعتلي screenshot من الJuz tab و هو فاضي
3. ابعتلي الكود بتاع download + caching + Juz screen

**البيانات موجودة 100% في الAPI - المشكلة parsing على Flutter!** ✅

---

*Backend Team - Noor App*  
*Last Updated: 2026-09-03*
