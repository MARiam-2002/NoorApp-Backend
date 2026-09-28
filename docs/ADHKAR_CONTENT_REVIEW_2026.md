# Adhkar Content Review — 2026-09-28

**Scope:** all 115 items served in production by `GET /api/v1/adhkar/full-catalog` (DB rows seeded from `prisma/seed.ts`).
The old hardcoded fallback list in `src/services/adhkar.service.ts` (used only if the DB is unreachable) had the same classes of problems; it now reads the reviewed catalog too.
Tables below use the **legacy** item numbers (before renumbering).

**Status:** APPLIED on 2026-09-28 (115 → 93 items, catalog version 2). This is an engineering triage, not a fatwa;
a qualified religious reviewer should still confirm the M-confidence rows. Applied content lives in
`src/shared/data/adhkar-catalog.ts`; the exact rules are in `scripts/lib/adhkar-corrections-2026.ts`.

## Verdict codes

| Code | Meaning |
|---|---|
| OK | Text and reference look correct |
| REF | Wrong or inaccurate reference (collection / grade) |
| BEN | Benefit (`benefitAr`) is unsupported, misattributed, or belongs to another dhikr |
| TXT | Dhikr text is corrupted, has a typo, or differs from the narrated wording |
| CNT | `repeatCount` is not in the narration |
| CAT | Placed in a category/occasion the narration does not support |
| REMOVE | No known basis, garbled, or carries a fabricated grade — should not be shown |

Confidence: **H** = well-known, easy for a reviewer to confirm; **M** = likely, needs checking.

## Summary

| Verdict | Items |
|---|---|
| REMOVE (incl. 2 CAT items with no fitting category) | 22 |
| TXT (corrupted / typo / altered wording) | 10 |
| REF / BEN / CNT / CAT (text fine) | 50 |
| OK | 33 |
| **Total** | **115** |

Per category after the fix: MORNING 12, EVENING 11, BEFORE_SLEEP 7, ENTERING_MOSQUE 9, AFTER_PRAYER 9, GENERAL_WIRD 8,
TRAVEL 5, SICK 7, FOOD 3, ISTIKHARA 1, WUDU 5, ISTIGHFAR 7, QAYN 5, MASJID_AFTER_SALAM 4 — **93**.

The REMOVE items are the most serious: several attribute invented wording to the Prophet ﷺ with the label "صحيح".

---

## MORNING

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | آية الكرسي | benefit says (رواه البخاري ومسلم) | BEN/REF | The morning/evening jinn-protection narration is in النسائي في الكبرى والحاكم (أبيّ بن كعب), not Bukhari/Muslim | H |
| 2 | المعوذات ×3 | رواه الترمذي - قال صحيح | REF | أبو داود والترمذي؛ الترمذي قال: حسن صحيح غريب | M |
| 3 | أصبحنا وأصبح الملك لله… | رواه مسلم | OK | | H |
| 4 | اللهم بك أصبحنا… | الترمذي وأبو داود - صحيح | OK | | H |
| 5 | اللهم إني أصبحت أشهدك… ×4 | رواه مسلم | REF/BEN | In أبو داود (not Muslim); grade disputed. Narrated benefit: whoever says it four times «أعتقه الله من النار» | H |
| 6 | اللهم ما أصبح بي من نعمة… | أبو داود والترمذي - صحيح | REF | أبو داود؛ grade disputed (weakened by al-Albani) | M |
| 7 | سبحان الله وبحمده ×100 | البخاري ومسلم | OK | | H |
| 8 | لا إله إلا الله وحده… ×10 | البخاري ومسلم | BEN/CNT | Benefit quoted (عدل عشر رقاب، مائة حسنة، مائة سيئة، حرز) is the ×100 narration; ×10 narration: «كان كمن أعتق أربعة أنفس من ولد إسماعيل» | H |
| 9 | أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه ×100 | الترمذي - حسن صحيح | BEN/CNT | Narration (أبو داود، الترمذي): «غُفر له وإن كان فرّ من الزحف»; quoted benefit wording not found; ×100 not in narration | M |
| 10 | سبحان الله وبحمده، سبحان الله العظيم ×100 | البخاري ومسلم | OK/CNT | Count not specified in narration | M |
| 11 | اللهم صل على محمد عبدك ورسولك… ×10 | رواه مسلم | REF | Muslim has the virtue «من صلى علي صلاة صلى الله عليه بها عشرا», not this wording nor ×10 morning/evening | M |
| 12 | يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله… ×3 | الترمذي - حسن | REF | Full wording: النسائي في الكبرى والحاكم (أنس)؛ count not narrated | M |

