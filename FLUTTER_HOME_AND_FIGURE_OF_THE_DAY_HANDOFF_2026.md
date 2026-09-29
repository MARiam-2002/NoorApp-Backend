# Flutter Home Screen + Figure of the Day (“شخصية اليوم”) Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-29  
**Language:** English only  

**Backend status:** Every section of the Home screen is served by a live endpoint. **Figure of the Day is new**: an additive `figureOfTheDay` object on `GET /dashboard` plus three public endpoints for the detail screen. No existing field, id, type or route was renamed or removed.

**Related:** [`FLUTTER_INTEGRATION_GUIDE.md`](FLUTTER_INTEGRATION_GUIDE.md) (top section, 2026-09-29) · [`FLUTTER_JOURNEY_SCREEN_HANDOFF_2026.md`](FLUTTER_JOURNEY_SCREEN_HANDOFF_2026.md) · [`FLUTTER_AZKAR_DASHBOARD_HANDOFF_2026.md`](FLUTTER_AZKAR_DASHBOARD_HANDOFF_2026.md) · [`FLUTTER_GUEST_ACCESS_HANDOFF_2026.md`](FLUTTER_GUEST_ACCESS_HANDOFF_2026.md)

---

## 1. Screen map → Backend

### 1.1 Home screen (“الرئيسية”)

| UI element (Arabic) | Backend source | Fields |
|---------------------|----------------|--------|
| Weekday + Hijri date (e.g. السبت 15 ذو القعدة) | `GET /dashboard` | `greeting.weekdayName`, `greeting.hijriDate` (optional `greeting.gregorianDate`) |
| اهلا أحمد | same | `greeting.displayName` |
| Bell badge | `GET /notifications/unread-count` | `unreadCount` (same value as `count`) |
| متبقي على الصلاة + name + countdown | `GET /dashboard` | `prayers.nextPrayer.nameAr`, `prayers.nextPrayer.countdownSeconds`, `prayers.nextPrayer.iso` |
| 5 prayer times + dots | same | `prayers.schedule[]` → `nameAr`, `displayAr`, `completed` (always 5 items) |
| آية اليوم | same | `verseOfTheDay.textAr`, `verseOfTheDay.referenceAr` |
| مشاركة (verse / hadith) | none | Client-side share of the text shown |
| رحلتك اليوم — الصلاة | same | `dailyJourney.prayer.completed` / `total`, `labelAr`, `captionAr` |
| رحلتك اليوم — القرآن | same | `dailyJourney.quran.pagesRead` / `target`, `labelAr`, `captionAr` |
| رحلتك اليوم — الأذكار | same | `dailyJourney.adhkar.progressItemsDone` / `progressItemsTotal` / `progressPercent`, `completed` |
| رحلتك اليوم — الصدقة | same | `dailyJourney.sadaqah.amount`, `goal`, `percent`, `currencyLabelAr` |
| هدف اليوم (ring, e.g. 4 / 5) | `GET /quran/khatmah/stats` | `dailyGoal.pagesReadToday` / `dailyGoal.pagesTarget`, `dailyGoal.completed` |
| المزيد — القبلة / المسبحة | `GET /dashboard` | `utilities.qibla.enabled`, `utilities.tasbih.enabled` |
| استكمل الختمة | same | `khatmah.surahNameAr`, `khatmah.currentPage`, `khatmah.progressPercent` |
| آيات السجود (e.g. 3 / 12 تمت) | `GET /quran/sajdah-verses/my-progress` | `summary.fullCompleted` / `summary.fullTotal` (or `muataqidahCompleted` / `muataqidahTotal`) |
| **شخصية اليوم (new)** | `GET /dashboard` | **`figureOfTheDay.nameAr`, `titleAr`, `summaryAr`, `id`** |
| حديث اليوم | same | `hadithOfTheDay.textAr`, `hadithOfTheDay.sourceAr` |
| موقف اليوم | `GET /stances/today` | `situation.situationAr`, `situation.labelAr`, `situation.alreadyAnswered` |
| تحدي اليوم | `GET /dashboard` | `dailyChallenge.titleAr`, `descriptionAr`, `rewardPoints`, `targetValue`, `completed`, `claimed` |

The numbers in the Figma file (12 sajdah verses, 50 points, 5 pages, and so on) are placeholders. Always render the values from the API.

### 1.2 Figure of the Day detail screen (“شخصية اليوم”)

