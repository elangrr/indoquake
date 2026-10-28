import Link from "next/link";
import type { EarthquakeEvent } from "@indoquake/shared";
import { formatWibDateTime } from "@/lib/wib";
import { MagBadge } from "./mag-badge";
import { Seismogram } from "./seismogram";

/** The newest quake as plain text: it is the first thing read and the LCP element, never the map. */
export function LatestQuake({ event, events }: { event: EarthquakeEvent | null; events: EarthquakeEvent[] }) {
  return (
    <section aria-labelledby="gempa-terkini" className="px-4 pt-6 pb-4">
      <h1 id="gempa-terkini" className="text-sm font-medium text-muted">
        Gempa terkini di Pulau Jawa
      </h1>
      {event ? (
        <div className="mt-2">
          <MagBadge magnitude={event.magnitude} size="lg" />
          <p className="mt-2 text-xl leading-snug font-semibold text-foreground">{event.regionName}</p>
          <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Waktu</dt>
            <dd>{formatWibDateTime(event.eventTimeUtc)}</dd>
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
      ) : (
        <p className="mt-2 min-h-40 text-xl text-muted">Belum ada gempa tercatat.</p>
      )}
    </section>
  );
}
