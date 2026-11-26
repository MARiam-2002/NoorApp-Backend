/**
 * One number for "today's pages" everywhere.
 *
 * A Quran-pages challenge used to carry its own target (2–20 pages) while the
 * Quran tile, Journey and the khatmah plan used the user's daily goal, so the
 * app showed «٦ صفحات» next to «٠/٥». A pages challenge now asks for the
 * user's own daily goal; its reward is for keeping that goal. Prayer and
 * adhkar challenges are unchanged. A goal of 0 (khatmah finished) keeps the
 * authored challenge.
 */
export type ChallengeTemplateLike = {
  type?: string | null;
  targetValue?: number | null;
  titleAr?: string | null;
  titleEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  rewardPoints?: number | null;
};

/** «صفحة واحدة» · «صفحتين» · «٣ صفحات» · «١١ صفحة» (accusative, after «اقرأ»). */
export function arabicPagesPhrase(n: number): string {
  if (n === 1) return 'صفحة واحدة';
  if (n === 2) return 'صفحتين';
  if (n >= 3 && n <= 10) return `${n} صفحات`;
  return `${n} صفحة`;
}

/** Title form (nominative): «صفحة واحدة» · «صفحتان» · «٣ صفحات» · «١١ صفحة». */
function arabicPagesTitle(n: number): string {
  return n === 2 ? 'صفحتان' : arabicPagesPhrase(n);
}

const englishPages = (n: number) => (n === 1 ? '1 page' : `${n} pages`);

/** The leading hadith of an authored description, up to its reference «(رواه …)». */
function leadingQuote(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/^(.*?[»”"]\s*\([^)]*\))/);
  return m ? m[1]!.trim() : null;
}

export function personalizeChallengeTemplate<T extends ChallengeTemplateLike>(template: T, dailyPagesGoal: number): T {
  if (template.type !== 'QURAN_PAGES') return template;
  const goal = Math.floor(dailyPagesGoal);
  if (!Number.isFinite(goal) || goal <= 0) return template;
  if (template.targetValue === goal) return template;

  const quoteAr = leadingQuote(template.descriptionAr);
  const quoteEn = leadingQuote(template.descriptionEn);
  const askAr = `اقرأ ${arabicPagesPhrase(goal)} اليوم، هدفك اليومي`;
  const askEn = `Read ${englishPages(goal)} today, your daily goal`;
  return {
    ...template,
    targetValue: goal,
    titleAr: `وردك اليوم: ${arabicPagesTitle(goal)}`,
    titleEn: `Today's wird: ${englishPages(goal)}`,
    descriptionAr: quoteAr ? `${quoteAr}. ${askAr}` : askAr,
    descriptionEn: quoteEn ? `${quoteEn}. ${askEn}` : askEn,
  };
}
