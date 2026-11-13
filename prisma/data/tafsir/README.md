# «التفسير الميسر» data

Text: التفسير الميسر, a committee of scholars under the King Fahd Glorious Quran Printing Complex (revised edition).

| File | What | Origin |
|---|---|---|
| `ar-muyassar.json` | `{"surah:ayah": text}` for all 6236 ayat; an ayah group repeats the same text on each ayah | quran.com tafsir data as published in [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api) (commit `eb82bb6`, `tafsir/ar-tafsir-muyassar`), NFC |
| `muyassar-tafsir-app-full.json.gz` | an independent copy of every ayah group (`start`, `count`, `text`), 5040 groups | [الباحث القرآني — tafsir.app](https://tafsir.app) (`get.php?src=muyassar`), fetched 2026-11-13 |

Built from them (both builds share `scripts/lib/muyassar.ts`):
- `scripts/build-tafsir-muyassar.ts` → `src/shared/data/tafsir-muyassar/muyassar.json.gz`, served by
  `GET /quran/tafsir?tafsirId=Ibn_Kathir_Muyassar` (provider `noor_verified`, with `groupFromAyah`/`groupToAyah`).
- `scripts/build-learning-tafsir.ts` → `src/shared/data/learning-tafsir.ts` (Learning reader and «استمع»).

Verification (2026-11-13): all 5040 ayah groups / 6236 ayat agree with tafsir.app letter for letter and by grouping.
For comparison:
- Tanzil (`ar.muyassar`, 2011) is the first edition, so it differs where the Complex revised the wording
  (e.g. «الفضل العظيم» → «الإحسان والعطاء الكثير الواسع»).
- Quran Foundation's live resource 16, which Noor used before, mixes both editions ayah by ayah. It also has typing
  errors (8:39 «قتنة», 6:99 «أخرح», 7:85 «الكيل، الميزان», 13:15 «لعظته الله») and a digitiser's note in 27:25
  («قال معد الكتاب للشاملة …»).

Surah introductions («تسمية السورة / من مقاصد السورة») found before some first ayat are not ayah tafsir and are
dropped (after «[التفسير]», or the last paragraph in 5:1 where the marker is missing). The builds fail on any
difference, missing group, or leftover note.
