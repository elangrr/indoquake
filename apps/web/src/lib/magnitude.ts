export interface MagnitudeBucket {
  min: number;
  color: string;
  label: string;
}

/**
 * Sequential ramp from field grey to deep vermilion. Mid tones so markers read on the
 * paper and the graphite map; the number is always shown next to the colour.
 */
export const MAGNITUDE_BUCKETS: readonly MagnitudeBucket[] = [
  { min: 0, color: "#7f8e8a", label: "M < 3" },
  { min: 3, color: "#c9a227", label: "M 3+" },
  { min: 4, color: "#e07b26", label: "M 4+" },
  { min: 5, color: "#d9481c", label: "M 5+" },
  { min: 6, color: "#a31616", label: "M 6+" },
];

export function magnitudeColor(magnitude: number): string {
  let color = MAGNITUDE_BUCKETS[0].color;
  for (const bucket of MAGNITUDE_BUCKETS) {
    if (magnitude >= bucket.min) color = bucket.color;
  }
  return color;
}

/** "5.1": magnitude keeps the decimal point, as BMKG writes it. */
export function formatMagnitude(magnitude: number): string {
  return magnitude.toFixed(1);
}

/** Intensity rings drawn around the selected epicentre: below 4 one ring, 4 to 5 two, 5 to 6 three, 6 and up four. */
export function ringCount(magnitude: number): 1 | 2 | 3 | 4 {
  if (magnitude >= 6) return 4;
  if (magnitude >= 5) return 3;
  if (magnitude >= 4) return 2;
  return 1;
}
