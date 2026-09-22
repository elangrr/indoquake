import { NextResponse, type NextRequest } from "next/server";
import { formatTestMessage } from "@indoquake/notifications";
import { sendChannelMessage } from "@indoquake/notifications/senders";
import { validateChannelTarget } from "@/lib/subscription-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

const globalForTest = globalThis as unknown as {
  indoquakeTestHits?: Map<string, number[]>;
};

function allowRequest(ip: string): boolean {
  if (!globalForTest.indoquakeTestHits) {
    globalForTest.indoquakeTestHits = new Map();
  }
  const hits = globalForTest.indoquakeTestHits;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan uji. Coba lagi dalam 1 menit." },
      { status: 429 },
    );
  }

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
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengirim notifikasi uji",
      },
      { status: 502 },
    );
  }
}
