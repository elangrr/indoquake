import type { EarthquakeEvent } from "@indoquake/shared";
import { listEarthquakes } from "@/lib/queries";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  let events: EarthquakeEvent[] = [];
  let dataError = false;

  try {
    events = await listEarthquakes({ limit: 100 });
  } catch {
    // The dashboard loads the list from the API in the browser instead.
    dataError = true;
  }

  return <Dashboard initialEvents={events} dataError={dataError} />;
}
