import type { EarthquakeEvent } from "@indoquake/shared";

function isNewerOrSame(incoming: EarthquakeEvent, stored: EarthquakeEvent): boolean {
  return (incoming.lastUpdatedAt ?? "") >= (stored.lastUpdatedAt ?? "");
}

/** Fields of `over` that are not null/undefined replace those of `base`. */
function overlay(base: EarthquakeEvent, over: EarthquakeEvent): EarthquakeEvent {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value !== null && value !== undefined) result[key] = value;
  }
  return result as unknown as EarthquakeEvent;
}

function byNewest(a: EarthquakeEvent, b: EarthquakeEvent): number {
  if (a.eventTimeUtc !== b.eventTimeUtc) return a.eventTimeUtc < b.eventTimeUtc ? 1 : -1;
  return a.eventKey < b.eventKey ? -1 : a.eventKey > b.eventKey ? 1 : 0;
}

/**
 * Merges one stream or list event into the list, field by field.
 * A null field never replaces a stored value; when both carry a value the newer
 * lastUpdatedAt wins. The list stays sorted newest first.
 */
export function mergeEvent(events: EarthquakeEvent[], incoming: EarthquakeEvent): EarthquakeEvent[] {
  const index = events.findIndex((event) => event.eventKey === incoming.eventKey);
  if (index === -1) return [...events, incoming].sort(byNewest);
  const stored = events[index];
  const merged = isNewerOrSame(incoming, stored)
    ? overlay(stored, incoming)
    : overlay(incoming, stored);
  const next = events.slice();
  next[index] = merged;
  return next.sort(byNewest);
}

/** Merges a whole fetched list (resync or SSR fallback) into the current one. */
export function mergeEvents(events: EarthquakeEvent[], incoming: EarthquakeEvent[]): EarthquakeEvent[] {
  return incoming.reduce(mergeEvent, events);
}
