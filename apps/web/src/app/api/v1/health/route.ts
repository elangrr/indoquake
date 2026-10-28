import { json } from "@indoquake/api";
import { getHealth } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getHealth();
  return json(health.body, health.status);
}
