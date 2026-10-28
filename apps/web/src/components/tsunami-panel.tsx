"use client";

import type { EarthquakeEvent } from "@indoquake/shared";
import {
  BMKG_INATEST_URI,
  tsunamiStatusFromPotential,
} from "@indoquake/tsunami";

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
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          🌊 STATUS TSUNAMI
        </h2>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
          SUMBER: BMKG
        </span>
      </div>

      <div
        className={
          isPotential
            ? "mt-2 rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2"
            : isNoThreat
              ? "mt-2 rounded-md border border-emerald-500/40 bg-emerald-950/30 px-3 py-2"
              : "mt-2 rounded-md border border-border bg-background px-3 py-2"
        }
      >
        <p
          className={
            isPotential
              ? "text-xs font-semibold text-red-300"
              : isNoThreat
                ? "text-xs font-semibold text-emerald-300"
                : "text-xs font-semibold text-muted"
          }
        >
          {info.label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">
          {info.description}
        </p>
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
            <p className="mt-1 text-xs font-medium text-amber-300">
              ⚠️ Lokasi Anda dekat pantai (≤10 km). Ikuti arahan resmi BMKG/BPBD.
            </p>
          )}
          <a
            href={BMKG_INATEST_URI}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block rounded-md border border-red-400/60 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            Informasi resmi InaTEWS BMKG →
          </a>
        </>
      )}

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Aplikasi tidak pernah mendeklarasikan tsunami sendiri — status di atas
        berasal dari data resmi BMKG.{" "}
        <a
          href={BMKG_INATEST_URI}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          InaTEWS
        </a>
      </p>
    </div>
  );
}
