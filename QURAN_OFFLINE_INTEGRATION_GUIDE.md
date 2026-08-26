# Noor App — Quran Offline Catalog Integration Guide — 2026-08-27

## 🔹 API Integration Changes Summary — 2026-08-27 (Offline Quran Download Batch)

- **New (2 public endpoints)**:
  - **`GET /quran/full-catalog`** — Returns the entire Quran (114 surahs + 6236 ayahs) in a single HTTP payload. Designed for a one-shot download on the "Download Mushaf for offline reading" CTA shown on the Juz/Surahs/Browse tabs. Flutter stores the result in a local embedded database (Isar / Hive are recommended; SharedPreferences is FORBIDDEN — see §Global Rules below) and uses it as the primary source of truth when the device has no network.
  - **`GET /quran/juz/{juzNumber}/ayahs`** — Returns every ayah that belongs to one specific Juz (1..30). Useful for a "Download this Juz only" lightweight download option shown when the user is on a metered network and declines the full 3.5 MB catalog. Returns the list of surahs that intersect the Juz as a convenience payload so Flutter does not need a second `GET /quran/juz/:juz/surahs` round-trip.
- **Data hygiene rules (re-iterated from the main guide; NON-NEGOTIABLE for offline cache correctness)**:
  - Every returned `textAr` is guaranteed **BOM-free** (`U+FEFF` invisible character is stripped before the payload leaves the backend). Do NOT add a client-side BOM strip on top; doing so is harmless but wasteful.
  - The standard decorative opening phrase (Bismillah) is **stripped** from `textAr` of ayah #1 of every surah **EXCEPT** Surah 1 (Al-Fatihah, where it is the actual first revealed verse of the seven) and **EXCEPT** Surah 9 (At-Tawbah, which has no decorative opening in the Mushaf tradition). The boolean `meta.bismillahStripped = true` on the catalog payload is the authoritative signal that Flutter must render its own centered gold/cream decorative widget above Surahs 2..8 and 10..114.
- **Meta/schema versioning**: The catalog payload exposes `data.meta.catalogVersion` (integer, currently `1`). Flutter MUST persist this version alongside the cached rows and compare it on every app launch. If the backend ever increments `catalogVersion`, Flutter MUST invalidate the entire local cache and re-download the catalog on the next Wi-Fi session. This protects against future Quran-text cleanup passes changing the diacritics or page/juz numbering in the DB without Flutter silently serving stale cached text.
- **No endpoints were removed, renamed, or re-ordered** in this batch. No JSON keys were added or removed from any existing response envelope. The two new routes are purely additive and live under the existing `/api/v1/quran/*` router.

### Change Totals (2026-08-27 batch)

- New endpoint documentation entries: **2**
- New offline architecture sections: **3** (Cache Schema, Download-with-Progress, Offline-First Repository)
- Updated documentation entries: **0**
- Removed documentation entries: **0**
- Wire-level API changes: none against any pre-existing endpoint.

---

## 🔹 Offline Catalog Integration Summary

- **Base URLs (store these in `env` / flavors)**: Same as the main integration guide.
  - Production (Vercel): `https://noor-app-backend-one.vercel.app/api/v1`
  - Local dev: `http://localhost:3000/api/v1`
  - Swagger UI (always the source of truth): `<base>/api/v1/docs`
- **Auth pattern**: Both endpoints below are **100% Public** (no Bearer token required). A signed-out Guest user must be able to download the full Quran cache before ever creating an account or signing in. Do NOT wrap these calls inside the `Authorization` interceptor.
- **Response envelope**: Identical to the rest of the API. 2xx uses `{ success, message, data, meta, timestamp, requestId }`; 4xx/5xx adds `{ code, errors?, details? }`.
- **Approx payload sizes for bandwidth UI labels**:
  - Full catalog **uncompressed**: ~3.2–3.8 MB (6236 Arabic ayahs with diacritics).
  - Full catalog **with Brotli/Gzip (Vercel edge applies these automatically)**: ~750–900 KB (smaller than a single Instagram photo).
  - Single Juz download: ~80 KB (uncompressed) / ~25 KB (compressed).
