import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { capFromEnv, createEventLogReader, SSE_MAX_CONNECTIONS_DEFAULT, SSE_MAX_PER_IP_DEFAULT, StreamHub } from "@indoquake/api";
import { EVENT_CHANNEL } from "@indoquake/shared";
import { getDb } from "./db";
import { getStatus } from "./queries";

type Listener = (payload: string) => void;

const globalForEvents = globalThis as unknown as {
  indoquakeEmitter?: EventEmitter;
  indoquakeSubscriber?: Redis;
  indoquakeStreamHub?: StreamHub;
};

function getEmitter(): EventEmitter {
  if (!globalForEvents.indoquakeEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
      // A Redis outage must not crash the web process; the stream falls back to polling event_log.
      subscriber.on("error", () => undefined);
      subscriber.subscribe(EVENT_CHANNEL).catch(() => undefined);
      subscriber.on("message", (_channel, message) => {
        emitter.emit("message", message);
      });
      globalForEvents.indoquakeSubscriber = subscriber;
    }
    globalForEvents.indoquakeEmitter = emitter;
  }
  return globalForEvents.indoquakeEmitter;
}

export function subscribeEvents(listener: Listener): () => void {
  const emitter = getEmitter();
  emitter.on("message", listener);
  return () => {
    emitter.off("message", listener);
  };
}

/** One hub per web process: caps from SSE_MAX_CONNECTIONS / SSE_MAX_PER_IP. */
export function getStreamHub(): StreamHub {
  if (!globalForEvents.indoquakeStreamHub) {
    globalForEvents.indoquakeStreamHub = new StreamHub({
      log: createEventLogReader(getDb()),
      status: getStatus,
      subscribe: (listener) => subscribeEvents(() => listener()),
      maxConnections: capFromEnv(process.env.SSE_MAX_CONNECTIONS, SSE_MAX_CONNECTIONS_DEFAULT),
      maxPerIp: capFromEnv(process.env.SSE_MAX_PER_IP, SSE_MAX_PER_IP_DEFAULT),
    });
  }
  return globalForEvents.indoquakeStreamHub;
}
