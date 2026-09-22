export interface MagnitudeBucket {
  min: number;
  color: string;
  label: string;
}

export const MAGNITUDE_BUCKETS: readonly MagnitudeBucket[] = [
  { min: 0, color: "#38bdf8", label: "< 3" },
  { min: 3, color: "#a3e635", label: "3 – 4" },
  { min: 4, color: "#fbbf24", label: "4 – 5" },
  { min: 5, color: "#f97316", label: "5 – 6" },
  { min: 6, color: "#ef4444", label: "≥ 6" },
];

export function magnitudeColor(magnitude: number): string {
  let color = MAGNITUDE_BUCKETS[0].color;
  for (const bucket of MAGNITUDE_BUCKETS) {
    if (magnitude >= bucket.min) color = bucket.color;
  }
  return color;
}

export function formatMagnitude(magnitude: number): string {
  return magnitude.toFixed(1);
}