- **Recommended local datastores (sorted)**: **Isar ≥ Hive ≥ Drift (SQLite)**. SharedPreferences / localStorage are **FORBIDDEN** for the ayah cache — they do not support indexed queries by `(surahId, ayahNumber)` or `page` or `juz`, and reading 6236 rows out of a flat JSON blob on every cold start causes visible startup jank on 3 GB RAM Android devices.

### Integration Totals

| Area                                    | Count (2026-08-27)                                             |
| --------------------------------------- | -------------------------------------------------------------- |
| New public endpoints                    | 2                                                              |
| Required local DB tables (Flutter side) | 3 (CachedSurahMeta, CachedAyah, DownloadProgressCheckpoint)    |
| HTTP statuses covered                   | 200 / 400 / 500 / 503                                          |
| Error codes documented                  | VALIDATION_ERROR / INTERNAL_SERVER_ERROR / DATABASE_ERROR      |

---

## 🔹 Global Rules (read once, applies to both offline endpoints)

### 1) Accept & Content-Type headers

These endpoints are pure JSON (no multipart, no streaming binary). Send the standard headers even though auth is skipped:

```
Content-Type: application/json
accept: application/json
Accept-Encoding: br, gzip, deflate   (Dio applies this by default — do not override)
```

### 2) Cache schema (Flutter side — mandatory BEFORE the first download)

Create these three tables/boxes in your chosen local DB. The exact class names are up to you, but the indexed columns below must exist to avoid O(N) scans when the Quran reader jumps to a page or surah.

```dart
// lib/features/quran/data/local/models/cached_surah_meta.dart
class CachedSurahMeta {
  final int id;                 // PRIMARY INDEX = surah number 1..114
  final String nameAr;
  final String nameEn;
  final String? revelationType; // "MAKKI" | "MADANI" | null
  final int totalAyahs;
}

// lib/features/quran/data/local/models/cached_ayah.dart
@collection // Isar annotation, or equivalent Hive/Drift index
class CachedAyah {
  Id get isarId => fastHash('${surahId}_$ayahNumber'); // or use AUTOINCREMENT
  final int surahId;       // 🔶 COMPOSITE INDEX: (surahId, ayahNumber) — UNIQUE
  final int ayahNumber;
  final String textAr;     // BOM-free, Bismillah convention already applied
  final int? page;         // 1..604 physical Mushaf page (nullable for safety)
  final int? juz;          // 1..30 (nullable for safety)
}

// lib/features/quran/data/local/models/offline_catalog_info.dart
class OfflineCatalogInfo {
  final int catalogVersion;   // must match data.meta.catalogVersion from server
  final int totalAyahsCached; // integrity check after download (== 6236 for full)
  final DateTime downloadedAt;
  final String? sha256Checksum; // optional — if backend adds it in the future
}
```

**Critical indexing rule**: On the `CachedAyah` equivalent, create **three separate indices** (or one multi-column and two single). The Mushaf reader performs a `WHERE page = X` lookup; the Surah reader performs a `WHERE surahId = X ORDER BY ayahNumber` lookup; the Juz reader performs a `WHERE juz = X ORDER BY surahId, ayahNumber` lookup. Without these indices every page-open will trigger a full-table scan and the reader will lag on mid-range Android devices.

### 3) Download progress + partial resume contract

For the full catalog download UI, Flutter MUST show a linear progress bar with percentage AND bytes-transferred (the same pattern Netflix / Spotify use for offline episodes). Use Dio's built-in `onReceiveProgress` callback — the server (Vercel) always sets `Content-Length` for JSON payloads, so the `total` argument of the callback is reliable.

