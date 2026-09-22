import type { VelocityModel } from "./velocity";

export interface TravelTimes {
  hypocentralKm: number;
  pTravelSeconds: number;
  sTravelSeconds: number;
}

export function computeTravelTimes(
  hypocentralKm: number,
  model: VelocityModel,
): TravelTimes {
  const distance = Math.max(0, hypocentralKm);
  return {
    hypocentralKm: distance,
    pTravelSeconds: distance / model.pVelocityKmS,
    sTravelSeconds: distance / model.sVelocityKmS,
  };
}
