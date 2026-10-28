// Testcontainers helpers for *.int.test.ts. Only loaded by integration runs (scripts/test-int.mjs checks Docker first).
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";

export const POSTGIS_IMAGE = "postgis/postgis:18-3.6-alpine";
export const REDIS_IMAGE = "redis:8.10.3-alpine";

export interface StartedPostgis {
  url: string;
  stop: () => Promise<void>;
}

export async function startPostgis(): Promise<StartedPostgis> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGIS_IMAGE)
    .withDatabase("indoquake_test")
    .withUsername("indoquake")
    .withPassword("indoquake")
    .start();
  return { url: container.getConnectionUri(), stop: async () => void (await container.stop()) };
}

export interface StartedRedis {
  url: string;
  stop: () => Promise<void>;
  container: StartedTestContainer;
}

export async function startRedis(): Promise<StartedRedis> {
  const container = await new GenericContainer(REDIS_IMAGE)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();
  return {
    url: `redis://${container.getHost()}:${container.getMappedPort(6379)}`,
    stop: async () => void (await container.stop()),
    container,
  };
}