**Resume support (interrupted downloads — 2026 user expectation)**:

If the user loses network mid-download (e.g. at 27%), do not start over from 0%. Persist the number of bytes received so far in `DownloadProgressCheckpoint` (§2 above). On the retry, add this HTTP header:

```
Range: bytes=2764800-
```

(where `2764800` is the exact byte count of the previous successful chunk). Vercel / Node static CDNs respect the `Range` header for unbuffered JSON payloads. When the response comes back with HTTP `206 Partial Content`, prepend the previously-saved byte-chunk BEFORE parsing the concatenated JSON as one buffer.

If the backend ignores the Range request and returns `200 OK` with the full payload anyway (some corporate proxies strip Range headers), simply discard the checkpoint and overwrite the partial — this graceful fallback is acceptable.

### 4) Catalog invalidation & versioning

At every cold start of the app (AFTER the first frame renders — never block the splash):

```dart
final int remoteVersion = await _fetchCatalogVersionLightweight(); // HEAD /quran/full-catalog → parse response headers or issue a GET with Range: bytes=0-200
final int localVersion = await _localCatalogRepo.getVersion() ?? 0;
if (remoteVersion > localVersion) {
  // 🔶 SILENTLY invalidate the local cache ONLY on Wi-Fi.
  // On cellular, enqueue a WorkManager job that runs next time the user is on unmetered Wi-Fi.
  // NEVER show a blocking "Mushaf cache is outdated" dialog; replace silently in the background.
}
```

### 5) DO / DO NOT (Mushaf Offline-specific contract)

| Action                                                                 | Status          | Why                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `Isar` / `Hive` / `Drift` with the 3 indices of §2 above           | ✅ REQUIRED      | 6236 rows × 3 reads-per-page = 18k lookups per session on heavy users. Without indices UI jank is >120 ms on cheap phones.                                                                                                   |
| Use `SharedPreferences` to store the 6236 ayahs as one big JSON string | ❌ FORBIDDEN     | Serializing / deserializing a 3.5 MB JSON on every cold start takes >600 ms on a 2022 Samsung A-series and produces freezes that Play Console "Android vitals" flags as bad behaviour.                                        |
| Deserialize the full catalog JSON in the UI thread (main isolate)      | ⚠️ AVOID        | 3.5 MB of Arabic UTF-8 takes ~50 ms to parse on a Pixel 8, ~250 ms on a Samsung A14. Use `compute()` / a background isolate and then hand the typed `List<CatalogSurah>` to the Isar write transaction via ports.           |
| Wrap the DB write in one batched transaction                           | ✅ REQUIRED      | 6236 individual `put()` calls take 400–1200 ms. A single batched `isar.writeTxn((isar) => isar.cachedAyahs.putAll(rows))` takes ~35–80 ms total.                                                                              |
| Validate ayah count after download (`cachedAyahs.length == 6236`)      | ✅ REQUIRED      | Guards against a truncated response or buggy parser silently inserting only Surahs 1–110. If the count mismatch, discard the write and show a snackbar + auto-retry once on unmetered Wi-Fi.                                    |
| Prepend an extra Bismillah header on Surah 1 (Al-Fatihah) or Surah 9   | ❌ FORBIDDEN     | For Fatihah the opening phrase IS inside ayah #1 (since it is verse 1 of 7). For Tawbah no opening exists in Othmani script. Prepend only for ids 2..8 and 10..114 — exactly the same set as the online reader in §Main Guide. |

---

## 🔹 Endpoint #1 — `GET /quran/full-catalog` (Full Mushaf Offline Download)

**Description**: Returns the complete Quran corpus organized as 114 surahs with every inner ayah nested inline. The single payload contains everything a Flutter offline reader needs to render the full Surah list tab, the Juz list tab, the physical Mushaf page reader, the Surah reader, and the Juz reader — all with zero subsequent network calls until the user navigates to something non-Quran (e.g. Tasbih or Profile). Use this endpoint for the big green "تحميل المصحف للقراءة دون إنترنت" CTA at the top of the Quran browse screen.

