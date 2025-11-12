export const metersToMiles = (m: number): number => m / 1609.344;

export const normalizeRadiusMiles = (radiusMeters?: number, defaultMiles: number = 25): number => {
  if (radiusMeters == null) return defaultMiles;
  const miles = metersToMiles(radiusMeters);
  const rounded = Math.round(miles);
  return Math.max(1, rounded);
};
