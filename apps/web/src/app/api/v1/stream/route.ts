import { subscribeEvents } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string): void => {
        controller.enqueue(encoder.encode(chunk));
      };

      send("retry: 3000\n\n");
      send(
        `event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`,
      );

      unsubscribe = subscribeEvents((payload) => {
        send(`event: earthquake\ndata: ${payload}\n\n`);
      });

      heartbeat = setInterval(() => {
        send(`: ping ${Date.now()}\n\n`);
      }, 25_000);

      const cleanup = (): void => {
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
      };

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // stream sudah tertutup
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
