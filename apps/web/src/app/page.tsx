import type { EarthquakeEvent } from "@indoquake/shared";
import { listEarthquakes } from "@/lib/queries";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let events: EarthquakeEvent[] = [];
  let dataError: string | null = null;

  try {
    events = await listEarthquakes({ limit: 300 });
  } catch (error) {
    dataError = error instanceof Error ? error.message : String(error);
  }

  return <Dashboard initialEvents={events} dataError={dataError} />;
}
