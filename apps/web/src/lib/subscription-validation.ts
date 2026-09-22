export const TELEGRAM_TARGET = /^-?\d{4,20}$/;
export const DISCORD_TARGET =
  /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/;

export type ValidatedChannel = "telegram" | "discord";

export function validateChannelTarget(
  channel: unknown,
  target: unknown,
):
  | { error: string }
  | { channel: ValidatedChannel; target: string } {
  if (channel !== "telegram" && channel !== "discord") {
    return {
      error: "Kanal harus 'telegram' atau 'discord' (email belum diaktifkan)",
    };
  }
  const value = typeof target === "string" ? target.trim() : "";
  if (channel === "telegram" && !TELEGRAM_TARGET.test(value)) {
    return {
      error:
        "Chat ID Telegram tidak valid (contoh: 123456789). Kirim /start ke bot lalu ambil ID dari @userinfobot.",
    };
  }
  if (channel === "discord" && !DISCORD_TARGET.test(value)) {
    return {
      error:
        "URL webhook Discord tidak valid (contoh: https://discord.com/api/webhooks/…).",
    };
  }
  return { channel, target: value };
}
