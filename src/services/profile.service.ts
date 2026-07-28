import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { hashPassword, verifyPassword } from '../lib/auth';

export type UserProfile = {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  points: number;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function getProfile(userId: string): Promise<UserProfile> {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      points: true,
      timezone: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!profile) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return profile;
}

export async function updateProfile(
  userId: string,
  data: { username?: string; fullName?: string | null; email?: string; timezone?: string },
): Promise<UserProfile> {
  if (data.email !== undefined) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new AppError(
        'Email is already in use by another account',
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
      );
    }
  }

  if (data.username !== undefined) {
    const usernameExists = await prisma.user.count({
      where: {
        AND: [
          { username: { equals: data.username.trim(), mode: 'insensitive' } },
          { NOT: { id: userId } },
        ],
      },
    });
    if (usernameExists > 0) {
      throw new AppError(
        'Username is already taken',
        HttpStatus.CONFLICT,
        ErrorCodes.CONFLICT,
        { field: 'username' },
      );
    }
  }

  const updateData: { username?: string; fullName?: string | null; email?: string; timezone?: string } = {};
  if (data.username !== undefined) updateData.username = data.username.trim();
  if (data.fullName !== undefined) updateData.fullName = data.fullName ? data.fullName.trim() : null;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.timezone !== undefined) updateData.timezone = data.timezone;

  const updatedProfile = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      points: true,
      timezone: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!updatedProfile) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return updatedProfile;
}

export async function changePassword(
  userId: string,
  data: { currentPassword: string; newPassword: string },
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
    },
  });

  if (!user) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  if (!user.password) {
    throw new AppError(
      'Password change is not available for this account type',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const isCurrentPasswordValid = await verifyPassword(
    data.currentPassword,
    user.password,
  );

  if (!isCurrentPasswordValid) {
    throw new AppError(
      'Current password is incorrect',
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.INVALID_CREDENTIALS,
    );
  }

  const newPasswordHash = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: newPasswordHash },
  });

  return true;
}

export async function updateLocation(
  userId: string,
  data: { latitude: number; longitude: number; timezone?: string },
): Promise<UserProfile> {
  const updateData: {
    latitude: number;
    longitude: number;
    timezone?: string;
  } = {
    latitude: data.latitude,
    longitude: data.longitude,
  };

  if (data.timezone !== undefined) {
    updateData.timezone = data.timezone;
  }

  const updatedProfile = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      points: true,
      timezone: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!updatedProfile) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return updatedProfile;
}