| UI element (Arabic) | Backend source | Fields |
|---------------------|----------------|--------|
| Screen title شخصية اليوم | static | — |
| Avatar circle | none | **No portrait.** See §6.1 |
| Name (مصعب بن عمير) | `GET /content/figures/{id}` | `nameAr` (+ optional `honorificAr`, e.g. رضي الله عنه) |
| Subtitle (أول سفير في الإسلام) | same | `titleAr` |
| Story paragraphs | same | `storyAr[]` (currently 3 per figure; render all) |
| اقرأ المزيد | client | Collapse to the first 2 paragraphs; expand shows the rest + lesson + evidence |
| Lesson (optional block) | same | `lessonAr` |
| Evidence quotes (optional block) | same | `evidence[]` → `textAr` + `sourceAr` |
| Sources footer (optional) | same | `sources[]` → `titleAr` — `authorAr` |
| Heart icon | local only | See §6.2 |

---

## 2. Endpoints

| Method | Path | Auth | Use |
|--------|------|------|-----|
| `GET` | `/dashboard` | **Bearer** | **Primary Home payload**, including the new `figureOfTheDay` |
| `GET` | `/notifications/unread-count` | Bearer | Bell badge |
| `GET` | `/quran/khatmah/stats` | Bearer | هدف اليوم ring (`dailyGoal`) |
| `GET` | `/quran/sajdah-verses/my-progress` | Bearer | آيات السجود card |
| `GET` | `/stances/today` | Optional Bearer | موقف اليوم card (guest works) |
| `GET` | `/content/figure-of-day?day=` | Public | **New.** Today's figure (full detail) |
| `GET` | `/content/figures` | Public | **New.** Lite list of all figures + `catalogVersion` |
| `GET` | `/content/figures/{id}` | Public | **New.** Full detail for one figure (opened from the Home card) |
| `GET` | `/content/credits` | Public | Sources screen. Now `version: 2` with a `figures` item |

**Guest (no login):** `/dashboard` returns `401`. For a guest Home screen, use the public endpoints: `/content/verse-of-day`, `/content/hadith-of-day`, `/content/figure-of-day`, `/stances/today`, `/prayers/today`, `/quran/sajdah-verses`.

---

## 3. Response contracts

All responses use the standard envelope `{ success, message, data, meta, timestamp, requestId }`. Errors add `{ code, details }`.

### 3.1 `GET /dashboard` → `data.figureOfTheDay` (additive, never `null`)

```json
{
  "figureOfTheDay": {
    "id": "uthman-ibn-affan",
    "nameAr": "عثمان بن عفان",
    "nameEn": "Uthman ibn Affan",
    "honorificAr": "رضي الله عنه",
    "titleAr": "ذو النورين، ثالث الخلفاء الراشدين",
    "titleEn": "Dhu an-Nurayn, the third Caliph",
    "summaryAr": "ذو النورين الذي تزوج ابنتي النبي ﷺ، وجهّز جيش العسرة، وجمع الأمة على مصحف واحد."
  }
}
```

The other dashboard keys (`greeting`, `prayers`, `verseOfTheDay`, `hadithOfTheDay`, `dailyJourney`, `khatmah`, `dailyChallenge`, `utilities`) are unchanged.

### 3.2 Real `GET /dashboard` sample (Production, 2026-09-29, new account, default Cairo location)

