import type { Request, Response } from 'express';
import { z } from 'zod';
import { aiConfig } from '../config';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { getAIStatus } from '../services/ai/ai-status.service';
import {
  discoverQuran,
  QURAN_DISCOVERY_DEFAULT_LIMIT,
  QURAN_DISCOVERY_MAX_LIMIT,
  QURAN_DISCOVERY_MAX_QUERY_LENGTH,
} from '../services/ai/quran-discovery.service';

export const quranDiscoverySchema = z.object({
  query: z.string().trim().min(1).max(QURAN_DISCOVERY_MAX_QUERY_LENGTH),
  limit: z.coerce.number().int().min(1).max(QURAN_DISCOVERY_MAX_LIMIT).default(QURAN_DISCOVERY_DEFAULT_LIMIT),
});

export const getAIStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, getAIStatus(aiConfig), 'Noor AI status retrieved successfully', req);
});

export const quranDiscoveryHandler = asyncHandler(async (req: Request, res: Response) => {
  const { query, limit } = req.body as z.infer<typeof quranDiscoverySchema>;
  const data = await discoverQuran(query, limit);
  sendSuccess(res, data, 'Quran discovery completed successfully', req);
});
