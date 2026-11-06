# Noor — Learning hub «تعلّم مع نور» (Flutter handoff)

Date: 5 November 2026 (updated 6 November: 10 prophet stories, everything is live, no draft/review states). Backend: done and tested (`/learning`, migration `20261106100000_learning_progress`). Target: the **Learning release (10 December 2026, before Rajab)**. New content is added on the server later, with no app update.

## 0. What it is

One hub with 9 sections. Build **one** generic reader that works for every section, so new sections and new items need no new screens.

| Order | Section (`id`) | Kind | Status on 5 Nov |
| --- | --- | --- | --- |
| 1 | قصص الأنبياء (`prophet-stories`) | STORY | 10 stories, live |
| 2 | السيرة النبوية (`seerah`) | STORY | coming soon |
| 3 | قصص الصحابة (`companions`) | STORY | **already exists**: `existingEndpoint: /content/figures` → open the existing Figure screens |
| 4 | العقيدة (`aqeedah`) | LESSON | coming soon |
| 5 | أسماء الله الحسنى (`asma-husna`) | LESSON | coming soon |
| 6 | الفقه (`fiqh`) | LESSON | coming soon (fasting first, for Sha'ban) |
| 7 | دروس التجويد (`tajweed`) | LESSON | coming soon |
| 8 | الأربعون النووية (`nawawi-forty`) | HADITH | 42 hadith, live |
| 9 | الأخلاق والمواقف (`morals`) | LESSON | **already exists**: `existingEndpoint: /stances/catalog` → open the existing «موقفك إيه؟» screens |

Trust model (show it under «منهج هذا القسم», from `methodAr`):
- Ayat are copied verbatim from the app's Quran text.
- Hadith come from Sahih al-Bukhari / Sahih Muslim, verbatim, with their numbers.
- Both are verified when the content is built.
- Every item the server returns is published. There is no draft state and no banner to build.

## 1. API

All paths are under `/api/v1`. Content is public: no token needed, `Cache-Control: public, max-age=600`. Send the token when logged in to get progress (the response is then `private, no-store`).

| Method | Path | Use |
| --- | --- | --- |
| GET | `/learning` | Hub. `collections[]`: `id, order, kind, titleAr, titleEn, descriptionAr, methodAr, existingEndpoint, itemCount, comingSoon, completedCount`, plus `continueReading[]` (up to 5 unfinished items) and `catalogVersion` |
| GET | `/learning/collections/{id}` | Section with `items[]`: `id, order, titleAr, personAr, honorificAr, summaryAr, readingMinutes, sectionCount, hasQuiz, progress` |
| GET | `/learning/items/{id}` | Full item (below) + `previousItemId`, `nextItemId`, `progress` |
| PUT | `/learning/items/{id}/progress` (token) | `{ lastSectionIndex, completed?, quizScore?, quizTotal? }`. The server keeps the furthest section, the first completion and the best quiz %. |

Item shape (trimmed):
```json
{
  "id": "yusuf", "collectionId": "prophet-stories", "order": 100,
  "titleAr": "يوسف: أحسن القصص", "personAr": "يوسف", "honorificAr": "عليه السلام",
  "summaryAr": "…", "readingMinutes": 6,
  "collection": { "id": "prophet-stories", "titleAr": "قصص الأنبياء", "methodAr": "…" },
  "sections": [
    {
      "index": 0, "titleAr": "إني رأيت أحد عشر كوكبًا",
      "paragraphsAr": ["…", "…"],
      "reflectionAr": null,
      "quran": [ { "surah": 12, "surahNameAr": "يوسف", "fromAyah": 3, "toAyah": 5, "referenceAr": "يوسف ٣–٥",
                   "verses": [ { "verseKey": "12:3", "ayah": 3, "textAr": "نَحْنُ نَقُصُّ عَلَيْكَ …" } ] } ],
      "hadith": [ { "collection": "bukhari", "collectionAr": "صحيح البخاري", "number": 3353,
                    "excerptsAr": ["…"], "sourceAr": "رواه البخاري — رقم ٣٣٥٣" } ],
      "nawawi": []
    }
  ],
  "keyPointsAr": ["…"],
  "quiz": [ { "questionAr": "…", "optionsAr": ["…", "…", "…"], "correctIndex": 0, "explanationAr": "يوسف ٤." } ],
  "previousItemId": "lut", "nextItemId": "shuayb",
  "progress": { "lastSectionIndex": 2, "completed": false, "completedAt": null, "quizBestScore": null, "quizTotal": null, "updatedAt": "…" }
}
```
- `order` has gaps on purpose (10, 30, 40 …) so later stories slot in between in chronological order. Sort by `order` and show the position in the list (١، ٢، ٣ …), not the `order` value. Use `previousItemId` / `nextItemId` for navigation; never compute them on the device.
- For `nawawi-forty`, each item has one section whose `nawawi[0].textAr` is the full hadith with an-Nawawi's own attribution and grading. Line breaks are `\n`.

## 2. Screens

1. **Entry points**
   - Home: a card «تعلّم مع نور» with «أكمل القراءة» from `continueReading[0]`.
   - The More / Explore tab.
2. **Hub**: a grid of the 9 sections (icon, `titleAr`, `itemCount` or «قريبًا»). `existingEndpoint` → navigate to the existing feature screen. Do not show a second list.
3. **Section**: header with `descriptionAr` and an expandable «منهج هذا القسم» (`methodAr`), then the item list: number, title, «يوسف عليه السلام», minutes, progress ring, ✓ when completed.
4. **Reader** (one widget for all kinds):
   - Title, then `summaryAr` in a soft box.
   - Sections one under the other, with a small section index (chips) at the top and a «قسم ٣ من ٧» indicator.
   - **Ayah block**: the mushaf font (`KfgqpcHafsUthmani`), the ayah-number ornament, and `referenceAr` under it. Tap a verse → bottom sheet:
     - «استمع»: the existing ayah audio by `verseKey`;
     - «التفسير»: the existing tafsir screen by `verseKey`;
     - «نسخ» / «مشاركة», with the reference.
   - **Hadith block**: an Amiri-style font, `excerptsAr` joined with « … », and `sourceAr` under it.
   - **«وقفة»** (`reflectionAr`): a separate tinted box with the label «وقفة», so readers see it is a reflection, not the source.
   - End of item:
     - «الدروس المستفادة» (`keyPointsAr`);
     - «اختبر فهمك» (`quiz`), one question at a time; show `explanationAr` after each answer; score locally;
     - «التالي: …» (`nextItemId`).
   - Font size slider (shared with the Quran reader), night mode, RTL, Arabic-Indic digits.
5. **Progress**:
   - Send `PUT …/progress` with `lastSectionIndex` when a section has been on screen for a few seconds (debounce: once per section). Send `completed: true` at the end.
   - After the quiz, send `quizScore` and `quizTotal = quiz.length`.
   - Guests: keep progress locally and send it after sign-in.
6. **Share**: «شارك» on a section creates an image card (verse or hadith + reference + Noor logo). Share only verbatim text with its reference, never a reflection alone.

## 3. Offline and cache

- Cache `GET /learning/items/{id}` responses on disk after the first read, so reading works offline. Invalidate everything when `catalogVersion` from `/learning` changes.
- A downloaded section works fully offline. Queue the progress PUTs in the existing offline outbox.

## 4. Tests

- [ ] The hub shows 10 stories (آدم، نوح، هود، صالح، إبراهيم، لوط، يوسف، شعيب، موسى، يونس, in that order) and 42 hadith. Sections with no items yet show «قريبًا».
- [ ] Companions and Morals open the existing screens, not a new list.
- [ ] Tap an ayah → audio plays the right verse and the tafsir opens on that verse.
- [ ] Ayah 71:1 (Nuh story) shows no Basmala inside the verse.
- [ ] Progress: read 3 sections, kill the app, reopen → «أكمل القراءة» at section 3. Go back to section 1 → the progress stays at 3.
- [ ] Quiz 2/3 then 1/3 → best stays 67%.
- [ ] Offline: open a cached story with no network; progress syncs later.
- [ ] Largest font, night mode, small phone (Realme C25): no clipped ayah text.

## 5. Coming next (server only, no app change)

- More prophet stories each week until Ramadan.
- Fiqh of fasting (Sha'ban), tajweed lessons (Tuhfat al-Atfal), asma al-husna, aqeedah, seerah.

New items appear as soon as the server is deployed; the app picks them up through `catalogVersion`.
