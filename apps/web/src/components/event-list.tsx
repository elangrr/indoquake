import Link from "next/link";
import type { EarthquakeEvent } from "@indoquake/shared";
import { eventAreaLabel, formatEventTime } from "@/lib/event-time";
import { MagBadge } from "./mag-badge";

/** Read-only list of quakes; each row links to the detail page. */
export function EventList({ events }: { events: EarthquakeEvent[] }) {
  return (
    <ul className="border-t border-border">
      {events.map((event) => (
        <li key={event.eventKey} data-event-key={event.eventKey} className="border-b border-border">
          <Link
            href={`/gempa/${event.eventKey}`}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]"
          >
            <MagBadge magnitude={event.magnitude} size="md" />
            <span className="text-sm text-foreground">{event.regionName}</span>
            <span className="num col-start-2 text-xs text-muted sm:col-start-auto sm:text-right">
              {formatEventTime(event, "dateTime")} · {event.depthKm} km
              {eventAreaLabel(event) ? ` · ${eventAreaLabel(event)}` : ""}
              {event.tsunamiPotential === true ? " · Berpotensi tsunami" : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EventListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="border-t border-border">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex h-16 items-center gap-4 border-b border-border px-4">
          <span className="h-4 w-16 rounded-sm bg-surface-2" />
          <span className="h-4 flex-1 rounded-sm bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
