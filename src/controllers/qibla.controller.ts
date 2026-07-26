import type { Request, Response } from 'express';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { calculateQibla, getMyQibla } from '../services/qibla.service';

export const calculateQiblaHandler = asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude } = req.query as unknown as {
    latitude: number;
    longitude: number;
  };

  const data = calculateQibla(Number(latitude), Number(longitude));

  sendSuccess(res, data, 'Qibla direction calculated successfully');
});

export const getMyQiblaHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;

  const data = await getMyQibla(userId);

  sendSuccess(res, data, 'Your Qibla direction retrieved successfully');
});
