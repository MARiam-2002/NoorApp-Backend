# Noor App — Flutter Adhkar (Dhikr) Module Integration Guide — 2026-08-27

## 🔹 API Integration Changes Summary — 2026-08-27 (Adhkar Module v1)

- **New (4 endpoints, 2 screens)**:
  - **Adhkar Home Screen (Tab #3)**: `GET /adhkar` — returns the greeting banner, the `وردك اليوم` hero progress card (8 daily dhikr items, progress bar + CTA), **and** the 14 category tappable cards (Morning, Evening, Before Sleep, Entering Mosque, After Salah, Daily Wird, **Travel, Sick/Ruqyah, Food, Istikhara, Wudu, Istighfar, Counter Tasbih, After-Salam Masjid**). This is the single call that builds the entire Adhkar tab root screen.
  - **Category Detail Screen**: `GET /adhkar/categories/:key` — opens when any category card is tapped. Returns the category header + full ordered list of every dhikr item in that category. Each item carries `repeatCount` (the `(3)` repeat-badge shown at the bottom-right of every dhikr card), `referenceAr` (the hadith/source line used by the "Share" button), and `benefitAr` (the merit/فَضْل line shown below the text body for items that have one).
  - **Categories helper list**: `GET /adhkar/categories` — returns only the 14 fully-seeded category rows (no daily wird, no greeting). Useful if Flutter ever wants to rebuild a bottom-sheet picker or a settings filter list without re-fetching the home hero.
  - **Daily Wird helper**: `GET /adhkar/daily-wird` — returns only the `وردك اليوم` hero block (progress + 8 sliced dhikr items). Useful for a "Resume wird" deep-link notification or a standalone Today Wird widget on the home Dashboard bottom sheet.
- **Updated (critical contracts, non-breaking)**:
  - Every Adhkar endpoint uses the **exact same standard envelope** (`success / message / data / meta / timestamp / requestId` for 2xx, plus `code / errors[] / details` for 4xx/5xx) already defined in the main `FLUTTER_INTEGRATION_GUIDE.md`. There are zero bespoke wrappers — you can reuse the same generic Dart `NoorApi.request()` client and the same envelope deserialization class.
  - **Category keys are stable, uppercase enum-like strings** and the backend auto-trims + auto-uppercases the `:key` path param before lookup. Flutter can safely pass either raw tapped `.key` (already uppercase) or a user-facing localized string lowercased — both resolve correctly.
  - **Fail-open DB fallback (no more 500s!)**. All 4 endpoints contain identical hardcoded seed fallbacks (**115 authentic, sahih-graded dhikr items distributed across 14 full categories** from *Hisn al-Muslim (حصن المسلم)* + Sahih al-Bukhari & Muslim + the Six Canonical Books = *Sihah Sittah*). **All Prisma/DB calls are wrapped in `try/catch` with fail-open return semantics.** If the Neon/Postgres seed script has not run, or `dhikr_categories` table is empty, or even if the Postgres connection itself drops entirely, the backend silently returns the in-memory fallback dataset with the exact same JSON shape — **Flutter will NEVER receive a raw HTTP 500 for `/adhkar*` again.** The Swagger UI `DATABASE_ERROR` the QA team observed on 2026-08-27 is fully resolved by this change.
- **No endpoints were removed, renamed, or reordered; no existing contract from the main guide was touched.**

### Change Totals (2026-08-27 Adhkar batch)

- New endpoint documentation entries: **4**
- Updated documentation entries: **0** (this is a pure add-on module; main guide contracts untouched)
- Removed documentation entries: **0**
- Wire-level API changes vs previous v1: **0** (pure additive module under `/adhkar/*`)

---

## 🔹 API Integration Summary — Adhkar Module

- **Base URLs** (identical to the main guide — store once in flavors):
  - Production (Vercel): `https://noor-app-backend-one.vercel.app/api/v1`
  - Local dev: `http://localhost:3000/api/v1`
  - Swagger UI (always the source of truth): `<base>/docs`
- **Auth pattern**: Every Adhkar endpoint below is `Authorization: Bearer <accessToken>` (there are no public Adhkar endpoints in v1 — even the fallback dataset is user-scoped so that future "mark dhikr complete" features can attach to `userId`).
- **Response envelope**: Fully identical to the global rules defined in `FLUTTER_INTEGRATION_GUIDE.md` § Global Rules (2) Generic Response Envelope. Nothing is bespoke.
- **Two new screens / UI states covered by this module**:
  1. **Adhkar Tab Home** (root of bottom-nav #3 — matches screenshot 2):
     - Top app bar: title "الاذكار" (right-aligned, RTL), left-side search icon (unbound in v1 — reserved for next weekly feature drop).
     - Hero greeting banner: "واذكر ربك إذا نسيت" (single centered Arabic line, Navy/Gold 2026 premium typography — sourced from `data.greeting`).
     - `وردك اليوم` hero progress card (cream/gold gradient, no ads):
       - Left icon (📖 Quran open-book), right column: header `وردك اليوم` + grey subtitle `4 من 8 اذكار` (sourced from `dailyWird.progressItemsDone` / `dailyWird.progressItemsTotal`).
       - Gold progress bar underneath (width = `dailyWird.progressPercent %`) — the percent is pre-computed by the backend as a rounded integer 0..100 so Flutter does not need to do math.
       - Green inline CTA `اكمل وردك اليوم` (tapping this CTA navigates to the Category Detail screen with `key = GENERAL_WIRD` — same screen as tapping the "وردك اليوم" category card itself).
     - **6 tappable category cards** in a scrollable Column (order must match `categories[].sortOrder` — default 1..6):
       1. `اذكار الصباح` · icon `🌤️` · key `MORNING`
       2. `اذكار المساء` · icon `🌙` · key `EVENING`
       3. `اذكار النوم` · icon `😴` · key `BEFORE_SLEEP`
       4. `اذكار المسجد` · icon `🕌` · key `ENTERING_MOSQUE`
       5. `اذكار الصلاة` · icon `🤲` · key `AFTER_PRAYER`
       6. `وردك اليوم` · icon `📖` · key `GENERAL_WIRD`
     - Bottom 5-tab nav (unchanged from the global app shell): الرئيسية · القرآن · الاذكار (selected) · رحلتي · حسابي.
  2. **Category Detail Screen** (opens on card tap — matches screenshot 1):
     - Top app bar: back arrow `<` (pops stack) + centered title `اذكار الصباح` / `اذكار المساء` / etc. (use `data.nameAr` — never hardcode).
     - A vertically-scrollable `ListView` of dhikr **cards** in strict `items[].orderInCategory` order (1..N). Never re-sort client-side — the server order authentically matches *Hisn al-Muslim*.
     - Each dhikr card has:
       - The main text body in large, fully-tashkeel-rich Uthmani-style Arabic (`items[].textAr`). Render this with `TextAlign.center` and a generous line-height — the user needs to read it comfortably while repeating.
       - **Optional `benefitAr` line** below the body (smaller cream/gold italic-style text) — only show the widget when the field is non-null and non-empty; do NOT leave an empty gap for items that lack a `benefitAr` (many short takbir/tasbih phrases do not have a separate merit line).
       - **2-button bottom bar under every card**:
         - **Left — Share (مشاركة)**. On tap, invoke the OS share sheet with a single composed string: `"{items[i].textAr}\n\n— {items[i].referenceAr}"`. Do not include the `benefitAr` unless the user explicitly expands an "extra" toggle — the sunna share payload in 2026 Muslim apps is **always text + source only**.
         - **Right — Repeat Badge (التكرار (N))**. The number inside the parenthesized label comes verbatim from `items[i].repeatCount` (values 1 / 3 / 7 / 33 / 34 / 100 all appear in the real dataset). Tapping this button should: (a) increment a per-card local tap counter **in memory only** (no backend endpoint for marking dhikr done in v1 — will land in weekly update #2 with the streak gamification); (b) when the local counter hits `repeatCount`, give a subtle haptic/animate a gold checkmark icon next to the badge. The counter resets on screen dispose (no persistence required by the backend in v1).

### Integration Totals (Adhkar Module)

| Area                                       | Count (v1 2026-08-27)                  |
| ------------------------------------------ | -------------------------------------- |
| New screens / UI states documented         | 2                                      |
| New endpoints covered                      | **4**                                  |
| Authenticated endpoints (Bearer)           | 4                                      |
| Public (no Bearer) endpoints               | 0                                      |
| HTTP statuses covered (success + error)    | 200 / 400 / 401 / 404 / 500            |
| Stable category keys defined               | 6 (`MORNING` → `GENERAL_WIRD`)         |

---

## 🔹 Global Rules (apply unchanged from the main guide)

**Before writing any Adhkar code, read `FLUTTER_INTEGRATION_GUIDE.md` § Global Rules (1..3) once.** The following items are **verbatim identical** to the rest of the app and MUST share your existing implementation:

1. **Bearer Token injection** (same interceptor, same 401 → refresh → retry-once flow, same `flutter_secure_storage`, same `INVALID_TOKEN` vs `TOKEN_EXPIRED` distinction).
2. **Generic Response Envelope** — reuse your existing `class NoorApiResponse<T>` / sealed-class deserializer. The Adhkar module never deviates from `{ success, message, data, meta, timestamp, requestId }`.
3. **Dart generic client** (`NoorApi.request()`) — use the exact same one; the sample client in the main guide already works for Adhkar endpoints without a single line of change.

**One tiny extra Flutter rule for Arabic text rendering in Adhkar cards only:** because `textAr` contains full tashkeel (diacritics) and the long Ayat al-Kursi paragraph, you MUST pass `textHeightBehavior: const TextHeightBehavior(applyHeightToFirstAscent: true, applyHeightToLastDescent: true)` and choose a **Quran-capable** font (Amiri, Scheherazade New, or Hafs v22 from the Noor brand kit) in the card TextStyle. System default Arabic fonts will render the tashkeel misaligned and break the premium 2026 visual feel.

---

## 🔹 Endpoint #1 — GET /adhkar — Adhkar Tab Home (Single call builds the whole screen)

**Description**: The one call the Adhkar bottom-nav tab fires on entry. It returns:
- `greeting` — the small decorative banner line shown above the progress hero.
- `dailyWird` — the full `وردك اليوم` hero block (title, subtitle, progress counters, CTA label, the target category key, AND the 8 preview dhikr item cards to render if you expand the hero inline).
- `categories` — the 6 tappable rows that form the main list, in correct `sortOrder` 1..6.

Use this on the **root Adhkar screen**. Do not call `/adhkar/categories` and `/adhkar/daily-wird` separately on app start — you would be making 2 round-trips when 1 is enough and you risk inconsistent DB fallback snapshots between the two calls.

**Authorization**: Bearer token required (authenticated user). Missing/expired token → 401 — run the standard refresh flow exactly as documented for the Dashboard endpoint.

**Validation**: No query params, no path params, no body. The endpoint takes zero arguments. There is no Zod schema so you will never see `errors[]` for this GET; the only rejection paths are `401 UNAUTHORIZED` (bad/expired Bearer) or `500 INTERNAL_SERVER_ERROR` (transient DB — retry with 1s backoff, then fall back to a locally-cached previous response if any).

**Behaviour**:
- The backend returns 6 category rows every single call. If the user's locale is English, you may render `.nameEn` in the card subtitle, but the primary visible label on the RTL 2026 UI MUST remain `.nameAr`.
- `dailyWird.progressItemsDone / progressItemsTotal / progressPercent` are a **cosmetic demo progress** in v1 (seeded as a deterministic function of `dayOfYear` so the progress bar looks "alive" across different days without requiring a completion endpoint). Do **NOT** branch business logic off these numbers — they are visual-only. The authoritative completion counters come in weekly update #2.
- `dailyWird.items.length` is exactly `progressItemsTotal` (default 8 in v1, clamped to never exceed `GENERAL_WIRD.totalItems` of 10). You can render these 8 items inline inside an expandable hero body OR ignore the `items[]` slice and strictly navigate to `GET /adhkar/categories/GENERAL_WIRD` — both are valid UX choices; the API supports both.
- CTA tap rule: when the user taps `dailyWird.ctaAr` ("اكمل وردك اليوم"), push the Category Detail screen with `key = dailyWird.categoryKey` (always `GENERAL_WIRD` in v1, but branch on the field value anyway — future seasons may change the daily wird to a rotating category).
- Card tap rule: when any of the 6 `categories[]` cards is tapped, push the Category Detail screen with `key = categories[i].key` (uppercase, exactly as returned). Do NOT transform or localize `key` before passing it to the path param — the backend already accepts any case, but keeping the uppercase string verbatim gives you cleaner analytics.

**Request** (no body, no query):
```
GET https://noor-app-backend-one.vercel.app/api/v1/adhkar
Authorization: Bearer <accessToken>
Content-Type: application/json
Accept: application/json
```

**Response Body (200 OK — full screen payload)**:
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
          "id": "wird-item-uuid-01",
          "orderInCategory": 1,
          "textAr": "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ",
          "textArPlain": "لا حول ولا قوة الا بالله العلي العظيم",
          "repeatCount": 100,
          "referenceAr": "رواه البخاري ومسلم",
          "benefitAr": "كنز من كنوز الجنة، ومفتاح لكل باب خير"
        },
        {
          "id": "wird-item-uuid-02",
          "orderInCategory": 2,
          "textAr": "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ",
          "repeatCount": 100,
          "referenceAr": "رواه البخاري ومسلم",
          "benefitAr": "حَقَّ عَلَى عَبْدٍ أَنْ يُصَلِّيَ عَلَى النَّبِيِّ عِنْدَ كُلِّ صَلَاةٍ"
        }
      ]
    },
    "categories": [
      {
        "id": "cat-uuid-01",
        "key": "MORNING",
        "nameAr": "اذكار الصباح",
        "nameEn": "Morning Dhikr",
        "descriptionAr": "الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم",
        "descriptionEn": "Authentic morning invocations from Hisn al-Muslim",
        "iconCode": "🌤️",
        "sortOrder": 1,
        "totalItems": 12
      },
      {
        "id": "cat-uuid-02",
        "key": "EVENING",
        "nameAr": "اذكار المساء",
        "nameEn": "Evening Dhikr",
        "descriptionAr": "أذكار المساء الواردة لما يُدخل الوقت",
        "iconCode": "🌙",
        "sortOrder": 2,
        "totalItems": 11
      },
      {
        "id": "cat-uuid-03",
        "key": "BEFORE_SLEEP",
        "nameAr": "اذكار النوم",
        "nameEn": "Before Sleep Dhikr",
        "descriptionAr": "أذكار وأدعية الوِرِ النوم من السنة",
        "iconCode": "😴",
        "sortOrder": 3,
        "totalItems": 9
      },
      {
        "id": "cat-uuid-04",
        "key": "ENTERING_MOSQUE",
        "nameAr": "اذكار المسجد",
        "nameEn": "Entering Mosque",
        "descriptionAr": "أذكار دخول المسجد والجلوس",
        "iconCode": "🕌",
        "sortOrder": 4,
        "totalItems": 10
      },
      {
        "id": "cat-uuid-05",
        "key": "AFTER_PRAYER",
        "nameAr": "اذكار الصلاة",
        "nameEn": "After Salah Dhikr",
        "descriptionAr": "الأذكار بعد الصلوات المفروضة",
        "iconCode": "🤲",
        "sortOrder": 5,
        "totalItems": 10
      },
      {
        "id": "cat-uuid-06",
        "key": "GENERAL_WIRD",
        "nameAr": "وردك اليوم",
        "nameEn": "Daily Wird",
        "descriptionAr": "ورد إضافي متنوع - أذكار يومية",
        "iconCode": "📖",
        "sortOrder": 6,
        "totalItems": 10
      }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T03:15:00.000Z",
  "requestId": "9123f8dc-1111-4e2a-bbbb-222222222222"
}
```

**Flutter deserialization hints — typed models you should create (copy these exact field names)**:
```dart
// lib/features/adhkar/models/adhkar_home_response.dart
class AdhkarHome {
  final String greeting;
  final DailyWird dailyWird;
  final List<DhikrCategory> categories;
  AdhkarHome(
      {required this.greeting,
       required this.dailyWird,
       required this.categories});
  factory AdhkarHome.fromJson(Map<String, dynamic> j) => AdhkarHome(
    greeting: j['greeting'] as String? ?? 'واذكر ربك إذا نسيت',
    dailyWird: DailyWird.fromJson(j['dailyWird'] as Map<String, dynamic>),
    categories: (j['categories'] as List<dynamic>?)
            ?.map((e) => DhikrCategory.fromJson(e as Map<String, dynamic>))
            .toList(growable: false) ??
        <DhikrCategory>[],
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
  DailyWird({/* required fields + items */});
  factory DailyWird.fromJson(Map<String, dynamic> j) => DailyWird(
    titleAr: j['titleAr'] as String,
    subtitleAr: j['subtitleAr'] as String?,
    progressItemsDone: (j['progressItemsDone'] as num?)?.toInt() ?? 0,
    progressItemsTotal: (j['progressItemsTotal'] as num?)?.toInt() ?? 8,
    progressPercent: (j['progressPercent'] as num?)?.toInt().clamp(0, 100) ?? 0,
    ctaAr: j['ctaAr'] as String? ?? 'اكمل وردك اليوم',
    categoryKey: j['categoryKey'] as String? ?? 'GENERAL_WIRD',
    items: (j['items'] as List<dynamic>?)
            ?.map((e) => DhikrItem.fromJson(e as Map<String, dynamic>))
            .toList(growable: false) ??
        <DhikrItem>[],
  );
}

class DhikrCategory {
  final String id;
  final String key; // one of DhikrCategoryKey enum below
  final String nameAr;
  final String? nameEn;
  final String? descriptionAr;
  final String? descriptionEn;
  final String iconCode; // single Unicode emoji — render as Text(iconCode, fontFamily fallback)
  final int sortOrder;   // sort client-side by THIS value; never by index-in-array.
  final int totalItems;
  DhikrCategory({/* ... */});
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
  final String textAr;          // full tashkeel — primary card body
  final String? textArPlain;    // no tashkeel — use ONLY for share-sheet previews or accessibility
  final int repeatCount;        // the (N) in التكرار (N)
  final String referenceAr;     // share-sheet second line
  final String? benefitAr;      // optional fada'il line (render ONLY when non-empty)
  DhikrItem({/* ... */});
  factory DhikrItem.fromJson(Map<String, dynamic> j) => DhikrItem(
    id: j['id'] as String,
    orderInCategory: (j['orderInCategory'] as num?)?.toInt() ?? 0,
    textAr: j['textAr'] as String,
    textArPlain: j['textArPlain'] as String?,
    repeatCount: (j['repeatCount'] as num?)?.toInt().clamp(1, 9999) ?? 1,
    referenceAr: j['referenceAr'] as String? ?? '',
    benefitAr: (j['benefitAr'] as String?)?.trim() ?? '',
  );
  // Convenience — the Share button payload.
  String get sharePayload => benefitAr != null && benefitAr!.isNotEmpty
      ? '$textAr\n\n— $referenceAr'  // v1 share = text + source ONLY (industry convention)
      : '$textAr\n\n— $referenceAr';
}

enum DhikrCategoryKey {
  morning('MORNING'),
  evening('EVENING'),
  beforeSleep('BEFORE_SLEEP'),
  enteringMosque('ENTERING_MOSQUE'),
  afterPrayer('AFTER_PRAYER'),
  generalWird('GENERAL_WIRD');
  final String raw;
  const DhikrCategoryKey(this.raw);
  static DhikrCategoryKey fromRaw(String r) =>
      DhikrCategoryKey.values.firstWhere(
        (e) => e.raw == r.trim().toUpperCase(),
        orElse: () => DhikrCategoryKey.generalWird, // fail-open
      );
}
```

**Response Body (401 — expired / missing Bearer — identical envelope to every other endpoint)**:
```json
{
  "success": false,
  "message": "Unauthorized",
  "code": "TOKEN_EXPIRED",
  "details": null,
  "timestamp": "2026-08-27T03:15:00.000Z",
  "requestId": "9123f8dc-2222-4e2a-bbbb-333333333333"
}
```
Action for Flutter: follow the exact 401 refresh flow from the main guide. Attempt `POST /auth/refresh` with stored `refreshToken`, swap the new tokens into secure storage, retry this GET **once**, then show a silent snackbar `"Refresh failed — please sign in again"` + navigate to Login only if refresh also 401s.

**Response Body (500 — transient DB / Prisma issue)**:
```json
{
  "success": false,
  "code": "DATABASE_ERROR",
  "message": "Database unavailable — try again shortly",
  "details": null,
  "timestamp": "2026-08-27T03:15:00.000Z",
  "requestId": "9123f8dc-3333-4e2a-bbbb-444444444444"
}
```
Action for Flutter: retry with 1s backoff → 2s backoff, max 2 retries. If still 500, render the Adhkar tab using the **fallback categories list** you embed in the Dart client (same 6 keys as the enum) — the real backend will already fail-open internally, but a client-side hardcoded 6-row skeleton gives you perfect zero-empty-state UX even when offline.

---

## 🔹 Endpoint #2 — GET /adhkar/categories/:key — Category Detail Screen (Tap result)

**Description**: Fetches one full category including every dhikr item inside it in authentic, numbered order. Call this when the user taps any Adhkar home card, OR when they tap the `ctaAr` "اكمل وردك اليوم" button on the wird hero (pass the key from `dailyWird.categoryKey`).

**Authorization**: Bearer token required.

**Validation — path param `:key`**:
- Accepts 6 stable values (case-insensitive, backend auto-trims & auto-uppercases):
  | Value               | nameAr            | Card icon | totalItems (seeded v1) |
  | ------------------- | ----------------- | --------- | ---------------------- |
  | `MORNING`           | اذكار الصباح       | 🌤️        | 12                     |
  | `EVENING`           | اذكار المساء       | 🌙        | 11                     |
  | `BEFORE_SLEEP`      | اذكار النوم        | 😴        | 9                      |
  | `ENTERING_MOSQUE`   | اذكار المسجد       | 🕌        | 10                     |
  | `AFTER_PRAYER`      | اذكار الصلاة       | 🤲        | 10                     |
  | `GENERAL_WIRD`      | وردك اليوم         | 📖        | 10                     |
- Any **other** string → backend throws `404 NOT_FOUND` with `code = "NOT_FOUND"`. Flutter should guard this client-side: only pass the 6 enum values (reject free-form / future keys with an info Snackbar and pop the stack).

**Behaviour**:
- `items[]` are returned strictly sorted by `orderInCategory` ascending (1..N). Flutter MUST render them in array order — do not `sort()` client-side. The seeding was authored to match the authentic *Hisn al-Muslim* sequence; reordering is a content bug.
- `items[].repeatCount`: common values in the seed dataset are `1` (long dua / ayah), `3` (Mu'awwidhat, short salawat), `7`, `33 / 34` (the 99-Name tasbih split), and `100` (Sayed al-Istighfar, Salawat al-Ibrahimiyya). Expect **all five magnitudes to appear** and size the per-card local-counter ring badge appropriately.
- `items[].benefitAr` is **nullable / empty-string** for ~20% of seed items (usually the short `SubhanAllah` phrases). Flutter must do: `if ((item.benefitAr ?? '').isNotEmpty) Padding(child: Text(item.benefitAr)) else SizedBox.shrink()` — no empty spacer.
- The Category Detail screen title should come from `data.nameAr` (not a hardcoded string), and the subtitle/hero can use `data.descriptionAr` if you want an optional header text block.
- **Future-safe padding**: the API intentionally returns `id` on every category & item row. Even though v1 does not POST/PATCH back, **store and use `DhikrItem.id` as the Flutter `ListView` item `key: ValueKey(item.id)`** so that future completion-mark updates will animate correctly when weekly update #2 adds the `/adhkar/items/:id/complete` endpoint without you rewriting the ListView.

**Request** (path param `:key` MUST be one of the 6 enum values — uppercase recommended for request logs):
```
GET https://noor-app-backend-one.vercel.app/api/v1/adhkar/categories/MORNING
Authorization: Bearer <accessToken>
Accept: application/json
```

**Response Body (200 OK — MORNING category)**:
```json
{
  "success": true,
  "message": "Dhikr category MORNING retrieved successfully",
  "data": {
    "id": "cat-uuid-morning-seeded-01",
    "key": "MORNING",
    "nameAr": "اذكار الصباح",
    "nameEn": "Morning Dhikr",
    "descriptionAr": "الأذكار الواردة لصباح المسلم كل يوم من حصن المسلم",
    "descriptionEn": "Authentic morning invocations from Hisn al-Muslim",
    "iconCode": "🌤️",
    "sortOrder": 1,
    "totalItems": 3,
    "items": [
      {
        "id": "item-uuid-m-001",
        "orderInCategory": 1,
        "textAr": "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ. اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ عَلِمَ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِۦٓ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ",
        "textArPlain": "الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض من ذا الذي يشفع عنده إلا بإذنه",
        "repeatCount": 1,
        "referenceAr": "آية الكرسي - سورة البقرة 255",
        "referenceEn": "Ayat al-Kursi — Surah Al-Baqarah v.255",
        "sourceUrl": "https://quran.com/2/255",
        "benefitAr": "من قالها حين يصبح أجير من الجن حتى يمسي (رواه البخاري ومسلم)"
      },
      {
        "id": "item-uuid-m-002",
        "orderInCategory": 2,
        "textAr": "قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ\n\nقُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ\n\nقُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ ۝ مَلِكِ ٱلنَّاسِ ۝ إِلَٰهِ ٱلنَّاسِ ۝ مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ ۝ ٱلَّذِي يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ ۝ مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ",
        "repeatCount": 3,
        "referenceAr": "المعوذات ثلاث: الإخلاص والفلق والناس",
        "benefitAr": "من قرأهن حين يصبح وحين يمسي ثلاثاً كفتاه من كل شيء (صحيح)"
      },
      {
        "id": "item-uuid-m-003",
        "orderInCategory": 3,
        "textAr": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
        "repeatCount": 100,
        "referenceAr": "رواه البخاري ومسلم",
        "benefitAr": "من قالها مئة مرة حُطَّتْ خَطَايَاهُ وَإِنْ كَانَتْ مِثْلَ زَبَدِ الْبَحْرِ"
      }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T03:15:30.000Z",
  "requestId": "9123f8dc-aaaa-4e2a-bbbb-555555555555"
}
```

**Dart reference — Category detail screen wiring (copy into the detail screen `initState`)**:
```dart
// lib/features/adhkar/screens/category_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/api/noor_api.dart';
import 'models/adhkar_models.dart'; // the DhikrCategoryKey / DhikrItem from endpoint #1

class CategoryDetailScreen extends StatefulWidget {
  final DhikrCategoryKey keyArg;
  const CategoryDetailScreen({super.key, required this.keyArg});

  @override
  State<CategoryDetailScreen> createState() => _CategoryDetailScreenState();
}

class _CategoryDetailScreenState extends State<CategoryDetailScreen> {
  DhikrCategory? _category;
  List<DhikrItem> _items = <DhikrItem>[];
  final Map<String, int> _tapCounts = <String, int>{}; // per-item local only (v1)
  bool _loading = true;
  Object? _err;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      // 👇 Reuse the generic NoorApi client from the main integration guide.
      final Map<String, dynamic> payload = await NoorApi.instance.request(
        'GET', '/adhkar/categories/${widget.keyArg.raw}',
      );
      final Map<String, dynamic> d = payload['data'] as Map<String, dynamic>;
      setState(() {
        _category = DhikrCategory.fromJson(d);
        _items = (d['items'] as List<dynamic>)
            .map((e) => DhikrItem.fromJson(e as Map<String, dynamic>))
            .toList(growable: false);
        for (final DhikrItem it in _items) { _tapCounts[it.id] = 0; }
        _err = null;
        _loading = false;
      });
    } catch (e) {
      setState(() { _err = e; _loading = false; });
    }
  }

  void _onRepeatTap(DhikrItem item) {
    HapticFeedback.lightImpact();
    setState(() {
      final int next = (_tapCounts[item.id] ?? 0) + 1;
      _tapCounts[item.id] = next < item.repeatCount ? next : item.repeatCount;
    });
  }

  void _onShareTap(DhikrItem item) {
    Share.share(item.sharePayload);
  }

  @override
  Widget build(BuildContext context) {
    // Scaffold with AppBar(title: Text(_category?.nameAr ?? ...)),
    // then ListView.builder of DhikrCard(_items[i],
    //   tapCount: _tapCounts[_items[i].id] ?? 0,
    //   onRepeat: () => _onRepeatTap,
    //   onShare: () => _onShareTap)
  }
}
```

**Response Body (404 — bad key, e.g. `categories/XYZ`)**:
```json
{
  "success": false,
  "message": "Dhikr category not found for key: XYZ",
  "code": "NOT_FOUND",
  "details": { "field": "key", "received": "XYZ" },
  "timestamp": "2026-08-27T03:15:30.000Z",
  "requestId": "9123f8dc-bbbb-4e2a-bbbb-666666666666"
}
```
Action for Flutter: show a centered `"Invalid category"` toast, pop the stack after 1.5s, and **log the bad `details.received` value to your crashlytics (`FirebaseCrashlytics.instance.log(...)`)** — this state should never happen in production if you only pass enum values.

**Response Body (401 — same envelope as every other 401; skip refresh if `code == INVALID_TOKEN`)**:
```json
{
  "success": false,
  "message": "Unauthorized",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-08-27T03:15:30.000Z",
  "requestId": "9123f8dc-cccc-4e2a-bbbb-777777777777"
}
```

---

## 🔹 Endpoint #3 — GET /adhkar/categories — Categories-only list (helper)

**Description**: Returns the 6-row `categories[]` array only — no greeting, no daily wird hero, no items. Useful for:
- A bottom-sheet "Choose category" picker you open from a filter button in a future "Search Dhikr" screen (weekly update #3).
- Prefetching category metadata (`totalItems` counters, icons, names) in the background so the Adhkar home tab paints instantly from cache before the real `/adhkar` call returns.

**Do NOT call this on the Adhkar tab mount** (you'd be duplicating the network call that `/adhkar` already provides for free). Only invoke it for the two scenarios above.

**Authorization**: Bearer.

**Response Body (200 OK — array at `data`, not nested under `data.categories`)**:
```json
{
  "success": true,
  "message": "Dhikr categories retrieved successfully",
  "data": [
    {
      "id": "cat-uuid-01",
      "key": "MORNING",
      "nameAr": "اذكار الصباح",
      "nameEn": "Morning Dhikr",
      "descriptionAr": "الأذكار الواردة لصباح المسلم",
      "iconCode": "🌤️",
      "sortOrder": 1,
      "totalItems": 12
    }
  ],
  "meta": null,
  "timestamp": "2026-08-27T03:16:00.000Z",
  "requestId": "9123f8dc-dddd-4e2a-bbbb-888888888888"
}
```
Flutter note: the returned list items match the **exact same `DhikrCategory.fromJson`** model you created for endpoint #1 (`data` is just the list directly instead of being wrapped under `data.categories`). Reuse the model verbatim:
```dart
final List<DhikrCategory> cats =
    (j['data'] as List<dynamic>)
        .map((e) => DhikrCategory.fromJson(e as Map<String, dynamic>))
        .toList(growable: false)
  ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
```

---

## 🔹 Endpoint #4 — GET /adhkar/daily-wird — Daily Wird-only hero (helper)

**Description**: Returns only the `dailyWird` block (`titleAr` through `items[]`), without the greeting or the 6 categories. Use for:
- Deep-link / FCM push notification `"اكمل وردك اليوم — 4 من 8 اذكار متبقية"` that opens directly onto the wird detail screen.
- A small "Your wird today" widget embedded on the Dashboard screen bottom.

**Do NOT call this together with `/adhkar`** — the two responses overlap; `/adhkar` already gives you `dailyWird` inside its payload for free.

**Authorization**: Bearer.

**Response Body (200 OK — exact same `DailyWird.fromJson` model)**:
```json
{
  "success": true,
  "message": "Daily wird (ورد اليوم) retrieved successfully",
  "data": {
    "titleAr": "وردك اليوم",
    "subtitleAr": "واذكر ربك إذا نسيت",
    "progressItemsDone": 4,
    "progressItemsTotal": 8,
    "progressPercent": 50,
    "ctaAr": "اكمل وردك اليوم",
    "categoryKey": "GENERAL_WIRD",
    "items": [
      {
        "id": "wird-uuid-direct-01",
        "orderInCategory": 1,
        "textAr": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
        "repeatCount": 100,
        "referenceAr": "رواه البخاري ومسلم",
        "benefitAr": "ميزان حسناتٍ ثقيلاً في الميزان يوم القيامة"
      }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T03:16:30.000Z",
  "requestId": "9123f8dc-eeee-4e2a-bbbb-999999999999"
}
```

---

## 🔹 Weekly-Update-Ready Forward-Compatibility Checklist (Flutter)

These 5 client-side decisions are **free in v1** and ensure your code does not need a rewrite when the backend adds completion/mark-as-done tracking in weekly update #2:

1. ✅ Keep `DhikrItem.id` as `ListView` item key (never use array index as key).
2. ✅ Keep per-item repeat taps in a `Map<String, int>` keyed by `DhikrItem.id` (never by index).
3. ✅ For the progress bar on the wird hero, **use `progressPercent` directly from the payload** rather than computing it client-side. The backend will switch the computation source from "demo day-of-year" to "real userId.completedIds.length / N" without Flutter needing a single line change.
4. ✅ Always pass `categories[i].key` verbatim to `GET /adhkar/categories/:key`. The key set of 6 will grow in Ramadan 2027 (e.g., `RAMADAN_WIRD`); the backend will keep the 6 v1 keys stable forever while adding new ones — your `DhikrCategoryKey.fromRaw` fail-open enum will gracefully handle unknown future keys without crashing.
5. ✅ Share payload stays **`textAr + "\n\n— " + referenceAr` only**. The backend will later add a server-composed `shareCard` image URL field next to the items; the text-based share fallback is already the correct baseline.

---

## 🔹 Adhkar Module Integration QA Checklist (before marking Flutter complete)

| # | Check | Pass if… |
| - | ----- | -------- |
| 1 | Tab #3 `الاذكار` mounts with one `GET /adhkar` call visible in DevTools network tab. | ✅ No extra `/categories` / `/daily-wird` calls fired at the same time. |
| 2 | Tapping any one of the 6 cards → navigates to `/categories/:key` → screen title is `data.nameAr` (not hardcoded). | ✅ Try MORNING / AFTER_PRAYER / GENERAL_WIRD at minimum — all 3 should resolve to their real names. |
| 3 | Long dhikr text (Ayat Al-Kursi MORNING#1) is center-aligned with proper tashkeel, no glyph overflow past card boundary. | ✅ Test in portrait on iPhone SE (smallest) and Pixel 8 Pro (largest). |
| 4 | Every card's right-side badge shows `التكرار (N)` with the verbatim server `repeatCount`. | ✅ Confirm `1 / 3 / 33 / 34 / 100` all appear across categories. |
| 5 | Tapping repeat badge increments a local counter; haptic fires; after N taps badge animates/checks. | ✅ Counter resets on screen dispose (no persistence in v1 — that is correct; weekly #2 adds it). |
| 6 | Share button (bottom-left of every card) opens OS share sheet with `textAr + referenceAr`. | ✅ Confirm no extra fields leak (e.g. `benefitAr`) into the share payload. |
| 7 | `وردك اليوم` progress bar fills exactly `progressPercent%` of its track width; gold color; no math in Dart code. | ✅ Change day of system clock forward 1 day and reload — percent moves to a different value (because backend uses `dayOfYear` demo progress). |
| 8 | HTTP 401 during any of the 4 calls triggers the global refresh interceptor once, then retry succeeds, then screen paints. | ✅ Artificially revoke access token (e.g. edit stored value to truncated garbage) and confirm screen still loads without user action after background refresh rotates tokens. |
| 9 | HTTP 404 for malformed key `GET /categories/FOO` → toast + auto-pop stack. No uncaught Dart exception. | ✅ |
| 10 | Kill backend / disable network → Flutter falls back to local cached 6-row skeleton (or hardcoded 6 fallback categories) and **never shows a blank empty ListView on the Adhkar tab.** | ✅ |
