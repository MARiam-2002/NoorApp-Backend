/**
 * Generates src/shared/constants/sajdah-verses.ts.
 * - Verse list = the 15 sajdah marks (۩) of the Madinah Mushaf, in Mushaf order.
 * - textAr is copied verbatim from prisma/data/quran-uthmani.json (Tanzil Uthmani, same text as the Mushaf screen).
 * - textEn is Sahih International (the app's default translation, via Quran Foundation), pinned below.
 * Run: npx tsx scripts/build-sajdah-verses.ts          (write)
 *      npx tsx scripts/build-sajdah-verses.ts --check  (fail if the committed file is stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type Spec = {
  surahId: number;
  ayahNumber: number;
  surahAr: string;
  surahEn: string;
  textEn: string;
  agreed: boolean;
  noteAr?: string;
  noteEn?: string;
};

const MALIKI_MUFASSAL_AR = 'لا يراها المالكية في المشهور من مذهبهم سجدة تلاوة.';
const MALIKI_MUFASSAL_EN = 'The well-known Maliki position does not count it as a prostration of recitation.';

const SPECS: Spec[] = [
  { surahId: 7, ayahNumber: 206, surahAr: 'الأعراف', surahEn: "Al-A'raf", agreed: true,
    textEn: 'Indeed, those who are near your Lord [i.e., the angels] are not prevented by arrogance from His worship, and they exalt Him, and to Him they prostrate.' },
  { surahId: 13, ayahNumber: 15, surahAr: 'الرعد', surahEn: "Ar-Ra'd", agreed: true,
    textEn: 'And to Allāh prostrates whoever is within the heavens and the earth, willingly or by compulsion, and their shadows [as well] in the mornings and the afternoons.' },
  { surahId: 16, ayahNumber: 50, surahAr: 'النحل', surahEn: 'An-Nahl', agreed: true,
    textEn: 'They fear their Lord above them, and they do what they are commanded.' },
  { surahId: 17, ayahNumber: 109, surahAr: 'الإسراء', surahEn: 'Al-Isra', agreed: true,
    textEn: 'And they fall upon their faces weeping, and it [i.e., the Qur’ān] increases them in humble submission.' },
  { surahId: 19, ayahNumber: 58, surahAr: 'مريم', surahEn: 'Maryam', agreed: true,
    textEn: 'Those were the ones upon whom Allāh bestowed favor from among the prophets of the descendants of Adam and of those We carried [in the ship] with Noah, and of the descendants of Abraham and Israel [i.e., Jacob], and of those whom We guided and chose. When the verses of the Most Merciful were recited to them, they fell in prostration and weeping.' },
  { surahId: 22, ayahNumber: 18, surahAr: 'الحج', surahEn: 'Al-Hajj', agreed: true,
    textEn: 'Do you not see [i.e., know] that to Allāh prostrates whoever is in the heavens and whoever is on the earth and the sun, the moon, the stars, the mountains, the trees, the moving creatures and many of the people? But upon many the punishment has been justified. And he whom Allāh humiliates - for him there is no bestower of honor. Indeed, Allāh does what He wills.' },
  { surahId: 22, ayahNumber: 77, surahAr: 'الحج', surahEn: 'Al-Hajj', agreed: false,
    textEn: 'O you who have believed, bow and prostrate and worship your Lord and do good - that you may succeed.',
    noteAr: 'السجدة الثانية في سورة الحج: يسجد فيها الشافعية والحنابلة، ولا يراها الحنفية والمالكية سجدة تلاوة.',
    noteEn: 'The second prostration of Surah Al-Hajj: prostrated by the Shafi‘i and Hanbali schools; the Hanafi and Maliki schools do not count it as a prostration of recitation.' },
  { surahId: 25, ayahNumber: 60, surahAr: 'الفرقان', surahEn: 'Al-Furqan', agreed: true,
    textEn: 'And when it is said to them, "Prostrate to the Most Merciful," they say, "And what is the Most Merciful? Should we prostrate to that which you order us?" And it increases them in aversion.' },
  { surahId: 27, ayahNumber: 26, surahAr: 'النمل', surahEn: 'An-Naml', agreed: true,
    textEn: 'Allāh - there is no deity except Him, Lord of the Great Throne.' },
  { surahId: 32, ayahNumber: 15, surahAr: 'السجدة', surahEn: 'As-Sajdah', agreed: true,
    textEn: 'Only those believe in Our verses who, when they are reminded by them, fall down in prostration and exalt [Allāh] with praise of their Lord, and they are not arrogant.' },
  { surahId: 38, ayahNumber: 24, surahAr: 'ص', surahEn: 'Sad', agreed: false,
    textEn: '[David] said, "He has certainly wronged you in demanding your ewe [in addition] to his ewes. And indeed, many associates oppress one another, except for those who believe and do righteous deeds - and few are they." And David became certain that We had tried him, and he asked forgiveness of his Lord and fell down bowing [in prostration] and turned in repentance [to Allāh].',
    noteAr: 'سجد فيها النبي ﷺ (رواه البخاري — رقم 1069). هي سجدة تلاوة عند الحنفية والمالكية، وسجدة شكر عند الشافعية والحنابلة.',
    noteEn: 'The Prophet ﷺ prostrated at it (Sahih al-Bukhari 1069). A prostration of recitation for the Hanafi and Maliki schools, and of gratitude for the Shafi‘i and Hanbali schools.' },
  { surahId: 41, ayahNumber: 38, surahAr: 'فصلت', surahEn: 'Fussilat', agreed: true,
    textEn: 'But if they are arrogant - then those who are near your Lord [i.e., the angels] exalt Him by night and by day, and they do not become weary.',
    noteAr: 'موضع السجود عند الجمهور بعد الآية 38، وعند المالكية بعد الآية 37.',
    noteEn: 'The majority prostrate after verse 38; the Maliki school after verse 37.' },
  { surahId: 53, ayahNumber: 62, surahAr: 'النجم', surahEn: 'An-Najm', agreed: false,
    textEn: 'So prostrate to Allāh and worship [Him].',
    noteAr: `سجد فيها النبي ﷺ (رواه البخاري — رقم 1067). ${MALIKI_MUFASSAL_AR}`,
    noteEn: `The Prophet ﷺ prostrated at it (Sahih al-Bukhari 1067). ${MALIKI_MUFASSAL_EN}` },
  { surahId: 84, ayahNumber: 21, surahAr: 'الانشقاق', surahEn: 'Al-Inshiqaq', agreed: false,
    textEn: 'And when the Qur’ān is recited to them, they do not prostrate [to Allāh]?',
    noteAr: `سجد فيها النبي ﷺ (رواه مسلم — رقم 578). ${MALIKI_MUFASSAL_AR}`,
    noteEn: `The Prophet ﷺ prostrated at it (Sahih Muslim 578). ${MALIKI_MUFASSAL_EN}` },
  { surahId: 96, ayahNumber: 19, surahAr: 'العلق', surahEn: "Al-'Alaq", agreed: false,
    textEn: 'No! Do not obey him. But prostrate and draw near [to Allāh].',
    noteAr: `سجد فيها النبي ﷺ (رواه مسلم — رقم 578). ${MALIKI_MUFASSAL_AR}`,
    noteEn: `The Prophet ﷺ prostrated at it (Sahih Muslim 578). ${MALIKI_MUFASSAL_EN}` },
];

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/shared/constants/sajdah-verses.ts');

type QuranJson = { surahs: { number: number; ayahs: { numberInSurah: number; text: string; sajda?: unknown }[] }[] };

export function tanzilSajdaKeys(quran: QuranJson): string[] {
  return quran.surahs.flatMap((s) => s.ayahs.filter((a) => a.sajda).map((a) => `${s.number}:${a.numberInSurah}`));
}

export function loadTanzilAyah(quran: QuranJson, surahId: number, ayahNumber: number): string {
  const text = quran.surahs.find((s) => s.number === surahId)?.ayahs.find((a) => a.numberInSurah === ayahNumber)?.text;
  if (!text) throw new Error(`Tanzil text missing for ${surahId}:${ayahNumber}`);
  return text.trim();
}

function render(): string {
  const quran = JSON.parse(readFileSync(path.join(ROOT, 'prisma/data/quran-uthmani.json'), 'utf8')) as QuranJson;
  const specKeys = SPECS.map((s) => `${s.surahId}:${s.ayahNumber}`).join(',');
  if (specKeys !== tanzilSajdaKeys(quran).join(',')) {
    throw new Error(`verse list differs from the Mushaf sajda marks: ${specKeys}`);
  }
  const rows = SPECS.map((s, i) => {
    const textAr = loadTanzilAyah(quran, s.surahId, s.ayahNumber);
    if (!textAr.includes('۩')) throw new Error(`${s.surahId}:${s.ayahNumber} has no sajdah mark in the Mushaf`);
    return {
      surahId: s.surahId,
      ayahNumber: s.ayahNumber,
      referenceAr: `سورة ${s.surahAr} - آية ${s.ayahNumber}`,
      referenceEn: `Surah ${s.surahEn} — Verse ${s.ayahNumber}`,
      textAr,
      textEn: s.textEn,
      isIn10Muataqidah: s.agreed,
      ...(s.noteAr ? { noteAr: s.noteAr, noteEn: s.noteEn } : {}),
      sortOrder: i + 1,
    };
  });
  const agreed = rows.filter((r) => r.isIn10Muataqidah).length;
  if (rows.length !== 15 || agreed !== 10) throw new Error(`expected 15 rows / 10 agreed, got ${rows.length} / ${agreed}`);

  return `/**
 * Generated by scripts/build-sajdah-verses.ts — do not edit by hand.
 * The 15 sajdah marks (۩) of the Madinah Mushaf, in Mushaf order.
 * textAr: verbatim Tanzil Uthmani (prisma/data/quran-uthmani.json). textEn: Sahih International.
 * isIn10Muataqidah: the 10 prostrations the four Sunni schools agree on; the other 5 carry a madhhab note.
 */
export type SajdahVerse = {
  surahId: number;
  ayahNumber: number;
  referenceAr: string;
  referenceEn: string;
  textAr: string;
  textEn: string;
  /** One of the 10 agreed prostrations (the "سجل السجود" tab). */
  isIn10Muataqidah: boolean;
  noteAr?: string;
  noteEn?: string;
  sortOrder: number;
};

export const SAJDAH_VERSES_CATALOG: SajdahVerse[] = ${JSON.stringify(rows, null, 2)};

export const SAJDAH_VERSE_COUNT_MUATAQIDAH = SAJDAH_VERSES_CATALOG.filter((v) => v.isIn10Muataqidah).length;
export const SAJDAH_VERSE_COUNT_FULL = SAJDAH_VERSES_CATALOG.length;
`;
}

if (require.main === module) {
  const next = render();
  if (process.argv.includes('--check')) {
    const current = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n');
    if (current !== next) {
      console.error('sajdah-verses.ts is stale — run: npx tsx scripts/build-sajdah-verses.ts');
      process.exit(1);
    }
    console.log('sajdah-verses.ts is up to date (15 verses).');
  } else {
    writeFileSync(OUT, next);
    console.log(`Wrote ${OUT}`);
  }
}
