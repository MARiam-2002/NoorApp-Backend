-- Adhkar expansion (catalog version 6): 9 new categories and more authentic adhkar in 6 existing ones.
-- Every item is Sahih or Hasan (al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi, Ibn Majah) or a Quran verse; wording copied
-- from the pinned editions. See docs/ADHKAR_CONTENT_REVIEW_2026.md (addendum 2026-11-12, part 2).
-- Existing rows are never changed: new items are appended after the last one. Each category is handled only when it is
-- in the expected state (new: absent or empty; existing: exactly the previous item count), so an empty database (fresh
-- install, seeded later from the catalog) or an already updated one is left alone, and anything else aborts.
DO $migration$
DECLARE
  cat_id TEXT;
  n INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "dhikr_categories") THEN
    RETURN;
  END IF;

  -- BEFORE_SLEEP: 7 → 11
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'BEFORE_SLEEP';
  IF cat_id IS NULL THEN RAISE EXCEPTION 'adhkar expansion: category BEFORE_SLEEP is missing'; END IF;
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 7 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('2170ce85-ca53-4fab-ad4e-69335f62c907', cat_id, 8, $a$بِاسْمِكَ رَبِّ وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، إِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ$a$, 1, $a$رواه البخاري (6320)$a$, $a$إذا أوى أحدكم إلى فراشه فلينفض فراشه ثم ليقل هذا الدعاء$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a4cb73e3-6717-4ca7-a9cf-c5fb0d2ac2d6', cat_id, 9, $a$الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَكَفَانَا وَآوَانَا فَكَمْ مِمَّنْ لاَ كَافِيَ لَهُ وَلاَ مُئْوِيَ$a$, 1, $a$رواه مسلم (2715)$a$, $a$كان النبي ﷺ يقوله إذا أوى إلى فراشه$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('3ef600c5-91f2-4d11-a6ca-691a16bba1f0', cat_id, 10, $a$اللَّهُمَّ رَبَّ السَّمَوَاتِ وَرَبَّ الأَرْضِ وَرَبَّ الْعَرْشِ الْعَظِيمِ رَبَّنَا وَرَبَّ كُلِّ شَيْءٍ فَالِقَ الْحَبِّ وَالنَّوَى وَمُنْزِلَ التَّوْرَاةِ وَالإِنْجِيلِ وَالْفُرْقَانِ أَعُوذُ بِكَ مِنْ شَرِّ كُلِّ شَيْءٍ أَنْتَ آخِذٌ بِنَاصِيَتِهِ اللَّهُمَّ أَنْتَ الأَوَّلُ فَلَيْسَ قَبْلَكَ شَيْءٌ وَأَنْتَ الآخِرُ فَلَيْسَ بَعْدَكَ شَيْءٌ وَأَنْتَ الظَّاهِرُ فَلَيْسَ فَوْقَكَ شَيْءٌ وَأَنْتَ الْبَاطِنُ فَلَيْسَ دُونَكَ شَيْءٌ اقْضِ عَنَّا الدَّيْنَ وَأَغْنِنَا مِنَ الْفَقْرِ$a$, 1, $a$رواه مسلم (2713)$a$, $a$كان النبي ﷺ يأمر إذا أخذ أحدنا مضجعه أن يقوله$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('8f5e7daf-62a1-4e1e-a203-965d1aa21c0d', cat_id, 11, $a$اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَوَاتِ وَالأَرْضِ رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ$a$, 1, $a$رواه أبو داود (5067) والترمذي (3392) - صحيح$a$, $a$قال النبي ﷺ لأبي بكر: «قُلْهُ إِذَا أَصْبَحْتَ وَإِذَا أَمْسَيْتَ وَإِذَا أَخَذْتَ مَضْجَعَكَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 11, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 11 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 7 or 11 items in BEFORE_SLEEP, found %', n;
  END IF;

  -- AFTER_PRAYER: 9 → 12
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'AFTER_PRAYER';
  IF cat_id IS NULL THEN RAISE EXCEPTION 'adhkar expansion: category AFTER_PRAYER is missing'; END IF;
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 9 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a8043167-feb9-4d24-af76-686478c352ae', cat_id, 10, $a$لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ لاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ لاَ إِلَهَ إِلاَّ اللَّهُ وَلاَ نَعْبُدُ إِلاَّ إِيَّاهُ لَهُ النِّعْمَةُ وَلَهُ الْفَضْلُ وَلَهُ الثَّنَاءُ الْحَسَنُ لاَ إِلَهَ إِلاَّ اللَّهُ مُخْلِصِينَ لَهُ الدِّينَ وَلَوْ كَرِهَ الْكَافِرُونَ$a$, 1, $a$رواه مسلم (594)$a$, $a$كان ابن الزبير يقولها في دبر كل صلاة حين يسلم، ويقول: كان رسول الله ﷺ يهلّل بهن دبر كل صلاة$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('ff22fb30-e2d2-4bd7-aae4-387aebfd4dc4', cat_id, 11, $a$اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ$a$, 1, $a$رواه أبو داود (1522) - صحيح$a$, $a$أوصى النبي ﷺ معاذًا: «لاَ تَدَعَنَّ فِي دُبُرِ كُلِّ صَلاَةٍ تَقُولُ» هذا الدعاء$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f702a287-dcc8-4658-a002-7ffa9b2ab7f3', cat_id, 12, $a$اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْجُبْنِ، وَأَعُوذُ بِكَ أَنْ أُرَدَّ إِلَى أَرْذَلِ الْعُمُرِ، وَأَعُوذُ بِكَ مِنْ فِتْنَةِ الدُّنْيَا، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ$a$, 1, $a$رواه البخاري (2822)$a$, $a$كان سعد يعلّمهن بنيه ويقول: إن رسول الله ﷺ كان يتعوذ منهن دبر الصلاة$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 12, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 12 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 9 or 12 items in AFTER_PRAYER, found %', n;
  END IF;

  -- ENTERING_MOSQUE: 9 → 10
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'ENTERING_MOSQUE';
  IF cat_id IS NULL THEN RAISE EXCEPTION 'adhkar expansion: category ENTERING_MOSQUE is missing'; END IF;
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 9 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f84e16b5-4089-4799-a91c-13161ef91061', cat_id, 10, $a$اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ$a$, 1, $a$رواه مسلم (713)$a$, $a$عند الخروج من المسجد$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 10, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 10 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 9 or 10 items in ENTERING_MOSQUE, found %', n;
  END IF;

  -- FOOD: 3 → 7
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'FOOD';
  IF cat_id IS NULL THEN RAISE EXCEPTION 'adhkar expansion: category FOOD is missing'; END IF;
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 3 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('d1012856-809f-459f-a82d-115c73ad40e9', cat_id, 4, $a$بِسْمِ اللَّهِ أَوَّلَهُ وَآخِرَهُ$a$, 1, $a$رواه أبو داود (3767) - صحيح$a$, $a$من نسي التسمية في أول الطعام$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('e76aa955-0c16-4de9-a4a4-4473f669848a', cat_id, 5, $a$الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلاَ قُوَّةٍ$a$, 1, $a$رواه الترمذي (3458) وابن ماجه (3285) - حسن$a$, $a$بعد الأكل، ومن قاله «غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('56d357ee-c28b-4dda-a8a3-ca51212ff3da', cat_id, 6, $a$الْحَمْدُ لِلَّهِ كَثِيرًا طَيِّبًا مُبَارَكًا فِيهِ، غَيْرَ مَكْفِيٍّ، وَلاَ مُوَدَّعٍ وَلاَ مُسْتَغْنًى عَنْهُ، رَبَّنَا$a$, 1, $a$رواه البخاري (5458)$a$, $a$كان النبي ﷺ يقوله إذا رُفعت مائدته$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('ca472da6-7d61-4256-ae25-0250fae3d070', cat_id, 7, $a$اللَّهُمَّ بَارِكْ لَهُمْ فِي مَا رَزَقْتَهُمْ وَاغْفِرْ لَهُمْ وَارْحَمْهُمْ$a$, 1, $a$رواه مسلم (2042)$a$, $a$دعاء الضيف لأهل البيت$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 7, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 7 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 3 or 7 items in FOOD, found %', n;
  END IF;

  -- TRAVEL: 5 → 8
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'TRAVEL';
  IF cat_id IS NULL THEN RAISE EXCEPTION 'adhkar expansion: category TRAVEL is missing'; END IF;
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 5 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('c4ed40d4-662d-4ba5-ae9a-b18fb18bf2da', cat_id, 6, $a$آيِبُونَ تَائِبُونَ عَابِدُونَ سَاجِدُونَ لِرَبِّنَا حَامِدُونَ$a$, 1, $a$رواه البخاري (1797) ومسلم (1342)$a$, $a$عند الرجوع من السفر$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('12e094a0-25d2-43d7-a269-ffd6114c07f7', cat_id, 7, $a$أَسْتَوْدِعُ اللَّهَ دِينَكَ وَأَمَانَتَكَ وَخَوَاتِيمَ عَمَلِكَ$a$, 1, $a$رواه الترمذي (3443) وأبو داود (2600) - صحيح$a$, $a$توديع المسافر$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('fa983be8-dd05-4e4a-ad6c-6f509cde0786', cat_id, 8, $a$أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ$a$, 1, $a$رواه مسلم (2708)$a$, $a$من نزل منزلًا ثم قالها «لَمْ يَضُرُّهُ شَيْءٌ حَتَّى يَرْتَحِلَ مِنْ مَنْزِلِهِ ذَلِكَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 8, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 8 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 5 or 8 items in TRAVEL, found %', n;
  END IF;

  -- SICK: 7 → 9
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'SICK';
  IF cat_id IS NULL THEN RAISE EXCEPTION 'adhkar expansion: category SICK is missing'; END IF;
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 7 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('613a8b44-c066-4def-aa76-86759aa663fc', cat_id, 8, $a$لاَ بَأْسَ طَهُورٌ إِنْ شَاءَ اللَّهُ$a$, 1, $a$رواه البخاري (3616)$a$, $a$عند عيادة المريض$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('ee5efd19-ac42-4674-ae07-524cd7198d27', cat_id, 9, $a$بِاسْمِ اللَّهِ أَرْقِيكَ مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ اللَّهُ يَشْفِيكَ بِاسْمِ اللَّهِ أَرْقِيكَ$a$, 1, $a$رواه مسلم (2186)$a$, $a$رقية جبريل للنبي ﷺ$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 9, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 9 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 7 or 9 items in SICK, found %', n;
  END IF;

  -- WAKING_UP: new category, 3 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('3bc37762-3e31-4f5b-adb1-60c600e4c182', 'WAKING_UP', $a$أذكار الاستيقاظ$a$, $a$Waking Up$a$, $a$ما يقال عند الاستيقاظ من النوم، ومن استيقظ في الليل$a$, $a$What to say on waking up, and when waking during the night$a$, $a$🌅$a$, 15, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'WAKING_UP';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a81673ef-3034-4ec8-acaf-83c922af8983', cat_id, 1, $a$الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ$a$, 1, $a$رواه البخاري (6312)$a$, $a$كان النبي ﷺ يقولها إذا استيقظ من نومه$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f77c252d-fe8a-4636-aab7-5d19961a0227', cat_id, 2, $a$لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ، وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، الْحَمْدُ لِلَّهِ، وَسُبْحَانَ اللَّهِ، وَلاَ إِلَهَ إِلاَّ اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ$a$, 1, $a$رواه البخاري (1154)$a$, $a$من تعارّ من الليل (استيقظ) فقالها «ثُمَّ قَالَ اللَّهُمَّ اغْفِرْ لِي، أَوْ دَعَا اسْتُجِيبَ، فَإِنْ تَوَضَّأَ وَصَلَّى قُبِلَتْ صَلاَتُهُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('c48ad307-c4cd-422f-a0b9-58eacdc97145', cat_id, 3, $a$الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي فِي جَسَدِي وَرَدَّ عَلَيَّ رُوحِي وَأَذِنَ لِي بِذِكْرِهِ$a$, 1, $a$رواه الترمذي (3401) - حسنه الألباني$a$, $a$إذا استيقظ أحدكم فليقل: «الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي فِي جَسَدِي وَرَدَّ عَلَيَّ رُوحِي وَأَذِنَ لِي بِذِكْرِهِ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 3 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 3 items in WAKING_UP, found %', n;
  END IF;

  -- ADHAN: new category, 3 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('62ebca9a-cd5f-49d6-aa79-9411abcef591', 'ADHAN', $a$أذكار الأذان$a$, $a$Adhan$a$, $a$ما يقال عند سماع الأذان وبعده$a$, $a$What to say while hearing the adhan and after it$a$, $a$📢$a$, 16, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'ADHAN';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('c06ee326-4783-493c-a51e-4b808b55a423', cat_id, 1, $a$لاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ$a$, 1, $a$رواه مسلم (385)$a$, $a$يقول مثل ما يقول المؤذن، فإذا قال «حي على الصلاة» أو «حي على الفلاح» قال: لا حول ولا قوة إلا بالله. ومن قال ذلك «مِنْ قَلْبِهِ دَخَلَ الْجَنَّةَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('fcfcadd7-8fff-496b-a369-3a3877d12d3a', cat_id, 2, $a$أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ وَأَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ رَضِيتُ بِاللَّهِ رَبًّا وَبِمُحَمَّدٍ رَسُولاً وَبِالإِسْلاَمِ دِينًا$a$, 1, $a$رواه مسلم (386)$a$, $a$من قالها حين يسمع المؤذن «غُفِرَ لَهُ ذَنْبُهُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('204db122-e6ce-4d85-afb6-591e9e602514', cat_id, 3, $a$اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلاَةِ الْقَائِمَةِ آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ$a$, 1, $a$رواه البخاري (614)$a$, $a$بعد الصلاة على النبي ﷺ: «إِذَا سَمِعْتُمُ الْمُؤَذِّنَ فَقُولُوا مِثْلَ مَا يَقُولُ ثُمَّ صَلُّوا عَلَيَّ فَإِنَّهُ مَنْ صَلَّى عَلَيَّ صَلاَةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا ثُمَّ سَلُوا اللَّهَ لِيَ الْوَسِيلَةَ فَإِنَّهَا مَنْزِلَةٌ فِي الْجَنَّةِ لاَ تَنْبَغِي إِلاَّ لِعَبْدٍ مِنْ عِبَادِ اللَّهِ وَأَرْجُو أَنْ أَكُونَ أَنَا هُوَ فَمَنْ سَأَلَ لِيَ الْوَسِيلَةَ حَلَّتْ لَهُ الشَّفَاعَةُ» (رواه مسلم 384). ومن قال هذا الدعاء حين يسمع النداء «حَلَّتْ لَهُ شَفَاعَتِي يَوْمَ الْقِيَامَةِ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 3 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 3 items in ADHAN, found %', n;
  END IF;

  -- HOME: new category, 4 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('eeb16bef-0dcf-4937-a322-e3c9fcc5895b', 'HOME', $a$المنزل$a$, $a$Home$a$, $a$أذكار الخروج من المنزل ودخوله$a$, $a$Leaving and entering the home$a$, $a$🏠$a$, 17, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'HOME';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('2ada03ea-4933-4c04-af0c-5531d880b33d', cat_id, 1, $a$بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ لاَ حَوْلَ وَلاَ قُوَّةَ إِلاَّ بِاللَّهِ$a$, 1, $a$رواه أبو داود (5095) والترمذي (3426) - صحيح$a$, $a$عند الخروج من البيت «يُقَالُ حِينَئِذٍ هُدِيتَ وَكُفِيتَ وَوُقِيتَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('e8f7a24b-67f7-4253-a162-b4e910e996ca', cat_id, 2, $a$اللَّهُمَّ إِنِّي أَعُوذُ بِكَ أَنْ أَضِلَّ أَوْ أُضَلَّ أَوْ أَزِلَّ أَوْ أُزَلَّ أَوْ أَظْلِمَ أَوْ أُظْلَمَ أَوْ أَجْهَلَ أَوْ يُجْهَلَ عَلَيَّ$a$, 1, $a$رواه أبو داود (5094) - صحيح$a$, $a$كان النبي ﷺ يقوله إذا خرج من بيته$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f5473e35-0189-41a6-ae9b-482ef4d158c2', cat_id, 3, $a$بِسْمِ اللَّهِ$a$, 1, $a$ذِكر الله عند دخول البيت - رواه مسلم (2018)$a$, $a$قال النبي ﷺ: «إِذَا دَخَلَ الرَّجُلُ بَيْتَهُ فَذَكَرَ اللَّهَ عِنْدَ دُخُولِهِ وَعِنْدَ طَعَامِهِ قَالَ الشَّيْطَانُ لاَ مَبِيتَ لَكُمْ وَلاَ عَشَاءَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('ca531027-5c37-41d6-ae11-36126562a0bf', cat_id, 4, $a$السَّلَامُ عَلَيْكُمْ$a$, 1, $a$عند دخول البيت، لقوله تعالى في سورة النور 61$a$, $a$﴿فَإِذَا دَخَلْتُم بُيُوتًا فَسَلِّمُوا عَلَىٰ أَنفُسِكُمْ تَحِيَّةً مِّنْ عِندِ اللَّهِ مُبَارَكَةً طَيِّبَةً﴾$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 4, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 4 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 4 items in HOME, found %', n;
  END IF;

  -- TOILET: new category, 3 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('84d84e1b-32f7-4399-a8ce-78a9c0fbd708', 'TOILET', $a$دخول الخلاء والخروج منه$a$, $a$Restroom$a$, $a$ما يقال قبل دخول الخلاء وبعد الخروج منه$a$, $a$Before entering and after leaving the restroom$a$, $a$🚪$a$, 18, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'TOILET';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('453b23b8-3f0d-4e00-ab1c-f68bb66c8495', cat_id, 1, $a$بِسْمِ اللَّهِ$a$, 1, $a$رواه الترمذي (606) - صحيح$a$, $a$«سَتْرُ مَا بَيْنَ أَعْيُنِ الْجِنِّ وَعَوْرَاتِ بَنِي آدَمَ إِذَا دَخَلَ أَحَدُهُمُ الْخَلاَءَ أَنْ يَقُولَ بِسْمِ اللَّهِ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f5213bfe-89ee-409a-ad46-21f37706be04', cat_id, 2, $a$اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ$a$, 1, $a$رواه البخاري (142) ومسلم (375)$a$, $a$كان النبي ﷺ يقوله إذا دخل الخلاء$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('c21db21f-6dc0-4a18-aea7-05c052909462', cat_id, 3, $a$غُفْرَانَكَ$a$, 1, $a$رواه أبو داود (30) والترمذي (7) - صحيح$a$, $a$كان النبي ﷺ يقوله إذا خرج من الخلاء$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 3, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 3 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 3 items in TOILET, found %', n;
  END IF;

  -- DISTRESS: new category, 6 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('799781b8-d924-423b-adbc-07bbb8d81aae', 'DISTRESS', $a$الهم والكرب$a$, $a$Worry & Distress$a$, $a$أدعية الكرب والهم والحزن من السنة الصحيحة$a$, $a$Authentic supplications for distress, worry and grief$a$, $a$💚$a$, 19, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'DISTRESS';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('42bf92f1-3622-4748-a1b2-79b015f316ba', cat_id, 1, $a$لاَ إِلَهَ إِلاَّ اللَّهُ الْعَظِيمُ الْحَلِيمُ، لاَ إِلَهَ إِلاَّ اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لاَ إِلَهَ إِلاَّ اللَّهُ رَبُّ السَّمَوَاتِ، وَرَبُّ الأَرْضِ، وَرَبُّ الْعَرْشِ الْكَرِيمِ$a$, 1, $a$رواه البخاري (6346) ومسلم (2730)$a$, $a$كان النبي ﷺ يدعو بها عند الكرب$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('900f2924-0787-4a06-a95b-767407ddc720', cat_id, 2, $a$اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ، وَغَلَبَةِ الرِّجَالِ$a$, 1, $a$رواه البخاري (6363)$a$, $a$كان النبي ﷺ يكثر أن يقولها$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('709ff4e9-3bb4-436d-aa1a-d03092953ae0', cat_id, 3, $a$لاَ إِلَهَ إِلاَّ أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ$a$, 1, $a$دعوة ذي النون - رواه الترمذي (3505) - صحيح$a$, $a$«فَإِنَّهُ لَمْ يَدْعُ بِهَا رَجُلٌ مُسْلِمٌ فِي شَيْءٍ قَطُّ إِلاَّ اسْتَجَابَ اللَّهُ لَهُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('8ef82638-548d-4ff4-a39d-f7bb965201ad', cat_id, 4, $a$اللَّهُمَّ رَحْمَتَكَ أَرْجُو فَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ وَأَصْلِحْ لِي شَأْنِي كُلَّهُ لاَ إِلَهَ إِلاَّ أَنْتَ$a$, 1, $a$رواه أبو داود (5090) - حسّن الألباني إسناده$a$, $a$دعوات المكروب$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('5a85eb2d-2898-4eca-a8ec-f8d54f9687f3', cat_id, 5, $a$اللَّهُ اللَّهُ رَبِّي لاَ أُشْرِكُ بِهِ شَيْئًا$a$, 1, $a$رواه أبو داود (1525) وابن ماجه (3882) - صحيح$a$, $a$علّمها النبي ﷺ أسماء بنت عميس: «أَلاَ أُعَلِّمُكِ كَلِمَاتٍ تَقُولِينَهُنَّ عِنْدَ الْكَرْبِ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f2c88fd9-99d1-4f86-a09f-230156ef7414', cat_id, 6, $a$حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ$a$, 1, $a$رواه البخاري (4563)$a$, $a$قالها إبراهيم عليه السلام حين أُلقي في النار، وقالها محمد ﷺ حين قيل له: إن الناس قد جمعوا لكم$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 6, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 6 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 6 items in DISTRESS, found %', n;
  END IF;

  -- FASTING: new category, 5 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('3ecc4309-4293-4838-afcb-f6a4d211a0bc', 'FASTING', $a$الصيام ورمضان$a$, $a$Fasting & Ramadan$a$, $a$دعاء الإفطار وليلة القدر ورؤية الهلال وما يقوله الصائم$a$, $a$Iftar, Laylat al-Qadr, the new crescent, and what the fasting person says$a$, $a$🌛$a$, 20, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'FASTING';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('d331222f-14d9-4df9-a951-d0bf3cb03bae', cat_id, 1, $a$ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الأَجْرُ إِنْ شَاءَ اللَّهُ$a$, 1, $a$رواه أبو داود (2357) - حسنه الألباني$a$, $a$كان النبي ﷺ يقوله إذا أفطر$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('fe16d745-edf4-4706-aa0e-c92875b39135', cat_id, 2, $a$اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي$a$, 1, $a$رواه ابن ماجه (3850) - صحيح، وعند الترمذي (3513) بزيادة «كريم»$a$, $a$سألت عائشة: «أَرَأَيْتَ إِنْ وَافَقْتُ لَيْلَةَ الْقَدْرِ مَا أَدْعُو»، فعلّمها هذا الدعاء$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('e149d13c-5a3c-4f1d-ab04-c52b9a02b17b', cat_id, 3, $a$إِنِّي صَائِمٌ$a$, 2, $a$رواه البخاري (1894)$a$, $a$إن سابّه أحد أو قاتله وهو صائم فليقل: إني صائم، مرتين$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a9695787-dc30-41bf-a423-d30295b36118', cat_id, 4, $a$أَفْطَرَ عِنْدَكُمُ الصَّائِمُونَ وَأَكَلَ طَعَامَكُمُ الأَبْرَارُ وَصَلَّتْ عَلَيْكُمُ الْمَلاَئِكَةُ$a$, 1, $a$رواه أبو داود (3854) وابن ماجه (1747) - صحيح$a$, $a$دعاء الصائم لمن فطّره$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a7d2a9d4-2f1c-44da-ad76-6c1704660381', cat_id, 5, $a$اللَّهُمَّ أَهْلِلْهُ عَلَيْنَا بِالْيُمْنِ وَالإِيمَانِ وَالسَّلاَمَةِ وَالإِسْلاَمِ رَبِّي وَرَبُّكَ اللَّهُ$a$, 1, $a$رواه الترمذي (3451) - صحيح$a$, $a$كان النبي ﷺ يقوله إذا رأى الهلال$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 5, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 5 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 5 items in FASTING, found %', n;
  END IF;

  -- WEATHER: new category, 4 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('b7c4d2c8-8730-467a-ae64-310b19f617b5', 'WEATHER', $a$المطر والريح$a$, $a$Rain & Wind$a$, $a$ما يقال عند نزول المطر وبعده وعند هبوب الريح$a$, $a$What to say when it rains, after rain, and when the wind blows$a$, $a$🌧️$a$, 21, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'WEATHER';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a2030f76-5475-418d-abdd-8ded6e283c14', cat_id, 1, $a$صَيِّبًا نَافِعًا$a$, 1, $a$رواه البخاري (1032)$a$, $a$كان النبي ﷺ إذا رأى المطر قال: صيبًا نافعًا$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('cadc3b75-53a7-4f23-a675-595a62fdff35', cat_id, 2, $a$مُطِرْنَا بِفَضْلِ اللَّهِ وَرَحْمَتِهِ$a$, 1, $a$رواه البخاري (846) ومسلم (71)$a$, $a$بعد نزول المطر$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('cf580c7a-c80f-4599-a8aa-ff53fcf5d407', cat_id, 3, $a$اللَّهُمَّ حَوَالَيْنَا وَلاَ عَلَيْنَا$a$, 1, $a$رواه البخاري (1013)$a$, $a$إذا كثر المطر وخيف منه الضرر$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('6e3219ac-8295-4d82-a1ee-b4c65d235e33', cat_id, 4, $a$اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا فِيهَا وَخَيْرَ مَا أُرْسِلَتْ بِهِ$a$, 1, $a$رواه مسلم (899)$a$, $a$كان النبي ﷺ يقوله إذا عصفت الريح$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 4, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 4 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 4 items in WEATHER, found %', n;
  END IF;

  -- DAILY_SITUATIONS: new category, 9 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('25945c32-4a2c-4f98-af1c-cea420aa52bc', 'DAILY_SITUATIONS', $a$مواقف يومية$a$, $a$Everyday Moments$a$, $a$العطاس والغضب والمصيبة واللباس الجديد ودخول السوق وكفارة المجلس وغيرها$a$, $a$Sneezing, anger, calamity, new clothes, the market, ending a gathering and more$a$, $a$🌿$a$, 22, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'DAILY_SITUATIONS';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('faf1796a-8d1a-450b-a2bf-0ee49596259d', cat_id, 1, $a$الْحَمْدُ لِلَّهِ$a$, 1, $a$رواه البخاري (6224)$a$, $a$عند العطاس: «إِذَا عَطَسَ أَحَدُكُمْ فَلْيَقُلِ الْحَمْدُ لِلَّهِ، وَلْيَقُلْ لَهُ أَخُوهُ أَوْ صَاحِبُهُ يَرْحَمُكَ اللَّهُ، فَإِذَا قَالَ لَهُ يَرْحَمُكَ اللَّهُ، فَلْيَقُلْ يَهْدِيكُمُ اللَّهُ وَيُصْلِحُ بَالَكُمْ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('4e186130-2b2f-4727-a1b7-ae9fe779f080', cat_id, 2, $a$أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ$a$, 1, $a$رواه البخاري (6115)$a$, $a$عند الغضب: «إِنِّي لأَعْلَمُ كَلِمَةً لَوْ قَالَهَا لَذَهَبَ عَنْهُ مَا يَجِدُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('8025edb0-6c97-41aa-a3ec-bfba3e83e0e2', cat_id, 3, $a$إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا$a$, 1, $a$رواه مسلم (918)$a$, $a$عند المصيبة$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('40ff47ab-d559-4498-a625-72b48e23859d', cat_id, 4, $a$الْحَمْدُ لِلَّهِ الَّذِي عَافَانِي مِمَّا ابْتَلاَكَ بِهِ وَفَضَّلَنِي عَلَى كَثِيرٍ مِمَّنْ خَلَقَ تَفْضِيلاً$a$, 1, $a$رواه الترمذي (3432) - صحيح$a$, $a$عند رؤية مبتلًى (يقولها سرًّا)، ومن قالها «لَمْ يُصِبْهُ ذَلِكَ الْبَلاَءُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('a333cc7f-d9b4-4d1e-aff1-f86c07e66219', cat_id, 5, $a$الْحَمْدُ لِلَّهِ الَّذِي كَسَانِي هَذَا الثَّوْبَ وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلاَ قُوَّةٍ$a$, 1, $a$رواه أبو داود (4023) - حسنه الألباني$a$, $a$عند لبس الثوب الجديد$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('1f1cac9b-1d18-404a-ae99-a21c67a028a3', cat_id, 6, $a$بَارَكَ اللَّهُ لَكَ وَبَارَكَ عَلَيْكَ وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ$a$, 1, $a$رواه أبو داود (2130) والترمذي (1091) - صحيح$a$, $a$التهنئة بالزواج$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('3b48ade5-62d8-4834-a3d8-317067117366', cat_id, 7, $a$لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيتُ وَهُوَ حَيٌّ لاَ يَمُوتُ بِيَدِهِ الْخَيْرُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ$a$, 1, $a$دعاء دخول السوق - رواه الترمذي (3428) - حسنه الألباني$a$, $a$من قاله عند دخول السوق «كَتَبَ اللَّهُ لَهُ أَلْفَ أَلْفِ حَسَنَةٍ وَمَحَا عَنْهُ أَلْفَ أَلْفِ سَيِّئَةٍ وَرَفَعَ لَهُ أَلْفَ أَلْفِ دَرَجَةٍ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('559bb6fe-48f1-4ead-a1dc-2ef2b3a38855', cat_id, 8, $a$سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ$a$, 1, $a$كفارة المجلس - رواه الترمذي (3433) - صحيح$a$, $a$«مَنْ جَلَسَ فِي مَجْلِسٍ فَكَثُرَ فِيهِ لَغَطُهُ فَقَالَ قَبْلَ أَنْ يَقُومَ مِنْ مَجْلِسِهِ ذَلِكَ سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ، إِلاَّ غُفِرَ لَهُ مَا كَانَ فِي مَجْلِسِهِ ذَلِكَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('85aca90a-c323-471f-aacd-11596d8bf785', cat_id, 9, $a$مَا شَاءَ اللَّهُ لَا قُوَّةَ إِلَّا بِاللَّهِ$a$, 1, $a$سورة الكهف 39$a$, $a$عند رؤية ما يعجبك من نعمة: ﴿وَلَوْلَا إِذْ دَخَلْتَ جَنَّتَكَ قُلْتَ مَا شَاءَ اللَّهُ لَا قُوَّةَ إِلَّا بِاللَّهِ﴾$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 9, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 9 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 9 items in DAILY_SITUATIONS, found %', n;
  END IF;

  -- COMPREHENSIVE_DUA: new category, 8 items
  INSERT INTO "dhikr_categories" ("id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "iconCode", "sortOrder", "totalItems", "createdAt", "updatedAt")
  VALUES ('d71dab1a-67e3-4588-a2b3-d725211628e4', 'COMPREHENSIVE_DUA', $a$أدعية جامعة$a$, $a$Comprehensive Duas$a$, $a$أدعية جامعة من القرآن والسنة كان النبي ﷺ يكثر منها$a$, $a$Comprehensive supplications the Prophet ﷺ often made$a$, $a$💫$a$, 23, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("key") DO NOTHING;
  SELECT "id" INTO cat_id FROM "dhikr_categories" WHERE "key" = 'COMPREHENSIVE_DUA';
  SELECT count(*) INTO n FROM "dhikr_items" WHERE "categoryId" = cat_id;
  IF n = 0 THEN
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('778df79f-4ecd-4df6-a7c0-8e36381d9e43', cat_id, 1, $a$اللَّهُمَّ رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً، وَفِي الآخِرَةِ حَسَنَةً، وَقِنَا عَذَابَ النَّارِ$a$, 1, $a$رواه البخاري (6389) ومسلم (2690)$a$, $a$كان أكثر دعاء النبي ﷺ$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('80369f7f-70c4-400e-a310-c8289835d71c', cat_id, 2, $a$يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ$a$, 1, $a$رواه الترمذي (2140) - صحيح$a$, $a$كان النبي ﷺ يكثر أن يقولها$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('2c33d41a-57f9-433e-a04d-e0a7270639ea', cat_id, 3, $a$اللَّهُمَّ مُصَرِّفَ الْقُلُوبِ صَرِّفْ قُلُوبَنَا عَلَى طَاعَتِكَ$a$, 1, $a$رواه مسلم$a$, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('52f13313-a088-48b8-a80b-46d3b78f857c', cat_id, 4, $a$اللَّهُمَّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَارْزُقْنِي$a$, 1, $a$رواه مسلم (2697)$a$, $a$كان النبي ﷺ يعلّمه من أسلم$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('17727477-a0bd-49d5-a7e4-5bf181d37b96', cat_id, 5, $a$اللَّهُمَّ أَصْلِحْ لِي دِينِيَ الَّذِي هُوَ عِصْمَةُ أَمْرِي وَأَصْلِحْ لِي دُنْيَايَ الَّتِي فِيهَا مَعَاشِي وَأَصْلِحْ لِي آخِرَتِي الَّتِي فِيهَا مَعَادِي وَاجْعَلِ الْحَيَاةَ زِيَادَةً لِي فِي كُلِّ خَيْرٍ وَاجْعَلِ الْمَوْتَ رَاحَةً لِي مِنْ كُلِّ شَرٍّ$a$, 1, $a$رواه مسلم (2720)$a$, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('d94f105e-9064-43c4-a957-508ffd393265', cat_id, 6, $a$اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لاَ يَنْفَعُ وَمِنْ قَلْبٍ لاَ يَخْشَعُ وَمِنْ نَفْسٍ لاَ تَشْبَعُ وَمِنْ دَعْوَةٍ لاَ يُسْتَجَابُ لَهَا$a$, 1, $a$رواه مسلم (2722)$a$, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('f863a79b-5f29-4a04-a3c5-01257e554c85', cat_id, 7, $a$اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ زَوَالِ نِعْمَتِكَ وَتَحَوُّلِ عَافِيَتِكَ وَفُجَاءَةِ نِقْمَتِكَ وَجَمِيعِ سَخَطِكَ$a$, 1, $a$رواه مسلم (2739)$a$, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
    VALUES ('e108fc10-fe17-46bc-a4d4-2d3daa0f2196', cat_id, 8, $a$رَبِّ اغْفِرْ لِي خَطِيئَتِي وَجَهْلِي وَإِسْرَافِي فِي أَمْرِي كُلِّهِ، وَمَا أَنْتَ أَعْلَمُ بِهِ مِنِّي، اللَّهُمَّ اغْفِرْ لِي خَطَايَايَ وَعَمْدِي وَجَهْلِي وَهَزْلِي، وَكُلُّ ذَلِكَ عِنْدِي، اللَّهُمَّ اغْفِرْ لِي مَا قَدَّمْتُ وَمَا أَخَّرْتُ وَمَا أَسْرَرْتُ وَمَا أَعْلَنْتُ، أَنْتَ الْمُقَدِّمُ، وَأَنْتَ الْمُؤَخِّرُ، وَأَنْتَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ$a$, 1, $a$رواه البخاري (6398)$a$, $a$كان النبي ﷺ يدعو به$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    UPDATE "dhikr_categories" SET "totalItems" = 8, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = cat_id;
  ELSIF n <> 8 THEN
    RAISE EXCEPTION 'adhkar expansion: expected 0 or 8 items in COMPREHENSIVE_DUA, found %', n;
  END IF;
END
$migration$;
