import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  indoquakeRedis?: Redis;
};

export function getRedis(): Redis {
  if (!globalForRedis.indoquakeRedis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL belum diset");
    }
    globalForRedis.indoquakeRedis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
    });
  }
  return globalForRedis.indoquakeRedis;
}