**Authorization**: **Public**. No Bearer token. Guests can and should download this before creating an account (the Flutter onboarding tour can show a "Download the full Mushaf now — 3.2 MB" CTA right after the Google / Sign-up screens finish).

**Rate limit**: 3 requests per IP per hour (enforced at Vercel edge). Because one download is enough for ~6 months of offline use this will never be hit in practice; it exists only to blunt naive scraper bots.

**Idempotency**: Multiple identical calls return identical bytes. You may safely use the `Range` header for partial resume as described in §Global Rule #3.

### Response Body (200 OK — sample, truncated after 2 surahs; real payload has 114 entries in `data.surahs[]`)

```json
{
  "success": true,
  "message": "Full Quran catalog ready for offline download (6236 ayahs, 114 surahs)",
  "data": {
    "meta": {
      "catalogVersion": 1,
      "totalSurahs": 114,
      "totalAyahs": 6236,
      "totalPages": 604,
      "totalJuz": 30,
      "bismillahStripped": true
    },
    "surahs": [
      {
        "id": 1,
        "nameAr": "الفاتحة",
        "nameEn": "Al-Fatihah",
        "revelationType": "MAKKI",
        "totalAyahs": 7,
        "ayahs": [
          { "ayahNumber": 1, "textAr": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "page": 1, "juz": 1 },
          { "ayahNumber": 2, "textAr": "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",          "page": 1, "juz": 1 },
          { "ayahNumber": 3, "textAr": "الرَّحْمَٰنِ الرَّحِيمِ",                        "page": 1, "juz": 1 },
          { "ayahNumber": 4, "textAr": "مَالِكِ يَوْمِ الدِّينِ",                        "page": 1, "juz": 1 },
          { "ayahNumber": 5, "textAr": "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",       "page": 1, "juz": 1 },
          { "ayahNumber": 6, "textAr": "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",             "page": 2, "juz": 1 },
          { "ayahNumber": 7, "textAr": "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ", "page": 2, "juz": 1 }
        ]
      },
      {
        "id": 2,
        "nameAr": "البقرة",
        "nameEn": "Al-Baqarah",
        "revelationType": "MADANI",
        "totalAyahs": 286,
        "ayahs": [
          { "ayahNumber": 1, "textAr": "الم",                                                    "page": 2, "juz": 1 },
          { "ayahNumber": 2, "textAr": "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ هُدًى لِّلْمُتَّقِينَ", "page": 2, "juz": 1 }
        ]
      }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T19:15:00.000Z",
  "requestId": "f7c3a9b2-1111-2222-3333-0000000000aa"
}
```

**Shape notes for strict Dart builders**:

- `data.meta.revelationType` uses the same `"MAKKI" | "MADANI"` union as `GET /quran/surahs` in the main guide. Do NOT introduce a new `enum`; reuse the existing one.
- `data.meta` (inner) is **not the same** as the outer `meta` of the global envelope. The inner `data.meta` holds catalog-version counters; the outer envelope `meta` is reserved for future pagination overrides and remains `null` for this endpoint.
- In surah #2 above, `ayahs[0].textAr = "الم"` — no decorative opening phrase is prepended; `data.meta.bismillahStripped = true` is the single source of truth that tells Flutter it must render its own gold/cream Bismillah widget on top of the Surah 2 reader.

### ① Flutter Reference Implementation: `NoorOfflineQuranDownloader` (Dart / Dio / Isar)

