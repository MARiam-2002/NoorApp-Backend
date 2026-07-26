import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const surahs = [
  { id: 1, nameEn: 'Al-Fatiha', nameAr: 'الفاتحة', totalAyahs: 7, totalPages: 1 },
  { id: 2, nameEn: 'Al-Baqarah', nameAr: 'البقرة', totalAyahs: 286, totalPages: 48 },
  { id: 3, nameEn: 'Ali Imran', nameAr: 'آل عمران', totalAyahs: 200, totalPages: 27 },
  { id: 36, nameEn: 'Ya-Sin', nameAr: 'يس', totalAyahs: 83, totalPages: 5 },
  { id: 67, nameEn: 'Al-Mulk', nameAr: 'الملك', totalAyahs: 30, totalPages: 2 },
  { id: 112, nameEn: 'Al-Ikhlas', nameAr: 'الإخلاص', totalAyahs: 4, totalPages: 1 },
];

const alFatihaAyahs = [
  { ayahNumber: 1, textAr: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', page: 1, juz: 1 },
  { ayahNumber: 2, textAr: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', page: 1, juz: 1 },
  { ayahNumber: 3, textAr: 'الرَّحْمَٰنِ الرَّحِيمِ', page: 1, juz: 1 },
  { ayahNumber: 4, textAr: 'مَالِكِ يَوْمِ الدِّينِ', page: 1, juz: 1 },
  { ayahNumber: 5, textAr: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', page: 1, juz: 1 },
  { ayahNumber: 6, textAr: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', page: 1, juz: 1 },
  {
    ayahNumber: 7,
    textAr: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ',
    page: 1,
    juz: 1,
  },
];

const alBaqarahSampleAyahs = [
  {
    ayahNumber: 1,
    textAr: 'الم',
    page: 2,
    juz: 1,
  },
  {
    ayahNumber: 2,
    textAr: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ',
    page: 2,
    juz: 1,
  },
  {
    ayahNumber: 153,
    textAr: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ',
    page: 24,
    juz: 2,
  },
];

const challengeTypes = ['QURAN_PAGES', 'ADHKAR', 'SADAQAH', 'PRAYER'] as const;

async function seedAyahs(
  surahId: number,
  ayahs: { ayahNumber: number; textAr: string; page: number; juz: number }[],
): Promise<void> {
  for (const ayah of ayahs) {
    await prisma.ayah.upsert({
      where: { surahId_ayahNumber: { surahId, ayahNumber: ayah.ayahNumber } },
      create: { surahId, ...ayah },
      update: ayah,
    });
  }
}

async function main(): Promise<void> {
  for (const surah of surahs) {
    await prisma.surah.upsert({
      where: { id: surah.id },
      create: surah,
      update: surah,
    });
  }

  await seedAyahs(1, alFatihaAyahs);
  await seedAyahs(2, alBaqarahSampleAyahs);

  for (let dayOfYear = 1; dayOfYear <= 366; dayOfYear += 1) {
    const challengeType = challengeTypes[dayOfYear % challengeTypes.length];

    await prisma.verseOfTheDay.upsert({
      where: { dayOfYear },
      create: {
        dayOfYear,
        surahNumber: 2,
        ayahNumber: (dayOfYear % 286) + 1,
        textAr: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
        referenceAr: 'سورة البقرة',
      },
      update: {},
    });

    await prisma.hadithOfTheDay.upsert({
      where: { dayOfYear },
      create: {
        dayOfYear,
        textAr: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
        sourceAr: 'رواه البخاري ومسلم',
      },
      update: {},
    });

    await prisma.dailyChallengeTemplate.upsert({
      where: { dayOfYear },
      create: {
        dayOfYear,
        titleAr: 'تحدي اليوم',
        descriptionAr: 'أكمل مهمة اليوم لتحصل على نقاط المكافأة',
        type: challengeType,
        targetValue: challengeType === 'SADAQAH' ? 10 : challengeType === 'QURAN_PAGES' ? 2 : 1,
        rewardPoints: 50,
      },
      update: {},
    });
  }

  console.log('Seed completed: surahs, ayahs, verses, hadiths, and daily challenges.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
