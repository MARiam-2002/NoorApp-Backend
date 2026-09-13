# Tafsir & Translation Coverage Audit — 2026

**Generated:** 2026-09-13  
**Method:** Local upstream audit using the **same resource IDs** as the Backend catalog (`api.quran.com` + QUL CDN for Al-Qurtubi). Controlled Production spot-checks only.  
**Flutter contract:** **Unchanged** — no field renames, no endpoint changes, no silent cross-resource substitution.

---

## Coverage matrix

| Resource | Provider | Language | Surahs Covered | Missing Surahs | Missing Ayahs (by_chapter keys) | Status |
| -------- | -------- | -------- | -------------: | -------------- | ------------------------------- | ------ |
| Ibn_Kathir (14) | quran_foundation | Arabic | 114/114 | — | 31 | PARTIAL (upstream) |
| Al_Tabari (15) | quran_foundation | Arabic | 114/114 | — | 40 | PARTIAL (upstream) |
| Al_Qurtubi (90) | quran_foundation | Arabic | 114/114 | — | 0 | FULL keys* |
| Al_Qurtubi QUL (23) | qul | Arabic | 114/114 | — | **2** (`34:54`, `59:19`) | PARTIAL (upstream) |
| Ibn_Kathir_Muyassar (16) | quran_foundation | Arabic | 114/114 | — | ~958 by_chapter gaps** | PARTIAL (upstream / grouping) |
| Al_Baghawi (94) | quran_foundation | Arabic | 114/114 | — | 0 | **FULL** |
| Al_Saadi (91) | quran_foundation | Arabic | 114/114 | — | 59 | PARTIAL (upstream) |
| Ibn_Kathir_En (169) | quran_foundation | English | 114/114 | — | 0 keys; many empty by_chapter rows** | FULL via by_ayah groups |
| Sahih_International (20) | quran_foundation | English | 114/114 | — | 0 | **FULL** |
| Yusuf_Ali (22) | quran_foundation | English | 114/114 | — | 0 | **FULL** |
| Pickthall (19) | quran_foundation | English | 114/114 | — | 0 | **FULL** |
| French_Hamidullah (31) | quran_foundation | French | 114/114 | — | 0 | **FULL** |
| Turkish_Diyanet (77) | quran_foundation | Turkish | 114/114 | — | 0 | **FULL** |
| Malay_Basmeih (39) | quran_foundation | Malay | 114/114 | — | 0 | **FULL** |
| Indonesian_Depag (33) | quran_foundation | Indonesian | 114/114 | — | 0 | **FULL** |

\* Al_Qurtubi QF 90: all surahs/ayah keys present; one empty by_chapter row observed in an earlier pass — Backend uses `by_ayah`.  
\*\* Classical / abridged tafsirs often **group ayahs**: `by_chapter` may omit keys or leave empty placeholder rows; Backend `GET /quran/tafsir` uses **`by_ayah`**, which returns the group text when available (verified e.g. Muyassar `4:67`, Ibn Kathir En empty `by_chapter` rows).

---

## Separation of causes

### Fully covered (Backend + upstream)
- All **7 translations** — 6236/6236 ayahs, correct `resource_id`, no cross-translation leakage in spot checks.
- **Al_Baghawi** tafsir — full by_chapter key coverage.
- **Al_Qurtubi QF 90** — full ayah key coverage (spacing quality issues remain on some plain-text ayahs; QUL preferred when present).

### Partially covered — **upstream / content limitation** (not wrong catalog IDs)
- **Ibn_Kathir (14):** ~31 ayahs with no `by_ayah` row (example: `5:97` → QF 404).
- **Al_Tabari (15):** ~40 ayahs without dedicated by_chapter keys.
- **Al_Saadi (91):** ~59 ayahs (example: `2:107` → QF 404).
- **Ibn_Kathir_Muyassar (16):** large by_chapter key gaps; many still resolve via `by_ayah` grouping (not a silent swap to another tafsir).
- **Al_Qurtubi QUL 23:** missing **`34:54`** and **`59:19`** (404). Backend correctly falls back to **QF 90** with `source=Al_Qurtubi` (verified locally).

### Backend bugs
- **None found** for wrong resource ID, wrong surah/ayah mapping, or silent substitution of another tafsir/translation.
- Catalog IDs match QF resource IDs used in Production code.

### Silent substitution
- **Not occurring.** Missing content → QUL miss falls back only to **same** Al-Qurtubi QF 90, or stable **503** `TAFSIR_TEMPORARILY_UNAVAILABLE` (tafsir), or placeholder with **same** `source` (translation). Never serves Ibn Kathir as Saadi, etc.

---

## Backend behavior (preserved Flutter contract)

| Case | Behavior |
|------|----------|
| Normal hit | 200 + existing fields (`textAr`/`text`/`source`/`provider`/…) |
| Al_Qurtubi QUL miss | Fall back to QF 90, still `source: Al_Qurtubi` |
| Upstream missing / provider down | 503 + `TAFSIR_TEMPORARILY_UNAVAILABLE` (no raw 429) |
| Translation miss | 200 + `provider: unavailable`, **same** `source` id (no other translation text) |

**No Flutter API contract changes were required or made for this audit.**

---

## Production spot-check guidance

After cooldown, spot-check only a few:
- `GET /quran/tafsir?surahId=112&ayahNumber=1&source=Al_Qurtubi`
- `GET /quran/tafsir?surahId=34&ayahNumber=54&source=Al_Qurtubi` (expect QF fallback)
- `GET /quran/translation?surahId=112&ayahNumber=1&source=Sahih_International`

Raw details: `audit-reports/tafsir_translation_coverage_2026.json`
