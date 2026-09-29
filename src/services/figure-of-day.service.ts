import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { getDayOfYear } from '../utils/date';
import {
  FIGURES_CATALOG_VERSION,
  FIGURES_OF_THE_DAY,
  FIGURE_SOURCES,
  type FigureOfTheDay,
} from '../shared/data/figures-of-the-day';
import { assertValidDayOfYear } from './daily-content.service';

export type FigureOfTheDayLite = Pick<
  FigureOfTheDay,
  'id' | 'nameAr' | 'nameEn' | 'honorificAr' | 'titleAr' | 'titleEn' | 'summaryAr'
>;

/** Consecutive days never repeat a figure until the whole catalog has been shown. */
export function getFigureIndexForDay(dayOfYear: number, year: number): number {
  const n = FIGURES_OF_THE_DAY.length;
  return (((dayOfYear - 1 + year * 7) % n) + n) % n;
}

function toLite(f: FigureOfTheDay): FigureOfTheDayLite {
  return {
    id: f.id,
    nameAr: f.nameAr,
    nameEn: f.nameEn,
    honorificAr: f.honorificAr,
    titleAr: f.titleAr,
    titleEn: f.titleEn,
    summaryAr: f.summaryAr,
  };
}

function toDetail(f: FigureOfTheDay) {
  return {
    catalogVersion: FIGURES_CATALOG_VERSION,
    ...f,
    sources: FIGURE_SOURCES,
  };
}

export function getFigureOfTheDayLite(dayOfYear = getDayOfYear(), year = new Date().getFullYear()): FigureOfTheDayLite {
  return toLite(FIGURES_OF_THE_DAY[getFigureIndexForDay(dayOfYear, year)]!);
}

export function getFigureOfTheDay(dayOfYear = getDayOfYear(), year = new Date().getFullYear()) {
  assertValidDayOfYear(dayOfYear);
  const figure = FIGURES_OF_THE_DAY[getFigureIndexForDay(dayOfYear, year)]!;
  return { dayOfYear, ...toDetail(figure) };
}

export function listFigures() {
  return {
    catalogVersion: FIGURES_CATALOG_VERSION,
    total: FIGURES_OF_THE_DAY.length,
    items: FIGURES_OF_THE_DAY.map(toLite),
  };
}

export function getFigureById(id: string) {
  const figure = FIGURES_OF_THE_DAY.find((f) => f.id === id);
  if (!figure) {
    throw new AppError('Figure not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return toDetail(figure);
}
