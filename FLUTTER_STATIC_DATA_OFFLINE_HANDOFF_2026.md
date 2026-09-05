# Flutter Static Data Offline Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-06  
**Language:** English only  

**Backend status:** Static offline packs are **READY** and **VERIFIED ON PRODUCTION** (2026-09-06, no Bearer token).

---

## 1. What Flutter must build

Backend provides one-time Quran + Adhkar packs. Flutter downloads them once, stores them locally, then reads **only from local DB** for normal Quran/Adhkar reading.

| Layer | Responsibility |
|-------|----------------|
| **UI** | Shows Surahs, Ayahs, Adhkar from Repository. Never calls HTTP for static text. |
| **Repository** | `UI → Repository → Local DB` only for reading. |
| **Sync Service** | `Backend → Sync Service → Local DB` for first download + version updates. |

```text
Reading (always):     UI → Repository → Local DB
Sync (when needed):   Backend → Sync Service → Local DB (then READY)
```

---

## 2. Pack status (per pack: Quran / Adhkar)

| Status | Meaning |
|--------|---------|
| `NOT_DOWNLOADED` | No valid local pack. Reading blocked until first sync. |
| `DOWNLOADING` | First install download in progress. Do **not** mark READY. |
| `READY` | Valid local pack. Safe to read offline/online. |
| `UPDATING` | New pack downloading to temp. Keep serving old READY data. |
| `FAILED` | Last download/update failed. If a previous READY pack exists, keep using it. |

**Rule:** Never set `READY` until the pack is fully downloaded, validated, and written to Local DB.

---

## 3. First-install flow

```text
1. Check Local DB for Quran + Adhkar packs
2. If both READY → skip to reading
3. If missing and offline → show “connect once to download”
4. If missing and online:
     status = DOWNLOADING
     GET /quran/full-catalog
     GET /adhkar/full-catalog
5. Validate each pack (counts + meta — see §8)
6. Write to Local DB
7. Save catalogVersion + contentHash
8. status = READY
```

Guests can download before login (no `Authorization` header).

---

## 4. Update flow

On app start / resume when online (background; do not block UI if packs are already READY):

```text
1. GET /content/static-meta
2. Compare local vs remote for each pack:
     catalogVersion + contentHash
3. Match → do nothing
4. Differ → download ONLY the changed pack
5. Safe replace (§5) → update local version/hash → READY
```

Prefer `/content/static-meta` (one call) over separate `/quran/static-meta` + `/adhkar/static-meta`.

---

## 5. Safe update + crash handling

| Step | Behavior |
|------|----------|
| Download | Write to **temporary** storage / staging tables — not the live pack. |
| Validate | Counts and required fields must match meta (§8). |
| Commit | Replace old pack **atomically** (transaction / swap). |
| Success | Update stored `catalogVersion` + `contentHash`; set `READY`. |
| Failure / crash | Keep previous READY pack. Set `FAILED` for the update attempt. Retry later. |
| Incomplete | Never mark incomplete data as `READY`. Never delete a valid pack because an update failed. |

During `UPDATING`, UI continues reading the previous READY pack.

Interrupted Quran download may resume with HTTP `Range` (§11). After resume, still validate the **full** assembled JSON before commit.

---

## 6. Online / offline reading rules

| Situation | Behavior |
|-----------|----------|
| Online + READY | Read **Local DB immediately**. Sync Service may check meta in background. |
| Offline + READY | Read Local DB only. No Backend calls. |
| Offline + NOT_DOWNLOADED | Cannot read static content; prompt to connect once. |
| Opening Surah / page / juz / Adhkar category | **Never** call Backend for static text. |

Still online (not part of these packs): audio, tafsir/translation bodies, bookmarks, last-read, khatmah, Adhkar progress/favorites.

---

## 7. Local database (suggested stores)

Use Isar / Hive / Drift — **not** SharedPreferences for ayahs or adhkar items.

| Store | Persist |
|-------|---------|
| `static_meta` / sync state | Per pack: `catalogVersion`, `contentHash`, `status`, `lastCheckedAt`, `lastError` |
| `quran_surahs` | `id`, `nameAr`, `nameEn`, `revelationType`, `totalAyahs` |
| `quran_ayahs` | Index `(surahId, ayahNumber)`; fields `textAr`, `page`, `juz` |
| `quran_juzs` | `juzNumber`, names, `totalAyahs`, `startPage`, `endPage`, `firstSurah` |
| `adhkar_categories` | `id`, `key`, names, descriptions, `iconCode`, `sortOrder`, `totalItems` |
| `adhkar_items` | `id`, `categoryId`, `orderInCategory`, texts, `repeatCount`, refs, benefits |

