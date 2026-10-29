import type { EarthquakeEvent } from "@indoquake/shared";
import {
  areaLabel,
  formatZoned,
  UNKNOWN_AREA_LABEL,
  zoneOfEvent,
  type ZonedStyle,
} from "@indoquake/regions/meta";

type ZonedEvent = Pick<EarthquakeEvent, "eventTimeUtc" | "zone" | "provinceSlug" | "nearestProvinceSlug">;

/**
 * A time of this event in the event's own zone with its label (D6): the event time by default,
 * or another instant of the same event (revision, last update). Stream payloads from before R137
 * have no zone field and fall back to the province, the nearest province, then WIB.
 */
export function formatEventTime(event: ZonedEvent, style: ZonedStyle, iso: string = event.eventTimeUtc): string {
  return formatZoned(iso, zoneOfEvent(event), style);
}

/** The area label the server assigned (never computed here, D29), or null when it is not known yet. */
export function eventAreaLabel(
  event: Pick<EarthquakeEvent, "areaKind" | "provinceName" | "nearestProvinceName" | "nearestProvinceKm">,
): string | null {
  const label = areaLabel(event);
  return label === UNKNOWN_AREA_LABEL ? null : label;
}