```dart
// lib/features/quran/data/offline/noor_offline_quran_downloader.dart
import 'dart:convert';
import 'dart:isolate';

import 'package:dio/dio.dart';
import 'package:isar/isar.dart';

typedef ProgressCallback = void Function(int receivedBytes, int totalBytes, double percent);

class NoorOfflineQuranDownloader {
  final Dio _dio;      // dio instance WITHOUT auth interceptor — this endpoint is Public
  final Isar _isar;    // opened instance with CachedAyah, CachedSurahMeta, OfflineCatalogInfo collections

  NoorOfflineQuranDownloader(this._dio, this._isar);

  /// Downloads the full catalog, shows progress, parses in a background isolate,
  /// writes to Isar in ONE batched transaction, and validates the 6236-ayah count.
  /// Returns the new catalogVersion on success; throws typed exceptions on failure.
  Future<int> downloadFullCatalog({
    required ProgressCallback onProgress,
    int resumeFromBytes = 0,
    CancelToken? cancelToken,
  }) async {
    final Options options = Options(
      headers: <String, dynamic>{
        if (resumeFromBytes > 0) 'Range': 'bytes=$resumeFromBytes-',
      },
      responseType: ResponseType.bytes, // 🔶 force raw bytes so Range / resume logic is byte-exact
    );

    final Response<List<int>> resp = await _dio.get<List<int>>(
      '/quran/full-catalog',
      options: options,
      cancelToken: cancelToken,
      onReceiveProgress: (int received, int total) {
        if (total <= 0) return;                  // Content-Length missing — skip progress safely
        final int totalReceived = resumeFromBytes + received;
        final int grandTotal = resumeFromBytes + total;
        final double percent = totalReceived / grandTotal;
        onProgress(totalReceived, grandTotal, percent.clamp(0.0, 1.0));
      },
    );

    List<int> fullBytes;
    if (resp.statusCode == 206 && resumeFromBytes > 0) {
      // Concatenate the saved partial chunk with the new partial.
      // (Implement _readSavedBytes() from your DownloadProgressCheckpoint.)
      final List<int> previousChunk = await _readSavedBytes();
      fullBytes = <int>[...previousChunk, ...resp.data!];
    } else {
      fullBytes = resp.data!;
      // full content received — wipe any stale checkpoint
      await _clearSavedBytes();
    }

    // 🔶 Parse JSON in a background isolate to avoid UI jank on 3.5 MB.
    final Map<String, dynamic> json = await Isolate.run<Map<String, dynamic>>(
      () => jsonDecode(utf8.decode(fullBytes)) as Map<String, dynamic>,
    );

    final Map<String, dynamic> data = json['data'] as Map<String, dynamic>;
    final Map<String, dynamic> meta = data['meta'] as Map<String, dynamic>;
    final int catalogVersion = meta['catalogVersion'] as int;
    final int expectedAyahs = meta['totalAyahs'] as int;
    final bool bismillahStripped = meta['bismillahStripped'] as bool;
    assert(bismillahStripped == true, 'Backend contract broken — catalog must ship Bismillah stripped.');

    final List<dynamic> surahs = data['surahs'] as List<dynamic>;

    // Build typed rows in the same background-friendly sync code.
    final List<CachedSurahMeta> metas = <CachedSurahMeta>[];
    final List<CachedAyah> ayahs = <CachedAyah>[];
    for (final dynamic s in surahs) {
      final Map<String, dynamic> sm = s as Map<String, dynamic>;
      metas.add(CachedSurahMeta(
        id: sm['id'] as int,
        nameAr: sm['nameAr'] as String,
        nameEn: sm['nameEn'] as String,
        revelationType: sm['revelationType'] as String?,
        totalAyahs: sm['totalAyahs'] as int,
      ));
      final List<dynamic> as = sm['ayahs'] as List<dynamic>;
      for (final dynamic a in as) {
        final Map<String, dynamic> am = a as Map<String, dynamic>;
        ayahs.add(CachedAyah(
          surahId: sm['id'] as int,
          ayahNumber: am['ayahNumber'] as int,
          textAr: am['textAr'] as String,
          page: am['page'] as int?,
          juz: am['juz'] as int?,
        ));
      }
    }

    // 🔶 Integrity check BEFORE writing
    if (ayahs.length != expectedAyahs) {
      throw CorruptDownloadException(
        'Expected $expectedAyahs ayahs, parsed ${ayahs.length}. Check Range/resume concatenation.',
      );
    }

    // 🔶 Single batched transaction
    await _isar.writeTxn(() async {
      await _isar.cachedAyahs.clear();
      await _isar.cachedSurahMetas.clear();
      await _isar.cachedAyahs.putAll(ayahs);
      await _isar.cachedSurahMetas.putAll(metas);
      await _isar.offlineCatalogInfos.put(OfflineCatalogInfo(
        catalogVersion: catalogVersion,
        totalAyahsCached: ayahs.length,
        downloadedAt: DateTime.now().toUtc(),
      ));
    });

    return catalogVersion;
  }

  Future<List<int>> _readSavedBytes() async { /* read checkpoint file from getTemporaryDirectory */ return <int>[]; }
  Future<void> _clearSavedBytes() async { /* delete checkpoint file */ }
}
```

