# Noor App — Flutter Adhkar Integration Guide — 2026-08-27

Companion to [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md). Same envelope, same Dart client. This file covers **only** bottom-nav tab **الاذكار** — the two screens in the design:

1. **Adhkar Home** (tab root): title, greeting line, `وردك اليوم` progress card, scrollable category list.
2. **Category Detail** (tap a category): app-bar title from `nameAr`, list of dhikr cards with `textAr`, **مشاركة**, and **التكرار (N)**.

---

## 🔹 API Integration Changes Summary — 2026-08-27 (Adhkar module)

- **New**: `GET /adhkar` — **one call** that paints Adhkar Home: `greeting`, `dailyWird` (hero), `categories` (tappable rows).
- **New**: `GET /adhkar/categories/:key` — Category Detail. Full ordered `items[]` for that key (`MORNING` = اذكار الصباح, etc.).
- **New**: `GET /adhkar/categories` — category rows only (helper; do **not** call this on tab mount).
- **New**: `GET /adhkar/daily-wird` — hero block only (helper / deep-link; do **not** call this together with `GET /adhkar`).
- **Public (no Bearer)** on all four routes. Catalog content is not user-scoped in v1. Send Bearer if you already attach it globally; the server does **not** require it and must **not** 401 a logged-out user on this tab.
- **Fail-open**: if the database table is empty or Prisma errors, the server returns the in-memory Hisn al-Muslim fallback with the **same JSON keys**. Flutter should still handle network failure with a cached/skeleton list; do not treat `DATABASE_ERROR` as the happy path.
- No existing guide contracts (auth, dashboard, Quran, tasbih) were changed.

### Change Totals (2026-08-27 Adhkar batch)

- New endpoint documentation entries: **4**
- Updated documentation entries: **0** (additive module)
- Removed documentation entries: **0**

---

## 🔹 API Integration Summary

- **Base URLs** (same flavors as the main guide):
  - Production: `https://noor-app-backend-one.vercel.app/api/v1`
  - Local: `http://localhost:3000/api/v1`
  - Swagger: `<base>/docs` (full path `https://noor-app-backend-one.vercel.app/api/v1/docs`)
- **Auth**: All four Adhkar routes are **Public**.
- **Envelope**: `{ success, message, data, meta, timestamp, requestId }` on 2xx; errors add `code` plus `errors[]` (Zod) **or** `details` (app), never both as the only field-hint source.
- **Source of texts**: Hisn al-Muslim (حصن المسلم) + well-known reports in Sahih al-Bukhari / Sahih Muslim (and other canonical collections where Hisn al-Muslim cites them). Flutter does **not** strip or rewrite `textAr`.
- **Screens**:
  1. Adhkar Home — `GET /adhkar`
  2. Category Detail — `GET /adhkar/categories/:key`

### Integration Totals

| Area | Count |
| ---- | ----- |
| Screens / UI states | 2 |
| Endpoints | **4** |
| Authenticated | 0 |
| Public | 4 |
| HTTP statuses to handle | 200 / 404 / (network) |

---

## 🔹 Global Rules (unchanged)

Reuse the main guide:

1. Generic envelope + `NoorApi.request()`.
2. `INVALID_TOKEN` vs `TOKEN_EXPIRED` **only if** you send a Bearer and some **other** interceptor applies. These four GETs must work **without** a token.
3. RTL Arabic UI strings stay Arabic; this document is English.

**Adhkar-only rendering rule:** `textAr` is fully vocalized. Use a Quran-capable font (Amiri / Scheherazade New / brand Hafs). Center-align the body on Category Detail cards. Set `textHeightBehavior` so tashkeel is not clipped.

---

## 🔹 Screen map (design → API)

### Screen A — Adhkar Home (tab الاذكار)