## EVENING

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | آية الكرسي | (رواه البخاري ومسلم) | BEN/REF | Same as MORNING 1 | H |
| 2 | المعوذات ×3 | الترمذي | OK | | H |
| 3 | اللهم بك أمسينا… وإليك المصير | الترمذي وأبو داود - صحيح | OK | | H |
| 4 | أمسينا وأمسى الملك لله… | رواه مسلم | OK | | H |
| 5 | اللهم إني أمسيت أشهدك… ×4 | رواه مسلم | REF/BEN | Same as MORNING 5 | H |
| 6 | اللهم ما أمسى بي من نعمة… | أبو داود - صحيح | REF | Same as MORNING 6 | M |
| 7 | سبحان الله وبحمده ×100 | البخاري ومسلم | BEN | Benefit «أحب الأعمال إلى الله أدومها وإن قل» is an unrelated hadith | H |
| 8 | لا إله إلا الله وحده… ×10 | البخاري ومسلم | OK | | H |
| 9 | أستغفر الله العظيم… ×100 | الترمذي - حسن | CNT | Same as MORNING 9 | M |
| 10 | سبحان الله وبحمده، سبحان الله العظيم ×100 | رواه البخاري | OK | | H |
| 11 | اللهم صل على محمد عبدك ورسولك… ×10 | رواه مسلم | REF | Same as MORNING 11 | M |

## BEFORE_SLEEP

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | آية الكرسي | رواه البخاري | OK | | H |
| 2 | المعوذات ×3 | البخاري ومسلم | OK | | H |
| 3 | باسمك اللهم أموت وأحيا | رواه البخاري | OK | | H |
| 4 | اللهم قني عذابك يوم تبعث عبادك ×3 | أبو داود والترمذي - صحيح | BEN | Benefit «مائة ألف ملك يحفظونه» has no known basis | H |
| 5 | اللهم إنك خلقت نفسي… | رواه مسلم | TXT | Typo «لك مماتها ومماتها» → «لك مماتها ومحياها» | H |
| 6 | التسبيح 33/33/34 ثم لا إله إلا الله… | البخاري ومسلم | TXT/BEN | Sleep narration (علي وفاطمة) has no tahlil ending; its benefit is «خير لكما من خادم». Current benefit text is garbled | H |
| 7 | أعوذ بالله السميع العليم من الشيطان الرجيم من همزه ونفخه ونفثه | مسلم وأبو داود | REMOVE (CAT) | This is from the opening of prayer (أبو داود، الترمذي), not a sleep dhikr, not in Muslim | H |
| 8 | اللهم اجعل داخل ليلتي سلاما… | من حصن المسلم | REMOVE | Not in Hisn al-Muslim; no known source | H |
| 9 | اللهم أسلمني لك… وفض يدي إليك… | رواه مسلم | TXT | Corrupted form of «اللهم أسلمت نفسي إليك، ووجهت وجهي إليك، وفوضت أمري إليك، وألجأت ظهري إليك…» (البخاري ومسلم) | H |

## ENTERING_MOSQUE

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | اللهم افتح لي أبواب رحمتك | رواه مسلم | OK | Benefit field holds an instruction, not a benefit | H |
| 2 | بسم الله والسلام على رسول الله… | الترمذي وأبو داود - صحيح | REF | Composite of narrations (ابن ماجه، الترمذي)؛ reviewer to set wording | M |
| 3 | أعوذ بالله العظيم وبوجهه الكريم… ×3 | الترمذي - حسن صحيح | REF/BEN/CNT | In أبو داود, said once on entering; narrated benefit: «قال الشيطان: حُفظ مني سائر اليوم» | H |
| 4 | الصلاة الإبراهيمية ×10 | البخاري ومسلم | CAT | Text fine; not an entering-mosque dhikr | M |
| 5 | سبحان الله وبحمده ×100 | رواه البخاري | BEN | «غُرست له نخلة في الجنة» is for «سبحان الله العظيم وبحمده» (الترمذي), not ×100 | H |
| 6 | لا إله إلا الله وحده… ×10 | البخاري ومسلم | CAT | Text fine | M |
| 7 | اللهم اغفر لي ذنبي كله دقه وجله… | رواه مسلم | OK | (said in sujood) | H |
| 8 | ركعتا التحية: قم فاركع… ثم اضرع ثم جلس… | البخاري ومسلم | REMOVE | Garbled pseudo-narration, not a dhikr | H |
| 9 | أستغفر الله وأتوب إليه ×100 | رواه مسلم | OK | | H |
| 10 | التسبيح 33/33/34 + التهليل | البخاري ومسلم | REF | Tahlil completion version is in Muslim | M |

