"use client";

import { useEffect, useState } from "react";
import { formatWibTime } from "@/lib/format-time";

interface HealthPayload {
  status: string;
  time: string;
  earthquakes: { count: number | null; latestEventAt: string | null };
  worker: { at?: string; ok?: boolean } | null;
}

interface SyncState {
  syncedAtWib: string | null;
  latestEventWib: string | null;
  count: number | null;
  stale: boolean;
  failed: boolean;
}

const REFRESH_MS = 30_000;
const STALE_MS = 3 * 60_000;

const INITIAL: SyncState = {
  syncedAtWib: null,
  latestEventWib: null,
  count: null,
  stale: false,
  failed: false,
};

function toIso(value: string | null): string | null {
  if (!value) return null;
  return value.includes("T") ? value : value.replace(" ", "T");
}

export function SyncStatus() {
  const [state, setState] = useState<SyncState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/v1/health", { cache: "no-store" });
        const json = (await response.json()) as HealthPayload;
        if (cancelled) return;

        const workerAt = json.worker?.at ?? null;
        const workerMs = workerAt ? new Date(workerAt).getTime() : null;
        const latestIso = toIso(json.earthquakes.latestEventAt);

        setState({
          syncedAtWib: workerAt ? formatWibTime(workerAt) : null,
          latestEventWib: latestIso ? formatWibTime(latestIso) : null,
          count: json.earthquakes.count,
          stale:
            workerMs === null || Date.now() - workerMs > STALE_MS,
          failed: false,
        });
      } catch {
        if (!cancelled) setState({ ...INITIAL, failed: true });
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (state.failed) {
    return (
      <p className="mt-1 text-[10px] text-amber-300">
        Status sinkron tidak tersedia (server tidak terjangkau).
      </p>
    );
  }

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
      <span
        className={
          state.stale
            ? "h-1.5 w-1.5 rounded-full bg-amber-400"
            : "h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"
        }
      />
      <span>
        Sinkron BMKG:{" "}
        <span className="text-foreground">
          {state.syncedAtWib ?? "—"}
        </span>
      </span>
      {state.latestEventWib && (
        <span>
          · Gempa terbaru (BMKG):{" "}
          <span className="text-foreground">{state.latestEventWib}</span>
        </span>
      )}
      {state.stale && (
        <span className="text-amber-300">
          · worker mungkin berhenti — data mungkin tidak terbaru
        </span>
      )}
    </p>
  );
}
