import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { hashPassword, verifyPassword } from '../lib/auth';

export type UserProfile = {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  points: number;
  level: number;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  prayerCalculationMethod: string;
  quranFontSize: number;
  quranReciter: string;
  quranTafsir: string;
  quranTranslation: string;
  quranAutoScrollEnabled: boolean;
  joinedAt: Date | null;
};

export type ReadingPreferences = {
  quranFontSize: number;
  quranReciter: string;
  quranTafsir: string;
  quranTranslation: string;
  quranAutoScrollEnabled: boolean;
};

export async function getProfile(userId: string): Promise<UserProfile> {
  let profile: any = null;
  try {
    profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        phone: true,
        city: true,
        country: true,
        points: true,
        level: true,
        timezone: true,
        latitude: true,
        longitude: true,
        prayerCalculationMethod: true,
        quranFontSize: true,
        quranReciter: true,
        quranTafsir: true,
        quranTranslation: true,
        quranAutoScrollEnabled: true,
        createdAt: true,
      },
    });
  } catch (err: any) {
    // Tolerate missing column for envs that haven't run the new migration yet
    if (err?.code === 'P2022') {
      profile = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          phone: true,
          city: true,
          country: true,
          points: true,
          level: true,
          timezone: true,
          latitude: true,
          longitude: true,
          prayerCalculationMethod: true,
          quranFontSize: true,
          quranReciter: true,
          quranTafsir: true,
          quranTranslation: true,
          createdAt: true,
        },
      });
    } else {
      throw err;
    }
  }

  if (!profile) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    phone: profile.phone,
    city: profile.city,
    country: profile.country,
    points: profile.points,
    level: profile.level,
    timezone: profile.timezone,
    latitude: profile.latitude,
    longitude: profile.longitude,
    prayerCalculationMethod: profile.prayerCalculationMethod,
    quranFontSize: profile.quranFontSize,
    quranReciter: profile.quranReciter,
    quranTafsir: profile.quranTafsir,
    quranTranslation: profile.quranTranslation,
    quranAutoScrollEnabled: Boolean(profile.quranAutoScrollEnabled ?? false),
    joinedAt: profile.createdAt,
  };
}

export async function getReadingPreferences(userId: string): Promise<ReadingPreferences> {
  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        quranFontSize: true,
        quranReciter: true,
        quranTafsir: true,
        quranTranslation: true,
        quranAutoScrollEnabled: true,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2022') {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          quranFontSize: true,
          quranReciter: true,
          quranTafsir: true,
          quranTranslation: true,
        },
      });
    } else {
      throw err;
    }
  }

  if (!user) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    quranFontSize: user.quranFontSize,
    quranReciter: user.quranReciter,
    quranTafsir: user.quranTafsir,
    quranTranslation: user.quranTranslation,
    quranAutoScrollEnabled: Boolean(user.quranAutoScrollEnabled ?? false),
  };
}

export async function updateReadingPreferences(
  userId: string,
  data: Partial<ReadingPreferences>,
): Promise<ReadingPreferences> {
  const updateData: any = {};
  if (data.quranFontSize !== undefined) {
    if (data.quranFontSize < 12 || data.quranFontSize > 60) {
      throw new AppError(
        'Font size must be between 12 and 60',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    updateData.quranFontSize = data.quranFontSize;
  }
  if (data.quranReciter !== undefined) updateData.quranReciter = data.quranReciter;
  if (data.quranTafsir !== undefined) updateData.quranTafsir = data.quranTafsir;
  if (data.quranTranslation !== undefined) updateData.quranTranslation = data.quranTranslation;
  if (data.quranAutoScrollEnabled !== undefined) {
    updateData.quranAutoScrollEnabled = data.quranAutoScrollEnabled;
  }

  let updated: any = null;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        quranFontSize: true,
        quranReciter: true,
        quranTafsir: true,
        quranTranslation: true,
        quranAutoScrollEnabled: true,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2022') {
      // Column may not exist on environments pending migration; ignore this field silently
      const { quranAutoScrollEnabled: _ignore, ...rest } = updateData;
      void _ignore;
      updated = await prisma.user.update({
        where: { id: userId },
        data: rest,
        select: {
          quranFontSize: true,
          quranReciter: true,
          quranTafsir: true,
          quranTranslation: true,
        },
      });
    } else {
      throw err;
    }
  }

  if (!updated) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    quranFontSize: updated.quranFontSize,
    quranReciter: updated.quranReciter,
    quranTafsir: updated.quranTafsir,
    quranTranslation: updated.quranTranslation,
    quranAutoScrollEnabled: Boolean(updated.quranAutoScrollEnabled ?? data.quranAutoScrollEnabled ?? false),
  };
}

