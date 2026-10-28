import {
  SSE_EVENT_EARTHQUAKE,
  SSE_EVENT_PING,
  SSE_EVENT_READY,
  SSE_EVENT_RESYNC,
  SSE_EVENT_STATUS,
  SSE_PATH,
  SSE_SILENCE_TIMEOUT_MS,
} from "@indoquake/shared";
import type {
  EarthquakeStreamPayload,
  SseReadyPayload,
  StatusPayload,
} from "@indoquake/shared";

/** The part of EventSource the live feed uses; tests pass a fake. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

export type ConnectionState = "connecting" | "open" | "closed";

export interface LiveFeedOptions {
  createSource: (url: string) => EventSourceLike;
  onEarthquake: (payload: EarthquakeStreamPayload) => void;
  onStatus?: (status: StatusPayload) => void;
  onConnection?: (state: ConnectionState) => void;
  /** Refetch the event list: server sent `resync`, or the client was away longer than the replay window. */
  onResync?: () => void;
  url?: string;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface LiveFeed {
  close(): void;
}

/** Manual reopen delays: 3 s, 6 s, 12 s, then 30 s for every further attempt. */
export const RECONNECT_DELAYS_MS = [3_000, 6_000, 12_000, 30_000] as const;
const REPLAY_WINDOW_MS = 6 * 3_600_000;

export function reconnectDelayMs(attempt: number): number {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}

function parse<T>(event: MessageEvent<string>): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export function createLiveFeed(options: LiveFeedOptions): LiveFeed {
  const url = options.url ?? SSE_PATH;
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let source: EventSourceLike | null = null;
  let attempt = 0;
  let lastSeq: number | null = null;
  let lastFrameAt: number | null = null;
  let silenceTimer: unknown = null;
  let reopenTimer: unknown = null;
  let closed = false;

  const clearSilence = () => {
    if (silenceTimer !== null) clearTimer(silenceTimer);
    silenceTimer = null;
  };

  const armSilence = () => {
    clearSilence();
    silenceTimer = setTimer(() => {
      silenceTimer = null;
      dropAndReopen();
    }, SSE_SILENCE_TIMEOUT_MS);
  };

  const frame = () => {
    lastFrameAt = now();
    armSilence();
  };

  const dropAndReopen = () => {
    if (closed) return;
    clearSilence();
    source?.close();
    source = null;
    options.onConnection?.("closed");
    if (reopenTimer !== null) return;
    const delay = reconnectDelayMs(attempt);
    attempt += 1;
    reopenTimer = setTimer(() => {
      reopenTimer = null;
      open();
    }, delay);
  };

  const open = () => {
    if (closed) return;
    const awayMs = lastFrameAt === null ? 0 : now() - lastFrameAt;
    const target = lastSeq === null ? url : `${url}?lastEventId=${lastSeq}`;
    options.onConnection?.("connecting");
    const next = options.createSource(target);
    source = next;
    armSilence();

    next.addEventListener(SSE_EVENT_READY, (event) => {
      frame();
      attempt = 0;
      const ready = parse<SseReadyPayload>(event);
      if (lastSeq === null && ready && typeof ready.lastEventId === "number") {
        lastSeq = ready.lastEventId;
      }
      options.onConnection?.("open");
      if (awayMs > REPLAY_WINDOW_MS) options.onResync?.();
    });
    next.addEventListener(SSE_EVENT_STATUS, (event) => {
      frame();
      const status = parse<StatusPayload>(event);
      if (status) options.onStatus?.(status);
    });
    next.addEventListener(SSE_EVENT_PING, frame);
    next.addEventListener(SSE_EVENT_RESYNC, () => {
      frame();
      options.onResync?.();
    });
    next.addEventListener(SSE_EVENT_EARTHQUAKE, (event) => {
      frame();
      const payload = parse<EarthquakeStreamPayload>(event);
      if (!payload?.event?.eventKey) return;
      const seq = typeof payload.seq === "number" ? payload.seq : Number(event.lastEventId);
      if (Number.isFinite(seq) && seq > 0) {
        if (lastSeq !== null && seq <= lastSeq) return;
        lastSeq = seq;
      }
      options.onEarthquake(payload);
    });
    // Any error (503 cap, server lifetime close, network): close and reopen with backoff,
    // never the browser's own fixed 3 s loop.
    next.onerror = () => dropAndReopen();
  };

  open();

  return {
    close() {
      closed = true;
      clearSilence();
      if (reopenTimer !== null) clearTimer(reopenTimer);
      reopenTimer = null;
      source?.close();
      source = null;
    },
  };
}