### Response Body (500 — transient DB / Prisma issue, retry with backoff)

```json
{
  "success": false,
  "message": "A database error occurred while fetching the Quran catalog",
  "code": "DATABASE_ERROR",
  "details": null,
  "timestamp": "2026-08-27T19:15:00.000Z",
  "requestId": "f7c3a9b2-5555-6666-7777-0000000000bb"
}
```

Action for Flutter: Do **not** show a red blocking error. Show a soft snackbar `"Download paused — retrying…"` and retry with exponential backoff (2 s, 4 s, 8 s, 16 s, max 4 attempts) using the `Range` byte-checkpoint to resume. If the fourth attempt also fails, surface a manual "Tap to retry" button and keep the checkpoint bytes intact.

### Response Body (503 — backend maintenance window or Vercel cold-start timeout)

```json
{
  "success": false,
  "message": "Service temporarily unavailable",
  "code": "INTERNAL_SERVER_ERROR",
  "timestamp": "2026-08-27T19:15:00.000Z",
  "requestId": "f7c3a9b2-9999-aaaa-bbbb-0000000000cc"
}
```

Same retry semantics as 500 (`DATABASE_ERROR`); never hard-fail the user on a 503.

---

## 🔹 Endpoint #2 — `GET /quran/juz/{juzNumber}/ayahs` (Single-Juz Offline Download)

**Description**: For users on a metered / slow network who decline the 3.2 MB full catalog, show a secondary bottom-sheet with three options:

```
📥 Download options:
   ① Full Mushaf (all 6236 ayahs, ~3.2 MB)     — calls GET /quran/full-catalog
   ② This Juz only (Juz 1, ~80 KB)             — calls GET /quran/juz/1/ayahs    ← this endpoint
   ③ Current Surah only (Al-Baqarah, ~286 ayahs)— calls the existing GET /quran/surahs/2/ayahs?perPage=999
   Cancel
```

This endpoint returns every ayah inside the requested Juz (1..30), plus the list of surah meta rows that overlap the Juz, so Flutter can render the Juz reader header (e.g. "Juz 2 — contains Al-Baqarah 142–252 + Ali 'Imran 1–92") without a separate network call.

**Authorization**: **Public** (same as the full catalog). Works for Guests and logged-in users alike.

**URL Path parameter**:

| Parameter    | Type    | Required | Valid range       | Notes                                          |
| ------------ | ------- | -------- | ----------------- | ---------------------------------------------- |
| `juzNumber`  | integer | Yes      | `1..30` inclusive | Out-of-range values fail with `400 VALIDATION_ERROR` before hitting the database. |

### Response Body (200 OK — Juz 1 sample, truncated)