export async function updateProfile(
  userId: string,
  data: {
    username?: string;
    fullName?: string | null;
    email?: string;
    timezone?: string;
    avatarUrl?: string | null;
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    prayerCalculationMethod?: string;
  },
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

  const updateData: any = {};
  if (data.username !== undefined) updateData.username = data.username.trim();
  if (data.fullName !== undefined) updateData.fullName = data.fullName ? data.fullName.trim() : null;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl ? data.avatarUrl.trim() : null;
  if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
  if (data.city !== undefined) updateData.city = data.city ? data.city.trim() : null;
  if (data.country !== undefined) updateData.country = data.country ? data.country.trim() : null;
  if (data.prayerCalculationMethod !== undefined) updateData.prayerCalculationMethod = data.prayerCalculationMethod.trim();

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      phone: true,
      city: true,
      country: true,
      points: true,
      level: true,
      timezone: true,
      latitude: true,
      longitude: true,
      prayerCalculationMethod: true,
      quranFontSize: true,
      quranReciter: true,
      quranTafsir: true,
      quranTranslation: true,
      quranAutoScrollEnabled: true,
      createdAt: true,
    },
  });

  if (!updated) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    id: updated.id,
    username: updated.username,
    fullName: updated.fullName,
    email: updated.email,
    avatarUrl: updated.avatarUrl,
    phone: updated.phone,
    city: updated.city,
    country: updated.country,
    points: updated.points,
    level: updated.level,
    timezone: updated.timezone,
    latitude: updated.latitude,
    longitude: updated.longitude,
    prayerCalculationMethod: updated.prayerCalculationMethod,
    quranFontSize: updated.quranFontSize,
    quranReciter: updated.quranReciter,
    quranTafsir: updated.quranTafsir,
    quranTranslation: updated.quranTranslation,
    quranAutoScrollEnabled: Boolean(updated.quranAutoScrollEnabled ?? false),
    joinedAt: updated.createdAt,
  };
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
  data: {
    latitude: number;
    longitude: number;
    timezone?: string;
    city?: string | null;
    country?: string | null;
  },
): Promise<UserProfile> {
  const updateData: any = {
    latitude: data.latitude,
    longitude: data.longitude,
  };

  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.city !== undefined) updateData.city = data.city ? data.city.trim() : null;
  if (data.country !== undefined) updateData.country = data.country ? data.country.trim() : null;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      avatarUrl: true,
      phone: true,
      city: true,
      country: true,
      points: true,
      level: true,
      timezone: true,
      latitude: true,
      longitude: true,
      prayerCalculationMethod: true,
      quranFontSize: true,
      quranReciter: true,
      quranTafsir: true,
      quranTranslation: true,
      quranAutoScrollEnabled: true,
      createdAt: true,
    },
  });

  if (!updated) {
    throw new AppError(
      'User profile not found',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NOT_FOUND,
    );
  }

  return {
    id: updated.id,
    username: updated.username,
    fullName: updated.fullName,
    email: updated.email,
    avatarUrl: updated.avatarUrl,
    phone: updated.phone,
    city: updated.city,
    country: updated.country,
    points: updated.points,
    level: updated.level,
    timezone: updated.timezone,
    latitude: updated.latitude,
    longitude: updated.longitude,
    prayerCalculationMethod: updated.prayerCalculationMethod,
    quranFontSize: updated.quranFontSize,
    quranReciter: updated.quranReciter,
    quranTafsir: updated.quranTafsir,
    quranTranslation: updated.quranTranslation,
    quranAutoScrollEnabled: Boolean(updated.quranAutoScrollEnabled ?? false),
    joinedAt: updated.createdAt,
  };
}