```json
{
  "success": true,
  "message": "Dashboard loaded successfully",
  "data": {
    "greeting": {
      "displayName": "Capture", "weekdayName": "الثلاثاء", "hijriDate": "١٨ ربيع الآخر ١٤٤٨ هـ",
      "points": 0, "fullName": "Capture", "username": "cap_1790701367105_5212", "gregorianDate": "٢٩ سبتمبر ٢٠٢٦"
    },
    "prayers": {
      "nextPrayer": { "name": "Fajr", "nameAr": "الفجر", "time": "05:21", "displayAr": "٥:٢١ ص", "displayEn": "5:21 AM",
                      "iso": "2026-09-30T02:21:00.000Z", "countdownSeconds": 33484, "key": "FAJR" },
      "schedule": [
        { "name": "Fajr", "nameAr": "الفجر", "time": "05:21", "displayAr": "٥:٢١ ص", "displayEn": "5:21 AM",
          "iso": "2026-09-29T02:21:00.000Z", "completed": false, "key": "FAJR" }
      ],
      "date": "2026-09-29", "timezone": "Africa/Cairo", "completedCount": 0, "totalCount": 5,
      "city": "Cairo", "cityAr": "القاهرة", "isDefaultLocation": true,
      "sunrise": { "name": "Sunrise", "key": "SUNRISE", "nameAr": "الشروق", "time": "06:47", "trackable": false }
    },
    "verseOfTheDay": { "textAr": "قَدْ أَفْلَحَ مَن زَكَّىٰهَا", "referenceAr": "سورة الشمۡس — آية 9", "surahNumber": 91, "ayahNumber": 9 },
    "hadithOfTheDay": { "textAr": "…", "sourceAr": "رواه مسلم — رقم 1471" },
    "figureOfTheDay": { "id": "uthman-ibn-affan", "nameAr": "عثمان بن عفان", "…": "see 3.1" },
    "dailyJourney": {
      "prayer": { "completed": 0, "total": 5, "progress": 0, "labelAr": "الصلوات", "captionAr": "0 صلاة مكتملة اليوم" },
      "quran": { "pagesRead": 0, "target": 5, "labelAr": "القرآن", "captionAr": "0 صفحة مقروءة اليوم" },
      "adhkar": { "completed": false, "labelAr": "الأذكار", "captionAr": "اكمل وردك اليومي",
                  "progressItemsDone": 0, "progressItemsTotal": 8, "progressPercent": 0 },
      "sadaqah": { "amount": 0, "labelAr": "الصدقة", "captionAr": "0 ج.م مصدقة اليوم",
                   "goal": 1000, "percent": 0, "currency": "EGP", "currencyLabelAr": "جنيه" },
      "nawafel": { "completed": 0, "total": 12, "progress": 0, "labelAr": "الرواتب", "captionAr": "0 من 12 ركعة اليوم" }
    },
    "khatmah": { "surahId": 2, "surahNameAr": "البقرة", "currentPage": 1, "progressPercent": 0, "surahNameEn": "Al-Baqara" },
    "dailyChallenge": { "titleAr": "أربع صفحات من القرآن", "descriptionAr": "اقرأ أربع صفحات من القرآن الكريم",
                        "rewardPoints": 100, "targetValue": 4, "completed": false, "claimed": false },
    "utilities": { "tasbih": { "enabled": true }, "qibla": { "enabled": true } }
  }
}
```

(`schedule` always has 5 items; one is shown here. `…` marks text shortened for this document.)

### 3.3 Other Home cards (real Production shapes)

`GET /notifications/unread-count`

```json
{ "count": 0, "unreadCount": 0 }
```

`GET /quran/khatmah/stats` → use `dailyGoal` for هدف اليوم

```json
{
  "surahId": 2, "surahNameAr": "البقرة", "currentPage": 1, "progressPercent": 0,
  "dailyGoal": { "pagesTarget": 5, "pagesReadToday": 0, "completed": false, "remainingToday": 5 },
  "plan": { "active": false, "labelAr": "لا توجد خطة ختمة نشطة", "ctaAr": "ختمة جديدة" }
}
```

`GET /quran/sajdah-verses/my-progress` → use `summary` for the card and `rows` for the list screen

```json
{
  "summary": { "muataqidahCompleted": 0, "muataqidahTotal": 10, "muataqidahPercent": 0,
               "fullCompleted": 0, "fullTotal": 15, "fullPercent": 0, "lastCompletedAt": null },
  "rows": [ { "surahId": 7, "ayahNumber": 206, "verseKey": "7:206", "referenceAr": "سورة الأعراف - آية 206",
              "textAr": "…", "completed": false, "completedAt": null, "sortOrder": 1 } ]
}
```

`GET /stances/today`

```json
{
  "dayOfYear": 272, "isToday": true,
  "situation": { "id": "stance_032", "labelAr": "موقف اليوم",
                 "situationAr": "حلفت يميناً على شيء ثم رأيت غيره خيراً منه، موقفك إيه؟",
                 "options": [ { "key": "A", "textAr": "…" }, { "key": "B", "textAr": "…" }, { "key": "C", "textAr": "…" } ],
                 "rewardPoints": 15, "alreadyAnswered": false, "selectedOptionKey": null },
  "reveal": null
}
```

### 3.4 `GET /content/figure-of-day?day=` (new, public)

`day` is optional (1..366). Without it, the server returns today's figure, which always equals `dashboard.figureOfTheDay.id` on the same server day.