## AFTER_PRAYER

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | اللهم أنت السلام… | مسلم وأبو داود | OK | | H |
| 2 | أستغفر الله ×3 | رواه مسلم | OK | | H |
| 3 | آية الكرسي بعد الصلاة | رواه مسلم | REF/BEN | النسائي في الكبرى (أبو أمامة): «لم يمنعه من دخول الجنة إلا أن يموت» | H |
| 4 | المعوذات بعد كل صلاة | رواه مسلم | REF | أبو داود والترمذي والنسائي | H |
| 5 | لا إله إلا الله… الله أكبر - أربعا (مرة واحدة كلها) | رواه مسلم | REMOVE | Garbled; benefit mismatched | H |
| 6 | سيد الاستغفار | رواه البخاري | BEN | Benefit «الله أكبر - سيد الاستغفار» is garbage text | H |
| 7 | التسبيح 33/33/34 + التهليل | البخاري ومسلم | REF | Muslim | M |
| 8 | اللهم صل وسلم وبارك على نبينا محمد… ×10 | رواه مسلم | REF/BEN | Benefit (عشر حسنات، عشر سيئات، عشر درجات) is النسائي; wording/count not in Muslim | M |
| 9 | اللهم اغفر للمؤمنين والمؤمنات… | رواه مسلم | REF | Not in Muslim; no known narration with this wording | M |
| 10 | اللهم لا مانع لما أعطيت… | رواه مسلم | OK | Part of البخاري ومسلم narration | H |

## GENERAL_WIRD

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | لا حول ولا قوة إلا بالله العلي العظيم ×100 | البخاري ومسلم | BEN | «كنز من كنوز الجنة» is authentic; «ومفتاح لكل باب خير» is not in the narration | M |
| 2 | سبحان الله وبحمده، سبحان الله العظيم ×100 | البخاري ومسلم | OK | | H |
| 3 | أستغفر الله وأتوب إليه ×100 | رواه مسلم | BEN | Benefit (فرج كل هم، كفاية كل داء) is not this narration | H |
| 4 | اللهم صل على محمد عبدك ورسولك… ×100 | رواه مسلم | REF/BEN | Same as AFTER_PRAYER 8 | M |
| 5 | يا حي يا قيوم… ×10 | الترمذي - حسن صحيح | REF | Same as MORNING 12 | M |
| 6 | اللهم اكتب علي الهدى والتقى والعفاف والغنى ×7 | الترمذي وأبو داود - صحيح | TXT/REF | Narrated: «اللهم إني أسألك الهدى والتقى والعفاف والغنى» — رواه مسلم | H |
| 7 | رب زدني علما | سورة طه 114 | OK | | H |
| 8 | اللهم اجعل قلبي مؤمنا وسعيدا، وقضي حقا مقتدا… | من حصن المسلم | REMOVE | Garbled; not in Hisn al-Muslim | H |
| 9 | اللهم إني أسألك العفو والعافية، والعفاء في الدين… | ابن ماجه - حسن | TXT | Typo «والعفاء»; narrated: «…العفو والعافية في ديني ودنياي وأهلي ومالي» (أبو داود، ابن ماجه) | H |
| 10 | سور يس والرحمن والملك والواقعة والصافات والجمعة يوم الجمعة | ورد اليوم المأثور | REMOVE | No narration for this set; the Friday sunnah is سورة الكهف | H |

## TRAVEL

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | سبحان الذي سخر لنا هذا… ×3 | الزخرف 13-14 - البخاري ومسلم | REF | Travel supplication is in Muslim | M |
| 2 | اللهم أنت الصاحب في السفر… | مسلم وأبو داود | TXT | Phrase duplicated twice | H |
| 3 | سبحان الله وبحمده ×150 | رواه مسلم | REMOVE | Benefit «أجر مئة مكة» is fabricated; no ×150 travel narration | H |
| 4 | حسبي الله وكفى، لا إله إلا هو… ×7 | أبو داود والترمذي - صحيح | REMOVE | Altered wording; the known narration (أبو داود) is موقوف على أبي الدرداء and its authenticity is disputed | H |
| 5 | اللهم إني أسألك في سفري هذا البر والتقوى… | رواه مسلم | OK | Narrated in plural «إنا نسألك في سفرنا هذا» | M |
| 6 | رب أنزلني منزلا مباركا وأنت خير المنزلين ×3 | البخاري ومسلم | REF | This is Quran (المؤمنون 29), not a Bukhari/Muslim narration | H |
| 7 | المعوذات | حصن المسلم | CAT | Occasion not supported as stated | M |

