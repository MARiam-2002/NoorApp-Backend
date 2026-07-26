export type Country = {
  code: string;
  name: string;
  nameAr: string;
  dialCode: string;
};

export const Countries: Country[] = [
  { code: 'EG', name: 'Egypt', nameAr: 'مصر', dialCode: '+20' },
  { code: 'SA', name: 'Saudi Arabia', nameAr: 'السعودية', dialCode: '+966' },
  { code: 'AE', name: 'United Arab Emirates', nameAr: 'الإمارات', dialCode: '+971' },
  { code: 'KW', name: 'Kuwait', nameAr: 'الكويت', dialCode: '+965' },
  { code: 'QA', name: 'Qatar', nameAr: 'قطر', dialCode: '+974' },
  { code: 'BH', name: 'Bahrain', nameAr: 'البحرين', dialCode: '+973' },
  { code: 'OM', name: 'Oman', nameAr: 'عُمان', dialCode: '+968' },
  { code: 'JO', name: 'Jordan', nameAr: 'الأردن', dialCode: '+962' },
  { code: 'LB', name: 'Lebanon', nameAr: 'لبنان', dialCode: '+961' },
  { code: 'MA', name: 'Morocco', nameAr: 'المغرب', dialCode: '+212' },
];

export const CountryCodes = Countries.map((country) => country.code);
