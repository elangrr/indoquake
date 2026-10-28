"use client";

import { useMinuteClock } from "@/lib/use-minute-clock";
import type { EarthquakeEvent } from "@indoquake/shared";

const WINDOW_MS = 24 * 3_600_000;
const WIDTH = 400;
const HEIGHT = 56;
const MID = HEIGHT / 2;

/** Drum-recorder strip of the last 24 hours: one spike per quake, height by magnitude. */
export function Seismogram({ events }: { events: EarthquakeEvent[] }) {
  const now = useMinuteClock();

  const recent = now === null ? [] : events.filter((event) => now - Date.parse(event.eventTimeUtc) <= WINDOW_MS);
  const strongest = recent.reduce<EarthquakeEvent | null>(
    (best, event) => (!best || event.magnitude > best.magnitude ? event : best),
    null,
  );
  const label =
    recent.length === 0
      ? "Tidak ada gempa dalam 24 jam terakhir"
      : `${recent.length} gempa dalam 24 jam terakhir, terbesar M${strongest!.magnitude.toFixed(1)}`;

  return (
    <figure className="mt-6">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-14 w-full text-foreground"
        preserveAspectRatio="none"
      >
        <line x1="0" y1={MID} x2={WIDTH} y2={MID} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
        {now !== null &&
          recent.map((event, index) => {
            const x = WIDTH - ((now - Date.parse(event.eventTimeUtc)) / WINDOW_MS) * WIDTH;
            const amplitude = Math.min(MID - 2, Math.max(3, (event.magnitude - 1.5) * 5));
            const latest = index === 0;
            return (
              <polyline
                key={event.eventKey}
                points={`${x - 3},${MID} ${x - 1.5},${MID - amplitude} ${x},${MID + amplitude} ${x + 1.5},${MID - amplitude / 2} ${x + 3},${MID}`}
                fill="none"
                stroke={latest ? "var(--signal)" : "currentColor"}
                strokeWidth={latest ? 1.8 : 1.2}
                strokeLinejoin="round"
              />
            );
          })}
      </svg>
      <figcaption className="num mt-1 text-xs text-muted">
        <span className="flex justify-between gap-4 whitespace-nowrap">
          <span>24 jam lalu</span>
          <span>Sekarang</span>
        </span>
        <span className="mt-1 block">{label}</span>
      </figcaption>
    </figure>
  );
}
