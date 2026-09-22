import { createHash } from "node:crypto";

export function eventKeyFor(input: {
  eventTimeUtc: string;
  latitude: number;
  longitude: number;
}): string {
  const time = new Date(input.eventTimeUtc).toISOString();
  const fingerprint = `${time}|${input.latitude.toFixed(2)}|${input.longitude.toFixed(2)}`;
  return createHash("sha1").update(fingerprint).digest("hex").slice(0, 16);
}
