"use client";

import { useEffect, useState } from "react";
import type { EarthquakeEvent } from "@indoquake/shared";
import {
  DEFAULT_VELOCITY_MODEL,
  describeMmi,
  estimateArrival,
  estimateMmi,
  parseMmiString,
} from "@indoquake/earthquake";
import { formatDurationId } from "@indoquake/geo";
import type { DistanceInfo } from "@/lib/distances";
import { formatZoned, type ZoneId } from "@indoquake/regions/meta";
import { formatCountdown } from "@/lib/format-time";
import { MagBadge } from "./mag-badge";
import type { ReplayState } from "@/lib/replay";

interface EtaPanelProps {
  event: EarthquakeEvent | null;
  distance: DistanceInfo | null;
  serverNow: () => number;
  replay: ReplayState | null;
  onToggleReplay: () => void;
  showFelt: boolean;
  onToggleFelt: () => void;
  feltResolved: number;
  feltPending: number;
  feltRadiusKm: number | null;
  feltRadiusSource: "bmkg" | "estimate" | null;
  /** Zone of the user's location (GET /api/v1/area), else the event's zone. */
  timeZone: ZoneId;
}

export function EtaPanel({
  event,
  distance,
  serverNow,
  replay,
  onToggleReplay,
  showFelt,
  onToggleFelt,
  feltResolved,
  feltPending,
  feltRadiusKm,
  feltRadiusSource,
  timeZone,
}: EtaPanelProps) {
  const clock = (iso: string) => formatZoned(iso, timeZone, "clock");
  const [, setTick] = useState(0);
  const [replayStatus, setReplayStatus] = useState<string | null>(null);

  const hypocentralKm = distance?.hypocentralKm ?? null;
  const pArrivalQuakeSeconds =
    hypocentralKm === null
      ? null
      : hypocentralKm / DEFAULT_VELOCITY_MODEL.pVelocityKmS;
  const sArrivalQuakeSeconds =
    hypocentralKm === null
      ? null
      : hypocentralKm / DEFAULT_VELOCITY_MODEL.sVelocityKmS;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((current) => current + 1);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      !replay ||
      pArrivalQuakeSeconds === null ||
      sArrivalQuakeSeconds === null
    ) {
      return;
    }
    const update = () => {
      const elapsedQuakeSeconds =
        ((Date.now() - replay.startedAtMs) / 1000) * replay.speed;
      if (elapsedQuakeSeconds >= sArrivalQuakeSeconds) {
        setReplayStatus("Gelombang S (estimasi) telah melewati lokasi Anda.");
      } else if (elapsedQuakeSeconds >= pArrivalQuakeSeconds) {
        setReplayStatus(
          "Gelombang P (estimasi) melewati lokasi Anda, guncangan kuat menyusul.",
        );
      } else {
        setReplayStatus(
          `Gelombang menjalar… t ≈ ${Math.round(elapsedQuakeSeconds)} dtk`,
        );
      }
    };
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [replay, pArrivalQuakeSeconds, sArrivalQuakeSeconds]);

  if (!event) return null;

  if (!distance) {
    return (
      <div className="border-b border-border bg-surface-2 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Estimasi waktu tiba</h2>
        <p className="mt-1 text-xs text-muted">Lokasi belum diatur.</p>
      </div>
    );
  }

  const estimate = estimateArrival({
    originTimeUtc: event.eventTimeUtc,
    hypocentralKm: distance.hypocentralKm,
    model: DEFAULT_VELOCITY_MODEL,
    nowUtc: new Date(serverNow()).toISOString(),
  });

  const arrived = estimate.secondsUntilS <= 0;
  const mmi = describeMmi(estimateMmi(event.magnitude, distance.hypocentralKm));
  const feltReports = [...(event.feltReports ?? [])].sort((a, b) => {
    const aMax = parseMmiString(a.mmi)?.max ?? 0;
    const bMax = parseMmiString(b.mmi)?.max ?? 0;
    return bMax - aMax;
  });

  return (
    <div className="border-b border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Estimasi waktu tiba</h2>
        <button
          type="button"
          onClick={onToggleReplay}
          className={
            replay
              ? "inline-flex min-h-11 items-center gap-2 rounded-sm border border-danger px-4 text-sm text-danger transition-colors duration-150 hover:bg-danger-soft"
              : "inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-4 text-sm text-muted transition-colors duration-150 hover:border-foreground hover:text-foreground"
          }
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            {replay ? (
              <rect x="2" y="2" width="8" height="8" fill="currentColor" />
            ) : (
              <path d="M3 1.5l7.5 4.5L3 10.5z" fill="currentColor" />
            )}
          </svg>
          {replay ? "Hentikan replay" : "Replay kejadian"}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <MagBadge magnitude={event.magnitude} />
        <span className="line-clamp-1 text-xs text-foreground">
          {event.regionName}
        </span>
      </div>

      <div className="mt-3 rounded-sm border border-border bg-surface-2 px-3 py-3 text-center">
        {arrived ? (
          <>
            <p className="text-xs text-muted">Perkiraan gelombang S</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              Sudah tiba
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">Perkiraan tiba gelombang S</p>
            <p className="mt-1 font-mono text-3xl font-semibold text-accent">
              {formatCountdown(estimate.secondsUntilS)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              rentang {clock(estimate.sArrivalEarliestUtc)} sampai{" "}
              {clock(estimate.sArrivalLatestUtc)}
            </p>
          </>
        )}
      </div>

      <div className="mt-2 rounded-sm border border-border bg-surface-2 px-3 py-2">
        <p className="flex items-center gap-2 text-xs text-muted">
          Estimasi intensitas di lokasi Anda
          <span className="rounded-sm border border-border px-1.5 text-xs font-medium text-muted">
            Estimasi
          </span>
        </p>
        <p className="mt-1 text-sm text-foreground">
          <span className="font-semibold">MMI {mmi.roman}</span>, {mmi.label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {mmi.description}
        </p>
      </div>

      <div className="mt-2 rounded-sm border border-border bg-surface-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs text-muted">
            Laporan dirasakan
            <span className="rounded-sm border border-ok px-1.5 text-xs font-medium text-ok">
              RESMI BMKG
            </span>
          </p>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={showFelt}
              onChange={onToggleFelt}
              className="h-5 w-5 accent-[var(--signal)]"
            />
            Tampilkan di peta
          </label>
        </div>
        {feltReports.length > 0 ? (
          <>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {feltReports.map((report, index) => (
                <li
                  key={`${report.mmi}-${report.place}-${index}`}
                  className="min-h-11 rounded-sm border border-foreground px-3 text-sm text-foreground"
                >
                  MMI {report.mmi} · {report.place}
                </li>
              ))}
            </ul>
            {showFelt && (
              <p className="mt-1.5 text-xs text-muted">
                {feltResolved} lokasi terpetakan
                {feltPending > 0
                  ? ` · ${feltPending} sedang dicari…`
                  : " (posisi perkiraan hasil pencarian nama tempat)"}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">
            Belum ada laporan dirasakan dari BMKG untuk kejadian ini.
          </p>
        )}
      </div>

      <dl className="mt-2 space-y-1 text-xs text-muted">
        <div className="flex justify-between">
          <dt>Jarak hiposentral</dt>
          <dd className="text-foreground">
            ≈ {Math.round(estimate.hypocentralKm)} km
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Gelombang P tiba</dt>
          <dd className="text-foreground">
            ≈ {clock(estimate.pArrivalUtc)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Gelombang S tiba</dt>
          <dd className="text-foreground">
            ≈ {clock(estimate.sArrivalUtc)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Sisa waktu peringatan</dt>
          <dd className="text-foreground">
            {arrived
              ? "tidak ada"
              : `≈ ${formatDurationId(estimate.warningSecondsRemaining)}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Ketidakpastian</dt>
          <dd className="text-foreground">
            ± {formatDurationId(estimate.uncertaintySeconds)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Perkiraan batas terasa (MMI ≥ II)</dt>
          <dd className="text-right text-foreground">
            {feltRadiusKm !== null ? (
              <>
                ≈ {Math.round(feltRadiusKm)} km{" "}
                <span className="text-muted">
                  ({feltRadiusSource === "bmkg" ? "dari laporan BMKG" : "estimasi model"})
                </span>
              </>
            ) : (
              <span className="text-muted">
                kemungkinan tidak terasa di permukaan (gempa dalam)
              </span>
            )}
          </dd>
        </div>
      </dl>

      {estimate.blindZone && (
        <div className="mt-2 border-l-2 border-warn bg-warn-soft px-3 py-2">
          <p className="text-xs font-semibold text-warn">
            Mungkin di zona buta
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/90">
            Estimasi ini mungkin memberi sedikit atau tanpa peringatan karena
            Anda relatif dekat dengan sumber gempa.
          </p>
        </div>
      )}

      {replay && replayStatus && (
        <p className="mt-2 border-l-2 border-signal bg-signal-soft px-3 py-2 text-sm text-foreground">
          {replayStatus}
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        Bukan peringatan resmi BMKG. Ikuti arahan BMKG dan BPBD.
      </p>
    </div>
  );
}