```json
{
  "success": true,
  "message": "Figure of the day retrieved successfully",
  "data": {
    "dayOfYear": 272,
    "catalogVersion": 1,
    "id": "uthman-ibn-affan",
    "nameAr": "عثمان بن عفان",
    "nameEn": "Uthman ibn Affan",
    "honorificAr": "رضي الله عنه",
    "titleAr": "ذو النورين، ثالث الخلفاء الراشدين",
    "titleEn": "Dhu an-Nurayn, the third Caliph",
    "summaryAr": "ذو النورين الذي تزوج ابنتي النبي ﷺ، وجهّز جيش العسرة، وجمع الأمة على مصحف واحد.",
    "storyAr": [
      "أسلم عثمان بن عفان مبكرًا، وتزوج رقية بنت النبي ﷺ، ثم أم كلثوم بعد وفاتها، فلُقّب بذي النورين، وهاجر إلى الحبشة ثم إلى المدينة.",
      "كان من أكرم الصحابة وأشدهم حياءً، وجهّز جيش العسرة في غزوة تبوك، فبشّره النبي ﷺ بالجنة.",
      "تولى الخلافة بعد عمر، وفي عهده جُمع الناس على مصحف واحد أُرسلت نسخه إلى الأمصار، واستشهد في داره سنة 35هـ."
    ],
    "lessonAr": "الحياء خلق يحبه الله، والمال نعمة إذا أُنفق في الخير.",
    "evidence": [
      { "collection": "muslim", "collectionAr": "صحيح مسلم", "number": 2401,
        "textAr": "أَلاَ أَسْتَحِي مِنْ رَجُلٍ تَسْتَحِي مِنْهُ الْمَلاَئِكَةُ", "sourceAr": "رواه مسلم — رقم 2401" },
      { "collection": "bukhari", "collectionAr": "صحيح البخاري", "number": 2778,
        "textAr": "مَنْ جَهَّزَ جَيْشَ الْعُسْرَةِ فَلَهُ الْجَنَّةُ", "sourceAr": "رواه البخاري — رقم 2778" }
    ],
    "sources": [
      { "titleAr": "صحيح البخاري", "authorAr": "الإمام محمد بن إسماعيل البخاري" },
      { "titleAr": "صحيح مسلم", "authorAr": "الإمام مسلم بن الحجاج" },
      { "titleAr": "الإصابة في تمييز الصحابة", "authorAr": "ابن حجر العسقلاني" },
      { "titleAr": "سير أعلام النبلاء", "authorAr": "شمس الدين الذهبي" }
    ]
  }
}
```

### 3.5 `GET /content/figures/{id}` (new, public)

Same shape as 3.4 **without** `dayOfYear`. Example id from the Figma design: `musab-ibn-umair` → `nameAr: "مصعب بن عمير"`, `titleAr: "أول سفير في الإسلام"`.

### 3.6 `GET /content/figures` (new, public)

```json
{
  "catalogVersion": 1,
  "total": 34,
  "items": [
    { "id": "musab-ibn-umair", "nameAr": "مصعب بن عمير", "nameEn": "Mus'ab ibn Umair", "honorificAr": "رضي الله عنه",
      "titleAr": "أول سفير في الإسلام", "titleEn": "The first envoy of Islam",
      "summaryAr": "فتى قريش المنعَّم الذي ترك الترف من أجل الإسلام، وأرسله النبي ﷺ إلى المدينة يعلّم أهلها القرآن قبل الهجرة." }
  ]
}
```

Items have the same 7 keys as `dashboard.figureOfTheDay`. Use `total` / `items.length`; never hardcode 34.

### 3.7 Field reference (figures)

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| `id` | String | no | Stable slug, e.g. `musab-ibn-umair`. Safe to store (favorites, cache keys) |
| `nameAr` / `nameEn` | String | no | |
| `honorificAr` | String | no | `رضي الله عنه` / `رضي الله عنها` / `رضي الله عنهما` |
| `titleAr` / `titleEn` | String | no | Subtitle under the name |
| `summaryAr` | String | no | One sentence for the Home card |
| `storyAr` | List\<String\> | no | Currently 3 paragraphs; don't hardcode the count |
| `lessonAr` | String | no | |
| `evidence` | List\<Evidence\> | no | ≥ 1 item |
| `evidence[].collection` | String | no | `bukhari` \| `muslim` |
| `evidence[].number` | int | no | Standard number (Bukhari: Fath al-Bari; Muslim: Fuad Abd al-Baqi) |
| `evidence[].textAr` | String | no | Verbatim excerpt. Multiple excerpts from one hadith are joined with ` … ` |
| `evidence[].sourceAr` | String | no | Always `رواه البخاري — رقم N` or `رواه مسلم — رقم N` |
| `sources` | List\<{titleAr, authorAr}\> | no | Reference books for the biographies |
| `catalogVersion` | int | no | Bumps only when figure content changes |
| `dayOfYear` | int | no | Only in `/content/figure-of-day` |

