export interface TelegramOptions {
  token?: string;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: TelegramOptions = {},
): Promise<void> {
  const token = options.token ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diset di server");
  }
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Telegram HTTP ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
    );
  }
}

export async function sendDiscordMessage(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Discord HTTP ${response.status}`);
  }
}

export async function sendChannelMessage(
  channel: string,
  target: string,
  text: string,
): Promise<void> {
  if (channel === "telegram") {
    await sendTelegramMessage(target, text);
    return;
  }
  if (channel === "discord") {
    await sendDiscordMessage(target, text);
    return;
  }
  throw new Error(`Kanal '${channel}' belum didukung`);
}