| UI | Source |
| -- | ------ |
| App-bar title `الأذكار` | Client copy (not in JSON) |
| Search icon (top start) | Client-only in v1 — **no** search endpoint yet; do not call a fake `/adhkar/search` |
| Line `واذكر ربك إذا نسيت` | `data.greeting` |
| Card title `وردك اليوم` | `data.dailyWird.titleAr` |
| Subtitle `4 من 8 أذكار` | `{progressItemsDone} من {progressItemsTotal} أذكار` |
| Progress bar fill | `data.dailyWird.progressPercent` (0–100 integer; **do not recompute**) |
| Green CTA `أكمل وردك اليوم` | `data.dailyWird.ctaAr` → push Detail with `key = data.dailyWird.categoryKey` (v1: `GENERAL_WIRD`) |
| Category rows | `data.categories` sorted by `sortOrder` ascending. Label = `nameAr`. Leading glyph = `iconCode` (emoji string). |

v1 progress numbers are a **cosmetic** function of day-of-year so the bar is not always empty. Do not treat them as a real completion ledger. Repeat taps stay **local** (same idea as tasbih local-first).

The home list is **scrollable**. The design shows Morning / Evening / Sleep / Mosque / Prayer first; the API may return **more** rows after those (travel, sick, food, …). Render **every** `categories[]` item. Do not hardcode six rows.

### Screen B — Category Detail (e.g. اذكار الصباح)

