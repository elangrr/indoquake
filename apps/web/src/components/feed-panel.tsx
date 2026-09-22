"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { EarthquakeEvent } from "@indoquake/shared";
import type { DistanceMap } from "@/lib/distances";
import { formatMagnitude, magnitudeColor } from "@/lib/magnitude";
import type { UserLocation } from "@/lib/use-geolocation";
import { SyncStatus } from "./sync-status";

export type FeedFilter = "all" | "m5" | "felt" | "tsunami" | "near";

export const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "m5", label: "M5+" },
  { id: "felt", label: "Dirasakan" },
  { id: "tsunami", label: "Potensi Tsunami" },
  { id: "near", label: "Di Sekitar Saya" },
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
}: FeedPanelProps) {
  const listRef = useRef<HTMLUListElement | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !selectedKey) return;
    const element = list.querySelector(
      `[data-event-key="${CSS.escape(selectedKey)}"]`,
    );
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedKey, events]);

  const summary =
    filter === "near" && location
      ? `${events.length} gempa dalam ${radiusKm} km`
      : `${events.length} dari ${totalCount} kejadian`;

  return (
    <aside className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-border bg-surface lg:h-full lg:w-[380px] lg:flex-none lg:border-t-0 lg:border-l">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted">
          Info &amp; estimasi
        </span>
        <button
          type="button"
          onClick={() => setInfoOpen((current) => !current)}
          className="text-[11px] text-accent hover:underline"
        >
          {infoOpen ? "Sembunyikan ▲" : "Tampilkan ▼"}
        </button>
      </div>

      {infoOpen && (
        <div className="max-h-[52%] shrink-0 overflow-y-auto border-b border-border">
          {locationPanel}
          {etaPanel}
          {tsunamiPanel}
        </div>
      )}

      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">
          GEMPA TERBARU
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          {summary} · urut waktu terbaru
        </p>
        <SyncStatus />
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border px-3 py-2">
        {FEED_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === "near" && !location) {
                onRequestLocation();
                return;
              }
              onFilterChange(item.id);
            }}
            className={
              item.id === filter
                ? "rounded-full border border-accent bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
                : "rounded-full border border-border px-2.5 py-1 text-[11px] text-muted hover:text-foreground"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted">
            {filter === "near" && location
              ? `Tidak ada gempa dalam radius ${radiusKm} km.`
              : "Tidak ada kejadian untuk filter ini."}
          </li>
        ) : (
          events.map((event) => {
            const distance = distances?.get(event.eventKey) ?? null;
            return (
              <li key={event.eventKey} data-event-key={event.eventKey}>
                <button
                  type="button"
                  onClick={() => onSelect(event.eventKey)}
                  className={
                    event.eventKey === selectedKey
                      ? "w-full border-b border-border bg-surface-2 px-4 py-3 text-left"
                      : "w-full border-b border-border px-4 py-3 text-left hover:bg-surface-2"
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#0b0f14]"
                      style={{ backgroundColor: magnitudeColor(event.magnitude) }}
                    >
                      M{formatMagnitude(event.magnitude)}
                    </span>
                    <span className="text-[11px] text-muted">
                      {event.eventTimeWib}
                    </span>
                    {event.tsunamiPotential === true && (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                        Potensi Tsunami
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs text-foreground">
                    {event.regionName}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Kedalaman {event.depthKm} km
                    {event.feltText ? " · Dirasakan" : ""}
                  </p>
                  {distance && (
                    <p className="mt-0.5 text-[11px] text-accent/80">
                      ≈ {Math.round(distance.epicentralKm)} km dari lokasi Anda
                      (estimasi)
                    </p>
                  )}
                  <Link
                    href={`/gempa/${event.eventKey}`}
                    className="mt-1 inline-block text-[11px] text-accent hover:underline"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                  >
                    Lihat detail →
                  </Link>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
