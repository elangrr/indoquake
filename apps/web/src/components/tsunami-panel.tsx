"use client";

import type { EarthquakeEvent } from "@indoquake/shared";
import {
  BMKG_INATEST_URI,
  tsunamiStatusFromPotential,
} from "@indoquake/tsunami";
import { sentenceCase } from "@/lib/sentence-case";

interface TsunamiPanelProps {
  event: EarthquakeEvent | null;
  coastDistanceKm: number | null;
}

export function TsunamiPanel({ event, coastDistanceKm }: TsunamiPanelProps) {
  if (!event) return null;

  const info = tsunamiStatusFromPotential(event.tsunamiPotential);
  const isPotential = info.status === "potential";
  const isNoThreat = info.status === "no-threat";
  const nearCoast = coastDistanceKm !== null && coastDistanceKm <= 10;

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Status tsunami</h2>
        <span className="rounded-sm border border-ok px-1.5 text-xs font-medium text-ok">
          Sumber BMKG
        </span>
      </div>

      <div
        className={
          isPotential
            ? "mt-2 border-l-2 border-danger bg-danger-soft px-3 py-2"
            : isNoThreat
              ? "mt-2 border-l-2 border-ok bg-surface-2 px-3 py-2"
              : "mt-2 rounded-sm border border-border bg-surface-2 px-3 py-2"
        }
      >
        <p
          className={
            isPotential
              ? "text-xs font-semibold text-danger"
              : isNoThreat
                ? "text-xs font-semibold text-ok"
                : "text-xs font-semibold text-muted"
          }
        >
          {sentenceCase(info.label)}
        </p>
        {!isNoThreat && (
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
            {info.description}
          </p>
        )}
      </div>

      {isPotential && (
        <>
          {coastDistanceKm !== null && (
            <p className="mt-2 text-xs text-muted">
              Jarak lokasi Anda ke pantai ≈{" "}
              <span className="text-foreground">{coastDistanceKm} km</span>{" "}
              (estimasi)
            </p>
          )}
          {nearCoast && (
            <p className="mt-1 text-xs font-medium text-warn">
              Lokasi Anda dekat pantai (≤10 km). Ikuti arahan resmi BMKG/BPBD.
            </p>
          )}
        </>
      )}

      <a
        href={BMKG_INATEST_URI}
        target="_blank"
        rel="noreferrer"
        className={
          isPotential
            ? "mt-2 inline-flex min-h-11 items-center rounded-sm border border-danger px-4 text-sm text-danger transition-colors duration-150 hover:bg-danger-soft"
            : "inline-flex min-h-11 items-center text-xs text-foreground underline underline-offset-4"
        }
      >
        Informasi resmi InaTEWS BMKG
      </a>
    </div>
  );
}
