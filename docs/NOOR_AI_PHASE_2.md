# Noor AI — Phase 2: Quran Exact Tools

> Status: implemented, still **OFF by default** (`AI_ENABLED=false` → 503 `AI_DISABLED`).
> Deterministic only: no LLM, no AI SDK, no embeddings, no Qdrant, no external Quran API, no schema change.
> Builds on `docs/NOOR_AI_PHASE_1.md`. Flutter contract: `FLUTTER_NOOR_AI_2026.md` §5.6.1.

## 1. What was added

| File | Purpose |
|---|---|
| `src/shared/utils/arabic-normalize.ts` | New retrieval-only normalizer (`normalizeArabicForSearch`, `arabicSearchVariants`, `arabicSkeleton`, `arabicPrefixForms`, `tokenizeArabic`, `normalizeArabicDigits`) |
| `src/services/ai/intent/surah-name-index.ts` | Surah catalog built from the `surahs` table (Arabic + English name keys, ambiguous keys dropped), cached per process |
| `src/services/ai/intent/quran-reference-parser.ts` | `parseQuranReference(query, catalog)` → `reference` \| `invalid` (with reason) \| `not_reference` |
| `src/services/ai/tools/quran-lookup.tool.ts` | `lookupQuranAyahs({ surahId, startAyah, endAyah })` — exact, all-or-nothing, from `ayahs` |
| `src/services/ai/tools/quran-search.tool.ts` | In-memory normalized index over the `ayahs` table + deterministic ranking |
| `src/services/ai/citations/citation-parser.ts` | Extracts `[Q:s:a]` / `[Q:s:a-b]`, reports malformed markers |
| `src/services/ai/citations/citation-validator.ts` | Verifies every cited ayah exists in PostgreSQL |
| `src/services/ai/citations/citation-resolver.ts` | Parse → validate → fetch ayahs; the only way a citation can carry Quran text |
| `src/services/ai/quran-discovery.service.ts` | `discoverQuran(query, limit)` → `exact` or `search` |
| `src/controllers/ai.controller.ts` | + `quranDiscoverySchema`, `quranDiscoveryHandler` |
| `src/routes/ai.ts` | + `POST /ai/quran-discovery` with OpenAPI docs |
| `src/services/ai/ai-status.service.ts` | `features.quranDiscovery` = `enabled` (no provider needed) |
| `src/services/quran.service.ts` | `stripSurahOpeningBismillahIfNeeded` is now exported (keyword only; behaviour unchanged) |
| `scripts/test-ai-arabic-normalize.ts`, `scripts/test-ai-quran-tools.ts`, `scripts/test-ai-quran-eval.ts`, `scripts/test-ai-quran-discovery-http.ts` | Tests (`npm run test:ai-quran`, part of `npm test`) |

Unchanged: `/quran/search`, `stripArabicDiacritics`, all Quran/Tafsir/audio/prayer/notification/auth code and response shapes.

## 2. Arabic normalization (retrieval only)

Derived from the characters actually present in the stored Tanzil Uthmani text (`ayahs.textAr`, 6 236 rows). The output is a search key and is **never** returned as display text.

| Rule | Why (data evidence) |
|---|---|
| NFKC, remove BOM/zero-width/bidi marks | 1:1 starts with U+FEFF |
| `و` + dagger alef (`وٰ`) → `ا` **and** `وا` (two indexed variants) | ٱلصَّلَوٰة → الصلاة; ٱلسَّمَٰوَٰت → السماوات; وَٰحِد → واحد |
| `ى` + dagger alef → `ى` | عَلَىٰ → على, مُوسَىٰ → موسى |
| other dagger alef (U+0670, 9 838 uses) → `ا` | ٱلْكِتَٰب → الكتاب, ٱلصَّٰبِرِين → الصابرين |
| small yeh (U+06E6) inside a word → `ي`; at word end removed | إِبْرَٰهِۦمَ → ابراهيم (Al-Baqarah spelling); بِهِۦ → به |
| remove harakat/tanween/shadda/sukun, U+0653 maddah, U+0654 hamza above, U+0610–061A, U+06D6–06ED (waqf, ۞, ۩, small high/low letters, U+06DF), U+08D3–08FF, tatweel | all present in the data |
| `أ إ آ ٱ` (+ rare forms) → `ا`; `ى` → `ي`; `ة` → `ه`; `ؤ` → `و`; `ئ` → `ي` | standard retrieval equivalences |
| `اا` → `ا` | ٱلرِّبَوٰا۟ → الربا |
| Arabic-Indic / Persian digits → ASCII | `٢:٢٥٥` |

