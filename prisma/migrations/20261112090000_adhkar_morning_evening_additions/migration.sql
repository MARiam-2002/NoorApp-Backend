-- Morning and evening adhkar: 12 → 20 and 11 → 19 items (catalog version 5).
-- New items are Sahih/Hasan narrations from al-Bukhari, Muslim, Abu Dawud, at-Tirmidhi and Ibn Majah, with the exact
-- wording of the narration; see docs/ADHKAR_CONTENT_REVIEW_2026.md (addendum 2026-11-12).
-- Existing rows keep their ids (favorites and completions stay attached); only their order changes, and two items get
-- a reference that states their grading. Runs only on a database that still has the 12/11 reviewed rows; an empty
-- database (fresh install, seeded later from the catalog) or one already updated is left alone.
DO $migration$
DECLARE
  morning_id TEXT;
  evening_id TEXT;
  morning_count INT;
  evening_count INT;
BEGIN
  SELECT "id" INTO morning_id FROM "dhikr_categories" WHERE "key" = 'MORNING';
  SELECT "id" INTO evening_id FROM "dhikr_categories" WHERE "key" = 'EVENING';
  IF morning_id IS NULL OR evening_id IS NULL THEN
    RETURN;
  END IF;
  SELECT count(*) INTO morning_count FROM "dhikr_items" WHERE "categoryId" = morning_id;
  SELECT count(*) INTO evening_count FROM "dhikr_items" WHERE "categoryId" = evening_id;
  IF morning_count = 20 AND evening_count = 19 THEN
    RETURN;
  END IF;
  IF morning_count <> 12 OR evening_count <> 11 THEN
    RAISE EXCEPTION 'adhkar additions: expected % morning and % evening items, found % and %', 12, 11, morning_count, evening_count;
  END IF;

  -- MORNING: move the existing rows to their new positions
  UPDATE "dhikr_items" SET "orderInCategory" = CASE "orderInCategory"
      WHEN 1 THEN 1
      WHEN 2 THEN 2
      WHEN 3 THEN 3
      WHEN 4 THEN 5
      WHEN 5 THEN 10
      WHEN 6 THEN 11
      WHEN 7 THEN 17
      WHEN 8 THEN 15
      WHEN 9 THEN 19
      WHEN 10 THEN 18
      WHEN 11 THEN 20
      WHEN 12 THEN 12
    END, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "categoryId" = morning_id;
  UPDATE "dhikr_items" SET "referenceAr" = $a$رواه أبو داود (5069)، وضعّف الألباني إسناده، وذكره أهل العلم في أذكار الصباح والمساء - أربع مرات$a$, "updatedAt" = CURRENT_TIMESTAMP WHERE "categoryId" = morning_id AND "orderInCategory" = 10;
  UPDATE "dhikr_items" SET "referenceAr" = $a$رواه أبو داود (5073)، وضعّف الألباني إسناده، وذكره أهل العلم في أذكار الصباح والمساء$a$, "updatedAt" = CURRENT_TIMESTAMP WHERE "categoryId" = morning_id AND "orderInCategory" = 11;

  -- MORNING: new items
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('c75c4dd9-124f-49a3-ad07-2af93b225ac4', morning_id, 4, $a$اللَّهُمَّ أَنْتَ رَبِّي، لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ$a$, 1, $a$سيد الاستغفار - رواه البخاري (6306)$a$, $a$«وَمَنْ قَالَهَا مِنَ النَّهَارِ مُوقِنًا بِهَا، فَمَاتَ مِنْ يَوْمِهِ قَبْلَ أَنْ يُمْسِيَ، فَهُوَ مِنْ أَهْلِ الْجَنَّةِ» (رواه البخاري)$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('0409139b-c614-4b49-ac80-f6179220feec', morning_id, 6, $a$اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَوَاتِ وَالأَرْضِ رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ$a$, 1, $a$رواه أبو داود (5067) والترمذي (3392) - صحيح$a$, $a$علّمه النبي ﷺ لأبي بكر الصديق وقال: «قُلْهُ إِذَا أَصْبَحْتَ وَإِذَا أَمْسَيْتَ وَإِذَا أَخَذْتَ مَضْجَعَكَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('ed35a936-67b3-44ed-ab6a-80d9209556e0', morning_id, 7, $a$اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي وَاحْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي وَأَعُوذُ بِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي$a$, 1, $a$رواه أبو داود (5074) وابن ماجه (3871) - صحيح$a$, $a$قال ابن عمر: «لَمْ يَكُنْ رَسُولُ اللَّهِ ـ صلى الله عليه وسلم ـ يَدَعُ هَؤُلاَءِ الدَّعَوَاتِ حِينَ يُمْسِي وَحِينَ يُصْبِحُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('9f9e0e48-c380-4e1c-a2c0-7c64455c1429', morning_id, 8, $a$بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ$a$, 3, $a$رواه أبو داود (5088) والترمذي (3388) - صحيح$a$, $a$من قالها حين يمسي «ثَلاَثَ مَرَّاتٍ لَمْ تُصِبْهُ فَجْأَةُ بَلاَءٍ حَتَّى يُصْبِحَ وَمَنْ قَالَهَا حِينَ يُصْبِحُ ثَلاَثَ مَرَّاتٍ لَمْ تُصِبْهُ فَجْأَةُ بَلاَءٍ حَتَّى يُمْسِيَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('c175d7b3-36e9-4394-a9dc-89694d631c85', morning_id, 9, $a$اللَّهُمَّ عَافِنِي فِي بَدَنِي اللَّهُمَّ عَافِنِي فِي سَمْعِي اللَّهُمَّ عَافِنِي فِي بَصَرِي لاَ إِلَهَ إِلاَّ أَنْتَ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ لاَ إِلَهَ إِلاَّ أَنْتَ$a$, 3, $a$رواه أبو داود (5090) - حسّن الألباني إسناده$a$, $a$قال عبد الرحمن بن أبي بكرة لأبيه: سمعتك «تُعِيدُهَا ثَلاَثًا حِينَ تُصْبِحُ وَثَلاَثًا حِينَ تُمْسِي»، فقال: سمعت رسول الله ﷺ يدعو بهن فأحب أن أستن بسنته$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('58d05c1b-7272-4fba-ab97-1eebd0b934cb', morning_id, 13, $a$سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ وَرِضَا نَفْسِهِ وَزِنَةَ عَرْشِهِ وَمِدَادَ كَلِمَاتِهِ$a$, 3, $a$رواه مسلم (2726)$a$, $a$قالها النبي ﷺ لجويرية بعد صلاة الصبح: «لَقَدْ قُلْتُ بَعْدَكِ أَرْبَعَ كَلِمَاتٍ ثَلاَثَ مَرَّاتٍ، لو وُزنت بما قلتِ منذ اليوم لوزنتهن»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('493db107-0346-49c6-acfa-5657080d5956', morning_id, 14, $a$اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلاً مُتَقَبَّلاً$a$, 1, $a$رواه ابن ماجه (925) - صحيح$a$, $a$«كَانَ يَقُولُ إِذَا صَلَّى الصُّبْحَ حِينَ يُسَلِّمُ» (بعد صلاة الفجر)$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('d6c3646d-076a-4821-a7af-dbcf4dab47fa', morning_id, 16, $a$لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ، وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ$a$, 100, $a$رواه البخاري (3293) ومسلم (2691)$a$, $a$من قالها «فِي يَوْمٍ مِائَةَ مَرَّةٍ، كَانَتْ لَهُ عَدْلَ عَشْرِ رِقَابٍ، وَكُتِبَتْ لَهُ مِائَةُ حَسَنَةٍ، وَمُحِيَتْ عَنْهُ مِائَةُ سَيِّئَةٍ، وَكَانَتْ لَهُ حِرْزًا مِنَ الشَّيْطَانِ يَوْمَهُ ذَلِكَ حَتَّى يُمْسِيَ، وَلَمْ يَأْتِ أَحَدٌ بِأَفْضَلَ مِمَّا جَاءَ بِهِ، إِلاَّ أَحَدٌ عَمِلَ أَكْثَرَ مِنْ ذَلِكَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  -- EVENING: move the existing rows to their new positions
  UPDATE "dhikr_items" SET "orderInCategory" = CASE "orderInCategory"
      WHEN 1 THEN 1
      WHEN 2 THEN 2
      WHEN 3 THEN 6
      WHEN 4 THEN 4
      WHEN 5 THEN 12
      WHEN 6 THEN 13
      WHEN 7 THEN 16
      WHEN 8 THEN 15
      WHEN 9 THEN 18
      WHEN 10 THEN 17
      WHEN 11 THEN 19
    END, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "categoryId" = evening_id;
  UPDATE "dhikr_items" SET "referenceAr" = $a$رواه أبو داود (5069)، وضعّف الألباني إسناده، وذكره أهل العلم في أذكار الصباح والمساء - أربع مرات$a$, "updatedAt" = CURRENT_TIMESTAMP WHERE "categoryId" = evening_id AND "orderInCategory" = 12;
  UPDATE "dhikr_items" SET "referenceAr" = $a$رواه أبو داود (5073)، وضعّف الألباني إسناده، وذكره أهل العلم في أذكار الصباح والمساء$a$, "updatedAt" = CURRENT_TIMESTAMP WHERE "categoryId" = evening_id AND "orderInCategory" = 13;

  -- EVENING: new items
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('237fdd93-c256-4006-a79d-0a7dd8a3ca15', evening_id, 3, $a$ءَامَنَ ٱلرَّسُولُ بِمَآ أُنزِلَ إِلَيْهِ مِن رَّبِّهِۦ وَٱلْمُؤْمِنُونَ ۚ كُلٌّ ءَامَنَ بِٱللَّهِ وَمَلَٰٓئِكَتِهِۦ وَكُتُبِهِۦ وَرُسُلِهِۦ لَا نُفَرِّقُ بَيْنَ أَحَدٍۢ مِّن رُّسُلِهِۦ ۚ وَقَالُوا۟ سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ ٱلْمَصِيرُ ۝ لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا ٱكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَآ إِن نَّسِينَآ أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَآ إِصْرًۭا كَمَا حَمَلْتَهُۥ عَلَى ٱلَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِۦ ۖ وَٱعْفُ عَنَّا وَٱغْفِرْ لَنَا وَٱرْحَمْنَآ ۚ أَنتَ مَوْلَىٰنَا فَٱنصُرْنَا عَلَى ٱلْقَوْمِ ٱلْكَٰفِرِينَ$a$, 1, $a$آخر آيتين من سورة البقرة 285-286$a$, $a$«مَنْ قَرَأَ بِالآيَتَيْنِ مِنْ آخِرِ سُورَةِ الْبَقَرَةِ فِي لَيْلَةٍ كَفَتَاهُ» (رواه البخاري 5009)$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('683238c5-ff12-493f-a6c7-a4db50e47566', evening_id, 5, $a$اللَّهُمَّ أَنْتَ رَبِّي، لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ$a$, 1, $a$سيد الاستغفار - رواه البخاري (6306)$a$, $a$«وَمَنْ قَالَهَا مِنَ اللَّيْلِ وَهْوَ مُوقِنٌ بِهَا، فَمَاتَ قَبْلَ أَنْ يُصْبِحَ، فَهْوَ مِنْ أَهْلِ الْجَنَّةِ» (رواه البخاري)$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('f205cb48-272f-4237-af9f-be22a2d27576', evening_id, 7, $a$اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَوَاتِ وَالأَرْضِ رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ أَشْهَدُ أَنْ لاَ إِلَهَ إِلاَّ أَنْتَ أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ$a$, 1, $a$رواه أبو داود (5067) والترمذي (3392) - صحيح$a$, $a$علّمه النبي ﷺ لأبي بكر الصديق وقال: «قُلْهُ إِذَا أَصْبَحْتَ وَإِذَا أَمْسَيْتَ وَإِذَا أَخَذْتَ مَضْجَعَكَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('fe651f23-d95d-4f8f-abbd-1698bbedc4da', evening_id, 8, $a$اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي وَاحْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي وَعَنْ يَمِينِي وَعَنْ شِمَالِي وَمِنْ فَوْقِي وَأَعُوذُ بِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي$a$, 1, $a$رواه أبو داود (5074) وابن ماجه (3871) - صحيح$a$, $a$قال ابن عمر: «لَمْ يَكُنْ رَسُولُ اللَّهِ ـ صلى الله عليه وسلم ـ يَدَعُ هَؤُلاَءِ الدَّعَوَاتِ حِينَ يُمْسِي وَحِينَ يُصْبِحُ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('35a74edf-827a-45a4-a49e-64586ab44d25', evening_id, 9, $a$بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ$a$, 3, $a$رواه أبو داود (5088) والترمذي (3388) - صحيح$a$, $a$من قالها حين يمسي «ثَلاَثَ مَرَّاتٍ لَمْ تُصِبْهُ فَجْأَةُ بَلاَءٍ حَتَّى يُصْبِحَ وَمَنْ قَالَهَا حِينَ يُصْبِحُ ثَلاَثَ مَرَّاتٍ لَمْ تُصِبْهُ فَجْأَةُ بَلاَءٍ حَتَّى يُمْسِيَ»$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('9aed8303-42f3-415f-a4c7-bf3a08ba59eb', evening_id, 10, $a$اللَّهُمَّ عَافِنِي فِي بَدَنِي اللَّهُمَّ عَافِنِي فِي سَمْعِي اللَّهُمَّ عَافِنِي فِي بَصَرِي لاَ إِلَهَ إِلاَّ أَنْتَ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ لاَ إِلَهَ إِلاَّ أَنْتَ$a$, 3, $a$رواه أبو داود (5090) - حسّن الألباني إسناده$a$, $a$قال عبد الرحمن بن أبي بكرة لأبيه: سمعتك «تُعِيدُهَا ثَلاَثًا حِينَ تُصْبِحُ وَثَلاَثًا حِينَ تُمْسِي»، فقال: سمعت رسول الله ﷺ يدعو بهن فأحب أن أستن بسنته$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('c6fde3de-1064-4e17-a957-d1605117dbc5', evening_id, 11, $a$أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ$a$, 3, $a$رواه الترمذي (3604) وقال: حسن، وأصله في مسلم (2709)$a$, $a$«مَنْ قَالَ حِينَ يُمْسِي ثَلاَثَ مَرَّاتٍ أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ لَمْ يَضُرَّهُ حُمَةٌ تِلْكَ اللَّيْلَةَ» (رواه الترمذي)$a$, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  INSERT INTO "dhikr_items" ("id", "categoryId", "orderInCategory", "textAr", "repeatCount", "referenceAr", "benefitAr", "createdAt", "updatedAt")
  VALUES ('8f8ce228-5ed4-4cbe-a7ce-e76604143bbe', evening_id, 14, $a$يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ$a$, 3, $a$رواه النسائي في الكبرى والحاكم$a$, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

  UPDATE "dhikr_categories" SET "totalItems" = 20, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = morning_id;
  UPDATE "dhikr_categories" SET "totalItems" = 19, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = evening_id;
END
$migration$;
