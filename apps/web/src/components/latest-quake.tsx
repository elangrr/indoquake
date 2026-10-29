import Link from "next/link";
import type { EarthquakeEvent } from "@indoquake/shared";
import { eventAreaLabel, formatEventTime } from "@/lib/event-time";
import { MagBadge } from "./mag-badge";
import { Seismogram } from "./seismogram";

/**
 * The newest quake as plain text: it is the first thing read and the LCP element, never the map.
 * `loading` (the list still comes from the API) holds the filled height, so the map below does not move.
 */
export function LatestQuake({
  event,
  events,
  loading = false,
}: {
  event: EarthquakeEvent | null;
  events: EarthquakeEvent[];
  loading?: boolean;
}) {
  return (
    <section aria-labelledby="gempa-terkini" className="px-4 pt-6 pb-4">
      <h1 id="gempa-terkini" className="text-sm font-medium text-muted">
        Gempa terkini di Indonesia
      </h1>
      {event ? (
        <div className="mt-2">
          <MagBadge magnitude={event.magnitude} size="lg" />
          <p className="mt-2 text-xl leading-snug font-semibold text-foreground">{event.regionName}</p>
          <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Waktu</dt>
            <dd>{formatEventTime(event, "dateTime")}</dd>
            {eventAreaLabel(event) && (
              <>
                <dt className="text-muted">Wilayah</dt>
                <dd>{eventAreaLabel(event)}</dd>
              </>
            )}
            <dt className="text-muted">Kedalaman</dt>
            <dd>{event.depthKm} km</dd>
            <dt className="text-muted">Tsunami</dt>
            <dd className={event.tsunamiPotential ? "font-semibold text-danger" : ""}>
              {event.potentialText ?? "Belum ada informasi BMKG"}
            </dd>
          </dl>
          <Link
            href={`/gempa/${event.eventKey}`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-4 hover:text-signal"
          >
            Detail gempa
          </Link>
          <Seismogram events={events} />
        </div>
      ) : loading ? (
        <LatestQuakeSkeleton />
      ) : (
        <p className="mt-2 min-h-40 text-xl text-muted">Belum ada gempa tercatat.</p>
      )}
    </section>
  );
}

/** One bar per line of the filled state, each on the same line height, so the swap does not shift. */
function Bar({ className = "", width }: { className?: string; width: string }) {
  return (
    <span className={`block ${className}`}>
      <span className={`inline-block rounded-sm bg-surface-2 ${width}`}>&nbsp;</span>
    </span>
  );
}

function LatestQuakeSkeleton() {
  return (
    <div className="mt-2" aria-hidden="true" data-testid="latest-quake-loading">
      <Bar className="text-4xl" width="w-24" />
      <span className="mt-2 block text-xl leading-snug">
        <Bar width="w-full" />
        <Bar width="w-1/2" />
      </span>
      <span className="mt-3 grid gap-y-1 text-sm">
        <Bar width="w-1/2" />
        <Bar width="w-1/3" />
        <Bar width="w-2/3" />
      </span>
      <span className="mt-3 block min-h-11" />
      <span className="mt-6 block h-14 rounded-sm bg-surface-2" />
      <span className="mt-1 grid gap-y-1 text-xs">
        <Bar width="w-full" />
        <Bar width="w-1/2" />
      </span>
    </div>
  );
}
