export const DefaultTimezone = 'Africa/Cairo';

export const SupportedTimezones = [
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Europe/London',
  'America/New_York',
  'UTC',
] as const;

export type SupportedTimezone = (typeof SupportedTimezones)[number];
