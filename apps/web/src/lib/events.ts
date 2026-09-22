import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { EVENT_CHANNEL } from "@indoquake/shared";

type Listener = (payload: string) => void;

const globalForEvents = globalThis as unknown as {
  indoquakeEmitter?: EventEmitter;
  indoquakeSubscriber?: Redis;
};

function getEmitter(): EventEmitter {
  if (!globalForEvents.indoquakeEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(1000);
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
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