Indexed variants (Phase 2.1, `ARABIC_NORMALIZATION_VERSION = 2`):
- **Same written word** (`arabicSearchVariants`, exact tier): `وٰ` read as `ا` and as `وا`; the silent tanween alef kept and dropped (عِيدًا → عيدا / عيد, so the word عيد is an exact match).
- **Spelling alternative** (`arabicDaggerOmittedVariants`, ranked below exact): dagger alef omitted, which is the standard spelling of ٱلرَّحْمَٰن → الرحمن, إِلَٰه → إله, هَٰذَا → هذا, ذَٰلِك → ذلك. The same rule also produces ٱلْكِتَٰب → الكتب, so these forms never score 1.

Matching additionally uses a **skeleton** (normalized word without `ا`) so Uthmani words written without alef meet standard spelling (يَسْـَٔلُونَكَ ↔ يسألونك), and **prefix forms** (و ف ب ك ل + ال removed only when ≥ 3 letters remain).

Known limit of letter-only matching: words that differ only in vowels are the same key (ٱلْجَنَّة paradise / ٱلْجِنَّة jinn, 114:6).

Deliberately not done: stemming/root extraction, synonym expansion, semantic matching (Phase 4).

## 3. Reference parser

Accepted: `البقرة 255`, `البقرة:255`, `البقرة 255-257`, `سورة البقرة آية 255`, `البقرة 255 إلى 257`, `2:255`, `2:255-257`, `2 255`, `Al-Baqarah 255`, `Al Baqarah 255`, `Surah Al-Baqarah 255`, `Aal-i-Imraan 7`, Arabic-Indic digits, extra whitespace, en/em dashes.

- Surah names come only from the `surahs` table (Arabic stored name + resolved display name; English stored name + existing display override). No new 114-surah mapping was added. A key that maps to more than one surah is dropped, so names never resolve by guesswork.
- English keys tolerate transliteration noise only: article, punctuation, doubled letters, o/u, e/i, final `h` (`Al-Baqarah` = `Al-Baqara`, `Yasin` = `Yaseen`).
- Results: `{ kind: 'reference', reference: { surahId, startAyah, endAyah } }` (single ayah ⇒ `startAyah === endAyah`), `{ kind: 'invalid', reason }`, or `{ kind: 'not_reference' }`.
- Invalid reasons: `UNKNOWN_SURAH`, `INVALID_SURAH_NUMBER`, `AYAH_OUT_OF_RANGE`, `INVALID_RANGE` (reversed), `RANGE_TOO_LARGE` (> 50 ayahs). Ayah bounds come from `surahs.totalAyahs`.
- Traditional alternative names (Phase 2.1, `ALTERNATIVE_SURAH_NAMES`): براءة (9), بني إسرائيل / Bani Israil (17), الملائكة (35), المؤمن (40), حم السجدة (41), القتال (47), تبارك (67), الدهر / هل أتى (76), عم (78), الانشراح / ألم نشرح (94), تبت / اللهب (111), التوحيد (112). An alias key is only added when it is not already a canonical key of any surah, so it can never override a database name (المؤمنون still resolves to 23, الملك to 67).
- Not yet supported (reported as `UNKNOWN_SURAH`, never guessed): other alternative names, cross-surah ranges, surah-only queries (`البقرة` is treated as a search).

## 4. Exact lookup

`lookupQuranAyahs` reads `ayahs` by `(surahId, ayahNumber)` range, verifies the count and contiguity, and fails the whole request if any ayah is missing (no partial results).

Display text = `Ayah.textAr` with only the **existing** display rule applied by every Quran endpoint (`stripSurahOpeningBismillahIfNeeded`: remove the BOM on 1:1 and the Bismillah prepended to ayah 1 of surahs other than 1 and 9). For every other ayah the text is byte-identical to `Ayah.textAr`. Diacritics are kept.

## 5. Citations

