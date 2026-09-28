/**
 * Noor AI Phase 2: retrieval-only Arabic normalization (pure, no DB/network).
 * Run: npx tsx scripts/test-ai-arabic-normalize.ts
 */
import assert from 'node:assert/strict';
import {
  arabicDaggerOmittedVariants,
  arabicPrefixForms,
  arabicSearchVariants,
  arabicSkeleton,
  normalizeArabicDigits,
  normalizeArabicForSearch as norm,
  tokenizeArabic,
} from '../src/shared/utils/arabic-normalize';
import { stripArabicDiacritics } from '../src/shared/utils/arabic-text';

const skel = (s: string) => arabicSkeleton(norm(s));

console.log('--- harakat, shadda, sukun, tanween ---');
assert.equal(norm('بِسْمِ'), 'بسم');
assert.equal(norm('ٱللَّهُ'), 'الله');
assert.equal(norm('رَحْمَةً'), 'رحمه');

console.log('--- Quranic annotation / waqf / hizb / sajdah marks ---');
assert.equal(norm('سِنَةٌۭ'), 'سنه');
assert.equal(norm('ٱلْقَيُّومُ ۚ لَا'), 'القيوم لا');
assert.equal(norm('۞ لَّيْسَ'), 'ليس');
assert.equal(norm('وَٱسْجُدُوا۟ ۩'), norm('واسجدوا'));
assert.equal(norm('لَآ'), 'لا');

console.log('--- tatweel + hamza-on-tatweel ---');
assert.equal(norm('الـــرحمن'), 'الرحمن');
assert.equal(norm('يَسْـَٔلُونَكَ'), 'يسلونك');
assert.equal(skel('يَسْـَٔلُونَكَ'), skel('يسألونك'));

console.log('--- alef variants, alef maqsura, ta marbuta, hamza seats ---');
for (const ch of ['أ', 'إ', 'آ', 'ٱ']) assert.equal(norm(`${ch}ب`), 'اب');
assert.equal(norm('ٱلْأَرْضِ'), norm('الأرض'));
assert.equal(norm('موسى'), 'موسي');
assert.equal(norm('عَلَىٰ'), norm('على'));
assert.equal(norm('مُوسَىٰ'), norm('موسى'));
assert.equal(norm('الجنة'), 'الجنه');
assert.equal(norm('مُؤْمِنٌ'), 'مومن');
assert.equal(norm('بئر'), 'بير');

console.log('--- Uthmani → standard spelling ---');
assert.equal(norm('ٱلصَّلَوٰةَ'), norm('الصلاة'));
assert.equal(norm('ٱلزَّكَوٰةَ'), norm('الزكاة'));
assert.equal(norm('ٱلصَّٰبِرِينَ'), norm('الصابرين'));
assert.equal(norm('ٱلْكِتَٰبِ'), norm('الكتاب'));
assert.equal(norm('إِبْرَٰهِۦمَ'), norm('إبراهيم'));
assert.equal(norm('ٱلرِّبَوٰا۟'), norm('الربا'));
assert.equal(norm('بِهِۦ'), 'به');
assert.equal(norm('لَهُۥ'), 'له');
assert.ok(arabicSearchVariants('ٱلسَّمَٰوَٰتِ').includes(norm('السماوات')));
assert.ok(arabicSearchVariants('وَٰحِدٌۭ').includes(norm('واحد')));
assert.equal(skel('ٱلرَّحْمَٰنِ'), skel('الرحمن'));
assert.deepEqual(arabicSearchVariants('بِسْمِ'), ['بسم']);

console.log('--- tanween alef and dagger-alef spelling variants ---');
assert.deepEqual(arabicSearchVariants('عِيدًۭا'), ['عيدا', 'عيد']);
assert.ok(arabicSearchVariants('عيداً').includes('عيد'));
assert.equal(norm('عِيدًا'), 'عيدا', 'primary key keeps the written alef');
assert.deepEqual(arabicDaggerOmittedVariants('إِلَٰهَ'), ['اله']);
assert.deepEqual(arabicDaggerOmittedVariants('ٱلرَّحْمَٰنِ'), ['الرحمن']);
assert.deepEqual(arabicDaggerOmittedVariants('هَٰذَا'), ['هذا']);
assert.deepEqual(arabicDaggerOmittedVariants('بِسْمِ'), [], 'no dagger alef, no variant');
assert.ok(!arabicSearchVariants('ٱلْكِتَٰبِ').includes('الكتب'), 'الكتب is only a spelling variant, never a primary form');

console.log('--- digits, invisibles, whitespace, idempotence ---');
assert.equal(normalizeArabicDigits('٢:٢٥٥-٢٥٧'), '2:255-257');
assert.equal(normalizeArabicDigits('۲۵۵'), '255');
assert.equal(norm('\uFEFFبِسْمِ\u200F   ٱللَّهِ'), 'بسم الله');
for (const s of ['ٱلصَّلَوٰةَ', 'إِبْرَٰهِۦمَ', 'آيات عن الصبر']) assert.equal(norm(norm(s)), norm(s));

console.log('--- tokens and prefix forms ---');
assert.deepEqual(tokenizeArabic(norm('آيات عن الصبر 2 patience!')), ['ايات', 'عن', 'الصبر']);
assert.ok(arabicPrefixForms('بالصبر').includes('صبر'));
assert.ok(arabicPrefixForms('والارض').includes('ارض'));
assert.deepEqual(arabicPrefixForms('ولد'), ['ولد'], 'short words keep their first letter');

console.log('--- canonical text is never altered; legacy helper unchanged ---');
const canonical = 'ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ';
const copy = String(canonical);
norm(canonical);
arabicSearchVariants(canonical);
arabicDaggerOmittedVariants(canonical);
assert.equal(canonical, copy);
assert.notEqual(norm(canonical), canonical);
assert.equal(stripArabicDiacritics('ٱلصَّلَوٰةَ'), 'الصلوه', '/quran/search normalization must stay as before');

console.log('arabic normalize: OK');
