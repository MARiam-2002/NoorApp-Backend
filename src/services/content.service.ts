import {
  getVerseOfTheDay,
  getHadithOfTheDay,
  getDailyChallengeTemplate,
  assertValidDayOfYear,
} from './daily-content.service';

export async function getVerseOfDay(dayOfYear?: number) {
  return getVerseOfTheDay(dayOfYear);
}

export async function getHadithOfDay(dayOfYear?: number) {
  return getHadithOfTheDay(dayOfYear);
}

export async function getDailyChallenge(dayOfYear?: number) {
  return getDailyChallengeTemplate(dayOfYear);
}

export async function getVerseOfDayByDay(day: number) {
  assertValidDayOfYear(day);
  return getVerseOfDay(day);
}

export async function getHadithOfDayByDay(day: number) {
  assertValidDayOfYear(day);
  return getHadithOfDay(day);
}

export async function getDailyChallengeByDay(day: number) {
  assertValidDayOfYear(day);
  return getDailyChallenge(day);
}
