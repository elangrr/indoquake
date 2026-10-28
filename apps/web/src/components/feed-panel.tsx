"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { EarthquakeEvent } from "@indoquake/shared";
import type { DistanceMap } from "@/lib/distances";
import type { UserLocation } from "@/lib/use-geolocation";
import { formatWibDateTime } from "@/lib/wib";
import { MagBadge } from "./mag-badge";

export type FeedFilter = "all" | "m5" | "felt" | "tsunami" | "near";

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "m5", label: "M5+" },
  { id: "felt", label: "Dirasakan" },
  { id: "tsunami", label: "Potensi tsunami" },
  { id: "near", label: "Di sekitar saya" },
];

export function applyFeedFilter(
  events: EarthquakeEvent[],
  filter: FeedFilter,
): EarthquakeEvent[] {
  switch (filter) {
    case "m5":
      return events.filter((event) => event.magnitude >= 5);
    case "felt":
      return events.filter((event) => event.feltText !== null);
    case "tsunami":
      return events.filter((event) => event.tsunamiPotential === true);
    default:
      return events;
  }
}

interface FeedPanelProps {
  events: EarthquakeEvent[];
  totalCount: number;
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  selectedKey: string | null;
  onSelect: (eventKey: string) => void;
  distances: DistanceMap | null;
  location: UserLocation | null;
  radiusKm: number;
  onRequestLocation: () => void;
  locationPanel: ReactNode;
  etaPanel: ReactNode;
  tsunamiPanel: ReactNode;
  pulseKey?: string | null;
}

export function FeedPanel({
  events,
  totalCount,
  filter,
  onFilterChange,
  selectedKey,
  onSelect,
  distances,
  location,
  radiusKm,
  onRequestLocation,
  locationPanel,
  etaPanel,
  tsunamiPanel,
  pulseKey = null,
}: FeedPanelProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const shownKey = useRef(selectedKey);

  // Bring a row into view only when the selection changes (e.g. a map click), never on
  // first render or when live events arrive, so the page does not jump.
  useEffect(() => {
    if (selectedKey === shownKey.current) return;
    shownKey.current = selectedKey;
    const list = listRef.current;
    if (!list || !selectedKey) return;
    const element = list.querySelector(`[data-event-key="${CSS.escape(selectedKey)}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);

  const summary =
    filter === "near" && location
      ? `${events.length} gempa dalam ${radiusKm} km`
      : `${events.length} dari ${totalCount} kejadian`;

  return (
    <section aria-labelledby="daftar-gempa" className="bg-surface">
      <div className="border-y border-border">
        <button
          type="button"
          aria-expanded={infoOpen}
          aria-controls="info-estimasi"
          onClick={() => setInfoOpen((current) => !current)}
          className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-medium text-foreground transition-colors duration-150 hover:bg-surface-2"
        >
          Info dan estimasi
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className={infoOpen ? "rotate-180" : ""}>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        {infoOpen && (
          <div id="info-estimasi" className="border-t border-border">
            {locationPanel}
            {etaPanel}
            {tsunamiPanel}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-4 px-4 pt-6 pb-2">
        <h2 id="daftar-gempa" className="text-xl font-semibold text-foreground">
          Gempa terbaru
        </h2>
        <p className="num text-xs text-muted">{summary}</p>
      </div>

      <div role="group" aria-label="Saring daftar" className="flex flex-wrap gap-2 px-4 pb-4">
        {FEED_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === filter}
            onClick={() => {
              if (item.id === "near" && !location) {
                onRequestLocation();
                return;
              }
              onFilterChange(item.id);
            }}
            className={`min-h-11 rounded-sm border px-3 text-sm transition-colors duration-150 ${
              item.id === filter
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul ref={listRef} className="border-t border-border">
        {events.length === 0 ? (
          <li className="px-4 py-8 text-sm text-muted">
            {filter === "near" && location
              ? `Tidak ada gempa dalam radius ${radiusKm} km.`
              : totalCount === 0
                ? "Belum ada gempa tercatat."
                : "Tidak ada kejadian untuk filter ini."}
          </li>
        ) : (
          events.map((event) => {
            const distance = distances?.get(event.eventKey) ?? null;
            const selected = event.eventKey === selectedKey;
            return (
              <li
                key={event.eventKey}
                data-event-key={event.eventKey}
                data-pulse={event.eventKey === pulseKey ? "true" : undefined}
                className={`relative flex border-b border-border ${selected ? "bg-surface-2" : ""} ${
                  event.eventKey === pulseKey ? "iq-pulse" : ""
                }`}
              >
                {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-signal" />}
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(event.eventKey)}
                  className="min-w-0 flex-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <MagBadge magnitude={event.magnitude} size="md" />
                    <span className="num text-xs text-muted">{formatWibDateTime(event.eventTimeUtc)}</span>
                    {event.tsunamiPotential === true && (
                      <span className="rounded-sm bg-danger-soft px-1.5 text-xs font-semibold text-danger">
                        Berpotensi tsunami
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-foreground">{event.regionName}</span>
                  <span className="num mt-1 block text-xs text-muted">
                    {event.depthKm} km
                    {event.feltText ? " · Dirasakan" : ""}
                    {distance ? ` · ${Math.round(distance.epicentralKm).toLocaleString("id-ID")} km dari Anda (estimasi)` : ""}
                  </span>
                </button>
                <Link
                  href={`/gempa/${event.eventKey}`}
                  aria-label={`Detail gempa M${event.magnitude.toFixed(1)} ${event.regionName}`}
                  className="flex w-14 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-foreground"
                >
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
                    <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
