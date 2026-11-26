/** A Quran-pages challenge asks for the user's own daily goal, so the app shows one number. */
import assert from 'node:assert/strict';
import { arabicPagesPhrase, personalizeChallengeTemplate } from '../src/shared/utils/challenge-personalize';

const six = { type: 'QURAN_PAGES', targetValue: 6, titleAr: 'ست صفحات', titleEn: 'Six pages', descriptionAr: 'اقرأ ست صفحات من القرآن اليوم', descriptionEn: 'Read six pages of the Quran today', rewardPoints: 60 };
const p = personalizeChallengeTemplate(six, 5);
assert.equal(p.targetValue, 5, 'target follows the daily goal');
assert.equal(p.titleAr, 'وردك اليوم: 5 صفحات');
assert.equal(p.titleEn, "Today's wird: 5 pages");
assert.equal(p.descriptionAr, 'اقرأ 5 صفحات اليوم، هدفك اليومي');
assert.equal(p.rewardPoints, 60, 'reward kept');

assert.equal(personalizeChallengeTemplate(six, 6), six, 'already equal: authored text kept');
assert.equal(personalizeChallengeTemplate(six, 0), six, 'finished khatmah (goal 0) keeps the authored challenge');
const prayer = { type: 'PRAYER', targetValue: 5, titleAr: 'الصلاة نور' };
assert.equal(personalizeChallengeTemplate(prayer, 3), prayer, 'prayer challenges unchanged');

const hadith = { type: 'QURAN_PAGES', targetValue: 4, titleAr: 'القرآن شفيع لأصحابه', descriptionAr: 'قال النبي ﷺ: «اقْرَءُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لأَصْحَابِهِ» (رواه مسلم — رقم 804). اقرأ أربع صفحات اليوم', descriptionEn: 'The Prophet ﷺ said: “Recite the Quran, for it will come on the Day of Resurrection as an intercessor for its companions” (Sahih Muslim 804). Read four pages today' };
const h = personalizeChallengeTemplate(hadith, 2);
assert.equal(h.descriptionAr, 'قال النبي ﷺ: «اقْرَءُوا الْقُرْآنَ فَإِنَّهُ يَأْتِي يَوْمَ الْقِيَامَةِ شَفِيعًا لأَصْحَابِهِ» (رواه مسلم — رقم 804). اقرأ صفحتين اليوم، هدفك اليومي', 'hadith kept, ask rewritten');
assert.ok(h.descriptionEn!.startsWith('The Prophet ﷺ said: “Recite') && h.descriptionEn!.endsWith('Read 2 pages today, your daily goal'));
assert.equal(h.titleAr, 'وردك اليوم: صفحتان');

assert.deepEqual([1, 2, 3, 10, 11, 20].map(arabicPagesPhrase), ['صفحة واحدة', 'صفحتين', '3 صفحات', '10 صفحات', '11 صفحة', '20 صفحة']);
console.log('challenge personalization: ALL PASSED (pages challenge = daily goal; prayer/adhkar and goal 0 unchanged; hadith kept)');
