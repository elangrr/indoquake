import {
  SSE_EVENT_EARTHQUAKE,
  SSE_EVENT_PING,
  SSE_EVENT_READY,
  SSE_EVENT_RESYNC,
  SSE_EVENT_STATUS,
  SSE_MAX_LIFETIME_MS,
  SSE_PING_INTERVAL_MS,
  SSE_RETRY_MS,
  type SsePingPayload,
  type SseReadyPayload,
  type SseResyncPayload,
  type StatusPayload,
} from "@indoquake/shared";
import type { EventLogReader, LogEntry } from "./event-log";
import { apiError } from "./http";
import { planReplay, readLastEventId } from "./replay";

export const SSE_MAX_CONNECTIONS_DEFAULT = 500;
export const SSE_MAX_PER_IP_DEFAULT = 6;
export const SSE_RETRY_AFTER_SECONDS = 30;
export const SSE_POLL_INTERVAL_MS = 5_000;
export const SSE_STATUS_INTERVAL_MS = 30_000;

export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
} as const;

export interface StreamHubOptions {
  log: EventLogReader;
  status: () => Promise<StatusPayload>;
  /** Redis pub/sub wake-up: any message on the channel triggers an immediate event_log read. */
  subscribe?: (listener: () => void) => () => void;
  maxConnections?: number;
  maxPerIp?: number;
  pollIntervalMs?: number;
  pingIntervalMs?: number;
  statusIntervalMs?: number;
  lifetimeMs?: number;
  now?: () => number;
}

interface Client {
  ip: string;
  /** False until retry, ready, status and any replay are sent; live frames wait for it. */
  ready: boolean;
  lastSentSeq: number;
  send: (chunk: string) => void;
  close: () => void;
}

