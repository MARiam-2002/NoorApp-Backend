# Flutter Tafsir Integration Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`  
**Updated:** 2026-09-13  
**Language:** English only  

**Backend status:** Tafsir is **live on Production** via Quran Foundation Content API. Existing Flutter request/response contracts are preserved. Additive attribution fields were added so the reader can show the source name.

---

## 1. Backend audit verdict (Surah الإخلاص 112:1)

| Question | Answer |
|----------|--------|
| Does Tafsir come from our Backend? | **Yes** — `GET /quran/tafsir` |
| Provider | **Quran Foundation** Content API (`provider: "quran_foundation"`), public fallback `api.quran.com/api/v4` when QF OAuth is unset |
| Default resource | **Ibn Kathir** — catalog id `Ibn_Kathir`, QF `resourceId` **14**, slug `ar-tafsir-ibn-kathir` |
| Screenshot text match | The bottom-sheet wording (ابن مسعود / الحسن / عطاء / عكرمة / **الأسنى في شرح أسماء الله الحسنى**) matches **`Al_Qurtubi`** (QF resource **90**), **not** Ibn Kathir |
| Trusted classical source? | **Yes** — Qurtubi / Ibn Kathir / Tabari / Baghawi / Saadi / Muyassar from Quran Foundation |
| Correct ayah? | **Yes** — `surahId=112&ayahNumber=1` returns the matching exegesis |
| Backend broken? | **No** for fetch/source wiring |
| Flutter-side gap? | **Yes** — sheet title is only «التفسير» with **no source attribution**; ensure the selected preference (`quranTafsir` / `tafsirId`) is the one sent on the request |

---

## 2. Exact API Flutter already uses

### Catalog

`GET /quran/tafsirs` (public)

Returns the selectable list (ids match `profile.quranTafsir` / reading preferences).

### Body

`GET /quran/tafsir`

| Query | Required | Notes |
|-------|----------|--------|
| `surahId` | Yes | 1–114 |
| `ayahNumber` | Yes | Verse number in surah |
| `source` **or** `tafsirId` **or** `id` | No | Catalog id (`Al_Qurtubi`), slug, or numeric QF id (`90`). Default = `Ibn_Kathir` |

Auth: **not required** (same as other Quran read endpoints).

### Response `data` (existing + additive)

```json
{
  "textAr": "…",
  "text": "…",
  "textHtml": "…",
  "source": "Al_Qurtubi",
  "surahId": 112,
  "ayahNumber": 1,
  "provider": "quran_foundation",
  "language": "Arabic",
  "resourceId": 90,
  "sourceNameAr": "تفسير القرطبي",
  "sourceNameEn": "Tafsir Al-Qurtubi",
  "authorAr": "أبو عبد الله القرطبي",
  "authorEn": "Abu Abdullah Al-Qurtubi"
}
```

| Field | Status | Flutter use |
|-------|--------|-------------|
| `textAr` / `text` | **Existing** | Plain text for the sheet body |
| `textHtml` | **Existing** | Optional rich render; strip tags if unused |
| `source` | **Existing** | Catalog id of the resource used |
| `surahId` / `ayahNumber` | **Existing** | Echo of request |
| `provider` | **Existing** | `quran_foundation` or `unavailable` |
| `language` | Existing (corrected) | Prefer catalog language |
| `resourceId` | **Additive** | QF numeric id |
| `sourceNameAr` / `sourceNameEn` | **Additive** | Show under «التفسير» |
| `authorAr` / `authorEn` | **Additive** | Optional subtitle |

**Do not rename or remove existing fields.**

---

## 3. Catalog resources (Production)

| `id` / `tafsirId` | Arabic name | QF `resourceId` | Default |
|------------------|-------------|-----------------|---------|
| `Ibn_Kathir` | تفسير ابن كثير | 14 | **Yes** |
| `Al_Tabari` | تفسير الطبري | 15 | |
| `Al_Qurtubi` | تفسير القرطبي | 90 | |
| `Ibn_Kathir_Muyassar` | تفسير الميسر | 16 | |
| `Al_Baghawi` | معالم التنزيل (البغوي) | 94 | |
| `Al_Saadi` | تفسير السعدي | 91 | |
| `Ibn_Kathir_En` | ابن كثير (مختصر إنجليزي) | 169 | |

List endpoint: `GET /quran/tafsirs`.

User preference: `GET/PATCH /profile/reading-preferences` → `quranTafsir` (same id strings).

---

## 4. Exact Flutter integration requirements

1. On ayah tap / Tafsir sheet open:  
   `GET /quran/tafsir?surahId={n}&ayahNumber={m}&tafsirId={user.quranTafsir}`  
   (or `source=` — both accepted).
2. Render body from `data.textAr` (or `text`). Prefer `textHtml` only if you have a safe HTML renderer.
3. **Show attribution** in the sheet header or footer, e.g.  
   `التفسير · {sourceNameAr}`  
   using additive `sourceNameAr` (fallback: map `source` via `/quran/tafsirs`).
4. Keep dropdown options from **`GET /quran/tafsirs`**, not a hardcoded list.
5. When preference changes, refetch the open ayah with the new `tafsirId`.

---

## 5. Formatting / HTML notes

- Ibn Kathir usually includes HTML paragraphs (`textHtml`); plain `textAr` is already stripped with newlines.
- Some QF Arabic resources (e.g. Qurtubi for 112:1) arrive **without HTML** and with **tight spacing** from upstream (`سورة الإخلاصوهي…`). That is **source data**, not a Flutter layout bug — do not invent word breaks on Backend.
- Sheet layout, font size, drag handle, and RTL wrapping are **Flutter UI**.

---

## 6. Flutter-side issues found

| Issue | Detail |
|-------|--------|
| No source label on sheet | Title is only «التفسير» — user cannot see Qurtubi vs Ibn Kathir |
| Preference wiring | Screenshot content is **Qurtubi**; confirm Flutter sends `Al_Qurtubi` (or the saved preference), not always default |
| Optional HTML | If using `textHtml`, sanitize; otherwise use `textAr` |

**Not Backend defects:** bottom-sheet chrome, fonts, spacing of the sheet itself.

---

## 7. What Backend verified on Production

- `GET /quran/tafsirs` → 7 options, default Ibn Kathir (`resourceId` 14).
- `GET /quran/tafsir?surahId=112&ayahNumber=1` → Ibn Kathir text, `provider: quran_foundation`.
- `GET /quran/tafsir?surahId=112&ayahNumber=1&source=Al_Qurtubi` → text containing الأسنى / الحسن / عطاء — **matches the attached UI**.
- Dashboard has **no separate Tafsir body** requirement; reader preferences only store the selected slug.

---

## 8. Handoff status

**READY for Flutter** — Backend Tafsir is Production-correct. Flutter should display `sourceNameAr` and always pass the user’s selected `tafsirId`.
