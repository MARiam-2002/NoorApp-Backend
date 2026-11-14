import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';

/**
 * Home screen layout, synced across the user's devices.
 * The «now» card (next prayer + the action for this time of day) is always first and is not part of the layout.
 * New sections or tools added in later versions appear at the end, visible, without overwriting the user's choices.
 */
export const HOME_SECTION_IDS = ['today', 'continue', 'challenge', 'daily_inspiration', 'tools'] as const;
export const HOME_TOOL_IDS = [
  'qibla', 'tasbih', 'sajdah', 'zakat', 'sakina', 'fasting_qada', 'listen', 'hifz',
  'rawatib', 'prayer_times', 'kahf', 'salawat', 'travel', 'hajj_umrah', 'learning',
] as const;
export const HOME_TOOLS_MAX = 8;
/** Sadaqah is not a home tool: the app has no sadaqah screen (legacy tracking is reminder-only). Saved layouts that had it drop it on read. */
export const DEFAULT_HOME_TOOLS = ['qibla', 'tasbih', 'sajdah', 'zakat', 'sakina', 'fasting_qada', 'listen', 'hifz'] as const;

type SectionId = (typeof HOME_SECTION_IDS)[number];
type ToolId = (typeof HOME_TOOL_IDS)[number];
type StoredLayout = { sections: Array<{ id: SectionId; visible: boolean }>; tools: ToolId[]; revision: number; updatedAt: string | null };

const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const homeLayoutPutSchema = z.object({
  /** Order top to bottom. Every section id must appear once. */
  sections: z.array(z.object({ id: z.enum(HOME_SECTION_IDS), visible: z.boolean() }).strict())
    .length(HOME_SECTION_IDS.length)
    .refine(v => unique(v.map(s => s.id)), 'Each section must appear once'),
  /** Shortcuts in the tools grid, in order (at most 8). */
  tools: z.array(z.enum(HOME_TOOL_IDS)).max(HOME_TOOLS_MAX).refine(unique, 'Each tool must appear once'),
  /** revision from the last GET (0 for the first save). A different value answers 409. */
  expectedRevision: z.number().int().min(0),
}).strict();

const defaults = (): StoredLayout => ({
  sections: HOME_SECTION_IDS.map(id => ({ id, visible: true })),
  tools: [...DEFAULT_HOME_TOOLS],
  revision: 0,
  updatedAt: null,
});

/** Stored layout merged with today's catalog: unknown ids dropped, missing sections appended. */
export function normalizeHomeLayout(raw: unknown): StoredLayout {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;
  const sections = Array.isArray(r.sections)
    ? r.sections.filter((s: any) => HOME_SECTION_IDS.includes(s?.id) && typeof s?.visible === 'boolean')
      .filter((s: any, i: number, all: any[]) => all.findIndex(x => x.id === s.id) === i)
      .map((s: any) => ({ id: s.id as SectionId, visible: s.visible as boolean }))
    : [];
  for (const id of HOME_SECTION_IDS) if (!sections.some((s: { id: SectionId }) => s.id === id)) sections.push({ id, visible: true });
  const tools = Array.isArray(r.tools)
    ? [...new Set(r.tools.filter((t: any) => HOME_TOOL_IDS.includes(t)))].slice(0, HOME_TOOLS_MAX) as ToolId[]
    : base.tools;
  return {
    sections,
    tools,
    revision: Number.isInteger(r.revision) && r.revision >= 0 ? r.revision : 0,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
  };
}

function present(layout: StoredLayout) {
  return {
    ...layout,
    catalog: { sections: [...HOME_SECTION_IDS], tools: [...HOME_TOOL_IDS], toolsMax: HOME_TOOLS_MAX },
  };
}

export async function getHomeLayout(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ homeLayout: unknown }>>`SELECT "homeLayout" FROM "users" WHERE "id" = ${userId}`;
  if (!rows.length) throw new AppError('User profile not found', 404, ErrorCodes.NOT_FOUND);
  return present(normalizeHomeLayout(rows[0]!.homeLayout));
}

export async function putHomeLayout(userId: string, raw: unknown, now = new Date()) {
  const input = homeLayoutPutSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ homeLayout: unknown }>>`SELECT "homeLayout" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    if (!rows.length) throw new AppError('User profile not found', 404, ErrorCodes.NOT_FOUND);
    const current = normalizeHomeLayout(rows[0]!.homeLayout);
    if (current.revision !== input.expectedRevision) {
      throw new AppError('Home layout changed on another device; fetch it and retry', 409, ErrorCodes.CONFLICT,
        { reason: 'HOME_LAYOUT_REVISION', currentRevision: current.revision });
    }
    const next: StoredLayout = { sections: input.sections, tools: input.tools, revision: current.revision + 1, updatedAt: now.toISOString() };
    await tx.$executeRaw`UPDATE "users" SET "homeLayout" = ${JSON.stringify(next)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${userId}`;
    return present(next);
  });
}
