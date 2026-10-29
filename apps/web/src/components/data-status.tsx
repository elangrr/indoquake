"use client";

import { deriveIndicator } from "@/lib/data-status";
import { formatZoned } from "@indoquake/regions/meta";
import { useLive } from "./live-provider";

const DOT: Record<string, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  down: "bg-danger",
  none: "bg-muted",
};

export function DataStatus() {
  const { freshness, connection } = useLive();
  const indicator = deriveIndicator(freshness?.state ?? null, connection);
  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <p
        role="status"
        aria-label={`Status data: ${indicator.label}`}
        data-state={freshness?.state ?? "none"}
        className="flex min-h-11 items-center gap-2"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[indicator.tone]}`} />
        <span className="font-medium text-foreground">{indicator.label}</span>
      </p>
      {freshness?.lastSuccessAt && (
        <p className="hidden md:block">
          Diperbarui <span className="num">{formatZoned(freshness.lastSuccessAt, "WIB", "clock")}</span>
        </p>
      )}
      {freshness?.latestEventAt && (
        <p className="hidden lg:block">
          Gempa terbaru <span className="num">{formatZoned(freshness.latestEventAt, "WIB", "clock")}</span>
        </p>
      )}
    </div>
  );
}