- Format: `[Q:surah:ayah]` or `[Q:surah:start-end]`.
- Parser: strict syntax; anything starting with `[Q:` that is not strictly valid is returned as `malformed`.
- Validator: `INVALID_SURAH` (outside 1–114), `INVALID_RANGE`, `RANGE_TOO_LARGE`, `AYAH_NOT_FOUND` (checked with one `ayahs` query).
- Resolver: only validated citations are resolved, and their text is fetched from PostgreSQL. Text around or inside a marker is never used as evidence.
- Not exposed over HTTP in Phase 2 (used by Phase 6 generation).

## 6. `POST /api/v1/ai/quran-discovery`

Same router, flag and auth as Phase 1: disabled → 503 `AI_DISABLED` (before auth and validation); enabled → Bearer token required.

- Body: `query` (1–200 chars, trimmed), `limit` (1–50, default 10).
- `exact` mode: full requested ayah/range (≤ 50), `limit` ignored, `score: 1`.
- `search` mode: normalized word search, top `limit`, `score` ∈ (0, 1]. Leading request phrasing (`آيات عن`, `ما حكم`, `هل يجوز`, …) and function words are ignored.
  - Per query word: 1 exact whole word; 0.9 ayah word after removing an attached prefix (بالصبر for الصبر) or omitting the dagger alef (الرحمن, إله); 0.875 after removing a prefix from the query word (قال for فقال); 0.85 skeleton; 0.6 word prefix. Prefix stripping cannot distinguish an attached letter from a root letter (بعيد → عيد, كتاب → تاب), which is why those matches never score 1.
  - Combined with BM25 IDF weights, normalized: `score = Σ wᵢ·idfᵢ / Σ idfᵢ`, `idf = ln(1 + (N − df + 0.5) / (df + 0.5))`. Rare words (القيوم) count more than common ones (الله); a single-word query scores exactly its match strength.
  - Ties: shorter ayah first (BM25 length normalization — قل هو الله أحد → 112:1 before 72:22), then mushaf order.
- Invalid reference → 400 `VALIDATION_ERROR`, `details: { reason }`.
- Response items: `surahId, ayahNumber, surahNameAr, text, page, juz, score` — all from `ayahs`/`surahs` (`surahNameAr` resolved like existing endpoints; `page`/`juz` nullable per schema).
- Never generates text or rulings; a ruling question only lists ayahs containing the topic word.

### Search index (no schema change)
PostgreSQL cannot apply this normalizer without a new column (migration) or a large `translate()` expression (the approach behind the existing `/quran/search` `ة` mismatch). Instead the service loads the 6 236 canonical ayahs once per process (~2–3 s including the Neon round trip, lazy on the first search) and keeps the normalized keys in memory (a few MB). Quran text is static, so the index never goes stale; it is rebuilt on restart. A persisted normalized column can be considered later if needed.

## 7. Tests

`npm run test:ai-quran`:
- `test-ai-arabic-normalize.ts` (pure): harakat, Quranic marks, tatweel, alef/ya/ta-marbuta/hamza forms, Uthmani spellings, digits, idempotence, canonical text untouched, legacy `stripArabicDiacritics` unchanged.
- `test-ai-quran-tools.ts` (DB, read-only): 45 valid references (including alternative surah names), 11 invalid references, non-references; lookup single/range/opening-ayah/invalid/no-partial; citation parse/validate/resolve; search relevance, determinism, canonical text, empty results; discovery modes and errors; zero network calls.
- `test-ai-quran-eval.ts` (DB, read-only): fixed evaluation set of 18 queries (quoted phrases such as قل هو الله أحد → 112:1, topic words such as الربا → its five ayahs). Every expected ayah contains the query words. Fails if any expected ayah leaves its top-k window; prints mean recall@k and MRR (current: 1.000 / 0.972). Run it before any ranking change.
- `test-ai-quran-discovery-http.ts`: disabled → 503 (with/without token, before validation), `/quran/search` still 200; enabled child process with a temporary user (hard-deleted afterwards): 401 without token, status features, exact/range/English/search/ruling queries, 400 reasons, body validation, zero outbound requests.

## 8. How Phase 3+ builds on this
- Phase 3/4 index licensed tafsir/hadith and Quran vectors; the discovery endpoint can add semantic hits under `mode: "search"` without changing the response shape.
- Phase 6 generation will require the model to output `[Q:…]` markers; `resolveQuranCitations` supplies the only Quran text shown to users.