Respect `bismillahStripped: true` — do **not** re-strip Bismillah client-side.

---

## 8. Validation before READY

### Quran (Production expectations)

| Check | Expected |
|-------|----------|
| `meta.totalSurahs` / `surahs.length` | **114** |
| `meta.totalAyahs` / total nested ayahs | **6236** |
| `meta.totalJuz` / `juzs.length` | **30** |
| `meta.totalPages` | **604** |
| Per surah | `ayahs.length == totalAyahs` |
| Each ayah | non-empty `textAr`; has `ayahNumber`, `page`, `juz` |
| Meta | `catalogVersion`, `contentHash`, `bismillahStripped`, `downloadPath` |

Current Production: `catalogVersion=1`, `contentHash=quran-v1-6236-114`.

### Adhkar (Production expectations)

| Check | Expected |
|-------|----------|
| `meta.totalCategories` / `categories.length` | **14** |
| `meta.totalItems` / sum of items | **115** |
| Categories | sorted by `sortOrder`; have `nameAr`, `nameEn`, etc. |
| Items | ordered by `orderInCategory`; have `textAr`, `repeatCount` (int) |
| Optional fields when present | `textEn`, `textArPlain`, `referenceAr`/`En`, `benefitAr`/`En` |

Current Production: `catalogVersion=1`, `contentHash=adhkar-v1-14-115`.

---

## 9. Production endpoints (public — no auth)

**Base:** `https://noor-app-backend-one.vercel.app/api/v1`

| Purpose | Method | Path | Status |
|---------|--------|------|--------|
| Combined version probe | GET | `/content/static-meta` | **VERIFIED ON PRODUCTION** |
| Quran version only | GET | `/quran/static-meta` | **VERIFIED ON PRODUCTION** |
| Adhkar version only | GET | `/adhkar/static-meta` | **VERIFIED ON PRODUCTION** |
| Quran full pack | GET | `/quran/full-catalog` | **VERIFIED ON PRODUCTION** |
| Adhkar full pack | GET | `/adhkar/full-catalog` | **VERIFIED ON PRODUCTION** |
| Optional one Juz | GET | `/quran/juz/{1..30}/ayahs` | **VERIFIED ON PRODUCTION** (Juz 1 = 148 ayahs) |

Do **not** send `Authorization` on these routes. Guests must be able to download.

**Pagination:** one request per full pack. Do **not** paginate `/quran/surahs/:id/ayahs` for the offline pack. Optional Juz endpoint is for partial download only — full catalog is preferred for offline.

---

## 10. API contracts (Production shapes)

### `GET /content/static-meta`

```json
{
  "success": true,
  "data": {
    "quran": {
      "catalogVersion": 1,
      "contentHash": "quran-v1-6236-114",
      "totalSurahs": 114,
      "totalAyahs": 6236,
      "totalPages": 604,
      "totalJuz": 30,
      "bismillahStripped": true,
      "downloadPath": "/quran/full-catalog"
    },
    "adhkar": {
      "catalogVersion": 1,
      "contentHash": "adhkar-v1-14-115",
      "totalCategories": 14,
      "totalItems": 115,
      "downloadPath": "/adhkar/full-catalog"
    }
  }
}
```

### `GET /quran/full-catalog` (~1.6 MB)

```json
{
  "data": {
    "meta": {
      "catalogVersion": 1,
      "contentHash": "quran-v1-6236-114",
      "totalSurahs": 114,
      "totalAyahs": 6236,
      "totalPages": 604,
      "totalJuz": 30,
      "bismillahStripped": true,
      "downloadPath": "/quran/full-catalog"
    },
    "surahs": [
      {
        "id": 1,
        "nameAr": "…",
        "nameEn": "…",
        "revelationType": "MAKKI",
        "totalAyahs": 7,
        "ayahs": [
          { "ayahNumber": 1, "textAr": "…", "page": 1, "juz": 1 }
        ]
      }
    ],
    "juzs": [
      {
        "juzNumber": 1,
        "nameAr": "…",
        "nameEn": "…",
        "totalAyahs": 148,
        "startPage": 1,
        "endPage": 21,
        "firstSurah": { "id": 1, "nameAr": "…", "nameEn": "…" }
      }
    ]
  }
}
```

### `GET /adhkar/full-catalog` (~93 KB)

