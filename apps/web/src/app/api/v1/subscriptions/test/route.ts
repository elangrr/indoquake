import { NextResponse, type NextRequest } from "next/server";
import { formatTestMessage } from "@indoquake/notifications";
import { sendChannelMessage } from "@indoquake/notifications/senders";
import { clientIp, RATE_LIMITS, rateLimitResponse } from "@indoquake/api";
import { getRedis } from "@/lib/redis";
import { validateChannelTarget } from "@/lib/subscription-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Per X-Real-IP (set by nginx; X-Forwarded-For is ignored) and a daily cap over all callers (D15, D19).
  const limited = await rateLimitResponse(getRedis(), [
    { rule: RATE_LIMITS.testPerIp, key: clientIp(request.headers) },
    { rule: RATE_LIMITS.testGlobal, key: "all" },
  ]);
  if (limited) return limited;

  let body: { channel?: unknown; target?: unknown };
  try {
    body = (await request.json()) as { channel?: unknown; target?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const validated = validateChannelTarget(body.channel, body.target);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    await sendChannelMessage(
      validated.channel,
      validated.target,
      formatTestMessage(),
    );
    return NextResponse.json({ ok: true, channel: validated.channel });
  } catch {
    return NextResponse.json({ error: "Gagal mengirim notifikasi uji" }, { status: 502 });
  }
}
