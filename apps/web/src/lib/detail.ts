import { cache } from "react";
import { getEarthquakeDetail } from "./queries";

const EVENT_KEY = /^[0-9a-f]{16}$/;

/**
 * One database read per request: generateMetadata and the page share this cached call.
 * Keys that cannot exist are rejected before the database.
 */
export const loadEarthquakeDetail = cache(async (eventKey: string) => {
  if (!EVENT_KEY.test(eventKey)) return null;
  return getEarthquakeDetail(eventKey);
});
