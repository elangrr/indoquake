export type TsunamiStatus = "no-threat" | "potential" | "unknown";

export interface TsunamiStatusInfo {
  status: TsunamiStatus;
  label: string;
  description: string;
  source: "BMKG";
}

export const BMKG_INATEST_URI = "https://inatews.bmkg.go.id/";

export function tsunamiStatusFromPotential(
  tsunamiPotential: boolean | null,
): TsunamiStatusInfo {
  if (tsunamiPotential === true) {
    return {
      status: "potential",
      label: "BERPOTENSI TSUNAMI",
      description:
        "BMKG menyatakan gempa ini berpotensi tsunami. Ikuti arahan resmi BMKG/BPBD.",
      source: "BMKG",
    };
  }
  if (tsunamiPotential === false) {
    return {
      status: "no-threat",
      label: "TIDAK BERPOTENSI TSUNAMI",
      description: "BMKG menyatakan gempa ini tidak berpotensi tsunami.",
      source: "BMKG",
    };
  }
  return {
    status: "unknown",
    label: "TIDAK ADA INFORMASI",
    description:
      "Feed BMKG tidak memuat informasi potensi tsunami untuk kejadian ini.",
    source: "BMKG",
  };
}
