import { computeTravelTimes } from "./travel-time";
import type { VelocityModel } from "./velocity";

export const BLIND_ZONE_THRESHOLD_SECONDS = 5;
export const BLIND_ZONE_DISTANCE_KM = 25;

export interface ArrivalEstimate {
  hypocentralKm: number;
  pTravelSeconds: number;
  sTravelSeconds: number;
  pArrivalUtc: string;
  sArrivalUtc: string;
  uncertaintySeconds: number;
  sArrivalEarliestUtc: string;
  sArrivalLatestUtc: string;
  secondsUntilS: number;
  warningSecondsRemaining: number;
  blindZone: boolean;
}

export function estimateArrival(params: {
  originTimeUtc: string;
  hypocentralKm: number;
  model: VelocityModel;
  nowUtc: string;
}): ArrivalEstimate {
  const originMs = new Date(params.originTimeUtc).getTime();
  const nowMs = new Date(params.nowUtc).getTime();
  const { pTravelSeconds, sTravelSeconds } = computeTravelTimes(
    params.hypocentralKm,
    params.model,
  );
  const uncertaintySeconds = sTravelSeconds * params.model.uncertaintyRatio;
  const sArrivalMs = originMs + sTravelSeconds * 1000;
  const secondsUntilS = (sArrivalMs - nowMs) / 1000;
  const blindZone =
    secondsUntilS <= BLIND_ZONE_THRESHOLD_SECONDS ||
    params.hypocentralKm <= BLIND_ZONE_DISTANCE_KM;

  return {
    hypocentralKm: params.hypocentralKm,
    pTravelSeconds,
    sTravelSeconds,
    pArrivalUtc: new Date(originMs + pTravelSeconds * 1000).toISOString(),
    sArrivalUtc: new Date(sArrivalMs).toISOString(),
    uncertaintySeconds,
    sArrivalEarliestUtc: new Date(
      sArrivalMs - uncertaintySeconds * 1000,
    ).toISOString(),
    sArrivalLatestUtc: new Date(
      sArrivalMs + uncertaintySeconds * 1000,
    ).toISOString(),
    secondsUntilS,
    warningSecondsRemaining: Math.max(0, secondsUntilS),
    blindZone,
  };
}