| UI | Source |
| -- | ------ |
| Back | Pop |
| Centered title | `data.nameAr` — never hardcode `اذكار الصباح` |
| Card body | `items[i].textAr` (keep newlines; Mu'awwidhat may be three surahs in one item) |
| Optional fadilah under body | `items[i].benefitAr` only if non-empty |
| Footer start: `مشاركة` | OS share: `"{textAr}\n\n— {referenceAr}"` — **do not** put `benefitAr` in the share string |
| Footer end: `التكرار (N)` | `N = items[i].repeatCount` |
| List order | Array order = `orderInCategory`. Do not client-sort. |
| List keys | `ValueKey(item.id)` |

Repeat badge: increment an in-memory `Map<itemId, taps>`. Haptic optional. When taps hit `repeatCount`, show a check. Reset on dispose. **No POST** in v1.

---

## 🔹 Stable category keys

Backend trims and uppercases `:key`. Pass the `key` field verbatim.

| `key` | `nameAr` (typical) | Home sort |
| ----- | ------------------ | --------- |
| `MORNING` | اذكار الصباح | 1 |
| `EVENING` | اذكار المساء | 2 |
| `BEFORE_SLEEP` | اذكار النوم | 3 |
| `ENTERING_MOSQUE` | اذكار المسجد | 4 |
| `AFTER_PRAYER` | اذكار الصلاة | 5 |
| `GENERAL_WIRD` | وردك اليوم | 6 |
| `TRAVEL` | اذكار السفر | 7 |
| `SICK` | اذكار المريض والرقية | 8 |
| `FOOD` | اذكار الأكل والشرب | 9 |
| `ISTIKHARA` | دعاء الاستخارة | 10 |
| `WUDU` | اذكار الوضوء | 11 |
| `ISTIGHFAR` | اذكار الاستغفار | 12 |
| `QAYN` | ورد القين (التسبيح) | 13 |
| `MASJID_AFTER_SALAM` | اذكار بعد التسليم | 14 |

Unknown `key` → HTTP **404** `code: "NOT_FOUND"`. Pop + toast. Do not crash.

`totalItems` is a cache count; trust `items.length` on the detail payload for the ListView.

---

## 🔹 Endpoint 1) GET /adhkar — Adhkar Home

Description: Single call on tab open.

Authorization: **Public**.

Request: no query, no body.

```
GET https://noor-app-backend-one.vercel.app/api/v1/adhkar
Accept: application/json
```

Response Body (200):

```json
{
  "success": true,
  "message": "Dhikr home (categories + daily wird) retrieved successfully",
  "data": {
    "greeting": "واذكر ربك إذا نسيت",
    "dailyWird": {
      "titleAr": "وردك اليوم",
      "subtitleAr": "واذكر ربك إذا نسيت",
      "progressItemsDone": 4,
      "progressItemsTotal": 8,
      "progressPercent": 50,
      "ctaAr": "اكمل وردك اليوم",
      "categoryKey": "GENERAL_WIRD",
      "items": [
        {
          "id": "fb-g-1",
          "orderInCategory": 1,
          "textAr": "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ",
          "repeatCount": 100,
          "referenceAr": "رواه البخاري ومسلم",
          "benefitAr": "كنز من كنوز الجنة"
        }
      ]
    },
    "categories": [
      {
        "id": "fb-cat-MORNING",
        "key": "MORNING",
        "nameAr": "اذكار الصباح",
        "nameEn": "Morning Dhikr",
        "descriptionAr": "الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم",
        "descriptionEn": "Authentic Morning remembrances from Hisn al-Muslim",
        "iconCode": "🌤️",
        "sortOrder": 1,
        "totalItems": 12
      }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T03:15:00.000Z",
  "requestId": "a1b2c3d4-0a01-aaaa-bbbb-000000000001"
}
```

**`dailyWird.items` wire (always present):** `id`, `orderInCategory`, `textAr`, `repeatCount`, `referenceAr`, `benefitAr` (optional). Home UI does **not** need to render this slice; the design uses the hero as a progress CTA. You may ignore `items` on Home and only use them if you expand the hero.

**`categories[]` wire:** `id`, `key`, `nameAr`, `nameEn`, `descriptionAr`, `descriptionEn`, `iconCode`, `sortOrder`, `totalItems`. Home cards use `nameAr` + `iconCode` only.

---

## 🔹 Endpoint 2) GET /adhkar/categories/:key — Category Detail

Description: After tap on a home row **or** on `dailyWird.ctaAr`.

Authorization: **Public**.

```
GET https://noor-app-backend-one.vercel.app/api/v1/adhkar/categories/MORNING
Accept: application/json
```

Response Body (200):

```json
{
  "success": true,
  "message": "Dhikr category MORNING retrieved successfully",
  "data": {
    "id": "fb-cat-MORNING",
    "key": "MORNING",
    "nameAr": "اذكار الصباح",
    "nameEn": "Morning Dhikr",
    "descriptionAr": "الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم",
    "descriptionEn": "Authentic Morning remembrances from Hisn al-Muslim",
    "iconCode": "🌤️",
    "sortOrder": 1,
    "totalItems": 12,
    "items": [
      {
        "id": "fb-m-1",
        "orderInCategory": 1,
        "textAr": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ …",
        "repeatCount": 1,
        "referenceAr": "آية الكرسي - سورة البقرة 255",
        "benefitAr": "من قالها حين يصبح أجير من الجن حتى يمسي"
      },
      {
        "id": "fb-m-2",
        "orderInCategory": 2,
        "textAr": "قُلْ هُوَ ٱللَّهُ أَحَدٌ …\n\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ …\n\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ …",
        "repeatCount": 3,
        "referenceAr": "المعوذات ثلاث: الإخلاص والفلق والناس"
      }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T03:15:30.000Z",
  "requestId": "a1b2c3d4-0a02-aaaa-bbbb-000000000002"
}
```

**Item fields you must deserialize:**

| Field | Required | Use |
| ----- | -------- | --- |
| `id` | yes | List key, local tap map |
| `orderInCategory` | yes | Display order (already sorted) |
| `textAr` | yes | Card body |
| `repeatCount` | yes | `التكرار (N)` |
| `referenceAr` | yes (may be empty string) | Share second line |
| `benefitAr` | no | Optional line under body |
| `textArPlain` | no | Search/a11y only; **omit from the card** if you want pixel-match with the design |
| `referenceEn` | no | Ignore on the Arabic UI |
| `sourceUrl` | no | Ignore in v1 |

`repeatCount` values in the dataset include **1, 3, 7, 10, 33, 34, 100**. Size the badge for 1–3 digits.

Response Body (404 — unknown key):

```json
{
  "success": false,
  "message": "Dhikr category not found for key: XYZ",
  "code": "NOT_FOUND",
  "timestamp": "2026-08-27T03:15:30.000Z",
  "requestId": "a1b2c3d4-0a03-aaaa-bbbb-000000000003"
}
```

Toast, pop. Do not leave a blank detail route.

---

## 🔹 Endpoint 3) GET /adhkar/categories — helper

Authorization: **Public**.

`data` is a **JSON array** of category objects (same shape as Home `categories[]`), **not** `{ "categories": [...] }`.

Do not call on tab mount.

---

## 🔹 Endpoint 4) GET /adhkar/daily-wird — helper

Authorization: **Public**.

`data` is the same object as Home `dailyWird` (reuse `DailyWird.fromJson`).

Use for a notification deep-link. Do not call together with Endpoint 1.

---

## 🔹 Dart models (field names must match the wire)

```dart
class AdhkarHome {
  final String greeting;
  final DailyWird dailyWird;
  final List<DhikrCategory> categories;

  AdhkarHome({
    required this.greeting,
    required this.dailyWird,
    required this.categories,
  });

  factory AdhkarHome.fromJson(Map<String, dynamic> j) => AdhkarHome(
        greeting: j['greeting'] as String? ?? 'واذكر ربك إذا نسيت',
        dailyWird: DailyWird.fromJson(j['dailyWird'] as Map<String, dynamic>),
        categories: (j['categories'] as List<dynamic>? ?? const [])
            .map((e) => DhikrCategory.fromJson(e as Map<String, dynamic>))
            .toList(growable: false)
          ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder)),
      );
}

class DailyWird {
  final String titleAr;
  final String? subtitleAr;
  final int progressItemsDone;
  final int progressItemsTotal;
  final int progressPercent;
  final String ctaAr;
  final String categoryKey;
  final List<DhikrItem> items;

  DailyWird({
    required this.titleAr,
    this.subtitleAr,
    required this.progressItemsDone,
    required this.progressItemsTotal,
    required this.progressPercent,
    required this.ctaAr,
    required this.categoryKey,
    required this.items,
  });

  factory DailyWird.fromJson(Map<String, dynamic> j) => DailyWird(
        titleAr: j['titleAr'] as String? ?? 'وردك اليوم',
        subtitleAr: j['subtitleAr'] as String?,
        progressItemsDone: (j['progressItemsDone'] as num?)?.toInt() ?? 0,
        progressItemsTotal: (j['progressItemsTotal'] as num?)?.toInt() ?? 8,
        progressPercent: ((j['progressPercent'] as num?)?.toInt() ?? 0).clamp(0, 100),
        ctaAr: j['ctaAr'] as String? ?? 'اكمل وردك اليوم',
        categoryKey: (j['categoryKey'] as String? ?? 'GENERAL_WIRD').toUpperCase(),
        items: (j['items'] as List<dynamic>? ?? const [])
            .map((e) => DhikrItem.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
      );
}

class DhikrCategory {
  final String id;
  final String key;
  final String nameAr;
  final String? nameEn;
  final String? descriptionAr;
  final String? descriptionEn;
  final String iconCode;
  final int sortOrder;
  final int totalItems;

  DhikrCategory({
    required this.id,
    required this.key,
    required this.nameAr,
    this.nameEn,
    this.descriptionAr,
    this.descriptionEn,
    required this.iconCode,
    required this.sortOrder,
    required this.totalItems,
  });

  factory DhikrCategory.fromJson(Map<String, dynamic> j) => DhikrCategory(
        id: j['id'] as String,
        key: (j['key'] as String).toUpperCase(),
        nameAr: j['nameAr'] as String,
        nameEn: j['nameEn'] as String?,
        descriptionAr: j['descriptionAr'] as String?,
        descriptionEn: j['descriptionEn'] as String?,
        iconCode: j['iconCode'] as String? ?? '📖',
        sortOrder: (j['sortOrder'] as num?)?.toInt() ?? 999,
        totalItems: (j['totalItems'] as num?)?.toInt() ?? 0,
      );
}

class DhikrItem {
  final String id;
  final int orderInCategory;
  final String textAr;
  final String? textArPlain;
  final int repeatCount;
  final String referenceAr;
  final String? benefitAr;

  DhikrItem({
    required this.id,
    required this.orderInCategory,
    required this.textAr,
    this.textArPlain,
    required this.repeatCount,
    required this.referenceAr,
    this.benefitAr,
  });

  factory DhikrItem.fromJson(Map<String, dynamic> j) => DhikrItem(
        id: j['id'] as String,
        orderInCategory: (j['orderInCategory'] as num?)?.toInt() ?? 0,
        textAr: j['textAr'] as String,
        textArPlain: j['textArPlain'] as String?,
        repeatCount: ((j['repeatCount'] as num?)?.toInt() ?? 1).clamp(1, 9999),
        referenceAr: j['referenceAr'] as String? ?? '',
        benefitAr: (j['benefitAr'] as String?)?.trim(),
      );

  String get sharePayload => '$textAr\n\n— $referenceAr';
}

enum DhikrCategoryKey {
  morning('MORNING'),
  evening('EVENING'),
  beforeSleep('BEFORE_SLEEP'),
  enteringMosque('ENTERING_MOSQUE'),
  afterPrayer('AFTER_PRAYER'),
  generalWird('GENERAL_WIRD'),
  travel('TRAVEL'),
  sick('SICK'),
  food('FOOD'),
  istikhara('ISTIKHARA'),
  wudu('WUDU'),
  istighfar('ISTIGHFAR'),
  qayn('QAYN'),
  masjidAfterSalam('MASJID_AFTER_SALAM');

  final String raw;
  const DhikrCategoryKey(this.raw);

  static DhikrCategoryKey fromRaw(String r) {
    final n = r.trim().toUpperCase();
    return DhikrCategoryKey.values.firstWhere(
      (e) => e.raw == n,
      orElse: () => DhikrCategoryKey.generalWird,
    );
  }
}
```

**Home fetch:**

```dart
final payload = await NoorApi.instance.request('GET', '/adhkar');
final home = AdhkarHome.fromJson(payload['data'] as Map<String, dynamic>);
```

**Detail fetch:**

```dart
final payload = await NoorApi.instance.request(
  'GET',
  '/adhkar/categories/${category.key}',
);
final data = payload['data'] as Map<String, dynamic>;
final header = DhikrCategory.fromJson(data);
final items = (data['items'] as List<dynamic>)
    .map((e) => DhikrItem.fromJson(e as Map<String, dynamic>))
    .toList(growable: false);
```

---

## 🔹 Route index

| # | Path | Method | Auth | Screen |
| - | ---- | ------ | ---- | ------ |
| 1 | `/adhkar` | GET | Public | Adhkar Home (required) |
| 2 | `/adhkar/categories/:key` | GET | Public | Category Detail (required) |
| 3 | `/adhkar/categories` | GET | Public | Helper — do not use on tab mount |
| 4 | `/adhkar/daily-wird` | GET | Public | Helper / deep-link |

---

## 🔹 What v1 does **not** include

- No `POST` mark-complete / streak (local repeat map only).
- No Adhkar search API (search icon is decorative).
- No image share card — text share only.
- Do not call `PATCH /journey/adhkar` from these two screens. That flag is the Home/Journey “أذكار اليوم” checkbox from the main guide, not this catalog.

---

## 🔹 QA (Flutter, these two screens)

| # | Check | Pass if |
| - | ----- | ------- |
| 1 | Tab الاذكار | Exactly one `GET /adhkar` on mount |
| 2 | Greeting + hero | `greeting`, `dailyWird.titleAr`, `progressPercent` bar, CTA uses `ctaAr` |
| 3 | Category list | Every `categories[]` row; `nameAr` + `iconCode`; tap uses `key` unchanged |
| 4 | CTA | Pushes Detail for `dailyWird.categoryKey` |
| 5 | Detail title | `data.nameAr` (MORNING → اذكار الصباح) |
| 6 | Cards | Centered `textAr`; footer `مشاركة` + `التكرار (repeatCount)` |
| 7 | Share | `textAr` + `referenceAr` only |
| 8 | Repeat | Local count to N; reset on dispose; no extra HTTP |
| 9 | 404 | Bad key → toast + pop |
| 10 | Offline | Cached Home or skeleton — not an empty tab |
| 11 | Public | Home + Detail load **without** Bearer |
