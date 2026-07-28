import type { Request, Response } from 'express';
import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import {
  deleteNotification,
  getNotification,
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from '../services/notification.service';

export const listNotificationsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const { page, perPage } = req.query as unknown as {
      page: number;
      perPage: number;
    };

    const result = await listNotifications(userId, page, perPage);
    sendSuccess(
      res,
      result.data,
      'Notifications retrieved successfully',
      req,
      HttpStatus.OK,
      result.meta,
    );
  },
);

export const getUnreadCountHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const data = await getUnreadCount(userId);
    sendSuccess(res, data, 'Unread count retrieved successfully', req);
  },
);

export const markAsReadHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const { id } = req.params as { id: string };
    const data = await markAsRead(userId, id);
    sendSuccess(res, data, 'Notification marked as read successfully', req);
  },
);

export const markAllAsReadHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const data = await markAllAsRead(userId);
    sendSuccess(res, data, 'All notifications marked as read successfully', req);
  },
);

export const deleteNotificationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const { id } = req.params as { id: string };
    await deleteNotification(userId, id);
    res.status(HttpStatus.NO_CONTENT).send();
  },
);

export const getNotificationHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.UNAUTHORIZED,
      );
    }

    const { id } = req.params as { id: string };
    const data = await getNotification(userId, id);
    sendSuccess(res, data, 'Notification retrieved successfully', req);
  },
);