## SICK

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | اللهم رب الناس أذهب البأس… ×7 | البخاري ومسلم | CNT/BEN | Text fine; the "hand on pain ×7" instruction belongs to item 2 | H |
| 2 | أعوذ بالله وقدرته من شر ما أجد وأحاذر ×7 | رواه مسلم | OK | | H |
| 3 | آية الكرسي ×3 (رقية) | رواه الترمذي | BEN/REF | Benefit (سبع مرات، السحر، العين) has no known narration | H |
| 4 | اللهم لا تؤاخذنا بعذابك ولا تؤاخذنا بعذابك… | الطبراني وابن حبان - صحيح | REMOVE | Garbled; fabricated grade | H |
| 5 | المعوذات (رقية) | الرقية الشرعية | OK | | H |
| 6 | يا حي يا قيوم… ×10 | ابن السني وابن حبان - صحيح | REF | Same as MORNING 12 | M |
| 7 | رب اشفه (أو اشفني) وأنت الشافي… | رواه أبو داود | TXT | Wording differs from narrations; reviewer to set | M |
| 8 | اللهم إني أسألك العافية في الديني والدنيا والآخرة | الطبراني - حسن صحيح | TXT/REF | Typo «الديني»; narration in أبو داود وابن ماجه | H |

## FOOD

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | بسم الله وعلى بركة الله | أبو داود والترمذي - صحيح | TXT | Narrated: «بسم الله» (and «بسم الله أوله وآخره» if forgotten) | M |
| 2 | اللهم بارك لنا فيما رزقتنا وقنا عذاب النار | الترمذي وابن ماجه - صحيح | REF | Not in Tirmidhi/Ibn Majah with this wording; authentic alternative: «اللهم بارك لنا فيه وأطعمنا خيرا منه» (الترمذي) | M |
| 3 | الحمد لله الذي أطعمنا وسقانا وجعلنا مسلمين | أبو داود والترمذي | OK | Grade disputed | M |
| 4 | إن شاء الله بارك فيه ولم يضر من شاره | — | REMOVE | No known basis | H |
| 5 | اللهم أحللت لنا حلالك… | الطبراني وابن حبان - صحيح | REMOVE | No known basis; fabricated grade | H |
| 6 | غفر الله لك ما سلف من ذنبك وما أخر | — | REMOVE | Not a food supplication | H |
| 7 | رب اغفر لي وارحمني وبارك لي فيما رزقتني وقني عذاب النار | ابن ماجه وابن حبان - صحيح | REMOVE | No known narration with this wording | M |

## ISTIKHARA

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | آية الكرسي «قبل صلاة الاستخارة» | — | REMOVE | No basis for this occasion | H |
| 2 | المعوذات «قبل الاستخارة من السنة» | — | REMOVE | No basis for this occasion | H |
| 3 | دعاء الاستخارة | البخاري ومسلم | REF/BEN | رواه البخاري (not Muslim); «سبع مرات» in the benefit is not narrated | H |
| 4 | اللهم إني أسألك الهدى والسلامة في ديني ودنياي… ×7 | الترمذي وأبو داود - صحيح | REMOVE | No known narration with this wording | M |
| 5 | سيد الاستغفار «قبل اتخاذ القرار» | رواه البخاري | REMOVE (CAT) | Text authentic; occasion unsupported — removed from this category (still in ISTIGHFAR / AFTER_PRAYER) | H |

## WUDU

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | بسم الله | أبو داود والترمذي - صحيح | OK | | H |
| 2 | اللهم اجعلني من التوابين… | الترمذي وابن ماجه | OK | | H |
| 3 | أشهد أن لا إله إلا الله… وأشهد أن محمدا عبدك ورسولك | رواه مسلم | TXT | Narrated: «عبده ورسوله» | H |
| 4 | سبحانك اللهم وبحمدك… | الترمذي وأبو داود | REF | النسائي في الكبرى (أبو سعيد) | M |
| 5 | اللهم زيني بزينة الإيمان… | الحاكم وصححه | REMOVE | No basis as a wudu dhikr | M |
| 6 | اللهم اغفر لي ذنبي ووسع لي في داري… | ابن ماجه وابن حبان - صحيح | REF | الترمذي والنسائي (أبو موسى)؛ grade disputed | M |

