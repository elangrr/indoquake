import { and, desc, eq, gte } from "drizzle-orm";
import type { Logger } from "pino";
import { alertSubscriptions, earthquakes, type Database } from "@indoquake/database";
import { sendTelegramMessage } from "@indoquake/notifications/senders";
import { formatStartMessage } from "@indoquake/notifications";

const FOOTER =
  "\n\nSumber data: BMKG · notifikasi aplikasi, bukan peringatan resmi.";

const DEFAULT_MIN_MAGNITUDE = 4.5;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat?: { id?: number; type?: string };
    text?: string;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wibMidnightUtc(): Date {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const midnightUtcMs =
    Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) -
    7 * 60 * 60 * 1000;
  return new Date(midnightUtcMs);
}

type EarthquakeRow = typeof earthquakes.$inferSelect;

function formatEvent(event: EarthquakeRow): string {
  const lines = [
    `M${event.magnitude.toFixed(1)} · ${event.regionName}`,
    `Kedalaman ${event.depthKm} km · ${event.eventTimeWib}`,
  ];
  if (event.tsunamiPotential === true) {
    lines.push("⚠️ BMKG: BERPOTENSI TSUNAMI — ikuti arahan resmi BMKG/BPBD");
  }
  if (event.feltText) {
    lines.push(`Dirasakan (BMKG): ${event.feltText}`);
  }
  return lines.join("\n");
}

function parseMagnitude(args: string[]): number | null {
  const raw = args.join("").replace(/^m/i, "").replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 10) return null;
  return value;
}

async function handleCommand(
  db: Database,
  logger: Logger,
  chatId: number,
  command: string,
  args: string[],
): Promise<string> {
  const target = String(chatId);

  switch (command) {
    case "/start":
    case "/bantuan":
    case "/help":
      return `${formatStartMessage()}\n\nChat ID Anda: ${target}\n\nCara berlangganan: kirim /langganan (atau /langganan M5).${FOOTER}`;

    case "/id":
      return `Chat ID Anda: ${target}\n\nGunakan ini bila ingin mengisi form di situs.${FOOTER}`;

    case "/langganan": {
      const magnitude = parseMagnitude(args) ?? DEFAULT_MIN_MAGNITUDE;
      await db
        .insert(alertSubscriptions)
        .values({
          channel: "telegram",
          target,
          minMagnitude: magnitude,
          active: true,
        })
        .onConflictDoUpdate({
          target: [alertSubscriptions.channel, alertSubscriptions.target],
          set: { minMagnitude: magnitude, active: true },
        });
      logger.info({ target, magnitude }, "telegram_subscription_created");
      return `✅ Langganan aktif untuk chat ini.\nAmbang: gempa M ≥ ${magnitude.toFixed(1)}.\n\nUbah ambang: /langganan M6\nBerhenti: /berhenti${FOOTER}`;
    }

    case "/berhenti":
    case "/stop": {
      await db
        .update(alertSubscriptions)
        .set({ active: false })
        .where(
          and(
            eq(alertSubscriptions.channel, "telegram"),
            eq(alertSubscriptions.target, target),
          ),
        );
      logger.info({ target }, "telegram_subscription_stopped");
      return `Langganan dihentikan. Kirim /langganan kapan saja untuk mengaktifkan lagi.${FOOTER}`;
    }

    case "/terbaru": {
      const [event] = await db
        .select()
        .from(earthquakes)
        .orderBy(desc(earthquakes.eventTimeUtc))
        .limit(1);
      if (!event) return `Belum ada data gempa tersimpan.${FOOTER}`;
      return `🌏 Gempa terbaru\n\n${formatEvent(event)}${FOOTER}`;
    }

    case "/hariini": {
      const since = wibMidnightUtc();
      const rows = await db
        .select()
        .from(earthquakes)
        .where(gte(earthquakes.eventTimeUtc, since))
        .orderBy(desc(earthquakes.eventTimeUtc))
        .limit(5);
      if (rows.length === 0) return `Belum ada gempa tercatat hari ini.${FOOTER}`;
      const body = rows.map((event) => formatEvent(event)).join("\n\n");
      return `📅 Gempa hari ini (5 terbaru dari ${rows.length} yang ditampilkan)\n\n${body}${FOOTER}`;
    }

    case "/kuat": {
      const [event] = await db
        .select()
        .from(earthquakes)
        .where(gte(earthquakes.magnitude, 5))
        .orderBy(desc(earthquakes.eventTimeUtc))
        .limit(1);
      if (!event) return `Belum ada gempa M5+ tersimpan.${FOOTER}`;
      return `💪 Gempa M5+ terakhir\n\n${formatEvent(event)}${FOOTER}`;
    }

    case "/tsunami": {
      const [event] = await db
        .select()
        .from(earthquakes)
        .where(eq(earthquakes.tsunamiPotential, true))
        .orderBy(desc(earthquakes.eventTimeUtc))
        .limit(1);
      if (!event) {
        return `Tidak ada gempa berpotensi tsunami pada data tersimpan. Untuk status resmi terkini, lihat InaTEWS BMKG.${FOOTER}`;
      }
      return `🌊 Gempa berpotensi tsunami (data BMKG)\n\n${formatEvent(event)}\n\nIkuti arahan resmi BMKG/BPBD.${FOOTER}`;
    }

    default:
      return `Perintah tidak dikenal.\n\n${formatStartMessage()}${FOOTER}`;
  }
}

export function startTelegramBot(db: Database, logger: Logger): () => void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.info("telegram_bot_disabled (TELEGRAM_BOT_TOKEN kosong)");
    return () => {};
  }

  let stopped = false;
  let offset = 0;

  const loop = async () => {
    logger.info("telegram_bot_started");
    while (!stopped) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}`,
          { signal: AbortSignal.timeout(35_000) },
        );
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `HTTP ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
          );
        }
        const data = (await response.json()) as {
          ok: boolean;
          result?: TelegramUpdate[];
        };
        for (const update of data.result ?? []) {
          offset = update.update_id + 1;
          const chatId = update.message?.chat?.id;
          const text = update.message?.text?.trim();
          if (chatId === undefined || !text) continue;
          const [rawCommand, ...args] = text.split(/\s+/);
          const command = (rawCommand ?? "")
            .toLowerCase()
            .replace(/@.*$/, "");
          try {
            const reply = await handleCommand(db, logger, chatId, command, args);
            await sendTelegramMessage(String(chatId), reply, { token });
          } catch (error) {
            logger.warn({ err: error, command }, "telegram_command_failed");
          }
        }
      } catch (error) {
        if (stopped) return;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("409")) {
          logger.warn(
            { err: error },
            "telegram_bot_conflict — ada instance lain yang memakai token bot ini. Hentikan instance itu, atau buat token bot baru lewat @BotFather.",
          );
          await sleep(15_000);
        } else {
          logger.warn({ err: error }, "telegram_poll_failed");
          await sleep(3000);
        }
      }
    }
  };

  void loop();
  return () => {
    stopped = true;
  };
}
