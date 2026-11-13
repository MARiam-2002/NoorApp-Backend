# «التفسير الميسر» data

Used by `scripts/build-learning-tafsir.ts` → `src/shared/data/learning-tafsir.ts` (Learning reader and «استمع»).

| File | What | Origin |
|---|---|---|
| `ar-muyassar.json` | `{"surah:ayah": text}` for all 6236 ayat; an ayah group repeats the same text on each ayah | quran.com tafsir data as published in [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) (commit `eb82bb6`, `tafsir/ar-tafsir-muyassar`), NFC |
| `muyassar-crosscheck-tafsir-app.json` | the same passages from an independent copy, with the ayah group (`start`, `count`) | [الباحث القرآني — tafsir.app](https://tafsir.app) (`get.php?src=muyassar`), fetched 2026-11-13 |

Text: التفسير الميسر, a committee of scholars under the King Fahd Glorious Quran Printing Complex (revised edition).

Why this copy: on 2026-11-13 the four copies were compared for the 462 passages the learning content uses.
- `ar-muyassar.json` and tafsir.app agree on every letter and every ayah grouping (462/462).
- Tanzil (`ar.muyassar`, 2011) is the first edition, so it differs where the Complex revised wording
  (e.g. «الفضل العظيم» → «الإحسان والعطاء الكثير الواسع»).
- The live Quran Foundation resource 16 mixes both editions ayah by ayah and has typing errors
  (8:39 «قتنة», 6:99 «أخرح», 7:85 «الكيل، الميزان», 13:15 «لعظته الله») and, in 27:25, a digitiser's note
  («قال معد الكتاب للشاملة …»). It is not used here.

Surah introductions («تسمية السورة / من مقاصد السورة … [التفسير]») found before some first ayat are not ayah tafsir and
are dropped by the build. Adding Quran blocks to the learning content needs their tafsir.app entries in the cross-check
file; the build fails until they are there.
