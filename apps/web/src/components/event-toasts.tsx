"use client";

import type { EarthquakeEvent } from "@indoquake/shared";
import { formatMagnitude, magnitudeColor } from "@/lib/magnitude";

export interface ToastItem {
  id: string;
  event: EarthquakeEvent;
}

interface EventToastsProps {
  items: ToastItem[];
  onSelect: (eventKey: string) => void;
}

export function EventToasts({ items, onSelect }: EventToastsProps) {
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 flex w-[280px] flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.event.eventKey)}
          className="pointer-events-auto rounded-lg border border-accent/60 bg-surface/95 p-3 text-left shadow-lg backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#0b0f14]"
              style={{ backgroundColor: magnitudeColor(item.event.magnitude) }}
            >
              M{formatMagnitude(item.event.magnitude)}
            </span>
            <span className="text-[11px] font-medium text-accent">
              GEMPA BARU
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs text-foreground">
            {item.event.regionName}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {item.event.eventTimeWib} · kedalaman {item.event.depthKm} km
          </p>
        </button>
      ))}
    </div>
  );
}
