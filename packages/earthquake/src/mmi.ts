export interface AttenuationModel {
  id: string;
  name: string;
  intercept: number;
  magnitudeCoeff: number;
  logDistanceCoeff: number;
  linearDistanceCoeff: number;
}

export const DEFAULT_ATTENUATION_MODEL: AttenuationModel = {
  id: "simple-magnitude-distance",
  name: "Model atenuasi sederhana magnitudo–jarak (dapat dikonfigurasi)",
  intercept: 1.0,
  magnitudeCoeff: 1.0,
  logDistanceCoeff: 1.6,
  linearDistanceCoeff: 0.004,
};

export function estimateMmi(
  magnitude: number,
  hypocentralKm: number,
  model: AttenuationModel = DEFAULT_ATTENUATION_MODEL,
): number {
  const distance = Math.max(1, hypocentralKm);
  const value =
    model.intercept +
    model.magnitudeCoeff * magnitude -
    model.logDistanceCoeff * Math.log10(distance) -
    model.linearDistanceCoeff * distance;
  return Math.min(10, Math.max(1, value));
}

export function estimateFeltRadiusKm(
  magnitude: number,
  depthKm = 0,
  thresholdMmi = 2,
  model: AttenuationModel = DEFAULT_ATTENUATION_MODEL,
): number {
  const depth = Math.max(0, depthKm);
  const mmiAtSurfaceRadius = (surfaceKm: number): number =>
    estimateMmi(magnitude, Math.hypot(surfaceKm, depth), model);

  if (mmiAtSurfaceRadius(0) <= thresholdMmi) return 0;

  const maxRadiusKm = 800;
  if (mmiAtSurfaceRadius(maxRadiusKm) > thresholdMmi) return maxRadiusKm;

  let low = 0;
  let high = maxRadiusKm;
  for (let step = 0; step < 40; step += 1) {
    const mid = (low + high) / 2;
    if (mmiAtSurfaceRadius(mid) > thresholdMmi) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.round(((low + high) / 2) * 10) / 10;
}

export interface MmiLevel {
  value: number;
  roman: string;
  label: string;
  description: string;
}

export const MMI_SCALE: readonly MmiLevel[] = [
  {
    value: 1,
    roman: "I",
    label: "Tidak terasa",
    description: "Tidak dirasakan, hanya tercatat oleh alat.",
  },
  {
    value: 2,
    roman: "II",
    label: "Sangat lemah",
    description: "Dirasakan sebagian kecil orang dalam keadaan diam.",
  },
  {
    value: 3,
    roman: "III",
    label: "Lemah",
    description: "Dirasakan di dalam ruangan, seperti getaran truk ringan.",
  },
  {
    value: 4,
    roman: "IV",
    label: "Ringan",
    description: "Barang ringan bergoyang, jendela dan pintu bergetar.",
  },
  {
    value: 5,
    roman: "V",
    label: "Sedang",
    description: "Dirasakan hampir semua orang, bangunan lemah retak ringan.",
  },
  {
    value: 6,
    roman: "VI",
    label: "Kuat",
    description: "Kerusakan ringan pada bangunan, perabot bergeser.",
  },
  {
    value: 7,
    roman: "VII",
    label: "Sangat kuat",
    description: "Kerusakan sedang, sulit berdiri.",
  },
  {
    value: 8,
    roman: "VIII",
    label: "Merusak",
    description: "Kerusakan berat pada bangunan lemah.",
  },
  {
    value: 9,
    roman: "IX",
    label: "Sangat merusak",
    description: "Kerusakan luas, potensi likuifaksi.",
  },
  {
    value: 10,
    roman: "X",
    label: "Ekstrem",
    description: "Kerusakan sangat luas.",
  },
];

export function describeMmi(value: number): MmiLevel {
  const clamped = Math.min(10, Math.max(1, Math.round(value)));
  return MMI_SCALE[clamped - 1] ?? MMI_SCALE[0];
}

const ROMAN_TO_NUMBER: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

export function parseMmiString(
  value: string,
): { min: number; max: number } | null {
  const numbers = value
    .split("-")
    .map((part) => ROMAN_TO_NUMBER[part.trim().toUpperCase()])
    .filter((number): number is number => typeof number === "number");
  if (numbers.length === 0) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}
