import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';

const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

const DIRECTIONS = [
  { min: 337.5, max: 360, ar: 'الشمال', en: 'North' },
  { min: 0, max: 22.5, ar: 'الشمال', en: 'North' },
  { min: 22.5, max: 67.5, ar: 'الشمال الشرقي', en: 'Northeast' },
  { min: 67.5, max: 112.5, ar: 'الشرق', en: 'East' },
  { min: 112.5, max: 157.5, ar: 'الجنوب الشرقي', en: 'Southeast' },
  { min: 157.5, max: 202.5, ar: 'الجنوب', en: 'South' },
  { min: 202.5, max: 247.5, ar: 'الجنوب الغربي', en: 'Southwest' },
  { min: 247.5, max: 292.5, ar: 'الغرب', en: 'West' },
  { min: 292.5, max: 337.5, ar: 'الشمال الغربي', en: 'Northwest' },
];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function getDirectionNames(angle: number): { directionAr: string; directionEn: string } {
  const direction = DIRECTIONS.find(
    (d) => angle >= d.min && angle < d.max,
  );
  return {
    directionAr: direction?.ar ?? 'الشمال',
    directionEn: direction?.en ?? 'North',
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toContractQibla(latitude: number, longitude: number) {
  const result = calculateQiblaDirection(latitude, longitude);
  const distanceKm =
    Math.round(haversineKm(latitude, longitude, KAABA_LATITUDE, KAABA_LONGITUDE) * 10) / 10;
  return {
    bearingDegrees: Math.round(result.angleDegrees * 10) / 10,
    bearingRadians: Math.round(result.bearingRadians * 100) / 100,
    directionAr: result.directionAr,
    directionEn: result.directionEn,
    distanceKm,
    userLocation: { latitude, longitude },
    userLatitude: latitude,
    userLongitude: longitude,
    kaabaLatitude: KAABA_LATITUDE,
    kaabaLongitude: KAABA_LONGITUDE,
    kaaba: { latitude: KAABA_LATITUDE, longitude: KAABA_LONGITUDE },
  };
}

function calculateQiblaDirection(
  latitude: number,
  longitude: number,
): { angleDegrees: number; directionAr: string; directionEn: string; bearingRadians: number } {
  const phiK = toRadians(KAABA_LATITUDE);
  const lambdaK = toRadians(KAABA_LONGITUDE);
  const phi = toRadians(latitude);
  const lambda = toRadians(longitude);

  const deltaLambda = lambdaK - lambda;

  const y = Math.sin(deltaLambda);
  const x =
    Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(deltaLambda);

  const bearingRadians = Math.atan2(y, x);
  const angleDegrees = normalizeAngle(toDegrees(bearingRadians));

  const { directionAr, directionEn } = getDirectionNames(angleDegrees);

  return { angleDegrees, bearingRadians, directionAr, directionEn };
}

export function calculateQibla(latitude: number, longitude: number) {
  if (latitude < -90 || latitude > 90) {
    throw new AppError(
      'Latitude must be between -90 and 90',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }
  if (longitude < -180 || longitude > 180) {
    throw new AppError(
      'Longitude must be between -180 and 180',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return toContractQibla(latitude, longitude);
}

export async function getMyQibla(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  if (user.latitude === null || user.longitude === null) {
    throw new AppError(
      'User location not set. Please set your location first.',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  return toContractQibla(user.latitude, user.longitude);
}
