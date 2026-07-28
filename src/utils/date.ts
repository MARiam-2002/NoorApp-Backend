export function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function getTodayDateOnly(date = new Date()): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

const ARABIC_WEEK_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function formatArabicDateInfo(date = new Date(), locale = 'ar-EG') {
  const weekdayName = ARABIC_WEEK_DAYS[date.getDay()] ?? '';
  const gregorian = new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date) || '';

  let hijri = gregorian;
  try {
    hijri = new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date) || gregorian;
  } catch {
    try {
      hijri = new Intl.DateTimeFormat(`${locale}-u-ca-islamic`, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date) || gregorian;
    } catch {
      hijri = gregorian;
    }
  }

  return { weekdayName, gregorian, hijri };
}

