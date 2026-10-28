import { clientIp } from "@indoquake/api";
import { getStreamHub } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  return getStreamHub().open(request, clientIp(request.headers));
}