## ISTIGHFAR

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | أستغفر الله وأتوب إليه ×100 | البخاري ومسلم | OK | | H |
| 2 | أستغفر الله العظيم الذي لا إله إلا هو… ×100 | الترمذي - حسن صحيح | BEN | Benefit «سيد الاستغفار للذين أتوب إليه صحيح» is garbage text | H |
| 3 | سيد الاستغفار ×10 | البخاري وأبو داود | CNT | Narrated once morning/evening | H |
| 4 | اللهم اغفر لي ذنبي كله… | مسلم وأبو داود | OK | | H |
| 5 | رب اغفر لي وتب علي إنك أنت التواب الرحيم ×40 | الترمذي وابن ماجه | CNT | Narration counts 100 in one sitting | H |
| 6 | اللهم إني ظلمت نفسي ظلما كثيرا… | البخاري ومسلم - دعاء سيدنا آدم | REF | Taught by the Prophet ﷺ to Abu Bakr; Adam's supplication is «ربنا ظلمنا أنفسنا» (الأعراف 23) | H |
| 7 | سبحان الله وبحمده، أستغفر الله وأتوب إليه ×100 | الترمذي وابن حبان - صحيح | REF | رواه مسلم (عائشة) | H |

## QAYN

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | سبحان الله عدد ما خلق… | رواه مسلم | REF | Wording closer to الترمذي/النسائي; Muslim has «سبحان الله وبحمده عدد خلقه…» | M |
| 2 | سبحان الله وبحمده ×100 | البخاري ومسلم | BEN | «تعدل مئة رقبة» is not this narration | H |
| 3 | المعوذات | — | OK | | M |
| 4 | الإخلاص ×11 | الترمذي وابن ماجه - حسن | REMOVE | Benefit «مثقال حجرتين من نار جهنم» has no known basis | H |
| 5 | الصلاة الإبراهيمية ×10 | رواه مسلم | OK | (البخاري ومسلم) | H |
| 6 | لا إله إلا الله وحده… ×10 | البخاري ومسلم | OK | | H |
| 7 | رب اغفر وارحم إنك أنت الأعلون | النسائي وأبو داود - حسن صحيح | REMOVE | Garbled («الأعز الأكرم»), موقوف, fabricated grade | H |

## MASJID_AFTER_SALAM

| # | Dhikr (start) | Current reference | Verdict | Finding | Conf. |
|---|---|---|---|---|---|
| 1 | أستغفر الله ×3 | رواه مسلم | OK | | H |
| 2 | اللهم أنت السلام… | مسلم وأبو داود | OK | | H |
| 3 | التسبيح 33/33/34 + التهليل | البخاري ومسلم | REF | Muslim | M |
| 4 | آية الكرسي بعد السلام | رواه مسلم | REF | Same as AFTER_PRAYER 3 | H |
| 5 | اللهم اجعل قلبي ساكنا مما خلقت… | الحاكم وصححه | REMOVE | No known basis | H |
| 6 | اللهم لا تدخلني جنة في رودة من شأني… | ابن ماجه وابن حبان - صحيح | REMOVE | Gibberish; fabricated grade | H |

---

## How the fixes were applied

- `scripts/apply-adhkar-corrections-2026.ts` (dry run by default, `--apply` to write) matched every rule by
  category + legacy order + text prefix, wrote a JSON backup to `tmp/` (git-ignored), then per category in one transaction:
  updated surviving rows **in place** (same `id`), renumbered `orderInCategory` 1..n, deleted REMOVE rows, moved any
  resume mark pointing at a removed row to the next surviving row, and updated `totalItems`. It verifies the result
  against the catalog and refuses to run again once applied.
- Impact at apply time: 22 rows removed, 0 favorites lost, 0 resume marks moved, 7 historical completions kept with
  `itemId = null`.
- Flutter contract unchanged (same routes, fields, types). `ADHKAR_STATIC_CATALOG_VERSION` is 2, so
  `adhkar/static-meta` `contentHash` changed and apps re-download the catalog.
- `prisma/seed.ts` and the offline fallback in `adhkar.service.ts` both read `src/shared/data/adhkar-catalog.ts`, and the
  seed now updates items in place by position instead of delete + recreate, so re-seeding keeps item ids.
- Any future wording/reference change: edit the catalog, bump `ADHKAR_STATIC_CATALOG_VERSION`, and update production rows
  in place (never delete + recreate).