export function frame(event: string, data: unknown, id?: number): string {
  return `${id === undefined ? "" : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Positive integer from an env value, else the default. */
export function capFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Fan-out for GET /api/v1/stream. Frames come only from event_log (ids strictly increasing per
 * client): Redis messages wake the shared reader at once, and a shared 5 s poll covers a Redis
 * outage. One status computation, one ping timer and one poll timer serve every client.
 */
export class StreamHub {
  private readonly clients = new Set<Client>();
  private readonly perIp = new Map<string, number>();
  private readonly options: Required<Omit<StreamHubOptions, "subscribe">> & Pick<StreamHubOptions, "subscribe">;
  private cursor: number | null = null;
  private reading: Promise<void> | null = null;
  private readAgain = false;
  private lastState: string | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(options: StreamHubOptions) {
    this.options = {
      maxConnections: SSE_MAX_CONNECTIONS_DEFAULT,
      maxPerIp: SSE_MAX_PER_IP_DEFAULT,
      pollIntervalMs: SSE_POLL_INTERVAL_MS,
      pingIntervalMs: SSE_PING_INTERVAL_MS,
      statusIntervalMs: SSE_STATUS_INTERVAL_MS,
      lifetimeMs: SSE_MAX_LIFETIME_MS,
      now: Date.now,
      ...options,
    };
  }

  get connectionCount(): number {
    return this.clients.size;
  }

  /** Opens a stream for one client, or answers 503 + Retry-After when a cap is reached. */
  open(request: Request, ip: string): Response {
    const ipCount = this.perIp.get(ip) ?? 0;
    if (this.clients.size >= this.options.maxConnections || ipCount >= this.options.maxPerIp) {
      return apiError(503, "Terlalu banyak koneksi langsung. Coba lagi sebentar.", SSE_RETRY_AFTER_SECONDS);
    }
    this.perIp.set(ip, ipCount + 1);
    const encoder = new TextEncoder();
    let client: Client | null = null;
    let lifetime: ReturnType<typeof setTimeout> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        let closed = false;
        const current: Client = {
          ip,
          ready: false,
          lastSentSeq: 0,
          send: (chunk) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              current.close();
            }
          },
          close: () => {
            if (closed) return;
            closed = true;
            if (lifetime) clearTimeout(lifetime);
            this.detach(current);
            try {
              controller.close();
            } catch {
              // already closed by the runtime
            }
          },
        };
        client = current;
        current.send(`retry: ${SSE_RETRY_MS}\n\n`);
        this.attach(current);
        lifetime = setTimeout(() => current.close(), this.options.lifetimeMs);
        request.signal.addEventListener("abort", () => current.close(), { once: true });
        void this.greet(current, readLastEventId(request));
      },
      cancel: () => client?.close(),
    });
    return new Response(stream, { headers: SSE_HEADERS });
  }

  /** Stops timers and closes every stream (tests, shutdown). */
  closeAll(): void {
    for (const client of [...this.clients]) client.close();
  }

  private attach(client: Client): void {
    this.clients.add(client);
    if (this.clients.size === 1) this.startShared();
  }

  private detach(client: Client): void {
    if (!this.clients.delete(client)) return;
    const left = (this.perIp.get(client.ip) ?? 1) - 1;
    if (left > 0) this.perIp.set(client.ip, left);
    else this.perIp.delete(client.ip);
    if (this.clients.size === 0) this.stopShared();
  }

  private startShared(): void {
    const { pollIntervalMs, pingIntervalMs, statusIntervalMs } = this.options;
    this.timers = [
      setInterval(() => void this.readNew(), pollIntervalMs),
      setInterval(() => this.broadcast(frame(SSE_EVENT_PING, { at: this.iso() } satisfies SsePingPayload)), pingIntervalMs),
      setInterval(() => void this.refreshStatus(true), statusIntervalMs),
    ];
    this.unsubscribe = this.options.subscribe?.(() => void this.readNew()) ?? null;
  }

  private stopShared(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.cursor = null;
  }

  private iso(): string {
    return new Date(this.options.now()).toISOString();
  }

  private broadcast(chunk: string): void {
    for (const client of this.clients) if (client.ready) client.send(chunk);
  }

  private sendEntries(client: Client, entries: LogEntry[]): void {
    for (const entry of entries) {
      if (entry.seq <= client.lastSentSeq) continue;
      client.lastSentSeq = entry.seq;
      client.send(frame(SSE_EVENT_EARTHQUAKE, entry.payload, entry.seq));
    }
  }

  private async greet(client: Client, lastEventId: number | null): Promise<void> {
    try {
      const newestId = await this.options.log.newestId();
      if (this.cursor === null) this.cursor = newestId ?? 0;
      client.send(frame(SSE_EVENT_READY, { at: this.iso(), lastEventId: newestId } satisfies SseReadyPayload));
      const status = await this.options.status();
      this.lastState ??= status.state;
      client.send(frame(SSE_EVENT_STATUS, status));
      const window = lastEventId === null || newestId === null ? { oldestRetainedId: null, missingCount: 0 } : await this.options.log.replayWindow(lastEventId);
      const plan = planReplay({ lastEventId, newestId, ...window });
      if (plan.kind === "resync") {
        client.send(frame(SSE_EVENT_RESYNC, { reason: plan.reason } satisfies SseResyncPayload));
      } else if (plan.kind === "replay") {
        this.sendEntries(client, await this.options.log.after(plan.afterId));
      }
      // Live frames start after everything this client has already been sent or told to refetch.
      client.lastSentSeq = Math.max(client.lastSentSeq, newestId ?? 0);
      client.ready = true;
      // Catch up on rows that arrived while this client was being greeted.
      this.sendEntries(client, await this.options.log.after(client.lastSentSeq));
    } catch {
      client.close();
    }
  }

  private async readNew(): Promise<void> {
    if (this.reading) {
      this.readAgain = true;
      return this.reading;
    }
    this.reading = (async () => {
      do {
        this.readAgain = false;
        try {
          if (this.cursor === null) this.cursor = (await this.options.log.newestId()) ?? 0;
          const entries = await this.options.log.after(this.cursor);
          const last = entries.at(-1);
          if (last) this.cursor = last.seq;
          for (const client of this.clients) if (client.ready) this.sendEntries(client, entries);
          await this.refreshStatus(false);
        } catch {
          // database hiccup: the next tick retries
        }
      } while (this.readAgain);
    })();
    try {
      await this.reading;
    } finally {
      this.reading = null;
    }
  }

  private async refreshStatus(always: boolean): Promise<void> {
    try {
      const status = await this.options.status();
      if (always || status.state !== this.lastState) this.broadcast(frame(SSE_EVENT_STATUS, status));
      this.lastState = status.state;
    } catch {
      // status is best effort
    }
  }
}
