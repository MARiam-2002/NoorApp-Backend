# Flutter handoff: Quran 2026 (printed mushaf, listening, memorization, Quran hub)

Backend version: commit after `2d4562f`. All endpoints are under `/api/v1` and use the standard Noor envelope
(`{ success, message, data }`). Private routes need the usual `Authorization: Bearer <token>`.

Goal: the Quran tab becomes a complete Quran app on its own (reading, listening, memorizing, tafsir, khatmah, search,
saved verses) with a calm, consistent design. Use the app's existing tokens (`AppColors`, Tajawal for UI,
`hafs.18.ttf` / UthmanicHafs for Quran text) — no new colours or fonts except the Quran page fonts below.

---

## 1. Quran tab structure (one hub, seven sections)

`GET /quran/home` (private) returns everything the hub needs in one call:

```json
{
  "sections": [
    { "key": "MUSHAF",  "titleAr": "المصحف", "subtitleAr": "تابع القراءة من حيث توقفت", "icon": "menu_book", "route": "/quran/mushaf" },
    { "key": "LISTEN",  "titleAr": "الاستماع", "subtitleAr": "قرّاء كثيرون مع تكرار الآية والمقطع", "icon": "headphones", "route": "/quran/listen" },
    { "key": "HIFZ",    "titleAr": "الحفظ", "subtitleAr": "ورد يومي ومراجعة ذكية واختبار", "icon": "psychology", "route": "/quran/hifz" },
    { "key": "TAFSIR",  "titleAr": "التفسير", "icon": "auto_stories", "route": "/quran/tafsir" },
    { "key": "KHATMAH", "titleAr": "ختمتي", "icon": "flag", "route": "/quran/khatmah" },
    { "key": "SEARCH",  "titleAr": "البحث", "subtitleAr": "بالكلمة أو بالصوت", "icon": "search", "route": "/quran/search" },
    { "key": "SAVED",   "titleAr": "المحفوظات والملاحظات", "icon": "bookmark", "route": "/quran/saved" }
  ],
  "continueReading": { "editionId": "madani-hafs", "page": 77, "verseKey": "4:1" },
  "khatmah": { "dailyGoal": { "pagesTarget": 4, "pagesReadToday": 1, "completed": false, "remainingToday": 3 }, "streakDays": 5, "planActive": true },
  "hifz": { "hasPlan": true, "status": "ACTIVE", "newPortion": { "surahId": 114, "nameAr": "…", "fromAyah": 1, "toAyah": 5, "pages": [604] }, "reviewsDueTotal": 2 },
  "unavailable": [],
  "recitersCount": 41
}
```

Layout (top to bottom):
1. **Continue card** (big, primary): "تابع القراءة · صفحة 77" → opens the mushaf at that page.
2. **Today row** (two compact cards side by side): khatmah ward progress ring, and hifz "today" (new portion + reviews due).
   If `hifz.hasPlan` is false show "ابدأ خطة حفظ" instead.
3. **Sections grid** (2 columns) in the order given by `sections`.

Any part can be `null` (listed in `unavailable`): hide that card, never block the tab.

---

## 2. Printed mushaf with the King Fahd Complex fonts (the "easy on the eyes" mushaf)

This replaces reflowed Unicode text with the exact printed Madinah page: same 15 lines, same line breaks, same
calligraphy as the paper mushaf. It is what Quran.com and the leading apps use.

### 2.1 Endpoints
- `GET /quran/mushaf/fonts` — font catalog (cache 1 h):
  `fonts[]` = `qcf_v2` (monochrome, default) and `qcf_v4_tajweed` (colour-coded tajweed), each with
  `ttfUrlPattern` like `https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p{page}.ttf`, plus `basmala.text`
  and the `attribution` string.
- `GET /quran/editions/madani-hafs/pages/{page}/layout?font=qcf_v2|qcf_v4_tajweed` (public, cache 1 h):

```json
{
  "page": 604, "totalPages": 604, "lineCount": 15, "centeredPage": false,
  "juz": 30, "hizb": 60, "surahs": [{ "id": 112, "nameAr": "…" }, { "id": 113 }, { "id": 114 }],
  "firstVerseKey": "112:1", "lastVerseKey": "114:6", "verseKeys": ["112:1", "…"],
  "font": { "id": "qcf_v2", "family": "p604-v2", "colored": false, "ttfUrl": "https://…/v2/ttf/p604.ttf" },
  "basmala": { "text": "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ", "font": "UthmanicHafs" },
  "lines": [
    { "line": 1, "kind": "surah_header", "surah": 112, "nameAr": "…" },
    { "line": 2, "kind": "basmala", "surah": 112 },
    { "line": 3, "kind": "text", "words": [ { "verseKey": "112:1", "position": 1, "glyph": "ﱁ", "type": "word" }, { "verseKey": "112:1", "position": 5, "glyph": "ﱅ", "type": "end" } ] }
  ]
}
```