```json
{
  "success": true,
  "message": "Juz 1 ayahs retrieved successfully (930 ayahs)",
  "data": {
    "juzNumber": 1,
    "nameAr": "الجزء الأول",
    "nameEn": "Juz' 1",
    "totalAyahs": 930,
    "ayahs": [
      {
        "id": 1,
        "surahId": 1,
        "ayahNumber": 1,
        "textAr": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        "page": 1,
        "juz": 1
      },
      { "id": 2, "surahId": 1, "ayahNumber": 2, "textAr": "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", "page": 1, "juz": 1 }
    ],
    "surahs": [
      { "id": 1, "nameAr": "الفاتحة", "nameEn": "Al-Fatihah", "revelationType": "MAKKI" },
      { "id": 2, "nameAr": "البقرة",  "nameEn": "Al-Baqarah", "revelationType": "MADANI" }
    ]
  },
  "meta": null,
  "timestamp": "2026-08-27T19:20:00.000Z",
  "requestId": "f7c3a9b2-dddd-eeee-ffff-0000000000dd"
}
```

**Shape notes**: The `data.ayahs[]` items use the EXACT same field names and JSON types as `GET /quran/surahs/:surahId/ayahs` in the main guide — `id`, `surahId`, `ayahNumber`, `textAr`, `page`, `juz`. Reuse your existing `AyahDto` Dart `fromJson` model verbatim; do not create a second copy for Juz-ayahs.

### Response Body (400 — bad `juzNumber` outside 1..30)

```json
{
  "success": false,
  "message": "Invalid juz number (1..30)",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "juzNumber",
      "message": "juzNumber must be between 1 and 30",
      "code": "too_big"
    }
  ],
  "timestamp": "2026-08-27T19:20:00.000Z",
  "requestId": "f7c3a9b2-4444-5555-6666-0000000000ee"
}
```

**Action for Flutter**: This code path should never occur through UI taps (your Juz list only renders 30 chips numbered 1..30). If you see this in production logs it means a deeplink was manually typed with `juz=31` or `juz=0`. In that case navigate the user to the Juz browse tab and show a snackbar `"Juz not found — please choose from 1 to 30."`; do NOT attempt retry (the error is deterministic and client-side).

### ① Flutter Reference Implementation: `JuzDownloadBottomSheet` (simplified)

```dart
// inside onPressed() of "② Download this Juz only" chip
Future<void> _downloadJuz(BuildContext ctx, int juzNumber) async {
  final Dio dio = NoorDioFactory.publicDio();   // dio WITHOUT auth interceptor
  final Response<Map<String, dynamic>> resp =
      await dio.get<Map<String, dynamic>>('/quran/juz/$juzNumber/ayahs');
  final Map<String, dynamic> envelope = resp.data!;
  final Map<String, dynamic> data = envelope['data'] as Map<String, dynamic>;
  final List<dynamic> raw = data['ayahs'] as List<dynamic>;
  final List<CachedAyah> rows = raw
      .map((dynamic e) => CachedAyah(
            surahId: (e as Map<String, dynamic>)['surahId'] as int,
            ayahNumber: e['ayahNumber'] as int,
            textAr: e['textAr'] as String,
            page: e['page'] as int?,
            juz: e['juz'] as int?,
          ))
      .toList();
  await isar.writeTxn(() async {
    // 🔶 Use putAll (insert-or-update) so overlapping ayahs from prior Juz downloads
    // are idempotent, and the cache gradually fills up toward the full 6236.
    await isar.cachedAyahs.putAll(rows);
  });
  if (ctx.mounted) {
    ScaffoldMessenger.of(ctx).showSnackBar(
      SnackBar(content: Text('Juz $juzNumber saved for offline reading (${rows.length} ayahs) ✓')),
    );
  }
}
```

---

## 🔹 Appendix — Offline-First Repository Pattern (How the rest of the Quran features use the cache)

Once either the full catalog or a partial Juz download has been stored locally, change ALL Quran repositories (Surah list, Juz list, Mushaf page reader, Last-read resume, Bookmarks text preview) from this naive pattern:

