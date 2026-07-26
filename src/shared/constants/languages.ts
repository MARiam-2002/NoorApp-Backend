export const Languages = {
  AR: 'ar',
  EN: 'en',
} as const;

export type Language = (typeof Languages)[keyof typeof Languages];

export const LanguageList = Object.values(Languages);

export const DefaultLanguage: Language = Languages.AR;