- `editions` (`GET /quran/editions`) now includes `printedPageLayout: { available, fonts, defaultFont, linesPerPage }`.
  If `available` is false, or a layout call fails (503), fall back to the existing Unicode reader
  (`/quran/editions/{id}/pages/{page}`). IndoPak and Warsh keep the existing reader.

### 2.2 Loading the page font (one TTF per page)

```dart
final _loaded = <String>{};
Future<void> ensurePageFont(String family, String ttfUrl) async {
  if (_loaded.contains(family)) return;
  final file = File('${(await getApplicationSupportDirectory()).path}/qcf/$family.ttf');
  if (!await file.exists()) {
    final bytes = (await http.get(Uri.parse(ttfUrl))).bodyBytes; // V2 ≈ 160-620 KB, V4 ≈ 80-280 KB per page
    await file.create(recursive: true);
    await file.writeAsBytes(bytes, flush: true);
  }
  final loader = FontLoader(family)..addFont(file.readAsBytes().then((b) => ByteData.view(b.buffer)));
  await loader.load();
  _loaded.add(family);
}
```

- Cache the font files on disk (allowed by the font licence). Cache the layout JSON for at most 7 days, then refetch
  (Quran Foundation content-cache limit). Prefetch the next and previous 2 pages while reading.
- Flutter's `FontLoader` needs TTF (woff2 is not supported), and the TTF files are large: about 350 KB per page for V2,
  so the full mushaf is roughly 210 MB. So: cache pages as they are read (LRU, e.g. keep 200 pages), and offer
  offline download **per juz** (≈ 7 MB each) in Settings → المصحف → التحميل, with the size shown before downloading
  and a "Wi-Fi only" switch. The fonts may be stored inside the app; they must not be offered for separate download.
- The surah header font is woff/woff2 only (not supported by Flutter): draw the header as an ornamental frame
  (existing asset) with the surah name in UthmanicHafs.

### 2.3 Drawing a page
- `PageView` with `reverse: true` (right-to-left paging), one page per screen, `lines.length` rows filling the height.
- Font size: compute once per screen size so that 15 lines fit: `fontSize = availableHeight / 15 / 1.75`
  (tune 1.6–1.9 on devices), then clamp so the widest line fits the width.
- `text` line: `Row(mainAxisAlignment: MainAxisAlignment.spaceBetween)` of `Text(word.glyph, style: TextStyle(fontFamily: font.family, fontSize: s, height: 1))`.
  Measure the natural width with `TextPainter`; if it is under 75 % of the line width (rare short lines), use
  `MainAxisAlignment.center` with normal spacing instead. Pages 1 and 2 (`centeredPage: true`) are always centred,
  inside the decorative frame.
- `surah_header`: framed header with `nameAr`. `basmala`: `basmala.text` centred in UthmanicHafs.
- Each word knows its `verseKey`: tap a word → highlight all words of that verse (light `noorGold` at 25 % behind the
  glyphs) and open the verse sheet: تفسير · استماع · حفظ الآية · ملاحظة · نسخ · مشاركة.
- Page footer: page number; header: surah name(s) and juz (`juz`) — same style as today.
- Audio follow-along: highlight the playing verse by `verseKey` and turn the page when `verseKey` leaves `verseKeys`.

### 2.4 Comfort themes (Settings → المصحف)
| Theme | Background | Glyph colour | Font |
|---|---|---|---|
| ورقي (default) | `#FDFBF7` | `AppColors.navyDeep` | qcf_v2 |
| كريمي دافئ | `AppColors.softCream` blend `#F6EFD9` | `#3A2E1F` | qcf_v2 or qcf_v4_tajweed |
| ليلي هادئ | `#14121F` (not pure black) | `#E8E2CF` (not pure white) | qcf_v2 only |

- `qcf_v4_tajweed` is a COLRv1 colour font designed for light backgrounds: offer it on the paper and cream themes only;
  in the night theme switch to `qcf_v2` automatically and show a small note. Test COLRv1 on a real Android and iOS
  device (Impeller); if a device renders it monochrome, hide the tajweed option there.