```dart
// ❌ OLD: always-network — fails as soon as user is on airplane mode
class NaiveQuranRepository {
  Future<List<AyahDto>> getSurahAyahs(int surahId) async {
    final resp = await _dio.get('/quran/surahs/$surahId/ayahs');
    return parse(resp.data);
  }
}
```

…to this OFFLINE-FIRST pattern (same one Spotify / Google Maps use for cached media):

```dart
// ✅ NEW: cache-first with graceful network fallback
class OfflineFirstQuranRepository {
  final Isar _isar;
  final Dio  _dio;

  OfflineFirstQuranRepository(this._isar, this._dio);

  Future<List<AyahDto>> getSurahAyahs(int surahId) async {
    // 1. Hit local cache FIRST — zero network, sub-millisecond latency
    final List<CachedAyah>? cached = await _isar.cachedAyahs
        .where()
        .surahIdEqualTo(surahId)
        .sortByAyahNumber()
        .findAll();

    if (cached != null && cached.isNotEmpty) {
      return cached.map((CachedAyah a) => AyahDto.fromCached(a)).toList();
    }

    // 2. Cache MISS → call network, transparently write back into the cache
    //    so the NEXT call for the same surah is zero-latency.
    final resp = await _dio.get<Map<String, dynamic>>('/quran/surahs/$surahId/ayahs?perPage=999');
    final List<AyahDto> remote = _parseAyahList(resp.data!);
    await _isar.writeTxn(() =>
        _isar.cachedAyahs.putAll(remote.map((AyahDto a) => CachedAyah(
          surahId: a.surahId, ayahNumber: a.ayahNumber,
          textAr: a.textAr, page: a.page, juz: a.juz,
        )).toList()));
    return remote;
  }
}
```

This single refactor makes the **entire** Quran feature tree (Surahs / Juz / Pages / Search / Bookmarks / Last Read / Khatmah stats) "appear offline-capable" even for users who never tapped the big green download CTA — because every network read is simultaneously a cache-warm write that progressively fills the local DB.

---

## 🔹 Support Checklist (go-live gate for Flutter offline download)

Before shipping the "Download Mushaf" CTA on Play Store production, tick every item below:

- [ ] `CachedAyah` has indices on `(surahId, ayahNumber)`, `page`, and `juz`.
- [ ] Download uses Dio `onReceiveProgress` AND progress bytes are shown next to percentage (e.g. `2.1 / 3.2 MB — 66%`).
- [ ] Resume with `Range: bytes=N-` is tested by manually toggling airplane mode mid-transfer on a real Android device.
- [ ] Parse of the 3.5 MB payload happens in a background `Isolate.run` / `compute()`; main isolate is free for animation.
- [ ] Write of 6236 ayahs is ONE batched transaction, not 6236 individual calls.
- [ ] Post-write integrity check (`cachedAyahs.length == 6236`) is enforced; mismatches discard the write + show a snackbar + schedule Wi-Fi retry.
- [ ] `catalogVersion` is stored locally; cold-start compares remote vs local; on mismatch cache silently replaces on Wi-Fi only.
- [ ] The Bismillah decorative header widget in the Quran reader respects EXACTLY the same rule set as the online reader (Fatihah + Tawbah render NO extra header; 112 other surahs DO render one). Automated golden test: screenshot Surahs 1, 2, 9, 10 — verify header widget presence.
- [ ] Sign-up / onboarding flow allows a pure-Guest user to tap "Download Mushaf" on the very first screen of the app with no login prompt.
- [ ] Guest + signed-in caches share the same Isar instance; logging out does NOT erase the downloaded Mushaf (users expect to keep their offline Quran even after signing out of their account with points / tasbih).
- [ ] On iOS App Store Connect and Google Play Console, the "app uses offline content" disclosure is ticked, and the privacy policy names "Quran text cached locally for offline reading" as one of the stored-on-device data categories.
