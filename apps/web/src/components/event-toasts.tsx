"use client";

import type { EarthquakeEvent } from "@indoquake/shared";
import { formatEventTime } from "@/lib/event-time";
import { MagBadge } from "./mag-badge";

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
    <div className="fixed right-4 bottom-20 left-4 z-[950] flex flex-col gap-2 sm:top-20 sm:bottom-auto sm:left-auto sm:w-80">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-testid="toast"
          onClick={() => onSelect(item.event.eventKey)}
          className="border-l-2 border-signal bg-surface p-3 text-left shadow-[var(--shadow-float)] transition-colors duration-150 hover:bg-surface-2"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-signal">Gempa baru</span>
            <span className="num text-xs text-muted">{formatEventTime(item.event, "clock")}</span>
          </span>
          <span className="mt-1 flex items-center gap-2">
            <MagBadge magnitude={item.event.magnitude} />
            <span className="num text-xs text-muted">{item.event.depthKm} km</span>
          </span>
          <span className="mt-1 line-clamp-2 block text-sm text-foreground">{item.event.regionName}</span>
        </button>
      ))}
    </div>
  );
}
