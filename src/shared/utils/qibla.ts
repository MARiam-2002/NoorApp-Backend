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

export function calculateQiblaDirection(
  latitude: number,
  longitude: number,
): { angleDegrees: number; directionAr: string; directionEn: string } {
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

  return { angleDegrees, directionAr, directionEn };
}
