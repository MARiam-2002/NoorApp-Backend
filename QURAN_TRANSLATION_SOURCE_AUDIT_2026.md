# Quran Translation Source Audit — 2026

**Audience:** Backend / Flutter / product  
**Type:** Audit only (no code changes)  
**Production base:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Audited:** 2026-09-06  
**Language:** English only  

---

## Verdict

**⚠️ Available but needs verification/licensing**

| Question | Finding |
|----------|---------|
| Translation available on Production? | **Yes** — live per-ayah responses with real text |
| Stored inside Noor DB / offline Quran pack? | **No** — not part of `/quran/full-catalog` |
| Source/provider verified? | **Yes** — Quran Foundation Content API family (`provider: "quran_foundation"`), with public fallback `https://api.quran.com/api/v4` |
| Exact translator names verified? | **Yes** — via Backend catalog + Quran.com resources API |
| Exact printed edition/year verified? | **Could not be verified** — upstream API does not return edition year/ISBN |
| Official license for Noor app use verified? | **Could not be verified from Backend/config** — Quran Foundation Developer Terms apply; per-translation copyright status not documented in this repo |
| Complete 114 / 6236 in Noor Backend? | **Not as a local corpus** — served on demand; spot-checked only (not all 6236 ayahs) |
| Placeholder/mock on success path? | **No** on sampled Production calls; failure path returns `"Translation unavailable right now"` |

---

## 1. Is translation content available?

**Yes on Production**, via live upstream fetch — not as a baked-in Noor database table.

Flow (from Backend code):

```text
Flutter → GET /quran/translation
       → Noor Backend
       → Quran Foundation gateway (if QF_CLIENT_ID/SECRET set)
         else public https://api.quran.com/api/v4
       → return text / textHtml
```

Arabic Uthmani mushaf in `/quran/full-catalog` is separate and does **not** include translation bodies.

---

## 2. Exact source / provider

| Layer | Value |
|-------|--------|
| Production response field | `"provider": "quran_foundation"` |
| Authenticated gateway (optional env) | `https://apis.quran.foundation/content/api/v4` |
| Public fallback (no QF credentials) | `https://api.quran.com/api/v4` |
| Upstream path used by Backend | `GET /quran/translations/{resourceId}?verse_key={surah}:{ayah}` |
| Config | `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, `QF_ENV` (optional; documented in `.env.example`) |

Whether Production currently uses authenticated gateway vs public fallback **cannot be confirmed from API responses alone** (both return the same content family). Response `provider` is always labeled `quran_foundation` when text is found.

---

## 3–4. Translations implemented (each separately)

Catalog from Production `GET /quran/translations` (7 items). Translator / resource names cross-checked against `https://api.quran.com/api/v4/resources/translations`.

| Noor `id` / `code` | QF `resourceId` | Language | Translator / author (QF) | QF resource name | QF slug | Edition/year |
|--------------------|----------------:|----------|--------------------------|------------------|---------|--------------|
| `Sahih_International` (default) | **20** | English | Saheeh International | Saheeh International | `en-sahih-international` | **Not returned by API — could not verify** |
| `Yusuf_Ali` | **22** | English | Abdullah Yusuf Ali | A. Yusuf Ali | `quran.en.yusufali` | **Could not verify** |
| `Pickthall` | **19** | English | Mohammed Marmaduke William Pickthall | M. Pickthall | `quran.en.pickthall` | **Could not verify** |
| `French_Hamidullah` | **31** | French | Muhammad Hamidullah | Muhammad Hamidullah | `quran.fr.hamidullah` | **Could not verify** |
| `Turkish_Diyanet` | **77** | Turkish | Diyanet Isleri | Turkish Translation(Diyanet) | `quran.tr.diyanet` | **Could not verify** |
| `Malay_Basmeih` | **39** | Malay | Abdullah Muhammad Basmeih | Abdullah Muhammad Basmeih | `ms-abdullah` | **Could not verify** |
| `Indonesian_Depag` | **33** | Indonesian | Author listed as **Unknown** on QF; name: Indonesian Islamic Affairs Ministry | Indonesian Islamic Affairs Ministry | `quran.id` | **Could not verify** |

Backend catalog labels (`authorEn` / `source`) match these QF names for practical purposes.

### Licensing / trust (audit limits)

- **Upstream reputation:** Quran Foundation / Quran.com is a widely used Content API for Quran apps. These editions are well-known translations.
- **QF Developer Terms:** Content must not be sold/sublicensed/redistributed as a raw dataset; displayed in-app under Terms; source-specific licenses and attribution still apply. Commercial redistribution may need a separate written license. See: https://api-docs.quran.foundation/legal/developer-terms/
- **Noor-specific license proof:** This repo does **not** contain a written license grant, attribution policy, or confirmation that Production’s QF app credentials are approved for these translations.
- Therefore: **suitable for a Quran app only if Noor complies with QF Terms + each translation’s rights** — **not verified as “officially licensed for Noor” from Backend alone.**