### 3.8 Errors

| Case | Status | `code` |
|------|--------|--------|
| `/content/figure-of-day?day=0`, `367`, `abc` | `400` | `VALIDATION_ERROR` |
| `/content/figures/{unknown}` | `404` | `NOT_FOUND` |
| `/dashboard` without Bearer | `401` | `UNAUTHORIZED` |
| Too many requests from one client in a short window | `429` | `RATE_LIMIT_EXCEEDED` (back off and retry; don't loop over all figures on launch) |

---

## 4. Dart models (figures)

```dart
class FigureLite {
  final String id, nameAr, nameEn, honorificAr, titleAr, titleEn, summaryAr;

  FigureLite.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        nameAr = j['nameAr'] as String,
        nameEn = j['nameEn'] as String,
        honorificAr = j['honorificAr'] as String,
        titleAr = j['titleAr'] as String,
        titleEn = j['titleEn'] as String,
        summaryAr = j['summaryAr'] as String;
}

class FigureEvidence {
  final String collection, collectionAr, textAr, sourceAr;
  final int number;

  FigureEvidence.fromJson(Map<String, dynamic> j)
      : collection = j['collection'] as String,
        collectionAr = j['collectionAr'] as String,
        number = j['number'] as int,
        textAr = j['textAr'] as String,
        sourceAr = j['sourceAr'] as String;
}

class FigureSource {
  final String titleAr, authorAr;

  FigureSource.fromJson(Map<String, dynamic> j)
      : titleAr = j['titleAr'] as String,
        authorAr = j['authorAr'] as String;
}

class FigureDetail extends FigureLite {
  final int? dayOfYear; // only present in /content/figure-of-day
  final int catalogVersion;
  final List<String> storyAr;
  final String lessonAr;
  final List<FigureEvidence> evidence;
  final List<FigureSource> sources;

  FigureDetail.fromJson(Map<String, dynamic> j)
      : dayOfYear = j['dayOfYear'] as int?,
        catalogVersion = j['catalogVersion'] as int,
        storyAr = List<String>.from(j['storyAr'] as List),
        lessonAr = j['lessonAr'] as String,
        evidence = (j['evidence'] as List)
            .map((e) => FigureEvidence.fromJson(e as Map<String, dynamic>))
            .toList(),
        sources = (j['sources'] as List)
            .map((e) => FigureSource.fromJson(e as Map<String, dynamic>))
            .toList(),
        super.fromJson(j);
}
```

In the existing `DashboardData` model, add one field. Keep it nullable on the client so older cached payloads still parse:

```dart
final FigureLite? figureOfTheDay;
// fromJson:
figureOfTheDay = j['figureOfTheDay'] == null
    ? null
    : FigureLite.fromJson(j['figureOfTheDay'] as Map<String, dynamic>),
```

---

## 5. Exact Flutter wiring

### 5.1 Home load

1. Logged in: call in parallel:
   - `GET /dashboard`
   - `GET /notifications/unread-count`
   - `GET /quran/khatmah/stats`
   - `GET /quran/sajdah-verses/my-progress`
   - `GET /stances/today`
2. Render each card from its own response. One failing card must not blank the whole screen: show that card's placeholder and keep the rest.
3. Prayer countdown: start from `prayers.nextPrayer.countdownSeconds` and count down locally. When it reaches 0, re-fetch `/dashboard`.
4. Re-fetch `/dashboard` on app resume, after the day changes, and after any progress action (prayer toggle, Quran pages, adhkar, sadaqah, challenge claim).
5. Guest: skip the Bearer calls and use the public endpoints listed in §2.

### 5.2 Figure of the Day card → detail

1. The Home card shows `figureOfTheDay.nameAr` (title), `titleAr` (subtitle) and optionally `summaryAr`.
2. «اقرأ القصة» → navigate with `figureOfTheDay.id` → `GET /content/figures/{id}`.
3. Detail screen, top to bottom:
   - `nameAr` + `honorificAr`
   - `titleAr`
   - the first 2 `storyAr` paragraphs
   - «اقرأ المزيد», which expands to show:
     - the remaining paragraphs
     - `lessonAr`
     - every `evidence` item: `textAr` as a quote, `sourceAr` under it
     - the `sources` footer
4. Cache the detail by `id` + `catalogVersion`. Content only changes when `catalogVersion` changes.
5. Guest Home: use `GET /content/figure-of-day`. It already contains the full detail, so no second call is needed.

### 5.3 Daily rollover

Verse, hadith, figure, challenge and stance of the day all follow the **server day**, which rolls over at **00:00 UTC (03:00 Cairo)**. Don't compute "today's figure" on the device. Show what the API returns.

The figure rotation shows all figures once before any repeats, and consecutive days never show the same figure.

---

## 6. Product notes (please apply)

### 6.1 No portraits of Companions

The Figma avatar draws a face for Mus'ab ibn Umair. Depicting the Sahaba is not permitted (Al-Azhar and the major fatwa bodies), and the API intentionally has **no image field**.

Replace the avatar with one of:
- calligraphy of `nameAr` in a circle, or
- a neutral geometric/Islamic pattern.

The same asset can be reused for every figure.

### 6.2 Heart (favorite) is local

There is no server endpoint for figure favorites. Store favorite ids on the device (SharedPreferences / Hive), keyed by `id`. Ids are stable across catalog versions.

### 6.3 Sources screen

`GET /content/credits` now returns `version: 2` with a new item, `key: "figures"`. Render all items from the response; don't hardcode the list.

---

## 7. What existed vs what changed

| Already existed (unchanged) | This pass |
|-----------------------------|-----------|
| `GET /dashboard` and all its keys | **Additive** `figureOfTheDay` (7 string fields, never `null`) |
| Verse / hadith / challenge / stance of the day | Unchanged |
| `/notifications/unread-count`, `/quran/khatmah/stats`, `/quran/sajdah-verses/my-progress` | Unchanged |
| `GET /content/credits` (`version: 1`) | `version: 2` + `figures` item |
| — | **New** `GET /content/figure-of-day`, `GET /content/figures`, `GET /content/figures/{id}` |

**Not changed:** auth, Journey, Adhkar, Quran, Azan, and every existing field name and type. No database migration was needed; figures are a static catalog in the backend.

---

## 8. Content sourcing (for the About / review screen)

- **34 Companions (رضي الله عنهم).**
- **Biographies:** follow «الإصابة في تمييز الصحابة» (Ibn Hajar) and «سير أعلام النبلاء» (al-Dhahabi).
- **Evidence:** every figure has at least one narration quoted **verbatim** from Sahih al-Bukhari or Sahih Muslim, 52 narrations in total.
  - Each quote carries its standard hadith number.
  - The quotes are extracted by code from the full hadith collections, so the backend never paraphrases a hadith.

---

## 9. Production checklist (verified 2026-09-29 on the base URL above)

Verified with `scripts/smoke-home-figure-production.ts`, using a temporary account that is deleted at the end. **56 / 56 checks passed.**

- [x] `GET /content/figure-of-day` → 200 with all detail keys + `dayOfYear`
- [x] `?day=1` ≠ `?day=2`, and the same day is stable across calls
- [x] `?day=0`, `?day=367`, `?day=abc` → 400 `VALIDATION_ERROR`
- [x] `GET /content/figures` → 200, `total = items.length = 34`, lite items only, unique ids
- [x] All 34 `GET /content/figures/{id}` → 200 with evidence
- [x] `GET /content/figures/musab-ibn-umair` → `مصعب بن عمير` / `أول سفير في الإسلام` (matches Figma)
- [x] `GET /content/figures/unknown-person` → 404 `NOT_FOUND`
- [x] `GET /content/credits` → `version: 2` with `figures`
- [x] `GET /dashboard` without token → 401
- [x] `GET /dashboard` → all sections present; `figureOfTheDay` has exactly 7 keys and equals today's `/content/figure-of-day` id
- [x] `prayers.schedule.length === 5`, `nextPrayer.countdownSeconds` is a number, `hijriDate` is present
- [x] `/notifications/unread-count`, `/quran/khatmah/stats`, `/quran/sajdah-verses/my-progress`, `/challenges/today`, `/journey/today`, `/stances/today` → 200
- [x] Public Home sections for guests (`verse-of-day`, `hadith-of-day`, `stances/today`, `sajdah-verses`, `prayers/today`) → 200

**FLUTTER HANDOFF STATUS: READY**
