-- Quran 2:255: correct the confirmed missing ya and vowel on the verb only.
-- Preserve item IDs, category links, counts, favorites and user progress.
UPDATE "dhikr_items"
SET "textAr" = replace("textAr", 'عَلِمَ مَا بَيْنَ أَيْدِيهِمْ', 'يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ'),
    "textArPlain" = NULL
WHERE position('عَلِمَ مَا بَيْنَ أَيْدِيهِمْ' in "textAr") > 0
  AND position('كُرْسِيُّهُ' in "textAr") > 0;