---

## 5. Completeness (114 Surahs / 6236 Ayahs)

| Claim | Status |
|-------|--------|
| Noor stores a full translation corpus for all 6236 ayahs | **No** |
| Offline static pack includes translations | **No** |
| API can return a translation for any `surahId` + `ayahNumber` | **Designed to** (per-ayah proxy) |
| Exhaustive Production check of all 6236 ayahs × 7 translations | **Not performed** |
| Spot checks (Production + upstream) | **Passed** (see §8) |

**Conclusion:** Completeness is **upstream-dependent**. Spot samples across early/middle/late surahs returned real text. Do **not** treat Backend as having verified every ayah offline.

---

## 6. Real content vs placeholder

| Path | Behavior |
|------|----------|
| Success | Real upstream text; `provider: "quran_foundation"` |
| Upstream miss/error | `text: "Translation unavailable right now"`, `provider: "unavailable"` |

Sampled Production calls (all 7 sources for 1:1, plus Sahih on 2:255 and 114:6) returned **real** text, not the unavailable placeholder.

Swagger example text `"Translation coming soon"` is **outdated documentation** in route comments — Production behavior is live fetch.

---

## 7. Exact Flutter API endpoints

**Base:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Auth:** none required on these routes  

| Purpose | Method | Path | Query |
|---------|--------|------|-------|
| List translation options | `GET` | `/quran/translations` | — |
| Translation for one ayah | `GET` | `/quran/translation` | **Required:** `surahId`, `ayahNumber` · **Optional selector (any one):** `source` **or** `translationId` **or** `id` |

Examples:

```text
GET /api/v1/quran/translations
GET /api/v1/quran/translation?surahId=1&ayahNumber=1&source=Sahih_International
GET /api/v1/quran/translation?surahId=1&ayahNumber=1&translationId=20
```

Profile preference slug `quranTranslation` (e.g. `Sahih_International`) is stored on the user; body text still comes from `/quran/translation`.

---

## 8. Production verification samples (2026-09-06)

| Request | Result |
|---------|--------|
| `GET /quran/translations` | **200**, 7 options with `resourceId`s |
| Sahih 1:1 | Real English; `provider=quran_foundation` |
| Sahih via `translationId=20` | Same text as `source=Sahih_International` |
| Sahih 2:255 (Ayat al-Kursi) | Real English |
| Sahih 114:6 | Real English |
| Yusuf Ali 1:1 | Real English |
| Pickthall 1:1 | Real English |
| French Hamidullah 1:1 | Real French |
| Turkish Diyanet 1:1 | Real Turkish |
| Malay Basmeih 1:1 | Real Malay |
| Indonesian Depag 1:1 | Real Indonesian |

Example Production payload shape:

```json
{
  "success": true,
  "message": "Quran translation retrieved successfully",
  "data": {
    "text": "In the name of Allāh, the Entirely Merciful, the Especially Merciful.",
    "textHtml": "In the name of Allāh,<sup foot_note=227140>1</sup> …",
    "source": "Sahih_International",
    "surahId": 1,
    "ayahNumber": 1,
    "provider": "quran_foundation"
  }
}
```

---

## 9. Implementation references (Backend)

| File | Role |
|------|------|
| `src/services/quran.service.ts` | `QURAN_TRANSLATIONS` catalog; `getAyahTranslation()` |
| `src/lib/quran-foundation.ts` | QF/public fetch; `resourceId` map; HTML strip |
| `src/routes/quran.ts` | Public `GET /translations`, `GET /translation` |
| `src/controllers/quran.controller.ts` | Resolves `source` / `translationId` / `id` |

---

## 10. Recommendations (documentation only — not implemented)

1. Confirm Noor’s Quran Foundation developer app / Terms compliance and attribution in the Flutter UI.  
2. Do not redistribute raw translation dumps as a separate dataset without a written license.  
3. If offline translation is required, that is a **new** product decision (licensing + storage) — not covered by current static Quran pack.  
4. Update any Flutter “coming soon” UI if it still assumes translation is unavailable.

---

## Summary table

| Item | Verified value |
|------|----------------|
| Provider | Quran Foundation Content API family (`quran_foundation`) |
| Default translation | Saheeh International (`resourceId` 20) |
| Count of Noor options | 7 |
| Served from Production | Yes (live proxy) |
| In offline pack | No |
| Local DB corpus | No |
| Exhaustive 6236 check | Not done |
| Licensing for Noor | **Could not verify** from Backend alone |

**Final verdict: ⚠️ Available but needs verification/licensing**