- Settings: font size (auto / larger, which switches to vertical scrolling), keep screen on, page-turn sound off by
  default, brightness follows the system.
- Credits screen must include the `attribution` text ("Mushaf fonts © King Fahd Glorious Quran Printing Complex,
  provided by Quran Foundation") — required by the font licence.

---

## 3. Listening

- `GET /quran/audio/catalog`: now **43 reciters** (catalogVersion 3), each with `nameAr`, `style`
  (Murattal / Mujawwad / Muallim), `riwaya` (Hafs / Warsh), `availableQualities`, `verseSyncWithMushaf`.
  Group them in the picker by riwaya then style; put the user's favourites first.
- **Warsh reciters** (إبراهيم الدوسري، ياسين الجزائري): their files are cut at Hafs verse boundaries
  (`verseSyncWithMushaf: false`). Offer them for continuous listening by surah only: no verse highlight, no
  verse-by-verse repeat on the Warsh text. Show a small "رواية ورش" chip on them.
- `GET /quran/audio/playlist?surahId=67&fromAyah=1&toAyah=10&reciterId=…&repeatEach=3&repeatRange=2`
  - `items[]`: one per verse (`verseKey`, `audioUrl`, `cacheKey`).
  - `sequence[]`: indexes into `items` in playback order with repeats applied (each verse ×`repeatEach`, whole range
    ×`repeatRange`, both 1–50). Play `items[sequence[i]]` with `just_audio` (`ConcatenatingAudioSource`).
- Player controls: speed (0.75 / 1 / 1.25 / 1.5 via `setSpeed`), repeat verse, repeat range (A–B), sleep timer,
  background playback with lock-screen controls, "download surah for offline" (cache the per-verse files).
- Teaching mode: the reciter `Mahmoud_Al_Husary_Muallim` (المعلم) is ideal for memorization; suggest it in the hifz flow.

---

## 4. Memorization (الحفظ) — new

### 4.1 Endpoints (all private)
| Method | Path | Body / query | Use |
|---|---|---|---|
| GET | `/hifz/plan` | – | `{ plan \| null, scopeVerses, reviewIntervalsDays }` |
| PUT | `/hifz/plan` | `{ fromSurah, toSurah, direction: "BACKWARD"\|"FORWARD", dailyNewVerses 1-50, reviewLimit 1-50, reciterId?, reminderEnabled, reminderTime "HH:mm" }` | create or edit |
| PATCH | `/hifz/plan/status` | `{ status: "ACTIVE"\|"PAUSED" }` | pause / resume |
| DELETE | `/hifz/plan?deleteProgress=false` | – | delete plan (keeps memorized verses unless `true`) |
| GET | `/hifz/today` | – | today's new portion + due reviews |
| POST | `/hifz/segments` | `{ surahId, fromAyah, toAyah }` | "حفظتها" (409 if overlapping) |
| POST | `/hifz/segments/{id}/review` | `{ grade: "AGAIN"\|"HARD"\|"GOOD"\|"EASY" }` | after a review |
| DELETE | `/hifz/segments/{id}` | – | un-mark |
| GET | `/hifz/progress` | – | totals, % of plan, per-surah, segments |
| GET | `/hifz/test` | `surahId?&fromAyah?&toAyah?&count=5&types=NEXT_AYAH,COMPLETE_AYAH,WHICH_SURAH&seed?` | self-test |

`GET /hifz/today`:
```json
{
  "day": "2026-11-12",
  "newPortion": { "surahId": 114, "nameAr": "…", "fromAyah": 1, "toAyah": 5, "firstVerseKey": "114:1", "lastVerseKey": "114:5", "verseCount": 5, "pages": [604] },
  "newDoneToday": false, "memorizedTodayVerses": 0, "planComplete": false,
  "reviews": [ { "segmentId": "uuid", "surahId": 112, "fromAyah": 1, "toAyah": 4, "stage": 1, "dueDay": "2026-11-12", "overdueDays": 0 } ],
  "reviewsDueTotal": 1
}
```

### 4.2 Screens
1. **Plan wizard** (3 steps): scope (preset chips: جزء عمّ · جزء تبارك · سورة الملك · من البقرة · مخصص) →
   amount per day (slider 1–20 verses, with an estimate "تنتهي خلال ~N يومًا") → reminder time + reciter.
   Default direction `BACKWARD` (from an-Nas) for جزء عمّ.
2. **Today** (`/quran/hifz`):
   - "الحفظ الجديد" card: the portion shown in the printed mushaf (use `pages` and highlight the verse range),
     buttons: استماع مكرر (playlist with `repeatEach=5`), إخفاء الكلمات (tap to reveal, see 4.3), **حفظتها** → POST segment.
   - "المراجعة" list: each due segment → open it, then four buttons:
     أعدتها (AGAIN) · صعبة (HARD) · جيدة (GOOD) · سهلة (EASY). Show the next date from the response.
   - When both are done: a calm success state ("أتممت وِرد اليوم") — no confetti overload.
3. **Progress**: ring with `scopePercent`, verses memorized, surahs complete, this week, a per-surah list.
4. **Test**: one question per screen, 4 options, immediate feedback (green/red), result summary; "retry with
   another set" sends a new `seed`. Options already come shuffled; show them in the given order.

### 4.3 Hide-words practice (client only)
On the printed page, blur the glyphs of the selected verses; tapping a word reveals it; "إظهار الآية" reveals the rest.
The glyph data already gives you per-word boxes, so no extra API is needed.

### 4.4 Reminder
Daily push at `reminderTime` only when there is something to do (new portion or reviews). Android channel id
`hifz` (create it, importance default). Payload: `type: HIFZ_REMINDER`, `deepLink: /quran/hifz`.

---

## 5. Verse insights (معاني الكلمات · أسباب النزول · الفضائل)

All public, static and cached for a day:
- `GET /quran/insights?surahId=2&ayahNumber=255`
  ```json
  {
    "meanings": { "source": { "bookAr": "السراج في بيان غريب القرآن", "authorAr": "محمد بن عبد العزيز الخضيري" }, "words": [ { "text": "الْقَيُّومُ", "meaning": "…" } ] },
    "asbab": { "source": { "bookAr": "المحرر في أسباب نزول القرآن من خلال الكتب التسعة", "authorAr": "خالد بن سليمان المزيني" },
               "items": [ { "fromAyah": 125, "toAyah": 125, "verdict": "AUTHENTIC", "verdictAr": "سبب نزول ثابت", "narrations": "أخرج البخاري …", "conclusion": "أن سبب نزول …", "reference": "المحرر …، الدراسة رقم …" } ] },
    "virtues": [ { "id": "kursi", "titleAr": "آية الكرسي أعظم آية في كتاب الله", "textAr": "…", "referenceAr": "رواه مسلم (810)" } ],
    "has": { "meanings": true, "asbab": false, "virtues": true }
  }
  ```
- `GET /quran/surahs/{id}/virtues` — virtues of the surah (shown at the top of the surah info sheet).
- `GET /quran/surahs/{id}/insight-markers` — `asbabAyahs`, `virtueAyahs`, `meaningsAyahs` so the reader can show a tiny
  dot on verses that have a cause of revelation or a virtue (load once per surah).

UI: in the verse sheet add three tabs next to التفسير: **معاني الكلمات** (list: word in UthmanicHafs, meaning in Tajawal),
**سبب النزول** (only when `has.asbab`), **فضل** (only when `has.virtues`).
- For asbab show: the narration text, then the author's conclusion in a soft card titled "النتيجة", then the source line.
  `SUPPORTED` items carry the label `verdictAr` ("سبب نزول رجّحه المؤلف مع كلام في السند") in a neutral (not red) chip.
- Always show the source book under each tab. Causes rejected by the author are not sent at all.

## 5b. The word & verse panel (same structure as the reference app)

Tap a word → small card: the word, its meaning (from `/quran/insights`), and buttons
**استماع · فاصل · تلوين · تعليق · المزيد**. "المزيد" opens a sheet with four top tabs and scrollable sub-tabs:

| Top tab | Sub-tabs | Endpoint / field |
|---|---|---|
| **الكلمة** | المعنى · القراءات · التصريف · الإحصائيات | `GET /quran/word?surahId&ayahNumber&position` → `segments[]` (form, role prefix/stem/suffix, description, root, lemma, pattern), `qiraat[]`, `statistics` (`exactOccurrences`, `wordOccurrences`, `rootOccurrences`, `rootAyahs`, `rootSurahs`, `rootRank`), `audioUrl` (word audio), `statisticsMethod` (show behind an "منهج الإحصائيات" button) |
| **الآية** | المختصر · التفسير · القراءات · الإعراب · المتشابهات · الموضوعات · أسباب النزول · الفضل · معاني الكلمات | `GET /quran/ayah-library?surahId&ayahNumber` → `mukhtasar`, `irab`, `qiraat`, `similar`, `topics`, `insights` (meanings, asbab, virtues); التفسير = existing `/quran/tafsir` |
| **الصفحة** | الترجمات | existing translations for the page's verses |
| **علوم** (السورة) | نبذة · أسماء السورة · موضوعاتها · مقاصدها · الفضائل · عدد الآيات · إحصائيات | `GET /quran/surahs/{id}/info` → `introduction`, `names`, `topics`, `purposes`, `virtues`, `statistics` (revelation order, مكية/مدنية, words, letters, `ayahCountByCounting`) |

- **القراءات**: each variant lists its readers (`qari` + `rawi`) and an `audioUrl` to hear that reading (play inline).
- **المتشابهات**: `groups[]` each with a note (e.g. "ضبط مواضع ( أنعمت )") and the similar verses; tapping one jumps to it.
- **التصريف** per word: show segments as chips (سابقة · جذع · لاحقة) with the description under each.
- Search by root: `GET /quran/roots/{root}` → occurrences and verse keys (the "ابحث بالجذر" action in the word sheet).
- Topical index: `GET /quran/topics` (tree) and `GET /quran/topics/{id}` (verse keys).
- Sheet footer (as in the reference): استماع · الإعدادات · فاصل · تعليق · تلوين, plus expand, previous/next verse, share, close.
- Sources must be shown under each tab (`source` object). The morphology comes from the Quranic Arabic Corpus:
  show "التحليل الصرفي: المدونة القرآنية العربية corpus.quran.com" (required attribution).

### Colours, comments and tags (تلوين · تعليقاتي)
- `PUT /quran/editions/{id}/annotations` `{ verseKey, wordPosition (0 = whole verse), color?, comment?, tag? }` —
  10 colours: PINK, BLUE, GREEN, YELLOW, ORANGE, RED, TEAL, GRAY, BROWN, PURPLE. Same verse/word updates in place.
- `GET /quran/editions/{id}/annotations?type=all|highlights|comments&tag=&color=&surahId=` → `items`, `tags`.
- `DELETE /quran/annotations/{id}`. Draw highlights behind the glyphs of the word or verse (light alpha).
- "تعليقاتي" screen: list with a filter (tag / colour / type), like the reference.

### Index and khatmah templates
- `GET /quran/index/rub` → 240 quarters (`rub`, `hizb`, `juz`, `quarterInHizb`, `verseKey`, `page`, `opening`) for the
  "الربع" tab of the index with the quarter-circle icons.
- `GET /quran/khatmah/templates` → تحزيب السلف (7 days, with each day's surahs) · ختمة رمضان (30) · الورد اليومي
  (10 pages a day ≈ 61 days) · ختمة مخصصة. Start with the existing `POST /quran/khatmah/plan { durationDays }`.

### Memorization test "التسميع"
In addition to `/hifz/test`, add a self-recitation mode like the reference: choose «صفحة كاملة» or «اختبار السورة»
and a range of pages; hide the glyphs and reveal word by word on tap (client only).

### Reader modes (client only, as in the reference app)
- Tablets and landscape: two printed pages side by side (right page = odd page number in RTL order).
- Auto-scroll in vertical mode with a speed slider; keep the screen awake while it runs.
- Display modes switcher in the top bar: صفحات (printed) · تمرير عمودي · تجويد ملوّن · ليلي · كريمي.
- Download manager in settings: per-juz page fonts, per-surah recitations, with sizes and delete.
- Bottom navigation like the reference: المصحف · ختمة · الفهرس · علاماتي · المزيد (المزيد = اختبار ذاتي للحفظ · تعليقاتي · علاماتي · الإعدادات).

## 5c. Automatic recitation check (التسميع التلقائي)

1. The reader picks a range (or "صفحة كاملة / السورة") and taps the mic. Use `speech_to_text` with locale `ar-SA`
   (partial results on), keep the screen awake, show a live waveform.
2. When the reader stops (or every ~2 verses for long passages), send
   `POST /quran/recitation/check` (signed in) `{ surahId, fromAyah, toAyah, transcript }` (max 50 verses).
3. Response: `words[]` with `status` CORRECT · MINOR · WRONG · MISSED (+ `heard`), `extra[]` (words said that are not
   in the text, with the position after which they were said), `accuracy`, `reachedWords`, `stoppedAt`.
4. On the printed page colour the glyphs: CORRECT none, MINOR light amber, WRONG red, MISSED red outline; words after
   `stoppedAt` stay neutral ("لم تصل إليها"). Tap a red word to hear it (`/quran/word` → `audioUrl`).
5. Show the note from the response: it checks words and their order, not tajweed or vowels. Device speech recognition
   sometimes mishears; MINOR is never counted as a mistake.

## 5d. Search by meaning
`GET /quran/search/meaning?q=الصبر على البلاء` → `topics[]` (matching topics with their verse counts) and `results[]`
(`verseKey`, `snippet` from المختصر, `viaTopic`). In the search screen add a segmented control:
**بالنص · بالمعنى · بالجذر** (text = existing `/quran/search`, root = `/quran/roots/{root}`), plus the mic.

## 5e. More reciters and riwayat (full surahs)
`GET /quran/audio/surah-reciters?riwaya=Hafs|Warsh|Qalun|…` → 213 complete recitations by 174 reciters in 13
riwayat (حفص، ورش، قالون، الدوري، السوسي، البزي، قنبل، شعبة، ابن ذكوان، خلف، يعقوب…). Each item has
`surahUrlPattern` (`…/{NNN}.mp3`). Use them for continuous listening and downloads; for verse highlighting and
repeat use the per-verse catalog (`/quran/audio/catalog`, 43 reciters). In the reciter picker: tabs by riwaya,
search by name, "تلاوة كاملة" badge.

## 5f. Translations
`GET /quran/translations` now lists 45 translations in 30+ languages (English ×7 incl. transliteration, Urdu,
Bengali, Persian, Spanish, German, Russian, Chinese, Hausa, Swahili, Hindi, Somali, Tamil, Japanese, Korean, Bosnian,
Albanian, Italian, Dutch, Portuguese, Uzbek, Kurdish, Pashto, Amharic, Yoruba, Thai, Vietnamese, Tagalog, Azerbaijani,
Kazakh, Malayalam, Indonesian, French, Turkish, Malay). Group the picker by `language`.

## 6. Tafsir
`GET /quran/tafsirs` now also lists **التفسير الوسيط (طنطاوي)** (`Al_Wasit`). Recommended default order in the picker:
الميسر (short, simple) · السعدي · الوسيط · ابن كثير · البغوي · القرطبي · الطبري. Show the tafsir in a bottom sheet from the
verse sheet, with a "أكبر/أصغر" text control.

## 7. Saved verses and notes
- `PUT /quran/editions/{id}/bookmarks` accepts `note` up to **2000** characters.
- `GET /quran/editions/{id}/bookmarks?notesOnly=true` → "ملاحظاتي" tab. The SAVED section has two tabs:
  المحفوظات · ملاحظاتي.

## 8. Search by voice
Use `speech_to_text` with locale `ar-SA` (or the device Arabic locale); put the recognised text into the existing
`GET /quran/search?q=…` (it already ignores diacritics). Show a mic button inside the search field.

## 9. Share a verse
- **As image**: render the verse's printed lines (same glyph widgets) inside a `RepaintBoundary` card: paper
  background, the verse, the reference (اسم السورة · رقم الآية), small Noor logo; export PNG with `share_plus`.
- **As text**: Unicode text with diacritics from the existing ayah/page endpoints + reference.

---

## 10. QA checklist
- [ ] Pages 1, 2, 50, 77, 187, 208, 604 look exactly like the printed mushaf (headers, basmala, no basmala before at-Tawbah).
- [ ] Surah header at the bottom of a page (e.g. page 76 → an-Nisa) and its basmala at the top of the next page.
- [ ] No layout jump while fonts load (show a skeleton until `ensurePageFont` completes).
- [ ] Offline: previously opened pages open in airplane mode.
- [ ] Night theme never uses the tajweed colour font.
- [ ] Repeat: `repeatEach=3` plays each verse 3 times; sleep timer stops playback.
- [ ] Hifz: marking an overlapping range shows the 409 message nicely; reviews move to the right day.
- [ ] Credits show the Quran Foundation / King Fahd Complex attribution.
- [ ] 2:255 shows the Ayat al-Kursi virtue; 2:125 shows its cause of revelation; 97:1 shows none.
- [ ] Warsh reciters never highlight verses.