```json
{
  "data": {
    "meta": {
      "catalogVersion": 1,
      "contentHash": "adhkar-v1-14-115",
      "totalCategories": 14,
      "totalItems": 115,
      "downloadPath": "/adhkar/full-catalog"
    },
    "categories": [
      {
        "id": "uuid",
        "key": "MORNING",
        "nameAr": "…",
        "nameEn": "…",
        "descriptionAr": "…",
        "descriptionEn": "…",
        "iconCode": "…",
        "sortOrder": 1,
        "totalItems": 12,
        "items": [
          {
            "id": "uuid",
            "orderInCategory": 1,
            "textAr": "…",
            "textEn": "…",
            "textArPlain": "…",
            "repeatCount": 33,
            "referenceAr": "…",
            "referenceEn": "…",
            "benefitAr": "…",
            "benefitEn": "…"
          }
        ]
      }
    ]
  }
}
```

**Version rule:**

```text
Local catalogVersion + contentHash == Production  →  do not re-download
Local != Production                               →  download that pack only
```

Meta from `/content/static-meta` matches pack `.meta` on Production (**VERIFIED**).

---

## 11. Range / resume (**VERIFIED ON PRODUCTION**)

`GET /quran/full-catalog`:

| Header / behavior | Result |
|-------------------|--------|
| `Content-Type` | `application/json; charset=utf-8` |
| `Content-Length` | present (~1,673,582 bytes) |
| `Accept-Ranges` | `bytes` |
| `Range: bytes=0-499` | **HTTP 206** + `Content-Range: bytes 0-499/1673582` |

Adhkar pack is small; Range not required.

---

## 12. Error-handling table

| Case | Flutter action |
|------|----------------|
| No network + NOT_DOWNLOADED | Show connect-once message; do not invent empty packs. |
| No network + READY | Read Local DB; skip sync. |
| `/content/static-meta` fails | Keep READY packs; retry later; do not wipe local data. |
| Full-catalog HTTP error | Keep previous READY pack; set `FAILED`; retry. |
| JSON parse / validation fail | Discard temp; keep previous READY; set `FAILED`. |
| App killed mid-download | On next launch: incomplete ≠ READY; resume or re-download; never promote partial data. |
| Update fails after download | Do not swap; keep old pack READY. |
| One pack fails, other OK | Mark only the failed pack `FAILED`; other can stay READY. |

---

## 13. Flutter implementation checklist

- [ ] Local DB tables for surahs, ayahs, juzs, adhkar categories/items, sync meta  
- [ ] Pack status enum: `NOT_DOWNLOADED` / `DOWNLOADING` / `READY` / `UPDATING` / `FAILED`  
- [ ] Repository reads **only** Local DB for Quran/Adhkar UI  
- [ ] Sync Service: first install + `/content/static-meta` update check  
- [ ] Download to temp → validate → atomic replace  
- [ ] Never mark incomplete data READY; never destroy valid pack on failed update  
- [ ] Guest download without Bearer token  
- [ ] Online: still serve Local DB immediately; sync in background  
- [ ] Offline READY: full Surah + Adhkar reading works  
- [ ] Optional: Quran `Range` resume for large download  
- [ ] User progress/favorites stay separate (online sync, not these packs)  

---

## 14. Limitations (Backend)

1. Audio / tafsir / translation bodies are **not** in these packs.  
2. User-specific state is **not** in these packs.  
3. No delta/patch API — when hash changes, re-download the **full** changed pack.  
4. Backend bumps versions in `static-catalog.ts` when static content changes.

---

## 15. Production verification (Backend)

| Area | Production Status |
|------|-------------------|
| Static metadata | **PASS** |
| Quran full catalog | **PASS** |
| Adhkar full catalog | **PASS** |
| Quran metadata | **PASS** |
| Adhkar metadata | **PASS** |
| Version/hash mechanism | **PASS** |
| Range/resume | **PASS** |
| Public access (no auth) | **PASS** |
| Production deployment | **PASS** |

**BACKEND STATIC DATA SUPPORT: READY**

Verified 2026-09-06 via `scripts/verify-production-static-offline.py` (**48/48 PASS**) against  
`https://noor-app-backend-one.vercel.app/api/v1`.

| Pack | Version | Hash | Counts | Size |
|------|--------:|------|--------|------|
| Quran | 1 | `quran-v1-6236-114` | 114 / 6236 / 604 / 30 | ~1.6 MB |
| Adhkar | 1 | `adhkar-v1-14-115` | 14 categories / 115 items | ~93 KB |
