/**
 * Ready khatmah templates ("اختر نوع الختمة"). Each maps to the existing plan API (POST /quran/khatmah/plan with
 * durationDays). The seven-day division is the well-known «فمي بشوق» division by surahs; its ranges are given so
 * the app can show each day's portion.
 */
export const KHATMAH_TEMPLATES = [
  {
    id: 'SALAF_7_DAYS', titleAr: 'تحزيب السلف', subtitleAr: 'ختم القرآن في 7 أيام', durationDays: 7, icon: 'menu_book',
    days: [
      { day: 1, fromSurah: 1, toSurah: 4, labelAr: 'الفاتحة – النساء' },
      { day: 2, fromSurah: 5, toSurah: 9, labelAr: 'المائدة – التوبة' },
      { day: 3, fromSurah: 10, toSurah: 16, labelAr: 'يونس – النحل' },
      { day: 4, fromSurah: 17, toSurah: 25, labelAr: 'الإسراء – الفرقان' },
      { day: 5, fromSurah: 26, toSurah: 36, labelAr: 'الشعراء – يس' },
      { day: 6, fromSurah: 37, toSurah: 49, labelAr: 'الصافات – الحجرات' },
      { day: 7, fromSurah: 50, toSurah: 114, labelAr: 'ق – الناس' },
    ],
  },
  { id: 'RAMADAN_30', titleAr: 'ختمة رمضان', subtitleAr: 'جزء واحد يوميًا', durationDays: 30, icon: 'nightlight', days: null },
  { id: 'DAILY_PRAYERS', titleAr: 'الورد اليومي', subtitleAr: 'صفحتان بعد كل صلاة', durationDays: 61, pagesPerDay: 10, icon: 'event_repeat', days: null },
  { id: 'CUSTOM', titleAr: 'ختمة مخصصة', subtitleAr: 'خصص الختمة كما تريد', durationDays: null, icon: 'tune', days: null },
] as const;
